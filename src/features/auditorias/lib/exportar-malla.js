/**
 * La malla de Inicio, en Excel.
 *
 * Dos hojas, porque son dos preguntas distintas y mezclarlas no sirve a
 * ninguna:
 *
 *  - «Avance por dependencia» responde cómo va cada dependencia: un porcentaje
 *    por documento, que es lo que se ve en la pantalla.
 *  - «Detalle por auditoría» responde cuándo: una fila por auditoría con la
 *    fecha de entrega y la fecha límite de cada documento. Los promedios de la
 *    primera hoja no tienen fecha que mostrar —resumen varias auditorías—, así
 *    que las fechas viven aquí.
 *
 * Los porcentajes van como número (0-100) y las fechas como texto
 * «YYYY-MM-DD» a propósito: ordenan bien, se filtran bien y no dependen de la
 * configuración regional de quien abra el archivo.
 */
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import { toast } from 'react-toastify'

import { aDia, hoy } from '@/lib/fechas'

/**
 * Un día «YYYY-MM-DD» de lo que trae la malla, sin moverlo de sitio.
 *
 * Llegan dos cosas distintas y hay que tratarlas distinto. Los plazos son
 * `Date` a **medianoche local**: los construye `addBusinessDays` leyendo y
 * escribiendo campos locales, y pasarlos por `aDia` los convertiría de huso y
 * los correría un día en cualquier reloj que no sea el de Bogotá —comprobado:
 * con `TZ=UTC`, el 17 de septiembre sale como 16—. De esos se leen sus propios
 * campos, que es la forma de no perder nada. Las fechas que vienen como texto
 * ISO sí pasan por `aDia`, que les saca el día de Bogotá.
 */
function diaDe(valor) {
  if (!valor) return ''

  if (valor instanceof Date) {
    if (Number.isNaN(valor.getTime())) return ''
    const mes = String(valor.getMonth() + 1).padStart(2, '0')
    const dia = String(valor.getDate()).padStart(2, '0')
    return `${valor.getFullYear()}-${mes}-${dia}`
  }

  return aDia(valor) ?? ''
}

const AZUL_TITULO = 'FF667EEA'
const AZUL_CABECERA = 'FF1E40AF'
const GRIS_BORDE = 'FFE2E8F0'

/** Fila de la cabecera, igual que en los demás exportables del sistema. */
const FILA_CABECERA = 4

const relleno = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } })

const borde = (argb) => ({
  top: { style: 'thin', color: { argb } },
  left: { style: 'thin', color: { argb } },
  bottom: { style: 'thin', color: { argb } },
  right: { style: 'thin', color: { argb } },
})

/**
 * Título, periodo y cabecera. **Antes de añadir una sola fila de datos.**
 *
 * El orden importa y no es evidente. Fijar `columns` ya escribe la cabecera en
 * la fila 1, así que `rowCount` vale 1; combinar las filas 1 y 2 lo deja en 2,
 * y a partir de ahí cada `addRow` cae en la 3, la 4… Si la cabecera se
 * escribiera al final sobre la fila 4, machacaría la segunda fila de datos y
 * la primera quedaría *encima* de la cabecera, fuera del filtro.
 *
 * Dejando escrita la cabecera en la fila 4 antes de los datos, `rowCount` vale
 * 4 y los `addRow` empiezan en la 5, que es donde se los espera.
 */
function prepararHoja(hoja, { titulo, periodo }) {
  const ultimaColumna = hoja.columns.length

  hoja.mergeCells(1, 1, 1, ultimaColumna)
  const celdaTitulo = hoja.getCell(1, 1)
  celdaTitulo.value = titulo
  celdaTitulo.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } }
  celdaTitulo.alignment = { horizontal: 'center', vertical: 'middle' }
  celdaTitulo.fill = relleno(AZUL_TITULO)
  hoja.getRow(1).height = 24

  hoja.mergeCells(2, 1, 2, ultimaColumna)
  const celdaPeriodo = hoja.getCell(2, 1)
  celdaPeriodo.value = periodo
  celdaPeriodo.font = { italic: true, color: { argb: 'FF475569' } }

  const cabecera = hoja.getRow(FILA_CABECERA)
  cabecera.values = hoja.columns.map((columna) => columna.header)
  cabecera.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  cabecera.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
  cabecera.fill = relleno(AZUL_CABECERA)
  cabecera.height = 34
  cabecera.eachCell((celda) => {
    celda.border = borde(AZUL_CABECERA)
  })
  cabecera.commit?.()
}

/** Bordes de los datos, filtro y panel fijo. Después de añadirlos. */
function cerrarHoja(hoja, { xSplit = 1 } = {}) {
  for (let n = FILA_CABECERA + 1; n <= hoja.rowCount; n++) {
    const fila = hoja.getRow(n)
    fila.alignment = { vertical: 'middle' }
    fila.eachCell((celda) => {
      celda.border = borde(GRIS_BORDE)
    })
  }

  hoja.autoFilter = {
    from: { row: FILA_CABECERA, column: 1 },
    to: { row: FILA_CABECERA, column: hoja.columnCount },
  }
  hoja.views = [{ state: 'frozen', ySplit: FILA_CABECERA, xSplit }]
}

