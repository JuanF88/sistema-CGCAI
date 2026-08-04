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

/**
 * Cabecera con sus listas hijas, ya ordenadas.
 *
 * El cronograma tiene tres niveles: programa → sección de proceso →
 * dependencias auditadas.
 */
const SELECT_COMPLETO = `
  *,
  cronograma:programa_auditoria_cronograma (
    *,
    dependencias:programa_auditoria_cronograma_dependencias ( * )
  ),
  distribucion:programa_auditoria_distribucion ( * )
`

const parseId = (request) =>
  programaIdSchema.parse(new URL(request.url).searchParams.get('id'))

const porOrden = (a, b) => a.orden - b.orden

/** Las filas hijas llegan sin ordenar; el `orden` es el del formulario. */
const ordenar = (programa) => ({
  ...programa,
  cronograma: [...(programa.cronograma ?? [])].sort(porOrden).map((seccion) => ({
    ...seccion,
    dependencias: [...(seccion.dependencias ?? [])].sort(porOrden),
  })),
  distribucion: [...(programa.distribucion ?? [])].sort(porOrden),
})

/**
 * Fila de una sección del cronograma.
 *
 * Se enumeran las columnas en vez de esparcir la sección entera: `dependencias`
 * viaja dentro del DTO y va a su propia tabla, no a esta.
 */
const filaSeccion = (seccion, programaId, orden) => ({
  programa_id: programaId,
  orden,
  proceso: seccion.proceso,
  proceso_clave: seccion.proceso_clave,
  requisitos_9001: seccion.requisitos_9001,
  requisitos_14001: seccion.requisitos_14001,
  semanas: seccion.semanas,
})

/** Inserta las listas hijas de un programa. Lanza si algo falla. */
async function guardarHijos(db, programaId, { cronograma, distribucion }) {
  if (cronograma.length) {
    // Se piden de vuelta `id` y `orden` porque las dependencias necesitan la
    // clave de su sección: el orden de un insert masivo no está garantizado, así
    // que se emparejan por `orden` y no por posición del array devuelto.
    const { data: secciones, error } = await db
      .from('programa_auditoria_cronograma')
      .insert(cronograma.map((seccion, orden) => filaSeccion(seccion, programaId, orden)))
      .select('id, orden')

    if (error) throw fromPostgresError(error)

    const idPorOrden = new Map((secciones ?? []).map((s) => [s.orden, s.id]))

    const filas = cronograma.flatMap((seccion, orden) =>
      (seccion.dependencias ?? []).map((dep, i) => ({
        ...dep,
        cronograma_id: idPorOrden.get(orden),
        orden: i,
      }))
    )

    if (filas.length) {
      const { error: depError } = await db
        .from('programa_auditoria_cronograma_dependencias')
        .insert(filas)
      if (depError) throw fromPostgresError(depError)
    }
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

  // Las listas se reescriben enteras (ver nota en el DTO). Las dependencias del
  // cronograma caen con su sección por `ON DELETE CASCADE`.
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
