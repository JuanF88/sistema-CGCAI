// @/components/auditor/Utilidades/generarPlanMejora.xpp.js
import { saveAs } from 'file-saver'
// ===== Utilidades (reusadas/adaptadas) =====
const toSlugUpper = (s = '') =>
  s.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase()

const toYMD = (input) => {
  if (!input) return new Date().toISOString().slice(0, 10)
  const s = String(input)
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : new Date(input).toISOString().slice(0, 10)
}

// Sanitiza texto para XML 1.0 / XLSX y normaliza saltos
const sanitizeExcelText = (val) => {
  if (val == null) return ''
  let s = String(val)
  // Controles C0 (excepto \t,\n,\r) + C1 0x7F–0x9F (incluye U+0085 NEL)
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u0084\u0086-\u009F]/g, '')
  // Elimina pares sustitutos no emparejados (evita XML inválido)
  s = s.replace(
    /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g,
    ''
  )
  // Límite duro de Excel
  if (s.length > 32767) s = s.slice(0, 32767)
  return s
}

const normalizeNewlines = (s) =>
  sanitizeExcelText(s).replace(/\r\n|\r|\u0085/g, '\n')

/**
 * Genera Plan de Mejora desde plantilla con xlsx-populate (cliente)
 *
 * @param {object} informe
 * @param {Array<object>} oportunidades
 * @param {Array<object>} noConformidades
 * @param {object} usuario (no usado aquí, por compatibilidad)
 * @param {object} options
 */
