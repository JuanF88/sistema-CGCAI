'use client'
import { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { supabase } from '@/lib/supabase/client'
import FormularioRegistro from '@/features/auditorias/components/FormularioRegistro'
import { generarInformeAuditoria } from '@/features/auditorias/utils/generarInformeAuditoria'
import { useSearchParams, useRouter } from 'next/navigation'
import { Eye, FilePen, Pencil } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import DocumentUploadModal from '@/components/ui/DocumentUploadModal'
import { FormDrawer } from '@/components/ui/form-drawer'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/components/ui/stat-card'
import {
  EMPTY_STATE,
  PAGE_SHELL,
  SECTION_CARD,
  STATUS_BADGE_TONES,
} from '@/components/ui/tokens'
import { cn } from '@/lib/utils'

export default function AuditoriasAsignadas({ usuario, reset }) {
  const router = useRouter() // 👈 NUEVO
  const searchParams = useSearchParams() // 👈 NUEVO
  const informeIdParam = searchParams.get('informeId') // string | null  👈 NUEVO
  const directId = informeIdParam ? Number(informeIdParam) : null // 👈 NUEVO

  const [auditorias, setAuditorias] = useState([])
  const [auditoriaSeleccionada, setAuditoriaSeleccionada] = useState(null)
  /** Se incrementa para volver a pedir la lista tras guardar un informe. */
  const [recarga, setRecarga] = useState(0)
  const [modalVisible, setModalVisible] = useState(false)
  const [auditoriaParaValidar, setAuditoriaParaValidar] = useState(null)
  const [subiendoValidacion, setSubiendoValidacion] = useState(false)
  const [loadingDirect, setLoadingDirect] = useState(!!directId) // 👈 NUEVO
  const [notFoundDirect, setNotFoundDirect] = useState(false) // 👈 NUEVO
  // === Helpers NOMBRE CONSISTENTE ===
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

  const handleVolver = () => {
    setAuditoriaSeleccionada(null)
    const params = new URLSearchParams(window.location.search)
    params.delete('informeId')
    if (!params.has('vista')) params.set('vista', 'asignadas')
    router.replace(`/auditor?${params.toString()}`)
  }


  /**
   * Devuelve SOLO el path dentro del bucket 'validaciones', sin prefijos extra.
   * Ej.: Auditoria_270_CIENCIA_POLITICA_PREGRADO_2025-09-25.pdf
   */
  const buildValidationPath = (auditoria) => {
    const dep = toSlugUpper(auditoria?.dependencias?.nombre || 'SIN_DEPENDENCIA')
    const ymd = toYMD(auditoria?.fecha_auditoria)
    return `Auditoria_${auditoria.id}_${dep}_${ymd}.pdf`
  }
  // SELECT reutilizable (igual al de la carga de lista)
  const SELECT_FIELDS = `
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
    fortalezas ( id ),
    oportunidades_mejora ( id ),
    no_conformidades ( id )
  `

  // 🔴 Prefetch directo por ID para evitar "flash" de la lista
  useEffect(() => {
    let cancelled = false
    const fetchDirect = async () => {
      if (!directId) return
      setLoadingDirect(true)
      setNotFoundDirect(false)
      try {
        const { data, error } = await supabase
          .from('informes_auditoria')
          .select(SELECT_FIELDS)
          .eq('usuario_id', usuario.usuario_id)
          .eq('id', directId)
          .single()

        if (error || !data) {
          if (!cancelled) setNotFoundDirect(true)
          return
        }
        if (!cancelled) setAuditoriaSeleccionada(data)
      } finally {
        if (!cancelled) setLoadingDirect(false)
      }
    }
    fetchDirect()
    return () => { cancelled = true }
  }, [directId, usuario?.usuario_id])


  useEffect(() => {
    setAuditoriaSeleccionada(null)
  }, [reset])

  useEffect(() => {
    const cargarAsignadas = async () => {
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
            plan_auditoria (
              enlace
            )
          ),
          fortalezas ( id ),
          oportunidades_mejora ( id ),
          no_conformidades ( id )
        `)
        .eq('usuario_id', usuario.usuario_id)

      if (!error) setAuditorias(data)
      else console.error('Error cargando auditorías:', error)
    }

    cargarAsignadas()
  }, [usuario, modalVisible, recarga])

  useEffect(() => {
    const qpId = Number(informeIdParam)
    if (!qpId || auditorias.length === 0) return
    const found = auditorias.find(a => a.id === qpId)
    if (found) setAuditoriaSeleccionada(found)
  }, [informeIdParam, auditorias])

  const contarCamposCompletos = (a) => {
    const campos = [
      'objetivo',
      'criterios',
      'conclusiones',
      'fecha_auditoria',
      'asistencia_tipo',
      'fecha_seguimiento',
      'recomendaciones',
      'auditores_acompanantes'
    ]
    return campos.reduce((acc, campo) => (a[campo] ? acc + 1 : acc), 0)
  }

  const progresoAuditoria = (a) => {
    const total = 8
    const completos = contarCamposCompletos(a)
    const tieneHallazgos =
      (a.fortalezas?.length || 0) > 0 ||
      (a.oportunidades_mejora?.length || 0) > 0 ||
      (a.no_conformidades?.length || 0) > 0

    if (completos < total) return 0
    if (tieneHallazgos && !a.validado) return 80
    if (tieneHallazgos && a.validado) return 100
    return 50
  }
  async function descargarInformeValidadoPorId(informeId) {
    try {
      const prefixes = ['']; // agrega subcarpetas si las usas, ej: ['2025', 'dependencias/XYZ']
      for (const prefix of prefixes) {
        const { data: items, error: listErr } = await supabase
          .storage
          .from('validaciones')
          .list(prefix, { limit: 100, sortBy: { column: 'name', order: 'asc' } })

        if (listErr) throw listErr
        if (!items || items.length === 0) continue

        // Busca un archivo cuyo nombre contenga el id del informe
        const hit = items.find(it => it.name && it.name.includes(String(informeId)))
        if (!hit) continue

        const path = prefix ? `${prefix}/${hit.name}` : hit.name
        const { data: signed, error: signErr } = await supabase
          .storage
          .from('validaciones')
          .createSignedUrl(path, 60 * 60) // URL válida 1 hora

        if (signErr || !signed?.signedUrl) {
          throw signErr || new Error('No se pudo firmar la URL.')
        }

        // 🔗 Abrir en NUEVA PESTAÑA con <a> (sin window.open)
        const url = signed.signedUrl
        const a = document.createElement('a')
        a.href = url
        a.target = '_blank'
        a.rel = 'noopener noreferrer'
        document.body.appendChild(a)
        a.click()
        a.remove()

        return true
      }

      // No se encontró el archivo
      toast.warn('Aún no hay un informe validado en el bucket para este informe.')
      return false
    } catch (err) {
      console.error('Descarga validado error:', err)
      toast.error('No se pudo descargar el informe validado.')
      return false
    }
  }



  /** Sube el PDF firmado y marca la auditoría como validada. */
  const subirArchivoValidacion = async (archivo) => {
    if (!archivo || !auditoriaParaValidar) return

    setSubiendoValidacion(true)
    try {
      const filePath = buildValidationPath(auditoriaParaValidar)

      const { error: uploadError } = await supabase.storage
        .from('validaciones')
        .upload(filePath, archivo, { upsert: true, contentType: 'application/pdf' })
      if (uploadError) throw uploadError

      await supabase
        .from('validaciones_informe')
        .insert([{ informe_id: auditoriaParaValidar.id, archivo_url: filePath }])

      const { error: updErr } = await supabase
        .from('informes_auditoria')
        .update({ validado: true })
        .eq('id', auditoriaParaValidar.id)
      if (updErr) throw updErr

      // Antes el estado local no se refrescaba: la tarjeta seguía en «Por
      // validar» hasta recargar la página.
      setAuditorias((prev) =>
        prev.map((a) =>
          a.id === auditoriaParaValidar.id ? { ...a, validado: true } : a
        )
      )

      toast.success('Informe validado.')
      setModalVisible(false)
      setAuditoriaParaValidar(null)
    } catch (e) {
      console.error('Error subiendo archivo:', e)
      toast.error(`No se pudo validar: ${e.message || 'error desconocido'}`)
    } finally {
      setSubiendoValidacion(false)
    }
  }


  const agrupadas = {
    pendientes: auditorias.filter(a => progresoAuditoria(a) === 0),
    enProceso: auditorias.filter(a => progresoAuditoria(a) === 50),
    porValidar: auditorias.filter(a => progresoAuditoria(a) === 80),
    completadas: auditorias.filter(a => progresoAuditoria(a) === 100),
  }

  const formatFecha = (isoDate) => {
    if (!isoDate) return ''
    const d = new Date(isoDate)
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const yyyy = d.getFullYear()
    return `${dd}/${mm}/${yyyy}`
  }

  const estadoPill = (progreso) => {
    if (progreso === 0) return { text: 'Pendiente', tono: 'neutral' }
    if (progreso === 50) return { text: 'En proceso', tono: 'warning' }
    if (progreso === 80) return { text: 'Por validar', tono: 'info' }
    return { text: 'Validado', tono: 'success' }
  }

  /** Color de la barra según el avance. */
  const barraProgreso = (progreso) => {
    if (progreso === 100) return 'bg-emerald-500'
    if (progreso === 80) return 'bg-sky-500'
    return 'bg-amber-500'
  }

  const TEXTO_ESTADO = {
    0: '📝 Incompleta',
    50: '🧩 Campos listos. Asignar hallazgos',
    80: '📥 Listo para validar',
    100: '✅ Validado',
  }

  /** Descarga el informe (borrador) de una auditoría. */
  const descargarBorrador = async (a) => {
    const [fort, opor, noConfor] = await Promise.all([
      supabase
        .from('fortalezas')
        .select(`*, iso:iso_id ( iso ), capitulo:capitulo_id ( capitulo ), numeral:numeral_id ( numeral )`)
        .eq('informe_id', a.id),
      supabase
        .from('oportunidades_mejora')
        .select(`*, iso:iso_id ( iso ), capitulo:capitulo_id ( capitulo ), numeral:numeral_id ( numeral )`)
        .eq('informe_id', a.id),
      supabase
        .from('no_conformidades')
        .select(`*, iso:iso_id ( iso ), capitulo:capitulo_id ( capitulo ), numeral:numeral_id ( numeral )`)
        .eq('informe_id', a.id),
    ])

    await generarInformeAuditoria(a, fort.data || [], opor.data || [], noConfor.data || [], usuario)
  }

  const SeccionAuditorias = ({ titulo, lista }) => (
    <section className={cn(SECTION_CARD, 'flex flex-col gap-3 p-4')}>
      <header className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{titulo}</h3>
        <Badge variant="secondary">{lista.length}</Badge>
      </header>

      {lista.length === 0 ? (
        <p className={EMPTY_STATE}>🔍 No hay auditorías en esta sección.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {lista.map((a) => {
            const progreso = progresoAuditoria(a)
            const nombreDep = a.dependencias?.nombre || 'Dependencia no encontrada'
            const year = a.fecha_auditoria ? new Date(a.fecha_auditoria).getFullYear() : null
            const estado = estadoPill(progreso)
            const planEnlace = a.dependencias?.plan_auditoria?.[0]?.enlace || ''

            return (
              <article
                key={a.id}
                className={cn(
                  'rounded-xl border border-border bg-card p-4 shadow-sm transition-all',
                  'hover:-translate-y-0.5 hover:shadow-md',
                  progreso === 100 && 'border-emerald-300'
                )}
              >
                <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 font-semibold leading-tight">
                      <span aria-hidden="true">🏢</span>
                      {nombreDep}
                    </p>
                    <Badge
                      variant="outline"
                      className={cn('mt-1', STATUS_BADGE_TONES[estado.tono])}
                    >
                      {estado.text}
                    </Badge>
                  </div>

                  {planEnlace && (
                    <a
                      href={planEnlace}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Abrir plan de auditoría"
                      className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                      🗂️ Plan de auditoría
                    </a>
                  )}
                </div>

                <div className="mb-3 flex flex-wrap gap-1.5">
                  <Badge variant="secondary">🧾 ID #{a.id}</Badge>
                  {progreso !== 0 && year && (
                    <>
                      <Badge variant="secondary">📅 {year}</Badge>
                      <Badge variant="secondary">🗓️ {formatFecha(a.fecha_auditoria)}</Badge>
                    </>
                  )}
                </div>

                <div className="mb-2 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn('h-full rounded-full transition-[width] duration-500', barraProgreso(progreso))}
                    style={{ width: `${progreso}%` }}
                    aria-label={`Avance ${progreso}%`}
                  />
                </div>

                <p className="mb-3 text-xs text-muted-foreground">{TEXTO_ESTADO[progreso]}</p>

                <div className="flex flex-wrap gap-2">
                  {/* Antes decía solo «Editar», que no decía qué se editaba. */}
                  <Button
                    variant={progreso === 0 ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setAuditoriaSeleccionada(a)}
                    title="Abre el formulario del informe de auditoría"
                  >
                    {progreso === 100 ? (
                      <>
                        <Eye />
                        Ver informe
                      </>
                    ) : progreso === 0 ? (
                      <>
                        <FilePen />
                        Llenar informe
                      </>
                    ) : (
                      <>
                        <Pencil />
                        Editar informe
                      </>
                    )}
                  </Button>

                  {progreso === 80 && (
                    <>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          descargarBorrador(a)
                        }}
                        title="Descargar informe"
                      >
                        📄 Descargar informe
                      </Button>

                      <Button
                        variant="success"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          setAuditoriaParaValidar(a)
                          setModalVisible(true)
                        }}
                        title="Validar informe"
                      >
                        ✅ Validar informe
                      </Button>
                    </>
                  )}

                  {progreso === 100 && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        e.preventDefault()
                        descargarInformeValidadoPorId(a.id)
                      }}
                      title="Descargar informe validado"
                    >
                      📄 Descargar validado
                    </Button>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )

  // 🚪 Gate de render cuando venimos con ?informeId=...
  if (directId) {
    if (loadingDirect) {
      return <p className="p-6 text-sm text-muted-foreground">Cargando formulario…</p>
    }

    // Antes esto era un `if` vacío: si el id no existía o no era del usuario,
    // caía a la lista sin decir nada.
    if (notFoundDirect) {
      return (
        <div className={PAGE_SHELL}>
          <div className={cn(SECTION_CARD, 'flex flex-col items-start gap-3 p-6')}>
            <h2 className="text-base font-semibold">Auditoría no encontrada</h2>
            <p className="text-sm text-muted-foreground">
              La auditoría #{directId} no existe o no está asignada a tu usuario.
            </p>
            <Button variant="outline" onClick={handleVolver}>
              Volver a mis auditorías
            </Button>
          </div>
        </div>
      )
    }

  }

  const pendientes =
    auditorias.length -
    (agrupadas.porValidar.length + agrupadas.completadas.length + agrupadas.enProceso.length)

  return (
    <div className={PAGE_SHELL}>
      <PageHeader
        icon="📋"
        title="Auditorías Internas"
        subtitle="Gestiona y realiza el seguimiento de tus auditorías asignadas"
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon="📋" tone="orange" label="Pendientes" value={pendientes} />
        <StatCard icon="🛠️" tone="blue" label="En proceso" value={agrupadas.enProceso.length} />
        <StatCard icon="📥" tone="purple" label="Por validar" value={agrupadas.porValidar.length} />
        <StatCard icon="✅" tone="green" label="Completadas" value={agrupadas.completadas.length} />
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <SeccionAuditorias titulo="📋 Pendientes" lista={agrupadas.pendientes} />
        <SeccionAuditorias titulo="🛠️ En proceso" lista={agrupadas.enProceso} />
        <SeccionAuditorias titulo="📥 Por validar" lista={agrupadas.porValidar} />
        <SeccionAuditorias titulo="✅ Completadas" lista={agrupadas.completadas} />
      </div>

      {/* El límite real siempre fue 1 MB; el texto del modal antiguo decía 2 MB. */}
      <DocumentUploadModal
        isOpen={modalVisible}
        onClose={() => setModalVisible(false)}
        title="Subir informe firmado"
        description="Se marcará la auditoría como validada."
        maxSizeMB={1}
        uploadButtonLabel="Subir y validar"
        onUpload={subirArchivoValidacion}
        isUploading={subiendoValidacion}
      />

      {/* Antes el formulario sustituía a la lista entera; ahora se abre encima
          y al cerrarlo sigues donde estabas. */}
      <FormDrawer
        open={Boolean(auditoriaSeleccionada)}
        onOpenChange={(o) => (o ? null : handleVolver())}
        title={`Informe de la auditoría #${auditoriaSeleccionada?.id ?? ''}`}
        description={auditoriaSeleccionada?.dependencias?.nombre || undefined}
        hideFooter
      >
        {auditoriaSeleccionada && (
          <FormularioRegistro
            embebido
            usuario={usuario}
            auditoria={auditoriaSeleccionada}
            onSuccess={() => {
              handleVolver()
              setRecarga((n) => n + 1)
            }}
            onVolver={handleVolver}
          />
        )}
      </FormDrawer>
    </div>
  )
}
