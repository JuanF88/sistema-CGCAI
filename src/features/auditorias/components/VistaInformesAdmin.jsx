'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { STAT_TONES } from '@/components/ui/stat-card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PAGE_SHELL, SECTION_CARD } from '@/components/ui/tokens'
import { useAnioInicial } from '@/hooks/useAnioInicial'
import { cn } from '@/lib/utils'
import {
  parseYMD,
  addDays,
  startOfDay,
  fmt,
  buildPlanPath,
  buildAsistenciaPath,
  buildEvaluacionPath,
  buildActaPath,
  buildActaCompromisoPath,
  buildValidationPath,
  BUCKETS
} from '@/features/auditorias/hooks/useAuditTimeline'

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

// `soloLectura` se acepta por coherencia con las demás vistas del panel del
// visualizador, pero esta pantalla ya es de solo lectura: no ofrece ninguna
// acción de escritura.
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

  useAnioInicial(years, (anio) => setSelectedYear(String(anio)), { sinDatos: '' })

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
    { key: 'actaComp',   title: 'Carta Comp.' },
    { key: 'informeOk',  title: 'Informe OK' },
    { key: 'validado',   title: 'Validado' },
  ]

  return (
    <div className={PAGE_SHELL}>
      <PageHeader
        icon="🎯"
        title="Centro de Control de Auditorías"
        subtitle="Monitoreo en tiempo real del estado de todas las auditorías"
        actions={
          <div className="flex items-center gap-2">
            <Select
              value={selectedYear || 'todos'}
              onValueChange={(v) => setSelectedYear(v === 'todos' ? '' : v)}
            >
              <SelectTrigger className="w-44 border-white/25 bg-white/15 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los años</SelectItem>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              size="icon"
              onClick={loadData}
              title="Recargar datos"
              className="bg-white/15 text-white shadow-none backdrop-blur-sm hover:bg-white/25"
            >
              <RefreshCw className={loading ? 'animate-spin' : undefined} />
              <span className="sr-only">Recargar datos</span>
            </Button>
          </div>
        }
      />

      {/* KPIs */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
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
      </section>

      {/* Malla de control por dependencia */}
      <section className={cn(SECTION_CARD, 'overflow-hidden')}>
        <header className="border-b border-border p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <span aria-hidden="true">🎯</span>
            Malla de Control por Dependencia
          </h3>
          <p className="text-xs text-muted-foreground">
            Seguimiento detallado del progreso de cada dependencia
          </p>
        </header>

        {loading && (
          <p className="p-8 text-center text-sm text-muted-foreground">Cargando datos…</p>
        )}

        {error && (
          <div className="m-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <strong>Error al cargar los datos</strong>
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && matrix.length === 0 && (
          <p className="p-8 text-center text-sm text-muted-foreground">
            No hay resultados para el filtro seleccionado.
          </p>
        )}

        {!loading && !error && matrix.length > 0 && (
          <div className="overflow-x-auto">
            <div className="min-w-[1100px]">
              {/* Cabecera */}
              <div className="grid grid-cols-[minmax(220px,1.6fr)_140px_repeat(7,minmax(96px,1fr))] border-b border-border bg-muted/60">
                <div className="sticky left-0 z-10 bg-muted/60 px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  🏢 Dependencia
                </div>
                <div className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  📈 Avance
                </div>
                {['📋 Plan', '✓ Asistencia', '📝 Evaluación', '📄 Acta', '📑 Carta Comp.', '✅ Informe', '🎯 Validado'].map(
                  (h) => (
                    <div
                      key={h}
                      className="px-2 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      {h}
                    </div>
                  )
                )}
              </div>

              {/* Filas */}
              {matrix.map((row) => {
                const pct = Math.round(row.completion * 100)

                return (
                  <div
                    key={row.depId}
                    className="grid grid-cols-[minmax(220px,1.6fr)_140px_repeat(7,minmax(96px,1fr))] border-b border-border transition-colors last:border-0 hover:bg-muted/40"
                  >
                    <div className="sticky left-0 z-10 flex flex-col justify-center bg-card px-3 py-2.5">
                      <span className="text-sm font-medium leading-tight">{row.depName}</span>
                      <span className="text-xs text-muted-foreground">
                        {row.total} auditorías
                      </span>
                    </div>

                    <div className="flex items-center gap-2 px-3 py-2.5">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn('h-full rounded-full transition-[width] duration-500', progressColorClass(pct))}
                          style={{ width: `${pct}%` }}
                          aria-label={`Avance ${pct}%`}
                        />
                      </div>
                      <span className="text-xs font-semibold tabular-nums">{pct}%</span>
                    </div>

                    {columns.map((col) => {
                      const ag = row._agg[col.key] || {
                        done: 0,
                        total: row.total,
                        overdue: 0,
                        pending: 0,
                        nextDue: null,
                        lastDelivered: null,
                      }
                      const localPct = ag.total ? Math.round((ag.done / ag.total) * 100) : 0
                      const tip = buildTooltip(col.title, ag)

                      let dateInfo = ''
                      if (ag.lastDelivered) dateInfo = `✓ ${fmt(ag.lastDelivered)}`
                      else if (ag.nextDue) dateInfo = `⏰ ${fmt(ag.nextDue)}`

                      return (
                        <div
                          key={col.key}
                          title={tip}
                          aria-label={tip}
                          className={cn(
                            'm-1 flex flex-col items-center justify-center rounded-lg px-1 py-2 text-center',
                            heatClass(localPct)
                          )}
                        >
                          <span className="text-sm font-bold tabular-nums">
                            {ag.done}/{ag.total}
                          </span>
                          <span className="text-[0.7rem] font-semibold tabular-nums opacity-80">
                            {localPct}%
                          </span>
                          {dateInfo && (
                            <span className="mt-0.5 text-[0.65rem] opacity-75">{dateInfo}</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

/* ===== Subcomponentes UI ===== */

/** Tarjeta de KPI con barra de avance opcional. */
function KpiCard({ icon, label, value, total, percent, color = 'blue' }) {
  return (
    <article
      className={cn(
        'flex items-center gap-3 rounded-xl border border-border border-l-4 bg-card p-3.5 shadow-sm',
        'transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md',
        STAT_TONES[color]?.bar ?? STAT_TONES.blue.bar
      )}
    >
      <span
        className={cn(
          'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl',
          STAT_TONES[color]?.chip ?? STAT_TONES.blue.chip
        )}
        aria-hidden="true"
      >
        {icon}
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="text-xl font-extrabold leading-none tabular-nums">
          {total ? `${value}/${total}` : value}
        </p>

        {percent !== undefined && (
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-500"
                style={{ width: `${percent}%` }}
              />
            </div>
            <span className="text-[0.7rem] font-semibold tabular-nums text-muted-foreground">
              {percent}%
            </span>
          </div>
        )}
      </div>
    </article>
  )
}

/** Color de fondo de una celda del heatmap según su porcentaje. */
function heatClass(pct) {
  if (pct >= 90) return 'bg-emerald-100 text-emerald-900'
  if (pct >= 70) return 'bg-green-200 text-green-900'
  if (pct >= 50) return 'bg-blue-200 text-blue-900'
  if (pct >= 25) return 'bg-blue-100 text-blue-900'
  if (pct > 0) return 'bg-sky-50 text-sky-900'
  return 'bg-slate-50 text-slate-500'
}

/** Color de la barra de avance de una dependencia. */
function progressColorClass(pct) {
  if (pct >= 90) return 'bg-gradient-to-r from-emerald-500 to-emerald-600'
  if (pct >= 70) return 'bg-gradient-to-r from-[#667eea] to-[#764ba2]'
  if (pct >= 50) return 'bg-gradient-to-r from-amber-500 to-amber-600'
  if (pct >= 25) return 'bg-gradient-to-r from-orange-400 to-orange-500'
  return 'bg-gradient-to-r from-red-500 to-red-600'
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
