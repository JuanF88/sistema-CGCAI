/**
 * Exporta un programa de auditoría al formato PE-GS-2.2.1-FOR-7.
 *
 * Se construye la hoja desde cero en vez de rellenar la plantilla: el Excel
 * original trae cuatro hojas, hojas de catálogo y una columna de contraseñas en
 * texto plano. Aquí se generan solo las dos que se piden —«Programa AI
 * Estratégico» y «Distribución»— reproduciendo la maquetación: combinaciones,
 * anchos y bordes.
 *
 * La segunda es opcional: un programa sin asignaciones se exporta con una sola
 * hoja.
 */
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import { toast } from 'react-toastify'

import { CODIGO_FORMATO, SEMANAS, TITULO_FORMATO, VERSION_FORMATO, semanasDe } from './formato'

/* ── Estilos ── */

const AZUL_CABECERA = 'FF1F4E79'
const GRIS_ETIQUETA = 'FFD9E2F3'
const GRIS_BORDE = 'FFBFBFBF'

const borde = {
  top: { style: 'thin', color: { argb: GRIS_BORDE } },
  left: { style: 'thin', color: { argb: GRIS_BORDE } },
  bottom: { style: 'thin', color: { argb: GRIS_BORDE } },
  right: { style: 'thin', color: { argb: GRIS_BORDE } },
}

const relleno = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } })

/** Escribe en `dir`, combina si se indica rango y aplica estilo. */
function escribir(ws, dir, valor, { combinar, etiqueta, titulo, centrar, wrap = true } = {}) {
  if (combinar) ws.mergeCells(combinar)

  const celda = ws.getCell(dir)
  celda.value = valor ?? ''
  celda.alignment = {
    vertical: 'middle',
    horizontal: centrar || (etiqueta || titulo ? 'center' : 'left'),
    wrapText: wrap,
  }
  celda.border = borde

  if (titulo) {
    celda.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } }
    celda.fill = relleno(AZUL_CABECERA)
  } else if (etiqueta) {
    celda.font = { bold: true, size: 9 }
    celda.fill = relleno(GRIS_ETIQUETA)
  } else {
    celda.font = { size: 9 }
  }

  return celda
}

/* ── Hoja 1: Programa AI Estratégico ── */

const ANCHOS_PROGRAMA = [25, 15, 51, 47, 31, 26, 5, 16, 18, 2, 2, 15, 7, 5]

/**
 * Las cuatro semanas del cronograma, en pares de columnas.
 *
 * Son los mismos rangos del formato original: G:H, I:J, K:L y M:N a la derecha
 * de los requisitos ISO 14001. Los anchos vienen del Excel institucional, por
 * eso las cuatro parejas no miden lo mismo.
 */
const COLUMNAS_SEMANA = [
  ['G', 'H'],
  ['I', 'J'],
  ['K', 'L'],
  ['M', 'N'],
]

/**
 * Reparte un texto en dos mitades por líneas.
 *
 * Los criterios se escriben en un solo campo, pero el formato los pinta en dos
 * celdas contiguas: se corta por el salto de línea más cercano a la mitad para
 * no partir ningún renglón.
 */
/**
 * La celda AUDITOR(ES) de una línea del cronograma.
 *
 * El formato no tiene columna para el acompañante —las catorce están
 * repartidas—, pero sí lo nombra en la nomenclatura del pie: «AA: Auditor
 * Acompañante». Así que va en la misma celda, en un segundo renglón y con esa
 * misma marca, en vez de inventar una columna que descuadraría la hoja.
 */
function celdaAuditores(dep) {
  const auditores = String(dep.auditores ?? '').trim()
  const acompanante = String(dep.auditor_acompanante ?? '').trim()

  if (!acompanante) return auditores
  return auditores ? `${auditores}\nAA: ${acompanante}` : `AA: ${acompanante}`
}

