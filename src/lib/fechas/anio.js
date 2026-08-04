/**
 * Año por defecto de los filtros.
 *
 * Todas las vistas con filtro de año arrancan en el año en curso: es lo que se
 * está trabajando y lo que se quiere ver al entrar.
 *
 * El matiz importante: **solo si hay datos de ese año**. En enero, o en un
 * despliegue nuevo, filtrar por el año actual dejaría la pantalla en blanco y
 * eso se lee como que la aplicación está rota, no como que no hay nada. En ese
 * caso se cae al año más reciente que sí tenga datos.
 */

/** Año en curso, como número. */
export const anioActual = () => new Date().getFullYear()

/**
 * Elige el año inicial de un filtro.
 *
 * @param {Array<string|number>} disponibles  Años con datos, en cualquier orden
 * @param {Object} [opciones]
 * @param {string|number} [opciones.sinDatos]  Qué devolver si no hay ninguno
 *   (`'todos'`, `''`, `null`… según lo que espere cada vista)
 * @returns {string|number} El valor tal y como lo espera el filtro
 */
export function anioPorDefecto(disponibles, { sinDatos = 'todos' } = {}) {
  const anios = (disponibles ?? [])
    .map((a) => Number(a))
    .filter((a) => Number.isFinite(a))

  if (!anios.length) return sinDatos

  const actual = anioActual()
  const elegido = anios.includes(actual) ? actual : Math.max(...anios)

  // Se devuelve del mismo tipo que llegó: unas vistas comparan con `===` sobre
  // strings (los `Select` de Radix) y otras sobre números.
  const original = (disponibles ?? []).find((a) => Number(a) === elegido)
  return original ?? elegido
}
