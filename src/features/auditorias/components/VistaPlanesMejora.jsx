'use client'

/**
 * Planes de Mejoramiento.
 *
 * El Plan de Mejoramiento era un paso más de la línea de trabajo, al final y
 * sin nada que marcar: solo ofrecía descargar el formato. No encajaba ahí —se
 * levanta después de cerrar la auditoría, lo trabaja la dependencia y vuelve
 * firmado semanas más tarde—, así que vive en su propia pantalla.
 *
 * Hace dos cosas y ninguna más: generar el formato a partir de los hallazgos
 * de la auditoría, y guardar el plan ya validado. Se agrupa por año porque es
 * el ciclo con el que se revisa.
 *
 * La misma pantalla sirve al administrador y al auditor: con `usuarioId` se
 * limita a las auditorías de ese auditor y se oculta la columna del auditor,
 * que entonces sobra. Es lo que el auditor necesita y nada más, en vez de una
 * vista paralela que se quedaría atrás en el primer cambio.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ClipboardCheck, Download, ExternalLink, RefreshCw, Upload } from 'lucide-react'
import { toast } from 'react-toastify'

import { supabase } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import DocumentUploadModal from '@/components/ui/DocumentUploadModal'
import ModalGenerarPlanMejora from '@/features/auditorias/components/ModalGenerarPlanMejora'
import { InfoCard } from '@/components/ui/info-card'
import { PageHeader } from '@/components/ui/page-header'
import { SearchInput } from '@/components/ui/search-input'
import { Cargando } from '@/components/ui/loader'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PAGE_SHELL, SECTION_CARD, TABLE_CONTAINER, TABLE_TOOLBAR } from '@/components/ui/tokens'
import { useAnioInicial } from '@/hooks/useAnioInicial'
import { anioDe, formatearDia } from '@/lib/fechas'
import { descargarPlanMejora } from '@/features/auditorias/lib/descargas'
import {
  ACCEPT_PLAN_MEJORA,
  BUCKETS,
  FORMATOS_PLAN_MEJORA,
  MAX_MB,
  buildPlanMejoraPath,
  extensionDe,
  rutasPlanMejora,
} from '@/features/auditorias/hooks/useAuditTimeline'
import {
  avisoDeFallidos,
  buscarDocumentoEntre,
  firmarDocumentos,
  leerBuckets,
} from '@/features/auditorias/lib/indice-archivos'

/**
 * El auditor no pide el nombre del auditor: es él.
 *
 * No es solo ahorrar una unión. Un `embed` que RLS no deje leer no devuelve el
 * campo vacío, tumba la consulta entera, y el auditor solo tiene garantizada
 * su propia fila de `usuarios`.
 */
const SELECT = (conAuditor) => `
  id, fecha_auditoria, validado, dependencia_id,
  dependencias:dependencia_id ( nombre ),
  ${conAuditor ? 'usuarios:usuario_id ( nombre, apellido ),' : ''}
  oportunidades_mejora ( id ),
  no_conformidades ( id )
`

/** Cómo se nombran los formatos admitidos en el texto de ayuda: «Excel o PDF». */
const ETIQUETA_FORMATOS = [
  ...new Set(Object.values(FORMATOS_PLAN_MEJORA).map((f) => f.etiqueta)),
].join(' o ')

