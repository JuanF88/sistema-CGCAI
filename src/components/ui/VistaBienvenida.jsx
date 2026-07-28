'use client'

/**
 * Pantalla de entrada del auditor: carrusel de noticias a sangre y resumen de
 * sus auditorías.
 *
 * El carrusel ocupa la mitad superior de la ventana; para llegar a los bordes
 * anula el padding del marco con `PAGE_BLEED`.
 */
import { useEffect, useState } from 'react'
import Image from 'next/image'
import Slider from 'react-slick'
import 'slick-carousel/slick/slick.css'
import 'slick-carousel/slick/slick-theme.css'

import { supabase } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { PAGE_BLEED } from '@/components/ui/tokens'

const NOTICIAS = [
  '/noticias/Banner 1 - Bienvenida.jpg',
  '/noticias/Banner 2 - Calidad.jpg',
  '/noticias/Banner 3 - Capacitaciones.jpg',
]

const SLIDER_SETTINGS = {
  dots: true,
  infinite: true,
  speed: 500,
  slidesToShow: 1,
  slidesToScroll: 1,
  autoplay: true,
  autoplaySpeed: 4000,
  arrows: false,
}

/**
 * Puntos del carrusel: los de serie son diminutos y grises sobre la imagen.
 * Se agrandan, se pasan a blanco y el activo se marca con el azul de marca.
 */
const DOTS = [
  '[&_.slick-dots]:bottom-5',
  '[&_.slick-dots_li]:mx-1.5',
  '[&_.slick-dots_li_button::before]:text-[14px]',
  '[&_.slick-dots_li_button::before]:text-white',
  '[&_.slick-dots_li_button::before]:opacity-70',
  '[&_.slick-dots_li_button::before]:drop-shadow',
  '[&_.slick-dots_li.slick-active_button::before]:text-[22px]',
  '[&_.slick-dots_li.slick-active_button::before]:text-primary',
  '[&_.slick-dots_li.slick-active_button::before]:opacity-100',
].join(' ')

/** Campos que cuentan para el progreso de una auditoría. */
const CAMPOS_PROGRESO = [
  'objetivo',
  'criterios',
  'conclusiones',
  'fecha_auditoria',
  'asistencia_tipo',
  'fecha_seguimiento',
  'recomendaciones',
  'auditores_acompanantes',
]

/**
 * Tarjetas del resumen. Los tonos son los pastel del diseño original, con su
 * equivalente en oscuro.
 */
const TARJETAS = [
  {
    key: 'pendientes',
    label: 'Pendientes',
    icono: '📋',
    ayuda: 'Sin empezar',
    clases:
      'border-l-rose-400 bg-rose-50 dark:border-l-rose-500 dark:bg-rose-950/30 [&_dd]:text-rose-700 dark:[&_dd]:text-rose-200',
    chip: 'bg-rose-100 text-rose-600 dark:bg-rose-900/60 dark:text-rose-200',
  },
  {
    key: 'enProceso',
    label: 'En proceso',
    icono: '⏳',
    ayuda: 'Informe a medias',
    clases:
      'border-l-amber-400 bg-amber-50 dark:border-l-amber-500 dark:bg-amber-950/30 [&_dd]:text-amber-700 dark:[&_dd]:text-amber-200',
    chip: 'bg-amber-100 text-amber-600 dark:bg-amber-900/60 dark:text-amber-200',
  },
  {
    key: 'porValidar',
    label: 'Por validar',
    icono: '🔍',
    ayuda: 'Falta el PDF firmado',
    clases:
      'border-l-violet-400 bg-violet-50 dark:border-l-violet-500 dark:bg-violet-950/30 [&_dd]:text-violet-700 dark:[&_dd]:text-violet-200',
    chip: 'bg-violet-100 text-violet-600 dark:bg-violet-900/60 dark:text-violet-200',
  },
  {
    key: 'completadas',
    label: 'Completadas',
    icono: '✅',
    ayuda: 'Validadas',
    clases:
      'border-l-emerald-400 bg-emerald-50 dark:border-l-emerald-500 dark:bg-emerald-950/30 [&_dd]:text-emerald-700 dark:[&_dd]:text-emerald-200',
    chip: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/60 dark:text-emerald-200',
  },
]

