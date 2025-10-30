'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import styles from '@/components/admin/CSS/auditoriasMallaControl.module.css'

/* ===== utilidades fecha ===== */
function parseYMD(ymd) {
  if (!ymd) return null
  const [y, m, d] = String(ymd).slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}
function addDays(date, n) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  d.setDate(d.getDate() + n)
  return d
}
function startOfDay(date) { return new Date(date.getFullYear(), date.getMonth(), date.getDate()) }
function daysBetween(a, b) { return Math.round((startOfDay(b) - startOfDay(a)) / 86400000) }
function fmt(date) {
  try {
    return new Intl.DateTimeFormat('es-CO', {
      timeZone: 'America/Bogota', year: 'numeric', month: 'short', day: '2-digit'
    }).format(date)
  } catch { return date?.toLocaleDateString?.() ?? '' }
}
function statusLabel(due, delivered, today) {
  if (delivered) return 'Entregado'
  if (!due) return 'Sin fecha'
  const d = daysBetween(today, due)
  if (d < 0) return `Vencido ${Math.abs(d)} d`
  if (d === 0) return 'Hoy'
  return `Faltan ${d} d`
}

/* ===== helpers filename para detectar archivos en Storage ===== */
const toSlugUpper = (s = '') =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').toUpperCase()

const toYMD = (input) => {
  if (!input) return new Date().toISOString().slice(0, 10)
  const s = String(input)
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : new Date(input).toISOString().slice(0, 10)
}

