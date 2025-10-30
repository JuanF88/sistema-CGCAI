'use client'

import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import styles from '@/components/admin/CSS/auditoriasTimeline.module.css'
import { generarInformeAuditoria } from '@/components/auditor/Utilidades/generarInformeAuditoria.jsx'
import { generarPlanMejora2 } from '@/components/auditor/Utilidades/generarPlanMejora2.xpp'
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
const buildAsistenciaPath = (a) => `Asistencia_${a.id}_${toSlugUpper(a?.dependencias?.nombre || 'SIN_DEP')}_${toYMD(a?.fecha_auditoria)}.pdf`
const buildEvaluacionPath = (a) => `Evaluacion_${a.id}_${toSlugUpper(a?.dependencias?.nombre || 'SIN_DEP')}_${toYMD(a?.fecha_auditoria)}.pdf`
const buildActaPath = (a) => `Acta_${a.id}_${toSlugUpper(a?.dependencias?.nombre || 'SIN_DEP')}_${toYMD(a?.fecha_auditoria)}.pdf`
// ✅ NUEVO: ruta para Acta de Compromiso
const buildActaCompromisoPath = (a) => `ActaCompromiso_${a.id}_${toSlugUpper(a?.dependencias?.nombre || 'SIN_DEP')}_${toYMD(a?.fecha_auditoria)}.pdf`


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

  // checks rápidos (nuevos)
  const [onlyAsistencia, setOnlyAsistencia] = useState(false)
  const [onlyEvaluacion, setOnlyEvaluacion] = useState(false)
  const [onlyActa, setOnlyActa] = useState(false)
// ✅ NUEVO check rápido
  const [onlyActaComp, setOnlyActaComp] = useState(false)

  // modal detalle
  const [showDetail, setShowDetail] = useState(false)
  const [setInformes] = useState([])

  // ✅ NUEVOS estados: modal/archivo/subida Acta de Compromiso
  const [actaCompModalOpen, setActaCompModalOpen] = useState(false)
  const [actaCompFile, setActaCompFile] = useState(null)
  const [uploadingActaComp, setUploadingActaComp] = useState(false)

  const eliminarInforme = async (id) => {
    try {
      const res = await fetch('/api/informes', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })

      if (res.ok) {
        setInformes(prev => prev.filter(inf => inf.id !== id))
        toast.success('Informe eliminado correctamente')
      } else {
        const error = await res.json()
        toast.error('Error al eliminar: ' + (error?.error || 'desconocido'))
      }
    } catch (err) {
      console.error('Error al eliminar:', err)
      toast.error('Error inesperado al eliminar informe')
    }
    await loadData()
  }
  // ====== MODAL crear auditoría ======
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [nuevoInforme, setNuevoInforme] = useState({ dependencia_id: '', usuario_id: '', fecha_auditoria: '' })

  // listas para selects del modal crear
  const [dependenciasAll, setDependenciasAll] = useState([])
  const [auditoresAll, setAuditoresAll] = useState([])

  // ====== MODALES Y ESTADOS DE SUBIDAS (con mismas clases que el auditor) ======
  const [planModalOpen, setPlanModalOpen] = useState(false)
  const [planFile, setPlanFile] = useState(null)
  const [uploadingPlan, setUploadingPlan] = useState(false)

  const [asistenciaModalOpen, setAsistenciaModalOpen] = useState(false)
  const [asistenciaFile, setAsistenciaFile] = useState(null)
  const [uploadingAsistencia, setUploadingAsistencia] = useState(false)

  const [evaluacionModalOpen, setEvaluacionModalOpen] = useState(false)
  const [evaluacionFile, setEvaluacionFile] = useState(null)
  const [uploadingEvaluacion, setUploadingEvaluacion] = useState(false)

  const [actaModalOpen, setActaModalOpen] = useState(false)
  const [actaFile, setActaFile] = useState(null)
  const [uploadingActa, setUploadingActa] = useState(false)

  const [validateModalOpen, setValidateModalOpen] = useState(false)
  const [validateFile, setValidateFile] = useState(null)
  const [uploadingValidation, setUploadingValidation] = useState(false)

  const [editingDate, setEditingDate] = useState(false)
  const [dateDraft, setDateDraft] = useState('')     // 'YYYY-MM-DD'
  const [savingDate, setSavingDate] = useState(false)
  const selected = useMemo(() => auditorias.find(a => a.id === selectedId) || null, [auditorias, selectedId])
  const isAuditValidated = (a) => Boolean(a?.validated?.url) || a?.validado === true

const beginEditFecha = useCallback(() => {
  const sel = auditorias.find(a => a.id === selectedId)
  if (!sel) return
  if (isAuditValidated(sel)) {
    toast.info('Esta auditoría ya está validada; no puedes cambiar la fecha.')
    return
  }
  setDateDraft(toYMD(sel.fecha_auditoria))
  setEditingDate(true)
}, [auditorias, selectedId])

const cancelEditFecha = useCallback(() => {
  setEditingDate(false)
  setDateDraft('')
}, [])

const saveFechaAuditoria = useCallback(async () => {
  const sel = auditorias.find(a => a.id === selectedId)
  if (!sel || !dateDraft) return
  if (isAuditValidated(sel)) {
    toast.warning('No se puede actualizar la fecha de una auditoría validada.')
    setEditingDate(false)
    return
  }

  const ymd = toYMD(dateDraft)
  setSavingDate(true)
  try {
    const { error: upErr } = await supabase
      .from('informes_auditoria')
      .update({ fecha_auditoria: ymd })
      .eq('id', sel.id)
    if (upErr) throw upErr

    setAuditorias(prev => prev.map(a => a.id === sel.id ? { ...a, fecha_auditoria: ymd } : a))
    toast.success('Fecha de auditoría actualizada.')
    setEditingDate(false)
  } catch (e) {
    console.error('Actualizar fecha error:', e)
    toast.error('No se pudo actualizar la fecha.')
  } finally {
    setSavingDate(false)
  }
}, [auditorias, selectedId, dateDraft])

