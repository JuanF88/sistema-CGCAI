'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import styles from './auditoriasTimeline.module.css'
import { generarInformeAuditoria } from '@/components/auditor/Utilidades/generarInformeAuditoria.jsx'
import { generarPlanMejora } from '@/components/auditor/Utilidades/generarPlanMejora'

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
    if (daysLeft < 0) return { label: `Vencido hace ${Math.abs(daysLeft)} días`, cls: styles.badgeOverdue }
    if (daysLeft === 0) return { label: 'Hoy', cls: styles.badgeToday }
    if (daysLeft <= 3) return { label: `Quedan ${daysLeft} días`, cls: styles.badgeSoon }
    return { label: `Quedan ${daysLeft} días`, cls: styles.badgePending }
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

    const [validateModalOpen, setValidateModalOpen] = useState(false)
    const [validateFile, setValidateFile] = useState(null)
    const [uploadingValidation, setUploadingValidation] = useState(false)

    // ✅ helper: nombre consistente del archivo validado
    const buildValidationPath = (auditoria) => {
        const dep = toSlugUpper(auditoria?.dependencias?.nombre || 'SIN_DEPENDENCIA')
        const ymd = toYMD(auditoria?.fecha_auditoria)
        return `Auditoria_${auditoria.id}_${dep}_${ymd}.pdf`
    }

    // ✅ 2.1 Generar y descargar el informe (borrador/no validado)
    const handleDownloadInforme = async (informe) => {
        try {
            // Traer hallazgos con labels de ISO/capítulo/numeral (como ya haces en Asignadas)
            const [fort, opor, noConfor] = await Promise.all([
                supabase
                    .from('fortalezas')
                    .select(`*, iso:iso_id ( iso ), capitulo:capitulo_id ( capitulo ), numeral:numeral_id ( numeral )`)
                    .eq('informe_id', informe.id),
                supabase
                    .from('oportunidades_mejora')
                    .select(`*, iso:iso_id ( iso ), capitulo:capitulo_id ( capitulo ), numeral:numeral_id ( numeral )`)
                    .eq('informe_id', informe.id),
                supabase
                    .from('no_conformidades')
                    .select(`*, iso:iso_id ( iso ), capitulo:capitulo_id ( capitulo ), numeral:numeral_id ( numeral )`)
                    .eq('informe_id', informe.id),
            ])

            await generarInformeAuditoria(
                informe,
                fort.data || [],
                opor.data || [],
                noConfor.data || [],
                usuario
            )
        } catch (err) {
            console.error('Descargar informe (borrador) error:', err)
            alert('No se pudo generar/descargar el informe.')
        }
    }

    // ✅ 2.2 Subir PDF validado y marcar en BD
    const handleValidarInforme = async () => {
        if (!selected || !validateFile) return
        setUploadingValidation(true)
        try {
            const filePath = buildValidationPath(selected)

            // 1) subir al bucket 'validaciones'
            const { error: upErr } = await supabase
                .storage
                .from('validaciones')
                .upload(filePath, validateFile, {
                    upsert: true,
                    contentType: 'application/pdf',
                })
            if (upErr) throw upErr

            // 2) guardar registro en tabla (si la usas)
            await supabase
                .from('validaciones_informe')
                .insert([{ informe_id: selected.id, archivo_url: filePath }])

            // 3) marcar informe como validado
            await supabase
                .from('informes_auditoria')
                .update({ validado: true })
                .eq('id', selected.id)

            // 4) firmar URL para usarla de inmediato en la UI
            const { data: signedVal } = await supabase
                .storage
                .from('validaciones')
                .createSignedUrl(filePath, 60 * 60)

            // 5) refrescar estado local (para que el timeline cambie a "Validado")
            setAuditorias(prev => prev.map(a =>
                a.id === selected.id
                    ? { ...a, validated: { file: filePath, url: signedVal?.signedUrl || null } }
                    : a
            ))

            setValidateModalOpen(false)
            setValidateFile(null)
        } catch (err) {
            console.error('Validación error:', err)
            alert('No se pudo validar el informe.')
        } finally {
            setUploadingValidation(false)
        }
    }

    // ✅ 2.3 Generar y descargar el Plan de Mejora (solo OM y NC)
    const handleDownloadPM = async (informe) => {
        try {
            // Traer OM y NC con labels
            const [opor, noConfor] = await Promise.all([
                supabase
                    .from('oportunidades_mejora')
                    .select(`*, iso:iso_id ( iso ), capitulo:capitulo_id ( capitulo ), numeral:numeral_id ( numeral )`)
                    .eq('informe_id', informe.id),
                supabase
                    .from('no_conformidades')
                    .select(`*, iso:iso_id ( iso ), capitulo:capitulo_id ( capitulo ), numeral:numeral_id ( numeral )`)
                    .eq('informe_id', informe.id),
            ])

            const om = Array.isArray(opor.data) ? opor.data : []
            const nc = Array.isArray(noConfor.data) ? noConfor.data : []

            if (!om.length && !nc.length) {
                alert('Este informe no tiene Oportunidades de Mejora ni No Conformidades.')
                return
            }

            await generarPlanMejora(selected, om, nc, usuario, {
                templateUrl: '/plantillas/PlanMejora.xlsx',
                sheetName: 'Formulación Plan Mejora',
                startRow: 12,
                rowsPerItem: 2,
                pairsCount: 14,
                cols: { fuente: 'A', tipo: 'B', factor: 'C', descripcion: 'D' },
                writeMeta: true
            })

        } catch (err) {
            console.error('Descargar Plan de Mejora error:', err)
            alert('No se pudo generar/descargar el Plan de Mejora.')
        }
    }


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
    objetivo,
    criterios,
    conclusiones,
    fecha_auditoria,
    asistencia_tipo,
    fecha_seguimiento,
    recomendaciones,
    auditores_acompanantes,
    validado,
    dependencia_id,
    dependencias (
      nombre,
      plan_auditoria ( enlace )
    ),
    plan_informe:planes_auditoria_informe ( archivo_path, enviado_at ),
    fortalezas ( id ),
    oportunidades_mejora ( id ),
    no_conformidades ( id )
                `)
                .eq('usuario_id', usuario.usuario_id)
                .order('fecha_auditoria', { ascending: true })

            if (error) throw error

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
                        } catch { /* noop */ }
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
                    } catch { /* noop */ }

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

    // --- TIMELINE + DECORACIÓN DE ESTADOS ---
    const { steps: timeline, progressPct, currentStep, allDone } = useMemo(() => {
        if (!selected?.fecha_auditoria) {
            return { steps: [], progressPct: 0, currentStep: null, allDone: false }
        }
        const hoy = startOfDay(new Date())
        const fa = parseYMD(selected.fecha_auditoria)
        if (!fa) return { steps: [], progressPct: 0, currentStep: null, allDone: false }

        // Reglas de fechas (ajústalas si cambian):
        const planDate = addDays(fa, -5)
        const informeLimit = addDays(fa, 10)
        const soportesLimit = addDays(fa, 20) // 10 d después de entregar (asumimos entrega al día 10)
        const pmLimit = addDays(fa, 20)       // idem

        // Campos base completos:
        const isFilled =
            Boolean(selected.objetivo?.trim()) &&
            Boolean(selected.criterios?.trim()) &&
            Boolean(selected.conclusiones?.trim()) &&
            Boolean(selected.recomendaciones?.trim())

        // Hallazgos presentes:
        const hallCount =
            (selected.fortalezas?.length || 0) +
            (selected.oportunidades_mejora?.length || 0) +
            (selected.no_conformidades?.length || 0)
        const hasHallazgos = hallCount > 0

        // Validado (por URL firmada o flag en tabla):
        const hasValidated = Boolean(selected.validated?.url) || selected.validado === true

        // Mapea a tu escala 0/50/80/100 (por si lo quieres usar visualmente):
        const progreso =
            !isFilled ? 0 :
                (isFilled && !hasHallazgos) ? 50 :
                    (!hasValidated ? 80 : 100)

        // Base de pasos
        const base = [
            {
                key: 'plan',
                title: 'Plan de auditoría',
                when: planDate,
                days: diffInDays(hoy, planDate),
                explicitDone: Boolean(selected.plan?.enviado_at),
                subtitle: selected.plan?.enviado_at
                    ? `Enviado el ${fmt(new Date(selected.plan.enviado_at))}`
                    : 'Programar y enviar (5 días antes).',
                actions: selected.plan?.url
                    ? [{ label: 'Ver plan enviado', href: selected.plan.url , btnClass: styles.btn}]
                    : [{ label: 'Subir plan de auditoría', onClick: () => setPlanModalOpen(true), btnClass: styles.btnSubir }]
            },
            {
                key: 'informe-llenar',
                title: 'Informe de auditoría — Llenar',
                when: informeLimit,
                days: diffInDays(hoy, informeLimit),
                explicitDone: isFilled && hasHallazgos, // ✅ ahora requiere hallazgos
                subtitle: !isFilled
                    ? 'Completar objetivo, criterios, conclusiones y recomendaciones (plazo +10 días).'
                    : (!hasHallazgos
                        ? 'Campos listos. Asignar hallazgos.'
                        : 'Campos e hallazgos listos. Puedes validar.'),
                actions: !hasValidated
                    ? [
                        {
                            label: isFilled ? 'Editar informe' : 'Llenar informe',
                            onClick: () => router.push(`/auditor?vista=asignadas&informeId=${selected.id}`)
                        },
                        // ✅ NUEVO: descargar informe cuando ya está lleno (borrador/no validado)
                        ...(isFilled && hasHallazgos ? [{
                            label: '📄 Descargar Informe',
                            onClick: () => handleDownloadInforme(selected)
                        }] : [])
                    ]
                    : []
            },
            {
                key: 'informe-validar',
                title: 'Informe de auditoría — Validar',
                when: informeLimit,
                days: diffInDays(hoy, informeLimit),
                explicitDone: hasValidated,
                subtitle: 'Validación del informe (mismo plazo +10 días).',
                actions: hasValidated
                    ? [{ label: 'Ver informe validado', href: selected.validated.url, btnClass: styles.btnPrimary }] // <- NUEVO
                    : (isFilled && hasHallazgos ? [{
                        label: '✅ Validar Informe',
                        onClick: () => setValidateModalOpen(true),
                        btnClass: styles.btnSubir
                    }] : [])

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
                actions:
                    hasValidated
                        ? [{
                            label: '📥 Descargar Formato PM',
                            onClick: () => handleDownloadPM(selected)
                        }]
                        : []
            }
        ]

        // Índice del primer pendiente
        const firstPendingIdx = base.findIndex(s => !s.explicitDone)
        const allDone = firstPendingIdx === -1

        // Decorar cada paso con estado y clases
        const decorated = base.map((s, i) => {
            const overdue = !s.explicitDone && s.days < 0
            const soon = !s.explicitDone && s.days >= 0 && s.days <= 3
            const done = !!s.explicitDone

            let status = 'upcoming'
            if (done) status = 'done'
            else if (i === firstPendingIdx) status = overdue ? 'current-overdue' : (soon ? 'current-soon' : 'current')
            else if (i < firstPendingIdx && firstPendingIdx !== -1) status = 'past'
            else if (soon) status = 'soon'
            else if (overdue) status = 'overdue'

            const badge = badgeFor(s.days, s.explicitDone)

            // Clases visuales
            const dotClass =
                done ? styles.dotOkPulse
                    : status === 'current-overdue' ? styles.dotOverduePulse
                        : status === 'current-soon' ? styles.dotSoonPulse
                            : status === 'current' ? styles.dotPulse
                                : s.days < 0 ? styles.dotPast
                                    : ''

            const bodyGlow =
                status === 'current-overdue' ? styles.glowOverdue
                    : status.startsWith('current') ? styles.glowCurrent
                        : done ? styles.stepDone
                            : ''

            const lineClass = done ? styles.lineFilled : ''

            return { ...s, overdue, soon, done, status, badge, dotClass, bodyGlow, lineClass }
        })

        const progressPct = Math.round((decorated.filter(s => s.done).length / decorated.length) * 100)
        const currentStep = decorated.find(s => s.status.startsWith('current')) || null

        return { steps: decorated, progressPct, currentStep, allDone }
    }, [selected, router])
    const planEnlace = selected?.dependencias?.plan_auditoria?.[0]?.enlace || ''

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
                        {/* Resumen superior: progreso + CTA de la etapa actual */}
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

                            <div className={styles.summaryBox} aria-live="polite">
                                <div className={styles.progressRow}>
                                    <div className={styles.planSlot}>
                                        {planEnlace ? (
                                            <a
                                                href={planEnlace}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className={`${styles.btnIr} ${styles.btnIr} ${styles.btnIr}`}
                                                title="Abrir plan de auditoría"
                                            >
                                                🗂️ Plan de mejora
                                            </a>
                                        ) : (
                                            // placeholder invisible para mantener el ancho reservado
                                            <span className={`${styles.btnPlanInline} ${styles.btnPlaceholder}`} aria-hidden="true" />
                                        )}
                                    </div>

                                    <div className={styles.progressWrap} title={`Progreso: ${progressPct}%`}>
                                        <div className={styles.progressBar} style={{ width: `${progressPct}%` }} />
                                    </div>
                                </div>


                                <div className={styles.progressMeta}>
                                    <span><strong>{progressPct}%</strong> completado</span>
                                    {currentStep ? (
                                        <span className={styles.nextHint}></span>
                                    ) : (
                                        <span className={styles.nextHint}>
                                            {allDone ? '¡Todo completado! 🎉' : 'Sin etapa actual.'}
                                        </span>
                                    )}
                                </div>

                                {currentStep?.actions?.length > 0 && (
                                    <div className={styles.summaryActions}>
                                        {currentStep.actions.map((act, i) =>
                                            act.href ? (
                                                <a
                                                    key={i}
                                                    href={act.href}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className={`${styles.btn} ${styles.btnPrimary}`}
                                                >
                                                    {act.label}
                                                </a>
                                            ) : []
                                        )}
                                    </div>
                                )}
                            </div>

                        </header>

                        {/* Leyenda rápida (opcional) */}
                        <div className={styles.legend}>
                            <span><span className={`${styles.legendDot} ${styles.legendNow}`} /> Actual</span>
                            <span><span className={`${styles.legendDot} ${styles.legendSoon}`} /> Próxima (&le;3d)</span>
                            <span><span className={`${styles.legendDot} ${styles.legendOverdue}`} /> Vencida</span>
                            <span><span className={`${styles.legendDot} ${styles.legendDone}`} /> Completada</span>
                        </div>

                        <ol className={styles.timeline}>
                            {timeline.map((step, idx) => {
                                const isLast = idx === timeline.length - 1
                                return (
                                    <li
                                        key={step.key}
                                        className={`${styles.step} ${step.status.startsWith('current') ? styles.stepCurrent : ''}`}
                                        aria-current={step.status.startsWith('current') ? 'step' : undefined}
                                    >
                                        <div className={styles.lineWrap}>
                                            <span className={`${styles.dot} ${step.dotClass || ''}`} />
                                            {!isLast && <span className={`${styles.line} ${step.lineClass}`} />}
                                        </div>

                                        <div className={`${styles.stepBody} ${step.bodyGlow}`}>
                                            <div className={styles.stepHead}>
                                                <h3 className={styles.stepTitle}>
                                                    {step.title}
                                                    {step.status.startsWith('current') && <span className={styles.tagNow}>AHORA</span>}
                                                    {!step.done && step.overdue && <span className={styles.tagOverdue}>VENCIDO</span>}
                                                    {step.done && <span className={styles.tagDone}>✓</span>}
                                                </h3>
                                                <span className={`${styles.badge} ${step.badge.cls}`}>{step.badge.label}</span>
                                            </div>

                                            <div className={styles.stepMeta}>
                                                Límite: <strong>{fmt(step.when)}</strong>
                                            </div>
                                            <p className={styles.stepSubtitle}>{step.subtitle}</p>

                                            {step.actions?.length > 0 && (
                                                <div className={styles.actions}>
                                                    {step.actions.map((act, i) =>
                                                        act.href ? (
                                                            <a
                                                                key={i}
                                                                href={act.href}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className={`${styles.btn} ${act.btnClass ?? (step.status.startsWith('current') ? styles.btnPrimary : styles.btnGhost)}`}
                                                            >
                                                                {act.label}
                                                            </a>
                                                        ) : (
                                                            <button
                                                                key={i}
                                                                onClick={act.onClick}
                                                                className={`${styles.btn} ${act.btnClass || (step.status.startsWith('current') ? styles.btnSubir : '')}`}
                                                            >
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
                                    if (e.target === e.currentTarget) {
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
                        {/* ✅ Modal: Validar informe (subir PDF firmado) */}
                        {validateModalOpen && (
                            <div
                                className={styles.modalOverlay}
                                onClick={(e) => {
                                    if (e.target === e.currentTarget) {
                                        setValidateModalOpen(false)
                                        setValidateFile(null)
                                    }
                                }}
                            >
                                <div className={styles.modalContenido}>
                                    <button
                                        className={styles.modalCerrar}
                                        onClick={() => { setValidateModalOpen(false); setValidateFile(null); }}
                                        title="Cerrar"
                                        aria-label="Cerrar"
                                    >
                                        ✖
                                    </button>

                                    <h3 className={styles.modalTitulo}>Validar informe — Subir PDF firmado</h3>

                                    <label htmlFor="validateFile" className={styles.dropArea}>
                                        <input
                                            id="validateFile"
                                            type="file"
                                            accept="application/pdf"
                                            className={styles.inputArchivo}
                                            onChange={(e) => {
                                                const file = e.target.files?.[0] || null
                                                if (file && file.size > 1 * 1024 * 1024) { // 1MB como en tu otra vista
                                                    alert('El archivo supera el tamaño máximo de 1MB.')
                                                    e.target.value = null
                                                    return
                                                }
                                                setValidateFile(file)
                                            }}
                                        />
                                        {!validateFile ? (
                                            <>
                                                <div className={styles.iconoSubida}>📎</div>
                                                <p className={styles.instrucciones}>
                                                    Arrastra el PDF aquí o haz clic para seleccionar<br />
                                                    <span className={styles.subtexto}>Solo PDF (máx. 1&nbsp;MB)</span>
                                                </p>
                                            </>
                                        ) : (
                                            <p className={styles.nombreArchivo}>✅ {validateFile.name}</p>
                                        )}
                                    </label>

                                    <div className={styles.modalBotones}>
                                        <button
                                            onClick={handleValidarInforme}
                                            disabled={!validateFile || uploadingValidation}
                                            className={styles.botonSubir}
                                        >
                                            {uploadingValidation ? 'Subiendo…' : 'Subir y Validar'}
                                        </button>
                                        <button
                                            onClick={() => { setValidateModalOpen(false); setValidateFile(null); }}
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
