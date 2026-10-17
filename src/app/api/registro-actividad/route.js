/**
 * GET /api/registro-actividad
 *
 * El registro de actividad, paginado y filtrado. Sólo admin.
 *
 * Pasa por una ruta de API y no por el cliente del navegador por dos razones.
 * La primera es que los accesos viven en `auth.audit_log_entries`, que sólo se
 * puede leer con service-role a través de `sincronizar_accesos()`. La segunda
 * es que así el filtro por persona o por fecha se resuelve en Postgres: la
 * tabla crece sin tope y traerla entera al navegador para filtrarla dejaría de
 * funcionar al mes de uso.
 */
import { requireRole } from '@/lib/api/guard'
import { withRoute } from '@/lib/api/handler'
import { json } from '@/lib/api/response'
import { fromPostgresError } from '@/lib/api/errors'
import { ADMIN_ONLY_ROLES } from '@/lib/auth/roles'

/** Tope por página. Más de esto no se lee en pantalla y pesa en la respuesta. */
const POR_PAGINA_MAX = 200
const POR_PAGINA_DEFECTO = 50

const COLUMNAS = `
  id, ocurrido_at, tipo, accion, entidad, registro_id,
  actor_usuario_id, actor_nombre, actor_rol, origen,
  campos, datos_antes, datos_despues, contexto, ip
`

const entero = (valor, porDefecto) => {
  const n = Number.parseInt(valor ?? '', 10)
  return Number.isFinite(n) ? n : porDefecto
}

export const GET = withRoute(async (request) => {
  const guard = await requireRole(ADMIN_ONLY_ROLES)
  if (!guard.ok) return guard.response

  const p = new URL(request.url).searchParams

  // Los accesos se traen de Auth antes de leer. Es idempotente y sólo inserta
  // los nuevos, así que sale barato; si falla, la vista sigue sirviendo los
  // cambios de datos en vez de quedarse en blanco.
  let accesosNuevos = 0
  const { data: sincronizados, error: errorSync } = await guard.admin.rpc('sincronizar_accesos', {
    limite: 2000,
  })

  if (errorSync) {
    console.warn('[registro-actividad] no se pudieron sincronizar los accesos:', errorSync.message)
  } else {
    accesosNuevos = sincronizados ?? 0
  }

  const porPagina = Math.min(
    Math.max(entero(p.get('porPagina'), POR_PAGINA_DEFECTO), 1),
    POR_PAGINA_MAX
  )
  const pagina = Math.max(entero(p.get('pagina'), 1), 1)
  const desplazamiento = (pagina - 1) * porPagina

  let consulta = guard.admin
    .from('registro_actividad')
    .select(COLUMNAS, { count: 'exact' })
    .order('ocurrido_at', { ascending: false })
    .order('id', { ascending: false })

  const tipo = p.get('tipo')
  if (tipo) consulta = consulta.eq('tipo', tipo)

  const accion = p.get('accion')
  if (accion) consulta = consulta.eq('accion', accion)

  const actor = p.get('actor')
  if (actor) consulta = consulta.eq('actor_usuario_id', entero(actor, -1))

  // Las entidades llegan como lista porque el filtro de la pantalla es por
  // grupo («Hallazgos»), y un grupo son varias tablas.
  const entidades = (p.get('entidades') ?? '')
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean)
  if (entidades.length) consulta = consulta.in('entidad', entidades)

  const desde = p.get('desde')
  if (desde) consulta = consulta.gte('ocurrido_at', desde)

  const hasta = p.get('hasta')
  // Exclusivo y sobre el día siguiente: `hasta` llega como fecha sin hora, y
  // con `lte` se perdía todo lo del propio día después de medianoche.
  if (hasta) consulta = consulta.lt('ocurrido_at', `${hasta}T23:59:59.999Z`)

  const { data, error, count } = await consulta.range(
    desplazamiento,
    desplazamiento + porPagina - 1
  )

  if (error) throw fromPostgresError(error)

  return json({
    filas: data ?? [],
    total: count ?? 0,
    pagina,
    porPagina,
    hayMas: desplazamiento + (data?.length ?? 0) < (count ?? 0),
    accesosNuevos,
  })
})