const handleDateKeyDown = useCallback((e) => {
  if (e.key === 'Enter') { e.preventDefault(); saveFechaAuditoria() }
  if (e.key === 'Escape') { e.preventDefault(); cancelEditFecha() }
}, [saveFechaAuditoria, cancelEditFecha])

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

  // ====== DESCARGAS / VALIDACIÓN / PM ======
  const handleDescargarInforme = async (a) => {
    try {
      const [fort, opor, noConfor] = await Promise.all([
        supabase.from('fortalezas').select(`*, iso:iso_id ( iso ), capitulo:capitulo_id ( capitulo ), numeral:numeral_id ( numeral )`).eq('informe_id', a.id),
        supabase.from('oportunidades_mejora').select(`*, iso:iso_id ( iso ), capitulo:capitulo_id ( capitulo ), numeral:numeral_id ( numeral )`).eq('informe_id', a.id),
        supabase.from('no_conformidades').select(`*, iso:iso_id ( iso ), capitulo:capitulo_id ( capitulo ), numeral:numeral_id ( numeral )`).eq('informe_id', a.id),
      ])
      const usuarioLike = { nombre: a.usuarios?.nombre || 'ADMIN', apellido: a.usuarios?.apellido || '' }
      await generarInformeAuditoria(a, fort.data || [], opor.data || [], noConfor.data || [], usuarioLike)
    } catch (e) {
      console.error('No se pudo generar el informe:', e)
      toast.error('No se pudo generar el informe.')
    }
  }

  const handleValidarInforme = async (a) => {
    if (!a || !validateFile) return
    setUploadingValidation(true)
    try {
      const filePath = buildValidationPath(a)
      const { error: upErr } = await supabase.storage.from('validaciones').upload(filePath, validateFile, { upsert: true, contentType: 'application/pdf' })
      if (upErr) throw upErr

      await supabase.from('validaciones_informe').insert([{ informe_id: a.id, archivo_url: filePath }]).catch(() => {})
      await supabase.from('informes_auditoria').update({ validado: true }).eq('id', a.id).catch(() => {})

      const { data: signedVal } = await supabase.storage.from('validaciones').createSignedUrl(filePath, 3600)
      setAuditorias(prev => prev.map(x => x.id === a.id ? { ...x, validated: { file: filePath, url: signedVal?.signedUrl || null }, validado: true } : x))

      setValidateModalOpen(false)
      setValidateFile(null)
      toast.success('Informe validado.')
    } catch (e) {
      console.error('Validación error:', e)
      toast.error('No se pudo validar el informe.')
    } finally {
      setUploadingValidation(false)
    }
  }

    // ✅ Generar y descargar el Plan de Mejora (solo OM y NC)
    const handleDownloadPM = async (informe) => {
        try {
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

            await generarPlanMejora2(
                informe,
                om,
                nc,
                null, // usuario (opcional)
                {
                templateUrl: '/plantillas/PlanMejora.xlsx',
                writeMeta: true,
                metaCells: { dependencia: 'D8', fechaGeneracion: 'F49' },
                metaDateFormat: 'dd/mm/yyyy',
                startRow: 12,
                rowsPerItem: 2,
                pairsCount: 14,
                cols: { fuente: 'A', tipo: 'B', factor: 'C', descripcion: 'D' },
                wrapTextColumns: ['D'],
                }
            )

        } catch (err) {
            console.error('Descargar Plan de Mejora error:', err)
            alert('No se pudo generar/descargar el Plan de Mejora.')
        }
    }


  // ====== SUBIDAS ======
  const subirPlan = async (a) => {
    if (!a || !planFile) return
    setUploadingPlan(true)
    try {
      const filePath = buildPlanPath(a)
      const { error: upErr } = await supabase.storage.from('planes').upload(filePath, planFile, { upsert: true, contentType: 'application/pdf' })
      if (upErr) throw upErr

      const { data: userRes } = await supabase.auth.getUser()
      const enviado_por = userRes?.user?.id || null
      await supabase.from('planes_auditoria_informe').upsert({ informe_id: a.id, archivo_path: filePath, enviado_por }, { onConflict: 'informe_id' }).catch(() => {})

      const { data: signed } = await supabase.storage.from('planes').createSignedUrl(filePath, 3600)
      setAuditorias(prev => prev.map(x => x.id === a.id ? { ...x, plan: { path: filePath, enviado_at: new Date().toISOString(), url: signed?.signedUrl || null } } : x))

      setPlanModalOpen(false); setPlanFile(null)
      toast.success('Plan cargado.')
    } catch (e) {
      console.error('Plan error:', e)
      toast.error('No se pudo subir el plan.')
    } finally {
      setUploadingPlan(false)
    }
  }

  const subirAsistencia = async (a) => {
    if (!a || !asistenciaFile) return
    setUploadingAsistencia(true)
    try {
      const filePath = buildAsistenciaPath(a)
      const { error: upErr } = await supabase.storage.from('asistencias').upload(filePath, asistenciaFile, { upsert: true, contentType: 'application/pdf' })
      if (upErr) throw upErr
      const { data: signed } = await supabase.storage.from('asistencias').createSignedUrl(filePath, 3600)
      setAuditorias(prev => prev.map(x => x.id === a.id ? { ...x, asistencia: { path: filePath, url: signed?.signedUrl || null, uploaded_at: new Date().toISOString() } } : x))
      setAsistenciaModalOpen(false); setAsistenciaFile(null)
      toast.success('Asistencia cargada.')
    } catch (e) {
      console.error('Asistencia error:', e)
      toast.error('No se pudo subir la asistencia.')
    } finally {
      setUploadingAsistencia(false)
    }
  }

  const subirEvaluacion = async (a) => {
    if (!a || !evaluacionFile) return
    setUploadingEvaluacion(true)
    try {
      const filePath = buildEvaluacionPath(a)
      const { error: upErr } = await supabase.storage.from('evaluaciones').upload(filePath, evaluacionFile, { upsert: true, contentType: 'application/pdf' })
      if (upErr) throw upErr
      const { data: signed } = await supabase.storage.from('evaluaciones').createSignedUrl(filePath, 3600)
      setAuditorias(prev => prev.map(x => x.id === a.id ? { ...x, evaluacion: { path: filePath, url: signed?.signedUrl || null, uploaded_at: new Date().toISOString() } } : x))
      setEvaluacionModalOpen(false); setEvaluacionFile(null)
      toast.success('Evaluación cargada.')
    } catch (e) {
      console.error('Evaluación error:', e)
      toast.error('No se pudo subir la evaluación.')
    } finally {
      setUploadingEvaluacion(false)
    }
  }

  const subirActa = async (a) => {
    if (!a || !actaFile) return
    setUploadingActa(true)
    try {
      const filePath = buildActaPath(a)
      const { error: upErr } = await supabase.storage.from('actas').upload(filePath, actaFile, { upsert: true, contentType: 'application/pdf' })
      if (upErr) throw upErr
      const { data: signed } = await supabase.storage.from('actas').createSignedUrl(filePath, 3600)
      setAuditorias(prev => prev.map(x => x.id === a.id ? { ...x, acta: { path: filePath, url: signed?.signedUrl || null, uploaded_at: new Date().toISOString() } } : x))
      setActaModalOpen(false); setActaFile(null)
      toast.success('Acta cargada.')
    } catch (e) {
      console.error('Acta error:', e)
      toast.error('No se pudo subir el acta.')
    } finally {
      setUploadingActa(false)
    }
  }

    // ✅ NUEVO: Subir Acta de Compromiso
  const subirActaCompromiso = async (a) => {
    if (!a || !actaCompFile) return
    setUploadingActaComp(true)
    try {
      const filePath = buildActaCompromisoPath(a)
      const { error: upErr } = await supabase
        .storage
        .from('actascompromiso')
        .upload(filePath, actaCompFile, { upsert: true, contentType: 'application/pdf' })
      if (upErr) throw upErr

      const { data: signed } = await supabase
        .storage
        .from('actascompromiso')
        .createSignedUrl(filePath, 3600)

      setAuditorias(prev => prev.map(x =>
        x.id === a.id
          ? { ...x, acta_compromiso: { path: filePath, url: signed?.signedUrl || null, uploaded_at: new Date().toISOString() } }
          : x
      ))

      setActaCompModalOpen(false)
      setActaCompFile(null)
      toast.success('Acta de compromiso cargada.')
    } catch (e) {
      console.error('Acta de compromiso error:', e)
      toast.error('No se pudo subir el acta de compromiso.')
    } finally {
      setUploadingActaComp(false)
    }
  }

  // ====== Cargar data principal ======
  const loadData = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const { data, error } = await supabase
        .from('informes_auditoria')
        .select(`
          id, fecha_auditoria, fecha_seguimiento,
          objetivo, criterios, conclusiones, recomendaciones,
          asistencia_tipo, usuario_id, dependencia_id, validado,
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
          // PLAN firmado
          let plan = null
          const rec = a.plan_informe?.[0] || null
          if (rec?.archivo_path) {
            try {
              const { data: signed } = await supabase.storage.from('planes').createSignedUrl(rec.archivo_path, 3600)
              plan = { path: rec.archivo_path, enviado_at: rec.enviado_at, url: signed?.signedUrl || null }
            } catch {}
          } else {
            try {
              const guess = buildPlanPath(a)
              const { data: signedGuess } = await supabase.storage.from('planes').createSignedUrl(guess, 3600)
              if (signedGuess?.signedUrl) plan = { path: guess, enviado_at: null, url: signedGuess.signedUrl }
            } catch {}
          }



          // NUEVOS: asistencia / evaluación / acta (firmados si existen)
          const trySign = async (bucket, path) => {
            try {
              const { data: s } = await supabase.storage.from(bucket).createSignedUrl(path, 3600)
              return s?.signedUrl ? { file: path, url: s.signedUrl } : null
            } catch { return null }
          }
          const asistencia = await trySign('asistencias', buildAsistenciaPath(a))
          const evaluacion = await trySign('evaluaciones', buildEvaluacionPath(a))
          const acta = await trySign('actas', buildActaPath(a))
          const acta_compromiso = await trySign('actascompromiso', buildActaCompromisoPath(a))
          // VALIDADO: intenta firmar por ruta exacta
          const validated = await trySign('validaciones', buildValidationPath(a))
          // Conteos de hallazgos
          const fCount = a.fortalezas?.length || 0
          const omCount = a.oportunidades_mejora?.length || 0
          const ncCount = a.no_conformidades?.length || 0
          return { ...a, plan, validated,acta_compromiso, asistencia, evaluacion, acta, fCount, omCount, ncCount }
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
    (async () => {
      try {
        const [{ data: deps }, { data: auds }] = await Promise.all([
          supabase.from('dependencias').select('dependencia_id, nombre').order('nombre', { ascending: true }),
          supabase.from('usuarios').select('usuario_id, nombre, apellido, rol')
            .or('rol.eq.auditor,rol.eq.AUDITOR')
            .order('nombre', { ascending: true }),
        ])
        setDependenciasAll(deps || [])
        setAuditoresAll((auds || []).map(u => ({ ...u, etiqueta: `${u.nombre || ''} ${u.apellido || ''}`.trim() })))
      } catch (e) {
        console.warn('No se pudieron cargar listas para crear:', e)
        // fallbacks
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

  /* flags por fila (para filtros) */
  const computeFlags = (a) => {
    const fa = a.fecha_auditoria ? parseYMD(a.fecha_auditoria) : null
    const hoy = startOfDay(new Date())
    const planDate = fa ? addDays(fa, -5) : null
    const informeLimit = fa ? addDays(fa, 10) : null
    const pmLimit = fa ? addDays(fa, 20) : null

    const isFilled = Boolean(a.objetivo?.trim()) && Boolean(a.criterios?.trim()) && Boolean(a.conclusiones?.trim()) && Boolean(a.recomendaciones?.trim())
    const hallCount = (a.fortalezas?.length || 0) + (a.oportunidades_mejora?.length || 0) + (a.no_conformidades?.length || 0)
    const hasHallazgos = hallCount > 0
    const validado = Boolean(a.validated?.url) || a.validado === true
    const listoValidar = isFilled && hasHallazgos && !validado

    return {
      tienePlan: Boolean(a.plan?.url || a.plan?.enviado_at),
      planDays: planDate ? diffInDays(hoy, planDate) : null,
      informeDays: informeLimit ? diffInDays(hoy, informeLimit) : null,
      pmDays: pmLimit ? diffInDays(hoy, pmLimit) : null,
      informeCompleto: isFilled,
      validado,
      asistenciaOK: Boolean(a.asistencia?.url),
      evaluacionOK: Boolean(a.evaluacion?.url),
      actaOK: Boolean(a.acta?.url),
      actaCompOK: Boolean(a.acta_compromiso?.url),
      listoValidar,
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

    // dropdown de estados extendido
    switch (estadoFilter) {
      case 'plan_pendiente': if (flags.tienePlan) return false; break
      case 'plan_enviado': if (!flags.tienePlan) return false; break
      case 'informe_pendiente': if (flags.informeCompleto) return false; break
      case 'informe_completo': if (!flags.informeCompleto) return false; break
      case 'validado': if (!flags.validado) return false; break
      case 'no_validado': if (flags.validado) return false; break
      case 'acta_compromiso_cargada': if (!flags.actaCompOK) return false; break
      case 'asistencia_cargada': if (!flags.asistenciaOK) return false; break
      case 'evaluacion_cargada': if (!flags.evaluacionOK) return false; break
      case 'acta_cargada': if (!flags.actaOK) return false; break
      case 'listo_validar': if (!flags.listoValidar) return false; break
      default: break
    }

    // checks rápidos (AND)
    if (onlyActaComp && !flags.actaCompOK) return false
    if (onlyAsistencia && !flags.asistenciaOK) return false
    if (onlyEvaluacion && !flags.evaluacionOK) return false
    if (onlyActa && !flags.actaOK) return false

    return true
  }), [auditorias, q, depFilter, audFilter, anioFilter, semFilter, estadoFilter, desde, onlyAsistencia, onlyEvaluacion, onlyActa, onlyActaComp])

  // mantener selección coherente
  useEffect(() => {
    if (!selectedId && filtradas.length) setSelectedId(filtradas[0].id)
    if (selectedId && !filtradas.some(a => a.id === selectedId)) setSelectedId(filtradas[0]?.id ?? null)
  }, [filtradas, selectedId])


  /* timeline (con acciones por etapa) */
  const timeline = useMemo(() => {
    if (!selected?.fecha_auditoria) return []
    const hoy = startOfDay(new Date())
    const fa = parseYMD(selected.fecha_auditoria); if (!fa) return []
    const planDate = addDays(fa, -5)
    const informeLimit = addDays(fa, 10)
    const pmLimit = addDays(fa, 20)

    const isFilled = Boolean(selected.objetivo?.trim()) && Boolean(selected.criterios?.trim()) && Boolean(selected.conclusiones?.trim()) && Boolean(selected.recomendaciones?.trim())
    const hallCount = (selected.fortalezas?.length || 0) + (selected.oportunidades_mejora?.length || 0) + (selected.no_conformidades?.length || 0)
    const hasHallazgos = hallCount > 0
const validatedHref = selected.validated?.url ?? null
const hasValidated = Boolean(validatedHref) || selected.validado === true

    return [
      {
        key: 'plan',
        title: 'Plan de auditoría',
        when: planDate,
        days: diffInDays(hoy, planDate),
        explicitDone: Boolean(selected.plan?.url || selected.plan?.enviado_at),
        subtitle: selected.plan?.enviado_at ? `Enviado el ${fmt(new Date(selected.plan.enviado_at))}` : 'Programar y enviar (5 días antes).',
        actions: selected.plan?.url
          ? [{ label: 'Ver plan', onClick: () => openInNewTab(selected.plan.url) }]
          : [{ label: 'Subir plan', onClick: () => setPlanModalOpen(true) }]
      },
            {
        key: 'acta_compromiso',
        title: 'Acta de compromiso',
        when: addDays(fa, 15), // ajusta si quieres otro límite
        days: diffInDays(hoy, addDays(fa, 15)),
        explicitDone: Boolean(selected.acta_compromiso?.url),
        subtitle: selected.acta_compromiso?.url ? 'Cargada.' : 'Subir PDF del acta de compromiso.',
        actions: selected.acta_compromiso?.url
          ? [{ label: 'Ver acta compromiso', onClick: () => openInNewTab(selected.acta_compromiso.url) }]
          : [{ label: 'Subir acta compromiso', onClick: () => setActaCompModalOpen(true) }]
      },
      {
        key: 'asistencia',
        title: 'Listado de asistencia',
        when: fa,
        days: diffInDays(hoy, fa),
        explicitDone: Boolean(selected.asistencia?.url),
        subtitle: selected.asistencia?.url ? 'Cargado.' : 'Subir PDF del listado de asistencia.',
        actions: selected.asistencia?.url
          ? [{ label: 'Ver asistencia', onClick: () => openInNewTab(selected.asistencia.url) }]
          : [{ label: 'Subir asistencia', onClick: () => setAsistenciaModalOpen(true) }]
      },
      {
        key: 'evaluacion',
        title: 'Evaluación',
        when: fa,
        days: diffInDays(hoy, fa),
        explicitDone: Boolean(selected.evaluacion?.url),
        subtitle: selected.evaluacion?.url ? 'Cargada.' : 'Subir PDF de evaluación.',
        actions: selected.evaluacion?.url
          ? [{ label: 'Ver evaluación', onClick: () => openInNewTab(selected.evaluacion.url) }]
          : [{ label: 'Subir evaluación', onClick: () => setEvaluacionModalOpen(true) }]
      },
      {
        key: 'acta',
        title: 'Acta de reunión',
        when: fa,
        days: diffInDays(hoy, fa),
        explicitDone: Boolean(selected.acta?.url),
        subtitle: selected.acta?.url ? 'Cargada.' : 'Subir PDF del acta de reunión.',
        actions: selected.acta?.url
          ? [{ label: 'Ver acta', onClick: () => openInNewTab(selected.acta.url) }]
          : [{ label: 'Subir acta', onClick: () => setActaModalOpen(true) }]
      },
      {
        key: 'informe',
        title: 'Informe de auditoría',
        when: informeLimit,
        days: diffInDays(hoy, informeLimit),
        explicitDone: hasValidated,
        subtitle: !isFilled
          ? 'Completar objetivo, criterios, conclusiones y recomendaciones (plazo +10 días).'
          : (!hasHallazgos
              ? 'Campos listos. Asignar hallazgos.'
              : (hasValidated ? 'Informe validado.' : 'Campos e hallazgos listos: descarga y valida.')),
              actions: hasValidated
  ? (validatedHref
      ? [{
          label: 'Ver informe validado',
          onClick: () => openInNewTab(validatedHref)
        }]
      : [{
          label: 'Abrir validado',
          onClick: async () => {
            const path = buildValidationPath(selected)
            const { data } = await supabase.storage.from('validaciones').createSignedUrl(path, 3600)
            if (data?.signedUrl) openInNewTab(data.signedUrl)
            else toast.error('No se encontró el PDF validado en almacenamiento.')
          }
        }]
    )
  : (!isFilled || !hasHallazgos
      ? [{ label: isFilled ? 'Editar/Llenar (auditor)' : 'Llenar (auditor)', onClick: () => toast.info('Edición desde vista del auditor'), ghost: true }]
      : [
          { label: '📄 Descargar informe', onClick: () => handleDescargarInforme(selected) },
          { label: '✅ Subir validado', onClick: () => setValidateModalOpen(true) }
        ])

      },
      {
        key: 'pm',
        title: 'Levantamiento del PM',
        when: pmLimit,
        days: diffInDays(hoy, pmLimit),
        explicitDone: false,
        subtitle: 'Plan de Mejoramiento (10 días después de entregar el informe).',
        actions: hasValidated ? [{ label: '📥 Descargar formato PM', onClick: () => handleDownloadPM(selected) }] : []
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
      if (a.validated?.url || a.validado === true) t.val++
    })
    return t
  }, [auditorias])

  // ====== handlers modal crear ======
  const handleChangeNuevo = (e) => {
    const { name, value } = e.target
    setNuevoInforme(prev => ({ ...prev, [name]: value }))
  }

  const crearInforme = async () => {
    if (!nuevoInforme.usuario_id || !nuevoInforme.dependencia_id || !nuevoInforme.fecha_auditoria) {
      toast.error('Seleccione auditor, dependencia y fecha de auditoría')
      return
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
      await loadData()
      if (item?.id) setSelectedId(item.id)
      setNuevoInforme({ dependencia_id: '', usuario_id: '', fecha_auditoria: '' })
      setShowCreate(false)
      toast.success('Auditoría creada')
    } catch (e) {
      console.error(e); toast.error(e.message || 'Error al crear informe')
    } finally { setCreating(false) }
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
            <option value="no_validado">No validado</option>
            <option value="acta_compromiso_cargada">Acta compromiso cargada</option>
            <option value="asistencia_cargada">Asistencia cargada</option>
            <option value="evaluacion_cargada">Evaluación cargada</option>
            <option value="acta_cargada">Acta cargada</option>
            <option value="listo_validar">Listo para validar</option>
          </select>
          <input className={styles.inputBase} type="date" value={desde} onChange={e => setDesde(e.target.value)} />
        </div>

        {/* Checks rápidos */}
        <div className={styles.kpisBar}>
        <label className={styles.kpiChip}>
          <input type="checkbox" checked={onlyActaComp} onChange={e => setOnlyActaComp(e.target.checked)} /> Acta compromiso
        </label>

          <label className={styles.kpiChip}>
            <input type="checkbox" checked={onlyAsistencia} onChange={e => setOnlyAsistencia(e.target.checked)} /> Asistencia
          </label>
          <label className={styles.kpiChip}>
            <input type="checkbox" checked={onlyEvaluacion} onChange={e => setOnlyEvaluacion(e.target.checked)} /> Evaluación
          </label>
          <label className={styles.kpiChip}>
            <input type="checkbox" checked={onlyActa} onChange={e => setOnlyActa(e.target.checked)} /> Acta
          </label>

          <span className={styles.kpiChip} style={{ marginLeft: 'auto' }}>Total: <strong>{kpis.total}</strong></span>
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
                  {a.usuarios && <span className={styles.badgeMini}>{(a.usuarios?.nombre || '')}</span>}
                  {a.plan?.url && <span className={styles.badgeMini}>Plan</span>}
                  {a.validated?.url && <span className={styles.badgeMini}>Validado</span>}
                </div>
              </li>
            )
          })}
        </ul>

        {/* TILE crear */}
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

  {/* Fecha editable inline */}
  <span>Fecha: </span>
  {editingDate ? (
    <>
      <input
        type="date"
        className={styles.inputBase}
        value={dateDraft}
        onChange={e => setDateDraft(e.target.value)}
        onKeyDown={handleDateKeyDown} 
        disabled={savingDate}
        style={{ marginRight: 8 }}
      />
      <button
        className={styles.btn}
        onClick={saveFechaAuditoria}
        disabled={savingDate || !dateDraft}
        title="Guardar fecha"
      >
        {savingDate ? 'Guardando…' : 'Guardar'}
      </button>
      <button
        className={`${styles.btn} ${styles.btnGhost}`}
        onClick={cancelEditFecha}
        disabled={savingDate}
        title="Cancelar"
        style={{ marginLeft: 6 }}
      >
        Cancelar
      </button>
    </>
  ) : (
    <>
      <strong>{fmt(parseYMD(selected.fecha_auditoria))}</strong>{' '}
      <button
        className={`${styles.btn} ${styles.btnGhost}`}
        onClick={beginEditFecha}
        title="Editar fecha"
        style={{ marginLeft: 6 }}
      >
        ✎
      </button>
    </>
  )}
</div>

                {selected.asistencia_tipo && <div className={styles.meta}>Asistencia: <strong>{selected.asistencia_tipo}</strong></div>}
              </div>

              <div className={styles.headerActions}>
                <button className={`${styles.btn} ${styles.btnGhost}`} onClick={() => setShowDetail(true)} title="Ver más">Ver más</button>
                <button className={`${styles.btn} ${styles.btnDanger}`} onClick={() => {
                  const ok = window.confirm(`¿Eliminar la auditoría #${selected.id}?`)
                  if (ok) eliminarInforme(selected.id)
                }} title="Eliminar auditoría">Eliminar</button>
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
          <div className={styles.modalContenido}>
            <button className={styles.modalCerrar} onClick={() => setShowDetail(false)} title="Cerrar">✖</button>

            <h3 className={styles.modalTitulo}>Detalle de la Auditoría #{selected.id}</h3>

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
              <div><strong>Acta de compromiso:</strong> {selected.acta_compromiso?.url ? <a href={selected.acta_compromiso.url} onClick={(e) => { e.preventDefault(); openInNewTab(selected.acta_compromiso.url) }} className={styles.linkLike}>Ver</a>: '—'}</div>
              <div><strong>Plan:</strong> {selected.plan?.url ? <a href={selected.plan.url} onClick={(e) => { e.preventDefault(); openInNewTab(selected.plan.url) }} className={styles.linkLike}>Abrir</a> : 'Sin plan'}</div>
              <div><strong>Informe validado:</strong> {selected.validated?.url ? <a href={selected.validated.url} onClick={(e) => { e.preventDefault(); openInNewTab(selected.validated.url) }} className={styles.linkLike}>Descargar</a> : 'No disponible'}</div>
              <div><strong>Asistencia:</strong> {selected.asistencia?.url ? <a href={selected.asistencia.url} onClick={(e) => { e.preventDefault(); openInNewTab(selected.asistencia.url) }} className={styles.linkLike}>Ver</a> : '—'}</div>
              <div><strong>Evaluación:</strong> {selected.evaluacion?.url ? <a href={selected.evaluacion.url} onClick={(e) => { e.preventDefault(); openInNewTab(selected.evaluacion.url) }} className={styles.linkLike}>Ver</a> : '—'}</div>
              <div><strong>Acta:</strong> {selected.acta?.url ? <a href={selected.acta.url} onClick={(e) => { e.preventDefault(); openInNewTab(selected.acta.url) }} className={styles.linkLike}>Ver</a> : '—'}</div>
            </div>
          </div>
        </div>
      )}

      {/* ====== MODAL CREAR AUDITORÍA ====== */}
      {showCreate && (
        <div className={styles.modalOverlay} onClick={(e) => { if (e.target === e.currentTarget) setShowCreate(false) }}>
          <div className={styles.modalContenido}>
            <button className={styles.modalCerrar} onClick={() => setShowCreate(false)} title="Cerrar">✖</button>
            <h3 className={styles.modalTitulo}>Nueva Auditoría</h3>

            <div className={styles.formRow}>
              <label className={styles.formLabel}>Dependencia</label>
              <select name="dependencia_id" value={nuevoInforme.dependencia_id} onChange={handleChangeNuevo} className={styles.inputBase}>
                <option value="">Seleccione una dependencia</option>
                {dependenciasAll.map(dep => (<option key={dep.dependencia_id} value={dep.dependencia_id}>{dep.nombre}</option>))}
              </select>
            </div>

            <div className={styles.formRow}>
              <label className={styles.formLabel}>Auditor responsable</label>
              <select name="usuario_id" value={nuevoInforme.usuario_id} onChange={handleChangeNuevo} className={styles.inputBase}>
                <option value="">Seleccione un auditor</option>
                {auditoresAll.map(a => (<option key={a.usuario_id} value={a.usuario_id}>{a.etiqueta || `${a.nombre || ''} ${a.apellido || ''}`}</option>))}
              </select>
            </div>

            <div className={styles.formRow}>
              <label className={styles.formLabel}>Fecha de auditoría</label>
              <input type="date" name="fecha_auditoria" value={nuevoInforme.fecha_auditoria} onChange={handleChangeNuevo} className={styles.inputBase} />
            </div>

            <div className={styles.modalBotones}>
              <button className={styles.botonCancelar} onClick={() => setShowCreate(false)}>Cancelar</button>
              <button className={styles.botonSubir} onClick={crearInforme} disabled={creating}>{creating ? 'Creando…' : 'Crear'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ====== MODALES DE SUBIDA (MISMO MARKUP QUE EL AUDITOR) ====== */}

      {/* Plan */}
      {planModalOpen && selected && (
        <div
          className={styles.modalOverlay}
          onClick={(e) => { if (e.target === e.currentTarget) { setPlanModalOpen(false); setPlanFile(null) } }}
        >
          <div className={styles.modalContenido}>
            <button className={styles.modalCerrar} onClick={() => { setPlanModalOpen(false); setPlanFile(null) }}>✖</button>
            <h3 className={styles.modalTitulo}>{selected?.plan ? 'Reemplazar plan de auditoría' : 'Subir plan de auditoría'}</h3>

            {selected?.plan?.url && (
              <a href={selected.plan.url} target="_blank" rel="noopener noreferrer" className={styles.btnVerActual} onClick={(e)=>{e.preventDefault(); openInNewTab(selected.plan.url)}}>
                👀 Ver plan actual
              </a>
            )}

            <label className={styles.dropArea}>
              <input
                type="file"
                accept="application/pdf"
                className={styles.inputArchivo}
                onChange={(e) => {
                  const f = e.target.files?.[0] || null
                  if (f && f.size > 2 * 1024 * 1024) { // 2MB
                    toast.warn('Máximo 2MB')
                    e.target.value = null
                    return
                  }
                  setPlanFile(f)
                }}
              />
              {!planFile ? (
                <>
                  <div className={styles.iconoSubida}>📎</div>
                  <p className={styles.instrucciones}>Haz clic para seleccionar el pdf<br /><span className={styles.subtexto}>Solo PDF (máx. 2 MB)</span></p>
                </>
              ) : (
                <p className={styles.nombreArchivo}>✅ {planFile.name}</p>
              )}
            </label>

            <div className={styles.modalBotones}>
              <button className={styles.botonSubir} onClick={() => subirPlan(selected)} disabled={!planFile || uploadingPlan}>
                {uploadingPlan ? 'Subiendo…' : (selected?.plan ? 'Reemplazar plan' : 'Subir plan')}
              </button>
              <button className={styles.botonCancelar} onClick={() => { setPlanModalOpen(false); setPlanFile(null) }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}


      {/* ✅ NUEVO: Acta de compromiso */}
      {actaCompModalOpen && selected && (
        <div
          className={styles.modalOverlay}
          onClick={(e) => { if (e.target === e.currentTarget) { setActaCompModalOpen(false); setActaCompFile(null) } }}
        >
          <div className={styles.modalContenido}>
            <button className={styles.modalCerrar} onClick={() => { setActaCompModalOpen(false); setActaCompFile(null) }}>✖</button>
            <h3 className={styles.modalTitulo}>Acta de compromiso — Subir PDF</h3>

            {selected?.acta_compromiso?.url && (
              <a
                href={selected.acta_compromiso.url}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.btnVerActual}
                onClick={(e)=>{e.preventDefault(); openInNewTab(selected.acta_compromiso.url)}}
              >
                👀 Ver acta de compromiso actual
              </a>
            )}

            <label className={styles.dropArea}>
              <input
                type="file"
                accept="application/pdf"
                className={styles.inputArchivo}
                onChange={(e) => {
                  const f = e.target.files?.[0] || null
                  if (f && f.size > 2 * 1024 * 1024) {
                    toast.warn('Máximo 2MB')
                    e.target.value = null
                    return
                  }
                  setActaCompFile(f)
                }}
              />
              {!actaCompFile ? (
                <>
                  <div className={styles.iconoSubida}>📎</div>
                  <p className={styles.instrucciones}>
                    Haz clic para seleccionar el pdf<br />
                    <span className={styles.subtexto}>Solo PDF (máx. 2 MB)</span>
                  </p>
                </>
              ) : (
                <p className={styles.nombreArchivo}>✅ {actaCompFile.name}</p>
              )}
            </label>

            <div className={styles.modalBotones}>
              <button
                className={styles.botonSubir}
                onClick={() => subirActaCompromiso(selected)}
                disabled={!actaCompFile || uploadingActaComp}
              >
                {uploadingActaComp ? 'Subiendo…' : 'Subir'}
              </button>
              <button className={styles.botonCancelar} onClick={() => { setActaCompModalOpen(false); setActaCompFile(null) }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Asistencia */}
      {asistenciaModalOpen && selected && (
        <div className={styles.modalOverlay} onClick={(e) => { if (e.target === e.currentTarget) { setAsistenciaModalOpen(false); setAsistenciaFile(null) } }}>
          <div className={styles.modalContenido}>
            <button className={styles.modalCerrar} onClick={() => { setAsistenciaModalOpen(false); setAsistenciaFile(null) }}>✖</button>
            <h3 className={styles.modalTitulo}>Listado de asistencia — Subir PDF</h3>

            {selected?.asistencia?.url && (
              <a href={selected.asistencia.url} target="_blank" rel="noopener noreferrer" className={styles.btnVerActual} onClick={(e)=>{e.preventDefault(); openInNewTab(selected.asistencia.url)}}>
                👀 Ver asistencia actual
              </a>
            )}

            <label className={styles.dropArea}>
              <input
                type="file"
                accept="application/pdf"
                className={styles.inputArchivo}
                onChange={(e) => {
                  const f = e.target.files?.[0] || null
                  if (f && f.size > 2 * 1024 * 1024) {
                    toast.warn('Máximo 2MB')
                    e.target.value = null
                    return
                  }
                  setAsistenciaFile(f)
                }}
              />
              {!asistenciaFile ? (
                <>
                  <div className={styles.iconoSubida}>📎</div>
                  <p className={styles.instrucciones}>Haz clic para seleccionar el pdf<br /><span className={styles.subtexto}>Solo PDF (máx. 2 MB)</span></p>
                </>
              ) : (
                <p className={styles.nombreArchivo}>✅ {asistenciaFile.name}</p>
              )}
            </label>

            <div className={styles.modalBotones}>
              <button className={styles.botonSubir} onClick={() => subirAsistencia(selected)} disabled={!asistenciaFile || uploadingAsistencia}>
                {uploadingAsistencia ? 'Subiendo…' : 'Subir'}
              </button>
              <button className={styles.botonCancelar} onClick={() => { setAsistenciaModalOpen(false); setAsistenciaFile(null) }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Evaluación */}
      {evaluacionModalOpen && selected && (
        <div className={styles.modalOverlay} onClick={(e) => { if (e.target === e.currentTarget) { setEvaluacionModalOpen(false); setEvaluacionFile(null) } }}>
          <div className={styles.modalContenido}>
            <button className={styles.modalCerrar} onClick={() => { setEvaluacionModalOpen(false); setEvaluacionFile(null) }}>✖</button>
            <h3 className={styles.modalTitulo}>Evaluación — Subir PDF</h3>

            {selected?.evaluacion?.url && (
              <a href={selected.evaluacion.url} target="_blank" rel="noopener noreferrer" className={styles.btnVerActual} onClick={(e)=>{e.preventDefault(); openInNewTab(selected.evaluacion.url)}}>
                👀 Ver evaluación actual
              </a>
            )}

            <label className={styles.dropArea}>
              <input
                type="file"
                accept="application/pdf"
                className={styles.inputArchivo}
                onChange={(e) => {
                  const f = e.target.files?.[0] || null
                  if (f && f.size > 2 * 1024 * 1024) {
                    toast.warn('Máximo 2MB')
                    e.target.value = null
                    return
                  }
                  setEvaluacionFile(f)
                }}
              />
              {!evaluacionFile ? (
                <>
                  <div className={styles.iconoSubida}>📎</div>
                  <p className={styles.instrucciones}>Haz clic para seleccionar el pdf<br /><span className={styles.subtexto}>Solo PDF (máx. 2 MB)</span></p>
                </>
              ) : (
                <p className={styles.nombreArchivo}>✅ {evaluacionFile.name}</p>
              )}
            </label>

            <div className={styles.modalBotones}>
              <button className={styles.botonSubir} onClick={() => subirEvaluacion(selected)} disabled={!evaluacionFile || uploadingEvaluacion}>
                {uploadingEvaluacion ? 'Subiendo…' : 'Subir'}
              </button>
              <button className={styles.botonCancelar} onClick={() => { setEvaluacionModalOpen(false); setEvaluacionFile(null) }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}


      {/* Acta */}
      {actaModalOpen && selected && (
        <div className={styles.modalOverlay} onClick={(e) => { if (e.target === e.currentTarget) { setActaModalOpen(false); setActaFile(null) } }}>
          <div className={styles.modalContenido}>
            <button className={styles.modalCerrar} onClick={() => { setActaModalOpen(false); setActaFile(null) }}>✖</button>
            <h3 className={styles.modalTitulo}>Acta de reunión — Subir PDF</h3>

            {selected?.acta?.url && (
              <a href={selected.acta.url} target="_blank" rel="noopener noreferrer" className={styles.btnVerActual} onClick={(e)=>{e.preventDefault(); openInNewTab(selected.acta.url)}}>
                👀 Ver acta actual
              </a>
            )}

            <label className={styles.dropArea}>
              <input
                type="file"
                accept="application/pdf"
                className={styles.inputArchivo}
                onChange={(e) => {
                  const f = e.target.files?.[0] || null
                  if (f && f.size > 2 * 1024 * 1024) {
                    toast.warn('Máximo 2MB')
                    e.target.value = null
                    return
                  }
                  setActaFile(f)
                }}
              />
              {!actaFile ? (
                <>
                  <div className={styles.iconoSubida}>📎</div>
                  <p className={styles.instrucciones}>Haz clic para seleccionar el pdf<br /><span className={styles.subtexto}>Solo PDF (máx. 2 MB)</span></p>
                </>
              ) : (
                <p className={styles.nombreArchivo}>✅ {actaFile.name}</p>
              )}
            </label>

            <div className={styles.modalBotones}>
              <button className={styles.botonSubir} onClick={() => subirActa(selected)} disabled={!actaFile || uploadingActa}>
                {uploadingActa ? 'Subiendo…' : 'Subir'}
              </button>
              <button className={styles.botonCancelar} onClick={() => { setActaModalOpen(false); setActaFile(null) }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Validación */}
      {validateModalOpen && selected && (
        <div className={styles.modalOverlay} onClick={(e) => { if (e.target === e.currentTarget) { setValidateModalOpen(false); setValidateFile(null) } }}>
          <div className={styles.modalContenido}>
            <button className={styles.modalCerrar} onClick={() => { setValidateModalOpen(false); setValidateFile(null) }}>✖</button>
            <h3 className={styles.modalTitulo}>Validar informe — Subir PDF firmado</h3>

            <label className={styles.dropArea}>
              <input
                type="file"
                accept="application/pdf"
                className={styles.inputArchivo}
                onChange={(e) => {
                  const f = e.target.files?.[0] || null
                  if (f && f.size > 1 * 1024 * 1024) { // 1MB como en la vista del auditor
                    toast.warn('Máximo 1MB')
                    e.target.value = null
                    return
                  }
                  setValidateFile(f)
                }}
              />
              {!validateFile ? (
                <>
                  <div className={styles.iconoSubida}>📎</div>
                  <p className={styles.instrucciones}>Haz clic para seleccionar el pdf<br /><span className={styles.subtexto}>Solo PDF (máx. 1 MB)</span></p>
                </>
              ) : (
                <p className={styles.nombreArchivo}>✅ {validateFile.name}</p>
              )}
            </label>

            <div className={styles.modalBotones}>
              <button className={styles.botonSubir} onClick={() => handleValidarInforme(selected)} disabled={!validateFile || uploadingValidation}>
                {uploadingValidation ? 'Subiendo…' : 'Subir y validar'}
              </button>
              <button className={styles.botonCancelar} onClick={() => { setValidateModalOpen(false); setValidateFile(null) }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
