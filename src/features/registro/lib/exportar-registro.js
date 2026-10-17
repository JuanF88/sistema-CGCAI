/**
 * El registro de actividad, en Excel.
 *
 * Exporta **todo lo que cae en el filtro**, no la página que se está viendo:
 * una traza de auditoría que se entrega a medias no sirve de prueba. Las
 * páginas se piden una tras otra, con un tope por si el filtro abarca medio
 * año y la descarga se iría a decenas de miles de filas.
 *
 * Una columna por dato y nada de JSON crudo: quien abra esto va a filtrar por
 * persona y ordenar por fecha, y para eso las fechas van como texto
 * «YYYY-MM-DD HH:MM» —ordenan bien y no dependen de la configuración regional
 * de quien lo abra—.
 */
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import { toast } from 'react-toastify'

import { describirActividad, etiquetaCampo, recortar } from './describir-actividad'

const AZUL_TITULO = 'FF667EEA'
const AZUL_CABECERA = 'FF1E40AF'
const GRIS_BORDE = 'FFE2E8F0'
const FILA_CABECERA = 4

/** Tope de seguridad: 20 000 asientos son ya un archivo de varios megas. */
const MAXIMO_FILAS = 20000
const POR_PAGINA = 200

const relleno = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } })

const borde = (argb) => ({
  top: { style: 'thin', color: { argb } },
  left: { style: 'thin', color: { argb } },
  bottom: { style: 'thin', color: { argb } },
  right: { style: 'thin', color: { argb } },
})

/**
 * Título, periodo y cabecera, **antes** de añadir una sola fila de datos.
 *
 * Fijar `columns` ya escribe la cabecera en la fila 1, así que combinar las
 * filas 1 y 2 deja `rowCount` en 2 y cada `addRow` cae de la 3 en adelante. Si
 * la cabecera se escribiera al final sobre la fila 4, machacaría la segunda
 * fila de datos y la primera quedaría encima de la cabecera, fuera del filtro.
 */
function prepararHoja(hoja, { titulo, periodo }) {
  const ultima = hoja.columns.length

  hoja.mergeCells(1, 1, 1, ultima)
  const celdaTitulo = hoja.getCell(1, 1)
  celdaTitulo.value = titulo
  celdaTitulo.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } }
  celdaTitulo.alignment = { horizontal: 'center', vertical: 'middle' }
  celdaTitulo.fill = relleno(AZUL_TITULO)
  hoja.getRow(1).height = 24

  hoja.mergeCells(2, 1, 2, ultima)
  const celdaPeriodo = hoja.getCell(2, 1)
  celdaPeriodo.value = periodo
  celdaPeriodo.font = { italic: true, color: { argb: 'FF475569' } }

  const cabecera = hoja.getRow(FILA_CABECERA)
  cabecera.values = hoja.columns.map((c) => c.header)
  cabecera.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  cabecera.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
  cabecera.fill = relleno(AZUL_CABECERA)
  cabecera.height = 30
  cabecera.eachCell((celda) => {
    celda.border = borde(AZUL_CABECERA)
  })
  cabecera.commit?.()
}

function cerrarHoja(hoja) {
  for (let n = FILA_CABECERA + 1; n <= hoja.rowCount; n++) {
    const fila = hoja.getRow(n)
    fila.alignment = { vertical: 'top' }
    fila.eachCell((celda) => {
      celda.border = borde(GRIS_BORDE)
    })
  }

  hoja.autoFilter = {
    from: { row: FILA_CABECERA, column: 1 },
    to: { row: FILA_CABECERA, column: hoja.columnCount },
  }
  hoja.views = [{ state: 'frozen', ySplit: FILA_CABECERA, xSplit: 2 }]
}

export const COLUMNAS = [
  { header: 'Fecha y hora', key: 'cuando', width: 18 },
  { header: 'Quién', key: 'quien', width: 26 },
  { header: 'Rol', key: 'rol', width: 13 },
  { header: 'Qué hizo', key: 'frase', width: 52 },
  { header: 'Área', key: 'grupo', width: 16 },
  { header: 'Tipo', key: 'tipo', width: 11 },
  { header: 'Acción', key: 'accion', width: 12 },
  { header: 'Entidad', key: 'entidad', width: 26 },
  { header: 'Registro', key: 'registro', width: 16 },
  { header: 'Campos cambiados', key: 'campos', width: 30 },
  { header: 'Antes', key: 'antes', width: 42 },
  { header: 'Después', key: 'despues', width: 42 },
  { header: 'Origen', key: 'origen', width: 11 },
  { header: 'IP', key: 'ip', width: 15 },
  { header: 'Asiento', key: 'id', width: 10 },
]

