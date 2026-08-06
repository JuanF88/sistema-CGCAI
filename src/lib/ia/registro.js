import 'server-only'

/**
 * Registro y tope de la revisión con IA.
 *
 * Cada pulsación de «Revisar con IA» deja una fila en `ia_revisiones`, salga
 * bien o mal. De ahí salen las dos cosas que hace este módulo: contar lo
 * gastado por auditoría para poder cortar en diez, y dejar el rastro que
 * alimenta el panel de uso.
 *
 * Vive en el servidor y se escribe con service-role a propósito. Si el auditor
 * pudiera tocar esta tabla, el tope no sería un tope.
 */

/**
 * Cuántas revisiones puede gastar una auditoría.
 *
 * Es un límite de gasto, no una regla de auditoría: cada llamada se paga por
 * token y una sola auditoría en bucle puede consumir lo que cien. Diez da
 * margen de sobra —lo normal es una o dos por campo— y corta el bucle.
 */
export const LIMITE_REVISIONES_IA = 10

/**
 * Revisiones que ya consumió una auditoría.
 *
 * Solo cuentan las que gastaron dinero: las de `consume_cupo`, que la columna
 * calcula sola. Un fallo de configuración o del proveedor no le resta cupo a
 * nadie.
 *
 * Si la consulta falla se devuelve 0 y la revisión sigue. Es deliberado: entre
 * dejar pasar una revisión de más y bloquear a un auditor porque la tabla de
 * contadores no responde, se prefiere lo primero.
 */
export async function revisionesUsadas(db, informeId) {
  const { count, error } = await db
    .from('ia_revisiones')
    .select('id', { count: 'exact', head: true })
    .eq('informe_id', informeId)
    .eq('consume_cupo', true)

  if (error) {
    console.error('[ia] no se pudo contar el uso previo:', error.message)
    return 0
  }

  return count ?? 0
}

/**
 * Deja constancia de una pulsación.
 *
 * No lanza nunca: el registro es contabilidad, y perder una fila no puede
 * costarle al auditor la revisión que sí se hizo. Si falla, queda en el log
 * del servidor.
 *
 * @param {Object} db Cliente service-role
 * @param {Object} datos
 * @param {number} datos.informeId
 * @param {number} [datos.usuarioId]
 * @param {'ok'|'error'|'bloqueada'} datos.estado
 * @param {string} [datos.codigoError]
 * @param {string} [datos.modelo]
 * @param {{entrada: number, salida: number}} [datos.tokens]
 * @param {number} [datos.duracionMs]
 * @param {Array<{campo: string, veredicto: string}>} [datos.veredictos]
 */
export async function registrarRevision(
  db,
  { informeId, usuarioId, estado, codigoError, modelo, tokens, duracionMs, veredictos }
) {
  const { error } = await db.from('ia_revisiones').insert({
    informe_id: informeId,
    usuario_id: usuarioId ?? null,
    estado,
    codigo_error: codigoError ?? null,
    modelo: modelo ?? null,
    tokens_entrada: tokens?.entrada ?? 0,
    tokens_salida: tokens?.salida ?? 0,
    duracion_ms: duracionMs ?? null,
    // Solo campo y veredicto: ni un texto del informe sale de su tabla.
    veredictos: (veredictos ?? []).map(({ campo, veredicto }) => ({ campo, veredicto })),
  })

  if (error) console.error('[ia] no se pudo registrar la revisión:', error.message)
}