async function descargar(libro, nombre) {
  const buffer = await libro.xlsx.writeBuffer()
  saveAs(
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    nombre
  )
}

/**
 * En qué estado está un documento de una auditoría concreta.
 *
 * Las mismas cuatro situaciones que distingue la pantalla, para que el Excel
 * no cuente otra historia: lo entregado puede estar a tiempo o fuera de plazo,
 * y lo que falta puede estar vencido o todavía en plazo.
 */
function estadoDe(etapa, diaDeHoy) {
  if (!etapa) return 'Sin datos'
  if (etapa.delivered) return etapa.late ? 'Fuera de plazo' : 'A tiempo'

  const limite = diaDe(etapa.due)
  if (limite && limite < diaDeHoy) return 'Vencido'
  return 'Pendiente'
}

/**
 * Descarga el Excel de la malla.
 *
 * @param {Object} args
 * @param {Array}  args.documentos  `DOCUMENTOS_MALLA` de la vista
 * @param {Array}  args.matriz      Filas agregadas por dependencia
 * @param {Array}  args.auditorias  Auditorías del filtro, con `_stages`
 * @param {string} args.anio        Año seleccionado, o '' para todos
 */
export async function exportarMallaControl({ documentos, matriz, auditorias, anio }) {
  if (!auditorias?.length) {
    toast.warning('No hay auditorías para exportar en este filtro.')
    return
  }

  const diaDeHoy = hoy()
  const periodo = anio ? `Año ${anio}` : 'Todos los años'
  const leyenda = `${periodo} · generado el ${diaDeHoy}`

  try {
    const libro = new ExcelJS.Workbook()
    libro.creator = 'CGCAI'
    libro.created = new Date()

    /* ---- Hoja 1: una fila por dependencia ---- */
    const avance = libro.addWorksheet('Avance por dependencia')

    avance.columns = [
      { header: 'Dependencia', key: 'dependencia', width: 38 },
      { header: 'Auditorías', key: 'auditorias', width: 12 },
      { header: 'Avance total %', key: 'avance', width: 14 },
      ...documentos.map((d) => ({ header: `${d.columna} %`, key: `pct_${d.key}`, width: 13 })),
    ]

    prepararHoja(avance, {
      titulo: 'Centro de Control de Auditorías · Avance por dependencia',
      periodo: leyenda,
    })

    for (const fila of matriz) {
      avance.addRow({
        dependencia: fila.depName,
        auditorias: fila.total,
        avance: Math.round(fila.completion * 100),
        ...Object.fromEntries(
          documentos.map((d) => {
            const ag = fila._agg?.[d.key]
            return [`pct_${d.key}`, ag?.total ? Math.round((ag.done / ag.total) * 100) : 0]
          })
        ),
      })
    }

    cerrarHoja(avance)

    /* ---- Hoja 2: una fila por auditoría, con las fechas ---- */
    const detalle = libro.addWorksheet('Detalle por auditoría')

    detalle.columns = [
      { header: 'Auditoría', key: 'id', width: 11 },
      { header: 'Dependencia', key: 'dependencia', width: 38 },
      { header: 'Auditor', key: 'auditor', width: 26 },
      { header: 'Fecha auditoría', key: 'fecha', width: 15 },
      { header: 'Ejecutada', key: 'ejecutada', width: 11 },
      { header: 'Fecha de ejecución', key: 'ejecutadaAt', width: 17 },
      ...documentos.flatMap((d) => [
        { header: `${d.columna} · estado`, key: `est_${d.key}`, width: 15 },
        { header: `${d.columna} · entrega`, key: `ent_${d.key}`, width: 14 },
        { header: `${d.columna} · límite`, key: `lim_${d.key}`, width: 14 },
      ]),
    ]

    prepararHoja(detalle, {
      titulo: 'Centro de Control de Auditorías · Detalle por auditoría',
      periodo: leyenda,
    })

    for (const a of auditorias) {
      detalle.addRow({
        id: a.id,
        dependencia: a.dependencias?.nombre || 'Sin dependencia',
        auditor:
          [a.usuarios?.nombre, a.usuarios?.apellido].filter(Boolean).join(' ') || 'Sin asignar',
        fecha: diaDe(a.fecha_auditoria),
        ejecutada: a.ejecutada ? 'Sí' : 'No',
        ejecutadaAt: diaDe(a.ejecutada_at),
        ...Object.fromEntries(
          documentos.flatMap((d) => {
            const etapa = a._stages?.[d.key]
            return [
              [`est_${d.key}`, estadoDe(etapa, diaDeHoy)],
              [`ent_${d.key}`, diaDe(etapa?.deliveredAt)],
              [`lim_${d.key}`, diaDe(etapa?.due)],
            ]
          })
        ),
      })
    }

    // Se congelan las cuatro primeras columnas: sin eso, al desplazarse a la
    // derecha se pierde de vista de qué auditoría es cada fila.
    cerrarHoja(detalle, { xSplit: 4 })

    await descargar(libro, `centro_control_auditorias_${anio || 'todos'}.xlsx`)
    toast.success('Malla exportada en Excel.')
  } catch (err) {
    console.error('Error exportando la malla de control:', err)
    toast.error('No se pudo exportar la malla.')
  }
}