function partirEnDos(texto) {
  const lineas = String(texto ?? '').split('\n')
  if (lineas.length < 2) return [texto ?? '', '']

  const corte = Math.ceil(lineas.length / 2)
  return [lineas.slice(0, corte).join('\n'), lineas.slice(corte).join('\n')]
}

function hojaPrograma(wb, programa) {
  const ws = wb.addWorksheet('Programa AI Estratégico', {
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
  })
  ws.columns = ANCHOS_PROGRAMA.map((width) => ({ width }))

  // Encabezado institucional
  escribir(ws, 'A1', 'LOGO', { combinar: 'A1:A2', etiqueta: true })
  escribir(ws, 'B1', TITULO_FORMATO, { combinar: 'B1:N2', titulo: true })
  ws.getRow(1).height = 22
  ws.getRow(2).height = 22

  escribir(ws, 'A3', `Código: ${programa.codigo_formato || CODIGO_FORMATO}`, {
    combinar: 'A3:D3',
    etiqueta: true,
  })
  escribir(ws, 'F3', `Versión: ${programa.version_formato || VERSION_FORMATO}`, {
    combinar: 'F3:H3',
    etiqueta: true,
  })
  escribir(ws, 'I3', programa.nombre || '', { combinar: 'I3:N3', etiqueta: true })

  // Objetivo
  escribir(ws, 'A4', 'OBJETIVO PROGRAMA', { etiqueta: true })
  escribir(ws, 'B4', programa.objetivo, { combinar: 'B4:N4' })
  ws.getRow(4).height = 90

  // Alcance + recursos
  escribir(ws, 'A5', 'ALCANCE PROGRAMA', { combinar: 'A5:A7', etiqueta: true })
  escribir(ws, 'B5', programa.alcance, { combinar: 'B5:F7' })
  escribir(ws, 'G5', 'RECURSOS', { combinar: 'G5:N5', etiqueta: true })
  escribir(ws, 'G6', 'Talento Humano', { combinar: 'G6:H6', etiqueta: true })
  escribir(ws, 'I6', 'Financiero', { combinar: 'I6:K6', etiqueta: true })
  escribir(ws, 'L6', 'Tecnológico', { combinar: 'L6:N6', etiqueta: true })
  escribir(ws, 'G7', programa.recurso_humano, { combinar: 'G7:H7' })
  escribir(ws, 'I7', programa.recurso_financiero, { combinar: 'I7:K7' })
  escribir(ws, 'L7', programa.recurso_tecnologico, { combinar: 'L7:N7' })
  ws.getRow(6).height = 18
  ws.getRow(7).height = 60

  // Criterios: un solo campo que se reparte en las dos celdas del formato.
  const [criteriosIzq, criteriosDer] = partirEnDos(programa.criterios)
  escribir(ws, 'A8', 'CRITERIOS', { etiqueta: true })
  escribir(ws, 'B8', criteriosIzq, { combinar: 'B8:D8' })
  escribir(ws, 'E8', criteriosDer, { combinar: 'E8:N8' })
  ws.getRow(8).height = 120

  // Metodología + riesgos / controles / oportunidades
  //
  // El formato dibuja dos filas, pero las listas son abiertas: se hacen tantas
  // como la más larga de las tres, con un mínimo de dos para no romper el
  // aspecto del formato cuando vienen vacías.
  const riesgos = programa.riesgos ?? []
  const controles = programa.controles ?? []
  const oportunidades = programa.oportunidades ?? []
  const filasRCO = Math.max(2, riesgos.length, controles.length, oportunidades.length)

  const primera = 9
  const ultima = primera + filasRCO - 1

  escribir(ws, `A${primera}`, 'METODOLOGÍA', {
    combinar: `A${primera}:A${ultima}`,
    etiqueta: true,
  })
  escribir(ws, `B${primera}`, programa.metodologia, {
    combinar: `B${primera}:C${ultima}`,
  })

  escribir(ws, `D${primera}`, 'RIESGOS', { combinar: `D${primera}:D${ultima}`, etiqueta: true })
  escribir(ws, `G${primera}`, 'CONTROLES', { combinar: `G${primera}:G${ultima}`, etiqueta: true })
  escribir(ws, `J${primera}`, 'OPORTUNIDADES', {
    combinar: `J${primera}:K${ultima}`,
    etiqueta: true,
  })

  for (let i = 0; i < filasRCO; i++) {
    const f = primera + i
    escribir(ws, `E${f}`, riesgos[i] ?? '', { combinar: `E${f}:F${f}` })
    escribir(ws, `H${f}`, controles[i] ?? '', { combinar: `H${f}:I${f}` })
    escribir(ws, `L${f}`, oportunidades[i] ?? '', { combinar: `L${f}:N${f}` })
    ws.getRow(f).height = 70
  }

  // Cronograma
  //
  // Sin dependencias no se dibuja nada: el título y los encabezados solos
  // parecían un cronograma con dos renglones puestos por el sistema, y no lo
  // eran. Las secciones sin dependencias tampoco salen, aunque tengan
  // requisitos: una fila de proceso sin nadie auditado no dice nada.
  let fila = ultima + 1
  const filasCronograma = (programa.cronograma ?? []).filter(
    (seccion) => (seccion.dependencias ?? []).length > 0
  )

  if (filasCronograma.length) {
    escribir(ws, `A${fila}`, 'CRONOGRAMA', { combinar: `A${fila}:N${fila}`, etiqueta: true })
    fila++

    // Encabezado a dos alturas, como el formato: las cinco columnas de datos
    // ocupan las dos filas, y bajo el rótulo del mes se abre la cuadrícula de
    // semanas.
    const alto = fila
    const bajo = fila + 1

    escribir(ws, `A${alto}`, 'PROCESO A AUDITAR', {
      combinar: `A${alto}:B${bajo}`,
      etiqueta: true,
    })
    escribir(ws, `C${alto}`, 'AUDITADO/PROGRAMA', { combinar: `C${alto}:C${bajo}`, etiqueta: true })
    escribir(ws, `D${alto}`, 'AUDITOR(ES)', { combinar: `D${alto}:D${bajo}`, etiqueta: true })
    escribir(ws, `E${alto}`, 'REQUISITOS ISO 9001:2015', {
      combinar: `E${alto}:E${bajo}`,
      etiqueta: true,
    })
    escribir(ws, `F${alto}`, 'REQUISITOS ISO 14001:2015', {
      combinar: `F${alto}:F${bajo}`,
      etiqueta: true,
    })

    escribir(ws, `G${alto}`, `MES DE AUDITORIA: ${programa.mes_auditoria || ''}`.trim(), {
      combinar: `G${alto}:N${alto}`,
      etiqueta: true,
    })

    COLUMNAS_SEMANA.forEach(([desde, hasta], i) => {
      escribir(ws, `${desde}${bajo}`, `Semana ${SEMANAS[i]}`, {
        combinar: `${desde}${bajo}:${hasta}${bajo}`,
        etiqueta: true,
      })
    })

    ws.getRow(alto).height = 30
    ws.getRow(bajo).height = 18

    fila = bajo + 1

    // Un bloque por proceso: el nombre, los requisitos y las semanas se combinan
    // de arriba abajo en todo el bloque —son del proceso, no de cada línea— y
    // solo el auditado y sus auditores cambian de una fila a la siguiente.
    for (const seccion of filasCronograma) {
      const dependencias = seccion.dependencias ?? []
      if (!dependencias.length) continue

      const primeraFila = fila
      const ultimaFila = fila + dependencias.length - 1

      escribir(ws, `A${primeraFila}`, seccion.proceso, {
        combinar: `A${primeraFila}:B${ultimaFila}`,
      })
      escribir(ws, `E${primeraFila}`, seccion.requisitos_9001, {
        combinar: `E${primeraFila}:E${ultimaFila}`,
      })
      escribir(ws, `F${primeraFila}`, seccion.requisitos_14001, {
        combinar: `F${primeraFila}:F${ultimaFila}`,
      })

      const marcadas = semanasDe(seccion.semanas)
      COLUMNAS_SEMANA.forEach(([desde, hasta], i) => {
        escribir(ws, `${desde}${primeraFila}`, marcadas.has(SEMANAS[i]) ? 'X' : '', {
          combinar: `${desde}${primeraFila}:${hasta}${ultimaFila}`,
          centrar: 'center',
        })
      })

      for (const dep of dependencias) {
        escribir(ws, `C${fila}`, dep.auditado)
        escribir(ws, `D${fila}`, celdaAuditores(dep))

        // Con acompañante la celda ocupa dos renglones y, con el alto fijo, el
        // segundo se quedaba cortado.
        ws.getRow(fila).height = dep.auditor_acompanante ? 44 : 30
        fila++
      }
    }
  }

  // Pie
  escribir(ws, `A${fila}`, 'NOMENCLATURA', { combinar: `A${fila}:B${fila}`, etiqueta: true })
  escribir(ws, `C${fila}`, programa.nomenclatura, { combinar: `C${fila}:N${fila}` })
  fila++

  escribir(ws, `A${fila}`, 'OBSERVACIONES', { combinar: `A${fila}:B${fila}`, etiqueta: true })
  escribir(ws, `C${fila}`, programa.observaciones, { combinar: `C${fila}:N${fila}` })
  ws.getRow(fila).height = 40
  fila++

  escribir(ws, `A${fila}`, 'ELABORACIÓN', { combinar: `A${fila}:D${fila}`, etiqueta: true })
  escribir(ws, `E${fila}`, 'REVISIÓN', { combinar: `E${fila}:G${fila}`, etiqueta: true })
  escribir(ws, `H${fila}`, 'APROBACIÓN', { combinar: `H${fila}:N${fila}`, etiqueta: true })
  fila++

  escribir(ws, `A${fila}`, 'Funcionarios Responsables:', { combinar: `A${fila}:B${fila}` })
  escribir(ws, `C${fila}`, programa.elaborado_por, { combinar: `C${fila}:D${fila}` })
  escribir(ws, `E${fila}`, programa.revisado_por, { combinar: `E${fila}:G${fila}` })
  escribir(ws, `H${fila}`, programa.aprobado_por, { combinar: `H${fila}:N${fila}` })
  fila++

  escribir(ws, `A${fila}`, `Cargo: ${programa.elaborado_cargo || ''}`, {
    combinar: `A${fila}:D${fila}`,
  })
  escribir(ws, `E${fila}`, `Cargo: ${programa.revisado_cargo || ''}`, {
    combinar: `E${fila}:G${fila}`,
  })
  escribir(ws, `H${fila}`, programa.aprobado_cargo, { combinar: `H${fila}:N${fila}` })
  fila++

  escribir(ws, `A${fila}`, '', { combinar: `A${fila}:D${fila}` })
  escribir(ws, `E${fila}`, '', { combinar: `E${fila}:G${fila}` })
  escribir(ws, `H${fila}`, `FECHA: ${programa.fecha_aprobacion || ''}`, {
    combinar: `H${fila}:N${fila}`,
    etiqueta: true,
  })

  return ws
}

