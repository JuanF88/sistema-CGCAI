/**
 * Exportación a Excel de las evaluaciones de auditores y de auditados.
 *
 * Las hojas comparten estructura: título combinado, línea de periodo, fila de
 * cabecera en la 4 y los datos a partir de la 5, con filtro y panel fijo.
 */
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import { toast } from 'react-toastify'

import { anioDe, formatearDia } from '@/lib/fechas'

import {
  ASPECTOS,
  promedioEvaluacion,
  promedioGeneral,
  promedioPorAspecto,
} from './evaluacion-auditados'
import { notaDeCalificaciones, rubricaDelPeriodo } from './rubrica'

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

  // La cabecera se escribe antes que los datos: `addRow` escribe tras la última
  // fila que exista, y sin esta la primera caería en la 3 y la segunda en la 4,
  // donde la cabecera la borraba.
  worksheet.getRow(FILA_CABECERA).values = worksheet.columns.map((column) => column.header)
}

/** Da formato a la cabecera y pinta bordes y decimales en los datos. */
function darFormato(worksheet, { alturaCabecera = 22, ajustarTexto = false, desdeColumnaNumerica }) {
  const headerRow = worksheet.getRow(FILA_CABECERA)
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
    const { criterios } = rubricaDelPeriodo(periodo)

    worksheet.columns = [
      { header: 'ID Informe', key: 'informeId', width: 14 },
      { header: 'Auditor', key: 'auditor', width: 28 },
      { header: 'Dependencia', key: 'dependencia', width: 28 },
      { header: 'Fecha Auditoría', key: 'fechaAuditoria', width: 18 },
      ...criterios.map((criterio) => ({
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
      const nota = notaDeCalificaciones(calificaciones, periodo)

      worksheet.addRow({
        ...identificacion(ev),
        notaFinal: nota > 0 ? nota : null,
        ...Object.fromEntries(criterios.map((c) => [c.id, calificaciones[c.id] ?? null])),
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

/** Una hoja del consolidado: una fila por auditoría y la media de cada pregunta al final. */
function escribirHojaConsolidado(workbook, nombre, filas) {
  const worksheet = workbook.addWorksheet(nombre)

  worksheet.columns = [
    { header: 'ID Informe', key: 'informeId', width: 11 },
    { header: 'Fecha', key: 'fecha', width: 14 },
    { header: 'Dependencia', key: 'dependencia', width: 36 },
    { header: 'Proceso auditado', key: 'proceso', width: 30 },
    { header: 'Líder del proceso', key: 'lider', width: 26 },
    { header: 'Auditor', key: 'auditor', width: 26 },
    ...ASPECTOS.map((a) => ({ header: a.titulo, key: a.clave, width: 16 })),
    { header: 'Promedio', key: 'promedio', width: 11 },
    { header: 'Estado', key: 'estado', width: 22 },
    { header: 'Observaciones', key: 'observaciones', width: 60 },
  ]

  const ultimaColumna = worksheet.columns.length
  escribirEncabezado(worksheet, {
    titulo: 'Consolidado de Evaluación de Auditados',
    periodo: nombre,
    ultimaColumna,
  })

  const ordenadas = [...filas].sort((a, b) =>
    (a.informe.fecha_auditoria ?? '').localeCompare(b.informe.fecha_auditoria ?? '')
  )

  ordenadas.forEach(({ informe, evaluacion, proceso, auditor, estado }) => {
    worksheet.addRow({
      informeId: informe.id,
      fecha: formatearDia(informe.fecha_auditoria) ?? '',
      dependencia: informe.dependencias?.nombre ?? '',
      proceso,
      lider: evaluacion?.lider_proceso ?? '',
      auditor,
      ...Object.fromEntries(ASPECTOS.map((a) => [a.clave, evaluacion?.[a.clave] ?? null])),
      promedio: promedioEvaluacion(evaluacion),
      estado,
      observaciones: evaluacion?.observaciones ?? '',
    })
  })

  // El filtro termina en la última auditoría para que al ordenar no se lleve
  // la fila de promedios.
  worksheet.autoFilter = {
    from: { row: FILA_CABECERA, column: 1 },
    to: { row: worksheet.rowCount, column: ultimaColumna },
  }

  const evaluaciones = filas.map((f) => f.evaluacion).filter(Boolean)
  const medias = promedioPorAspecto(evaluaciones)
  const filaPromedios = worksheet.addRow({
    dependencia: 'Promedio',
    ...Object.fromEntries(ASPECTOS.map((a, i) => [a.clave, medias[i].promedio])),
    promedio: promedioGeneral(evaluaciones),
  })

  worksheet.views = [{ state: 'frozen', ySplit: FILA_CABECERA, xSplit: 3 }]
  // Sin columna «numérica»: las valoraciones son enteras y el promedio lleva
  // un decimal, no los dos que da `darFormato`.
  darFormato(worksheet, {
    alturaCabecera: 64,
    ajustarTexto: true,
    desdeColumnaNumerica: ultimaColumna + 1,
  })

  worksheet.getColumn('promedio').numFmt = '0.0'
  ASPECTOS.forEach((a) => {
    filaPromedios.getCell(a.clave).numFmt = '0.0'
  })
  filaPromedios.font = { bold: true }
  filaPromedios.fill = relleno('FFF1F5F9')

  // `darFormato` solo bordea las celdas con valor, y las auditorías sin
  // evaluación tienen casi toda la fila vacía.
  for (let n = FILA_CABECERA + 1; n <= worksheet.rowCount; n++) {
    for (let col = 1; col <= ultimaColumna; col++) {
      worksheet.getRow(n).getCell(col).border = borde(GRIS_BORDE)
    }
  }
}

/**
 * Consolidado de la evaluación de auditados, con una hoja por año. Con un año
 * elegido, `filas` solo trae ese y sale una hoja.
 *
 * @param {Object} params
 * @param {Array<{ informe: Object, evaluacion: Object|null, proceso: string, auditor: string, estado: string }>} params.filas
 */
export async function exportarConsolidadoAuditados({ filas }) {
  if (!filas.length) {
    toast.warning('No hay auditorías para exportar')
    return
  }

  try {
    const porAnio = new Map()
    filas.forEach((fila) => {
      // 0: sin fecha. Al ordenar de mayor a menor queda en la última hoja.
      const anio = anioDe(fila.informe.fecha_auditoria) ?? 0
      porAnio.set(anio, [...(porAnio.get(anio) ?? []), fila])
    })
    const anios = [...porAnio.keys()].sort((a, b) => b - a)

    const workbook = new ExcelJS.Workbook()
    anios.forEach((anio) =>
      escribirHojaConsolidado(workbook, anio ? String(anio) : 'Sin fecha', porAnio.get(anio))
    )

    const sufijo = anios.length === 1 && anios[0] ? anios[0] : 'todos_los_anios'
    await descargar(workbook, `consolidado_evaluacion_auditados_${sufijo}.xlsx`)
    toast.success('Consolidado exportado en Excel')
  } catch (err) {
    console.error('Error exportando el consolidado de auditados:', err)
    toast.error('No se pudo exportar el consolidado')
  }
}
