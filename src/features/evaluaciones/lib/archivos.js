/**
 * Nota por entrega de archivos.
 *
 * Cada documento de la auditoría tiene una fecha límite; se puntúa según llegue
 * a tiempo o tarde, y la nota del auditor es el promedio de todos.
 */

/** 5 puntos si se entregó a tiempo, 1 si llegó tarde. */
export const PUNTOS_A_TIEMPO = 5
export const PUNTOS_TARDE = 1

export function formatearFechaLocal(fecha) {
  try {
    return new Intl.DateTimeFormat('es-CO', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    }).format(new Date(fecha + 'T00:00:00'))
  } catch {
    return fecha
  }
}

/** Días entre la carga y el límite. Negativo = anticipado. */
export function diasDeRetraso(fechaCarga, fechaLimite) {
  const carga = new Date(fechaCarga + 'T00:00:00')
  const limite = new Date(fechaLimite + 'T00:00:00')
  return Math.ceil((carga - limite) / (1000 * 60 * 60 * 24))
}

export function calcularPuntos(fechaCarga, fechaLimite) {
  if (!fechaCarga) return 0
  return diasDeRetraso(fechaCarga, fechaLimite) <= 0 ? PUNTOS_A_TIEMPO : PUNTOS_TARDE
}

export function calcularEstado(fechaCarga, fechaLimite) {
  if (!fechaCarga) return 'No entregado'
  const dias = diasDeRetraso(fechaCarga, fechaLimite)
  if (dias < 0) return `Anticipado (${Math.abs(dias)} día${Math.abs(dias) !== 1 ? 's' : ''})`
  if (dias === 0) return 'A tiempo'
  return `Tarde (${dias} día${dias !== 1 ? 's' : ''})`
}

/** Formato antiguo: `archivos` podía venir como objeto en vez de array. */
export const archivosDe = (informe) =>
  Array.isArray(informe.archivos) ? informe.archivos : Object.values(informe.archivos || {})

/**
 * Aplica las fechas editadas a mano y recalcula puntos, estado y totales.
 *
 * @param {Array} informes  `detalle_archivos.informes`
 * @param {Record<string, {fechaCarga: string}>} editados  clave `informeIdx-archivoIdx`
 */
export function recalcularDetalle(informes, editados) {
  const actualizados = informes.map((informe, infIdx) => ({
    ...informe,
    archivos: archivosDe(informe).map((archivo, archIdx) => {
      const editado = editados[`${infIdx}-${archIdx}`]
      if (!editado) return archivo

      const nuevaFechaCarga = editado.fechaCarga
      const fechaLimite = archivo.fechaLimite?.split('T')[0]

      return {
        ...archivo,
        fechaCarga: nuevaFechaCarga ? new Date(nuevaFechaCarga + 'T00:00:00').toISOString() : null,
        fechaCargaFormateada: nuevaFechaCarga ? formatearFechaLocal(nuevaFechaCarga) : null,
        puntos: calcularPuntos(nuevaFechaCarga, fechaLimite),
        estado: calcularEstado(nuevaFechaCarga, fechaLimite),
        existe: Boolean(nuevaFechaCarga),
        fue_editado_en_sesion_actual: true,
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
