'use client'

import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import styles from '@/components/admin/auditoriasTimeline.module.css'
import { generarInformeAuditoria } from '@/components/auditor/Utilidades/generarInformeAuditoria.jsx'
import { toast } from 'react-toastify'

/* ---- utilidades fecha ---- */
function parseYMD(ymd) { if (!ymd) return null; const [y, m, d] = ymd.split('-').map(Number); if (!y || !m || !d) return null; return new Date(y, m - 1, d) }
function addDays(date, n) { const d = new Date(date.getFullYear(), date.getMonth(), date.getDate()); d.setDate(d.getDate() + n); return d }
function startOfDay(date) { return new Date(date.getFullYear(), date.getMonth(), date.getDate()) }
function diffInDays(from, to) { const ms = startOfDay(to) - startOfDay(from); return Math.round(ms / 86400000) }
function fmt(date) { try { return new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', year: 'numeric', month: 'short', day: '2-digit' }).format(date) } catch { return date.toLocaleDateString() } }
function badgeFor(daysLeft, explicitDone = false) {
  if (explicitDone) return { label: 'Completado', cls: styles.badgeOk }
  if (daysLeft < 0) return { label: `Vencido ${Math.abs(daysLeft)} d`, cls: styles.badgeOverdue }
  if (daysLeft === 0) return { label: 'Hoy', cls: styles.badgeToday }
  if (daysLeft <= 3) return { label: `En ${daysLeft} d`, cls: styles.badgeSoon }
  return { label: `Faltan ${daysLeft} d`, cls: styles.badgePending }
}

/* ---- helpers nombre de archivo ---- */
const toSlugUpper = (s = '') =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').toUpperCase()

const toYMD = (input) => {
  if (!input) return new Date().toISOString().slice(0, 10)
  const s = String(input)
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : new Date(input).toISOString().slice(0, 10)
}

const buildPlanPath = (a) => `PlanAuditoria_${a.id}_${toSlugUpper(a?.dependencias?.nombre || 'SIN_DEP')}_${toYMD(a?.fecha_auditoria)}.pdf`
const buildValidationPath = (a) => `Auditoria_${a.id}_${toSlugUpper(a?.dependencias?.nombre || 'SIN_DEPENDENCIA')}_${toYMD(a?.fecha_auditoria)}.pdf`

export default function AuditoriasVerificacionAdmin() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [auditorias, setAuditorias] = useState([])
  const [selectedId, setSelectedId] = useState(null)

  // toolbar filtros
  const [q, setQ] = useState('')
  const [depFilter, setDepFilter] = useState('')
  const [audFilter, setAudFilter] = useState('')
  const [anioFilter, setAnioFilter] = useState('')
  const [semFilter, setSemFilter] = useState('')
  const [estadoFilter, setEstadoFilter] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')

  // modal detalle
  const [showDetail, setShowDetail] = useState(false)

  // ====== NUEVO: Modal crear auditoría ======
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [nuevoInforme, setNuevoInforme] = useState({ dependencia_id: '', usuario_id: '', fecha_auditoria: '' })

  // listas para selects del modal crear
  const [dependenciasAll, setDependenciasAll] = useState([])
  const [auditoresAll, setAuditoresAll] = useState([])

  // helpers UI
  const openingRef = useRef(false)
  const openInNewTab = useCallback((url) => {
    if (!url || openingRef.current) return
    openingRef.current = true
    const a = document.createElement('a')
    a.href = url
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => { openingRef.current = false }, 300)
  }, [])

  // Descargar informe general (si NO hay validado)
  const handleDescargarInformeGeneral = async (a) => {
    try {
      const [fort, opor, noConfor] = await Promise.all([
        supabase.from('fortalezas').select(`*, iso:iso_id ( iso ), capitulo:capitulo_id ( capitulo ), numeral:numeral_id ( numeral )`).eq('informe_id', a.id),
        supabase.from('oportunidades_mejora').select(`*, iso:iso_id ( iso ), capitulo:capitulo_id ( capitulo ), numeral:numeral_id ( numeral )`).eq('informe_id', a.id),
        supabase.from('no_conformidades').select(`*, iso:iso_id ( iso ), capitulo:capitulo_id ( capitulo ), numeral:numeral_id ( numeral )`).eq('informe_id', a.id),
      ])
      const usuarioLike = { nombre: a.usuarios?.nombre || 'ADMIN', apellido: a.usuarios?.apellido || '' }
      await generarInformeAuditoria(
        a,
        fort.data || [],
        opor.data || [],
        noConfor.data || [],
        usuarioLike
      )
    } catch (e) {
      console.error('No se pudo generar el informe general:', e)
      alert('No se pudo generar el informe general.')
    }
  }

  // Eliminar informe
  const eliminarInforme = async (id) => {
    const ok = window.confirm(`¿Eliminar la auditoría #${id}? Esta acción no se puede deshacer.`)
    if (!ok) return
    try {
      const res = await fetch('/api/informes', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
      if (res.ok) {
        setAuditorias(prev => prev.filter(x => x.id !== id))
        if (selectedId === id) {
          const resto = auditorias.filter(x => x.id !== id)
          setSelectedId(resto[0]?.id || null)
        }
      } else {
        const data = await res.json().catch(() => null)
        alert('Error al eliminar: ' + (data?.error || 'desconocido'))
      }
    } catch (e) {
      console.error(e)
      alert('Error inesperado al eliminar')
    }
  }

  // Cargar data principal
  const loadData = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const { data, error } = await supabase
        .from('informes_auditoria')
        .select(`
          id, fecha_auditoria, fecha_seguimiento,
          objetivo, criterios, conclusiones, recomendaciones,
          asistencia_tipo, usuario_id, dependencia_id,
          dependencias:dependencias ( nombre ),
          usuarios:usuario_id ( nombre, apellido ),
          plan_informe:planes_auditoria_informe ( archivo_path, enviado_at ),
          fortalezas ( id ),
          oportunidades_mejora ( id ),
          no_conformidades ( id )
        `)
        .order('fecha_auditoria', { ascending: true })
      if (error) throw error

      const merged = await Promise.all(
        (data || []).map(async (a) => {
          // PLAN
          let plan = null
          const rec = a.plan_informe?.[0] || null
          if (rec?.archivo_path) {
            try {
              const { data: signed } = await supabase.storage.from('planes').createSignedUrl(rec.archivo_path, 3600)
              plan = { path: rec.archivo_path, enviado_at: rec.enviado_at, url: signed?.signedUrl || null }
            } catch { }
          } else {
            try {
              const guess = buildPlanPath(a)
              const { data: signedGuess } = await supabase.storage.from('planes').createSignedUrl(guess, 3600)
              if (signedGuess?.signedUrl) plan = { path: guess, enviado_at: null, url: signedGuess.signedUrl }
            } catch { }
          }
          // VALIDADO
          let validated = null
          try {
            const v = buildValidationPath(a)
            const { data: signedVal } = await supabase.storage.from('validaciones').createSignedUrl(v, 3600)
            if (signedVal?.signedUrl) validated = { file: v, url: signedVal.signedUrl }
          } catch { }
          // Conteos de hallazgos
          const fCount = a.fortalezas?.length || 0
          const omCount = a.oportunidades_mejora?.length || 0
          const ncCount = a.no_conformidades?.length || 0
          return { ...a, plan, validated, fCount, omCount, ncCount }
        })
      )

      setAuditorias(merged)
      setSelectedId(prev => prev ?? merged?.[0]?.id ?? null)
    } catch (e) {
      console.error(e); setError(e.message || 'Error cargando auditorías')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Cargar listas para crear (dependencias y auditores)
  useEffect(() => {
    ; (async () => {
      try {
        const [{ data: deps }, { data: auds }] = await Promise.all([
          supabase.from('dependencias').select('dependencia_id, nombre').order('nombre', { ascending: true }),
          supabase.from('usuarios').select('usuario_id, nombre, apellido, rol')
            .or('rol.eq.auditor,rol.eq.AUDITOR') // tolerante a mayúsculas
            .order('nombre', { ascending: true }),
        ])
        setDependenciasAll(deps || [])
        setAuditoresAll((auds || []).map(u => ({ ...u, etiqueta: `${u.nombre || ''} ${u.apellido || ''}`.trim() })))
      } catch (e) {
        console.warn('No se pudieron cargar listas para crear:', e)
        // fallback básico con lo ya cargado
        const depsFallback = Array.from(new Map(
          auditorias.map(a => [a.dependencia_id, a.dependencias?.nombre]).filter(([id, n]) => id && n)
        ), ([dependencia_id, nombre]) => ({ dependencia_id, nombre }))
        setDependenciasAll(depsFallback)
        const audsFallback = Array.from(new Map(
          auditorias.map(a => [a.usuario_id, `${a.usuarios?.nombre || ''} ${a.usuarios?.apellido || ''}`.trim()]).filter(([id, n]) => id && n)
        ), ([usuario_id, etiqueta]) => ({ usuario_id, etiqueta }))
        setAuditoresAll(audsFallback)
      }
    })()
  }, [auditorias])

  /* colecciones para filtros (derivadas) */
  const dependencias = useMemo(() => {
    const map = new Map()
    auditorias.forEach(a => { if (a.dependencia_id && a.dependencias?.nombre) map.set(a.dependencia_id, a.dependencias.nombre) })
    return Array.from(map, ([id, nombre]) => ({ id, nombre })).sort((x, y) => x.nombre.localeCompare(y.nombre))
  }, [auditorias])
  const auditores = useMemo(() => {
    const map = new Map()
    auditorias.forEach(a => { if (a.usuario_id && (a.usuarios?.nombre || a.usuarios?.apellido)) map.set(a.usuario_id, `${a.usuarios?.nombre || ''} ${a.usuarios?.apellido || ''}`.trim()) })
    return Array.from(map, ([id, nombre]) => ({ id, nombre })).sort((x, y) => x.nombre.localeCompare(y.nombre))
  }, [auditorias])
  const anios = useMemo(() => {
    const s = new Set(); auditorias.forEach(a => { const y = a.fecha_auditoria ? new Date(a.fecha_auditoria).getFullYear() : null; if (y) s.add(y) })
    return Array.from(s).sort((a, b) => a - b)
  }, [auditorias])

  /* flags por fila */
  const computeFlags = (a) => {
    const fa = a.fecha_auditoria ? parseYMD(a.fecha_auditoria) : null
    const hoy = startOfDay(new Date())
    const planDate = fa ? addDays(fa, -5) : null
    const informeLimit = fa ? addDays(fa, 10) : null
    const soportesLimit = fa ? addDays(fa, 20) : null
    const pmLimit = fa ? addDays(fa, 20) : null

    const isFilled = Boolean(a.objetivo?.trim()) && Boolean(a.criterios?.trim()) && Boolean(a.conclusiones?.trim()) && Boolean(a.recomendaciones?.trim())
    return {
      tienePlan: Boolean(a.plan?.url || a.plan?.enviado_at),
      planDays: planDate ? diffInDays(hoy, planDate) : null,
      informeDays: informeLimit ? diffInDays(hoy, informeLimit) : null,
      soportesDays: soportesLimit ? diffInDays(hoy, soportesLimit) : null,
      pmDays: pmLimit ? diffInDays(hoy, pmLimit) : null,
      informeCompleto: isFilled,
      validado: Boolean(a.validated?.url),
    }
  }

  /* filtrar */
  const filtradas = useMemo(() => auditorias.filter(a => {
    const fa = a.fecha_auditoria ? parseYMD(a.fecha_auditoria) : null
    const flags = computeFlags(a)
    const qok = !q ||
      (a.dependencias?.nombre?.toLowerCase().includes(q.toLowerCase())) ||
      (`${a.usuarios?.nombre || ''} ${a.usuarios?.apellido || ''}`.toLowerCase().includes(q.toLowerCase())) ||
      (String(a.id).includes(q))
    if (!qok) return false
    if (depFilter && Number(depFilter) !== a.dependencia_id) return false
    if (audFilter && Number(audFilter) !== a.usuario_id) return false
    if (anioFilter) { const y = fa ? fa.getFullYear() : null; if (String(y) !== String(anioFilter)) return false }
    if (semFilter) { const m = fa ? (fa.getMonth() + 1) : null; const sem = m ? (m <= 6 ? '1' : '2') : null; if (sem !== semFilter) return false }
    if (desde && fa && fa < parseYMD(desde)) return false
    if (hasta && fa && fa > parseYMD(hasta)) return false
    switch (estadoFilter) {
      case 'plan_pendiente': if (flags.tienePlan) return false; break
      case 'plan_enviado': if (!flags.tienePlan) return false; break
      case 'informe_pendiente': if (flags.informeCompleto) return false; break
      case 'informe_completo': if (!flags.informeCompleto) return false; break
      case 'validado': if (!flags.validado) return false; break
      default: break
    }
    return true
  }), [auditorias, q, depFilter, audFilter, anioFilter, semFilter, estadoFilter, desde, hasta])

  // mantener selección coherente
  useEffect(() => {
    if (!selectedId && filtradas.length) setSelectedId(filtradas[0].id)
    if (selectedId && !filtradas.some(a => a.id === selectedId)) setSelectedId(filtradas[0]?.id ?? null)
  }, [filtradas, selectedId])

  const selected = useMemo(() => auditorias.find(a => a.id === selectedId) || null, [auditorias, selectedId])

  /* timeline (con acciones por etapa) */
  const timeline = useMemo(() => {
    if (!selected?.fecha_auditoria) return []
    const hoy = startOfDay(new Date())
    const fa = parseYMD(selected.fecha_auditoria); if (!fa) return []
    const planDate = addDays(fa, -5)
    const informeLimit = addDays(fa, 10)
    const soportesLimit = addDays(fa, 20)
    const pmLimit = addDays(fa, 20)

    const isFilled = Boolean(selected.objetivo?.trim()) && Boolean(selected.criterios?.trim()) && Boolean(selected.conclusiones?.trim()) && Boolean(selected.recomendaciones?.trim())
    const hasValidated = Boolean(selected.validated?.url)

    return [
      {
        key: 'plan',
        title: 'Plan de auditoría',
        when: planDate,
        days: diffInDays(hoy, planDate),
        explicitDone: Boolean(selected.plan?.url || selected.plan?.enviado_at),
        subtitle: selected.plan?.enviado_at ? `Enviado el ${fmt(new Date(selected.plan.enviado_at))}` : 'Programar y enviar (5 días antes).',
        actions: selected.plan?.url ? [
          { label: 'Ver plan', onClick: () => openInNewTab(selected.plan.url), ghost: true }
        ] : []
      },
      {
        key: 'informe-llenar',
        title: 'Informe de auditoría — Llenar',
        when: informeLimit,
        days: diffInDays(hoy, informeLimit),
        explicitDone: isFilled,
        subtitle: 'Completar objetivo, criterios, conclusiones y recomendaciones (plazo +10 días).',
        actions: (!hasValidated && isFilled) ? [
          { label: 'Descargar informe general', onClick: () => handleDescargarInformeGeneral(selected) }
        ] : []
      },
      {
        key: 'informe-validar',
        title: 'Informe de auditoría — Validar',
        when: informeLimit,
        days: diffInDays(hoy, informeLimit),
        explicitDone: hasValidated,
        subtitle: 'Validación del informe (plazo +10 días).',
        actions: hasValidated ? [
          { label: 'Descargar informe validado', onClick: () => openInNewTab(selected.validated.url) }
        ] : []
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
  }, [selected])

  /* KPIs */
  const kpis = useMemo(() => {
    const t = { total: auditorias.length, plan: 0, informe: 0, val: 0 }
    auditorias.forEach(a => {
      if (a.plan?.url || a.plan?.enviado_at) t.plan++
      const filled = Boolean(a.objetivo?.trim()) && Boolean(a.criterios?.trim()) && Boolean(a.conclusiones?.trim()) && Boolean(a.recomendaciones?.trim())
      if (filled) t.informe++
      if (a.validated?.url) t.val++
    })
    return t
  }, [auditorias])

  // ====== handlers modal crear ======
  const handleChangeNuevo = (e) => {
    const { name, value } = e.target
    setNuevoInforme(prev => ({ ...prev, [name]: value }))
  }

  const crearInforme = async () => {
    // ✅ Validación en cliente
    if (!nuevoInforme.usuario_id || !nuevoInforme.dependencia_id || !nuevoInforme.fecha_auditoria) {
      toast.error('Por favor seleccione auditor, dependencia y fecha de auditoría');
      return;
    }

    setCreating(true)
    try {
      const res = await fetch('/api/informes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuario_id: Number(nuevoInforme.usuario_id),
          dependencia_id: Number(nuevoInforme.dependencia_id),
          fecha_auditoria: toYMD(nuevoInforme.fecha_auditoria),
        })
      })

      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error || 'No se pudo crear el informe')
      }

      const creado = await res.json()
      const item = (Array.isArray(creado) ? creado[0] : creado) || null

      // refresca y selecciona el creado
      await loadData()
      if (item?.id) setSelectedId(item.id)

      // reset modal
      setNuevoInforme({ dependencia_id: '', usuario_id: '', fecha_auditoria: '' })
      setShowCreate(false)

      // ✅ Éxito
      toast.success('Auditoría creada con éxito')
    } catch (e) {
      console.error(e)
      toast.error(e.message || 'Error al crear informe')
    } finally {
      setCreating(false)
    }
  }


  return (
    <div className={styles.wrapper}>
      {/* TOOLBAR SUPERIOR */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarTop}>
          <h3 className={styles.toolbarTitle}>Panel de verificación (Admin)</h3>
          <button className={styles.refreshBtn} onClick={loadData} title="Recargar">↻</button>
        </div>

        <div className={styles.toolbarGrid}>
          <input className={`${styles.inputBase} ${styles.toolbarSearch}`} placeholder="Buscar (dependencia, auditor, ID)" value={q} onChange={e => setQ(e.target.value)} />
          <select className={styles.inputBase} value={depFilter} onChange={e => setDepFilter(e.target.value)}>
            <option value="">Todas las dependencias</option>
            {dependencias.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
          </select>
          <select className={styles.inputBase} value={audFilter} onChange={e => setAudFilter(e.target.value)}>
            <option value="">Todos los auditores</option>
            {auditores.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </select>
          <select className={styles.inputBase} value={anioFilter} onChange={e => setAnioFilter(e.target.value)}>
            <option value="">Todos los años</option>
            {anios.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select className={styles.inputBase} value={semFilter} onChange={e => setSemFilter(e.target.value)}>
            <option value="">Semestre</option>
            <option value="1">1</option><option value="2">2</option>
          </select>
          <select className={styles.inputBase} value={estadoFilter} onChange={e => setEstadoFilter(e.target.value)}>
            <option value="">Todos los estados</option>
            <option value="plan_pendiente">Plan pendiente</option>
            <option value="plan_enviado">Plan enviado</option>
            <option value="informe_pendiente">Informe pendiente</option>
            <option value="informe_completo">Informe completo</option>
            <option value="validado">Validado</option>
          </select>
          <input className={styles.inputBase} type="date" value={desde} onChange={e => setDesde(e.target.value)} />
        </div>

        <div className={styles.kpisBar}>
          <span className={styles.kpiChip}>Total: <strong>{kpis.total}</strong></span>
          <span className={styles.kpiChip}>Plan: <strong>{kpis.plan}</strong></span>
          <span className={styles.kpiChip}>Informe OK: <strong>{kpis.informe}</strong></span>
          <span className={styles.kpiChip}>Validados: <strong>{kpis.val}</strong></span>
        </div>
      </div>

      {/* LISTA IZQUIERDA */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}><h3>Auditorías</h3></div>
        {loading && <div className={styles.skeletonList}>Cargando auditorías…</div>}
        {error && <div className={styles.errorBox}>⚠️ {error}</div>}
        {!loading && !error && filtradas.length === 0 && <div className={styles.emptyBox}>Sin resultados.</div>}
        <ul className={styles.list}>
          {filtradas.map(a => {
            const fa = parseYMD(a.fecha_auditoria); const label = fa ? fmt(fa) : 'Sin fecha'
            return (
              <li key={a.id} className={`${styles.item} ${selectedId === a.id ? styles.itemActive : ''}`} onClick={() => setSelectedId(a.id)} title={`Auditoría #${a.id}`}>
                <div className={styles.itemTop}>
                  <span className={styles.itemDep}>{a.dependencias?.nombre || 'Dependencia'}</span>
                  <span className={styles.itemId}>#{a.id}</span>
                </div>
                <div className={styles.itemBottom}>
                  <span className={styles.itemDate}>📅 {label}</span>
                  {a.usuarios && <span className={styles.badgeMini}>👤 {(a.usuarios?.nombre || '')} {(a.usuarios?.apellido || '')}</span>}
                  {a.plan?.url && <span className={styles.badgeMini}>Plan</span>}
                  {a.validated?.url && <span className={styles.badgeMini}>Validado</span>}
                </div>
              </li>
            )
          })}


        </ul>
        {/* ====== TILE "Crear auditoría" ====== */}
        <li className={styles.itemAdd} onClick={() => setShowCreate(true)} title="Crear nueva auditoría">
          <div className={styles.addIcon}>+</div>
          <div className={styles.addText}>Nueva auditoría</div>
        </li>
      </aside>

      {/* CONTENIDO DERECHA */}
      <main className={styles.content}>
        {!selected && !loading && <div className={styles.placeholder}>Selecciona una auditoría para ver su línea de tiempo.</div>}

        {selected && (
          <div className={styles.timelineCard}>
            <header className={styles.header}>
              <div>
                <h2 className={styles.title}>
                  Auditoría #{selected.id}{' '}
                  <span className={styles.depName}>— {selected.dependencias?.nombre || 'Dependencia'}</span>
                </h2>
                <div className={styles.meta}>
                  {selected.usuarios && <>Auditor: <strong>{(selected.usuarios?.nombre || '')} {(selected.usuarios?.apellido || '')}</strong> · </>}
                  {selected.fecha_auditoria && <>Fecha: <strong>{fmt(parseYMD(selected.fecha_auditoria))}</strong></>}
                </div>
                {selected.asistencia_tipo && <div className={styles.meta}>Asistencia: <strong>{selected.asistencia_tipo}</strong></div>}
              </div>

              {/* === ACCIONES ENCABEZADO (derecha) === */}
              <div className={styles.headerActions}>
                <button className={`${styles.btn} ${styles.btnGhost}`} onClick={() => setShowDetail(true)} title="Ver más">
                  Ver más
                </button>
                <button className={`${styles.btn} ${styles.btnDanger}`} onClick={() => eliminarInforme(selected.id)} title="Eliminar auditoría">
                  Eliminar
                </button>
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
                      <div className={styles.stepMeta}>Límite: <strong>{fmt(step.when)}</strong></div>
                      <p className={styles.stepSubtitle}>{step.subtitle}</p>

                      {step.actions?.length > 0 && (
                        <div className={styles.actions}>
                          {step.actions.map((act, i) => (
                            <button
                              key={i}
                              className={`${styles.btn} ${act.ghost ? styles.btnGhost : ''}`}
                              onClick={(e) => { e.stopPropagation(); act.onClick?.(e) }}
                            >
                              {act.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </li>
                )
              })}
            </ol>
          </div>
        )}
      </main>

      {/* MODAL VER MÁS */}
      {showDetail && selected && (
        <div className={styles.modalOverlay} onClick={e => { if (e.target === e.currentTarget) setShowDetail(false) }}>
          <div className={styles.modalCard}>
            <button className={styles.modalClose} onClick={() => setShowDetail(false)} title="Cerrar">✖</button>

            <h3 className={styles.modalTitle}>Detalle de la Auditoría #{selected.id}</h3>

            <div className={styles.kpisBar2} style={{ marginTop: 10 }}>
              <span className={styles.kpiChip2}>💪 Fortalezas: <strong>{selected.fCount ?? 0}</strong></span>
              <span className={styles.kpiChip2}>📈 Oportunidades: <strong>{selected.omCount ?? 0}</strong></span>
              <span className={styles.kpiChip2}>🚫 No conformidades: <strong>{selected.ncCount ?? 0}</strong></span>
            </div>

            <div className={styles.detailGrid}>
              <div><strong>Dependencia:</strong> {selected.dependencias?.nombre || 'N/A'}</div>
              <div><strong>Auditor:</strong> {(selected.usuarios?.nombre || '')} {(selected.usuarios?.apellido || '')}</div>
              <div><strong>Fecha auditoría:</strong> {selected.fecha_auditoria || 'N/A'}</div>
              <div><strong>Asistencia:</strong> {selected.asistencia_tipo || 'N/A'}</div>
              <div className={styles.detailCol}><strong>Objetivo:</strong><br />{selected.objetivo || '—'}</div>
              <div className={styles.detailCol}><strong>Criterios:</strong><br />{selected.criterios || '—'}</div>
              <div className={styles.detailCol}><strong>Conclusiones:</strong><br />{selected.conclusiones || '—'}</div>
              <div className={styles.detailCol}><strong>Recomendaciones:</strong><br />{selected.recomendaciones || '—'}</div>
              <div><strong>Plan:</strong> {selected.plan?.url ? <a href={selected.plan.url} onClick={(e) => { e.preventDefault(); openInNewTab(selected.plan.url) }} className={styles.linkLike}>Abrir</a> : 'Sin plan'}</div>
              <div><strong>Informe validado:</strong> {selected.validated?.url ? <a href={selected.validated.url} onClick={(e) => { e.preventDefault(); openInNewTab(selected.validated.url) }} className={styles.linkLike}>Descargar</a> : 'No disponible'}</div>
            </div>
          </div>
        </div>
      )}

      {/* ====== MODAL CREAR AUDITORÍA ====== */}
      {showCreate && (
        <div className={styles.modalOverlay} onClick={(e) => { if (e.target === e.currentTarget) setShowCreate(false) }}>
          <div className={styles.modalCard}>
            <button className={styles.modalClose} onClick={() => setShowCreate(false)} title="Cerrar">✖</button>
            <h3 className={styles.modalTitle}>Nueva Auditoría</h3>

            <div className={styles.formRow}>
              <label className={styles.formLabel}>Dependencia</label>
              <select
                name="dependencia_id"
                value={nuevoInforme.dependencia_id}
                onChange={handleChangeNuevo}
                className={styles.inputBase}
              >
                <option value="">Seleccione una dependencia</option>
                {dependenciasAll.map(dep => (
                  <option key={dep.dependencia_id} value={dep.dependencia_id}>{dep.nombre}</option>
                ))}
              </select>
            </div>

            <div className={styles.formRow}>
              <label className={styles.formLabel}>Auditor responsable</label>
              <select
                name="usuario_id"
                value={nuevoInforme.usuario_id}
                onChange={handleChangeNuevo}
                className={styles.inputBase}
              >
                <option value="">Seleccione un auditor</option>
                {auditoresAll.map(a => (
                  <option key={a.usuario_id} value={a.usuario_id}>{a.etiqueta || `${a.nombre || ''} ${a.apellido || ''}`}</option>
                ))}
              </select>
            </div>

            <div className={styles.formRow}>
              <label className={styles.formLabel}>Fecha de auditoría</label>
              <input
                type="date"
                name="fecha_auditoria"
                value={nuevoInforme.fecha_auditoria}
                onChange={handleChangeNuevo}
                className={styles.inputBase}
              />
            </div>

            <div className={styles.formActions}>
              <button className={`${styles.btn} ${styles.btnGhost}`} onClick={() => setShowCreate(false)}>Cancelar</button>
              <button className={styles.btn} onClick={crearInforme} disabled={creating}>
                {creating ? 'Creando…' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