const buildPlanPath            = (a) => `PlanAuditoria_${a.id}_${toSlugUpper(a?.dependencias?.nombre || 'SIN_DEP')}_${toYMD(a?.fecha_auditoria)}.pdf`
const buildValidationPath      = (a) => `Auditoria_${a.id}_${toSlugUpper(a?.dependencias?.nombre || 'SIN_DEPENDENCIA')}_${toYMD(a?.fecha_auditoria)}.pdf`
const buildAsistenciaPath      = (a) => `Asistencia_${a.id}_${toSlugUpper(a?.dependencias?.nombre || 'SIN_DEP')}_${toYMD(a?.fecha_auditoria)}.pdf`
const buildEvaluacionPath      = (a) => `Evaluacion_${a.id}_${toSlugUpper(a?.dependencias?.nombre || 'SIN_DEP')}_${toYMD(a?.fecha_auditoria)}.pdf`
const buildActaPath            = (a) => `Acta_${a.id}_${toSlugUpper(a?.dependencias?.nombre || 'SIN_DEP')}_${toYMD(a?.fecha_auditoria)}.pdf`
const buildActaCompromisoPath  = (a) => `ActaCompromiso_${a.id}_${toSlugUpper(a?.dependencias?.nombre || 'SIN_DEP')}_${toYMD(a?.fecha_auditoria)}.pdf`

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

  // modal detalle por dependencia
  const [detailDepId, setDetailDepId] = useState(null)

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

      const trySign = async (bucket, path) => {
        try {
          const { data: s } = await supabase.storage.from(bucket).createSignedUrl(path, 60)
          return Boolean(s?.signedUrl)
        } catch { return false }
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
          trySign('planes',         buildPlanPath(a)),
          trySign('asistencias',    buildAsistenciaPath(a)),
          trySign('evaluaciones',   buildEvaluacionPath(a)),
          trySign('actas',          buildActaPath(a)),
          trySign('actascompromiso',buildActaCompromisoPath(a)),
          trySign('validaciones',   buildValidationPath(a)),
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

    // Orden por mayor completitud promedio (más “información subida” primero)
    return list.sort((a, b) => (b.completion - a.completion) || a.depName.localeCompare(b.depName))
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
        {/* Toolbar / Filtros / KPIs */}
        <div className={styles.toolbar}>
          <div className={styles.toolbarTop}>
            <h3 className={styles.toolbarTitle}>Malla de control — Vista general</h3>
            <div className={styles.toolbarActions}>
              <label className={styles.inputGroup}>
                <span className={styles.inputLabel}>Año</span>
                <select className={styles.inputBase} value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
                  <option value="">Todos</option>
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </label>
              <button className={styles.refreshBtn} onClick={loadData} title="Recargar">↻</button>
            </div>
          </div>

          <div className={styles.kpisBar}>
            <KpiChip label="Total" value={kpis.total} />
            <KpiChip label="Plan" value={`${kpis.plan}/${kpis.total} — ${kpis.pct(kpis.plan)}%`} />
            <KpiChip label="Asistencia" value={`${kpis.asistencia}/${kpis.total} — ${kpis.pct(kpis.asistencia)}%`} />
            <KpiChip label="Evaluación" value={`${kpis.evaluacion}/${kpis.total} — ${kpis.pct(kpis.evaluacion)}%`} />
            <KpiChip label="Acta" value={`${kpis.acta}/${kpis.total} — ${kpis.pct(kpis.acta)}%`} />
            <KpiChip label="Acta Comp." value={`${kpis.actaComp}/${kpis.total} — ${kpis.pct(kpis.actaComp)}%`} />
            <KpiChip label="Informe OK" value={`${kpis.informeOk}/${kpis.total} — ${kpis.pct(kpis.informeOk)}%`} />
            <KpiChip label="Validados" value={`${kpis.validado}/${kpis.total} — ${kpis.pct(kpis.validado)}%`} />
          </div>
        </div>

        {/* Leyenda de colores */}
        <div className={styles.legend}>
          <span>Progreso por celda:</span>
          <i className={`${styles.legendBox} ${styles.heat0}`} title="0%"></i>
          <i className={`${styles.legendBox} ${styles.heat1}`} title=">0%"></i>
          <i className={`${styles.legendBox} ${styles.heat2}`} title="≥25%"></i>
          <i className={`${styles.legendBox} ${styles.heat3}`} title="≥50%"></i>
          <i className={`${styles.legendBox} ${styles.heat4}`} title="≥70%"></i>
          <i className={`${styles.legendBox} ${styles.heat5}`} title="≥90%"></i>
        </div>

        {/* Heatmap por dependencia */}
        <section className={styles.gridCard}>
          <div className={styles.gridHeader}>
            <div className={styles.gridHeadSticky}>Dependencia</div>
            <div className={styles.gridHead}>Avance %</div>
            {['Plan','Asistencia','Evaluación','Acta','Acta Comp.','Informe OK','Validado'].map(h => (
              <div key={h} className={styles.gridHead}>{h}</div>
            ))}
          </div>

          {loading && <div className={styles.skeletonList} style={{ padding: 12 }}>Cargando…</div>}
          {error && <div className={styles.errorBox}>⚠️ {error}</div>}
          {!loading && !error && matrix.length === 0 && (
            <div className={styles.emptyBox}>Sin resultados para el filtro seleccionado.</div>
          )}

          <div className={styles.gridBody}>
            {matrix.map(row => {
              const pct = Math.round(row.completion * 100)
              return (
                <div key={row.depId} className={styles.gridRow}>
                  <div
                    className={`${styles.depCell} ${styles.depCellClickable}`}
                    onClick={() => setDetailDepId(row.depId)}
                    title="Click para ver detalle por auditoría"
                  >
                    {row.depName}
                  </div>

                  {/* % de avance */}
                  <div className={styles.progressCell}>
                    <div className={styles.progressTrack}>
                      <div className={styles.progressFill} style={{ width: `${pct}%` }} aria-label={`Avance ${pct}%`} />
                    </div>
                    <span className={styles.progressLabel}>{pct}%</span>
                  </div>

                  {columns.map(col => {
                    const ag = row._agg[col.key] || { done: 0, total: row.total, overdue: 0, pending: 0, nextDue: null, lastDelivered: null }
                    const localPct = ag.total ? Math.round((ag.done / ag.total) * 100) : 0
                    const cls = heatClass(localPct, styles)
                    const tip = buildTooltip(col.title, ag)
                    return (
                      <div key={col.key} className={`${styles.cell} ${cls}`} title={tip} aria-label={tip}>
                        <span className={styles.cellText}>{ag.done}/{ag.total}</span>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </section>
      </main>

      {/* ===== Modal de detalle por dependencia (auditorías individuales) ===== */}
      {detailDepId && (
        <DetailModal
          depId={detailDepId}
          onClose={() => setDetailDepId(null)}
          items={filtered.filter(a => (a.dependencia_id ?? 'SIN_DEP') === detailDepId)}
        />
      )}
    </div>
  )
}

/* ===== Subcomponentes UI ===== */
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
function DetailModal({ depId, onClose, items }) {
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
