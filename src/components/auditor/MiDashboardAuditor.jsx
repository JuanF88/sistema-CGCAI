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
import { Sparkles, TrendingUp, ShieldCheck, CalendarRange, RefreshCw, Download } from 'lucide-react'
import styles from './miDashboardAuditor.module.css'

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
    <article className={styles.chartCard}>
      <div className={styles.cardHeaderChart}>
        <h3>{title}</h3>
        <button type="button" className={styles.downloadChartBtn} onClick={downloadPng} title="Descargar gráfica en PNG">
          <Download size={14} /> PNG
        </button>
      </div>
      <div ref={captureRef} className={styles.chartCaptureArea}>
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
        const res = await fetch(`/api/evaluaciones-auditores/auditor-dashboard?auditor_id=${encodeURIComponent(auditorId)}`)
        const data = await res.json()

        if (!res.ok) {
          throw new Error(data?.error || 'No fue posible cargar tu dashboard.')
        }

        setDashboard(data)
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
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroGlow} />
        <div className={styles.heroMain}>
          <div className={styles.profileWrap}>
            <div>
              <p className={styles.badge}><Sparkles size={14} /> Tu rendimiento</p>
              <h1 className={styles.title}>Hola, {dashboard?.auditor?.nombre || usuario?.nombre || 'Auditor'}</h1>
              <p className={styles.subtitle}>Este panel resume exclusivamente tus auditorias internas, con tendencia de notas y avance por periodo.</p>
            </div>
          </div>

          <button
            className={styles.refreshBtn}
            onClick={() => setReloadToken((value) => value + 1)}
            disabled={loading}
            type="button"
          >
            <RefreshCw size={16} /> {loading ? 'Actualizando...' : 'Actualizar panel'}
          </button>
        </div>

        <div className={styles.filterRow}>
          <label htmlFor="filtroAnio" className={styles.filterLabel}>Filtrar por año</label>
          <select
            id="filtroAnio"
            className={styles.filterSelect}
            value={anioFiltro}
            onChange={(e) => setAnioFiltro(e.target.value)}
            disabled={aniosDisponibles.length === 0}
          >
            <option value="todos">Todos los años</option>
            {aniosDisponibles.map((anio) => (
              <option key={anio} value={anio}>{anio}</option>
            ))}
          </select>
        </div>
      </section>

      {error && <div className={styles.errorBox}>{error}</div>}
      {loading && <div className={styles.loadingBox}>Cargando tu dashboard...</div>}

      {!loading && !error && dashboard && (
        <>
          <section className={styles.kpiGrid}>
            <article className={styles.kpiCard}>
              <div className={styles.kpiIcon}><ShieldCheck size={18} /></div>
              <p className={styles.kpiLabel}>Auditorias totales</p>
              <strong className={styles.kpiValue}>{metricas.total}</strong>
            </article>

            <article className={styles.kpiCard}>
              <div className={styles.kpiIcon}><TrendingUp size={18} /></div>
              <p className={styles.kpiLabel}>Promedio final</p>
              <strong className={styles.kpiValue}>{formatNote(metricas.promedio)}</strong>
            </article>

            <article className={styles.kpiCard}>
              <div className={styles.kpiIcon}><Sparkles size={18} /></div>
              <p className={styles.kpiLabel}>Mejor nota</p>
              <strong className={styles.kpiValue}>{formatNote(metricas.mejorNota)}</strong>
              <small className={styles.kpiHint}>{metricas.mejorDependencia}</small>
            </article>

            <article className={styles.kpiCard}>
              <div className={styles.kpiIcon}><CalendarRange size={18} /></div>
              <p className={styles.kpiLabel}>Evaluaciones completas</p>
              <strong className={styles.kpiValue}>{metricas.completas}</strong>
            </article>
          </section>

          <section className={styles.chartsGrid}>
            <ExportableChartCard title="Notas promedio por año" downloadName="notas-promedio-por-anio">
              {(TooltipContent) => (
                <div className={styles.chartWrap}>
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
                  <div className={styles.chartWrap}>
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

          <section className={styles.tableCard}>
            <h3>Detalle de tus auditorias</h3>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Periodo</th>
                    <th>Dependencia</th>
                    <th>Archivos</th>
                    <th>Encuesta</th>
                    <th>Rubrica</th>
                    <th>Final</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {auditoriasFiltradas.length === 0 ? (
                    <tr>
                      <td colSpan={7} className={styles.emptyRow}>No tienes auditorias en el filtro actual.</td>
                    </tr>
                  ) : (
                    auditoriasFiltradas.map((item) => (
                      <tr key={item.informe_id}>
                        <td>{item.periodo || '—'}</td>
                        <td>{item.dependencia_nombre}</td>
                        <td>{formatNote(item.nota_archivos)}</td>
                        <td>{formatNote(item.nota_encuesta)}</td>
                        <td>{formatNote(item.nota_rubrica)}</td>
                        <td className={styles.finalNote}>{formatNote(item.nota_final)}</td>
                        <td><span className={styles.status}>{item.estado_evaluacion || 'sin_evaluacion'}</span></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
