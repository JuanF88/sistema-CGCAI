// @/components/auditor/Utilidades/generarPlanMejora.js
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'

// Utilidades básicas
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

// Helpers defensivos
const dedupeMerges = (ws) => {
  // Quita merges duplicados que a veces vienen en la plantilla
  const m = ws?.model?.merges
  if (Array.isArray(m) && m.length) {
    ws.model.merges = Array.from(new Set(m))
  }
}

const ensurePairMergedIfMissing = (ws, col, rTop, rowsPerItem) => {
  // Solo crea el merge si NO existe; no deshace ni re-hace merges
  try {
    const topCell = ws.getCell(`${col}${rTop}`)
    if (!topCell.isMerged) {
      const range = `${col}${rTop}:${col}${rTop + rowsPerItem - 1}`
      ws.mergeCells(range)
    }
  } catch { /* noop */ }
}

// Helper: set valor respetando merges (usa celda maestra si aplica)
const setMergedCellValue = (ws, address, value) => {
  try {
    const c = ws.getCell(address)
    const target = (c.isMerged && c.master) ? c.master : c
    target.value = value
    return target
  } catch {
    return null
  }
}

export async function generarPlanMejora(
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

    // META: ahora escribiremos dependencia (D8) y fecha de generación (F49) si writeMeta = true
    writeMeta = false,
    metaCells = {
      dependencia: 'D8',          // nombre de la dependencia
      fechaGeneracion: 'F49',     // fecha de creación del archivo
    },
    metaDateFormat = 'dd/mm/yyyy', // formato de fecha en Excel

    // Flags defensivos:
    ensurePairsMerged = false,     // crea el merge del par si NO existe; no des-mergea nada
    stripDataValidations = false,  // elimina validaciones de la hoja (si dan problemas con merges)
    normalizeTextNewlines = true,  // normaliza saltos a "\n" (recomendado)
  } = {}
) {
  // 1) Cargar plantilla
  const wb = new ExcelJS.Workbook()
  const res = await fetch(templateUrl)
  if (!res.ok) throw new Error('No se pudo cargar la plantilla del PM')
  const buf = await res.arrayBuffer()
  await wb.xlsx.load(buf)

  const ws = sheetName ? wb.getWorksheet(sheetName) : wb.worksheets[0]
  if (!ws) throw new Error('No se encontró la hoja en la plantilla')

  // (Opcional) quitar validaciones de datos a nivel de hoja
  if (stripDataValidations && ws.model && ws.model.dataValidations) {
    ws.model.dataValidations = {}
  }

  // 2) Dataset: solo OM/NC
  const itemsRaw = [
    ...oportunidades.map(o => ({
      fuente: 'Auditoría interna',
      tipo: 'Oportunidad de Mejora',
      factor: o?.numeral?.numeral ?? '',
      descripcion: o?.descripcion ?? '',
    })),
    ...noConformidades.map(n => ({
      fuente: 'Auditoría interna',
      tipo: 'No Conformidad',
      factor: n?.numeral?.numeral ?? '',
      descripcion: n?.descripcion ?? '',
    })),
  ]
  // Recorta al espacio físico disponible
  const items = itemsRaw.slice(0, pairsCount)

  // 3) Preparación limitada al bloque (e.g., A12:D39)
  const endRow = startRow + (pairsCount * rowsPerItem) - 1
  const colsList = [cols.fuente, cols.tipo, cols.factor, cols.descripcion]

  // 3.1 (Opcional) Asegurar merges SOLO si faltan (no tocar existentes)
  if (ensurePairsMerged) {
    for (let r = startRow; r <= endRow; r += rowsPerItem) {
      for (const col of colsList) {
        ensurePairMergedIfMissing(ws, col, r, rowsPerItem)
      }
    }
  }

  // 4) Limpiar SOLO la celda superior de cada par dentro del bloque (con null)
  for (let r = startRow; r <= endRow; r += rowsPerItem) {
    ws.getCell(`${cols.fuente}${r}`).value = null
    ws.getCell(`${cols.tipo}${r}`).value = null
    ws.getCell(`${cols.factor}${r}`).value = null
    ws.getCell(`${cols.descripcion}${r}`).value = null
  }

  // 5) Escribir cada hallazgo en la fila superior del par (12,14,16,... <= 38)
  for (let i = 0; i < items.length; i++) {
    const rTop = startRow + i * rowsPerItem
    const it = items[i]

    const vFuente = normalizeTextNewlines ? normalizeNewlines(it.fuente) : sanitizeExcelText(it.fuente)
    const vTipo = normalizeTextNewlines ? normalizeNewlines(it.tipo) : sanitizeExcelText(it.tipo)
    const vFactor = normalizeTextNewlines ? normalizeNewlines(it.factor) : sanitizeExcelText(it.factor)
    const vDesc = normalizeTextNewlines ? normalizeNewlines(it.descripcion) : sanitizeExcelText(it.descripcion)

    ws.getCell(`${cols.fuente}${rTop}`).value = vFuente
    ws.getCell(`${cols.tipo}${rTop}`).value = vTipo
    ws.getCell(`${cols.factor}${rTop}`).value = vFactor
    ws.getCell(`${cols.descripcion}${rTop}`).value = vDesc
  }

  // 6) (opcional) metadatos (D8 dependencia, F49 fecha de generación dd/mm/yyyy)
  if (writeMeta) {
    try {
      const depName = sanitizeExcelText(informe?.dependencias?.nombre || '')
      if (metaCells.dependencia) {
        setMergedCellValue(ws, metaCells.dependencia, depName)
      }

      if (metaCells.fechaGeneracion) {
        const now = new Date()
        const cell = setMergedCellValue(ws, metaCells.fechaGeneracion, now)
        if (cell) {
          // Establecer formato de fecha (ExcelJS soporta numFmt directamente)
          cell.numFmt = metaDateFormat || 'dd/mm/yyyy'
          // Redundante por compatibilidad:
          if (cell.style) cell.style.numFmt = metaDateFormat || 'dd/mm/yyyy'
        }
      }
    } catch { /* noop */ }
  }

  // 7) Dedupe de merges antes de exportar (defensivo)
  dedupeMerges(ws)

  // 8) Descargar con sharedStrings (más tolerante para Excel)
  const dep = toSlugUpper(informe?.dependencias?.nombre || 'SIN_DEP')
  const ymd = toYMD(informe?.fecha_auditoria)
  const fileName = `PlanMejora_${informe?.id}_${dep}_${ymd}.xlsx`

  const out = await wb.xlsx.writeBuffer({ useSharedStrings: true, useStyles: true })
  saveAs(
    new Blob([out], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    fileName
  )
}
