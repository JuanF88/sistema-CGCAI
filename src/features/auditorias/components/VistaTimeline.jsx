'use client'

/**
 * Administración de auditorías (panel de admin y de visualizador).
 *
 * Este archivo orquesta: carga los datos, aplica los filtros y arma las etapas.
 * Las piezas visuales están en `components/timeline/`. Con `soloLectura` se
 * ocultan todas las acciones de escritura.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'react-toastify'
import { FileText, Pencil, Plus, RefreshCw, Sparkles, Trash2 } from 'lucide-react'

import { supabase } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/components/ui/stat-card'
import DocumentUploadModal from '@/components/ui/DocumentUploadModal'
import { FormDrawer } from '@/components/ui/form-drawer'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EMPTY_STATE, PAGE_SHELL, SECTION_CARD } from '@/components/ui/tokens'

import FormularioRegistro from '@/features/auditorias/components/FormularioRegistro'
import { DOCUMENTOS_ADMIN } from '@/features/auditorias/lib/documentos'
import { computeFlags, isAuditValidated } from '@/features/auditorias/lib/estado-auditoria'
import {
  descargarInformeAuditoria,
  descargarPlanMejora,
} from '@/features/auditorias/lib/descargas'
import { useNovedades } from '@/features/auditorias/hooks/useNovedades'
import { useAnioInicial } from '@/hooks/useAnioInicial'
import { useSubidaDocumento } from '@/features/auditorias/hooks/useSubidaDocumento'
import {
  CHECKS_RAPIDOS,
  FILTROS_INICIALES,
  FiltrosAuditorias,
} from './timeline/FiltrosAuditorias'
import { BadgeMini, ListaAuditorias } from './timeline/ListaAuditorias'
import { EtapasTimeline } from './timeline/EtapasTimeline'
import { ModalCrearAuditoria } from './timeline/ModalCrearAuditoria'
import { ModalDetalleAuditoria } from './timeline/ModalDetalleAuditoria'
import { ModalNovedades } from './timeline/ModalNovedades'
// Alias: este componente ya tiene una función local con ese nombre.
import {
  crearInforme as crearInformeApi,
  eliminarInforme as eliminarInformeApi,
} from '@/features/auditorias/api/informes-api'

import {
  BUCKETS,
  addBusinessDays,
  buildActaCompromisoPath,
  buildActaPath,
  buildAsistenciaPath,
  buildEvaluacionPath,
  buildPlanPath,
  buildValidationPath,
  diffInBusinessDays,
  diffInDays,
  fmt,
  parseYMD,
  startOfDay,
  toYMD,
} from '@/features/auditorias/hooks/useAuditTimeline'

const NUEVO_INFORME_VACIO = { dependencia_id: '', usuario_id: '', fecha_auditoria: '' }

export default function VistaTimeline({ usuario, soloLectura = false }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [auditorias, setAuditorias] = useState([])
  const [selectedId, setSelectedId] = useState(null)

  const [filtros, setFiltros] = useState(FILTROS_INICIALES)
  const setFiltro = (campo, valor) => setFiltros((prev) => ({ ...prev, [campo]: valor }))
  const [checks, setChecks] = useState({})

  const [showDetail, setShowDetail] = useState(false)
  const [aEliminar, setAEliminar] = useState(null)
  const [editModalOpen, setEditModalOpen] = useState(false)

  // Edición inline de la fecha de auditoría.
  const [editingDate, setEditingDate] = useState(false)
  const [dateDraft, setDateDraft] = useState('')
  const [savingDate, setSavingDate] = useState(false)

  // Modal de creación.
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [nuevoInforme, setNuevoInforme] = useState(NUEVO_INFORME_VACIO)
  const [dependenciasAll, setDependenciasAll] = useState([])
  const [auditoresAll, setAuditoresAll] = useState([])

  const selected = useMemo(
    () => auditorias.find((a) => a.id === selectedId) || null,
    [auditorias, selectedId]
  )

  const novedades = useNovedades()

  const subida = useSubidaDocumento({
    documentos: DOCUMENTOS_ADMIN,
    auditoria: selected,
    onSubido: (campo, valor, extra) =>
      setAuditorias((prev) =>
        prev.map((a) => (a.id === selected.id ? { ...a, [campo]: valor, ...(extra || {}) } : a))
      ),
  })

  /* ── Utilidades ── */

  /**
   * Firma una ruta solo si el archivo existe.
   *
   * `createSignedUrl` devuelve URL para rutas inexistentes, así que primero se
   * comprueba con `list()`.
   */
  const trySignFile = async (bucket, path) => {
    try {
      const corte = path.lastIndexOf('/')
      const dir = corte > 0 ? path.substring(0, corte) : ''
      const fileName = corte > 0 ? path.substring(corte + 1) : path

      const { data: listData, error: listError } = await supabase.storage
        .from(bucket)
        .list(dir, { limit: 1000 })

      if (listError || !listData?.some((file) => file.name === fileName)) return null

      const { data: s } = await supabase.storage.from(bucket).createSignedUrl(path, 3600)
      return s?.signedUrl ? { file: path, url: s.signedUrl } : null
    } catch {
      return null
    }
  }

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
    setTimeout(() => {
      openingRef.current = false
    }, 300)
  }, [])

  /* ── Carga principal ── */

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase
        .from('informes_auditoria')
        .select(
          `
            id, fecha_auditoria, fecha_seguimiento, validado,
            objetivo, criterios, conclusiones, recomendaciones,
            asistencia_tipo, auditores_acompanantes, usuario_id, dependencia_id,
            dependencias:dependencias ( nombre ),
            programa:programa_auditoria_id ( id, nombre, anio, objetivo ),
            usuarios:usuario_id ( nombre, apellido ),
            plan_informe:planes_auditoria_informe ( archivo_path, enviado_at ),
            fortalezas ( id ),
            oportunidades_mejora ( id ),
            no_conformidades ( id )
          `
        )
        .order('fecha_auditoria', { ascending: true })
      if (error) throw error

      const merged = await Promise.all(
        (data || []).map(async (a) => {
          // Los seis documentos se firman en paralelo: antes eran seis viajes
          // encadenados por auditoría.
          const [planFirmado, asistencia, evaluacion, acta, acta_compromiso, validated] =
            await Promise.all([
              trySignFile(BUCKETS.PLANES, a.plan_informe?.[0]?.archivo_path || buildPlanPath(a)),
              trySignFile(BUCKETS.ASISTENCIAS, buildAsistenciaPath(a)),
              trySignFile(BUCKETS.EVALUACIONES, buildEvaluacionPath(a)),
              trySignFile(BUCKETS.ACTAS, buildActaPath(a)),
              trySignFile(BUCKETS.ACTAS_COMPROMISO, buildActaCompromisoPath(a)),
              trySignFile(BUCKETS.VALIDACIONES, buildValidationPath(a)),
            ])

          const rec = a.plan_informe?.[0] || null
          const plan = planFirmado
            ? {
                path: planFirmado.file,
                enviado_at: rec?.archivo_path ? rec.enviado_at : null,
                url: planFirmado.url,
              }
            : null

          return {
            ...a,
            plan,
            validated,
            acta_compromiso,
            asistencia,
            evaluacion,
            acta,
            fCount: a.fortalezas?.length || 0,
            omCount: a.oportunidades_mejora?.length || 0,
            ncCount: a.no_conformidades?.length || 0,
          }
        })
      )

      setAuditorias(merged)
      setSelectedId((prev) => prev ?? merged?.[0]?.id ?? null)
    } catch (e) {
      console.error(e)
      setError(e.message || 'Error cargando auditorías')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  /**
   * Listas del modal de creación.
   *
   * Se piden una sola vez: antes el efecto dependía de `auditorias`, así que
   * volvía a traer dependencias y usuarios cada vez que cambiaba la lista.
   */
  const listasCargadas = useRef(false)
  useEffect(() => {
    if (listasCargadas.current) return

    const cargar = async () => {
      try {
        const [{ data: deps }, { data: auds }] = await Promise.all([
          supabase
            .from('dependencias')
            .select('dependencia_id, nombre')
            .order('nombre', { ascending: true }),
          supabase
            .from('usuarios')
            .select(
              'usuario_id, nombre, apellido, email, celular, rol, estado, tipo_personal, estudios, tipo_estudio, dependencia_id, dependencias:dependencia_id ( nombre )'
            )
            .or('rol.eq.auditor,rol.eq.AUDITOR')
            .order('nombre', { ascending: true }),
        ])
        setDependenciasAll(deps || [])
        setAuditoresAll(
          (auds || []).map((u) => ({
            ...u,
            etiqueta: `${u.nombre || ''} ${u.apellido || ''}`.trim(),
          }))
        )
        listasCargadas.current = true
      } catch (e) {
        // Sin las listas, se arma un fallback con lo que ya hay cargado y se
        // reintenta cuando lleguen más auditorías.
        console.warn('No se pudieron cargar listas para crear:', e)
        setDependenciasAll(
          Array.from(
            new Map(
              auditorias
                .map((a) => [a.dependencia_id, a.dependencias?.nombre])
                .filter(([id, n]) => id && n)
            ),
            ([dependencia_id, nombre]) => ({ dependencia_id, nombre })
          )
        )
        setAuditoresAll(
          Array.from(
            new Map(
              auditorias
                .map((a) => [
                  a.usuario_id,
                  `${a.usuarios?.nombre || ''} ${a.usuarios?.apellido || ''}`.trim(),
                ])
                .filter(([id, n]) => id && n)
            ),
            ([usuario_id, etiqueta]) => ({ usuario_id, etiqueta })
          )
        )
      }
    }

    cargar()
  }, [auditorias])

  /* ── Fecha de auditoría (edición inline) ── */

  const beginEditFecha = useCallback(() => {
    if (!selected) return
    if (isAuditValidated(selected)) {
      toast.info('Esta auditoría ya está validada; no puedes cambiar la fecha.')
      return
    }
    setDateDraft(toYMD(selected.fecha_auditoria))
    setEditingDate(true)
  }, [selected])

  const cancelEditFecha = useCallback(() => {
    setEditingDate(false)
    setDateDraft('')
  }, [])

  const saveFechaAuditoria = useCallback(async () => {
    if (!selected || !dateDraft) return
    if (isAuditValidated(selected)) {
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
        .eq('id', selected.id)
      if (upErr) throw upErr

      setAuditorias((prev) =>
        prev.map((a) => (a.id === selected.id ? { ...a, fecha_auditoria: ymd } : a))
      )
      toast.success('Fecha de auditoría actualizada.')
      setEditingDate(false)
    } catch (e) {
      console.error('Actualizar fecha error:', e)
      toast.error('No se pudo actualizar la fecha.')
    } finally {
      setSavingDate(false)
    }
  }, [selected, dateDraft])

  /* ── Eliminar ── */

  const confirmarEliminacion = async () => {
    if (!aEliminar) return
    try {
      await eliminarInformeApi(aEliminar.id)
      toast.success('Informe eliminado correctamente')
    } catch (err) {
      console.error('Error al eliminar:', err)
      toast.error('Error al eliminar: ' + err.message)
    } finally {
      setAEliminar(null)
      await loadData()
    }
  }

  /* ── Listas derivadas y filtros ── */

  const dependencias = useMemo(() => {
    const map = new Map()
    auditorias.forEach((a) => {
      if (a.dependencia_id && a.dependencias?.nombre)
        map.set(a.dependencia_id, a.dependencias.nombre)
    })
    return Array.from(map, ([id, nombre]) => ({ id, nombre })).sort((x, y) =>
      x.nombre.localeCompare(y.nombre)
    )
  }, [auditorias])

  const auditores = useMemo(() => {
    const map = new Map()
    auditorias.forEach((a) => {
      const nombre = `${a.usuarios?.nombre || ''} ${a.usuarios?.apellido || ''}`.trim()
      if (a.usuario_id && nombre) map.set(a.usuario_id, nombre)
    })
    return Array.from(map, ([id, nombre]) => ({ id, nombre })).sort((x, y) =>
      x.nombre.localeCompare(y.nombre)
    )
  }, [auditorias])

  const anios = useMemo(() => {
    const set = new Set()
    auditorias.forEach((a) => {
      const y = a.fecha_auditoria ? new Date(a.fecha_auditoria).getFullYear() : null
      if (y) set.add(y)
    })
    return [...set].sort((a, b) => a - b)
  }, [auditorias])

  useAnioInicial(anios, (anio) => setFiltro('anio', String(anio)))

  const filtradas = useMemo(
    () =>
      auditorias.filter((a) => {
        const flags = computeFlags(a)
        const fa = flags.fa
        const auditorNombre = `${a.usuarios?.nombre || ''} ${a.usuarios?.apellido || ''}`
          .trim()
          .toLowerCase()

        const q = filtros.q.toLowerCase()
        if (
          q &&
          !a.dependencias?.nombre?.toLowerCase().includes(q) &&
          !auditorNombre.includes(q) &&
          !String(a.id).includes(q)
        ) {
          return false
        }

        if (filtros.auditorTexto && !auditorNombre.includes(filtros.auditorTexto.toLowerCase()))
          return false
        if (filtros.dependencia !== 'todas' && Number(filtros.dependencia) !== a.dependencia_id)
          return false
        if (filtros.auditor !== 'todos' && Number(filtros.auditor) !== a.usuario_id) return false
        if (filtros.anio !== 'todos' && String(fa?.getFullYear()) !== filtros.anio) return false
        if (filtros.semestre !== 'todos') {
          const mes = fa ? fa.getMonth() + 1 : null
          const sem = mes ? (mes <= 6 ? '1' : '2') : null
          if (sem !== filtros.semestre) return false
        }
        if (filtros.desde && fa && fa < parseYMD(filtros.desde)) return false

        switch (filtros.estado) {
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

        return CHECKS_RAPIDOS.every((c) => !checks[c.flag] || flags[c.flag])
      }),
    [auditorias, filtros, checks]
  )

  // Mantener la selección dentro de lo filtrado.
  useEffect(() => {
    if (!selectedId && filtradas.length) setSelectedId(filtradas[0].id)
    if (selectedId && !filtradas.some((a) => a.id === selectedId))
      setSelectedId(filtradas[0]?.id ?? null)
  }, [filtradas, selectedId])

  /* ── Etapas ── */

  const timeline = useMemo(() => {
    if (!selected?.fecha_auditoria) return []
    const hoy = startOfDay(new Date())
    const fa = parseYMD(selected.fecha_auditoria)
    if (!fa) return []

    const planDate = addBusinessDays(fa, -5)
    const cartaCompromisoDate = addBusinessDays(fa, -5)
    const actaLimit = addBusinessDays(fa, 10)
    const informeLimit = addBusinessDays(fa, 10)
    const pmLimit = addBusinessDays(fa, 20)

    const flags = computeFlags(selected)
    const validatedHref = selected.validated?.url ?? null
    const hasValidated = flags.validado
    const puedeEscribir = !soloLectura

    /** Etapa de «subir un documento»: ver, reemplazar o subir. */
    const pasoDocumento = ({ key, title, when, days, doc, campo, nombre, hecho, pendiente }) => {
      const url = selected[campo]?.url
      return {
        key,
        title,
        when,
        days,
        explicitDone: Boolean(url),
        subtitle: url ? hecho : pendiente,
        actions: url
          ? [
              { label: `Ver ${nombre}`, onClick: () => openInNewTab(url), type: 'view' },
              ...(puedeEscribir
                ? [{ label: `Reemplazar ${nombre}`, onClick: () => subida.abrir(doc), type: 'replace' }]
                : []),
            ]
          : puedeEscribir
            ? [{ label: `Subir ${nombre}`, onClick: () => subida.abrir(doc), type: 'replace' }]
            : [],
      }
    }

    /** Acciones del paso «informe» según en qué punto esté. */
    const accionesInforme = () => {
      const editar = puedeEscribir
        ? [
            {
              label: flags.informeCompleto ? 'Editar informe' : 'Llenar informe',
              title: 'Abre el formulario del informe de auditoría',
              onClick: () => setEditModalOpen(true),
              // Si aún está vacío, rellenarlo es LA acción de esta etapa.
              type: flags.informeCompleto ? 'edit' : 'fill',
            },
          ]
        : []

      // Sin validar y sin campos o sin hallazgos: lo único posible es rellenarlo.
      if (!hasValidated && !flags.listoValidar) return editar

      const descargar = {
        label: 'Descargar informe',
        onClick: () => descargarInformeAuditoria(selected),
        type: 'download',
      }

      if (!hasValidated) {
        return [
          ...editar,
          descargar,
          ...(puedeEscribir
            ? [{ label: 'Subir validado', onClick: () => subida.abrir('validacion'), type: 'replace' }]
            : []),
        ]
      }

      return [
        ...editar,
        descargar,
        validatedHref
          ? { label: 'Ver validado', onClick: () => openInNewTab(validatedHref), type: 'view' }
          : {
              label: 'Abrir validado',
              type: 'view',
              // Sin URL firmada en memoria: se pide en el momento.
              onClick: async () => {
                const path = buildValidationPath(selected)
                const { data } = await supabase.storage
                  .from(BUCKETS.VALIDACIONES)
                  .createSignedUrl(path, 3600)
                if (data?.signedUrl) openInNewTab(data.signedUrl)
                else toast.error('No se encontró el PDF validado en almacenamiento.')
              },
            },
        ...(puedeEscribir
          ? [
              {
                label: 'Reemplazar validado',
                onClick: () => subida.abrir('validacion'),
                type: 'replace',
              },
            ]
          : []),
      ]
    }

    return [
      pasoDocumento({
        key: 'acta_compromiso',
        title: 'Carta de compromiso',
        when: cartaCompromisoDate,
        days: diffInBusinessDays(hoy, cartaCompromisoDate),
        doc: 'actaCompromiso',
        campo: 'acta_compromiso',
        nombre: 'carta de compromiso',
        hecho: 'Cargada.',
        pendiente: 'Subir PDF de la carta de compromiso.',
      }),
      {
        key: 'plan',
        title: 'Plan de auditoría',
        when: planDate,
        days: diffInBusinessDays(hoy, planDate),
        explicitDone: flags.tienePlan,
        subtitle: selected.plan?.enviado_at
          ? `Enviado el ${fmt(new Date(selected.plan.enviado_at))}`
          : 'Programar y enviar (5 días hábiles antes).',
        actions: selected.plan?.url
          ? [
              { label: 'Ver plan', onClick: () => openInNewTab(selected.plan.url), type: 'view' },
              ...(puedeEscribir
                ? [{ label: 'Reemplazar plan', onClick: () => subida.abrir('plan'), type: 'replace' }]
                : []),
            ]
          : puedeEscribir
            ? [{ label: 'Subir plan', onClick: () => subida.abrir('plan'), type: 'replace' }]
            : [],
      },
      pasoDocumento({
        key: 'asistencia',
        title: 'Listado de asistencia',
        when: fa,
        days: diffInDays(hoy, fa),
        doc: 'asistencia',
        campo: 'asistencia',
        nombre: 'asistencia',
        hecho: 'Cargado.',
        pendiente: 'Subir PDF del listado de asistencia.',
      }),
      pasoDocumento({
        key: 'evaluacion',
        title: 'Evaluación',
        when: fa,
        days: diffInDays(hoy, fa),
        doc: 'evaluacion',
        campo: 'evaluacion',
        nombre: 'evaluación',
        hecho: 'Cargada.',
        pendiente: 'Subir PDF de evaluación.',
      }),
      pasoDocumento({
        key: 'acta',
        title: 'Acta de reunión',
        when: actaLimit,
        days: diffInBusinessDays(hoy, actaLimit),
        doc: 'acta',
        campo: 'acta',
        nombre: 'acta',
        hecho: 'Cargada.',
        pendiente: 'Subir PDF del acta de reunión (10 días hábiles).',
      }),
      {
        key: 'informe',
        title: 'Informe de auditoría',
        when: informeLimit,
        days: diffInBusinessDays(hoy, informeLimit),
        explicitDone: hasValidated,
        subtitle: !flags.informeCompleto
          ? 'Completar objetivo, criterios, conclusiones y recomendaciones (plazo +10 días hábiles).'
          : hasValidated
            ? 'Informe validado.'
            : flags.listoValidar
              ? 'Campos y hallazgos listos: descarga y valida.'
              : 'Campos listos. Asignar hallazgos.',
        actions: accionesInforme(),
      },
      {
        key: 'pm',
        title: 'Levantamiento del PM',
        when: pmLimit,
        days: diffInBusinessDays(hoy, pmLimit),
        explicitDone: false,
        subtitle: 'Plan de Mejoramiento (20 días hábiles después de entregar el informe).',
        actions: hasValidated
          ? [
              {
                label: 'Descargar formato PM',
                onClick: () => descargarPlanMejora(selected),
                type: 'download',
              },
            ]
          : [],
      },
    ]
    // `subida.abrir` es estable (es un setState).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, soloLectura, openInNewTab])

  /* ── KPIs ── */

  // Sobre `filtradas`, no sobre `auditorias`: las tarjetas resumen lo que se
  // está viendo. Si no, al filtrar por año seguían contando todos los años.
  const kpis = useMemo(() => {
    const t = { total: filtradas.length, plan: 0, informe: 0, val: 0 }
    filtradas.forEach((a) => {
      const flags = computeFlags(a)
      if (flags.tienePlan) t.plan++
      if (flags.informeCompleto) t.informe++
      if (flags.validado) t.val++
    })
    return t
  }, [filtradas])

  const pct = (n) => (kpis.total > 0 ? Math.round((n / kpis.total) * 100) : 0)

  /* ── Crear auditoría ── */

  const crearInforme = async () => {
    if (!nuevoInforme.usuario_id || !nuevoInforme.dependencia_id || !nuevoInforme.fecha_auditoria) {
      toast.error('Seleccione auditor, dependencia y fecha de auditoría')
      return
    }
    setCreating(true)
    try {
      const creado = await crearInformeApi({
        usuario_id: Number(nuevoInforme.usuario_id),
        dependencia_id: Number(nuevoInforme.dependencia_id),
        fecha_auditoria: toYMD(nuevoInforme.fecha_auditoria),
      })
      const item = (Array.isArray(creado) ? creado[0] : creado) || null
      await loadData()
      if (item?.id) setSelectedId(item.id)
      setNuevoInforme(NUEVO_INFORME_VACIO)
      setShowCreate(false)
      toast.success('Auditoría creada')
    } catch (e) {
      console.error(e)
      toast.error(e.message || 'Error al crear informe')
    } finally {
      setCreating(false)
    }
  }

  /* ── Render ── */

  return (
    <div className={PAGE_SHELL}>
      <PageHeader
        icon="📋"
        title="Administrar auditorías"
        subtitle="Gestión y seguimiento del proceso de auditoría"
        actions={
          <>
            <Button
              variant="secondary"
              onClick={loadData}
              disabled={loading}
              className="bg-white/15 text-white hover:bg-white/25"
            >
              <RefreshCw className={cn(loading && 'animate-spin')} />
              Actualizar
            </Button>
            {!soloLectura && (
              <Button variant="secondary" onClick={() => setShowCreate(true)}>
                <Plus />
                Nueva auditoría
              </Button>
            )}
          </>
        }
      />

      <FiltrosAuditorias
        filtros={filtros}
        onFiltro={setFiltro}
        checks={checks}
        onCheck={(flag, valor) => setChecks((prev) => ({ ...prev, [flag]: valor }))}
        dependencias={dependencias}
        auditores={auditores}
        anios={anios}
        mostradas={filtradas.length}
        total={auditorias.length}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon="📊" label="Total auditorías" value={kpis.total} tone="blue" />
        <StatCard
          icon="📄"
          label="Planes enviados"
          value={`${kpis.plan} · ${pct(kpis.plan)}%`}
          tone="purple"
        />
        <StatCard
          icon="✍️"
          label="Informes completos"
          value={`${kpis.informe} · ${pct(kpis.informe)}%`}
          tone="green"
        />
        <StatCard
          icon="✅"
          label="Validados"
          value={`${kpis.val} · ${pct(kpis.val)}%`}
          tone="indigo"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
        {/*
          La lista crece con lo que haya y, como mucho, llega hasta donde llega
          el panel de la auditoría abierta.

          Lo consigue el posicionamiento absoluto: así la lista no cuenta para
          la altura de la fila. Si contara, una lista larga estiraría la fila y
          el tope no existiría —la fila mide lo que mida el elemento más alto—.
          Sacándola del flujo, quien fija el alto es el panel de al lado, y el
          `h-fit` que ya trae la tarjeta hace que con pocas auditorías ocupe
          solo lo suyo en vez de estirarse vacía.

          El mínimo es para cuando no hay ninguna auditoría abierta: el aviso
          de «selecciona una auditoría» es una tarjeta de tres líneas y sin él
          la lista quedaría reducida a esa altura.

          Debajo de `lg` no aplica nada de esto: las columnas se apilan, no hay
          panel al lado con el que coincidir, y se mantiene el tope por
          pantalla de siempre.
        */}
        <div className="relative lg:min-h-[26rem]">
        <ListaAuditorias
          titulo="Auditorías"
          auditorias={filtradas}
          selectedId={selectedId}
          onSelect={setSelectedId}
          loading={loading}
          error={error}
          vacio="Sin resultados."
          className="max-h-[70vh] overflow-y-auto lg:absolute lg:inset-0 lg:max-h-full"
          badges={(a) => (
            <>
              {a.usuarios?.nombre && <BadgeMini>{a.usuarios.nombre}</BadgeMini>}
              {a.plan?.url && <BadgeMini tono="info">Plan</BadgeMini>}
              {isAuditValidated(a) && <BadgeMini tono="success">Validado</BadgeMini>}
            </>
          )}
        />
        </div>

        <main className="min-w-0">
          {!selected && !loading && (
            <div className={cn(SECTION_CARD, EMPTY_STATE)}>
              Selecciona una auditoría para ver su línea de tiempo.
            </div>
          )}

          {selected && (
            <section className={cn(SECTION_CARD, 'flex flex-col gap-5 p-5 sm:p-6')}>
              <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <h2 className="text-xl font-bold tracking-tight">
                    Auditoría #{selected.id}
                    <span className="font-medium text-muted-foreground">
                      {' '}
                      — {selected.dependencias?.nombre || 'Dependencia'}
                    </span>
                  </h2>

                  <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm text-muted-foreground">
                    {selected.usuarios && (
                      <span>
                        Auditor:{' '}
                        <strong className="text-foreground">
                          {selected.usuarios.nombre || ''} {selected.usuarios.apellido || ''}
                        </strong>
                      </span>
                    )}

                    <span>· Fecha:</span>
                    {editingDate ? (
                      <span className="inline-flex items-center gap-2">
                        {/* Sin `onKeyDown`: el disparador es un botón y ahí
                            Enter abre el calendario. Se guarda con el botón de
                            al lado, que está a la vista. */}
                        <DatePicker
                          value={dateDraft}
                          onChange={setDateDraft}
                          disabled={savingDate}
                          limpiable={false}
                          className="h-8 w-40"
                        />
                        <Button
                          size="sm"
                          onClick={saveFechaAuditoria}
                          disabled={savingDate || !dateDraft}
                        >
                          {savingDate ? 'Guardando…' : 'Guardar'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={cancelEditFecha}
                          disabled={savingDate}
                        >
                          Cancelar
                        </Button>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <strong className="text-foreground">
                          {fmt(parseYMD(selected.fecha_auditoria))}
                        </strong>
                        {!soloLectura && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={beginEditFecha}
                            title="Editar fecha"
                            className="h-7 w-7"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            <span className="sr-only">Editar fecha</span>
                          </Button>
                        )}
                      </span>
                    )}

                    {selected.asistencia_tipo && (
                      <span>
                        · Asistencia:{' '}
                        <strong className="text-foreground">{selected.asistencia_tipo}</strong>
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowDetail(true)}>
                    <FileText />
                    Ver más
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => novedades.abrir(selected)}>
                    <Sparkles />
                    Novedades
                  </Button>
                  {!soloLectura && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAEliminar(selected)}
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 />
                      Eliminar
                    </Button>
                  )}
                </div>
              </header>

              <EtapasTimeline etapas={timeline} formatoPlazo="corto" />
            </section>
          )}
        </main>
      </div>

      <ModalDetalleAuditoria
        auditoria={selected}
        open={showDetail && Boolean(selected)}
        onOpenChange={(o) => (o ? null : setShowDetail(false))}
        onAbrirUrl={openInNewTab}
      />

      <ModalNovedades
        auditoria={selected}
        novedades={novedades}
        soloLectura={soloLectura}
        onAbrirUrl={openInNewTab}
      />

      <ModalCrearAuditoria
        open={showCreate}
        onOpenChange={(o) => (o ? null : setShowCreate(false))}
        dependencias={dependenciasAll}
        auditores={auditoresAll}
        valores={nuevoInforme}
        onCambio={(campo, valor) => setNuevoInforme((prev) => ({ ...prev, [campo]: valor }))}
        onCrear={crearInforme}
        creando={creating}
      />

      {/* Confirmar borrado */}
      <Dialog open={Boolean(aEliminar)} onOpenChange={(o) => (o ? null : setAEliminar(null))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar auditoría</DialogTitle>
            <DialogDescription>
              Vas a eliminar la auditoría{' '}
              <span className="font-medium text-foreground">#{aEliminar?.id}</span> de{' '}
              {aEliminar?.dependencias?.nombre || 'la dependencia'}. Esta acción no se puede
              deshacer.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAEliminar(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmarEliminacion}>
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DocumentUploadModal
        isOpen={Boolean(subida.docAbierto) && Boolean(selected)}
        onClose={subida.cerrar}
        title={subida.doc?.titulo ?? ''}
        maxSizeMB={subida.doc?.maxSizeMB ?? 2}
        uploadButtonLabel={subida.doc?.etiquetaBoton ?? 'Subir'}
        currentFileUrl={selected?.[subida.doc?.campo]?.url ?? null}
        onUpload={subida.subir}
        isUploading={subida.subiendo}
      />

      {/* Editar informe: panel lateral, no diálogo — el formulario es largo y
          así el listado sigue a la vista detrás. */}
      <FormDrawer
        open={editModalOpen && Boolean(selected)}
        onOpenChange={(o) => (o ? null : setEditModalOpen(false))}
        title={`Informe de la auditoría #${selected?.id ?? ''}`}
        description={
          selected
            ? `${selected.dependencias?.nombre || 'Dependencia'} · ${
                selected.usuarios?.nombre || ''
              } ${selected.usuarios?.apellido || ''}`.trim()
            : undefined
        }
        // El formulario trae su propio `<form>` y su barra de guardar.
        hideFooter
      >
        {selected && (
          <FormularioRegistro
            embebido
            usuario={usuario}
            auditoria={selected}
            onSuccess={() => {
              setEditModalOpen(false)
              loadData()
            }}
            onVolver={() => setEditModalOpen(false)}
          />
        )}
      </FormDrawer>
    </div>
  )
}
