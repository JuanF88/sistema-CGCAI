import { requireAuth, requireRole } from '@/lib/api/guard'
import { withRoute } from '@/lib/api/handler'
import { fromPostgresError, NotFoundError } from '@/lib/api/errors'
import { created, json, ok } from '@/lib/api/response'
import { ROLES } from '@/lib/auth/roles'
import {
  actualizarDependenciaSchema,
  crearDependenciaSchema,
  dependenciaIdSchema,
} from '@/features/dependencias/dto/dependencia-dto'

const CAMPOS = 'dependencia_id, nombre, gestion'

/**
 * Las escrituras van con `admin` (service-role), no con el cliente de sesión.
 *
 * `dependencias` está bajo RLS y sus políticas solo cubren SELECT: con el
 * cliente ligado a la sesión, cualquier INSERT/UPDATE/DELETE lo rechazaba la
 * política, aunque quien lo pidiera fuera admin. Quién puede escribir ya lo
 * decide `requireRole(ROLES.ADMIN)` unas líneas más arriba, que es donde vive
 * la autorización en el resto del proyecto.
 */

/** Lee y valida el `?id=` de la query. */
const parseId = (request) =>
  dependenciaIdSchema.parse(new URL(request.url).searchParams.get('id'))

// GET /api/dependencias — cualquier usuario autenticado puede leer el catálogo.
export const GET = withRoute(async () => {
  const guard = await requireAuth()
  if (!guard.ok) return guard.response

  const { data, error } = await guard.admin
    .from('dependencias')
    .select(CAMPOS)
    .order('nombre', { ascending: true })

  if (error) throw fromPostgresError(error)

  return json(data ?? [])
})

// POST /api/dependencias
export const POST = withRoute(async (request) => {
  const guard = await requireRole(ROLES.ADMIN)
  if (!guard.ok) return guard.response

  const dto = crearDependenciaSchema.parse(await request.json())

  const { data, error } = await guard.admin
    .from('dependencias')
    .insert(dto)
    .select(CAMPOS)
    .single()

  if (error) throw fromPostgresError(error)

  return created(data)
})

// PUT /api/dependencias?id=123
export const PUT = withRoute(async (request) => {
  const guard = await requireRole(ROLES.ADMIN)
  if (!guard.ok) return guard.response

  const id = parseId(request)
  const dto = actualizarDependenciaSchema.parse(await request.json())

  // Solo los campos que realmente llegaron.
  const update = Object.fromEntries(
    Object.entries(dto).filter(([, value]) => value !== undefined)
  )

  const { data, error } = await guard.admin
    .from('dependencias')
    .update(update)
    .eq('dependencia_id', id)
    .select(CAMPOS)
    .single()

  if (error) throw fromPostgresError(error)
  if (!data) throw new NotFoundError('Dependencia no encontrada.')

  return json(data)
})

// DELETE /api/dependencias?id=123
export const DELETE = withRoute(async (request) => {
  const guard = await requireRole(ROLES.ADMIN)
  if (!guard.ok) return guard.response

  const id = parseId(request)

  const { error } = await guard.admin
    .from('dependencias')
    .delete()
    .eq('dependencia_id', id)

  if (error) throw fromPostgresError(error)

  return ok()
})
