'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import Image from 'next/image'
import Slider from 'react-slick'
import 'slick-carousel/slick/slick.css'
import 'slick-carousel/slick/slick-theme.css'
import styles from './CSS/VistaBienvenida.module.css'

const noticias = [
  {
    src: '/noticias/noticia7.png'
  },
  {
    src: '/noticias/noticia8.png',
  },
  {
    src: '/noticias/noticia9.png',
  },
]

export default function VistaBienvenida({ usuario}) {
  const [auditorias, setAuditorias] = useState([])


  const sliderSettings = {
    dots: true,
    infinite: true,
    speed: 500,
    slidesToShow: 1,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 4000,
    arrows: false,
  }

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
    if (tieneHallazgos && !a.validado) return 80
    if (tieneHallazgos && a.validado) return 100
    return 50
  }

  const agrupadas = {
    pendientes: auditorias.filter(a => progresoAuditoria(a) === 0),
    enProceso: auditorias.filter(a => progresoAuditoria(a) === 50),
    porValidar: auditorias.filter(a => progresoAuditoria(a) === 80),
    completadas: auditorias.filter(a => progresoAuditoria(a) === 100),
  }

  const pendientes = auditorias.length - (
    (agrupadas.porValidar?.length || 0) +
    (agrupadas.completadas?.length || 0) +
    (agrupadas.enProceso?.length || 0)
  )

  return (
    <div className={styles.vistaContainer}>
      {/* Carrusel de noticias */}
      <div className={styles.carruselContainer}>
        <Slider {...sliderSettings}>
          {noticias.map((noticia, index) => (
            <div key={index} className={styles.slide}>
              <Image
                src={noticia.src}
                alt=""
                fill
                className={styles.slideImagen}
              />

            </div>
          ))}
        </Slider>
      </div>

      {/* Resumen de actividades */}
      <div className={styles.resumenContenedor}>
        <h2 className={styles.resumenTitulo}>Bienvenido de nuevo, <strong> {usuario.nombre} </strong></h2>
        
        <div className={styles.resumenTarjetas}>
          <div className={`${styles.resumenTarjeta} ${styles.tarjetaAsignadas}`}>
            <p className={styles.resumenLabel}>Pendientes</p>
            <p className={styles.resumenValor}>{pendientes}</p>
          </div>
          <div className={`${styles.resumenTarjeta} ${styles.tarjetaProceso}`}>
            <p className={styles.resumenLabel}>En Proceso</p>
            <p className={styles.resumenValor}>{agrupadas.enProceso?.length || 0}</p>
          </div>
          <div className={`${styles.resumenTarjeta} ${styles.tarjetaPorValidar}`}>
            <p className={styles.resumenLabel}>Por Validar</p>
            <p className={styles.resumenValor}>{agrupadas.porValidar?.length || 0}</p>
          </div>
          <div className={`${styles.resumenTarjeta} ${styles.tarjetaCompletadas}`}>
            <p className={styles.resumenLabel}>Completadas</p>
            <p className={styles.resumenValor}>{agrupadas.completadas?.length || 0}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
