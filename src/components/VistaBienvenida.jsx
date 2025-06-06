'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import Slider from 'react-slick'
import 'slick-carousel/slick/slick.css'
import 'slick-carousel/slick/slick-theme.css'

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
    <div className="bg-white p-10 rounded-3xl shadow-2xl animate-fade-in max-w-6xl mx-auto space-y-10 border border-gray-200">
      {/* Bienvenida */}
      <div className="flex items-center gap-6">
        <div className="relative w-28 h-28 rounded-full shadow-xl border-4 border-sky-400 overflow-hidden">
          <Image
            src="https://cdn-icons-png.flaticon.com/512/3135/3135715.png"
            alt="Auditor"
            fill
            className="object-cover"
          />
        </div>
        <div>
          <h1 className="text-4xl font-extrabold text-sky-700 leading-tight drop-shadow">
            ¡Bienvenido, {usuario.nombre}!
          </h1>
          <p className="text-gray-600 text-lg mt-1">
            Dependencia:{' '}
            <span className="font-semibold text-gray-800">
              {usuario.dependencia || 'No registrada'}
            </span>
          </p>
        </div>
      </div>


{/* Noticias */}
<div className="mb-12">
  {/* Título centrado */}
  <h2 className="text-3xl font-extrabold text-sky-700 text-center mb-8 tracking-wide relative inline-block w-full">
    Noticias recientes
    <span className="block w-16 h-1 bg-sky-400 mt-2 mx-auto rounded-full"></span>
  </h2>

  {/* Carrusel centrado con límite grande */}
  <div className="max-w-6xl mx-auto px-4">
    <Slider {...sliderSettings}>
      {noticias.map((noticia, index) => (
        <div key={index} className="relative h-[600px]">
          <Image
            src={noticia.src}
            alt={noticia.titulo}
            fill
            className="object-cover rounded-2xl shadow-md"
          />
          <div className="absolute inset-0 bg-black/20 rounded-2xl flex flex-col justify-end p-6 text-white">
            <h3 className="text-2xl font-bold mb-2 drop-shadow">{noticia.titulo}</h3>
            <p className="text-sm text-gray-200">{noticia.descripcion}</p>
          </div>
        </div>
      ))}
    </Slider>
  </div>
</div>


    </div>

    
  )
}