/** Tarjeta grande del resumen: icono, cifra y etiqueta. */
function TarjetaResumen({ tarjeta, valor }) {
  return (
    <article
      className={cn(
        'flex min-h-[168px] flex-col items-center justify-center gap-2 rounded-2xl border border-border border-l-[6px] p-6 text-center shadow-md',
        'transition-all duration-300 hover:-translate-y-1 hover:shadow-xl',
        tarjeta.clases
      )}
    >
      <span
        className={cn(
          'flex h-14 w-14 items-center justify-center rounded-2xl text-3xl',
          tarjeta.chip
        )}
        aria-hidden="true"
      >
        {tarjeta.icono}
      </span>

      <dl className="flex flex-col items-center">
        <dd className="text-5xl font-extrabold leading-none tabular-nums">{valor}</dd>
        <dt className="mt-2 text-base font-semibold text-foreground">{tarjeta.label}</dt>
      </dl>

      <p className="text-xs text-muted-foreground">{tarjeta.ayuda}</p>
    </article>
  )
}

export default function VistaBienvenida({ usuario }) {
  const [auditorias, setAuditorias] = useState([])

  const isAdmin =
    (usuario?.rol || '').toLowerCase() === 'admin' ||
    (usuario?.rol || '').toLowerCase() === 'administrador'

  useEffect(() => {
    if (isAdmin) return

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
  }, [usuario, isAdmin])

  const progresoAuditoria = (a) => {
    const completos = CAMPOS_PROGRESO.reduce((acc, campo) => (a[campo] ? acc + 1 : acc), 0)
    const tieneHallazgos =
      (a.fortalezas?.length || 0) > 0 ||
      (a.oportunidades_mejora?.length || 0) > 0 ||
      (a.no_conformidades?.length || 0) > 0

    if (completos < CAMPOS_PROGRESO.length) return 0
    if (tieneHallazgos && !a.validado) return 80
    if (tieneHallazgos && a.validado) return 100
    return 50
  }

  const agrupadas = {
    enProceso: auditorias.filter((a) => progresoAuditoria(a) === 50),
    porValidar: auditorias.filter((a) => progresoAuditoria(a) === 80),
    completadas: auditorias.filter((a) => progresoAuditoria(a) === 100),
  }

  const conteos = {
    pendientes:
      auditorias.length -
      (agrupadas.porValidar.length + agrupadas.completadas.length + agrupadas.enProceso.length),
    enProceso: agrupadas.enProceso.length,
    porValidar: agrupadas.porValidar.length,
    completadas: agrupadas.completadas.length,
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Carrusel de noticias, de borde a borde y ocupando media ventana */}
      <div className={cn(PAGE_BLEED, 'relative overflow-hidden bg-muted', DOTS)}>
        <Slider {...SLIDER_SETTINGS}>
          {NOTICIAS.map((src) => (
            <div key={src} className="relative h-[46vh] min-h-[280px] w-full lg:h-[58vh]">
              <Image
                src={src}
                alt=""
                fill
                sizes="100vw"
                className="object-cover"
                priority={src === NOTICIAS[0]}
              />
            </div>
          ))}
        </Slider>

        {/* Degradado inferior: separa la imagen del contenido y hace legibles los puntos. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/35 to-transparent" />
      </div>

      {/* Resumen de actividades */}
      <section className="flex flex-col gap-5">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Bienvenido de nuevo, <span className="text-primary">{usuario?.nombre}</span>
          </h2>
          {!isAdmin && (
            <p className="mt-1 text-sm text-muted-foreground">
              {auditorias.length === 0
                ? 'Todavía no tienes auditorías asignadas.'
                : `Tienes ${auditorias.length} auditoría${auditorias.length === 1 ? '' : 's'} asignada${auditorias.length === 1 ? '' : 's'}.`}
            </p>
          )}
        </div>

        {!isAdmin && (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
            {TARJETAS.map((tarjeta) => (
              <TarjetaResumen key={tarjeta.key} tarjeta={tarjeta} valor={conteos[tarjeta.key]} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
