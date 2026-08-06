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

import {
  CODIGO_FORMATO,
  SEMANAS_POR_MES,
  TITULO_FORMATO,
  VERSION_FORMATO,
  mesesDelPrograma,
  semanasDe,
  semanasDelPrograma,
} from './formato'

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

/**
 * Las seis columnas de contenido, A a F: proceso, auditado, auditores y los dos
 * bloques de requisitos ISO. Los anchos vienen del Excel institucional.
 */
const ANCHOS_CONTENIDO = [25, 15, 51, 47, 31, 26]

/**
 * Lo que ocupa **un** mes de cronograma: cuatro semanas de dos columnas cada
 * una. Con un solo mes son las G:H, I:J, K:L y M:N del formato original, con
 * sus anchos originales —por eso las cuatro parejas no miden lo mismo—; cada
 * mes de más repite el bloque a la derecha.
 */
const ANCHOS_MES = [5, 16, 18, 2, 2, 15, 7, 5]

/** Cuántas columnas ocupa una semana. Dos, como en el formato. */
const COLUMNAS_POR_SEMANA = 2

/**
 * Alto de la fila de firmas del pie, en puntos.
 *
 * Es una fila vacía entre el rótulo (ELABORACIÓN / REVISIÓN / APROBACIÓN) y el
 * nombre del responsable: el hueco donde se firma cuando el formato se imprime.
 */
const ALTO_FIRMAS = 24

/**
 * El escudo de la Universidad, para la celda LOGO del encabezado.
 *
 * Es una copia recortada y reducida de `logo-universidad.png` —el original son
 * 2048×2048 y medio mega, y se incrusta entero en cada archivo que se exporta—.
 * Se generó con:
 *
 *   sharp('public/logo-universidad.png')
 *     .trim().resize({ width: 320, height: 320, fit: 'inside' })
 *     .png({ compressionLevel: 9, palette: true })
 *     .toFile('public/logo-universidad-excel.png')
 *
 * El recorte quita el margen transparente, que es lo que deja la proporción
 * 208×320 y permite encajarlo en la celda sin aire de sobra alrededor.
 */
const RUTA_LOGO = '/logo-universidad-excel.png'

/**
 * Tamaño y posición del escudo dentro de A1:A2, en píxeles y en fracción de
 * celda. Mantiene la proporción del recorte (208×320) y queda centrado: la
 * celda mide unos 180 px de ancho por 107 de alto.
 */
const LOGO = {
  tl: { col: 0.33, row: 0.08 },
  ext: { width: 62, height: 96 },
  editAs: 'oneCell',
}

/**
 * Descarga el escudo para incrustarlo.
 *
 * Devuelve `null` si falla: el programa se exporta igual con la celda rotulada
 * «LOGO», que es como salía antes. Un archivo sin escudo es mejor que ningún
 * archivo.
 */
async function cargarLogo() {
  try {
    const respuesta = await fetch(RUTA_LOGO)
    if (!respuesta.ok) return null
    return await respuesta.arrayBuffer()
  } catch {
    return null
  }
}

/**
 * Índice de columna (1 = A) → letra. Hace falta más allá de la Z: un programa
 * de tres meses llega a la columna 30, que es «AD».
 */
function letraColumna(indice) {
  let n = indice
  let letra = ''
  while (n > 0) {
    const resto = (n - 1) % 26
    letra = String.fromCharCode(65 + resto) + letra
    n = Math.floor((n - 1) / 26)
  }
  return letra
}

/**
 * La geometría de la hoja, que depende de cuántos meses abarque el programa.
 *
 * Todo lo que en el formato llegaba hasta la N —el título, los recursos, la
 * nomenclatura, el pie— llega hasta `fin`, que se corre a la derecha con cada
 * mes añadido. Sin meses no hay cuadrícula y la hoja se queda en las catorce
 * columnas de siempre, para que un programa sin fechas no salga mutilado.
 */
function geometria(programa) {
  const meses = mesesDelPrograma(programa)
  const semanas = semanasDelPrograma(programa)
  const mesesDibujados = meses.length || 1

  const anchos = [...ANCHOS_CONTENIDO]
  for (let i = 0; i < mesesDibujados; i++) anchos.push(...ANCHOS_MES)

  // Cada semana, sus dos columnas: la primera es donde se escribe la «X».
  const columnasDeSemana = semanas.map((semana, i) => {
    const primera = ANCHOS_CONTENIDO.length + 1 + i * COLUMNAS_POR_SEMANA
    return {
      ...semana,
      desde: letraColumna(primera),
      hasta: letraColumna(primera + COLUMNAS_POR_SEMANA - 1),
    }
  })

  return {
    meses,
    anchos,
    columnasDeSemana,
    fin: letraColumna(anchos.length),
  }
}

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
 * Arriba el líder, que es de quien es la auditoría. Debajo los acompañantes,
 * uno por renglón y con la marca «AA:» de la nomenclatura del pie: el formato
 * no tiene columna para ellos —las catorce están repartidas—, así que van en
 * la misma celda en vez de inventar una columna que descuadraría la hoja.
 */