export default function VistaPlanesMejora({ usuarioId = null, soloLectura = false }) {
  const [auditorias, setAuditorias] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [anio, setAnio] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [aSubir, setASubir] = useState(null)
  const [subiendo, setSubiendo] = useState(false)
  const [aGenerar, setAGenerar] = useState(null)
  const [generando, setGenerando] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      let consulta = supabase
        .from('informes_auditoria')
        .select(SELECT(!usuarioId))
        .order('fecha_auditoria', { ascending: false })

      if (usuarioId) consulta = consulta.eq('usuario_id', usuarioId)

      const { data, error: errorConsulta } = await consulta

      if (errorConsulta) throw errorConsulta
      const filas = data ?? []

      // Una lectura del bucket para toda la pantalla y una firma por lote,
      // como en el resto del sistema (ver `lib/indice-archivos`).
      const { indice, fallidos } = await leerBuckets([BUCKETS.PLANES_MEJORA])
      if (fallidos.length) toast.warning(avisoDeFallidos(fallidos))

      // El plan puede llegar en Excel o en PDF, y la extensión va en el nombre:
      // se pregunta por todas las variantes.
      const hallazgos = filas.map((a) =>
        buscarDocumentoEntre(indice, BUCKETS.PLANES_MEJORA, rutasPlanMejora(a))
      )

      const urls = await firmarDocumentos({
        [BUCKETS.PLANES_MEJORA]: hallazgos.filter((h) => h.existe).map((h) => h.path),
      })

      setAuditorias(
        filas.map((a, i) => {
          const h = hallazgos[i]
          return {
            ...a,
            plan: h.existe
              ? {
                  path: h.path,
                  url: urls.get(`${BUCKETS.PLANES_MEJORA}|${h.path}`) ?? null,
                  subido_at: h.subido_at,
                  formato: FORMATOS_PLAN_MEJORA[extensionDe(h.path)]?.etiqueta ?? null,
                }
              : h.desconocido
                ? { desconocido: true }
                : null,
          }
        })
      )
    } catch (e) {
      console.error(e)
      setError(e.message || 'No se pudieron cargar los planes de mejoramiento')
    } finally {
      setCargando(false)
    }
  }, [usuarioId])

  useEffect(() => {
    cargar()
  }, [cargar])

  const anios = useMemo(() => {
    const vistos = new Set()
    for (const a of auditorias) {
      const y = anioDe(a.fecha_auditoria)
      if (y) vistos.add(y)
    }
    return [...vistos].sort((x, y) => y - x)
  }, [auditorias])

  useAnioInicial(anios, (y) => setAnio(String(y)), { sinDatos: '' })

  const filtradas = useMemo(() => {
    const termino = busqueda.trim().toLowerCase()

    return auditorias.filter((a) => {
      if (anio && String(anioDe(a.fecha_auditoria)) !== String(anio)) return false
      if (!termino) return true

      const texto = `${a.id} ${a.dependencias?.nombre ?? ''} ${a.usuarios?.nombre ?? ''} ${a.usuarios?.apellido ?? ''}`
      return texto.toLowerCase().includes(termino)
    })
  }, [auditorias, anio, busqueda])

  const resumen = useMemo(() => {
    const conHallazgos = filtradas.filter(
      (a) => (a.oportunidades_mejora?.length || 0) + (a.no_conformidades?.length || 0) > 0
    )
    return {
      auditorias: filtradas.length,
      conHallazgos: conHallazgos.length,
      cargados: filtradas.filter((a) => a.plan?.url).length,
      pendientes: conHallazgos.filter((a) => !a.plan?.url).length,
    }
  }, [filtradas])

  const mostrarAuditor = !usuarioId
  const columnas = mostrarAuditor ? 6 : 5

  /**
   * Genera el formato de la auditoría que se confirmó en el modal.
   *
   * `descargarPlanMejora` vuelve a leer los hallazgos: lo que se descarga es
   * lo que hay en la base en este momento, no lo que se contó al pintar la
   * tabla.
   */
  const generarFormato = async () => {
    if (!aGenerar) return

    setGenerando(true)
    try {
      await descargarPlanMejora(aGenerar)
      setAGenerar(null)
    } finally {
      setGenerando(false)
    }
  }

  const subirPlan = async (archivo) => {
    if (!archivo || !aSubir) return

    // El `accept` del selector solo es una sugerencia: se puede escribir el
    // nombre a mano y elegir cualquier cosa. Aquí se comprueba de verdad.
    const extension = extensionDe(archivo.name)
    const formato = FORMATOS_PLAN_MEJORA[extension]

    if (!formato) {
      toast.error(
        `Formato no admitido («.${extension || archivo.name}»). Sube el plan en ${ETIQUETA_FORMATOS}.`
      )
      return
    }

    setSubiendo(true)
    try {
      const path = buildPlanMejoraPath(aSubir, extension)

      const { error: errorSubida } = await supabase.storage
        .from(BUCKETS.PLANES_MEJORA)
        .upload(path, archivo, { upsert: true, contentType: formato.mime })

      if (errorSubida) throw errorSubida

      // Si antes había un plan en otro formato, su archivo sigue ahí con otro
      // nombre: sin borrarlo quedarían dos planes para la misma auditoría y la
      // pantalla tendría que elegir. Se va detrás de la subida, no antes, para
      // no quedarse sin ninguno si la subida falla.
      const anteriores = rutasPlanMejora(aSubir).filter((otra) => otra !== path)
      if (anteriores.length) {
        const { error: errorBorrado } = await supabase.storage
          .from(BUCKETS.PLANES_MEJORA)
          .remove(anteriores)
        if (errorBorrado) {
          console.warn('No se pudieron borrar los planes en otro formato:', errorBorrado.message)
        }
      }

      toast.success(`Plan de mejoramiento cargado (${formato.etiqueta}).`)
      setASubir(null)
      await cargar()
    } catch (e) {
      console.error('Error subiendo el plan de mejoramiento:', e)
      toast.error(`No se pudo subir: ${e.message || 'error desconocido'}`)
    } finally {
      setSubiendo(false)
    }
  }

  return (
    <div className={PAGE_SHELL}>
      <PageHeader
        title="Planes de Mejoramiento"
        subtitle={
          usuarioId
            ? 'Genera el formato de tus auditorías y guarda el plan que te devuelve la dependencia'
            : 'Genera el formato a partir de los hallazgos y guarda el plan ya validado'
        }
        actions={
          <div className="flex items-center gap-2">
            <Select value={anio || 'todos'} onValueChange={(v) => setAnio(v === 'todos' ? '' : v)}>
              <SelectTrigger className="w-40 border-white/25 bg-white/15 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los años</SelectItem>
                {anios.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="secondary"
              onClick={cargar}
              disabled={cargando}
              className="bg-white/15 text-white hover:bg-white/25"
            >
              <RefreshCw className={cn(cargando && 'animate-spin')} />
              Actualizar
            </Button>
          </div>
        }
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <InfoCard
          tone="blue"
          label={usuarioId ? 'Mis auditorías' : 'Auditorías'}
          value={resumen.auditorias}
        />
        <InfoCard tone="purple" label="Con hallazgos" value={resumen.conHallazgos} />
        <InfoCard tone="green" label="Planes cargados" value={resumen.cargados} />
        <InfoCard tone="orange" label="Por cargar" value={resumen.pendientes} />
      </section>

      <section className={cn(SECTION_CARD, 'flex flex-col gap-4 p-4')}>
        <div className={TABLE_TOOLBAR}>
          <SearchInput
            value={busqueda}
            onChange={setBusqueda}
            placeholder={
              usuarioId
                ? 'Buscar por dependencia o número…'
                : 'Buscar por dependencia, auditor o número…'
            }
          />
        </div>

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </p>
        )}

        {cargando ? (
          <Cargando mensaje="Cargando auditorías…" />
        ) : (
          <div className={TABLE_CONTAINER}>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Dependencia</TableHead>
                  <TableHead className="w-28">Auditoría</TableHead>
                  {/* Al auditor no le dice nada una columna con su propio
                      nombre repetido en cada fila. */}
                  {mostrarAuditor && <TableHead className="w-40">Auditor</TableHead>}
                  <TableHead className="w-28 text-center">Hallazgos</TableHead>
                  <TableHead className="w-44">Plan validado</TableHead>
                  {/* Ancha a propósito: los dos botones con texto tienen que
                      caber en una sola línea (ver la celda). */}
                  <TableHead className="w-80 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {filtradas.length === 0 ? (
                  <TableEmpty colSpan={columnas}>
                    {usuarioId
                      ? 'No tienes auditorías para este filtro.'
                      : 'No hay auditorías para este filtro.'}
                  </TableEmpty>
                ) : (
                  filtradas.map((a) => {
                    const hallazgos =
                      (a.oportunidades_mejora?.length || 0) + (a.no_conformidades?.length || 0)
                    const plan = a.plan

                    return (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">
                          {a.dependencias?.nombre || 'Sin dependencia'}
                        </TableCell>

                        <TableCell className="text-xs text-muted-foreground">
                          #{a.id}
                          <br />
                          {formatearDia(a.fecha_auditoria) || '—'}
                        </TableCell>

                        {mostrarAuditor && (
                          <TableCell className="text-xs text-muted-foreground">
                            {[a.usuarios?.nombre, a.usuarios?.apellido].filter(Boolean).join(' ') ||
                              '—'}
                          </TableCell>
                        )}

                        <TableCell className="text-center">
                          <Badge variant={hallazgos ? 'secondary' : 'outline'}>{hallazgos}</Badge>
                        </TableCell>

                        <TableCell className="text-xs">
                          {plan?.desconocido ? (
                            <span className="text-muted-foreground">No se pudo comprobar</span>
                          ) : plan?.url ? (
                            <span className="text-emerald-700 dark:text-emerald-400">
                              Cargado
                              {plan.subido_at ? ` el ${formatearDia(plan.subido_at)}` : ''}
                              {plan.formato ? ` · ${plan.formato}` : ''}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">Sin cargar</span>
                          )}
                        </TableCell>

                        <TableCell>
                          {/* Los dos pasos del plan —generar el formato y
                              guardarlo validado— van juntos y en ese orden,
                              que es el del trabajo. Antes «Ver» se colaba
                              entre ellos y empujaba el de subir al renglón de
                              abajo, así que la fila cambiaba de alto según si
                              el plan estaba cargado. Ahora «Ver» es un icono
                              al final y nada envuelve. */}
                          <div className="flex flex-nowrap items-center justify-end gap-2">
                            {/* El formato sale de los hallazgos: sin ellos no
                                hay plan que levantar. */}
                            <Button
                              size="sm"
                              variant="outline"
                              className="shrink-0"
                              onClick={() => setAGenerar(a)}
                              disabled={!hallazgos}
                              title={
                                hallazgos
                                  ? 'Generar el formato del Plan de Mejoramiento con los datos de esta auditoría'
                                  : 'Esta auditoría no tiene oportunidades de mejora ni no conformidades'
                              }
                            >
                              <Download />
                              Generar formato
                            </Button>

                            {!soloLectura && (
                              <Button
                                size="sm"
                                className="shrink-0"
                                onClick={() => setASubir(a)}
                                title={`Cargar el plan de mejora valorado en el último seguimiento${
                                  plan?.url ? ' (reemplaza el que ya está cargado)' : ''
                                }`}
                              >
                                <Upload />
                                {plan?.url ? 'Reemplazar' : 'Subir validado'}
                              </Button>
                            )}

                            {plan?.url && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="w-8 shrink-0 px-0"
                                onClick={() =>
                                  window.open(plan.url, '_blank', 'noopener,noreferrer')
                                }
                                title="Ver el plan cargado"
                                aria-label={`Ver el plan cargado de la auditoría #${a.id}`}
                              >
                                <ExternalLink />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}

        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <ClipboardCheck className="h-4 w-4 shrink-0" />
          El formato se genera con las oportunidades de mejora y las no conformidades registradas en
          el informe. El plan validado es el que devuelve la dependencia auditada con la valoración
          del último seguimiento, en {ETIQUETA_FORMATOS} (máx. {MAX_MB.PLAN_MEJORA} MB); se puede
          volver a cargar cuando haya un seguimiento nuevo.
        </p>
      </section>

      <ModalGenerarPlanMejora
        auditoria={aGenerar}
        onClose={() => setAGenerar(null)}
        onConfirmar={generarFormato}
        generando={generando}
      />

      <DocumentUploadModal
        isOpen={Boolean(aSubir)}
        onClose={() => setASubir(null)}
        /* Lo que se carga no es «un archivo»: es el plan tal como quedó
           valorado en el último seguimiento, y conviene decirlo aquí para que
           nadie suba el formato en blanco que acaba de generar. */
        title="Cargar plan de mejora — valorado último seguimiento"
        description={
          aSubir
            ? `Auditoría #${aSubir.id} · ${aSubir.dependencias?.nombre ?? ''}`
            : undefined
        }
        note={
          <>
            Sube el plan con la valoración del último seguimiento.{' '}
            <strong className="font-medium text-foreground">
              Se puede editar después de cargado:
            </strong>{' '}
            vuelve a entrar aquí y sube la versión nueva, que reemplaza la anterior.
          </>
        }
        currentFileUrl={aSubir?.plan?.url ?? null}
        viewCurrentLabel="Ver el plan cargado"
        acceptedTypes={ACCEPT_PLAN_MEJORA}
        acceptedLabel={ETIQUETA_FORMATOS}
        maxSizeMB={MAX_MB.PLAN_MEJORA}
        uploadButtonLabel="Subir plan"
        onUpload={subirPlan}
        isUploading={subiendo}
      />
    </div>
  )
}
