/**
 * Lectura de hojas de cálculo con ExcelJS.
 *
 * Sustituye a `xlsx` (SheetJS), que tiene una vulnerabilidad alta sin parche en
 * el registro público de npm. ExcelJS ya era dependencia del proyecto.
 *
 * ⚠️ Solo lee `.xlsx` (OOXML). El formato antiguo `.xls` (BIFF) no está
 * soportado por ExcelJS; quien lo suba debe volver a guardarlo como `.xlsx`.
 */
import ExcelJS from 'exceljs'

/**
 * Aplana el valor de una celda de ExcelJS a un primitivo utilizable.
 * ExcelJS envuelve algunos tipos en objetos (fórmulas, texto enriquecido,
 * hipervínculos); aquí se reducen al valor que interesa.
 */
function cellValue(cell) {
  const value = cell?.value

  if (value === null || value === undefined) return undefined
  if (value instanceof Date) return value

  if (typeof value === 'object') {
    if (Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text ?? '').join('')
    }
    if ('result' in value) return value.result // celda con fórmula
    if ('text' in value) return value.text // hipervínculo
    if ('error' in value) return undefined // #N/A, #REF!, …
    return undefined
  }

  return value
}

/**
 * Lee la primera hoja y la devuelve como array de objetos, usando la primera
 * fila como cabecera. Equivale a `xlsx.utils.sheet_to_json(sheet)`:
 * las celdas vacías no generan clave y las filas vacías se descartan.
 *
 * Diferencia a tener en cuenta: las celdas con formato de fecha llegan como
 * `Date` (SheetJS las devolvía como número serial de Excel).
 *
 * @param {Buffer|ArrayBuffer} buffer
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
export async function readFirstSheetAsObjects(buffer) {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)

  const sheet = workbook.worksheets[0]
  if (!sheet) return []

  // Cabeceras por índice de columna.
  //
  // ⚠️ El nombre se guarda TAL CUAL, sin recortar espacios: el Excel real de
  // Google Forms trae cabeceras con espacio final (p. ej. "…reunión de cierre ")
  // y el código que consume las filas las busca con ese espacio incluido.
  // Recortarlas rompería el mapeo de esa pregunta.
  const headers = []
  const headerRow = sheet.getRow(1)
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const raw = cellValue(cell)
    if (raw === undefined) return
    const name = String(raw)
    if (name.trim() === '') return
    headers[colNumber] = name
  })

  if (headers.filter(Boolean).length === 0) return []

  const rows = []
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return

    const record = {}
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const key = headers[colNumber]
      if (!key) return

      const value = cellValue(cell)
      if (value === undefined || value === '') return

      record[key] = value
    })

    if (Object.keys(record).length > 0) rows.push(record)
  })

  return rows
}
