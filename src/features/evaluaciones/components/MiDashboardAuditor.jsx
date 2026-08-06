'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LabelList,
} from 'recharts'
import html2canvas from 'html2canvas'
import { RefreshCw, Download } from 'lucide-react'
import { obtenerDashboardAuditor } from '@/features/evaluaciones/api/evaluaciones-api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/ui/page-header'
import { InfoCard } from '@/components/ui/info-card'
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
import {
  PAGE_SHELL,
  SECTION_CARD,
  STATUS_BADGE_TONES,
  TABLE_CONTAINER,
  TABLE_TOOLBAR,
} from '@/components/ui/tokens'
import { cn } from '@/lib/utils'
import { useAnioInicial } from '@/hooks/useAnioInicial'
import { Cargando } from '@/components/ui/loader'

const formatNote = (value) => (typeof value === 'number' ? value.toFixed(2) : '—')

function ExportableChartCard({ title, downloadName, children }) {
  const captureRef = useRef(null)

  const downloadPng = async () => {
    if (!captureRef.current) return
    try {
      const canvas = await html2canvas(captureRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
        useCORS: true,
      })
      const url = canvas.toDataURL('image/png')
      const link = document.createElement('a')
      link.download = `${downloadName}_${new Date().toISOString().split('T')[0]}.png`
      link.href = url
      link.click()
    } catch (error) {
      console.error('Error al descargar gráfica:', error)
    }
  }

  const TooltipContent = () => null

  return (
    <article className={cn(SECTION_CARD, 'p-4')}>
      <header className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <Button variant="outline" size="sm" onClick={downloadPng} title="Descargar gráfica en PNG">
          <Download />
          PNG
        </Button>
      </header>
      <div ref={captureRef} className="bg-card">
        {children(TooltipContent)}
      </div>
    </article>
  )
}

