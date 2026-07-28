import { requireAuth, requireRole } from '@/lib/api/guard'
import { withRoute } from '@/lib/api/handler'
import { fromPostgresError, NotFoundError } from '@/lib/api/errors'
import { created, json, ok } from '@/lib/api/response'
import { ROLES } from '@/lib/auth/roles'
import {
  actualizarProgramaSchema,
  crearProgramaSchema,
  programaIdSchema,
} from '@/features/programa/dto/programa-dto'

/** Cabecera con sus dos listas hijas, ya ordenadas. */
const SELECT_COMPLETO = `
  *,
  cronograma:programa_auditoria_cronograma ( * ),
  distribucion:programa_auditoria_distribucion ( * )
`

const parseId = (request) =>
  programaIdSchema.parse(new URL(request.url).searchParams.get('id'))

/** Las filas hijas llegan sin ordenar; el `orden` es el del formulario. */
const ordenar = (programa) => ({
  ...programa,
  cronograma: [...(programa.cronograma ?? [])].sort((a, b) => a.orden - b.orden),
  distribucion: [...(programa.distribucion ?? [])].sort((a, b) => a.orden - b.orden),
})

/** Inserta las dos listas hijas de un programa. Lanza si algo falla. */
async function guardarHijos(db, programaId, { cronograma, distribucion }) {
  if (cronograma.length) {
    const { error } = await db.from('programa_auditoria_cronograma').insert(
      cronograma.map((fila, orden) => ({ ...fila, programa_id: programaId, orden }))
    )
    if (error) throw fromPostgresError(error)
  }

  if (distribucion.length) {
    const { error } = await db.from('programa_auditoria_distribucion').insert(
      distribucion.map((fila, orden) => ({ ...fila, programa_id: programaId, orden }))
    )
    if (error) throw fromPostgresError(error)
  }
}

// GET /api/programa-auditoria           → lista
// GET /api/programa-auditoria?id=123    → uno con sus listas
export const GET = withRoute(async (request) => {
  const guard = await requireAuth()
  if (!guard.ok) return guard.response

  const idParam = new URL(request.url).searchParams.get('id')

  if (idParam) {
    const { data, error } = await guard.admin
      .from('programas_auditoria')
      .select(SELECT_COMPLETO)
      .eq('id', programaIdSchema.parse(idParam))
      .single()

    if (error) throw fromPostgresError(error)
    if (!data) throw new NotFoundError('Programa no encontrado.')

    return json(ordenar(data))
  }

  const { data, error } = await guard.admin
    .from('programas_auditoria')
    .select('id, anio, nombre, estado, mes_auditoria, updated_at')
    .order('anio', { ascending: false })
    .order('nombre', { ascending: true })

  if (error) throw fromPostgresError(error)

  return json(data ?? [])
})

// POST /api/programa-auditoria
export const POST = withRoute(async (request) => {
  const guard = await requireRole(ROLES.ADMIN)
  if (!guard.ok) return guard.response

  const { cronograma, distribucion, ...cabecera } = crearProgramaSchema.parse(
    await request.json()
  )

  const { data, error } = await guard.admin
    .from('programas_auditoria')
    .insert({ ...cabecera, creado_por: guard.usuario?.usuario_id ?? null })
    .select('id')
    .single()

  if (error) throw fromPostgresError(error)

  await guardarHijos(guard.admin, data.id, { cronograma, distribucion })

  const { data: completo } = await guard.admin
    .from('programas_auditoria')
    .select(SELECT_COMPLETO)
    .eq('id', data.id)
    .single()

  return created(ordenar(completo))
})

// PUT /api/programa-auditoria?id=123
export const PUT = withRoute(async (request) => {
  const guard = await requireRole(ROLES.ADMIN)
  if (!guard.ok) return guard.response

  const id = parseId(request)
  const { cronograma, distribucion, ...cabecera } = actualizarProgramaSchema.parse(
    await request.json()
  )

  const { data, error } = await guard.admin
    .from('programas_auditoria')
    .update(cabecera)
    .eq('id', id)
    .select('id')
    .single()

  if (error) throw fromPostgresError(error)
  if (!data) throw new NotFoundError('Programa no encontrado.')

  // Las listas se reescriben enteras (ver nota en el DTO).
  for (const tabla of ['programa_auditoria_cronograma', 'programa_auditoria_distribucion']) {
    const { error: delErr } = await guard.admin.from(tabla).delete().eq('programa_id', id)
    if (delErr) throw fromPostgresError(delErr)
  }

  await guardarHijos(guard.admin, id, { cronograma, distribucion })

  const { data: completo } = await guard.admin
    .from('programas_auditoria')
    .select(SELECT_COMPLETO)
    .eq('id', id)
    .single()

  return json(ordenar(completo))
})

// DELETE /api/programa-auditoria?id=123  (las hijas caen por ON DELETE CASCADE)
export const DELETE = withRoute(async (request) => {
  const guard = await requireRole(ROLES.ADMIN)
  if (!guard.ok) return guard.response

  const { error } = await guard.admin
    .from('programas_auditoria')
    .delete()
    .eq('id', parseId(request))

  if (error) throw fromPostgresError(error)

  return ok()
})
