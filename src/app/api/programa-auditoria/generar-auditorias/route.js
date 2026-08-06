/**
 * POST /api/programa-auditoria/generar-auditorias?id=123
 *
 * Crea las auditorías de un programa **aprobado**, una por línea del
 * cronograma, y las deja marcadas con `programa_auditoria_id` para saber de
 * dónde vienen.
 *
 * Avisa a cada auditor, igual que `POST /api/informes` al crear una a mano.
 * La diferencia es que aquí salen muchas de un clic, así que el envío va
 * detrás de un interruptor —`NOTIFICAR_GENERACION_AUDITORIAS`— y por defecto
 * está apagado: se resuelve a quién se avisaría y se devuelve la lista, sin
 * mandar nada. Ver `avisos-generacion.js`.
 */
import { requireRole } from '@/lib/api/guard'
import { withRoute } from '@/lib/api/handler'
import { fromPostgresError, NotFoundError, ValidationError } from '@/lib/api/errors'
import { json } from '@/lib/api/response'
import { ROLES } from '@/lib/auth/roles'
import { programaIdSchema } from '@/features/programa/dto/programa-dto'
import { planDeGeneracion } from '@/features/programa/lib/generar-auditorias'
import {
  avisarAsignaciones,
  destinatariosDeLote,
} from '@/features/programa/lib/avisos-generacion'

/** Sin tildes ni mayúsculas, para casar nombres escritos a mano. */
const normalizar = (texto) =>
  String(texto ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .trim()

/** Índice por nombre normalizado; la primera grafía vista gana. */
function indexarPorNombre(filas, nombreDe) {
  const indice = new Map()

  for (const fila of filas) {
    const clave = normalizar(nombreDe(fila))
    if (clave && !indice.has(clave)) indice.set(clave, fila)
  }

  return indice
}

export const POST = withRoute(async (request) => {
  const guard = await requireRole(ROLES.ADMIN)
  if (!guard.ok) return guard.response

  const id = programaIdSchema.parse(new URL(request.url).searchParams.get('id'))
  const db = guard.admin

  const { data: programa, error } = await db
    .from('programas_auditoria')
    .select(
      `
        id, anio, nombre, estado, mes_inicio, mes_fin,
        cronograma:programa_auditoria_cronograma (
          orden,
          proceso,
          dependencias:programa_auditoria_cronograma_dependencias ( orden, auditado, auditores, auditor_acompanante )
        )
      `
    )
    .eq('id', id)
    .single()

  if (error) throw fromPostgresError(error)
  if (!programa) throw new NotFoundError('Programa no encontrado.')

  // La aprobación es la puerta: un borrador se sigue editando y generar sus
  // auditorías dejaría auditorías reales colgando de un plan que va a cambiar.
  if (programa.estado !== 'aprobado') {
    throw new ValidationError(
      'Solo se pueden generar las auditorías de un programa aprobado. Aprueba el programa primero.'
    )
  }

  const [dependencias, usuarios, existentes] = await Promise.all([
    db.from('dependencias').select('dependencia_id, nombre'),
    // `email` y `estado` son para el aviso: sin ellos no se sabe a quién se
    // puede escribir. El filtro de activos ya estaba; el estado se pide igual
    // para que el aviso pueda decir por qué se saltó a alguien.
    db.from('usuarios').select('usuario_id, nombre, apellido, email, estado').eq('estado', 'activo'),
    db.from('informes_auditoria').select('dependencia_id').eq('programa_auditoria_id', id),
  ])

  if (dependencias.error) throw fromPostgresError(dependencias.error)
  if (usuarios.error) throw fromPostgresError(usuarios.error)
  if (existentes.error) throw fromPostgresError(existentes.error)

  const porDependencia = indexarPorNombre(dependencias.data ?? [], (d) => d.nombre)
  const porUsuario = indexarPorNombre(usuarios.data ?? [], (u) =>
    [u.nombre, u.apellido].filter(Boolean).join(' ')
  )

  const { fecha, filas, problemas, yaCreadas } = planDeGeneracion(programa, {
    dependenciaPorNombre: (nombre) => porDependencia.get(normalizar(nombre)),
    usuarioPorNombre: (nombre) => porUsuario.get(normalizar(nombre)),
    dependenciasYaCreadas: new Set((existentes.data ?? []).map((f) => f.dependencia_id)),
  })

  // Sin mes no hay fecha posible: es un problema del programa, no de una línea.
  if (!fecha) throw new ValidationError(problemas[0])

  let creadas = 0
  if (filas.length) {
    const { data, error: insertError } = await db
      .from('informes_auditoria')
      .insert(filas)
      .select('id')

    if (insertError) throw fromPostgresError(insertError)
    creadas = data?.length ?? 0
  }

  // Los avisos van después del insert y no antes: si el insert falla no se ha
  // avisado de nada, y si el correo falla las auditorías siguen creadas.
  const avisos = await avisarAsignaciones(
    destinatariosDeLote(
      filas,
      new Map((usuarios.data ?? []).map((u) => [u.usuario_id, u])),
      new Map((dependencias.data ?? []).map((d) => [d.dependencia_id, d]))
    )
  )

  return json({ creadas, yaCreadas, fecha, problemas, avisos })
})
