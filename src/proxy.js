/**
 * Proxy de Next.js (antes `middleware`).
 *
 * Hace dos cosas:
 *  1. Refresca la sesión de Supabase en cada request, para que las cookies no
 *     caduquen mientras el usuario navega.
 *  2. Protege las rutas por rol. Antes esto solo existía en el cliente
 *     (`localStorage.getItem('clienteLogueado')`), que cualquiera podía
 *     falsificar desde la consola del navegador.
 *
 * Las rutas de API no se bloquean aquí: cada una usa `requireRole()` de
 * `@/lib/api/guard`, que responde 401/403 en JSON en vez de redirigir.
 */
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { HOME_BY_ROLE, matchProtectedRoute, normalizeRole } from '@/lib/auth/roles'

export async function proxy(request) {
  let response = NextResponse.next({ request: { headers: request.headers } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value)
          })
          response = NextResponse.next({ request: { headers: request.headers } })
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { pathname } = request.nextUrl

  // `getUser` valida el JWT contra Supabase; `getSession` solo lee la cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const rule = matchProtectedRoute(pathname)

  // Ruta pública: solo se refrescó la sesión y seguimos.
  if (!rule) return response

  if (!user) {
    return redirectTo(request, '/')
  }

  const rol = await resolveRole(user.id)

  if (!rol || !rule.roles.includes(rol)) {
    // Autenticado pero en la sección equivocada: lo mandamos a su propio
    // panel; si no tiene rol conocido, al login.
    return redirectTo(request, HOME_BY_ROLE[rol] ?? '/')
  }

  return response
}

function redirectTo(request, pathname) {
  const url = request.nextUrl.clone()
  url.pathname = pathname
  url.search = ''
  return NextResponse.redirect(url)
}

/**
 * Lee el rol desde la tabla `usuarios`. Se hace con service-role porque
 * `usuarios` está bajo RLS y necesitamos el rol justamente para decidir qué
 * puede ver el usuario.
 */
async function resolveRole(authUserId) {
  // Excepción deliberada a la regla de "todo el env pasa por config/": el proxy
  // corre en el runtime edge y no conviene arrastrar ahí el módulo
  // `server-only` ni la validación de variables de SMTP que no usa.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    console.error('[proxy] Falta SUPABASE_SERVICE_ROLE_KEY: no se puede validar el rol.')
    return null
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data, error } = await admin
    .from('usuarios')
    .select('rol, estado')
    .eq('auth_user_id', authUserId)
    .maybeSingle()

  if (error || !data) return null

  const estado = String(data.estado ?? 'activo').trim().toLowerCase()
  if (estado !== 'activo') return null

  return normalizeRole(data.rol)
}

export const config = {
  matcher: [
    /*
     * Todas las rutas menos:
     * - _next/static, _next/image (assets del build)
     * - favicon.ico e imágenes estáticas
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
