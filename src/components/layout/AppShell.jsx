'use client'

/**
 * Marco autenticado: panel lateral + contenido.
 *
 * Antes había tres copias casi idénticas de esto (admin, auditor,
 * visualizador). Ahora hay una sola y cada panel le pasa su menú, su avatar y
 * su contenido. El menú vive en `@/components/layout/navigation`.
 */
import { LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { Analytics } from '@vercel/analytics/next'

import { cerrarSesion as cerrarSesionSupabase } from '@/lib/auth/logout'
import { isNavItemActive } from '@/components/layout/navigation'
import { cn } from '@/lib/utils'
import { PAGE_PADDING } from '@/components/ui/tokens'

const DEFAULT_AVATAR = '/avatares/Silueta.png'

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

  return (
    <div className="flex">
      <SpeedInsights />
      <Analytics />

      <aside
        className={cn(
          'fixed left-0 top-0 z-50 flex h-[100dvh] w-72 flex-col overflow-hidden p-6',
          'bg-sidebar text-sidebar-foreground shadow-[2px_0_12px_rgba(0,0,0,0.2)]'
        )}
      >
        {/* Banner institucional de fondo */}
        <div className="bg-sidebar-banner pointer-events-none absolute inset-0 z-0" aria-hidden="true" />

        <div className="relative z-10 flex-1 overflow-y-auto">
          <img
            src={avatarSrc || DEFAULT_AVATAR}
            alt={usuario?.nombre ? `Avatar de ${usuario.nombre}` : 'Avatar'}
            onError={onAvatarError}
            className="mx-auto mb-2 h-[150px] w-[150px] rounded-full border-2 border-white object-cover"
          />

          {usuario?.nombre && (
            <p className="mb-2 text-center font-semibold">{usuario.nombre}</p>
          )}

          {badge}

          {titulo && (
            <h2 className="mb-8 text-center text-2xl font-bold uppercase tracking-wide drop-shadow">
              {titulo}
            </h2>
          )}

          <nav className="flex flex-col gap-4">
            {nav.map((item) => {
              const Icon = item.icon
              const activo = isNavItemActive(item, vista)

              return (
                <button
                  key={item.key}
                  onClick={() => onVistaChange(item.key)}
                  aria-current={activo ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-3 whitespace-nowrap rounded-xl px-4 py-[0.7rem] text-left',
                    'font-medium transition-all duration-200 cursor-pointer',
                    'hover:bg-white/20',
                    activo && 'bg-white/30 shadow-[inset_0_0_5px_rgba(255,255,255,0.2)]'
                  )}
                >
                  <Icon className="h-[15px] w-[15px] shrink-0" />
                  <span className="text-[0.9rem] leading-tight">{item.label}</span>
                </button>
              )
            })}
          </nav>
        </div>

        <div className="relative z-10 mt-8 flex flex-col items-center gap-4">
          <div className="flex items-center justify-center gap-3">
            <img src="/logoBlanco.png" alt="Logo Universidad" className="w-[60px] brightness-0 invert" />
            <img src="/logosIcontec.png" alt="Logo Icontec" className="w-[60px] brightness-0 invert" />
          </div>

          <button
            onClick={() => cerrarSesionSupabase(router)}
            className={cn(
              'flex items-center justify-center gap-2 rounded-xl px-4 py-2',
              'bg-sidebar-action text-[0.85rem] font-semibold text-white',
              'transition-all duration-300 hover:scale-[1.02] hover:brightness-90 cursor-pointer'
            )}
          >
            <LogOut size={16} /> Cerrar sesión
          </button>
        </div>
      </aside>

      {/* El padding del contenido lo pone SIEMPRE el marco; las pantallas no lo
          repiten. Para que algo llegue a los bordes está el token PAGE_BLEED. */}
      <main className={cn('ml-72 min-h-screen flex-1 overflow-y-auto bg-app', PAGE_PADDING)}>
        {children}
      </main>
    </div>
  )
}