export default function MiDashboardAuditor({ usuario }) {
  const [dashboard, setDashboard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadToken, setReloadToken] = useState(0)
  const [anioFiltro, setAnioFiltro] = useState('todos')

  const auditorId = useMemo(() => {
    return usuario?.auth_user_id || usuario?.id || usuario?.usuario_id || ''
  }, [usuario])

  useEffect(() => {
    const loadDashboard = async () => {
      if (!auditorId) {
        setError('No se encontró el identificador del auditor logueado.')
        setLoading(false)
        return
      }

      setLoading(true)
      setError('')

      try {
        setDashboard(await obtenerDashboardAuditor(auditorId))
      } catch (err) {
        console.error('Error cargando dashboard del auditor:', err)
        setError(err.message || 'No fue posible cargar tu dashboard.')
        setDashboard(null)
      } finally {
        setLoading(false)
      }
    }

    loadDashboard()
  }, [auditorId, reloadToken])

  const aniosDisponibles = useMemo(() => {
    return (dashboard?.resumenPorAnio || []).map((item) => String(item.anio))
  }, [dashboard])

  useAnioInicial(aniosDisponibles, (anio) => setAnioFiltro(String(anio)))

  useEffect(() => {
    if (anioFiltro !== 'todos' && !aniosDisponibles.includes(anioFiltro)) {
      setAnioFiltro('todos')
    }
  }, [anioFiltro, aniosDisponibles])

  const auditoriasFiltradas = useMemo(() => {
    const auditorias = dashboard?.auditorias || []
    if (anioFiltro === 'todos') return auditorias
    return auditorias.filter((item) => String(item.anio) === String(anioFiltro))
  }, [dashboard, anioFiltro])

  const metricas = useMemo(() => {
    const total = auditoriasFiltradas.length
    const notasFinales = auditoriasFiltradas.filter((item) => typeof item.nota_final === 'number')
    const promedio = notasFinales.length
      ? Number((notasFinales.reduce((acc, item) => acc + item.nota_final, 0) / notasFinales.length).toFixed(2))
      : null
    const mejor = notasFinales.length
      ? notasFinales.reduce((best, current) => (current.nota_final > best.nota_final ? current : best))
      : null
    const completas = auditoriasFiltradas.filter((item) => item.estado_evaluacion === 'completa' || item.estado_evaluacion === 'publicada').length

    return {
      total,
      promedio,
      mejorNota: mejor?.nota_final ?? null,
      mejorDependencia: mejor?.dependencia_nombre || '—',
      completas,
    }
  }, [auditoriasFiltradas])

  const notasPorAnio = useMemo(() => {
    return (dashboard?.resumenPorAnio || []).map((item) => ({
      anio: String(item.anio),
      final: item.nota_final_promedio,
      archivos: item.nota_archivos_promedio,
      encuesta: item.nota_encuesta_promedio,
      rubrica: item.nota_rubrica_promedio,
    }))
  }, [dashboard])

  const evolucion = useMemo(() => {
    return [...auditoriasFiltradas]
      .sort((a, b) => new Date(a.fecha_auditoria || 0) - new Date(b.fecha_auditoria || 0))
      .map((item) => ({
        nombre_auditoria: item.dependencia_nombre || `Auditoria ${item.informe_id}`,
        nota_final: item.nota_final,
      }))
  }, [auditoriasFiltradas])

  return (
    <div className={PAGE_SHELL}>
      <PageHeader
        title={`Hola, ${dashboard?.auditor?.nombre || usuario?.nombre || 'Auditor'}`}
        subtitle="Este panel resume exclusivamente tus auditorías internas, con tendencia de notas y avance por periodo."
        actions={
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="filtroAnio" className="text-xs text-white/80">
                Filtrar por año
              </Label>
              <Select
                value={anioFiltro}
                onValueChange={setAnioFiltro}
                disabled={aniosDisponibles.length === 0}
              >
                <SelectTrigger id="filtroAnio" className="w-40 border-white/25 bg-white/15 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los años</SelectItem>
                  {aniosDisponibles.map((anio) => (
                    <SelectItem key={anio} value={anio}>
                      {anio}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={() => setReloadToken((value) => value + 1)}
              disabled={loading}
              className="bg-white/15 text-white shadow-none backdrop-blur-sm hover:bg-white/25"
            >
              <RefreshCw className={loading ? 'animate-spin' : undefined} />
              {loading ? 'Actualizando…' : 'Actualizar panel'}
            </Button>
          </div>
        }
      />

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
      {loading && (
        <div className="rounded-lg border border-border bg-card">
          <Cargando mensaje="Cargando tu dashboard…" />
        </div>
      )}

      {!loading && !error && dashboard && (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <InfoCard
              tone="blue"
              label="Auditorías totales"
              value={metricas.total}
            />
            <InfoCard
              tone="green"
              label="Promedio final"
              value={formatNote(metricas.promedio)}
            />
            <InfoCard
              tone="purple"
              label={`Mejor nota · ${metricas.mejorDependencia}`}
              value={formatNote(metricas.mejorNota)}
            />
            <InfoCard
              tone="cyan"
              label="Evaluaciones completas"
              value={metricas.completas}
            />
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <ExportableChartCard title="Notas promedio por año" downloadName="notas-promedio-por-anio">
              {(TooltipContent) => (
                <div className="h-[320px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={notasPorAnio}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="anio" />
                      <YAxis domain={[0, 5]} />
                      <Tooltip content={<TooltipContent />} />
                      <Line type="monotone" dataKey="final" stroke="#1d4ed8" strokeWidth={2.8}>
                        <LabelList dataKey="final" position="top" formatter={formatNote} />
                      </Line>
                      <Line type="monotone" dataKey="archivos" stroke="#2563eb" strokeWidth={1.8} />
                      <Line type="monotone" dataKey="encuesta" stroke="#3b82f6" strokeWidth={1.8} />
                      <Line type="monotone" dataKey="rubrica" stroke="#60a5fa" strokeWidth={1.8} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </ExportableChartCard>

            <ExportableChartCard title="Evolución de nota final" downloadName="evolucion-nota-final">
              {(TooltipContent) => {
                return (
                  <div className="h-[320px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={evolucion}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="nombre_auditoria"
                          interval={0}
                          angle={-20}
                          textAnchor="end"
                          height={70}
                          tick={{ fontSize: 11 }}
                        />
                        <YAxis domain={[0, 5]} />
                        <Tooltip content={<TooltipContent />} />
                        <Bar dataKey="nota_final" fill="#2563eb" radius={[8, 8, 0, 0]}>
                          <LabelList dataKey="nota_final" position="top" formatter={formatNote} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )
              }}
            </ExportableChartCard>
          </section>

          <section className={TABLE_CONTAINER}>
            <div className={TABLE_TOOLBAR}>
              <h3 className="text-sm font-semibold">Detalle de tus auditorías</h3>
            </div>

            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Periodo</TableHead>
                  <TableHead>Dependencia</TableHead>
                  <TableHead className="text-right">Archivos</TableHead>
                  <TableHead className="text-right">Encuesta</TableHead>
                  <TableHead className="text-right">Rúbrica</TableHead>
                  <TableHead className="text-right">Final</TableHead>
                  <TableHead className="w-36">Estado</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {auditoriasFiltradas.length === 0 ? (
                  <TableEmpty colSpan={7}>No tienes auditorías en el filtro actual.</TableEmpty>
                ) : (
                  auditoriasFiltradas.map((item) => {
                    const completa =
                      item.estado_evaluacion === 'completa' || item.estado_evaluacion === 'publicada'

                    return (
                      <TableRow key={item.informe_id}>
                        <TableCell>{item.periodo || '—'}</TableCell>
                        <TableCell className="font-medium">{item.dependencia_nombre}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatNote(item.nota_archivos)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatNote(item.nota_encuesta)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatNote(item.nota_rubrica)}
                        </TableCell>
                        <TableCell className="text-right font-bold tabular-nums text-primary">
                          {formatNote(item.nota_final)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(STATUS_BADGE_TONES[completa ? 'success' : 'neutral'])}
                          >
                            {item.estado_evaluacion || 'sin_evaluacion'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </section>
        </>
      )}
    </div>
  )
}
