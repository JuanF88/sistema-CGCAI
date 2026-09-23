/**
 * Nota por entrega de archivos.
 *
 * Cada documento de la auditoría tiene una fecha límite; se puntúa según llegue
 * a tiempo o tarde, y la nota del auditor es el promedio de todos.
 *
 * Las fechas se cuentan por días de calendario en Bogotá (ver `lib/fechas.js`):
 * el plazo se cumple durante todo el día del vencimiento, no hasta su
 * medianoche inicial.
 */
import { PLAZOS, diasHabilesDe } from '@/lib/catalogos/plazos'
import {
  aDia,
  diferenciaEnDias,
  formatearDia,
  sumarDiasHabiles,
} from '@/lib/fechas'

/** 5 puntos si se entregó a tiempo, 1 si llegó tarde. */
export const PUNTOS_A_TIEMPO = 5
export const PUNTOS_TARDE = 1

/**
 * Los plazos salen de `@/lib/catalogos/plazos`, que es donde viven para todo el
 * sistema. Se reexporta para no obligar a cada pantalla a conocer los dos
 * módulos.
 */
export { PLAZOS as PLAZOS_POR_TIPO }

/**
 * La fecha límite de un documento, deducida de la fecha de la auditoría.
 *
 * Existe aquí para que el desglose pueda deducir el límite por su cuenta.
 * Antes solo se calculaba en el servidor, así que la pantalla dependía de lo
 * que se hubiera guardado; cuando ese dato salió mal, no había forma de
 * enseñar el bueno sin volver a calcular toda la evaluación.
 *
 * @param {string} fechaAuditoria  «YYYY-MM-DD»
 * @param {string} tipo            clave de `PLAZOS`
 * @returns {string|null} «YYYY-MM-DD»
 */
export function limiteDe(fechaAuditoria, tipo) {
  const dia = aDia(fechaAuditoria)
  const dias = diasHabilesDe(tipo)
  if (!dia || dias === null) return null

  return sumarDiasHabiles(dia, dias)
}

/** «2026-09-17» → «17 sept 2026». Acepta también un instante ISO. */
export const formatearFechaLocal = (fecha) => formatearDia(fecha) ?? fecha

/** Días entre la entrega y el límite. Negativo = anticipado. */
export function diasDeRetraso(fechaCarga, fechaLimite) {
  return diferenciaEnDias(fechaLimite, fechaCarga)
}

export function calcularPuntos(fechaCarga, fechaLimite) {
  const dias = diasDeRetraso(fechaCarga, fechaLimite)
  if (dias === null) return 0
  return dias <= 0 ? PUNTOS_A_TIEMPO : PUNTOS_TARDE
}

export function calcularEstado(fechaCarga, fechaLimite) {
  const dias = diasDeRetraso(fechaCarga, fechaLimite)
  if (dias === null) return 'No entregado'

  const plural = (n) => (n !== 1 ? 's' : '')
  if (dias < 0) return `Anticipado (${Math.abs(dias)} día${plural(Math.abs(dias))})`
  if (dias === 0) return 'A tiempo'
  return `Tarde (${dias} día${plural(dias)})`
}

/** Formato antiguo: `archivos` podía venir como objeto en vez de array. */
export const archivosDe = (informe) =>
  Array.isArray(informe.archivos) ? informe.archivos : Object.values(informe.archivos || {})

/**
 * Una fila del desglose, con el plazo y la nota recalculados.
 *
 * Es la única fuente de verdad de la pantalla y del guardado: todo sale de la
 * fecha de la auditoría, del tipo de documento y de la fecha de entrega. Lo que
 * viniera guardado en `fechaLimite`, `estado` o `puntos` se ignora, porque los
 * cálculos viejos están mal y no tiene sentido arrastrarlos hasta que alguien
 * se acuerde de pulsar «Recalcular archivos».
 *
 * @param {Object} archivo
 * @param {string} fechaAuditoria
 * @param {string} [fechaCargaEditada]  Fecha puesta a mano en esta sesión
 */
export function evaluarArchivo(archivo, fechaAuditoria, fechaCargaEditada) {
  const editado = fechaCargaEditada !== undefined
  const fechaCarga = editado ? fechaCargaEditada || null : aDia(archivo.fechaCarga)

  // El límite se deduce del tipo; si es un tipo desconocido —un desglose de
  // una versión anterior— se cae al guardado antes que quedarse sin plazo.
  const fechaLimite = limiteDe(fechaAuditoria, archivo.tipo) ?? aDia(archivo.fechaLimite)

  return {
    fechaCarga,
    fechaLimite,
    puntos: calcularPuntos(fechaCarga, fechaLimite),
    estado: calcularEstado(fechaCarga, fechaLimite),
    existe: Boolean(fechaCarga),
    editado,
  }
}

/**
 * Aplica las fechas editadas a mano y recalcula puntos, estado y totales.
 *
 * Recalcula **todas** las filas, no solo las tocadas: si se guardara mezclando
 * lo recién calculado con los puntos viejos, la nota quedaría a medio camino
 * entre los dos criterios.
 *
 * @param {Array} informes  `detalle_archivos.informes`
 * @param {Record<string, {fechaCarga: string}>} editados  clave `informeIdx-archivoIdx`
 */
export function recalcularDetalle(informes, editados) {
  const actualizados = informes.map((informe, infIdx) => ({
    ...informe,
    archivos: archivosDe(informe).map((archivo, archIdx) => {
      const edicion = editados[`${infIdx}-${archIdx}`]
      const calculo = evaluarArchivo(archivo, informe.fecha_auditoria, edicion?.fechaCarga)

      return {
        ...archivo,
        fechaLimite: calculo.fechaLimite,
        fechaLimiteFormateada: formatearDia(calculo.fechaLimite),
        fechaCarga: calculo.fechaCarga,
        fechaCargaFormateada: formatearDia(calculo.fechaCarga),
        diasRetraso: diasDeRetraso(calculo.fechaCarga, calculo.fechaLimite),
        puntos: calculo.puntos,
        estado: calculo.estado,
        existe: calculo.existe,
        // Explícito y no condicional: así se limpia el que hubiera quedado de
        // un guardado anterior dentro de la misma sesión del modal.
        fue_editado_en_sesion_actual: calculo.editado,
      }
    }),
  }))

  let totalPuntos = 0
  let totalEsperados = 0
  let totalCargados = 0

  actualizados.forEach((informe) => {
    archivosDe(informe).forEach((archivo) => {
      totalEsperados++
      totalPuntos += archivo.puntos || 0
      if (archivo.existe) totalCargados++
    })
  })

  return {
    informes: actualizados,
    totalEsperados,
    totalCargados,
    totalPuntos,
    nota: totalEsperados > 0 ? Number((totalPuntos / totalEsperados).toFixed(2)) : 0,
    porcentaje: totalEsperados > 0 ? Math.round((totalCargados / totalEsperados) * 100) : 0,
  }
}
