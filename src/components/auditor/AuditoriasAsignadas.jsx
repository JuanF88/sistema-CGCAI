'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import FormularioRegistro from './FormularioRegistro'
import styles from '@/components/CSS/AuditoriasAsignadas.module.css'
import { generarInformeAuditoria } from '@/components/auditor/Utilidades/generarInformeAuditoria.jsx'

export default function AuditoriasAsignadas({ usuario, reset }) {
  const [auditorias, setAuditorias] = useState([])
  const [auditoriaSeleccionada, setAuditoriaSeleccionada] = useState(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [archivo, setArchivo] = useState(null)
  const [auditoriaParaValidar, setAuditoriaParaValidar] = useState(null)

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

  const subirArchivoValidacion = async () => {
    if (!archivo || !auditoriaParaValidar) return

    const nombreDep = auditoriaParaValidar.dependencias?.nombre
      ?.normalize('NFD')
      ?.replace(/[\u0300-\u036f]/g, '')
      ?.replace(/\s+/g, '_')
      ?.replace(/[^a-zA-Z0-9_-]/g, '') || 'desconocido';
    const filePath = `validaciones/Auditoria_${auditoriaParaValidar.id}_${nombreDep}_${new Date().toISOString().split('T')[0]}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from('validaciones')
      .upload(filePath, archivo)

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

            return (
              <div key={a.id} className={`${styles.card} ${progreso === 100 ? styles.cardCompleta : ''}`}>
                {a.dependencias?.plan_auditoria?.[0]?.enlace && (
                  <a
                    href={a.dependencias.plan_auditoria[0].enlace}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.botonPlanFlotante}
                  >
                    🗂️ Plan de auditoría encontrado
                  </a>
                )}

                <div className={styles.cardContenido}>
                  <p className={styles.nombreDep}>
                    🏢 | {nombreDep} | 📅 {new Date(a.fecha_auditoria).getFullYear()} | 🧾 Auditoría #{a.id}
                  </p>

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
                    ></div>
                  </div>

                  <p className={styles.estado}>
                    {progreso === 0 && '📝 Incompleta'}
                    {progreso === 50 && '🧩 Campos listos. Asignar hallazgos'}
                    {progreso === 80 && '📥 Listo para validar'}
                    {progreso === 100 && '✅ Validado'}
                  </p>

                  <div className={styles.botonesAccion}>
                    {progreso < 100 && (
                      <button className={styles.botonEditar} onClick={() => setAuditoriaSeleccionada(a)}>
                        ✏️ Editar
                      </button>
                    )}

                    {progreso >= 80 && (
                      <button className={styles.botonDescarga} onClick={async (e) => {
                        e.stopPropagation();
                        const [fort, opor, noConfor] = await Promise.all([
                          supabase.from('fortalezas').select(`*, iso:iso_id ( iso ), capitulo:capitulo_id ( capitulo ), numeral:numeral_id ( numeral )`).eq('informe_id', a.id),
                          supabase.from('oportunidades_mejora').select(`*, iso:iso_id ( iso ), capitulo:capitulo_id ( capitulo ), numeral:numeral_id ( numeral )`).eq('informe_id', a.id),
                          supabase.from('no_conformidades').select(`*, iso:iso_id ( iso ), capitulo:capitulo_id ( capitulo ), numeral:numeral_id ( numeral )`).eq('informe_id', a.id),
                        ])
                        await generarInformeAuditoria(
                          a,
                          fort.data || [],
                          opor.data || [],
                          noConfor.data || [],
                          usuario
                        )
                      }}>
                        📄 Descargar Infome
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
                      >
                        ✅ Validar Informe
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}


  if (auditoriaSeleccionada) {
    return (
      <FormularioRegistro
        usuario={usuario}
        auditoria={auditoriaSeleccionada}
        onVolver={() => setAuditoriaSeleccionada(null)}
      />
    )
  }

  return (
    <div className={styles.contenedor}>
      <div className={styles.encabezadoAuditor}>
        <h1 className={styles.nombreBienvenida}>Administrador de Auditorías</h1>
        <div className={styles.resumenContenedor}>
          <div className={`${styles.resumenTarjeta} ${styles.tarjetaAsignadas}`}>
            <p className={styles.resumenTitulo}>Pendientes</p>
            <p className={styles.resumenNumero}>{auditorias.length - (agrupadas.porValidar.length + agrupadas.completadas.length + agrupadas.enProceso.length)}</p>
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
