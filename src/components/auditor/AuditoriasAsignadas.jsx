'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import FormularioRegistro from './FormularioRegistro'
import styles from '@/components/CSS/AuditoriasAsignadas.module.css'
import { generarInformeAuditoria } from '@/components/auditor/Utilidades/generarInformeAuditoria.jsx'
import { useSearchParams, useRouter } from 'next/navigation' // 👈 NUEVO

export default function AuditoriasAsignadas({ usuario, reset }) {
  const router = useRouter() // 👈 NUEVO
  const searchParams = useSearchParams() // 👈 NUEVO
  const informeIdParam = searchParams.get('informeId') // string | null  👈 NUEVO
  const directId = informeIdParam ? Number(informeIdParam) : null // 👈 NUEVO

  const [auditorias, setAuditorias] = useState([])
  const [auditoriaSeleccionada, setAuditoriaSeleccionada] = useState(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [archivo, setArchivo] = useState(null)
  const [auditoriaParaValidar, setAuditoriaParaValidar] = useState(null)
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
  }, [usuario, modalVisible])

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



  const subirArchivoValidacion = async () => {
    if (!archivo || !auditoriaParaValidar) return

    const filePath = buildValidationPath(auditoriaParaValidar) // 👈 ahora sí existe

    const { error: uploadError } = await supabase
      .storage
      .from('validaciones') // bucket
      .upload(filePath, archivo, {
        upsert: true,                    // opcional: permite re-subir
        contentType: 'application/pdf'
      })

    if (uploadError) {
      console.error('❌ Error subiendo archivo:', uploadError.message)
      return
    }

    await supabase.from('validaciones_informe').insert([
      { informe_id: auditoriaParaValidar.id, archivo_url: filePath }
    ])

    await supabase
      .from('informes_auditoria')
      .update({ validado: true })
      .eq('id', auditoriaParaValidar.id)

    setArchivo(null)
    setModalVisible(false)
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
    if (progreso === 0) return { text: 'Pendiente', cls: styles.pillPendiente }
    if (progreso === 50) return { text: 'En proceso', cls: styles.pillProceso }
    if (progreso === 80) return { text: 'Por validar', cls: styles.pillPorValidar }
    return { text: 'Validado', cls: styles.pillCompletado }
  }

  const SeccionAuditorias = ({ titulo, lista, className }) => {
    return (
      <div className={`${styles.seccion} ${className}`}>
        <h3 className={styles.subtituloSeccion}>{titulo}</h3>

        {lista.length === 0 ? (
          <div className={styles.mensajeVacio}>
            <p>🔍 No hay auditorías en esta sección.</p>
          </div>
        ) : (
          <div className={styles.gridAuditorias}>
            {lista.map((a) => {
              const progreso = progresoAuditoria(a)
              const nombreDep = a.dependencias?.nombre || 'Dependencia no encontrada'
              const hallFort = a.fortalezas?.length || 0
              const hallOpm = a.oportunidades_mejora?.length || 0
              const hallNC = a.no_conformidades?.length || 0
              const year = a.fecha_auditoria ? new Date(a.fecha_auditoria).getFullYear() : null
              const estado = estadoPill(progreso)

              const planEnlace = a.dependencias?.plan_auditoria?.[0]?.enlace || ''

              return (
                <div key={a.id} className={`${styles.card} ${progreso === 100 ? styles.cardCompleta : ''}`}>
                  {/* Header: nombre + estado + (plan) */}
                  <div className={styles.cardHeader}>
                    <div className={styles.cardTitleWrap}>
                      <div className={styles.cardTitle}>
                        <span className={styles.cardEmoji}>🏢</span> {nombreDep}
                      </div>
                      <span className={`${styles.pill} ${estado.cls}`}>{estado.text}</span>
                    </div>

                    {planEnlace && (
                      <a
                        href={planEnlace}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.btnPlanInline}
                        title="Abrir plan de auditoría"
                      >
                        🗂️ Plan de auditoría
                      </a>
                    )}
                  </div>

                  {/* Meta chips */}
                  <div className={styles.metaChips}>
                    <span className={styles.chip}>🧾 ID #{a.id}</span>
                    {progreso !== 0 && year && (
                      <>
                        <span className={styles.chip}>📅 Año {year}</span>
                        <span className={styles.chip}>🗓️ {formatFecha(a.fecha_auditoria)}</span>
                      </>
                    )}

                  </div>

                  {/* Progreso */}
                  <div className={styles.barraProgreso}>
                    <div
                      className={
                        progreso === 100
                          ? styles.progresoVerde
                          : progreso === 80
                            ? styles.progresoAzul
                            : styles.progresoAmarillo
                      }
                      style={{ width: `${progreso}%` }}
                    />
                  </div>

                  {/* Estado textual */}
                  <p className={styles.estado}>
                    {progreso === 0 && '📝 Incompleta'}
                    {progreso === 50 && '🧩 Campos listos. Asignar hallazgos'}
                    {progreso === 80 && '📥 Listo para validar'}
                    {progreso === 100 && '✅ Validado'}
                  </p>

                  {/* Acciones */}
                  <div className={styles.botonesAccion}>
                    {progreso < 100 && (
                      <button
                        className={styles.botonEditar}
                        onClick={() => setAuditoriaSeleccionada(a)}
                        title="Editar auditoría"
                      >
                        ✏️ Editar
                      </button>
                    )}

                    {progreso == 80 && (
                      <button
                        className={styles.botonDescarga}
                        onClick={async (e) => {
                          e.stopPropagation()
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
                          await generarInformeAuditoria(
                            a,
                            fort.data || [],
                            opor.data || [],
                            noConfor.data || [],
                            usuario
                          )
                        }}
                        title="Descargar informe"
                      >
                        📄 Descargar Informe
                      </button>
                    )}

                    {progreso == 100 && (
                      <button
                        className={styles.botonDescarga}
                        onClick={async (e) => {
                          e.stopPropagation()
                          e.preventDefault()
                          const ok = await descargarInformeValidadoPorId(a.id)
                          if (!ok) {
                            // fallback opcional...
                          }
                        }}
                        title="Descargar informe validado"
                      >
                        📄 Descargar Informe Validado
                      </button>
                    )}


                    {progreso === 80 && (
                      <button
                        className={styles.botonValidar}
                        onClick={(e) => {
                          e.stopPropagation()
                          setAuditoriaParaValidar(a)
                          setModalVisible(true)
                        }}
                        title="Validar informe"
                      >
                        ✅ Validar Informe
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }
  // 🚪 Gate de render cuando venimos con ?informeId=...
  if (directId) {
    if (loadingDirect) {
      return (
        <div className={styles.contenedor}>
          <div style={{ padding: 16 }}>Cargando formulario…</div>
        </div>
      )
    }
    if (notFoundDirect) {
      // Si el ID no pertenece al usuario o no existe, volvemos a la lista normal
      // (o muestra un aviso si prefieres)
    }
    if (auditoriaSeleccionada) {
      return (
        <FormularioRegistro
          usuario={usuario}
          auditoria={auditoriaSeleccionada}
          onVolver={handleVolver} 
        />
      )
    }

  }

  if (auditoriaSeleccionada) {
    return (
      <FormularioRegistro
        usuario={usuario}
        auditoria={auditoriaSeleccionada}
        onVolver={handleVolver}
      />
    )
  }


  return (
    <div className={styles.contenedor}>
      <div className={styles.encabezadoAuditor}>
        <div className={styles.resumenContenedor}>
          <div className={`${styles.resumenTarjeta} ${styles.tarjetaAsignadas}`}>
            <p className={styles.resumenTitulo}>Pendientes</p>
            <p className={styles.resumenNumero}>
              {auditorias.length - (agrupadas.porValidar.length + agrupadas.completadas.length + agrupadas.enProceso.length)}
            </p>
          </div>
          <div className={`${styles.resumenTarjeta} ${styles.tarjetaProceso}`}>
            <p className={styles.resumenTitulo}>En Proceso</p>
            <p className={styles.resumenNumero}>{agrupadas.enProceso.length}</p>
          </div>
          <div className={`${styles.resumenTarjeta} ${styles.tarjetaPorValidar}`}>
            <p className={styles.resumenTitulo}>Por Validar</p>
            <p className={styles.resumenNumero}>{agrupadas.porValidar.length}</p>
          </div>
          <div className={`${styles.resumenTarjeta} ${styles.tarjetaCompletadas}`}>
            <p className={styles.resumenTitulo}>Completadas</p>
            <p className={styles.resumenNumero}>{agrupadas.completadas.length}</p>
          </div>
        </div>
      </div>

      <div className={styles.dashboardLayout}>
        <SeccionAuditorias titulo="📋 Pendientes" lista={agrupadas.pendientes} className={styles.seccionPendientes} />
        <SeccionAuditorias titulo="🛠️ En Proceso" lista={agrupadas.enProceso} className={styles.seccionEnProceso} />
        <SeccionAuditorias titulo="📥 Por Validar" lista={agrupadas.porValidar} className={styles.seccionPorValidar} />
        <SeccionAuditorias titulo="✅ Completadas" lista={agrupadas.completadas} className={styles.seccionCompletadas} />
      </div>

      {modalVisible && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContenido}>
            <h3>📤 Subir informe firmado</h3>
            <label htmlFor="archivo" className={styles.dropArea}>
              <input
                id="archivo"
                type="file"
                accept="application/pdf"
                className={styles.inputArchivo}
                onChange={(e) => {
                  const file = e.target.files[0]
                  if (file && file.size > 1 * 1024 * 1024) {
                    alert('El archivo supera el tamaño máximo de 1MB.')
                    e.target.value = null
                    return
                  }
                  setArchivo(file)
                }}
              />
              {!archivo ? (
                <>
                  <div className={styles.iconoSubida}>📎</div>
                  <p className={styles.instrucciones}>
                    Arrastra el archivo aquí o haz clic para seleccionar<br />
                    <span className={styles.subtexto}>Solo PDF (máx. 2MB)</span>
                  </p>
                </>
              ) : (
                <p className={styles.nombreArchivo}>✅ {archivo.name}</p>
              )}
            </label>
            <div className={styles.modalBotones}>
              <button onClick={subirArchivoValidacion} className={styles.botonSubir}>Subir y Validar</button>
              <button onClick={() => setModalVisible(false)} className={styles.botonCancelar}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
