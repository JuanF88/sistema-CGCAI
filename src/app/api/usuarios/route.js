import { requireRole } from '@/lib/api/guard'
import { withRoute } from '@/lib/api/handler'
import {
  ConflictError,
  fromPostgresError,
  NotFoundError,
  ValidationError,
} from '@/lib/api/errors'
import { created, json, ok } from '@/lib/api/response'
import { ROLES } from '@/lib/auth/roles'
import { sendCredentialsEmail } from '@/lib/notifications'
import {
  actualizarUsuarioSchema,
  crearUsuarioSchema,
  usuarioIdSchema,
} from '@/features/usuarios/dto/usuario-dto'

/**
 * Campos que devolvemos al cliente.
 * Nunca incluye `password`: esa columna solo existe para el login legacy
 * (ver docs/MIGRACION-PASSWORDS.md).
 */
const CAMPOS =
  'usuario_id, nombre, apellido, email, rol, estado, auth_user_id, tipo_personal, dependencia_id, estudios, tipo_estudio, celular'

const parseId = (request) =>
  usuarioIdSchema.parse(new URL(request.url).searchParams.get('id'))

// GET /api/usuarios?rol=auditor
export const GET = withRoute(async (request) => {
  const guard = await requireRole(ROLES.ADMIN)
  if (!guard.ok) return guard.response

  const rol = new URL(request.url).searchParams.get('rol')

  let query = guard.admin.from('usuarios').select(CAMPOS)
  if (rol) query = query.eq('rol', rol)

  const { data, error } = await query
  if (error) throw fromPostgresError(error)

  return json(data ?? [])
})

// POST /api/usuarios — crea en Supabase Auth y en la tabla `usuarios`.
export const POST = withRoute(async (request) => {
  const guard = await requireRole(ROLES.ADMIN)
  if (!guard.ok) return guard.response

  const admin = guard.admin
  const { sendCredentials, ...usuario } = crearUsuarioSchema.parse(await request.json())

  // PASO 1: crear en Supabase Auth.
  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email: usuario.email,
    password: usuario.password,
    email_confirm: true,
  })

  if (authError) {
    if (authError.message.includes('already registered')) {
      throw new ConflictError('Este correo ya está registrado en el sistema.')
    }
    throw new Error(authError.message)
  }

  // PASO 2: insertar en la tabla, vinculando con el usuario de Auth.
  const { data, error: dbError } = await admin
    .from('usuarios')
    .insert({ ...usuario, auth_user_id: authUser.user.id })
    .select(CAMPOS)
    .single()

  if (dbError) {
    // Si falla la tabla, deshacemos el usuario de Auth para no dejar huérfanos.
    await admin.auth.admin.deleteUser(authUser.user.id)
    throw fromPostgresError(dbError)
  }

  let notification = null

  if (sendCredentials) {
    const emailResult = await sendCredentialsEmail({
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      email: usuario.email,
      password: usuario.password,
    })

    notification = {
      channel: 'email',
      type: 'credentials_created_user',
      ...emailResult,
    }
  }

  return created({ ...data, notification })
})

// PUT /api/usuarios?id=123
export const PUT = withRoute(async (request) => {
  const guard = await requireRole(ROLES.ADMIN)
  if (!guard.ok) return guard.response

  const admin = guard.admin
  const id = parseId(request)
  const dto = actualizarUsuarioSchema.parse(await request.json())

  // Solo los campos que realmente llegaron: `undefined` significa "no tocar".
  const update = Object.fromEntries(
    Object.entries(dto).filter(([, value]) => value !== undefined)
  )

  if (Object.keys(update).length === 0) {
    throw new ValidationError('No hay campos para actualizar.')
  }

  const { data, error } = await admin
    .from('usuarios')
    .update(update)
    .eq('usuario_id', id)
    .select(CAMPOS)
    .single()

  if (error) throw fromPostgresError(error)
  if (!data) throw new NotFoundError('Usuario no encontrado.')

  // Si el admin cambió la contraseña, hay que reflejarlo también en Supabase
  // Auth. Sin esto el usuario solo podría entrar por el camino legacy.
  if (update.password && data.auth_user_id) {
    const { error: authUpdateError } = await admin.auth.admin.updateUserById(
      data.auth_user_id,
      { password: update.password }
    )

    if (authUpdateError) {
      console.error(
        '[PUT /api/usuarios] contraseña actualizada en la tabla pero no en Auth:',
        authUpdateError.message
      )
      return json({
        ...data,
        warning:
          'El usuario se actualizó, pero la contraseña no pudo sincronizarse con Supabase Auth.',
      })
    }
  }

  return json(data)
})

// DELETE /api/usuarios?id=123
export const DELETE = withRoute(async (request) => {
  const guard = await requireRole(ROLES.ADMIN)
  if (!guard.ok) return guard.response

  const id = parseId(request)

  const { data, error } = await guard.admin
    .from('usuarios')
    .delete()
    .eq('usuario_id', id)
    .select('usuario_id')
    .maybeSingle()

  if (error) throw fromPostgresError(error)
  if (!data) throw new NotFoundError('Usuario no encontrado')

  return ok({ ok: true, deleted: data })
})