/* ── Hoja 2: Distribución ── */

const COLUMNAS_DISTRIBUCION = [
  { header: 'NIVEL', key: 'responsable_titulo', width: 25 },
  { header: 'RESPONSABLE', key: 'responsable_nombre', width: 32 },
  { header: 'ORGANISMO', key: 'organismo', width: 45 },
  { header: 'GESTIÓN', key: 'gestion', width: 35 },
  { header: 'FACULTAD', key: 'facultad', width: 34 },
  { header: 'PROCESO/FACULTAD', key: 'proceso', width: 45 },
  { header: 'AUDITOR', key: 'auditor_nombre', width: 35 },
  { header: 'CORREO', key: 'auditor_correo', width: 34 },
  { header: 'ESTUDIOS', key: 'auditor_estudios', width: 45 },
  { header: 'COORDINADOR', key: 'coordinador_nombre', width: 33 },
  { header: 'CORREO', key: 'coordinador_correo', width: 34 },
  { header: 'ALTERNO', key: 'coordinador_alterno', width: 32 },
  { header: 'NIVEL ACADÉMICO', key: 'coordinador_nivel', width: 25 },
  { header: 'GESTOR', key: 'gestor_nombre', width: 32 },
  { header: 'CORREO', key: 'gestor_correo', width: 34 },
  { header: 'DECANATURA', key: 'decanatura_nombre', width: 39 },
  { header: 'CORREO', key: 'decanatura_correo', width: 33 },
  { header: 'TÍTULO DECANO', key: 'decano_titulo', width: 20 },
  { header: 'DECANO', key: 'decano_nombre', width: 30 },
]

