/**
 * Exportación a Excel de las evaluaciones de auditores.
 *
 * Las dos hojas comparten estructura: título combinado, línea de periodo, fila
 * de cabecera en la 4 y los datos a partir de la 5, con filtro y panel fijo.
 */
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import { toast } from 'react-toastify'

import { RUBRICA_CRITERIOS, notaDeCalificaciones } from './rubrica'

const AZUL_TITULO = 'FF667EEA'
const AZUL_CABECERA = 'FF1E40AF'
const GRIS_BORDE = 'FFE2E8F0'

/** Fila donde va la cabecera de la tabla. */
const FILA_CABECERA = 4

const borde = (argb) => ({
  top: { style: 'thin', color: { argb } },
  left: { style: 'thin', color: { argb } },
  bottom: { style: 'thin', color: { argb } },
  right: { style: 'thin', color: { argb } },
})

const relleno = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } })

/** Título en la fila 1 y periodo en la 2, combinados a lo ancho de la tabla. */
function escribirEncabezado(worksheet, { titulo, periodo, ultimaColumna }) {
  worksheet.mergeCells(1, 1, 1, ultimaColumna)
  const celdaTitulo = worksheet.getCell(1, 1)
  celdaTitulo.value = titulo
  celdaTitulo.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } }
  celdaTitulo.alignment = { horizontal: 'center', vertical: 'middle' }
  celdaTitulo.fill = relleno(AZUL_TITULO)
  worksheet.getRow(1).height = 24

  worksheet.mergeCells(2, 1, 2, ultimaColumna)
  const celdaPeriodo = worksheet.getCell(2, 1)
  celdaPeriodo.value = `Periodo: ${periodo}`
  celdaPeriodo.font = { italic: true, color: { argb: 'FF475569' } }
}

/** Da formato a la cabecera y pinta bordes y decimales en los datos. */
function darFormato(worksheet, { alturaCabecera = 22, ajustarTexto = false, desdeColumnaNumerica }) {
  const headerRow = worksheet.getRow(FILA_CABECERA)
  headerRow.values = worksheet.columns.map((column) => column.header)
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  headerRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: ajustarTexto }
  headerRow.fill = relleno(AZUL_CABECERA)
  headerRow.height = alturaCabecera

  for (let n = FILA_CABECERA + 1; n <= worksheet.rowCount; n++) {
    const row = worksheet.getRow(n)
    row.alignment = { vertical: 'middle', wrapText: ajustarTexto }

    for (let col = desdeColumnaNumerica; col <= worksheet.columnCount; col++) {
      const cell = row.getCell(col)
      if (typeof cell.value === 'number') cell.numFmt = '0.00'
    }

    row.eachCell((cell) => {
      cell.border = borde(GRIS_BORDE)
    })
  }

  headerRow.eachCell((cell) => {
    cell.border = borde(AZUL_CABECERA)
  })
}

async function descargar(workbook, nombre) {
  const buffer = await workbook.xlsx.writeBuffer()
  saveAs(
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    nombre
  )
}

/** Datos de identificación que llevan las dos hojas. */
const identificacion = (ev) => ({
  informeId: ev.informe_auditoria_id || '-',
  auditor: `${ev.auditor_nombre || ''} ${ev.auditor_apellido || ''}`.trim() || '-',
  dependencia: ev.auditor_dependencia_nombre || '-',
  fechaAuditoria: ev.fecha_auditoria || '-',
})

/**
 * Resumen general: una fila por evaluación con las cuatro notas.
 */
