'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import FormularioRegistro from './FormularioRegistro'
import styles from '@/components/CSS/AuditoriasAsignadas.module.css'
import { generarInformeAuditoriaDocx } from '@/components/auditor/Utilidades/generarInformeAuditoria.jsx'

export default function AuditoriasAsignadas({ usuario, reset }) {
  const [auditorias, setAuditorias] = useState([])
  const [auditoriaSeleccionada, setAuditoriaSeleccionada] = useState(null)

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
          dependencia_id,
          dependencias ( nombre ),
          fortalezas ( id ),
          oportunidades_mejora ( id ),
          no_conformidades ( id )
        `)
        .eq('usuario_id', usuario.usuario_id)

      if (!error) setAuditorias(data)
      else console.error('Error cargando auditorías:', error)
    }

    cargarAsignadas()
  }, [usuario])

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
    return tieneHallazgos ? 100 : 50
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
      <h2 className={styles.titulo}>Auditorías asignadas</h2>

      {auditorias.length === 0 ? (
        <p className={styles.mensajeVacio}>No tienes auditorías asignadas.</p>
      ) : (
        auditorias.map((a) => {
          const progreso = progresoAuditoria(a)
          const nombreDep = a.dependencias?.nombre || 'Dependencia no encontrada'

          return (
            <div
              key={a.id}
              className={`${styles.card} ${progreso === 100 ? styles.cardCompleta : ''}`}
            >
              <div className={styles.cardContenido} onClick={() => setAuditoriaSeleccionada(a)}>
<p className={styles.nombreDep}>
  🏢 | {nombreDep} | 📅 {new Date(a.fecha_auditoria).getFullYear()} | 🧾 Auditoría #{a.id}
</p>



                <div className={styles.barraProgreso}>
                  <div
                    className={progreso === 100 ? styles.progresoVerde : styles.progresoAmarillo}
                    style={{ width: `${progreso}%` }}
                  ></div>
                </div>

                <p className={styles.estado}>
                  {progreso === 0 && '📝 Incompleta'}
                  {progreso === 50 && '🧩 Campos listos. Asignar hallazgos'}
                  {progreso === 100 && '✅ Informe con hallazgos cargados'}
                </p>
              </div>

              {progreso === 100 && (



                <button className={styles.botonDescarga} onClick={async (e) => {
                  e.stopPropagation();

                  const [fort, opor, noConfor] = await Promise.all([
                    supabase
                      .from('fortalezas')
                      .select(`
        *,
        iso:iso_id ( iso ),
        capitulo:capitulo_id ( capitulo ),
        numeral:numeral_id ( numeral )
      `)
                      .eq('informe_id', a.id),

                    supabase
                      .from('oportunidades_mejora')
                      .select(`
        *,
        iso:iso_id ( iso ),
        capitulo:capitulo_id ( capitulo ),
        numeral:numeral_id ( numeral )
      `)
                      .eq('informe_id', a.id),

                    supabase
                      .from('no_conformidades')
                      .select(`
        *,
        iso:iso_id ( iso ),
        capitulo:capitulo_id ( capitulo ),
        numeral:numeral_id ( numeral )
      `)
                      .eq('informe_id', a.id),
                  ]);

                  console.log('🧾 Informe:', a);
                  console.log('✅ Fortalezas:', fort.data);
                  console.log('✅ Oportunidades de mejora:', opor.data);
                  console.log('✅ No conformidades:', noConfor.data);
                  console.log('👤 Usuario:', usuario);

                  await generarInformeAuditoriaDocx(
                    a,
                    fort.data || [],
                    opor.data || [],
                    noConfor.data || [],
                    usuario
                  );
                }}>
                  📄 Descargar DOCX
                </button>


              )}
            </div>

          )
        })
      )}
    </div>
  )
}