/** «YYYY-MM-DD HH:MM» en la hora de Bogotá, como texto. */
export function instante(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''

  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d)

  const v = (tipo) => partes.find((p) => p.type === tipo)?.value ?? ''
  return `${v('year')}-${v('month')}-${v('day')} ${v('hour')}:${v('minute')}`
}

/** Los valores de un lado del cambio, como «Campo: valor» por línea. */
export function ladoDelCambio(datos) {
  if (!datos || typeof datos !== 'object') return ''
  return Object.entries(datos)
    .map(([clave, valor]) => `${etiquetaCampo(clave)}: ${recortar(valor, 180)}`)
    .join('\n')
}

/** La fila de la hoja a partir de un asiento del registro. */
export function filaDeAsiento(fila) {
  const { actor, frase, grupo } = describirActividad(fila)

  return {
    cuando: instante(fila.ocurrido_at),
    quien: actor,
    rol: fila.actor_rol ?? '',
    frase: `${actor} ${frase}`,
    grupo,
    tipo: fila.tipo,
    accion: fila.accion,
    entidad: fila.entidad,
    registro: fila.registro_id ?? '',
    campos: (fila.campos ?? []).map(etiquetaCampo).join(', '),
    antes: ladoDelCambio(fila.datos_antes),
    despues: ladoDelCambio(fila.datos_despues),
    origen: fila.origen,
    ip: fila.ip ?? '',
    id: fila.id,
  }
}

/** Cuántas páginas hay que pedir para cubrir el filtro, sin pasarse del tope. */
export function paginasNecesarias(total, porPagina = POR_PAGINA, maximo = MAXIMO_FILAS) {
  const alcanzable = Math.min(total ?? 0, maximo)
  return Math.max(0, Math.ceil(alcanzable / porPagina))
}

/**
 * Descarga el Excel del registro.
 *
 * @param {Object} args
 * @param {Object} args.filtros       Los filtros puestos, para la leyenda
 * @param {number} args.total         Asientos que caen en el filtro
 * @param {(pagina: number) => Promise<{filas: Array}>} args.pedirPagina
 */
export async function exportarRegistroActividad({ filtros, total, pedirPagina }) {
  if (!total) {
    toast.warning('No hay actividad que exportar con estos filtros.')
    return
  }

  const paginas = paginasNecesarias(total)
  const recogidas = []

  for (let n = 1; n <= paginas; n++) {
    const { filas } = await pedirPagina(n)
    if (!filas?.length) break
    recogidas.push(...filas)
  }

  const libro = new ExcelJS.Workbook()
  libro.creator = 'CGCAI'
  libro.created = new Date()

  const hoja = libro.addWorksheet('Registro de actividad')
  hoja.columns = COLUMNAS

  const recorte =
    total > recogidas.length
      ? ` · se exportan los ${recogidas.length.toLocaleString('es-CO')} más recientes de ${total.toLocaleString('es-CO')}`
      : ''

  prepararHoja(hoja, {
    titulo: 'CGCAI · Registro de actividad del sistema',
    periodo:
      `Del ${filtros?.desde || '—'} al ${filtros?.hasta || '—'}` +
      ` · generado el ${instante(new Date().toISOString())}` +
      recorte,
  })

  for (const fila of recogidas) hoja.addRow(filaDeAsiento(fila))

  cerrarHoja(hoja)

  const buffer = await libro.xlsx.writeBuffer()
  saveAs(
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    `registro_actividad_${filtros?.desde || 'inicio'}_${filtros?.hasta || 'hoy'}.xlsx`
  )

  toast.success(`Registro exportado · ${recogidas.length.toLocaleString('es-CO')} asientos.`)

  if (total > recogidas.length) {
    toast.info('El filtro tiene más asientos del tope de la descarga. Acota las fechas para el resto.')
  }
}
