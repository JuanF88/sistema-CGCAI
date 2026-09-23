'use client'

/**
 * Línea de tiempo de las auditorías del auditor.
 *
 * Cada auditoría se descompone en etapas con su fecha límite; el estado de cada
 * etapa (completada, actual, próxima, vencida) sale de comparar esa fecha con
 * hoy y de si el documento correspondiente ya está cargado.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, FileCheck2, RefreshCw } from 'lucide-react'
import { toast } from 'react-toastify'

import { supabase } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import DocumentUploadModal from '@/components/ui/DocumentUploadModal'
import { Button } from '@/components/ui/button'
import { FormDrawer } from '@/components/ui/form-drawer'
import { PageHeader } from '@/components/ui/page-header'
import { EMPTY_STATE, PAGE_SHELL, SECTION_CARD } from '@/components/ui/tokens'

import FormularioRegistro from '@/features/auditorias/components/FormularioRegistro'
import { DOCUMENTOS_AUDITOR } from '@/features/auditorias/lib/documentos'
import { useSubidaDocumento } from '@/features/auditorias/hooks/useSubidaDocumento'
import { useNotasEtapa } from '@/features/auditorias/hooks/useNotasEtapa'
import { EtapasTimeline, AccionEtapa } from './timeline/EtapasTimeline'
import { BadgeMini, ListaAuditorias } from './timeline/ListaAuditorias'
import { LEYENDA_ETAPAS, decorarEtapas } from './timeline/etapas'
import { PLAZOS } from '@/lib/catalogos/plazos'
import {
  avisoDeFallidos,
  buscarDocumento,
  firmarDocumentos,
  leerBuckets,
} from '@/features/auditorias/lib/indice-archivos'
import {
  descargarInformeAuditoria,
  descargarPlanMejora,
} from '@/features/auditorias/lib/descargas'

import {
  BUCKETS,
  addBusinessDays,
  buildActaCompromisoPath,
  buildActaPath,
  buildAsistenciaPath,
  buildEvaluacionPath,
  buildPlanPath,
  buildValidationPath,
  diffInBusinessDays,
  fmt,
  parseYMD,
  startOfDay,
} from '@/features/auditorias/hooks/useAuditTimeline'

/**
 * Los documentos que se buscan en Storage y el campo donde queda cada uno.
 *
 * Mismo criterio que el panel del administrador —nombre exacto, no «el que
 * contenga el id»—, para que las dos pantallas no discrepen sobre si un
 * documento está entregado.
 */
const DOCUMENTOS = [
  {
    campo: 'plan',
    bucket: BUCKETS.PLANES,
    ruta: (a) => a.plan_informe?.[0]?.archivo_path || buildPlanPath(a),
  },
  { campo: 'asistencia', bucket: BUCKETS.ASISTENCIAS, ruta: buildAsistenciaPath },
  { campo: 'evaluacion', bucket: BUCKETS.EVALUACIONES, ruta: buildEvaluacionPath },
  { campo: 'acta', bucket: BUCKETS.ACTAS, ruta: buildActaPath },
  { campo: 'acta_compromiso', bucket: BUCKETS.ACTAS_COMPROMISO, ruta: buildActaCompromisoPath },
  { campo: 'validated', bucket: BUCKETS.VALIDACIONES, ruta: buildValidationPath },
]

