'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import styles from './auditoriasTimeline.module.css'

function parseYMD(ymd) {
    if (!ymd) return null
    const [y, m, d] = ymd.split('-').map(Number)
    if (!y || !m || !d) return null
    return new Date(y, m - 1, d)
}
function addDays(date, n) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    d.setDate(d.getDate() + n)
    return d
}
function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}
function diffInDays(from, to) {
    const ms = startOfDay(to) - startOfDay(from)
    return Math.round(ms / 86400000)
}
function fmt(date) {
    try {
        return new Intl.DateTimeFormat('es-CO', {
            timeZone: 'America/Bogota',
            year: 'numeric',
            month: 'short',
            day: '2-digit'
        }).format(date)
    } catch {
        return date.toLocaleDateString()
    }
}
function badgeFor(daysLeft, explicitDone = false) {
    if (explicitDone) return { label: 'Completado', cls: styles.badgeOk }
    if (daysLeft < 0) return { label: `Vencido ${Math.abs(daysLeft)} d`, cls: styles.badgeOverdue }
    if (daysLeft === 0) return { label: 'Hoy', cls: styles.badgeToday }
    if (daysLeft <= 3) return { label: `En ${daysLeft} d`, cls: styles.badgeSoon }
    return { label: `${daysLeft} días Restantes`, cls: styles.badgePending }
}

// Helpers para nombre de archivo consistente
const toSlugUpper = (s = '') =>
    s.normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Za-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .toUpperCase()

const toYMD = (input) => {
    if (!input) return new Date().toISOString().slice(0, 10)
    const s = String(input)
    return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : new Date(input).toISOString().slice(0, 10)
}

const buildPlanPath = (auditoria) => {
    const dep = toSlugUpper(auditoria?.dependencias?.nombre || 'SIN_DEP')
    const ymd = toYMD(auditoria?.fecha_auditoria)
    // Ej: PlanAuditoria_123_DEP_2025-10-08.pdf
    return `PlanAuditoria_${auditoria.id}_${dep}_${ymd}.pdf`
}


