'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
  LabelList,
} from 'recharts'
import html2canvas from 'html2canvas'
import {
  Search,
  UserRound,
  Mail,
  Phone,
  GraduationCap,
  Building2,
  BriefcaseBusiness,
  Award,
  Calendar,
  FileText,
  BarChart3,
  Download,
} from 'lucide-react'
import styles from './CSS/VistaDashboardAuditores.module.css'

const formatNote = (value) => (typeof value === 'number' ? value.toFixed(2) : '—')

function ExportableChartCard({ title, className = '', downloadName, children }) {
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
    <article className={`${styles.chartCardSmall} ${className}`}>
      <div className={styles.cardHeaderSmall}>
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

const DEFAULT_AVATAR = '/avatares/Silueta.png'

const sanitizePrefix = (s = '') => {
  return String(s).trim().toLowerCase().replace(/[^a-z0-9._-]/g, '')
}

const getAvatarSrc = (email = '') => {
  const prefix = sanitizePrefix(email?.split('@')?.[0] || '')
  if (!prefix) return DEFAULT_AVATAR
  return `/avatares/${prefix}.png`
}

export default function VistaDashboardAuditores() {
  const [modoVista, setModoVista] = useState('general')
  const [auditores, setAuditores] = useState([])
  const [search, setSearch] = useState('')
  const [selectedAuditorId, setSelectedAuditorId] = useState('')
  const [dashboard, setDashboard] = useState(null)
  const [anioFiltro, setAnioFiltro] = useState('todos')
  const [aniosGenerales, setAniosGenerales] = useState([])
  const [anioGeneral, setAnioGeneral] = useState(String(new Date().getFullYear()))
  const [resumenGeneral, setResumenGeneral] = useState(null)
  const [loadingAuditores, setLoadingAuditores] = useState(true)
  const [loadingDashboard, setLoadingDashboard] = useState(false)
  const [loadingGeneral, setLoadingGeneral] = useState(false)
  const [error, setError] = useState('')
  const [avatarSrc, setAvatarSrc] = useState(DEFAULT_AVATAR)

  useEffect(() => {
    const loadAuditores = async () => {
      setLoadingAuditores(true)
      setError('')
      try {
        const res = await fetch('/api/usuarios?rol=auditor')
        const data = await res.json()

        if (!res.ok) {
          throw new Error(data?.error || 'No se pudieron cargar los auditores')
        }

        const auditoresActivos = (Array.isArray(data) ? data : [])
          .filter((auditor) => auditor?.auth_user_id)
          .sort((a, b) => `${a.nombre || ''} ${a.apellido || ''}`.localeCompare(`${b.nombre || ''} ${b.apellido || ''}`))

        setAuditores(auditoresActivos)
        setSelectedAuditorId((prev) => prev || auditoresActivos[0]?.auth_user_id || '')
      } catch (err) {
        console.error('Error cargando auditores:', err)
        setError(err.message || 'Error cargando auditores')
      } finally {
        setLoadingAuditores(false)
      }
    }

    loadAuditores()
  }, [])

  useEffect(() => {
    const loadAniosDisponibles = async () => {
      try {
        const res = await fetch('/api/evaluaciones-auditores/periodos-disponibles')
        const data = await res.json()

        if (!res.ok) {
          throw new Error(data?.error || 'No se pudieron cargar los años disponibles')
        }

        const anios = Array.isArray(data?.anios) ? data.anios.map((item) => String(item)) : []
        setAniosGenerales(anios)
        if (anios.length) {
          setAnioGeneral((prev) => (anios.includes(prev) ? prev : anios[0]))
        }
      } catch {
        setAniosGenerales([])
      }
    }

    loadAniosDisponibles()
  }, [])

  useEffect(() => {
    if (!anioGeneral) {
      setResumenGeneral(null)
      return
    }

    const loadGeneral = async () => {
      setLoadingGeneral(true)
      setError('')
      try {
        const res = await fetch(`/api/evaluaciones-auditores?anio=${encodeURIComponent(anioGeneral)}`)
        const data = await res.json()

        if (!res.ok) {
          throw new Error(data?.error || 'No se pudo cargar el consolidado general')
        }

        const evaluaciones = Array.isArray(data?.evaluaciones) ? data.evaluaciones : []
        const porAuditorMap = new Map()
        const estados = { completa: 0, borrador: 0, sin_evaluacion: 0 }
        const acumulados = {
          archivos: { suma: 0, cantidad: 0 },
          encuesta: { suma: 0, cantidad: 0 },
          rubrica: { suma: 0, cantidad: 0 },
          final: { suma: 0, cantidad: 0 },
        }

        evaluaciones.forEach((item) => {
          const auditorKey = String(item.auditor_id || item.auditor_email || 'sin-auditor')
          const auditorNombre = `${item.auditor_nombre || ''} ${item.auditor_apellido || ''}`.trim() || 'Sin nombre'

          if (!porAuditorMap.has(auditorKey)) {
            porAuditorMap.set(auditorKey, {
              auditor_id: auditorKey,
              nombre: auditorNombre,
              email: item.auditor_email || 'Sin correo',
              total: 0,
              sumaFinal: 0,
              notasFinales: 0,
              mejorNota: null,
            })
          }

          const auditor = porAuditorMap.get(auditorKey)
          auditor.total += 1

          if (typeof item.nota_final === 'number') {
            auditor.sumaFinal += item.nota_final
            auditor.notasFinales += 1
            auditor.mejorNota = auditor.mejorNota == null ? item.nota_final : Math.max(auditor.mejorNota, item.nota_final)

            acumulados.final.suma += item.nota_final
            acumulados.final.cantidad += 1
          }

          if (typeof item.nota_archivos === 'number') {
            acumulados.archivos.suma += item.nota_archivos
            acumulados.archivos.cantidad += 1
          }

          if (typeof item.nota_encuesta === 'number') {
            acumulados.encuesta.suma += item.nota_encuesta
            acumulados.encuesta.cantidad += 1
          }

          if (typeof item.nota_rubrica === 'number') {
            acumulados.rubrica.suma += item.nota_rubrica
            acumulados.rubrica.cantidad += 1
          }

          const estado = item.estado || 'sin_evaluacion'
          if (estado === 'completa' || estado === 'borrador') {
            estados[estado] += 1
          } else {
            estados.sin_evaluacion += 1
          }
        })

        const rankingAuditores = Array.from(porAuditorMap.values())
          .map((item) => ({
            ...item,
            promedioFinal: item.notasFinales
              ? Number((item.sumaFinal / item.notasFinales).toFixed(2))
              : null,
          }))
          .sort((a, b) => {
            const promedioA = typeof a.promedioFinal === 'number' ? a.promedioFinal : -1
            const promedioB = typeof b.promedioFinal === 'number' ? b.promedioFinal : -1
            if (promedioB !== promedioA) return promedioB - promedioA
            return b.total - a.total
          })

        const notasFinales = evaluaciones.filter((item) => typeof item.nota_final === 'number')
        const promedioGeneral = notasFinales.length
          ? Number((notasFinales.reduce((acc, item) => acc + item.nota_final, 0) / notasFinales.length).toFixed(2))
          : null

        const promediosGlobales = {
          archivos: acumulados.archivos.cantidad
            ? Number((acumulados.archivos.suma / acumulados.archivos.cantidad).toFixed(2))
            : null,
          encuesta: acumulados.encuesta.cantidad
            ? Number((acumulados.encuesta.suma / acumulados.encuesta.cantidad).toFixed(2))
            : null,
          rubrica: acumulados.rubrica.cantidad
            ? Number((acumulados.rubrica.suma / acumulados.rubrica.cantidad).toFixed(2))
            : null,
          final: acumulados.final.cantidad
            ? Number((acumulados.final.suma / acumulados.final.cantidad).toFixed(2))
            : null,
        }

        setResumenGeneral({
          anio: anioGeneral,
          totalAuditorias: evaluaciones.length,
          auditoresEvaluados: rankingAuditores.length,
          promedioGeneral,
          promediosGlobales,
          totalCompletas: estados.completa,
          totalBorrador: estados.borrador,
          totalSinEvaluacion: estados.sin_evaluacion,
          rankingAuditores,
        })
      } catch (err) {
        setError(err.message || 'No se pudo cargar el consolidado general')
        setResumenGeneral(null)
      } finally {
        setLoadingGeneral(false)
      }
    }

    loadGeneral()
  }, [anioGeneral])

  useEffect(() => {
    if (modoVista !== 'auditor') return
    if (!selectedAuditorId) {
      setDashboard(null)
      return
    }

    const loadDashboard = async () => {
      setLoadingDashboard(true)
      setError('')
      try {
        const res = await fetch(`/api/evaluaciones-auditores/auditor-dashboard?auditor_id=${encodeURIComponent(selectedAuditorId)}`)
        const data = await res.json()

        if (!res.ok) {
          throw new Error(data?.error || 'No se pudo cargar el dashboard del auditor')
        }

        setDashboard(data)
      } catch (err) {
        console.error('Error cargando dashboard del auditor:', err)
        setError(err.message || 'No se pudo cargar el dashboard del auditor')
        setDashboard(null)
      } finally {
        setLoadingDashboard(false)
      }
    }

    loadDashboard()
  }, [selectedAuditorId, modoVista])

  const filteredAuditores = useMemo(() => {
    const term = (search || '').trim().toLowerCase()
    if (!term) return auditores

    return auditores.filter((auditor) => {
      const haystack = [
        auditor.nombre,
        auditor.apellido,
        auditor.email,
        auditor.tipo_personal,
        auditor.tipo_estudio,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return haystack.includes(term)
    })
  }, [auditores, search])

  const aniosDisponibles = useMemo(() => {
    return (dashboard?.resumenPorAnio || []).map((item) => String(item.anio))
  }, [dashboard])

  useEffect(() => {
    if (!filteredAuditores.length) return
    if (!filteredAuditores.some((auditor) => auditor.auth_user_id === selectedAuditorId)) {
      setSelectedAuditorId(filteredAuditores[0].auth_user_id)
    }
  }, [filteredAuditores, selectedAuditorId])

  useEffect(() => {
    if (anioFiltro !== 'todos' && !aniosDisponibles.includes(anioFiltro)) {
      setAnioFiltro('todos')
    }
  }, [anioFiltro, aniosDisponibles])

  // Actualizar avatar cuando cambia el dashboard
  useEffect(() => {
    if (dashboard?.auditor?.email) {
      setAvatarSrc(getAvatarSrc(dashboard.auditor.email))
    } else {
      setAvatarSrc(DEFAULT_AVATAR)
    }
  }, [dashboard?.auditor?.email])

  const auditoriasFiltradas = useMemo(() => {
    const auditorias = dashboard?.auditorias || []
    if (anioFiltro === 'todos') return auditorias
    return auditorias.filter((item) => String(item.anio) === String(anioFiltro))
  }, [dashboard, anioFiltro])

  const metricasFiltradas = useMemo(() => {
    const total = auditoriasFiltradas.length
    const notasFinales = auditoriasFiltradas.filter((item) => typeof item.nota_final === 'number')
    const promedioFinal = notasFinales.length
      ? Number((notasFinales.reduce((acc, item) => acc + item.nota_final, 0) / notasFinales.length).toFixed(2))
      : null
    const mejor = notasFinales.length
      ? notasFinales.reduce((best, current) => current.nota_final > best.nota_final ? current : best)
      : null

    return {
      total,
      promedioFinal,
      mejorNota: mejor?.nota_final ?? null,
      mejorInforme: mejor?.informe_id ?? null,
    }
  }, [auditoriasFiltradas])

  const chartAuditoriasPorAnio = useMemo(() => {
    return (dashboard?.resumenPorAnio || []).map((item) => ({
      anio: String(item.anio),
      auditorias: item.auditorias,
    }))
  }, [dashboard])

  const chartNotasPorAnio = useMemo(() => {
    return (dashboard?.resumenPorAnio || []).map((item) => ({
      anio: String(item.anio),
      final: item.nota_final_promedio,
      archivos: item.nota_archivos_promedio,
      encuesta: item.nota_encuesta_promedio,
      rubrica: item.nota_rubrica_promedio,
    }))
  }, [dashboard])

  const chartNotasPorAuditoria = useMemo(() => {
    return [...auditoriasFiltradas]
      .sort((a, b) => new Date(a.fecha_auditoria || 0) - new Date(b.fecha_auditoria || 0))
      .map((item) => ({
        informe: `#${item.informe_id}`,
        nota_final: item.nota_final,
        dependencia: item.dependencia_nombre,
      }))
  }, [auditoriasFiltradas])

  const chartGeneralAuditorias = useMemo(() => {
    const base = resumenGeneral?.rankingAuditores || []
    return [...base]
      .sort((a, b) => {
        if (b.total !== a.total) return b.total - a.total
        const promedioA = typeof a.promedioFinal === 'number' ? a.promedioFinal : -1
        const promedioB = typeof b.promedioFinal === 'number' ? b.promedioFinal : -1
        return promedioB - promedioA
      })
      .slice(0, 8)
      .map((item) => ({
        auditor: item.nombre,
        auditorias: item.total,
        promedio: item.promedioFinal,
      }))
  }, [resumenGeneral])

  const chartGeneralPromedios = useMemo(() => {
    const base = resumenGeneral?.rankingAuditores || []
    return base
      .filter((item) => typeof item.promedioFinal === 'number')
      .slice(0, 8)
      .map((item) => ({
        auditor: item.nombre,
        promedio: item.promedioFinal,
      }))
  }, [resumenGeneral])

  const chartGeneralEstados = useMemo(() => {
    if (!resumenGeneral) return []
    return [
      { estado: 'Completas', total: resumenGeneral.totalCompletas },
      { estado: 'Borrador', total: resumenGeneral.totalBorrador },
      { estado: 'Sin evaluación', total: resumenGeneral.totalSinEvaluacion },
    ]
  }, [resumenGeneral])

  const chartPromediosEquipo = useMemo(() => {
    if (!resumenGeneral?.promediosGlobales) return []

    return [
      { criterio: 'Archivos', promedio: resumenGeneral.promediosGlobales.archivos },
      { criterio: 'Encuesta', promedio: resumenGeneral.promediosGlobales.encuesta },
      { criterio: 'Rúbrica', promedio: resumenGeneral.promediosGlobales.rubrica },
      { criterio: 'Final', promedio: resumenGeneral.promediosGlobales.final },
    ]
  }, [resumenGeneral])

  const CustomTooltipEvolucion = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className={styles.customTooltip}>
          <p className={styles.tooltipLabel}>{data.informe}</p>
          <p className={styles.tooltipDependencia}>{data.dependencia}</p>
          <p className={styles.tooltipNota}>Nota: {formatNote(data.nota_final)}</p>
        </div>
      )
    }
    return null
  }

  return (
    <div className={styles.container}>
      {/* Header alineado con otras secciones */}
      <div className={styles.modernHeader}>
        <div className={styles.headerContent}>
          <div className={styles.headerLeft}>
            <div className={styles.headerIcon}>🎛️</div>
            <div className={styles.headerInfo}>
              <h1 className={styles.headerTitle}>Dashboard de Auditores</h1>
              <p className={styles.headerSubtitle}>Historial completo, evaluaciones y métricas de desempeño</p>
            </div>
          </div>

          <div className={styles.headerRight}>
            <div className={styles.viewToggle}>
              <button
                type="button"
                className={`${styles.viewBtn} ${modoVista === 'general' ? styles.viewBtnActive : ''}`}
                onClick={() => setModoVista('general')}
              >
                Consolidado general
              </button>
              <button
                type="button"
                className={`${styles.viewBtn} ${modoVista === 'auditor' ? styles.viewBtnActive : ''}`}
                onClick={() => setModoVista('auditor')}
              >
                Por auditor
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Filtros compactos */}
      <div className={styles.filtersBar}>
        {modoVista === 'general' ? (
          <>
            <select
              className={styles.selectCompact}
              value={anioGeneral}
              onChange={(e) => setAnioGeneral(e.target.value)}
              disabled={aniosGenerales.length === 0 || loadingGeneral}
            >
              {aniosGenerales.length === 0 ? (
                <option value={anioGeneral}>Sin años disponibles</option>
              ) : (
                aniosGenerales.map((anio) => (
                  <option key={anio} value={anio}>{anio}</option>
                ))
              )}
            </select>
          </>
        ) : (
          <>
            <div className={styles.searchBox}>
              <Search size={16} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar auditor..."
              />
            </div>

            <select
              className={styles.selectCompact}
              value={selectedAuditorId}
              onChange={(e) => setSelectedAuditorId(e.target.value)}
              disabled={loadingAuditores || filteredAuditores.length === 0}
            >
              {filteredAuditores.length === 0 ? (
                <option value="">No hay auditores</option>
              ) : (
                filteredAuditores.map((auditor) => (
                  <option key={auditor.auth_user_id} value={auditor.auth_user_id}>
                    {`${auditor.nombre || ''} ${auditor.apellido || ''}`.trim()} {auditor.email ? `· ${auditor.email}` : ''}
                  </option>
                ))
              )}
            </select>

            <select
              className={styles.selectCompact}
              value={anioFiltro}
              onChange={(e) => setAnioFiltro(e.target.value)}
              disabled={!dashboard || aniosDisponibles.length === 0}
            >
              <option value="todos">Todos los años</option>
              {aniosDisponibles.map((anio) => (
                <option key={anio} value={anio}>{anio}</option>
              ))}
            </select>
          </>
        )}
      </div>

      {error && <div className={styles.errorBox}>{error}</div>}

      {(modoVista === 'auditor' && (loadingAuditores || loadingDashboard)) && (
        <div className={styles.loadingBox}>Cargando dashboard por auditor...</div>
      )}

      {(modoVista === 'general' && loadingGeneral) && (
        <div className={styles.loadingBox}>Cargando análisis general...</div>
      )}

      {modoVista === 'general' && !loadingGeneral && resumenGeneral && (
        <>
          <div className={styles.kpiRowCompact}>
            <article className={styles.kpiCardSmall}>
              <span className={styles.kpiLabelSmall}>Año</span>
              <strong className={styles.kpiValueSmall}>{resumenGeneral.anio}</strong>
            </article>
            <article className={styles.kpiCardSmall}>
              <span className={styles.kpiLabelSmall}>Auditorías</span>
              <strong className={styles.kpiValueSmall}>{resumenGeneral.totalAuditorias}</strong>
            </article>
            <article className={styles.kpiCardSmall}>
              <span className={styles.kpiLabelSmall}>Auditores</span>
              <strong className={styles.kpiValueSmall}>{resumenGeneral.auditoresEvaluados}</strong>
            </article>
            <article className={styles.kpiCardSmall}>
              <span className={styles.kpiLabelSmall}>Promedio General</span>
              <strong className={styles.kpiValueSmall}>{formatNote(resumenGeneral.promedioGeneral)}</strong>
            </article>
          </div>

          <div className={styles.chartsRowCompact}>
            <ExportableChartCard title="Auditorías por auditor (ordenado por cantidad)" downloadName="auditorias-por-auditor">
              {(TooltipContent) => (
                <div className={styles.chartWrapSmall}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartGeneralAuditorias}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="auditor" hide />
                      <YAxis width={35} allowDecimals={false} />
                      <Tooltip content={<TooltipContent />} />
                      <Bar dataKey="auditorias" fill="#6387d6" radius={[6, 6, 0, 0]}>
                        <LabelList dataKey="auditorias" position="top" />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </ExportableChartCard>

            <ExportableChartCard title="Promedio por auditor" downloadName="promedio-por-auditor">
              {(TooltipContent) => (
                <div className={styles.chartWrapSmall}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartGeneralPromedios}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="auditor" hide />
                      <YAxis width={35} domain={[0, 5]} />
                      <Tooltip content={<TooltipContent />} />
                      <Bar dataKey="promedio" fill="rgb(110, 191, 206)" radius={[6, 6, 0, 0]}>
                        <LabelList dataKey="promedio" position="top" formatter={formatNote} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </ExportableChartCard>

            <ExportableChartCard title="Promedio del equipo por criterio" downloadName="promedio-equipo-por-criterio">
              {(TooltipContent) => (
                <div className={styles.chartWrapSmallTall}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartPromediosEquipo} margin={{ top: 20, right: 8, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="criterio" />
                      <YAxis width={35} domain={[0, 5]} />
                      <Tooltip content={<TooltipContent />} />
                      <Bar dataKey="promedio" fill="#b2a9ff" radius={[6, 6, 0, 0]}>
                        <LabelList dataKey="promedio" position="top" formatter={formatNote} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </ExportableChartCard>
          </div>

          <section className={styles.tableCardCompact}>
            <div className={styles.cardHeaderSmall}>
              <h3>Consolidado por auditor</h3>
            </div>

            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Auditor</th>
                    <th>Email</th>
                    <th>Auditorías</th>
                    <th>Promedio final</th>
                    <th>Mejor nota</th>
                  </tr>
                </thead>
                <tbody>
                  {resumenGeneral.rankingAuditores.length === 0 ? (
                    <tr>
                      <td colSpan={6} className={styles.emptyRow}>No hay evaluaciones registradas para el año seleccionado.</td>
                    </tr>
                  ) : (
                    resumenGeneral.rankingAuditores.map((item, index) => (
                      <tr key={item.auditor_id}>
                        <td>{index + 1}</td>
                        <td>{item.nombre}</td>
                        <td>{item.email}</td>
                        <td>{item.total}</td>
                        <td className={styles.finalNote}>{formatNote(item.promedioFinal)}</td>
                        <td>{formatNote(item.mejorNota)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {modoVista === 'auditor' && !loadingAuditores && !loadingDashboard && dashboard?.auditor && (
        <>
          {/* Perfil completo del auditor con KPIs integrados */}
          <div className={styles.profileBarCompact}>
            {/* Foto grande a la izquierda */}
            <div className={styles.profilePhotoSection}>
              <img
                src={avatarSrc}
                alt={`Avatar de ${dashboard.auditor.nombre}`}
                className={styles.profileAvatarImgLarge}
                onError={() => setAvatarSrc(DEFAULT_AVATAR)}
              />
            </div>

            {/* Info del auditor al centro */}
            <div className={styles.profileInfoSection}>
              <h2 className={styles.profileNameCompact}>
                {dashboard.auditor.nombre} {dashboard.auditor.apellido}
              </h2>
              <div className={styles.profileMeta}>
                <span>{dashboard.auditor.email}</span>
                <span>{dashboard.auditor.celular || 'Sin celular'}</span>
                <span>{dashboard.auditor.dependencia_nombre || 'Sin dependencia'}</span>
              </div>
            </div>

            {/* KPIs a la derecha */}
            <div className={styles.profileKpiSection}>
              <article className={styles.kpiInline}>
                <span className={styles.kpiLabelInline}>Auditorías</span>
                <strong className={styles.kpiValueInline}>{metricasFiltradas.total}</strong>
              </article>
              <article className={styles.kpiInline}>
                <span className={styles.kpiLabelInline}>Promedio</span>
                <strong className={styles.kpiValueInline}>{formatNote(metricasFiltradas.promedioFinal)}</strong>
              </article>
              <article className={styles.kpiInline}>
                <span className={styles.kpiLabelInline}>Mejor</span>
                <strong className={styles.kpiValueInline}>{formatNote(metricasFiltradas.mejorNota)}</strong>
              </article>
              <article className={styles.kpiInline}>
                <span className={styles.kpiLabelInline}>Años</span>
                <strong className={styles.kpiValueInline}>{dashboard.metricas?.anios_con_auditorias ?? 0}</strong>
              </article>
            </div>
          </div>

          {/* Gráficos compactos - 3 en una fila */}
          <div className={styles.chartsRowCompact}>
            <ExportableChartCard title="Auditorías/año" downloadName="auditorias-por-anio">
              {(TooltipContent) => (
                <div className={styles.chartWrapSmall}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartAuditoriasPorAnio}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="anio" height={30} />
                      <YAxis width={35} allowDecimals={false} />
                      <Tooltip content={<TooltipContent />} />
                      <Bar dataKey="auditorias" fill="#6387d6" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </ExportableChartCard>

            <ExportableChartCard title="Notas/año" downloadName="notas-por-anio">
              {(TooltipContent) => (
                <div className={styles.chartWrapSmall}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartNotasPorAnio}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="anio" height={30} />
                      <YAxis width={35} domain={[0, 5]} />
                      <Tooltip content={<TooltipContent />} />
                      <Line type="monotone" dataKey="final" stroke="#2563eb" strokeWidth={2}>
                        <LabelList dataKey="final" position="top" formatter={formatNote} />
                      </Line>
                      <Line type="monotone" dataKey="archivos" stroke="#0f766e" strokeWidth={1.5} />
                      <Line type="monotone" dataKey="encuesta" stroke="#d97706" strokeWidth={1.5} />
                      <Line type="monotone" dataKey="rubrica" stroke="#7c3aed" strokeWidth={1.5} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </ExportableChartCard>

            <ExportableChartCard title="Evolución" downloadName="evolucion-por-auditoria">
              {(TooltipContent) => {
                return (
                <div className={styles.chartWrapSmall}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartNotasPorAuditoria}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="nota_final" height={30} />
                      <YAxis width={35} domain={[0, 5]} />
                      <Tooltip content={<TooltipContent />} />
                      <Bar dataKey="nota_final" fill="#aa6cc7" radius={[6, 6, 0, 0]}>
                        <LabelList dataKey="nota_final" position="top" formatter={formatNote} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                )
              }}
            </ExportableChartCard>
          </div>

          {/* Tabla completa */}
          <section className={styles.tableCardCompact}>
            <div className={styles.cardHeaderSmall}>
              <h3>Detalle por auditoría</h3>
            </div>

            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>ID Informe</th>
                    <th>Dependencia</th>
                    <th>Fecha</th>
                    <th>Periodo</th>
                    <th>Archivos</th>
                    <th>Encuesta</th>
                    <th>Rúbrica</th>
                    <th>Final</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {auditoriasFiltradas.length === 0 ? (
                    <tr>
                      <td colSpan={9} className={styles.emptyRow}>No hay auditorías para el filtro seleccionado.</td>
                    </tr>
                  ) : (
                    auditoriasFiltradas.map((auditoria) => (
                      <tr key={auditoria.informe_id}>
                        <td>{formatNote(auditoria.nota_final)}</td>
                        <td>{auditoria.dependencia_nombre}</td>
                        <td>{auditoria.fecha_auditoria || '—'}</td>
                        <td>{auditoria.periodo || '—'}</td>
                        <td>{formatNote(auditoria.nota_archivos)}</td>
                        <td>{formatNote(auditoria.nota_encuesta)}</td>
                        <td>{formatNote(auditoria.nota_rubrica)}</td>
                        <td className={styles.finalNote}>{formatNote(auditoria.nota_final)}</td>
                        <td>
                          <span className={styles.statusBadge}>{auditoria.estado_evaluacion || 'sin_evaluacion'}</span>
                        </td>
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