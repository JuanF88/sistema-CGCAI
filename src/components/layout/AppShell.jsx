'use client'

/**
 * Marco autenticado: panel lateral + contenido.
 *
 * Antes había tres copias casi idénticas de esto (admin, auditor,
 * visualizador). Ahora hay una sola y cada panel le pasa su menú, su avatar y
 * su contenido. El menú vive en `@/components/layout/navigation`.
 */
import { useEffect, useState } from 'react'
import { ChevronsLeft, ChevronsRight, LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { Analytics } from '@vercel/analytics/next'

import { cerrarSesion as cerrarSesionSupabase } from '@/lib/auth/logout'
import { isNavItemActive } from '@/components/layout/navigation'
import { cn } from '@/lib/utils'
import { PAGE_PADDING } from '@/components/ui/tokens'

const DEFAULT_AVATAR = '/avatares/Silueta.png'

/**
 * Se recuerda si el panel quedó plegado.
 *
 * Quien lo pliega es porque trabaja en tablas anchas —el cronograma, el
 * desglose de archivos— y tener que plegarlo en cada visita sería peor que no
 * poder plegarlo.
 */
const CLAVE_PLEGADO = 'cgcai:panel-plegado'

/**
 * Por debajo de este ancho el panel desplegado se come el contenido.
 *
 * Un portátil de 1366 px deja 1.018 px útiles con el panel abierto y el
 * padding de página, y las tablas anchas del sistema —la malla de control, el
 * cronograma— piden más que eso. Así que por debajo de 1280 el panel arranca
 * plegado y, si se despliega, **flota** sobre el contenido en lugar de
 * empujarlo: el ancho de trabajo no cambia.
 */
const ANCHO_ESTRECHO = '(max-width: 1279px)'

/** Los dos logos del pie, que también ceden alto en pantallas bajas. */
const LOGO_ANCHO = 'w-[60px] pantalla-baja:w-[46px] pantalla-muy-baja:w-[38px]'

/**
 * Ancho del panel, proporcional a la ventana.
 *
 * Estaba clavado en 288 px, así que cuanto más pequeña la pantalla más parte
 * de ella se comía: en un monitor de 1920 son el 15 %, y en un portátil de
 * 1366, el 21 % — el menú engordaba justo donde menos sitio hay.
 *
 * Con `clamp` mantiene ese 18,75 % —los 288 px de una pantalla de 1536— y se
 * para en los extremos: nunca pasa de 288, para no desperdiciar monitor, ni
 * baja de 216, que es donde «Evaluación de Auditores» dejaría de caber en dos
 * renglones.
 *
 * Los dos valores van escritos enteros y no compuestos con una plantilla:
 * Tailwind busca las clases como texto en el código, y `w-[${medida}]` no lo
 * encuentra. **Si se cambia uno hay que cambiar el otro**, o el contenido se
 * mete debajo del panel o deja una franja vacía.
 */
const ANCHO_PANEL = 'w-[clamp(13.5rem,18.75vw,18rem)]'
const MARGEN_PANEL = 'ml-[clamp(13.5rem,18.75vw,18rem)]'

/** Plegado: solo iconos. 72 px dejan 56 de hueco, y el avatar mide 48. */
const ANCHO_RAIL = 'w-[4.5rem]'
const MARGEN_RAIL = 'ml-[4.5rem]'

/** Solo caracteres seguros para nombres de archivo/ruta. */
const sanitizePrefix = (s = '') =>
  String(s).trim().toLowerCase().replace(/[^a-z0-9._-]/g, '')

/** Ruta del avatar derivada del correo, con fallback a la silueta. */
export const avatarFor = (usuario) => {
  const email = usuario?.correo || usuario?.email || null
  const prefix = sanitizePrefix(email?.split('@')?.[0] || '')
  return prefix ? `/avatares/${prefix}.png` : DEFAULT_AVATAR
}

/**
 * @param {Object} props
 * @param {Object} props.usuario        Usuario ya verificado en el servidor
 * @param {Array}  props.nav            Ítems de `@/components/layout/navigation`
 * @param {string} props.vista          Vista activa
 * @param {(key: string) => void} props.onVistaChange
 * @param {string} props.basePath       `/admin`, `/auditor`, …
 * @param {string} [props.titulo]       Título bajo el avatar
 * @param {React.ReactNode} [props.badge] Etiqueta de rol
 * @param {string} [props.avatarSrc]
 * @param {() => void} [props.onAvatarError]
 */
export default function AppShell({
  usuario,
  nav,
  vista,
  onVistaChange,
  titulo,
  badge,
  avatarSrc,
  onAvatarError,
  children,
}) {
  const router = useRouter()

  // Arranca desplegado y se corrige tras montar: leer `localStorage` o medir la
  // ventana durante el render daría un HTML distinto en el servidor y en el
  // cliente.
  const [plegado, setPlegado] = useState(false)
  const [estrecho, setEstrecho] = useState(false)

  useEffect(() => {
    const consulta = window.matchMedia(ANCHO_ESTRECHO)

    const aplicar = () => {
      setEstrecho(consulta.matches)
      // La ventana manda sobre la preferencia, pero no la borra: al ensanchar
      // el panel vuelve a como lo dejó quien lo usa.
      setPlegado(consulta.matches || localStorage.getItem(CLAVE_PLEGADO) === '1')
    }

    aplicar()
    consulta.addEventListener('change', aplicar)
    return () => consulta.removeEventListener('change', aplicar)
  }, [])

  const alternarPlegado = () =>
    setPlegado((antes) => {
      // Estando estrecho, desplegar es asomarse un momento: flota sobre el
      // contenido y se cierra solo. No es una preferencia, así que no se
      // guarda.
      if (!estrecho) localStorage.setItem(CLAVE_PLEGADO, antes ? '0' : '1')
      return !antes
    })

  const flotando = estrecho && !plegado

  // Flotando, el panel tapa el contenido: cerrarlo con Escape es lo que se
  // espera de cualquier capa que tapa algo.
  useEffect(() => {
    if (!flotando) return
    const alPulsar = (e) => {
      if (e.key === 'Escape') setPlegado(true)
    }
    document.addEventListener('keydown', alPulsar)
    return () => document.removeEventListener('keydown', alPulsar)
  }, [flotando])

  /** Ir a una vista. Flotando, el panel se cierra al elegir. */
  const irA = (key) => {
    onVistaChange(key)
    if (estrecho) setPlegado(true)
  }

  return (
    <div className="flex">
      <SpeedInsights />
      <Analytics />

      {/* Solo cuando el panel flota: da dónde pulsar para cerrarlo y separa lo
          que tapa de lo que no. Desplegado a lo ancho no hace falta, porque
          entonces el panel no tapa nada. */}
      {flotando && (
        <div
          onClick={alternarPlegado}
          aria-hidden="true"
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px] animate-fade-in"
        />
      )}

      <aside
        className={cn(
          'fixed left-0 top-0 z-50 flex h-[100dvh] flex-col overflow-hidden',
          'bg-sidebar text-sidebar-foreground shadow-[2px_0_12px_rgba(0,0,0,0.2)]',
          'transition-[width,padding] duration-200 ease-out',
          plegado
            ? `${ANCHO_RAIL} px-2 py-6 pantalla-baja:py-4`
            : `${ANCHO_PANEL} p-6 pantalla-baja:px-5 pantalla-baja:py-4`,
          // Flotando conviene que se note que está por encima y no encajado.
          flotando && 'shadow-[6px_0_28px_rgba(0,0,0,0.35)]'
        )}
      >
        {/* Banner institucional de fondo */}
        <div className="bg-sidebar-banner pointer-events-none absolute inset-0 z-0" aria-hidden="true" />

        {/* Va dentro del panel y no montado sobre el borde porque el `aside`
            recorta lo que se sale, para que el banner del fondo no desborde.

            Y va en posición absoluta, fuera del flujo: en el flujo restaba su
            altura al menú y, con nueve entradas, eso bastaba para que
            apareciera una barra de desplazamiento donde antes cabía todo.
            Desplegado usa la esquina, que está libre porque el avatar es
            redondo; plegado no hay esquina libre y se centra arriba, con el
            hueco reservado más abajo. */}
        <button
          type="button"
          onClick={alternarPlegado}
          aria-expanded={!plegado}
          aria-label={plegado ? 'Desplegar el menú' : 'Plegar el menú'}
          title={plegado ? 'Desplegar el menú' : 'Plegar el menú'}
          className={cn(
            'absolute top-3 z-20 flex h-8 w-8 items-center justify-center rounded-lg',
            'text-sidebar-foreground/80 transition-colors hover:bg-white/20 hover:text-sidebar-foreground',
            'cursor-pointer',
            plegado ? 'left-1/2 -translate-x-1/2' : 'right-3'
          )}
        >
          {/* Dos puntas y no una: dicen «hasta el final», no «un paso atrás». */}
          {plegado ? <ChevronsRight className="h-5 w-5" /> : <ChevronsLeft className="h-5 w-5" />}
        </button>

        <div
          className={cn(
            'scroll-discreto relative z-10 flex-1 overflow-y-auto',
            plegado && 'pt-10'
          )}
        >
          {/* El avatar es lo primero que se recorta: es lo único del panel que
              no aporta información y ocupa lo que tres entradas de menú. */}
          <img
            src={avatarSrc || DEFAULT_AVATAR}
            alt={usuario?.nombre ? `Avatar de ${usuario.nombre}` : 'Avatar'}
            onError={onAvatarError}
            className={cn(
              'mx-auto rounded-full border-2 border-white object-cover transition-all duration-200',
              plegado
                ? 'mb-4 h-11 w-11'
                : [
                    'mb-2 h-[150px] w-[150px]',
                    'pantalla-baja:h-[104px] pantalla-baja:w-[104px]',
                    'pantalla-muy-baja:h-[84px] pantalla-muy-baja:w-[84px]',
                  ]
            )}
          />

          {/* Plegado no queda sitio para texto: solo iconos. */}
          {!plegado && (
            <>
              {usuario?.nombre && <p className="mb-2 text-center font-semibold">{usuario.nombre}</p>}

              {badge}

              {titulo && (
                <h2
                  className={cn(
                    'mb-8 text-center text-2xl font-bold uppercase tracking-wide drop-shadow',
                    'pantalla-baja:mb-4 pantalla-baja:text-xl',
                    'pantalla-muy-baja:mb-3 pantalla-muy-baja:text-lg'
                  )}
                >
                  {titulo}
                </h2>
              )}
            </>
          )}

          <nav
            className={cn(
              'flex flex-col',
              plegado
                ? 'gap-2 pantalla-muy-baja:gap-1.5'
                : 'gap-4 pantalla-baja:gap-2 pantalla-muy-baja:gap-1.5'
            )}
          >
            {nav.map((item) => {
              const Icon = item.icon
              const activo = isNavItemActive(item, vista)

              return (
                <button
                  key={item.key}
                  onClick={() => irA(item.key)}
                  aria-current={activo ? 'page' : undefined}
                  // Plegado, el rótulo del sistema es lo único que dice qué es
                  // cada icono.
                  title={plegado ? item.label : undefined}
                  className={cn(
                    'flex items-center whitespace-nowrap rounded-xl py-[0.7rem] text-left',
                    'pantalla-baja:py-2 pantalla-muy-baja:py-1.5',
                    'font-medium transition-all duration-200 cursor-pointer',
                    'hover:bg-white/20',
                    plegado ? 'justify-center px-0' : 'gap-3 px-4',
                    activo && 'bg-white/30 shadow-[inset_0_0_5px_rgba(255,255,255,0.2)]'
                  )}
                >
                  <Icon className={cn('shrink-0', plegado ? 'h-5 w-5' : 'h-[15px] w-[15px]')} />
                  {!plegado && <span className="text-[0.9rem] leading-tight">{item.label}</span>}
                </button>
              )
            })}
          </nav>
        </div>

        <div
          className={cn(
            'relative z-10 flex shrink-0 flex-col items-center',
            plegado
              ? 'mt-4 gap-3 pantalla-baja:mt-3 pantalla-baja:gap-2'
              : 'mt-8 gap-4 pantalla-baja:mt-4 pantalla-baja:gap-2.5'
          )}
        >
          <div className={cn('flex items-center justify-center', plegado ? 'gap-2' : 'gap-3')}>
            <img
              src="/logoBlanco.png"
              alt="Logo Universidad"
              className={cn('brightness-0 invert', plegado ? 'w-[26px]' : LOGO_ANCHO)}
            />
            <img
              src="/logosIcontec.png"
              alt="Logo Icontec"
              className={cn('brightness-0 invert', plegado ? 'w-[26px]' : LOGO_ANCHO)}
            />
          </div>

          <button
            onClick={() => cerrarSesionSupabase(router)}
            title={plegado ? 'Cerrar sesión' : undefined}
            className={cn(
              'flex items-center justify-center rounded-xl',
              'bg-sidebar-action font-semibold text-white',
              'transition-all duration-300 hover:scale-[1.02] hover:brightness-90 cursor-pointer',
              plegado
                ? 'h-9 w-9'
                : 'gap-2 px-4 py-2 text-[0.85rem] pantalla-muy-baja:py-1.5'
            )}
          >
            <LogOut size={16} />
            {!plegado && 'Cerrar sesión'}
            {plegado && <span className="sr-only">Cerrar sesión</span>}
          </button>
        </div>
      </aside>

      {/* El padding del contenido lo pone SIEMPRE el marco; las pantallas no lo
          repiten. Para que algo llegue a los bordes está el token PAGE_BLEED. */}
      <main
        className={cn(
          'min-h-screen flex-1 overflow-y-auto bg-app',
          'transition-[margin] duration-200 ease-out',
          // `estrecho` deja el margen corto aunque el panel esté desplegado:
          // ahí flota, y el contenido conserva su ancho.
          plegado || estrecho ? MARGEN_RAIL : MARGEN_PANEL,
          PAGE_PADDING
        )}
      >
        {children}
      </main>
    </div>
  )
}
