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

  // Arranca desplegado y se corrige tras montar: leer `localStorage` durante el
  // render daría un HTML distinto en el servidor y en el cliente.
  const [plegado, setPlegado] = useState(false)

  useEffect(() => {
    setPlegado(localStorage.getItem(CLAVE_PLEGADO) === '1')
  }, [])

  const alternarPlegado = () =>
    setPlegado((antes) => {
      localStorage.setItem(CLAVE_PLEGADO, antes ? '0' : '1')
      return !antes
    })

  return (
    <div className="flex">
      <SpeedInsights />
      <Analytics />

      <aside
        className={cn(
          'fixed left-0 top-0 z-50 flex h-[100dvh] flex-col overflow-hidden',
          'bg-sidebar text-sidebar-foreground shadow-[2px_0_12px_rgba(0,0,0,0.2)]',
          'transition-[width,padding] duration-200 ease-out',
          plegado ? 'w-20 px-2 py-6' : 'w-72 p-6'
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

        <div className={cn('relative z-10 flex-1 overflow-y-auto', plegado && 'pt-10')}>
          <img
            src={avatarSrc || DEFAULT_AVATAR}
            alt={usuario?.nombre ? `Avatar de ${usuario.nombre}` : 'Avatar'}
            onError={onAvatarError}
            className={cn(
              'mx-auto rounded-full border-2 border-white object-cover transition-all duration-200',
              plegado ? 'mb-4 h-11 w-11' : 'mb-2 h-[150px] w-[150px]'
            )}
          />

          {/* Plegado no queda sitio para texto: solo iconos. */}
          {!plegado && (
            <>
              {usuario?.nombre && <p className="mb-2 text-center font-semibold">{usuario.nombre}</p>}

              {badge}

              {titulo && (
                <h2 className="mb-8 text-center text-2xl font-bold uppercase tracking-wide drop-shadow">
                  {titulo}
                </h2>
              )}
            </>
          )}

          <nav className={cn('flex flex-col', plegado ? 'gap-2' : 'gap-4')}>
            {nav.map((item) => {
              const Icon = item.icon
              const activo = isNavItemActive(item, vista)

              return (
                <button
                  key={item.key}
                  onClick={() => onVistaChange(item.key)}
                  aria-current={activo ? 'page' : undefined}
                  // Plegado, el rótulo del sistema es lo único que dice qué es
                  // cada icono.
                  title={plegado ? item.label : undefined}
                  className={cn(
                    'flex items-center whitespace-nowrap rounded-xl py-[0.7rem] text-left',
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
            'relative z-10 flex flex-col items-center',
            plegado ? 'mt-4 gap-3' : 'mt-8 gap-4'
          )}
        >
          <div className={cn('flex items-center justify-center', plegado ? 'gap-2' : 'gap-3')}>
            <img
              src="/logoBlanco.png"
              alt="Logo Universidad"
              className={cn('brightness-0 invert', plegado ? 'w-[26px]' : 'w-[60px]')}
            />
            <img
              src="/logosIcontec.png"
              alt="Logo Icontec"
              className={cn('brightness-0 invert', plegado ? 'w-[26px]' : 'w-[60px]')}
            />
          </div>

          <button
            onClick={() => cerrarSesionSupabase(router)}
            title={plegado ? 'Cerrar sesión' : undefined}
            className={cn(
              'flex items-center justify-center rounded-xl',
              'bg-sidebar-action font-semibold text-white',
              'transition-all duration-300 hover:scale-[1.02] hover:brightness-90 cursor-pointer',
              plegado ? 'h-9 w-9' : 'gap-2 px-4 py-2 text-[0.85rem]'
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
          plegado ? 'ml-20' : 'ml-72',
          PAGE_PADDING
        )}
      >
        {children}
      </main>
    </div>
  )
}