export async function exportarResumenGeneral({ evaluaciones, periodo }) {
  if (!evaluaciones.length) {
    toast.warning('No hay evaluaciones para exportar')
    return
  }

  try {
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Resumen General')

    worksheet.columns = [
      { header: 'ID Informe', key: 'informeId', width: 16 },
      { header: 'Auditor', key: 'auditor', width: 28 },
      { header: 'Dependencia', key: 'dependencia', width: 30 },
      { header: 'Fecha Auditoría', key: 'fechaAuditoria', width: 18 },
      { header: 'Nota Archivos', key: 'notaArchivos', width: 14 },
      { header: 'Nota Encuesta', key: 'notaEncuesta', width: 14 },
      { header: 'Nota Rúbrica', key: 'notaRubrica', width: 14 },
      { header: 'Nota Final', key: 'notaFinal', width: 12 },
    ]

    escribirEncabezado(worksheet, {
      titulo: 'Resumen General de Evaluaciones de Auditores',
      periodo,
      ultimaColumna: worksheet.columns.length,
    })

    evaluaciones.forEach((ev) => {
      worksheet.addRow({
        ...identificacion(ev),
        notaArchivos: ev.nota_archivos !== null ? Number(ev.nota_archivos) : null,
        notaEncuesta: ev.nota_encuesta !== null ? Number(ev.nota_encuesta) : null,
        notaRubrica: ev.nota_rubrica !== null ? Number(ev.nota_rubrica) : null,
        notaFinal: ev.nota_final != null ? Number(ev.nota_final) : null,
      })
    })

    worksheet.autoFilter = { from: 'A4', to: 'H4' }
    worksheet.views = [{ state: 'frozen', ySplit: FILA_CABECERA }]
    darFormato(worksheet, { desdeColumnaNumerica: 5 })

    await descargar(workbook, `resumen_evaluacion_auditores_${periodo}.xlsx`)
    toast.success('Resumen general exportado en Excel')
  } catch (err) {
    console.error('Error exportando resumen general:', err)
    toast.error('No se pudo exportar el resumen general')
  }
}

/**
 * Evaluación manual: una columna por criterio de la rúbrica más la nota final.
 */
export async function exportarEvaluacionManual({ evaluaciones, calificacionesMatriz, periodo }) {
  if (!evaluaciones.length) {
    toast.warning('No hay evaluaciones manuales para exportar')
    return
  }

  try {
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Evaluación Manual')

    worksheet.columns = [
      { header: 'ID Informe', key: 'informeId', width: 14 },
      { header: 'Auditor', key: 'auditor', width: 28 },
      { header: 'Dependencia', key: 'dependencia', width: 28 },
      { header: 'Fecha Auditoría', key: 'fechaAuditoria', width: 18 },
      ...RUBRICA_CRITERIOS.map((criterio) => ({
        header: criterio.nombre,
        key: criterio.id,
        width: 22,
      })),
      { header: 'Nota Final (1-5)', key: 'notaFinal', width: 16 },
    ]

    escribirEncabezado(worksheet, {
      titulo: 'Evaluación Manual de Auditores',
      periodo,
      ultimaColumna: worksheet.columns.length,
    })

    evaluaciones.forEach((ev) => {
      const calificaciones = calificacionesMatriz[ev.id] || {}
      const nota = notaDeCalificaciones(calificaciones)

      worksheet.addRow({
        ...identificacion(ev),
        notaFinal: nota > 0 ? nota : null,
        ...Object.fromEntries(RUBRICA_CRITERIOS.map((c) => [c.id, calificaciones[c.id] ?? null])),
      })
    })

    worksheet.autoFilter = {
      from: { row: FILA_CABECERA, column: 1 },
      to: { row: FILA_CABECERA, column: worksheet.columnCount },
    }
    worksheet.views = [{ state: 'frozen', ySplit: FILA_CABECERA, xSplit: 4 }]
    darFormato(worksheet, { alturaCabecera: 42, ajustarTexto: true, desdeColumnaNumerica: 5 })

    await descargar(workbook, `evaluacion_manual_auditores_${periodo}.xlsx`)
    toast.success('Evaluación manual exportada en Excel')
  } catch (err) {
    console.error('Error exportando evaluación manual:', err)
    toast.error('No se pudo exportar la evaluación manual')
  }
}
