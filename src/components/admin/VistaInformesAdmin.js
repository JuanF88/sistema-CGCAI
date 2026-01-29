'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import styles from '@/components/admin/CSS/auditoriasMallaControl.module.css'
import {
  parseYMD,
  addDays,
  startOfDay,
  diffInDays,
  fmt,
  buildPlanPath,
  buildAsistenciaPath,
  buildEvaluacionPath,
  buildActaPath,
  buildActaCompromisoPath,
  buildValidationPath,
  BUCKETS
} from '@/hooks/useAuditTimeline'

// Helper local para compatibilidad (si se necesita en este archivo)
const daysBetween = diffInDays

/* ===== obtener timestamps desde Storage (created_at/updated_at) ===== */
async function getFileTimestamps(supabase, bucket, fullPath) {
  try {
    const dir = fullPath.includes('/') ? fullPath.slice(0, fullPath.lastIndexOf('/')) : ''
    const name = fullPath.includes('/') ? fullPath.slice(fullPath.lastIndexOf('/') + 1) : fullPath
    const { data: list } = await supabase.storage.from(bucket).list(dir || '', { limit: 1000 })
    const obj = (list || []).find(x => x.name === name)
    return obj ? { created_at: obj.created_at, updated_at: obj.updated_at } : null
  } catch {
    return null
  }
}

