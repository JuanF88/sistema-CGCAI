'use client'

import Image from 'next/image'
import Slider from 'react-slick'
import 'slick-carousel/slick/slick.css'
import 'slick-carousel/slick/slick-theme.css'
import styles from './CSS/VistaBienvenida.module.css'

const noticias = [
  {
    src: '/noticias/noticia1.jpg',
    titulo: 'Lanzamiento del nuevo sistema de auditoría',
    descripcion: 'Se implementó una nueva herramienta para la gestión interna con mejor control de procesos.',
  },
  {
    src: '/noticias/noticia2.png',
    titulo: 'Capacitación obligatoria',
    descripcion: 'Todos los auditores deben asistir al entrenamiento de procesos ISO la próxima semana.',
  },
  {
    src: '/noticias/noticia3.jpg',
    titulo: 'Reconocimiento al equipo',
    descripcion: 'El equipo de control interno recibió reconocimiento por su desempeño en 2024.',
  },
]

export default function VistaBienvenida({ usuario }) {
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

  return (
    <div className={styles.vistaContainer}>
      {/* Bienvenida */}
      <div className={styles.bienvenida}>
        <div className={styles.avatar}>
          <Image
            src="https://cdn-icons-png.flaticon.com/512/3135/3135715.png"
            alt="Auditor"
            fill
            className="object-cover"
          />
        </div>
        <h1 className={styles.nombreBienvenida}>¡Bienvenido, {usuario.nombre}!</h1>
      </div>

      {/* Noticias */}
      <div className={styles.noticiasContainer}>
        <h2 className={styles.noticiasTitulo}>
          Noticias recientes
          <span className={styles.decoracion}></span>
        </h2>

        <div className={styles.carrusel}>
          <Slider {...sliderSettings}>
            {noticias.map((noticia, index) => (
              <div key={index} className={styles.slide}>
                <Image
                  src={noticia.src}
                  alt={noticia.titulo}
                  fill
                  className="object-cover"
                />
                <div className={styles.slideOverlay}>
                  <h3 className={styles.slideTitulo}>{noticia.titulo}</h3>
                  <p className={styles.slideDescripcion}>{noticia.descripcion}</p>
                </div>
              </div>
            ))}
          </Slider>
        </div>
      </div>
    </div>
  )
}
