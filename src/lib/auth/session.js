/**
 * Sesión del lado servidor para Server Components.
 *
 * Es el equivalente de `@/lib/api/guard` pero para páginas: en vez de devolver
 * una respuesta HTTP, redirige. Sustituye al patrón anterior de leer el usuario
 * de `localStorage` en el cliente, que era falsificable.
 */
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { HOME_BY_ROLE, normalizeRole } from '@/lib/auth/roles'

const USUARIO_FIELDS =
  'usuario_id, nombre, apellido, email, rol, estado, auth_user_id, tipo_personal, dependencia_id'

/**
 * Devuelve el usuario autenticado y activo, o null.
 * El rol viene ya normalizado a minúsculas.
 */
export async function getCurrentUser() {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: usuario } = await supabaseAdmin()
    .from('usuarios')
    .select(USUARIO_FIELDS)
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (!usuario) return null

  const estado = String(usuario.estado ?? 'activo').trim().toLowerCase()
  if (estado !== 'activo') return null

  return { ...usuario, rol: normalizeRole(usuario.rol) }
}

/**
 * Exige uno de los roles indicados. Si no hay sesión manda al login; si el rol
 * no coincide, al panel que sí le corresponde.
 * @param {string[]} roles
 */
export async function requirePageRole(roles) {
  const usuario = await getCurrentUser()

  if (!usuario) redirect('/')

  const allowed = roles.map(normalizeRole)
  if (!allowed.includes(usuario.rol)) {
    redirect(HOME_BY_ROLE[usuario.rol] ?? '/')
  }

  return usuario
}
