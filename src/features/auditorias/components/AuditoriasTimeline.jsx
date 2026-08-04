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
import { EtapasTimeline, AccionEtapa } from './timeline/EtapasTimeline'
import { BadgeMini, ListaAuditorias } from './timeline/ListaAuditorias'
import { LEYENDA_ETAPAS, decorarEtapas } from './timeline/etapas'
import {
  descargarInformeAuditoria,
  descargarPlanMejora,
} from '@/features/auditorias/lib/descargas'

import {
  BUCKETS,
  addBusinessDays,
  diffInBusinessDays,
  diffInDays,
  fmt,
  parseYMD,
  startOfDay,
} from '@/features/auditorias/hooks/useAuditTimeline'

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

      const merged = await Promise.all(
        (data || []).map(async (a) => {
          // Plan de auditoría: la ruta está en la tabla, la URL hay que firmarla.
          let plan = null
          const rec = a.plan_informe?.[0] || null
          if (rec?.archivo_path) {
            try {
              const { data: signed } = await supabase.storage
                .from(BUCKETS.PLANES)
                .createSignedUrl(rec.archivo_path, 60 * 60)
              plan = {
                path: rec.archivo_path,
                enviado_at: rec.enviado_at,
                url: signed?.signedUrl || null,
              }
            } catch {
              /* sin URL firmada: el paso se muestra como pendiente */
            }
          }

          /** Busca en el bucket el archivo cuyo nombre contiene el id del informe. */
          const fetchDoc = async (bucket) => {
            try {
              const { data: files } = await supabase.storage
                .from(bucket)
                .list('', { limit: 100, sortBy: { column: 'name', order: 'asc' } })
              const hit = (files || []).find((f) => f.name.includes(String(a.id)))
              if (!hit) return null
              const { data: signed } = await supabase.storage
                .from(bucket)
                .createSignedUrl(hit.name, 60 * 60)
              return { file: hit.name, url: signed?.signedUrl || null }
            } catch {
              return null
            }
          }

          const [validated, asistencia, evaluacion, acta, acta_compromiso] = await Promise.all([
            fetchDoc(BUCKETS.VALIDACIONES),
            fetchDoc(BUCKETS.ASISTENCIAS),
            fetchDoc(BUCKETS.EVALUACIONES),
            fetchDoc(BUCKETS.ACTAS),
            fetchDoc(BUCKETS.ACTAS_COMPROMISO),
          ])

          return { ...a, plan, validated, asistencia, evaluacion, acta, acta_compromiso }
        })
      )

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

    // Plazos respecto a la fecha de auditoría (días hábiles).
    const planDate = addBusinessDays(fa, -5)
    const cartaCompromisoDate = addBusinessDays(fa, -5)
    const actaLimit = addBusinessDays(fa, 10)
    const informeLimit = addBusinessDays(fa, 10)
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

    /** Etapa de «subir un documento»: ver el archivo o subirlo. */
    const pasoDocumento = ({ key, title, when, days, doc, campo, textoVer, textoSubir, hecho, pendiente }) => ({
      key,
      title,
      when,
      days,
      explicitDone: Boolean(selected[campo]?.url),
      subtitle: selected[campo]?.url ? hecho : pendiente,
      actions: selected[campo]?.url
        ? [{ label: textoVer, href: selected[campo].url }]
        : [{ label: textoSubir, onClick: () => subida.abrir(doc), type: 'replace' }],
    })

    const base = [
      {
        key: 'plan',
        title: 'Plan de auditoría',
        when: planDate,
        days: diffInBusinessDays(hoy, planDate),
        explicitDone: Boolean(selected.plan?.enviado_at),
        subtitle: selected.plan?.enviado_at
          ? `Enviado el ${fmt(new Date(selected.plan.enviado_at))}`
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
        key: 'acta_compromiso',
        title: 'Carta de compromiso',
        when: cartaCompromisoDate,
        days: diffInBusinessDays(hoy, cartaCompromisoDate),
        doc: 'actaCompromiso',
        campo: 'acta_compromiso',
        textoVer: 'Ver carta de compromiso',
        textoSubir: 'Subir carta de compromiso',
        hecho: 'Cargada.',
        pendiente: 'Subir PDF de la carta de compromiso.',
      }),
      pasoDocumento({
        key: 'asistencia',
        title: 'Listado de asistencia',
        when: fa,
        days: diffInDays(hoy, fa),
        doc: 'asistencia',
        campo: 'asistencia',
        textoVer: 'Ver asistencia',
        textoSubir: 'Subir asistencia',
        hecho: 'Cargado.',
        pendiente: 'Subir PDF del listado de asistencia.',
      }),
      pasoDocumento({
        key: 'evaluacion',
        title: 'Evaluación',
        when: fa,
        days: diffInDays(hoy, fa),
        doc: 'evaluacion',
        campo: 'evaluacion',
        textoVer: 'Ver evaluación',
        textoSubir: 'Subir evaluación',
        hecho: 'Cargada.',
        pendiente: 'Subir PDF de evaluación.',
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
        hecho: 'Cargada.',
        pendiente: 'Subir PDF del acta de reunión (10 días hábiles).',
      }),
      {
        // Llenar + descargar + validar, en un solo paso.
        key: 'informe',
        title: 'Informe de auditoría',
        when: informeLimit,
        days: diffInBusinessDays(hoy, informeLimit),
        explicitDone: hasValidated,
        subtitle: !isFilled
          ? 'Completar objetivo, criterios, conclusiones y recomendaciones (plazo +10 días hábiles).'
          : !hasHallazgos
            ? 'Campos listos. Asignar hallazgos.'
            : hasValidated
              ? 'Informe validado.'
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
        icon="📅"
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

              <EtapasTimeline etapas={etapas} marcarActual />
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