export default function AuditoriasTimeline({ usuario }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [auditorias, setAuditorias] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [informeAbierto, setInformeAbierto] = useState(false)

  const selected = useMemo(
    () => auditorias.find((a) => a.id === selectedId) || null,
    [auditorias, selectedId]
  )

  /** Las notas libres de cada paso de la auditoría elegida. */
  const { notas, guardar: guardarNota } = useNotasEtapa(selected?.id ?? null)

  /** Un solo modal para los seis documentos (ver `lib/documentos.js`). */
  const subida = useSubidaDocumento({
    documentos: DOCUMENTOS_AUDITOR,
    auditoria: selected,
    onSubido: (campo, valor, extra) =>
      setAuditorias((prev) =>
        prev.map((a) => (a.id === selected.id ? { ...a, [campo]: valor, ...(extra || {}) } : a))
      ),
  })

  /* ── Carga ── */

  const loadData = useCallback(async () => {
    if (!usuario?.usuario_id) {
      setError('Sesión no disponible. Vuelve a iniciar sesión.')
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase
        .from('informes_auditoria')
        .select(
          `
            id, objetivo, criterios, conclusiones, fecha_auditoria, asistencia_tipo,
            fecha_seguimiento, recomendaciones, auditores_acompanantes, validado,
            dependencia_id,
            dependencias ( nombre, plan_auditoria ( enlace ) ),
            programa:programa_auditoria_id ( id, nombre, anio, objetivo ),
            plan_informe:planes_auditoria_informe ( archivo_path, enviado_at ),
            fortalezas ( id ),
            oportunidades_mejora ( id ),
            no_conformidades ( id )
          `
        )
        .eq('usuario_id', usuario.usuario_id)
        .order('fecha_auditoria', { ascending: true })

      if (error) throw error

      const filas = data || []

      // Una lectura por bucket y una firma por lote (ver `lib/indice-archivos`).
      // Antes se listaba el bucket entero —con tope de 100 objetos— una vez por
      // documento y por auditoría, y cualquier fallo de red devolvía `null`,
      // que en pantalla es idéntico a «no lo he subido».
      const { indice, fallidos } = await leerBuckets(DOCUMENTOS.map((d) => d.bucket))

      const hallazgos = filas.map((a) =>
        DOCUMENTOS.map((documento) => buscarDocumento(indice, documento.bucket, documento.ruta(a)))
      )

      const rutasPorBucket = {}
      hallazgos.forEach((deLaAuditoria) => {
        deLaAuditoria.forEach((hallazgo, i) => {
          if (!hallazgo.existe) return
          ;(rutasPorBucket[DOCUMENTOS[i].bucket] ||= []).push(hallazgo.path)
        })
      })

      const urls = await firmarDocumentos(rutasPorBucket)

      const merged = filas.map((a, fila) => {
        const documentos = {}

        DOCUMENTOS.forEach((documento, i) => {
          const hallazgo = hallazgos[fila][i]

          documentos[documento.campo] = hallazgo.existe
            ? {
                path: hallazgo.path,
                url: urls.get(`${documento.bucket}|${hallazgo.path}`) ?? null,
                subido_at: hallazgo.subido_at,
              }
            : hallazgo.desconocido
              ? { desconocido: true }
              : null
        })

        // La constancia de `planes_auditoria_informe` manda; si no la hay, vale
        // la fecha del archivo. Así el paso se da por hecho igual que en el
        // panel del administrador.
        const rec = a.plan_informe?.[0] || null
        if (documentos.plan?.path) {
          documentos.plan.enviado_at =
            (rec?.archivo_path ? rec.enviado_at : null) || documentos.plan.subido_at
        }

        return { ...a, ...documentos }
      })

      if (fallidos.length) toast.warning(avisoDeFallidos(fallidos))

      setAuditorias(merged)
      setSelectedId((prev) => prev ?? merged?.[0]?.id ?? null)
    } catch (e) {
      console.error(e)
      setError(e.message || 'Error cargando auditorías')
    } finally {
      setLoading(false)
    }
  }, [usuario?.usuario_id])

  useEffect(() => {
    loadData()
  }, [loadData])

  /* ── Etapas ── */

  const { etapas, progressPct, etapaActual, todoHecho } = useMemo(() => {
    const vacio = { etapas: [], progressPct: 0, etapaActual: null, todoHecho: false }
    if (!selected?.fecha_auditoria) return vacio

    const hoy = startOfDay(new Date())
    const fa = parseYMD(selected.fecha_auditoria)
    if (!fa) return vacio

    // Plazos respecto a la fecha de auditoría, en días hábiles. Los números
    // salen de `PLAZOS`, que es de donde los leen también el Centro de Control,
    // las alertas y la nota de archivos.
    const cartaCompromisoDate = addBusinessDays(fa, PLAZOS.actaCompromiso.dias)
    const planDate = addBusinessDays(fa, PLAZOS.plan.dias)
    const asistenciaLimit = addBusinessDays(fa, PLAZOS.asistencia.dias)
    const evaluacionLimit = addBusinessDays(fa, PLAZOS.evaluacion.dias)
    const actaLimit = addBusinessDays(fa, PLAZOS.acta.dias)
    const informeLimit = addBusinessDays(fa, PLAZOS.validacion.dias)
    const pmLimit = addBusinessDays(fa, 20)

    const isFilled =
      Boolean(selected.objetivo?.trim()) &&
      Boolean(selected.criterios?.trim()) &&
      Boolean(selected.conclusiones?.trim()) &&
      Boolean(selected.recomendaciones?.trim())

    const hasHallazgos =
      (selected.fortalezas?.length || 0) +
        (selected.oportunidades_mejora?.length || 0) +
        (selected.no_conformidades?.length || 0) >
      0

    const hasValidated = Boolean(selected.validated?.url) || selected.validado === true

    // Antes esto sacaba al auditor de la pantalla («Mis Auditorías» con
    // `?informeId=`). Ahora el informe se abre aquí mismo, en un panel lateral.
    const irAlInforme = () => setInformeAbierto(true)

    /**
     * Etapa de «subir un documento»: ver el archivo o subirlo.
     *
     * `subidoAt` viaja hasta `decorarEtapas`, que es quien compara la fecha de
     * entrega con `when` y marca la etapa como envío tardío.
     */
    const pasoDocumento = ({ key, title, when, days, doc, campo, textoVer, textoSubir, hecho, pendiente }) => {
      const url = selected[campo]?.url
      const subidoAt = selected[campo]?.subido_at ?? null

      // Storage no contestó al cargar: no se sabe si está: no es lo mismo que
      // faltar, y anunciarlo como pendiente haría subirlo otra vez.
      if (selected[campo]?.desconocido === true) {
        return {
          key,
          title,
          when,
          days,
          explicitDone: false,
          subidoAt: null,
          subtitle: 'No se pudo consultar el almacenamiento, así que no se sabe si está cargado.',
          actions: [{ label: 'Reintentar', onClick: loadData, type: 'replace' }],
        }
      }

      return {
        key,
        title,
        when,
        days,
        explicitDone: Boolean(url),
        subidoAt,
        subtitle: url ? `${hecho}${subidoAt ? ` el ${fmt(new Date(subidoAt))}` : ''}.` : pendiente,
        actions: url
          ? [{ label: textoVer, href: url }]
          : [{ label: textoSubir, onClick: () => subida.abrir(doc), type: 'replace' }],
      }
    }

    // La carta de compromiso abre la línea: es lo primero que se hace, y
    // comparte plazo con el plan, así que sin este orden explícito las dos
    // etapas empatarían en fecha y la primera saldría por casualidad.
    const base = [
      pasoDocumento({
        key: 'acta_compromiso',
        title: 'Carta de compromiso',
        when: cartaCompromisoDate,
        days: diffInBusinessDays(hoy, cartaCompromisoDate),
        doc: 'actaCompromiso',
        campo: 'acta_compromiso',
        textoVer: 'Ver carta de compromiso',
        textoSubir: 'Subir carta de compromiso',
        hecho: 'Cargada',
        pendiente: 'Subir PDF de la carta de compromiso.',
      }),
      {
        key: 'plan',
        title: 'Plan de auditoría',
        when: planDate,
        days: diffInBusinessDays(hoy, planDate),
        explicitDone: Boolean(selected.plan?.enviado_at),
        subidoAt: selected.plan?.enviado_at ?? null,
        subtitle: selected.plan?.enviado_at
          ? `Enviado el ${fmt(new Date(selected.plan.enviado_at))}.`
          : 'Programar y enviar (5 días hábiles antes).',
        actions: selected.plan?.url
          ? [{ label: 'Ver plan enviado', href: selected.plan.url }]
          : [
              {
                label: 'Subir plan de auditoría',
                onClick: () => subida.abrir('plan'),
                type: 'replace',
              },
            ],
      },
      pasoDocumento({
        key: 'asistencia',
        title: 'Listado de asistencia',
        when: asistenciaLimit,
        days: diffInBusinessDays(hoy, asistenciaLimit),
        doc: 'asistencia',
        campo: 'asistencia',
        textoVer: 'Ver asistencia',
        textoSubir: 'Subir asistencia',
        hecho: 'Cargado',
        pendiente: `Subir PDF del listado de asistencia (${PLAZOS.asistencia.texto}).`,
      }),
      pasoDocumento({
        key: 'evaluacion',
        title: 'Evaluación',
        when: evaluacionLimit,
        days: diffInBusinessDays(hoy, evaluacionLimit),
        doc: 'evaluacion',
        campo: 'evaluacion',
        textoVer: 'Ver evaluación',
        textoSubir: 'Subir evaluación',
        hecho: 'Cargada',
        pendiente: `Subir PDF de evaluación (${PLAZOS.evaluacion.texto}).`,
      }),
      pasoDocumento({
        key: 'acta',
        title: 'Acta de reunión',
        when: actaLimit,
        days: diffInBusinessDays(hoy, actaLimit),
        doc: 'acta',
        campo: 'acta',
        textoVer: 'Ver acta',
        textoSubir: 'Subir acta',
        hecho: 'Cargada',
        pendiente: 'Subir PDF del acta de reunión (10 días hábiles).',
      }),
      {
        // Llenar + descargar + validar, en un solo paso.
        key: 'informe',
        title: 'Informe de auditoría',
        when: informeLimit,
        days: diffInBusinessDays(hoy, informeLimit),
        explicitDone: hasValidated,
        subidoAt: selected.validated?.subido_at ?? null,
        subtitle: !isFilled
          ? 'Completar objetivo, criterios, conclusiones y recomendaciones (plazo +10 días hábiles).'
          : !hasHallazgos
            ? 'Campos listos. Asignar hallazgos.'
            : hasValidated
              ? selected.validated?.subido_at
                ? `Informe validado el ${fmt(new Date(selected.validated.subido_at))}.`
                : 'Informe validado.'
              : 'Campos y hallazgos listos: descarga y valida.',
        actions: hasValidated
          ? [{ label: 'Ver informe validado', href: selected.validated.url, variant: 'default' }]
          : !isFilled || !hasHallazgos
            ? [
                {
                  label: isFilled ? 'Editar informe' : 'Llenar informe',
                  title: 'Abre el formulario del informe de auditoría',
                  onClick: irAlInforme,
                  type: isFilled ? 'edit' : 'fill',
                },
              ]
            : [
                { label: 'Editar informe', onClick: irAlInforme, type: 'edit' },
                {
                  label: 'Descargar informe',
                  onClick: () => descargarInformeAuditoria(selected, usuario),
                  icon: <Download />,
                },
                {
                  label: 'Validar informe',
                  onClick: () => subida.abrir('validacion'),
                  variant: 'default',
                  icon: <FileCheck2 />,
                },
              ],
      },
      {
        key: 'pm',
        title: 'Levantamiento del PM',
        when: pmLimit,
        days: diffInBusinessDays(hoy, pmLimit),
        explicitDone: false,
        subtitle: 'Plan de Mejoramiento (20 días hábiles después de entregar el informe).',
        actions: hasValidated
          ? [
              {
                label: 'Descargar formato PM',
                onClick: () => descargarPlanMejora(selected),
                icon: <Download />,
              },
            ]
          : [],
      },
    ]

    return decorarEtapas(base)
    // `subida.abrir` es estable (es un setState); las descargas no afectan al resultado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, usuario])

  const planEnlace = selected?.dependencias?.plan_auditoria?.[0]?.enlace || ''

  return (
    <div className={PAGE_SHELL}>
      <PageHeader
        title="Timeline de auditorías"
        subtitle="Seguimiento detallado de etapas y plazos de cada auditoría"
        actions={
          <Button
            variant="secondary"
            onClick={loadData}
            disabled={loading}
            className="bg-white/15 text-white hover:bg-white/25"
          >
            <RefreshCw className={cn(loading && 'animate-spin')} />
            Recargar
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <ListaAuditorias
          titulo="Auditorías asignadas"
          auditorias={auditorias}
          selectedId={selectedId}
          onSelect={setSelectedId}
          loading={loading}
          error={error}
          vacio="No tienes auditorías asignadas."
          badges={(a) =>
            (Boolean(a.validated?.url) || a.validado === true) && (
              <BadgeMini tono="success">Validado</BadgeMini>
            )
          }
        />

        <main className="min-w-0">
          {!selected && !loading && (
            <div className={cn(SECTION_CARD, EMPTY_STATE)}>
              Selecciona una auditoría para ver su línea de tiempo.
            </div>
          )}

          {selected && (
            <section className={cn(SECTION_CARD, 'flex flex-col gap-5 p-5 sm:p-6')}>
              {/* Cabecera: progreso y acción de la etapa actual */}
              <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <h2 className="text-xl font-bold tracking-tight">
                    Auditoría #{selected.id}
                    <span className="font-medium text-muted-foreground">
                      {' '}
                      — {selected.dependencias?.nombre || 'Dependencia'}
                    </span>
                  </h2>
                  {selected.fecha_auditoria && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      Fecha de auditoría:{' '}
                      <strong className="text-foreground">
                        {fmt(parseYMD(selected.fecha_auditoria))}
                      </strong>
                    </p>
                  )}
                </div>

                <div className="flex w-full flex-col gap-3 lg:max-w-sm" aria-live="polite">
                  <div className="flex items-center gap-3">
                    {planEnlace && (
                      <Button asChild variant="outline" size="sm">
                        <a href={planEnlace} target="_blank" rel="noopener noreferrer">
                          🗂️ Plan de mejora
                        </a>
                      </Button>
                    )}

                    <div
                      className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted"
                      title={`Progreso: ${progressPct}%`}
                    >
                      <div
                        className="h-full rounded-full bg-primary transition-[width] duration-500"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground">
                    <strong className="text-foreground">{progressPct}%</strong> completado
                    {etapaActual ? (
                      // Antes este hueco quedaba vacío justo cuando había etapa
                      // actual, que es cuando más útil resulta.
                      <> · Etapa actual: {etapaActual.title}</>
                    ) : (
                      <> · {todoHecho ? '¡Todo completado! 🎉' : 'Sin etapa actual.'}</>
                    )}
                  </p>

                  {etapaActual?.actions?.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {etapaActual.actions.map((act) => (
                        <AccionEtapa
                          key={act.label}
                          accion={{ ...act, variant: act.variant ?? 'default' }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </header>

              <div className="flex flex-wrap gap-4 border-y border-border py-2.5 text-xs text-muted-foreground">
                {LEYENDA_ETAPAS.map((l) => (
                  <span key={l.label} className="inline-flex items-center gap-1.5">
                    <span className={cn('h-2.5 w-2.5 rounded-full', l.clase)} />
                    {l.label}
                  </span>
                ))}
              </div>

              {/* Los plazos se cuentan desde la fecha de auditoría. Ahora que
                  ningún campo del informe es obligatorio, esa fecha puede
                  quedar vacía, y sin ella no hay línea que dibujar. */}
              {etapas.length ? (
                <EtapasTimeline
                  // Al cambiar de auditoría se remonta: si no, una nota a medio
                  // escribir seguiría abierta con el texto de la anterior.
                  key={selected.id}
                  etapas={etapas}
                  marcarActual
                  notas={notas}
                  onGuardarNota={guardarNota}
                />
              ) : (
                <p className="rounded-xl border border-dashed border-border bg-background/60 px-4 py-6 text-center text-xs text-muted-foreground">
                  Esta auditoría no tiene fecha, y los plazos se calculan a partir de ella. Ponla en
                  el informe para ver la línea de trabajo.
                </p>
              )}
            </section>
          )}
        </main>
      </div>

      <DocumentUploadModal
        isOpen={Boolean(subida.docAbierto)}
        onClose={subida.cerrar}
        title={subida.doc?.titulo ?? ''}
        maxSizeMB={subida.doc?.maxSizeMB ?? 2}
        uploadButtonLabel={subida.doc?.etiquetaBoton ?? 'Subir'}
        currentFileUrl={selected?.[subida.doc?.campo]?.url ?? null}
        onUpload={subida.subir}
        isUploading={subida.subiendo}
      />

      {/* El informe se llena aquí mismo: la línea de tiempo sigue detrás. */}
      <FormDrawer
        open={informeAbierto && Boolean(selected)}
        onOpenChange={(o) => (o ? null : setInformeAbierto(false))}
        title={`Informe de la auditoría #${selected?.id ?? ''}`}
        description={selected?.dependencias?.nombre || undefined}
        // El formulario trae su propio `<form>` y su barra de guardar.
        hideFooter
      >
        {selected && (
          <FormularioRegistro
            embebido
            usuario={usuario}
            auditoria={selected}
            onSuccess={() => {
              setInformeAbierto(false)
              loadData()
            }}
            onVolver={() => setInformeAbierto(false)}
          />
        )}
      </FormDrawer>
    </div>
  )
}