export default function AuditoriasMallaControl() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [auditorias, setAuditorias] = useState([])
  const [selectedYear, setSelectedYear] = useState('') // '' = todos

  const loadData = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const { data, error } = await supabase
        .from('informes_auditoria')
        .select(`
          id, fecha_auditoria, dependencia_id, validado,
          objetivo, criterios, conclusiones, recomendaciones,
          dependencias:dependencias ( nombre ),
          usuarios:usuario_id ( nombre, apellido ),
          fortalezas ( id ),
          oportunidades_mejora ( id ),
          no_conformidades ( id ),
          plan_informe:planes_auditoria_informe ( archivo_path, enviado_at )
        `)
        .order('fecha_auditoria', { ascending: true })

      if (error) throw error
      const rows = data || []

      const fileExists = async (bucket, path) => {
        try {
          // Extraer directorio y nombre del archivo
          const lastSlash = path.lastIndexOf('/')
          const dir = lastSlash > 0 ? path.substring(0, lastSlash) : ''
          const fileName = lastSlash > 0 ? path.substring(lastSlash + 1) : path
          
          // Listar archivos en el directorio
          const { data, error } = await supabase.storage
            .from(bucket)
            .list(dir, { limit: 1000 })
          
          if (error) return false
          return data?.some(file => file.name === fileName) || false
        } catch { 
          return false 
        }
      }

      const merged = await Promise.all(rows.map(async (a) => {
        const fa = parseYMD(a.fecha_auditoria)
        const due = fa ? {
          plan:        addDays(fa, -5),
          asistencia:  fa,
          evaluacion:  fa,
          acta:        fa,
          actaComp:    addDays(fa, 15),
          informeOk:   addDays(fa, 10),
          validado:    addDays(fa, 10),
        } : {}

        const [hasPlan, hasAsis, hasEval, hasActa, hasActaComp, hasValid] = await Promise.all([
          fileExists(BUCKETS.PLANES,            buildPlanPath(a)),
          fileExists(BUCKETS.ASISTENCIAS,       buildAsistenciaPath(a)),
          fileExists(BUCKETS.EVALUACIONES,      buildEvaluacionPath(a)),
          fileExists(BUCKETS.ACTAS,             buildActaPath(a)),
          fileExists(BUCKETS.ACTAS_COMPROMISO,  buildActaCompromisoPath(a)),
          fileExists(BUCKETS.VALIDACIONES,      buildValidationPath(a)),
        ])


        // Campos e hallazgos completos = "informeOk"
        const isFilled = Boolean(a.objetivo?.trim()) && Boolean(a.criterios?.trim()) &&
                         Boolean(a.conclusiones?.trim()) && Boolean(a.recomendaciones?.trim())
        const hallCount = (a.fortalezas?.length || 0) + (a.oportunidades_mejora?.length || 0) + (a.no_conformidades?.length || 0)
        const informeOk = isFilled && hallCount > 0
        const validadoOk = hasValid || a.validado === true

        // Fechas de entrega (cuando existan)
        const planSentAt = a?.plan_informe?.[0]?.enviado_at
          || (hasPlan ? (await getFileTimestamps(supabase, 'planes', buildPlanPath(a)))?.created_at : null)
        const asistenciaAt = hasAsis ? (await getFileTimestamps(supabase, 'asistencias', buildAsistenciaPath(a)))?.created_at : null
        const evaluacionAt = hasEval ? (await getFileTimestamps(supabase, 'evaluaciones', buildEvaluacionPath(a)))?.created_at : null
        const actaAt       = hasActa ? (await getFileTimestamps(supabase, 'actas', buildActaPath(a)))?.created_at : null
        const actaCompAt   = hasActaComp ? (await getFileTimestamps(supabase, 'actascompromiso', buildActaCompromisoPath(a)))?.created_at : null
        const validadoAt   = validadoOk ? (await getFileTimestamps(supabase, 'validaciones', buildValidationPath(a)))?.created_at : null

        const _stages = {
          plan:       { delivered: hasPlan,       due: due.plan,       deliveredAt: planSentAt ? new Date(planSentAt) : null },
          asistencia: { delivered: hasAsis,       due: due.asistencia, deliveredAt: asistenciaAt ? new Date(asistenciaAt) : null },
          evaluacion: { delivered: hasEval,       due: due.evaluacion, deliveredAt: evaluacionAt ? new Date(evaluacionAt) : null },
          acta:       { delivered: hasActa,       due: due.acta,       deliveredAt: actaAt ? new Date(actaAt) : null },
          actaComp:   { delivered: hasActaComp,   due: due.actaComp,   deliveredAt: actaCompAt ? new Date(actaCompAt) : null },
          informeOk:  { delivered: informeOk,     due: due.informeOk,  deliveredAt: null },
          validado:   { delivered: validadoOk,    due: due.validado,   deliveredAt: validadoAt ? new Date(validadoAt) : null },
        }

        // Puntuaciones
        const docScore = [hasPlan, hasAsis, hasEval, hasActa, hasActaComp, validadoOk].reduce((n, b) => n + (b ? 1 : 0), 0)
        const infoScore = docScore + (informeOk ? 1 : 0)

        return {
          ...a,
          _flags: { plan: hasPlan, asistencia: hasAsis, evaluacion: hasEval, acta: hasActa, actaComp: hasActaComp, informeOk, validado: validadoOk },
          _stages,
          _scores: { docScore, infoScore }
        }
      }))

      setAuditorias(merged)
    } catch (e) {
      console.error(e)
      setError(e.message || 'Error cargando datos')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const years = useMemo(() => {
    const s = new Set()
    auditorias.forEach(a => { const d = parseYMD(a.fecha_auditoria); if (d) s.add(d.getFullYear()) })
    return Array.from(s).sort((a, b) => a - b)
  }, [auditorias])

  const filtered = useMemo(() => {
    if (!selectedYear) return auditorias
    return auditorias.filter(a => {
      const d = parseYMD(a.fecha_auditoria)
      return d && String(d.getFullYear()) === String(selectedYear)
    })
  }, [auditorias, selectedYear])

  /* ===== agregación por dependencia + orden por completitud promedio ===== */
  const matrix = useMemo(() => {
    const today = startOfDay(new Date())
    const m = new Map()

    // Recolecta items por dependencia
    for (const a of filtered) {
      const depId = a.dependencia_id ?? 'SIN_DEP'
      const depName = a?.dependencias?.nombre || 'Sin dependencia'
      if (!m.has(depId)) {
        m.set(depId, { depId, depName, items: [] })
      }
      m.get(depId).items.push(a)
    }

    // Agrega métricas agregadas + % avance + tooltips
    const cols = ['plan','asistencia','evaluacion','acta','actaComp','informeOk','validado']
    const list = Array.from(m.values()).map(row => {
      const total = row.items.length
      const agg = {}
      let sumDone = 0

      for (const key of cols) {
        let done = 0, overdue = 0, pending = 0
        let nextDue = null, lastDelivered = null

        for (const a of row.items) {
          const st = a._stages?.[key]
          if (!st) continue
          if (st.delivered) {
            done++
            if (st.deliveredAt && (!lastDelivered || st.deliveredAt > lastDelivered)) {
              lastDelivered = st.deliveredAt
            }
          } else {
            pending++
            if (st.due) {
              if (st.due < today) overdue++
              if (st.due >= today && (!nextDue || st.due < nextDue)) nextDue = st.due
            }
          }
        }

        sumDone += done
        agg[key] = { done, total, overdue, pending, nextDue, lastDelivered }
      }

      const completion = total ? (sumDone / (total * cols.length)) : 0
      return { depId: row.depId, depName: row.depName, total, completion, _agg: agg }
    })

    // Orden por menor completitud (para identificar rápidamente lo que falta)
    return list.sort((a, b) => (a.completion - b.completion) || a.depName.localeCompare(b.depName))
  }, [filtered])

  /* ===== KPIs globales ===== */
  const kpis = useMemo(() => {
    const t = { total: filtered.length, plan: 0, asistencia: 0, evaluacion: 0, acta: 0, actaComp: 0, informeOk: 0, validado: 0 }
    filtered.forEach(a => {
      const f = a._flags || {}
      if (f.plan) t.plan++
      if (f.asistencia) t.asistencia++
      if (f.evaluacion) t.evaluacion++
      if (f.acta) t.acta++
      if (f.actaComp) t.actaComp++
      if (f.informeOk) t.informeOk++
      if (f.validado) t.validado++
    })
    const pct = (n) => (t.total ? Math.round((n / t.total) * 100) : 0)
    return { ...t, pct }
  }, [filtered])

  const columns = [
    { key: 'plan',       title: 'Plan' },
    { key: 'asistencia', title: 'Asistencia' },
    { key: 'evaluacion', title: 'Evaluación' },
    { key: 'acta',       title: 'Acta' },
    { key: 'actaComp',   title: 'Acta Comp.' },
    { key: 'informeOk',  title: 'Informe OK' },
    { key: 'validado',   title: 'Validado' },
  ]

  return (
    <div className={styles.wrapper}>
      <main className={styles.content}>
        {/* Header moderno con gradiente */}
        <div className={styles.modernHeader}>
          <div className={styles.headerContent}>
            <div className={styles.headerText}>
              <h1 className={styles.modernTitle}>Centro de Control de Auditorías</h1>
              <p className={styles.modernSubtitle}>Monitoreo en tiempo real del estado de todas las auditorías</p>
            </div>
            <div className={styles.headerActions}>
              <select className={styles.modernSelect} value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
                <option value="">📅 Todos los años</option>
                {years.map(y => <option key={y} value={y}>📅 {y}</option>)}
              </select>
              <button className={styles.modernRefresh} onClick={loadData} title="Recargar datos">
                <span className={styles.refreshIcon}>↻</span>
              </button>
            </div>
          </div>
        </div>

        {/* KPI Cards modernos */}
        <div className={styles.kpiGrid}>
          <KpiCard 
            icon="📊" 
            label="Total Auditorías" 
            value={kpis.total} 
            color="blue"
          />
          <KpiCard 
            icon="📋" 
            label="Planes" 
            value={kpis.plan}
            total={kpis.total}
            percent={kpis.pct(kpis.plan)}
            color="purple"
          />
          <KpiCard 
            icon="✓" 
            label="Asistencias" 
            value={kpis.asistencia}
            total={kpis.total}
            percent={kpis.pct(kpis.asistencia)}
            color="green"
          />
          <KpiCard 
            icon="📝" 
            label="Evaluaciones" 
            value={kpis.evaluacion}
            total={kpis.total}
            percent={kpis.pct(kpis.evaluacion)}
            color="orange"
          />
          <KpiCard 
            icon="📄" 
            label="Actas" 
            value={kpis.acta}
            total={kpis.total}
            percent={kpis.pct(kpis.acta)}
            color="cyan"
          />
          <KpiCard 
            icon="📑" 
            label="Actas Compromiso" 
            value={kpis.actaComp}
            total={kpis.total}
            percent={kpis.pct(kpis.actaComp)}
            color="pink"
          />
          <KpiCard 
            icon="✅" 
            label="Informes Completos" 
            value={kpis.informeOk}
            total={kpis.total}
            percent={kpis.pct(kpis.informeOk)}
            color="teal"
          />
          <KpiCard 
            icon="🎯" 
            label="Validados" 
            value={kpis.validado}
            total={kpis.total}
            percent={kpis.pct(kpis.validado)}
            color="indigo"
          />
        </div>

        

        {/* Heatmap por dependencia - MODERNA */}
        <section className={styles.modernGridCard}>
          <div className={styles.modernGridHeader}>
            <h3 className={styles.gridTitle}>
              <span className={styles.gridTitleIcon}>🎯</span>
              Malla de Control por Dependencia
            </h3>
            <p className={styles.gridSubtitle}>Seguimiento detallado del progreso de cada dependencia</p>
          </div>
          <div className={styles.modernTableContainer}>
            <div className={styles.gridHeader}>
              <div className={styles.gridHeadSticky}>
                <span className={styles.columnIcon}>🏢</span> Dependencia
              </div>
              <div className={styles.gridHead}>
                <span className={styles.columnIcon}>📈</span> Avance
              </div>
              {['📋 Plan','✓ Asistencia','📝 Evaluación','📄 Acta','📑 Acta Comp.','✅ Informe','🎯 Validado'].map(h => (
                <div key={h} className={styles.gridHead}>{h}</div>
              ))}
            </div>

            {loading && (
              <div className={styles.modernLoader}>
                <div className={styles.spinnerContainer}>
                  <div className={styles.spinner}></div>
                  <p>Cargando datos...</p>
                </div>
              </div>
            )}
            
            {error && (
              <div className={styles.modernError}>
                <span className={styles.errorIcon}>⚠️</span>
                <div>
                  <strong>Error al cargar los datos</strong>
                  <p>{error}</p>
                </div>
              </div>
            )}
            
            {!loading && !error && matrix.length === 0 && (
              <div className={styles.modernEmpty}>
                <span className={styles.emptyIcon}>📭</span>
                <p>No hay resultados para el filtro seleccionado</p>
              </div>
            )}

            <div className={styles.gridBody}>
              {matrix.map(row => {
                const pct = Math.round(row.completion * 100)
                return (
                  <div key={row.depId} className={styles.modernGridRow}>
                    <div className={styles.depCell}>
                      <div className={styles.depCellContent}>
                        <span className={styles.depName}>{row.depName}</span>
                        <span className={styles.depTotal}>{row.total} auditorías</span>
                      </div>
                    </div>

                    {/* % de avance mejorado */}
                    <div className={styles.modernProgressCell}>
                      <div className={styles.modernProgressTrack}>
                        <div 
                          className={`${styles.modernProgressFill} ${getProgressColorClass(pct, styles)}`}
                          style={{ width: `${pct}%` }} 
                          aria-label={`Avance ${pct}%`} 
                        />
                      </div>
                      <span className={styles.modernProgressLabel}>{pct}%</span>
                    </div>

                    {columns.map(col => {
                      const ag = row._agg[col.key] || { done: 0, total: row.total, overdue: 0, pending: 0, nextDue: null, lastDelivered: null }
                      const localPct = ag.total ? Math.round((ag.done / ag.total) * 100) : 0
                      const cls = heatClass(localPct, styles)
                      const tip = buildTooltip(col.title, ag)
                      
                      // Formatear fechas
                      let dateInfo = ''
                      if (ag.lastDelivered) {
                        dateInfo = `✓ ${fmt(ag.lastDelivered)}`
                      } else if (ag.nextDue) {
                        dateInfo = `⏰ ${fmt(ag.nextDue)}`
                      }
                      
                      return (
                        <div key={col.key} className={`${styles.modernCell} ${cls}`} title={tip} aria-label={tip}>
                          <span className={styles.cellFraction}>{ag.done}/{ag.total}</span>
                          <span className={styles.cellPercent}>{localPct}%</span>
                          {dateInfo && <span className={styles.cellDate}>{dateInfo}</span>}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

/* ===== Subcomponentes UI ===== */
function KpiCard({ icon, label, value, total, percent, color = 'blue' }) {
  return (
    <div className={`${styles.kpiCard} ${styles[`kpiCard${color.charAt(0).toUpperCase() + color.slice(1)}`]}`}>
      <div className={styles.kpiIcon}>{icon}</div>
      <div className={styles.kpiContent}>
        <div className={styles.kpiLabel}>{label}</div>
        <div className={styles.kpiValue}>
          {total ? `${value}/${total}` : value}
        </div>
        {percent !== undefined && (
          <div className={styles.kpiProgress}>
            <div className={styles.kpiProgressBar}>
              <div className={styles.kpiProgressFill} style={{ width: `${percent}%` }}></div>
            </div>
            <span className={styles.kpiPercent}>{percent}%</span>
          </div>
        )}
      </div>
    </div>
  )
}

function KpiChip({ label, value }) {
  return (
    <span className={styles.kpiChip}>
      <strong>{label}:</strong> {value}
    </span>
  )
}

function heatClass(pct, s) {
  if (pct >= 90) return s.heat5
  if (pct >= 70) return s.heat4
  if (pct >= 50) return s.heat3
  if (pct >= 25) return s.heat2
  if (pct > 0)  return s.heat1
  return s.heat0
}

function getProgressColorClass(pct, s) {
  if (pct >= 90) return s.progressExcellent
  if (pct >= 70) return s.progressGood
  if (pct >= 50) return s.progressMedium
  if (pct >= 25) return s.progressLow
  return s.progressPoor
}

function buildTooltip(title, ag) {
  const parts = []
  parts.push(`${title}: ${ag.done}/${ag.total}`)
  if (typeof ag.pending === 'number') parts.push(`Pendientes: ${ag.pending}`)
  if (typeof ag.overdue === 'number') parts.push(`Vencidos: ${ag.overdue}`)
  if (ag.nextDue) parts.push(`Próximo límite: ${fmt(ag.nextDue)}`)
  if (ag.lastDelivered) parts.push(`Última entrega: ${fmt(ag.lastDelivered)}`)
  return parts.join(' · ')
}

/* ===== Modal detalle ===== */
function DetailModal({ onClose, items }) {
  const today = startOfDay(new Date())

  const cols = [
    { key: 'plan',       title: 'Plan' },
    { key: 'asistencia', title: 'Asistencia' },
    { key: 'evaluacion', title: 'Evaluación' },
    { key: 'acta',       title: 'Acta' },
    { key: 'actaComp',   title: 'Acta Comp.' },
    { key: 'informeOk',  title: 'Informe OK' },
    { key: 'validado',   title: 'Validado' },
  ]

  return (
    <div className={styles.modalOverlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.modalCard}>
        <button className={styles.modalClose} onClick={onClose}>✖</button>
        <h3 className={styles.modalTitle}>Detalle por auditoría</h3>

        <div className={styles.auditTable}>
          <div className={`${styles.auditTh} ${styles.auditColId}`}>ID</div>
          <div className={`${styles.auditTh} ${styles.auditColFecha}`}>Fecha auditoría</div>
          {cols.map(c => (
            <div key={c.key} className={`${styles.auditTh} ${styles.auditColStage}`}>{c.title}</div>
          ))}

          {items.map(a => {
            const fa = parseYMD(a.fecha_auditoria)
            return (
              <FragmentRow key={a.id} a={a} fa={fa} cols={cols} today={today} />
            )
          })}
        </div>
      </div>
    </div>
  )
}

function FragmentRow({ a, fa, cols, today }) {
  return (
    <>
      <div className={styles.auditTd}>{a.id}</div>
      <div className={styles.auditTd}>{fa ? fmt(fa) : '—'}</div>
      {cols.map(c => {
        const st = a._stages?.[c.key]
        const delivered = !!st?.delivered
        const due = st?.due || null
        const deliveredAt = st?.deliveredAt || null

        let label = ''
        let cls = styles.chipPending

        if (delivered) {
          label = deliveredAt ? `Entregado • ${fmt(deliveredAt)}` : 'Entregado'
          cls = styles.chipOk
        } else if (due) {
          const d = daysBetween(today, due)
          if (d < 0) { label = `Vencido ${Math.abs(d)} d • ${fmt(due)}`; cls = styles.chipOverdue }
          else if (d === 0) { label = `Hoy • ${fmt(due)}`; cls = styles.chipToday }
          else if (d <= 3) { label = `Faltan ${d} d • ${fmt(due)}`; cls = styles.chipSoon }
          else { label = `Faltan ${d} d • ${fmt(due)}`; cls = styles.chipPending }
        } else {
          label = 'Sin fecha'
          cls = styles.chipPending
        }

        return <div key={c.key} className={styles.auditTd}><span className={`${styles.chip} ${cls}`}>{label}</span></div>
      })}
    </>
  )
}