function hojaDistribucion(wb, programa) {
  const ws = wb.addWorksheet('Distribución', {
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
  })
  ws.columns = COLUMNAS_DISTRIBUCION.map(({ header, key, width }) => ({ header, key, width }))

  // Título sobre toda la tabla.
  ws.spliceRows(1, 0, [])
  ws.mergeCells(1, 1, 1, COLUMNAS_DISTRIBUCION.length)
  const titulo = ws.getCell(1, 1)
  titulo.value = `Distribución de auditores — ${programa.nombre || ''} (${programa.anio ?? ''})`
  titulo.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } }
  titulo.alignment = { horizontal: 'center', vertical: 'middle' }
  titulo.fill = relleno(AZUL_CABECERA)
  ws.getRow(1).height = 24

  const cabecera = ws.getRow(2)
  cabecera.values = COLUMNAS_DISTRIBUCION.map((c) => c.header)
  cabecera.font = { bold: true, size: 9, color: { argb: 'FFFFFFFF' } }
  cabecera.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
  cabecera.fill = relleno(AZUL_CABECERA)
  cabecera.height = 28
  cabecera.eachCell((celda) => {
    celda.border = borde
  })

  for (const fila of programa.distribucion ?? []) {
    const row = ws.addRow(fila)
    row.font = { size: 9 }
    row.alignment = { vertical: 'middle', wrapText: true }
    row.eachCell((celda) => {
      celda.border = borde
    })
  }

  ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: ws.columnCount } }
  ws.views = [{ state: 'frozen', ySplit: 2, xSplit: 3 }]

  return ws
}

