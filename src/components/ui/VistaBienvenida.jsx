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
import { CircleCheckBig, FileSearch, Hourglass, Inbox } from 'lucide-react'
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
 * Tarjetas del resumen.
 *
 * Los tonos siguen siendo los del diseño original, pero ya no tiñen la tarjeta
 * entera: cuatro fondos de color seguidos compiten entre sí y ninguno destaca.
 * El color queda en el icono, en el número y en la barra, que es donde informa.
 */
const TARJETAS = [
  {
    key: 'pendientes',
    label: 'Pendientes',
    Icono: Inbox,
    ayuda: 'Sin empezar',
    color: 'text-rose-500',
    cifra: 'text-rose-600 dark:text-rose-300',
    barra: 'bg-rose-500',
  },
  {
    key: 'enProceso',
    label: 'En proceso',
    Icono: Hourglass,
    ayuda: 'Informe a medias',
    color: 'text-amber-500',
    cifra: 'text-amber-600 dark:text-amber-300',
    barra: 'bg-amber-500',
  },
  {
    key: 'porValidar',
    label: 'Por validar',
    Icono: FileSearch,
    ayuda: 'Falta el PDF firmado',
    color: 'text-violet-500',
    cifra: 'text-violet-600 dark:text-violet-300',
    barra: 'bg-violet-500',
  },
  {
    key: 'completadas',
    label: 'Completadas',
    Icono: CircleCheckBig,
    ayuda: 'Validadas',
    color: 'text-emerald-500',
    cifra: 'text-emerald-600 dark:text-emerald-300',
    barra: 'bg-emerald-500',
  },
]

/**
 * Tarjeta del resumen: etiqueta, cifra y qué parte del total representa.
 *
 * La barra no es decoración: sin ella un «3» no dice si es de tres o de
 * treinta. Con cero auditorías asignadas se queda a cero en lugar de dividir
 * por cero.
 */
function TarjetaResumen({ tarjeta, valor, total }) {
  const { Icono } = tarjeta
  const porcentaje = total > 0 ? Math.round((valor / total) * 100) : 0

  return (
    <article
      className={cn(
        'flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm',
        'transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase leading-tight tracking-wide text-muted-foreground">
          {tarjeta.label}
        </p>
        <Icono className={cn('h-5 w-5 shrink-0', tarjeta.color)} aria-hidden="true" />
      </div>

      <dl>
        <dt className="sr-only">{tarjeta.label}</dt>
        <dd className={cn('text-4xl font-bold leading-none tabular-nums', tarjeta.cifra)}>
          {valor}
        </dd>
      </dl>

      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className={cn('h-full rounded-full transition-[width] duration-500', tarjeta.barra)}
            style={{ width: `${porcentaje}%` }}
          />
        </div>
        <span className="w-9 shrink-0 text-right text-[0.7rem] font-semibold tabular-nums text-muted-foreground">
          {porcentaje}%
        </span>
      </div>

      <p className="text-xs leading-tight text-muted-foreground">{tarjeta.ayuda}</p>
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
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-5">
            {TARJETAS.map((tarjeta) => (
              <TarjetaResumen
                key={tarjeta.key}
                tarjeta={tarjeta}
                valor={conteos[tarjeta.key]}
                total={auditorias.length}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
