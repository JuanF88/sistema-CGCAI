/**
 * Las auditorías que salen de un programa aprobado.
 *
 * Una auditoría por **línea del cronograma**, no por auditor: una auditoría es
 * un acto, y quienes la hacen van dentro. De la línea salen el auditor líder
 * (`usuario_id`) y el resto como acompañantes, que es la misma distinción que
 * hace la nomenclatura del formato (AL / AA).
 *
 * Aquí no se toca la base: se decide qué hay que crear y qué no se puede, y el
 * `route` se encarga de resolver nombres e insertar. Así esta parte —la fecha,
 * el reparto de auditores y qué se omite— se puede comprobar sin Supabase.
 */
import { MESES } from './formato'

/** Sin tildes ni mayúsculas, para comparar lo escrito a mano. */
const normalizar = (texto) =>
  String(texto ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .trim()

/** «Ana Pérez, Luis Gómez» → ['Ana Pérez', 'Luis Gómez']. */
const partir = (texto) =>
  String(texto ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)

/**
 * Primer día del mes de auditoría del programa, en `YYYY-MM-DD`.
 *
 * El cronograma solo llega al mes —la cuadrícula marca semanas, no días—, así
 * que la auditoría se programa el día 1 y la fecha exacta se ajusta después
 * desde «Administrar auditorías», que ya permite editarla.
 *
 * Se construye como texto y no con `new Date()` a propósito: pasar por Date
 * mete la zona horaria de quien ejecute y el día 1 se convierte en el 31 del
 * mes anterior.
 *
 * @returns {string|null} `null` si el programa no tiene mes o no se reconoce
 */
export function fechaDelPrograma(programa) {
  // El rango es el mismo que valida el DTO. Sin él, un `anio` ausente pasaba:
  // `Number(null)` es 0 y es un entero, así que salía la fecha «0-09-01».
  const anio = Number(programa?.anio)
  if (!Number.isInteger(anio) || anio < 2000 || anio > 2100) return null

  const indice = MESES.findIndex((mes) => normalizar(mes) === normalizar(programa?.mes_auditoria))
  if (indice < 0) return null

  return `${anio}-${String(indice + 1).padStart(2, '0')}-01`
}

/**
 * Qué auditorías faltan por crear y qué líneas no se pueden.
 *
 * Volver a generar no duplica: una línea cuya dependencia ya tiene auditoría de
 * este programa se cuenta como `yaCreadas` y se salta. Así el botón se puede
 * pulsar otra vez tras añadir procesos al cronograma.
 *
 * @param {Object} programa
 * @param {Object} catalogo
 * @param {(nombre: string) => {dependencia_id: number}|undefined} catalogo.dependenciaPorNombre
 * @param {(nombre: string) => {usuario_id: number}|undefined} catalogo.usuarioPorNombre
 * @param {Set<number>} catalogo.dependenciasYaCreadas  ids con auditoría de este programa
 * @returns {{fecha: string|null, filas: Array, problemas: string[], yaCreadas: number}}
 */
export function planDeGeneracion(
  programa,
  { dependenciaPorNombre, usuarioPorNombre, dependenciasYaCreadas = new Set() }
) {
  const fecha = fechaDelPrograma(programa)
  const filas = []
  const problemas = []
  let yaCreadas = 0

  if (!fecha) {
    problemas.push(
      'El programa no tiene un mes de auditoría válido; sin él no se puede fijar la fecha.'
    )
    return { fecha: null, filas, problemas, yaCreadas }
  }

  for (const seccion of programa?.cronograma ?? []) {
    for (const linea of seccion.dependencias ?? []) {
      const auditado = String(linea.auditado ?? '').trim()
      if (!auditado) continue

      const dependencia = dependenciaPorNombre(auditado)
      if (!dependencia) {
        problemas.push(`«${auditado}» no está en el catálogo de dependencias.`)
        continue
      }

      if (dependenciasYaCreadas.has(dependencia.dependencia_id)) {
        yaCreadas++
        continue
      }

      const nombres = partir(linea.auditores)
      if (!nombres.length) {
        problemas.push(`«${auditado}» no tiene auditor asignado.`)
        continue
      }

      // El primero es el líder; una auditoría necesita un responsable concreto.
      const lider = usuarioPorNombre(nombres[0])
      if (!lider) {
        problemas.push(`«${nombres[0]}» (${auditado}) no está entre los usuarios del sistema.`)
        continue
      }

      // El resto de auditores y el acompañante de texto libre van juntos: la
      // columna de la auditoría es una lista de nombres, no de ids.
      const acompanantes = [...nombres.slice(1), String(linea.auditor_acompanante ?? '').trim()]
        .filter(Boolean)

      filas.push({
        usuario_id: lider.usuario_id,
        dependencia_id: dependencia.dependencia_id,
        fecha_auditoria: fecha,
        auditores_acompanantes: acompanantes,
        programa_auditoria_id: programa.id,

        // Ni objetivo ni criterios: los del programa son generales y los de cada
        // auditoría son los suyos. Precargarlos invitaba a dejarlos tal cual, y
        // entonces las veinte auditorías del año salían con el mismo texto
        // copiado. El objetivo del programa se le muestra al auditor como
        // referencia al rellenar el informe (`ObjetivoDelPrograma`), para que
        // escriba el propio alineado con él.
      })
    }
  }

  return { fecha, filas, problemas, yaCreadas }
}
