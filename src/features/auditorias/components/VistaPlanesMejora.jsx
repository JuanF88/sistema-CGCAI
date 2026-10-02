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
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ClipboardCheck, Download, ExternalLink, RefreshCw, Upload } from 'lucide-react'
import { toast } from 'react-toastify'

import { supabase } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import DocumentUploadModal from '@/components/ui/DocumentUploadModal'
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
  BUCKETS,
  MAX_MB,
  buildPlanMejoraPath,
} from '@/features/auditorias/hooks/useAuditTimeline'
import {
  avisoDeFallidos,
  buscarDocumento,
  firmarDocumentos,
  leerBuckets,
} from '@/features/auditorias/lib/indice-archivos'

const SELECT = `
  id, fecha_auditoria, validado, dependencia_id,
  dependencias:dependencia_id ( nombre ),
  usuarios:usuario_id ( nombre, apellido ),
  oportunidades_mejora ( id ),
  no_conformidades ( id )
`

export default function VistaPlanesMejora({ soloLectura = false }) {
  const [auditorias, setAuditorias] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [anio, setAnio] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [aSubir, setASubir] = useState(null)
  const [subiendo, setSubiendo] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const { data, error: errorConsulta } = await supabase
        .from('informes_auditoria')
        .select(SELECT)
        .order('fecha_auditoria', { ascending: false })

      if (errorConsulta) throw errorConsulta
      const filas = data ?? []

      // Una lectura del bucket para toda la pantalla y una firma por lote,
      // como en el resto del sistema (ver `lib/indice-archivos`).
      const { indice, fallidos } = await leerBuckets([BUCKETS.PLANES_MEJORA])
      if (fallidos.length) toast.warning(avisoDeFallidos(fallidos))

      const hallazgos = filas.map((a) =>
        buscarDocumento(indice, BUCKETS.PLANES_MEJORA, buildPlanMejoraPath(a))
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
  }, [])

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

  const subirPlan = async (archivo) => {
    if (!archivo || !aSubir) return

    setSubiendo(true)
    try {
      const path = buildPlanMejoraPath(aSubir)

      const { error: errorSubida } = await supabase.storage
        .from(BUCKETS.PLANES_MEJORA)
        .upload(path, archivo, { upsert: true, contentType: 'application/pdf' })

      if (errorSubida) throw errorSubida

      toast.success('Plan de mejoramiento cargado.')
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
        subtitle="Genera el formato a partir de los hallazgos y guarda el plan ya validado"
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
        <InfoCard tone="blue" label="Auditorías" value={resumen.auditorias} />
        <InfoCard tone="purple" label="Con hallazgos" value={resumen.conHallazgos} />
        <InfoCard tone="green" label="Planes cargados" value={resumen.cargados} />
        <InfoCard tone="orange" label="Por cargar" value={resumen.pendientes} />
      </section>

      <section className={cn(SECTION_CARD, 'flex flex-col gap-4 p-4')}>
        <div className={TABLE_TOOLBAR}>
          <SearchInput
            value={busqueda}
            onChange={setBusqueda}
            placeholder="Buscar por dependencia, auditor o número…"
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
                  <TableHead className="w-40">Auditor</TableHead>
                  <TableHead className="w-28 text-center">Hallazgos</TableHead>
                  <TableHead className="w-44">Plan validado</TableHead>
                  <TableHead className="w-64 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {filtradas.length === 0 ? (
                  <TableEmpty colSpan={6}>No hay auditorías para este filtro.</TableEmpty>
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

                        <TableCell className="text-xs text-muted-foreground">
                          {[a.usuarios?.nombre, a.usuarios?.apellido].filter(Boolean).join(' ') ||
                            '—'}
                        </TableCell>

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
                            </span>
                          ) : (
                            <span className="text-muted-foreground">Sin cargar</span>
                          )}
                        </TableCell>

                        <TableCell>
                          <div className="flex flex-wrap justify-end gap-2">
                            {/* El formato sale de los hallazgos: sin ellos no
                                hay plan que levantar. */}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => descargarPlanMejora(a)}
                              disabled={!hallazgos}
                              title={
                                hallazgos
                                  ? 'Generar el formato del Plan de Mejoramiento'
                                  : 'Esta auditoría no tiene oportunidades de mejora ni no conformidades'
                              }
                            >
                              <Download />
                              Generar formato
                            </Button>

                            {plan?.url && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  window.open(plan.url, '_blank', 'noopener,noreferrer')
                                }
                              >
                                <ExternalLink />
                                Ver
                              </Button>
                            )}

                            {!soloLectura && (
                              <Button size="sm" onClick={() => setASubir(a)}>
                                <Upload />
                                {plan?.url ? 'Reemplazar' : 'Subir validado'}
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
          el informe. El plan validado es el que devuelve firmado la dependencia auditada.
        </p>
      </section>

      <DocumentUploadModal
        isOpen={Boolean(aSubir)}
        onClose={() => setASubir(null)}
        title="Subir plan de mejoramiento validado"
        description={
          aSubir
            ? `Auditoría #${aSubir.id} · ${aSubir.dependencias?.nombre ?? ''}`
            : undefined
        }
        currentFileUrl={aSubir?.plan?.url ?? null}
        viewCurrentLabel="Ver el plan cargado"
        maxSizeMB={MAX_MB.PLAN_MEJORA}
        uploadButtonLabel="Subir plan"
        onUpload={subirPlan}
        isUploading={subiendo}
      />
    </div>
  )
}