export async function generarPlanMejora2(
  informe,
  oportunidades = [],
  noConformidades = [],
  usuario,
  {
    templateUrl = '/plantillas/PlanMejora.xlsx',
    sheetName = null,
    startRow = 12,                 // primer par: 12-13
    rowsPerItem = 2,               // cada item ocupa 2 filas
    pairsCount = 14,               // 12..39 => 14 pares exactos
    cols = { fuente: 'A', tipo: 'B', factor: 'C', descripcion: 'D' },

    // META opcional
    writeMeta = false,
    metaCells = {
      dependencia: 'D8',          // nombre de la dependencia
      fechaGeneracion: 'F49',     // fecha de creación del archivo
    },
    metaDateFormat = 'dd/mm/yyyy',
    normalizeTextNewlines = true,
    // Estilo opcional para envolver texto (recomendado en descripciones)
    wrapTextColumns = ['D'],      // columnas donde activar wrap text
  } = {}
) {
  // 0) Import dinámico (evita SSR issues)
  const { default: XlsxPopulate } = await import('xlsx-populate/browser/xlsx-populate')

  // 1) Cargar plantilla
  const res = await fetch(templateUrl)
  if (!res.ok) throw new Error('No se pudo cargar la plantilla del PM')
  const buf = await res.arrayBuffer()
  const wb = await XlsxPopulate.fromDataAsync(buf)

  const sheet = sheetName ? wb.sheet(sheetName) : wb.sheet(0)
  if (!sheet) throw new Error('No se encontró la hoja en la plantilla')

    // ===== Map de capítulos y helper =====
const CAPITULO_TITULOS = {
  1: 'Proyecto Educativo del Programa e Identidad Institucional',
  2: 'Estudiantes',
  3: 'Profesores',
  4: 'Egresados',
  5: 'Aspectos Académicos y Resultados de Aprendizaje',
  6: 'Permanencia y Graduación',
  7: 'Interacción Con el Entorno Nacional e Internacional',
  8: 'Aportes de la Investigación, la Innovación el Desarrollo Tecnológico y la creación, asociados al Programa Académico',
  9: 'Bienestar de la Comunidad Académica del Programa',
  10: 'Medios Educativos y Ambientes de Aprendizaje',
  11: 'Organización, Administración y Financiación del Programa Académico',
  12: 'Recursos Físicos y Tecnológicos',
}

/**
 * Recibe algo como 1, "1", "Capítulo 1", { capitulo: 1 } y devuelve:
 * "1: <título>" si existe en el mapa. Si no, devuelve el texto sanitizado.
 */
const formatCapitulo = (cap) => {
  if (cap == null) return ''
  // extrae el primer número que encuentre
  const n = parseInt(String(cap).match(/\d+/)?.[0] ?? NaN, 10)
  if (!Number.isNaN(n) && CAPITULO_TITULOS[n]) {
    return `${n}: ${CAPITULO_TITULOS[n]}`
  }
  return sanitizeExcelText(String(cap))
}

  // 2) Dataset: solo OM/NC (recortado a espacio)
const itemsRaw = [
  ...oportunidades.map(o => ({
    fuente: 'Auditoría interna',
    tipo: 'Oportunidad de Mejora',
    factor: formatCapitulo(o?.capitulo?.capitulo),  // ⬅️ aquí el cambio
    descripcion: o?.descripcion ?? '',
  })),
  ...noConformidades.map(n => ({
    fuente: 'Auditoría interna',
    tipo: 'No Conformidad',
    factor: formatCapitulo(n?.capitulo?.capitulo),  // ⬅️ aquí el cambio
    descripcion: n?.descripcion ?? '',
  })),
].slice(0, pairsCount)


  // 3) Limpiar fila superior de cada par dentro del bloque (A12:D39)
  const endRow = startRow + (pairsCount * rowsPerItem) - 1
  for (let r = startRow; r <= endRow; r += rowsPerItem) {
    sheet.cell(`${cols.fuente}${r}`).value(null)
    sheet.cell(`${cols.tipo}${r}`).value(null)
    sheet.cell(`${cols.factor}${r}`).value(null)
    sheet.cell(`${cols.descripcion}${r}`).value(null)
  }

  // 4) Escribir cada hallazgo en la fila superior del par (12,14,16,...)
  for (let i = 0; i < itemsRaw.length; i++) {
    const rTop = startRow + i * rowsPerItem
    const it = itemsRaw[i]

    const vFuente = normalizeTextNewlines ? normalizeNewlines(it.fuente) : sanitizeExcelText(it.fuente)
    const vTipo = normalizeTextNewlines ? normalizeNewlines(it.tipo) : sanitizeExcelText(it.tipo)
    const vFactor = normalizeTextNewlines ? normalizeNewlines(it.factor) : sanitizeExcelText(it.factor)
    const vDesc = normalizeTextNewlines ? normalizeNewlines(it.descripcion) : sanitizeExcelText(it.descripcion)

    sheet.cell(`${cols.fuente}${rTop}`).value(vFuente)
    sheet.cell(`${cols.tipo}${rTop}`).value(vTipo)
    sheet.cell(`${cols.factor}${rTop}`).value(vFactor)
    sheet.cell(`${cols.descripcion}${rTop}`).value(vDesc)
  }

  // 5) (Opcional) metadatos
  if (writeMeta) {
    try {
      const depName = sanitizeExcelText(informe?.dependencias?.nombre || '')
      if (metaCells.dependencia) {
        sheet.cell(metaCells.dependencia).value(depName)
      }
      if (metaCells.fechaGeneracion) {
        const dtCell = sheet.cell(metaCells.fechaGeneracion)
        dtCell.value(new Date())
        dtCell.style('numberFormat', metaDateFormat || 'dd/mm/yyyy')
      }
    } catch { /* noop */ }
  }

  // 6) Estilos útiles (envolver texto en columnas indicadas)
  if (wrapTextColumns && wrapTextColumns.length) {
    for (let r = startRow; r <= endRow; r += rowsPerItem) {
      for (const col of wrapTextColumns) {
        sheet.cell(`${col}${r}`).style('wrapText', true)
      }
    }
  }

  // 7) Exportar y descargar
  const dep = toSlugUpper(informe?.dependencias?.nombre || 'SIN_DEP')
  const ymd = toYMD(informe?.fecha_auditoria)
  const fileName = `PlanMejora_${informe?.id ?? 'SIN_ID'}_${dep}_${ymd}.xlsx`

  const out = await wb.outputAsync()
  saveAs(
    new Blob([out], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    fileName
  )
}