/* ── Punto de entrada ── */

/** Nombre de archivo sin caracteres problemáticos. */
const nombreArchivo = (programa) =>
  `Programa_Auditoria_${programa.anio ?? ''}_${(programa.nombre || 'sin-nombre')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')}.xlsx`

/**
 * Arma el libro, sin descargarlo.
 *
 * Separado de la descarga para poder comprobarlo fuera del navegador.
 * @param {Object} programa Cabecera con `cronograma` y `distribucion`
 */
export function construirLibroPrograma(programa) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Sistema CGCAI'
  wb.created = new Date()

  hojaPrograma(wb, programa)

  // La distribución es opcional: sin asignaciones se omite la hoja entera. Una
  // hoja con solo los encabezados y ninguna fila, en un archivo que se entrega,
  // se lee como un olvido y no como una decisión.
  if (programa.distribucion?.length) hojaDistribucion(wb, programa)

  return wb
}

/**
 * Genera y descarga el Excel del programa.
 * @param {Object} programa Cabecera con `cronograma` y `distribucion`
 */
export async function exportarProgramaExcel(programa) {
  try {
    const buffer = await construirLibroPrograma(programa).xlsx.writeBuffer()
    saveAs(
      new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
      nombreArchivo(programa)
    )

    toast.success('Programa exportado en Excel')
  } catch (err) {
    console.error('Error exportando el programa:', err)
    toast.error('No se pudo exportar el programa.')
  }
}