export default function AuditoriasTimeline({ usuario }) {
    const [planModalOpen, setPlanModalOpen] = useState(false)
    const [planFile, setPlanFile] = useState(null)
    const [uploadingPlan, setUploadingPlan] = useState(false)
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [auditorias, setAuditorias] = useState([])
    const [selectedId, setSelectedId] = useState(null)
    // Subir/Reemplazar plan de auditoría
    const subirPlanAuditoria = async () => {
        if (!selected || !planFile) return
        setUploadingPlan(true)
        try {
            const filePath = buildPlanPath(selected)

            // 1) subir al bucket 'planes'
            const { error: upErr } = await supabase
                .storage
                .from('planes')
                .upload(filePath, planFile, { upsert: true, contentType: 'application/pdf' })
            if (upErr) throw upErr

            // 2) upsert en la tabla (requiere unique en informe_id)
            const { data: userRes } = await supabase.auth.getUser()
            const enviado_por = userRes?.user?.id || null

            const { error: dbErr } = await supabase
                .from('planes_auditoria_informe')
                .upsert({
                    informe_id: selected.id,
                    archivo_path: filePath,
                    enviado_por
                }, { onConflict: 'informe_id' })
            if (dbErr) throw dbErr

            // 3) firmar URL para ver
            const { data: signed } = await supabase
                .storage
                .from('planes')
                .createSignedUrl(filePath, 60 * 60)

            // 4) refrescar estado local (marca como enviado)
            setAuditorias(prev => prev.map(a =>
                a.id === selected.id
                    ? { ...a, plan: { path: filePath, enviado_at: new Date().toISOString(), url: signed?.signedUrl || null } }
                    : a
            ))

            setPlanModalOpen(false)
            setPlanFile(null)
        } catch (e) {
            console.error('Error subiendo plan:', e)
            // opcional: toast.error('No se pudo enviar el plan')
        } finally {
            setUploadingPlan(false)
        }
    }

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
      .select(`
        id,
        fecha_auditoria,
        fecha_seguimiento,
        objetivo, criterios, conclusiones, recomendaciones,
        dependencias:dependencias ( nombre ),
        plan_informe:planes_auditoria_informe ( archivo_path, enviado_at )
      `)
      .eq('usuario_id', usuario.usuario_id)
      .order('fecha_auditoria', { ascending: true })

    if (error) throw error

    // Mezcla plan + validado en un solo objeto
    const merged = await Promise.all(
      (data || []).map(async (a) => {
        // ---- PLAN ----
        let plan = null
        const rec = a.plan_informe?.[0] || null
        if (rec?.archivo_path) {
          try {
            const { data: signed } = await supabase
              .storage
              .from('planes')
              .createSignedUrl(rec.archivo_path, 60 * 60)
            plan = {
              path: rec.archivo_path,
              enviado_at: rec.enviado_at,
              url: signed?.signedUrl || null
            }
          } catch {}
        }

        // ---- VALIDADO ----
        let validated = null
        try {
          const { data: files } = await supabase
            .storage
            .from('validaciones')
            .list('', { limit: 100, sortBy: { column: 'name', order: 'asc' } })
          const hit = (files || []).find(f => f.name.includes(String(a.id)))
          if (hit) {
            const { data: signedVal } = await supabase
              .storage
              .from('validaciones')
              .createSignedUrl(hit.name, 60 * 60)
            validated = { file: hit.name, url: signedVal?.signedUrl || null }
          }
        } catch {}

        return { ...a, plan, validated }
      })
    )

    setAuditorias(merged)
    setSelectedId(prev => prev ?? merged?.[0]?.id ?? null)
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

    const selected = useMemo(
        () => auditorias.find(a => a.id === selectedId) || null,
        [auditorias, selectedId]
    )

    const timeline = useMemo(() => {
        if (!selected?.fecha_auditoria) return []
        const hoy = startOfDay(new Date())
        const fa = parseYMD(selected.fecha_auditoria)
        if (!fa) return []

        // Reglas:
        const planDate = addDays(fa, -5)
        const informeLimit = addDays(fa, 10)
        const soportesLimit = addDays(fa, 20) // 10 d después de entregar (asumimos entrega al día 10)
        const pmLimit = addDays(fa, 20)       // idem

        const isFilled =
            Boolean(selected.objetivo?.trim()) &&
            Boolean(selected.criterios?.trim()) &&
            Boolean(selected.conclusiones?.trim()) &&
            Boolean(selected.recomendaciones?.trim())

        const hasValidated = Boolean(selected.validated?.url)

        return [
            {
                key: 'plan',
                title: 'Plan de auditoría',
                when: planDate,
                days: diffInDays(hoy, planDate),
                explicitDone: Boolean(selected.plan?.enviado_at),  // ✅ completado si existe plan
                autoDone: hoy >= fa, // opcional, puedes quitar esto si solo quieres depender del archivo
                subtitle: selected.plan?.enviado_at
                    ? `Enviado el ${fmt(new Date(selected.plan.enviado_at))}`
                    : 'Programar y enviar (5 días antes).',
                actions: selected.plan?.url
                    ? [
                        { label: 'Ver plan enviado', href: selected.plan.url }                    ]
                    : [
                        { label: 'Subir plan de auditoría', onClick: () => setPlanModalOpen(true) }
                    ]
            }
            ,
            {
                key: 'informe-llenar',
                title: 'Informe de auditoría — Llenar',
                when: informeLimit,
                days: diffInDays(hoy, informeLimit),
                explicitDone: isFilled,
                subtitle: 'Completar objetivo, criterios, conclusiones y recomendaciones (plazo +10 días).',
                actions:!hasValidated
                    ?[
                    {
                        label: isFilled ? 'Editar informe' : 'Llenar informe',
                        onClick: () => router.push(`/auditor?vista=asignadas`)
                    }
                ] : []
            },
            {
                key: 'informe-validar',
                title: 'Informe de auditoría — Validar',
                when: informeLimit,
                days: diffInDays(hoy, informeLimit),
                explicitDone: hasValidated,
                subtitle: 'Validación del informe (mismo plazo +10 días).',
                actions: hasValidated
                    ? [{ label: 'Descargar informe validado', href: selected.validated.url }]
                    : []
            },
            {
                key: 'soportes',
                title: 'Entrega de soportes',
                when: soportesLimit,
                days: diffInDays(hoy, soportesLimit),
                explicitDone: false,
                subtitle: 'Evidencias y anexos (10 días después de entregar el informe).',
                actions: []
            },
            {
                key: 'pm',
                title: 'Levantamiento del PM',
                when: pmLimit,
                days: diffInDays(hoy, pmLimit),
                explicitDone: false,
                subtitle: 'Plan de Mejoramiento (10 días después de entregar el informe).',
                actions: []
            }
        ]
    }, [selected, router])

    return (
        <div className={styles.wrapper}>
            <aside className={styles.sidebar}>
                <div className={styles.sidebarHeader}>
                    <h3>Auditorías asignadas</h3>
                    <button className={styles.refreshBtn} onClick={loadData} title="Recargar">↻</button>
                </div>
                {loading && <div className={styles.skeletonList}>Cargando auditorías…</div>}
                {error && <div className={styles.errorBox}>⚠️ {error}</div>}
                {!loading && !error && auditorias.length === 0 && (
                    <div className={styles.emptyBox}>No tienes auditorías asignadas.</div>
                )}

                <ul className={styles.list}>
                    {auditorias.map(a => {
                        const fa = parseYMD(a.fecha_auditoria)
                        const label = fa ? fmt(fa) : 'Sin fecha'
                        return (
                            <li
                                key={a.id}
                                className={`${styles.item} ${selectedId === a.id ? styles.itemActive : ''}`}
                                onClick={() => setSelectedId(a.id)}
                                title={`Auditoría #${a.id}`}
                            >
                                <div className={styles.itemTop}>
                                    <span className={styles.itemDep}>
                                        {a.dependencias?.nombre || 'Dependencia'}
                                    </span>
                                    <span className={styles.itemId}>#{a.id}</span>
                                </div>
                                <div className={styles.itemBottom}>
                                    <span className={styles.itemDate}>📅 {label}</span>
                                    {a.validated?.url && <span className={styles.badgeMini}>Validado</span>}
                                </div>
                            </li>
                        )
                    })}
                </ul>
            </aside>

            <main className={styles.content}>
                {!selected && !loading && (
                    <div className={styles.placeholder}>
                        Selecciona una auditoría para ver su línea de tiempo.
                    </div>
                )}

                {selected && (
                    <div className={styles.timelineCard}>
                        <header className={styles.header}>
                            <div>
                                <h2 className={styles.title}>
                                    Auditoría #{selected.id}{' '}
                                    <span className={styles.depName}>
                                        — {selected.dependencias?.nombre || 'Dependencia'}
                                    </span>
                                </h2>
                                {selected.fecha_auditoria && (
                                    <div className={styles.meta}>
                                        Fecha de auditoría: <strong>{fmt(parseYMD(selected.fecha_auditoria))}</strong>
                                    </div>
                                )}
                            </div>
                        </header>

                        <ol className={styles.timeline}>
                            {timeline.map((step, idx) => {
                                const isLast = idx === timeline.length - 1
                                const badge = badgeFor(step.days, step.explicitDone)
                                return (
                                    <li key={step.key} className={styles.step}>
                                        <div className={styles.lineWrap}>
                                            <span className={`${styles.dot} ${step.explicitDone ? styles.dotOk : step.days < 0 ? styles.dotOverdue : styles.dotDefault}`} />
                                            {!isLast && <span className={styles.line} />}
                                        </div>
                                        <div className={styles.stepBody}>
                                            <div className={styles.stepHead}>
                                                <h3 className={styles.stepTitle}>{step.title}</h3>
                                                <span className={`${styles.badge} ${badge.cls}`}>{badge.label}</span>
                                            </div>
                                            <div className={styles.stepMeta}>
                                                Límite: <strong>{fmt(step.when)}</strong>
                                            </div>
                                            <p className={styles.stepSubtitle}>{step.subtitle}</p>
                                            {step.actions?.length > 0 && (
                                                <div className={styles.actions}>
                                                    {step.actions.map((act, i) =>
                                                        act.href ? (
                                                            <a key={i} href={act.href} target="_blank" rel="noopener noreferrer" className={`${styles.btn} ${styles.btnGhost}`}>
                                                                {act.label}
                                                            </a>
                                                        ) : (
                                                            <button key={i} onClick={act.onClick} className={styles.btn}>
                                                                {act.label}
                                                            </button>
                                                        )
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </li>
                                )
                            })}
                        </ol>

                        {/* Modal: Enviar/Reemplazar plan de auditoría */}
                        {planModalOpen && (
                            <div
                                className={styles.modalOverlay}
                                onClick={(e) => {
                                    if (e.target === e.currentTarget) { // cerrar al click fuera
                                        setPlanModalOpen(false)
                                        setPlanFile(null)
                                    }
                                }}
                            >
                                <div className={styles.modalContenido}>
                                    <button
                                        className={styles.modalCerrar}
                                        onClick={() => { setPlanModalOpen(false); setPlanFile(null); }}
                                        title="Cerrar"
                                        aria-label="Cerrar"
                                    >
                                        ✖
                                    </button>

                                    <h3 className={styles.modalTitulo}>
                                        {selected?.plan ? 'Reemplazar plan de auditoría' : 'Enviar plan de auditoría'}
                                    </h3>

                                    {selected?.plan?.url && (
                                        <a
                                            href={selected.plan.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className={styles.btnVerActual}
                                        >
                                            👀 Ver plan actual
                                        </a>
                                    )}

                                    <label htmlFor="planFile" className={styles.dropArea}>
                                        <input
                                            id="planFile"
                                            type="file"
                                            accept="application/pdf"
                                            className={styles.inputArchivo}
                                            onChange={(e) => setPlanFile(e.target.files?.[0] || null)}
                                        />
                                        {!planFile ? (
                                            <>
                                                <div className={styles.iconoSubida}>📎</div>
                                                <p className={styles.instrucciones}>
                                                    Arrastra el PDF aquí o haz clic para seleccionar<br />
                                                    <span className={styles.subtexto}>Solo PDF (máx. 2&nbsp;MB)</span>
                                                </p>
                                            </>
                                        ) : (
                                            <p className={styles.nombreArchivo}>✅ {planFile.name}</p>
                                        )}
                                    </label>

                                    <div className={styles.modalBotones}>
                                        <button
                                            onClick={subirPlanAuditoria}
                                            disabled={!planFile || uploadingPlan}
                                            className={styles.botonSubir}
                                        >
                                            {uploadingPlan ? 'Subiendo…' : (selected?.plan ? 'Reemplazar plan' : 'Enviar plan')}
                                        </button>
                                        <button
                                            onClick={() => { setPlanModalOpen(false); setPlanFile(null); }}
                                            className={styles.botonCancelar}
                                        >
                                            Cancelar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                    </div>
                )}
            </main>
        </div>
    )
}
