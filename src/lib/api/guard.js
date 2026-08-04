/**
 * Guard de autenticación y autorización para las rutas de API.
 *
 * Sustituye el bloque de ~10 líneas que estaba copiado en cada handler
 * (verificar sesión → leer rol → instanciar service-role).
 *
 * Uso:
 *
 *   const guard = await requireRole(ROLES.ADMIN)
 *   if (!guard.ok) return guard.response
 *   const { usuario, supabase, admin } = guard
 *
 * - `supabase` → cliente ligado a la sesión, respeta RLS.
 * - `admin`    → cliente service-role, se salta RLS. Úsalo solo cuando haga falta.
 */
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { normalizeRole } from '@/lib/auth/roles'
import { forbidden, unauthorized } from '@/lib/api/response'
import { getCronSecrets } from '@/lib/config/env.server'

/** Columnas del usuario que exponemos internamente. Nunca incluye `password`. */
const USUARIO_FIELDS =
  'usuario_id, nombre, apellido, email, rol, estado, auth_user_id, tipo_personal, dependencia_id'

const deny = (response) => ({ ok: false, response })

/**
 * Exige una sesión válida y un usuario activo en la tabla `usuarios`.
 * @returns {Promise<{ok: true, supabase, admin, user, usuario, rol: string} | {ok: false, response: Response}>}
 */
export async function requireAuth() {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return deny(unauthorized())
  }

  const admin = supabaseAdmin()

  // Leemos el perfil con service-role: la propia tabla `usuarios` está bajo
  // RLS y necesitamos el rol para poder decidir qué se permite.
  const { data: usuario, error: dbError } = await admin
    .from('usuarios')
    .select(USUARIO_FIELDS)
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (dbError) {
    console.error('[guard] error leyendo usuario:', dbError.message)
    return deny(unauthorized('No se pudo verificar la sesión'))
  }

  if (!usuario) {
    return deny(forbidden('El usuario no está registrado en el sistema'))
  }

  const estado = String(usuario.estado ?? 'activo').trim().toLowerCase()
  if (estado !== 'activo') {
    return deny(forbidden('El usuario está inactivo'))
  }

  return {
    ok: true,
    supabase,
    admin,
    user,
    usuario,
    rol: normalizeRole(usuario.rol),
  }
}

/**
 * Igual que `requireAuth` pero además exige uno de los roles indicados.
 * @param {string|string[]} roles
 */
export async function requireRole(roles) {
  const session = await requireAuth()
  if (!session.ok) return session

  const allowed = (Array.isArray(roles) ? roles : [roles]).map(normalizeRole)

  if (!allowed.includes(session.rol)) {
    return deny(forbidden())
  }

  return session
}

/**
 * Autoriza una petición de cron de Vercel mediante secreto compartido, con
 * respaldo en una sesión de admin para poder dispararla desde el panel.
 * @param {Request} request
 */
export async function requireCronOrRole(request, roles) {
  const secrets = getCronSecrets()

  if (secrets.length > 0) {
    // Mismo orden de precedencia que la implementación original: primero la
    // cabecera propia, luego el Bearer que envía el cron de Vercel.
    const provided =
      request.headers.get('x-cron-secret') ||
      request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
      ''

    if (provided && secrets.includes(provided)) {
      return { ok: true, viaCron: true, admin: supabaseAdmin() }
    }
  }

  const session = await requireRole(roles)
  if (!session.ok) return session

  return { ...session, viaCron: false }
}
