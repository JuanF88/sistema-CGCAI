'use client'

import { useEffect, useMemo, useState } from 'react'
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
} from 'recharts'
import {
  Search,
  RefreshCw,
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
} from 'lucide-react'
import styles from './CSS/VistaDashboardAuditores.module.css'

const formatNote = (value) => (typeof value === 'number' ? value.toFixed(2) : '—')

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
  const [auditores, setAuditores] = useState([])
  const [search, setSearch] = useState('')
  const [selectedAuditorId, setSelectedAuditorId] = useState('')
  const [dashboard, setDashboard] = useState(null)
  const [anioFiltro, setAnioFiltro] = useState('todos')
  const [loadingAuditores, setLoadingAuditores] = useState(true)
  const [loadingDashboard, setLoadingDashboard] = useState(false)
  const [error, setError] = useState('')
  const [reloadToken, setReloadToken] = useState(0)
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
  }, [selectedAuditorId, reloadToken])

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
            <button
              className={styles.modernRefreshBtn}
              onClick={() => selectedAuditorId && setReloadToken((value) => value + 1)}
              disabled={!selectedAuditorId || loadingDashboard}
              title="Recargar datos"
            >
              <span className={styles.refreshIcon}>↻</span>
              <span>{loadingDashboard ? 'Actualizando...' : 'Actualizar'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filtros compactos */}
      <div className={styles.filtersBar}>
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
      </div>

      {error && <div className={styles.errorBox}>{error}</div>}

      {(loadingAuditores || loadingDashboard) && (
        <div className={styles.loadingBox}>Cargando dashboard del auditor...</div>
      )}

      {!loadingAuditores && !loadingDashboard && dashboard?.auditor && (
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
            <article className={styles.chartCardSmall}>
              <div className={styles.cardHeaderSmall}>
                <h3>Auditorías/año</h3>
              </div>
              <div className={styles.chartWrapSmall}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartAuditoriasPorAnio}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="anio" height={30} />
                    <YAxis width={35} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="auditorias" fill="#2563eb" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>

            <article className={styles.chartCardSmall}>
              <div className={styles.cardHeaderSmall}>
                <h3>Notas/año</h3>
              </div>
              <div className={styles.chartWrapSmall}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartNotasPorAnio}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="anio" height={30} />
                    <YAxis width={35} domain={[0, 5]} />
                    <Tooltip />
                    <Line type="monotone" dataKey="final" stroke="#2563eb" strokeWidth={2} />
                    <Line type="monotone" dataKey="archivos" stroke="#0f766e" strokeWidth={1.5} />
                    <Line type="monotone" dataKey="encuesta" stroke="#d97706" strokeWidth={1.5} />
                    <Line type="monotone" dataKey="rubrica" stroke="#7c3aed" strokeWidth={1.5} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </article>

            <article className={styles.chartCardSmall}>
              <div className={styles.cardHeaderSmall}>
                <h3>Evolución</h3>
              </div>
              <div className={styles.chartWrapSmall}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartNotasPorAuditoria}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="nota_final" height={30} />
                    <YAxis width={35} domain={[0, 5]} />
                    <Tooltip content={<CustomTooltipEvolucion />} />
                    <Bar dataKey="nota_final" fill="#10b981" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>
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