function celdaAuditores(dep) {
  const lider = String(dep.auditores ?? '').trim()

  const acompanantes = String(dep.auditor_acompanante ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
    .map((nombre) => `AA: ${nombre}`)

  return [lider, ...acompanantes].filter(Boolean).join('\n')
}

function partirEnDos(texto) {
  const lineas = String(texto ?? '').split('\n')
  if (lineas.length < 2) return [texto ?? '', '']

  const corte = Math.ceil(lineas.length / 2)
  return [lineas.slice(0, corte).join('\n'), lineas.slice(corte).join('\n')]
}

function hojaPrograma(wb, programa, logo) {
  const ws = wb.addWorksheet('Programa AI Estratégico', {
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
  })

  const { meses, anchos, columnasDeSemana, fin } = geometria(programa)
  ws.columns = anchos.map((width) => ({ width }))

  // Encabezado institucional.
  //
  // Sin escudo la celda se queda rotulada «LOGO» y con el gris de etiqueta, que
  // es como salía antes; con él va en blanco, porque el gris detrás de un PNG
  // transparente se ve como una mancha. Los altos son los del formato original
  // y le dan al escudo sus 107 px de caja.
  escribir(ws, 'A1', logo ? '' : 'LOGO', { combinar: 'A1:A2', etiqueta: !logo })
  escribir(ws, 'B1', TITULO_FORMATO, { combinar: `B1:${fin}2`, titulo: true })
  ws.getRow(1).height = 24
  ws.getRow(2).height = 56

  if (logo) {
    ws.addImage(wb.addImage({ buffer: logo, extension: 'png' }), LOGO)
  }

  escribir(ws, 'A3', `Código: ${programa.codigo_formato || CODIGO_FORMATO}`, {
    combinar: 'A3:D3',
    etiqueta: true,
  })
  escribir(ws, 'F3', `Versión: ${programa.version_formato || VERSION_FORMATO}`, {
    combinar: 'F3:H3',
    etiqueta: true,
  })
  escribir(ws, 'I3', programa.nombre || '', { combinar: `I3:${fin}3`, etiqueta: true })

  // Objetivo
  escribir(ws, 'A4', 'OBJETIVO PROGRAMA', { etiqueta: true })
  escribir(ws, 'B4', programa.objetivo, { combinar: `B4:${fin}4` })
  ws.getRow(4).height = 90

  // Alcance + recursos
  escribir(ws, 'A5', 'ALCANCE PROGRAMA', { combinar: 'A5:A7', etiqueta: true })
  escribir(ws, 'B5', programa.alcance, { combinar: 'B5:F7' })
  escribir(ws, 'G5', 'RECURSOS', { combinar: `G5:${fin}5`, etiqueta: true })
  escribir(ws, 'G6', 'Talento Humano', { combinar: 'G6:H6', etiqueta: true })
  escribir(ws, 'I6', 'Financiero', { combinar: 'I6:K6', etiqueta: true })
  escribir(ws, 'L6', 'Tecnológico', { combinar: `L6:${fin}6`, etiqueta: true })
  escribir(ws, 'G7', programa.recurso_humano, { combinar: 'G7:H7' })
  escribir(ws, 'I7', programa.recurso_financiero, { combinar: 'I7:K7' })
  escribir(ws, 'L7', programa.recurso_tecnologico, { combinar: `L7:${fin}7` })
  ws.getRow(6).height = 18
  ws.getRow(7).height = 60

  // Criterios: un solo campo que se reparte en las dos celdas del formato.
  const [criteriosIzq, criteriosDer] = partirEnDos(programa.criterios)
  escribir(ws, 'A8', 'CRITERIOS', { etiqueta: true })
  escribir(ws, 'B8', criteriosIzq, { combinar: 'B8:D8' })
  escribir(ws, 'E8', criteriosDer, { combinar: `E8:${fin}8` })
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
    escribir(ws, `L${f}`, oportunidades[i] ?? '', { combinar: `L${f}:${fin}${f}` })
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
    escribir(ws, `A${fila}`, 'CRONOGRAMA', { combinar: `A${fila}:${fin}${fila}`, etiqueta: true })
    fila++

    // Encabezado a dos alturas, como el formato: las cinco columnas de datos
    // ocupan las dos filas, y bajo el rótulo de cada mes se abre su cuadrícula
    // de semanas.
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

    if (columnasDeSemana.length) {
      // Un rótulo por mes sobre sus cuatro semanas. Con un mes solo se conserva
      // el texto del formato original; con varios, cada bloque lleva su nombre,
      // porque el «MES DE AUDITORIA:» delante de cada uno no cabría.
      meses.forEach((mes, i) => {
        const delMes = columnasDeSemana.slice(i * SEMANAS_POR_MES, (i + 1) * SEMANAS_POR_MES)
        if (!delMes.length) return

        const rotulo = meses.length === 1 ? `MES DE AUDITORIA: ${mes}` : mes
        escribir(ws, `${delMes[0].desde}${alto}`, rotulo, {
          combinar: `${delMes[0].desde}${alto}:${delMes[delMes.length - 1].hasta}${alto}`,
          etiqueta: true,
        })
      })

      columnasDeSemana.forEach(({ desde, hasta, numero }) => {
        escribir(ws, `${desde}${bajo}`, `Semana ${numero}`, {
          combinar: `${desde}${bajo}:${hasta}${bajo}`,
          etiqueta: true,
        })
      })
    } else {
      // Un programa sin meses: el bloque se deja rotulado y vacío, en vez de un
      // hueco sin bordes al final de cada fila.
      escribir(ws, `G${alto}`, 'MES DE AUDITORIA', {
        combinar: `G${alto}:${fin}${bajo}`,
        etiqueta: true,
      })
    }

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
      columnasDeSemana.forEach(({ desde, hasta, id }) => {
        escribir(ws, `${desde}${primeraFila}`, marcadas.has(id) ? 'X' : '', {
          combinar: `${desde}${primeraFila}:${hasta}${ultimaFila}`,
          centrar: 'center',
        })
      })

      for (const dep of dependencias) {
        escribir(ws, `C${fila}`, dep.auditado)
        escribir(ws, `D${fila}`, celdaAuditores(dep))

        // La celda crece con cada acompañante; con el alto fijo, del segundo
        // renglón en adelante se quedaba cortado.
        const renglones = celdaAuditores(dep).split('\n').length
        ws.getRow(fila).height = renglones > 1 ? 16 + 14 * renglones : 30
        fila++
      }
    }
  }

  // Pie
  escribir(ws, `A${fila}`, 'NOMENCLATURA', { combinar: `A${fila}:B${fila}`, etiqueta: true })
  escribir(ws, `C${fila}`, programa.nomenclatura, { combinar: `C${fila}:${fin}${fila}` })
  fila++

  escribir(ws, `A${fila}`, 'OBSERVACIONES', { combinar: `A${fila}:B${fila}`, etiqueta: true })
  escribir(ws, `C${fila}`, programa.observaciones, { combinar: `C${fila}:${fin}${fila}` })
  ws.getRow(fila).height = 40
  fila++

  escribir(ws, `A${fila}`, 'ELABORACIÓN', { combinar: `A${fila}:D${fila}`, etiqueta: true })
  escribir(ws, `E${fila}`, 'REVISIÓN', { combinar: `E${fila}:G${fila}`, etiqueta: true })
  escribir(ws, `H${fila}`, 'APROBACIÓN', { combinar: `H${fila}:${fin}${fila}`, etiqueta: true })
  fila++

  // Espacio de firmas: una fila vacía entre el rótulo y el nombre del
  // responsable, para firmar encima del nombre como en el formato impreso.
  escribir(ws, `A${fila}`, '', { combinar: `A${fila}:D${fila}` })
  escribir(ws, `E${fila}`, '', { combinar: `E${fila}:G${fila}` })
  escribir(ws, `H${fila}`, '', { combinar: `H${fila}:${fin}${fila}` })
  ws.getRow(fila).height = ALTO_FIRMAS
  fila++

  escribir(ws, `A${fila}`, 'Funcionarios Responsables:', { combinar: `A${fila}:B${fila}` })
  escribir(ws, `C${fila}`, programa.elaborado_por, { combinar: `C${fila}:D${fila}` })
  escribir(ws, `E${fila}`, programa.revisado_por, { combinar: `E${fila}:G${fila}` })
  escribir(ws, `H${fila}`, programa.aprobado_por, { combinar: `H${fila}:${fin}${fila}` })
  fila++

  // Solo elaboración lleva el rótulo «Cargo:». Revisión y aprobación imprimen
  // lo que se haya escrito, tal cual, o nada.
  escribir(ws, `A${fila}`, `Cargo: ${programa.elaborado_cargo || ''}`, {
    combinar: `A${fila}:D${fila}`,
  })
  escribir(ws, `E${fila}`, programa.revisado_cargo, { combinar: `E${fila}:G${fila}` })
  escribir(ws, `H${fila}`, programa.aprobado_cargo, { combinar: `H${fila}:${fin}${fila}` })
  fila++

  escribir(ws, `A${fila}`, '', { combinar: `A${fila}:D${fila}` })
  escribir(ws, `E${fila}`, '', { combinar: `E${fila}:G${fila}` })
  escribir(ws, `H${fila}`, `FECHA: ${programa.fecha_aprobacion || ''}`, {
    combinar: `H${fila}:${fin}${fila}`,
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
 * Separado de la descarga para poder comprobarlo fuera del navegador; el
 * escudo entra como parámetro por lo mismo, para no depender de `fetch`.
 *
 * @param {Object} programa Cabecera con `cronograma` y `distribucion`
 * @param {ArrayBuffer|null} [logo] Escudo institucional ya descargado
 */
export function construirLibroPrograma(programa, logo = null) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Sistema CGCAI'
  wb.created = new Date()

  hojaPrograma(wb, programa, logo)

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
    const libro = construirLibroPrograma(programa, await cargarLogo())
    const buffer = await libro.xlsx.writeBuffer()
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
