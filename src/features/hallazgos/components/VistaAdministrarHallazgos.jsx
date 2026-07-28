'use client'

import { useEffect, useMemo, useState } from 'react'

import { saveAs } from 'file-saver'
import ExcelJS from 'exceljs'
import { supabase } from '@/lib/supabase/client'

import { Dialog } from '@headlessui/react'
import { Download, FilterX } from 'lucide-react'
import { toast } from 'react-toastify'
import { listarHallazgos } from '@/features/hallazgos/api/hallazgos-api'
import { useAnioInicial } from '@/hooks/useAnioInicial'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/components/ui/stat-card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DataTablePagination } from '@/components/ui/data-table-pagination'
import { usePagination } from '@/components/ui/use-pagination'
import {
  PAGE_SHELL,
  SECTION_CARD,
  STATUS_BADGE_TONES,
  TABLE_CONTAINER,
  TABLE_TOOLBAR,
} from '@/components/ui/tokens'
import { cn } from '@/lib/utils'

/**
 * Valor centinela de los selects de filtro: el estado usa `''` para "sin
 * filtrar", pero el primitivo Select no admite valores vacíos.
 */
const TODOS = '__todos__'

/** Tono del badge según el tipo de hallazgo. */
const TONO_TIPO = (tipo = '') => {
  const t = tipo.toLowerCase()
  if (t.includes('fortaleza')) return 'success'
  if (t.includes('mejora')) return 'warning'
  if (t.includes('conformidad')) return 'danger'
  return 'neutral'
}

const CAPITULO_TITULOS = {
  1: 'NO APLICA',
  2: 'NO APLICA',
  3: 'NO APLICA',
  4: 'FACTOR 1, FACTOR 2, FACTOR 3, FACTOR 4 Y FACTOR 7',
  5: 'FACTOR 12',
  6: 'FACTOR 2',
  7: 'FACTOR 3, FACTOR 10, FACTOR 11',
  8: 'FACTOR 2, FACTOR 3, FACTOR 4, FACTOR 5, FACTOR 6, FACTOR 7, FACTOR 8, FACTOR 8 Y FACTOR 11',
  9: 'FACTOR 2, FACTOR 3, FACTOR 5, FACTOR 7, FACTOR 12, FACTOR 8 Y FACTOR 11',
  10: 'FACTOR 9 Y FACTOR 12',
  11: 'NO APLICA',
  12: 'NO APLICA',
}

const formatCapitulo = (cap) => {
  if (cap == null) return ''
  const n = parseInt(String(cap).match(/\d+/)?.[0] ?? Number.NaN, 10)
  if (!Number.isNaN(n) && CAPITULO_TITULOS[n]) {
    return `${n}: ${CAPITULO_TITULOS[n]}`
  }
  return String(cap)
}

const fmtDate = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('es-CO')
}

/* ===================== Utils base ===================== */
const getInforme = (row) =>
  Array.isArray(row?.informes_auditoria) ? row.informes_auditoria[0] : row?.informes_auditoria

const norm = (s) =>
  (s ?? '')
    .toString()
    .replace(/\u00A0/g, ' ')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

const joinName = (u) => `${u?.nombre || ''} ${u?.apellido || ''}`.trim()

const makeKey = (id, label) => {
  if (id !== undefined && id !== null && String(id) !== '') return `id:${String(id)}`
  return `lbl:${norm(label)}`
}

/* ===================== Getters de campos ===================== */
const getYear = (row) => {
  const inf = getInforme(row)
  const f = inf?.fecha_auditoria ? new Date(inf.fecha_auditoria) : null
  return f ? f.getFullYear() : null
}

const getSemester = (row) => {
  const inf = getInforme(row)
  const f = inf?.fecha_auditoria ? new Date(inf.fecha_auditoria) : null
  if (!f) return null
  const month = f.getMonth() + 1
  return month <= 6 ? '1' : '2'
}

/* ===== Auditores ===== */
const getAuditorLabel = (row) => {
  const u = getInforme(row)?.usuarios
  return joinName(u)
}
const getAuditorKey = (row) => {
  const u = getInforme(row)?.usuarios || {}
  const id = u.usuario_id ?? u.id ?? u.uuid ?? u.user_id
  return makeKey(id, joinName(u))
}

/* ===== Dependencias ===== */
const getDependenciaLabel = (row) => {
  const d = getInforme(row)?.dependencias
  return d?.nombre || ''
}
const getDependenciaKey = (row) => {
  const d = getInforme(row)?.dependencias || {}
  const id = d.dependencia_id ?? d.id ?? d.uuid ?? d.dep_id
  return makeKey(id, d?.nombre || '')
}

/* ===== ISO ===== */
const getISOLabel = (row) => row?.iso?.iso ?? ''
const getISOKey = (row) => {
  const id = row?.iso_id ?? row?.iso?.id ?? row?.iso?.iso_id
  return makeKey(id, getISOLabel(row))
}

/* ===== Capítulo ===== */
const getCapituloLabel = (row) => row?.capitulos?.capitulo ?? ''
const getCapituloKey = (row) => {
  const id = row?.capitulo_id ?? row?.capitulos?.id ?? row?.capitulos?.capitulo_id
  return makeKey(id, getCapituloLabel(row))
}

/* ===== Numeral ===== */
const getNumeralLabel = (row) => row?.numerales?.numeral ?? ''
const getNumeralKey = (row) => {
  const id = row?.numeral_id ?? row?.numerales?.id ?? row?.numerales?.numeral_id
  return makeKey(id, getNumeralLabel(row))
}

/* ===================== Tipo (fallback por tabla) ===================== */
function inferirTipoDesdeTabla(hallazgo) {
  if (hallazgo?.tipo) return hallazgo.tipo
  if (hallazgo?.hasOwnProperty('fortaleza_id')) return 'Fortalezas'
  if (hallazgo?.hasOwnProperty('oportunidad_mejora_id')) return 'Oportunidades de Mejora'
  if (hallazgo?.hasOwnProperty('no_conformidad_id')) return 'No Conformidades'
  return 'N/A'
}

/* ===================== Exportar Excel ===================== */
export const exportarExcel = async (hallazgos) => {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('Hallazgos')

  // Definir encabezados
  worksheet.columns = [
    { header: 'Informe ID', key: 'informe_id', width: 12 },
    { header: 'Año', key: 'anio', width: 8 },
    { header: 'Semestre', key: 'semestre', width: 10 },
    { header: 'Auditor', key: 'auditor', width: 25 },
    { header: 'Dependencia', key: 'dependencia', width: 30 },
    { header: 'Tipo de Hallazgo', key: 'tipo', width: 22 },
    { header: 'ISO', key: 'iso', width: 12 },
    { header: 'Capítulo', key: 'capitulo', width: 15 },
    { header: 'Numeral', key: 'numeral', width: 12 },
    { header: 'Descripción', key: 'descripcion', width: 50 },
    { header: 'Para Qué', key: 'para_que', width: 50 },
    { header: 'Recomendaciones', key: 'recomendaciones', width: 50 },
    { header: 'Conclusiones', key: 'conclusiones', width: 50 }
  ]

  // Estilo para el encabezado
  worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF667eea' }
  }
  worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' }
  worksheet.getRow(1).height = 25

  // Agregar datos
  for (const hallazgo of hallazgos) {
    const informe = getInforme(hallazgo)
    const fecha = new Date(informe?.fecha_auditoria)
    const anio = fecha.getFullYear()
    const semestre = fecha.getMonth() < 6 ? '1' : '2'
    const auditor = getAuditorLabel(hallazgo)
    const dependencia = getDependenciaLabel(hallazgo)
    const tipo = hallazgo.tipo || inferirTipoDesdeTabla(hallazgo)
    const iso = getISOLabel(hallazgo)
    const capitulo = getCapituloLabel(hallazgo)
    const numeral = getNumeralLabel(hallazgo)
    const descripcion = hallazgo.descripcion || ''
    
    // Obtener el valor "Para Qué" según el tipo de hallazgo
    let paraQue = ''
    if (tipo === 'No Conformidad' || tipo === 'No Conformidades') {
      paraQue = hallazgo.evidencia || ''
    } else if (tipo === 'Oportunidad de Mejora' || tipo === 'Oportunidades de Mejora') {
      paraQue = hallazgo.para_que || ''
    } else if (tipo === 'Fortaleza' || tipo === 'Fortalezas') {
      paraQue = hallazgo.razon || ''
    }
    
    const recomendaciones = informe?.recomendaciones || ''
    const conclusiones = informe?.conclusiones || ''

    const row = worksheet.addRow({
      informe_id: hallazgo.informe_id ?? '',
      anio: anio || '',
      semestre: semestre || '',
      auditor,
      dependencia,
      tipo: tipo || '',
      iso,
      capitulo,
      numeral,
      descripcion,
      para_que: paraQue,
      recomendaciones,
      conclusiones
    })

    // Ajustar texto en celdas con contenido largo
    row.height = undefined // Auto altura
    row.alignment = { vertical: 'top', wrapText: true }
    
    // Aplicar bordes a todas las celdas de la fila
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
      }
    })
  }

  // Aplicar bordes al encabezado también
  worksheet.getRow(1).eachCell((cell) => {
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF667eea' } },
      left: { style: 'thin', color: { argb: 'FF667eea' } },
      bottom: { style: 'thin', color: { argb: 'FF667eea' } },
      right: { style: 'thin', color: { argb: 'FF667eea' } }
    }
  })

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  saveAs(blob, 'reporte_hallazgos.xlsx')
}

/* ===================== Componente ===================== */
export default function VistaHallazgosAdmin({ soloLectura = false }) {
  const [hallazgos, setHallazgos] = useState([])
  const [descargandoPM, setDescargandoPM] = useState(false)

  // Modal / carga Excel
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [archivoExcel, setArchivoExcel] = useState(null)
  const [progresoCarga, setProgresoCarga] = useState(0)
  const [estaCargando, setEstaCargando] = useState(false)
  const [cancelarCarga, setCancelarCarga] = useState(false)

  // Filtros
  const [busqueda, setBusqueda] = useState('')
  const [filtroDependencia, setFiltroDependencia] = useState('') // key estable
  const [filtroAuditor, setFiltroAuditor] = useState('')         // key estable
  const [filtroAnio, setFiltroAnio] = useState('')               // 2023, 2024...
  const [filtroSemestre, setFiltroSemestre] = useState('')       // '1' | '2'
  const [filtroTipo, setFiltroTipo] = useState('')               // texto
  const [filtroISO, setFiltroISO] = useState('')                 // key estable
  const [filtroCapitulo, setFiltroCapitulo] = useState('')       // key estable
  const [filtroNumeral, setFiltroNumeral] = useState('')         // key estable
  const [filtroGestion, setFiltroGestion] = useState('')         // área/gestión

  const fetchHallazgos = async () => {
    try {
      setHallazgos(await listarHallazgos())
    } catch (error) {
      console.error('[hallazgos] no se pudieron cargar:', error)
      toast.error(error.message)
    }
  }

  useEffect(() => {
    fetchHallazgos()
  }, [])

  /* =========== Opciones para selects, usando keys estables =========== */
const {
  opcionesAnios,
  opcionesAuditores,
  opcionesDependencias,
  opcionesTipos,
  opcionesISO,
  opcionesCapitulos,
  opcionesNumerales,
  opcionesGestiones,
} = useMemo(() => {
  const toLabel = (x) => String(x ?? '').trim(); // <- fuerza a string
  const sortByLabel = (a, b) =>
    toLabel(a.label).localeCompare(toLabel(b.label), undefined, { numeric: true, sensitivity: 'base' });

  const anios = new Set();
  const auditores = new Map();     // key -> label (string)
  const dependencias = new Map();  // key -> label (string)
  const tipos = new Set();         // strings
  const isos = new Map();          // key -> label (string)
  const capitulos = new Map();     // key -> label (string)
  const numerales = new Map();     // key -> label (string)
  const gestiones = new Set();     // áreas/gestiones

  for (const row of hallazgos) {
    const y = getYear(row);
    if (y) anios.add(y);

    // Auditor
    const ak = getAuditorKey(row);
    const al = toLabel(getAuditorLabel(row));
    if (ak && al) auditores.set(ak, al);

    // Dependencia
    const dk = getDependenciaKey(row);
    const dl = toLabel(getDependenciaLabel(row));
    if (dk && dl) dependencias.set(dk, dl);

    // Gestión (área)
    const inf = getInforme(row);
    const gestion = toLabel(inf?.dependencias?.gestion || '');
    if (gestion) gestiones.add(gestion);

    // Tipo
    const tipo = toLabel(row?.tipo || inferirTipoDesdeTabla(row));
    if (tipo) tipos.add(tipo);

    // ISO / Capítulo / Numeral
    const ik = getISOKey(row);
    const il = toLabel(getISOLabel(row));
    if (ik && il) isos.set(ik, il);

    const ck = getCapituloKey(row);
    const cl = toLabel(getCapituloLabel(row));
    if (ck && cl) capitulos.set(ck, cl);

    const nk = getNumeralKey(row);
    const nl = toLabel(getNumeralLabel(row));
    if (nk && nl) numerales.set(nk, nl);
  }

  return {
    opcionesAnios: Array.from(anios).sort((a, b) => a - b),
    opcionesAuditores: Array.from(auditores, ([value, label]) => ({ value, label: toLabel(label) }))
      .sort(sortByLabel),
    opcionesDependencias: Array.from(dependencias, ([value, label]) => ({ value, label: toLabel(label) }))
      .sort(sortByLabel),
    opcionesTipos: Array.from(tipos, (t) => toLabel(t))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })),
    opcionesISO: Array.from(isos, ([value, label]) => ({ value, label: toLabel(label) }))
      .sort(sortByLabel),
    opcionesCapitulos: Array.from(capitulos, ([value, label]) => ({ value, label: toLabel(label) }))
      .sort(sortByLabel),
    opcionesNumerales: Array.from(numerales, ([value, label]) => ({ value, label: toLabel(label) }))
      .sort(sortByLabel),
    opcionesGestiones: Array.from(gestiones)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
  };
}, [hallazgos]);

  // El filtro compara con `String(...)`, así que el año se guarda como texto.
  useAnioInicial(opcionesAnios, (anio) => setFiltroAnio(String(anio)), { sinDatos: '' })

  /* ===================== Aplicación de filtros ===================== */
  const filtrados = useMemo(() => {
    const q = norm(busqueda)
    return hallazgos.filter((row) => {
      if (filtroAnio && String(getYear(row)) !== String(filtroAnio)) return false
      if (filtroSemestre && String(getSemester(row)) !== String(filtroSemestre)) return false

      if (filtroAuditor && getAuditorKey(row) !== filtroAuditor) return false
      if (filtroDependencia && getDependenciaKey(row) !== filtroDependencia) return false

      // Filtro de gestión/área
      if (filtroGestion) {
        const inf = getInforme(row)
        const gestion = norm(inf?.dependencias?.gestion || '')
        if (gestion !== norm(filtroGestion)) return false
      }

      const tipo = row?.tipo || inferirTipoDesdeTabla(row)
      if (filtroTipo && String(tipo) !== String(filtroTipo)) return false

      if (filtroISO && getISOKey(row) !== filtroISO) return false
      if (filtroCapitulo && getCapituloKey(row) !== filtroCapitulo) return false
      if (filtroNumeral && getNumeralKey(row) !== filtroNumeral) return false

      if (q) {
        const auditor = norm(getAuditorLabel(row))
        const dep = norm(getDependenciaLabel(row))
        const desc = norm(row?.descripcion ?? '')
        const t = norm(tipo ?? '')
        const iso = norm(getISOLabel(row))
        const cap = norm(getCapituloLabel(row))
        const num = norm(getNumeralLabel(row))
        const informeId = norm(row?.informe_id != null ? String(row.informe_id) : '')

        const match =
          auditor.includes(q) ||
          dep.includes(q) ||
          desc.includes(q) ||
          t.includes(q) ||
          iso.includes(q) ||
          cap.includes(q) ||
          num.includes(q) ||
          informeId.includes(q)

        if (!match) return false
      }

      return true
    })
  }, [
    hallazgos,
    busqueda,
    filtroAnio,
    filtroSemestre,
    filtroAuditor,
    filtroDependencia,
    filtroGestion,
    filtroTipo,
    filtroISO,
    filtroCapitulo,
    filtroNumeral
  ])

  const limpiarFiltros = () => {
    setBusqueda('')
    setFiltroDependencia('')
    setFiltroAuditor('')
    setFiltroAnio('')
    setFiltroSemestre('')
    setFiltroGestion('')
    setFiltroTipo('')
    setFiltroISO('')
    setFiltroCapitulo('')
    setFiltroNumeral('')
  }

  /* ===================== Handler de carga Excel (tu lógica) ===================== */
  const handleUploadExcel = async (e) => {
    setEstaCargando(true)
    setProgresoCarga(0)
    setCancelarCarga(false)

    const cellToString = (v) => {
      if (v == null) return ''
      if (typeof v === 'object') {
        if ('text' in v && v.text) return String(v.text)
        if ('result' in v && v.result != null) return String(v.result)
        if ('richText' in v && Array.isArray(v.richText)) return v.richText.map(t => t.text ?? '').join('')
        if ('hyperlink' in v && v.hyperlink) return String(v.hyperlink)
        if ('formula' in v && v.formula) return String(v.result ?? '')
      }
      return String(v)
    }
    const read = (row, idx) => cellToString(row?.[idx])

    try {
      const file = e.target.files[0]
      if (!file) return

      const workbook = new ExcelJS.Workbook()
      await workbook.xlsx.load(await file.arrayBuffer())
      const worksheet = workbook.getWorksheet('Hallazgos') || workbook.worksheets[0]

      const all = worksheet.getSheetValues()
      if (!all || all.length < 2) {
        toast.error('La hoja está vacía o no se pudo leer.')
        return
      }

      // Detecta encabezado flexible
      let headerRowIdx = 1
      for (let i = 1; i < Math.min(all.length, 6); i++) {
        const r = all[i]
        if (!Array.isArray(r)) continue
        const joined = norm(r.map(cellToString).join(' | '))
        if (
          joined.includes('informe id') &&
          (joined.includes('año') || joined.includes('ano')) &&
          joined.includes('dependencia') &&
          (joined.includes('tipo de hallazgo') || joined.includes('tipo')) &&
          joined.includes('descripcion')
        ) {
          headerRowIdx = i
          break
        }
      }

      const headerRaw = (all[headerRowIdx] || []).map(cellToString)
      const findCol = (...aliases) => {
        const idx = headerRaw.findIndex(h => {
          const H = norm(h)
          return aliases.some(a => H === a || H.includes(a))
        })
        return idx >= 0 ? idx : null
      }

      const cAno         = findCol('año', 'ano')
      const cDependencia = findCol('dependencia')
      const cTipo        = findCol('tipo de hallazgo', 'tipo')
      const cISO         = findCol('iso')
      const cCapitulo    = findCol('capitulo', 'capítulo')
      const cNumeral     = findCol('numeral')
      const cDescripcion = findCol('descripcion', 'descripción')

      if (cAno == null || cDependencia == null || cTipo == null || cDescripcion == null) {
        toast.error('No se pudieron detectar correctamente las columnas clave (Año, Dependencia, Tipo, Descripción).')
        return
      }

      const rows = (all.slice(headerRowIdx + 1) || []).filter(Array.isArray)
      const filasValidas = rows.filter(r => {
        const anioRaw = read(r, cAno)
        const dep     = read(r, cDependencia)
        const tipo    = read(r, cTipo)
        const desc    = read(r, cDescripcion)
        return norm(anioRaw) && norm(dep) && norm(tipo) && norm(desc)
      })

      if (filasValidas.length === 0) {
        toast.error('No se encontraron filas válidas en el Excel (revisa Año, Dependencia, Tipo y Descripción).')
        return
      }

      let procesadas = 0
      const totalValidas = filasValidas.length

      for (const r of rows) {
        if (cancelarCarga) {
          toast('Carga cancelada por el usuario.')
          break
        }

        const anioRaw           = read(r, cAno)
        const dependenciaNombre = read(r, cDependencia)
        const tipo              = read(r, cTipo)
        const iso               = cISO != null ? read(r, cISO) : ''
        const capitulo          = cCapitulo != null ? read(r, cCapitulo) : ''
        const numeral           = cNumeral != null ? read(r, cNumeral) : ''
        const descripcion       = read(r, cDescripcion)

        if (!norm(anioRaw) || !norm(dependenciaNombre) || !norm(tipo) || !norm(descripcion)) continue

        const anio = parseInt(norm(anioRaw), 10)
        if (!Number.isFinite(anio)) continue

        const depNombre = (dependenciaNombre ?? '').toString().trim()
        const tipoStr   = (tipo ?? '').toString().trim()
        const isoStr    = (iso ?? '').toString().trim()
        const capStr    = (capitulo ?? '').toString().trim()
        const numStr    = (numeral ?? '').toString().trim()
        const descStr   = (descripcion ?? '').toString().trim()

        const { data: depData } = await supabase
          .from('dependencias')
          .select('dependencia_id')
          .ilike('nombre', depNombre)
          .limit(1)
          .maybeSingle()
        if (!depData) continue

        const { data: existingInforme } = await supabase
          .from('informes_auditoria')
          .select('id')
          .eq('dependencia_id', depData.dependencia_id)
          .gte('fecha_auditoria', `${anio}-01-01`)
          .lte('fecha_auditoria', `${anio}-12-31`)
          .limit(1)
          .maybeSingle()

        let informeIdUsar = existingInforme?.id
        if (!informeIdUsar) {
          const { data: nuevoInforme } = await supabase
            .from('informes_auditoria')
            .insert({
              fecha_auditoria: `${anio}-07-01`,
              fecha_seguimiento: `${anio}-07-01`,
              usuario_id: 1,
              dependencia_id: depData.dependencia_id,
              asistencia_tipo: 'Digital',
              auditores_acompanantes: ['N/A'],
              objetivo: 'Registro automático de hallazgos históricos',
              criterios: 'Importación Excel',
              conclusiones: 'N/A',
              recomendaciones: 'N/A'
            })
            .select('id')
            .single()
          if (!nuevoInforme) continue
          informeIdUsar = nuevoInforme.id
        }

        const { data: isoData } = await supabase
          .from('iso')
          .select('id')
          .eq('iso', isoStr)
          .limit(1)
          .maybeSingle()
        if (!isoData) continue

        const { data: capData } = await supabase
          .from('capitulos')
          .select('id')
          .eq('capitulo', capStr)
          .eq('iso_id', isoData.id)
          .limit(1)
          .maybeSingle()
        if (!capData) continue

        const { data: numData } = await supabase
          .from('numerales')
          .select('id')
          .eq('numeral', numStr)
          .eq('capitulo_id', capData.id)
          .limit(1)
          .maybeSingle()
        if (!numData) continue

        let tableName = 'no_conformidades'
        if (tipoStr.toLowerCase().includes('fortaleza')) tableName = 'fortalezas'
        else if (tipoStr.toLowerCase().includes('mejora')) tableName = 'oportunidades_mejora'

        const { error: insertErr } = await supabase.from(tableName).insert({
          informe_id: informeIdUsar,
          descripcion: descStr,
          iso_id: isoData.id,
          capitulo_id: capData.id,
          numeral_id: numData.id
        })
        if (insertErr) continue

        procesadas++
        setProgresoCarga(Math.round((procesadas / totalValidas) * 100))
        await new Promise(res => setTimeout(res, 10))
      }

      await fetchHallazgos()
      setProgresoCarga(100)
      if (!cancelarCarga) {
        toast.success(`Importación completada: ${procesadas} de ${totalValidas} filas insertadas.`)
      }

    } catch (err) {
      console.error('Error general en importación:', err)
      toast.error('Ocurrió un error leyendo el Excel o durante la importación. Revisa la consola.')
    } finally {
      setEstaCargando(false)
      setArchivoExcel(null)
      setIsModalOpen(false)
    }
  }

  /* ===================== KPIs ===================== */
  // El desglose va sobre `filtrados`: las tarjetas resumen lo que se está
  // viendo. `registrados` queda aparte como referencia de cuánto hay en total.
  const stats = useMemo(() => {
    const tipoDe = (h) => h.tipo || inferirTipoDesdeTabla(h)
    return {
      total: filtrados.length,
      fortalezas: filtrados.filter(h => tipoDe(h) === 'Fortalezas').length,
      oportunidades: filtrados.filter(h => tipoDe(h) === 'Oportunidades de Mejora').length,
      noConformidades: filtrados.filter(h => tipoDe(h) === 'No Conformidades').length,
      registrados: hallazgos.length,
    }
  }, [hallazgos, filtrados])

  /* ===================== Columnas ===================== */
  const paginacion = usePagination(filtrados, 25)

  const descargarPMGeneral = async () => {
    try {
      setDescargandoPM(true)

      const [informesRes, omRes, ncRes] = await Promise.all([
        supabase
          .from('informes_auditoria')
          .select(`
            id,
            fecha_auditoria,
            usuarios:usuario_id ( nombre, apellido ),
            dependencias:dependencia_id ( nombre )
          `)
          .order('fecha_auditoria', { ascending: true }),
        supabase
          .from('oportunidades_mejora')
          .select('informe_id, descripcion, capitulo:capitulo_id ( capitulo ), numeral:numeral_id ( numeral )')
          .order('informe_id', { ascending: true }),
        supabase
          .from('no_conformidades')
          .select('informe_id, descripcion, capitulo:capitulo_id ( capitulo ), numeral:numeral_id ( numeral )')
          .order('informe_id', { ascending: true }),
      ])

      if (informesRes.error) throw informesRes.error
      if (omRes.error) throw omRes.error
      if (ncRes.error) throw ncRes.error

      const informes = Array.isArray(informesRes.data) ? informesRes.data : []
      const oportunidades = Array.isArray(omRes.data) ? omRes.data : []
      const noConformidades = Array.isArray(ncRes.data) ? ncRes.data : []

      const omByInforme = oportunidades.reduce((acc, item) => {
        const key = String(item.informe_id)
        if (!acc[key]) acc[key] = []
        acc[key].push(item)
        return acc
      }, {})

      const ncByInforme = noConformidades.reduce((acc, item) => {
        const key = String(item.informe_id)
        if (!acc[key]) acc[key] = []
        acc[key].push(item)
        return acc
      }, {})

      const rows = []
      let pmNumero = 0

      for (const informe of informes) {
        const informeId = String(informe.id)
        const om = omByInforme[informeId] || []
        const nc = ncByInforme[informeId] || []

        if (!om.length && !nc.length) continue

        pmNumero += 1
        const auditor = `${informe.usuarios?.nombre || ''} ${informe.usuarios?.apellido || ''}`.trim() || 'Sin auditor'
        const dependencia = informe.dependencias?.nombre || 'Sin dependencia'
        const fechaAuditoria = informe.fecha_auditoria || null

        for (const item of om) {
          rows.push({
            pm_numero: pmNumero,
            auditor,
            fecha_auditoria: fechaAuditoria,
            dependencia,
            fuente: 'Auditoria interna',
            tipo: 'Oportunidad de Mejora',
            factor: formatCapitulo(item?.capitulo?.capitulo),
            numeral_iso: item?.numeral?.numeral || '',
            descripcion: item.descripcion || '',
          })
        }

        for (const item of nc) {
          rows.push({
            pm_numero: pmNumero,
            auditor,
            fecha_auditoria: fechaAuditoria,
            dependencia,
            fuente: 'Auditoria interna',
            tipo: 'No Conformidad',
            factor: formatCapitulo(item?.capitulo?.capitulo),
            numeral_iso: item?.numeral?.numeral || '',
            descripcion: item.descripcion || '',
          })
        }
      }

      if (!rows.length) {
        toast.info('No hay datos OM/NC para generar el PM general.')
        return
      }

      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Plan de mejora general')

      worksheet.columns = [
        { header: 'PM #', key: 'pm_numero', width: 10 },
        { header: 'Auditor', key: 'auditor', width: 28 },
        { header: 'Fecha auditoria', key: 'fecha_auditoria', width: 16 },
        { header: 'Dependencia', key: 'dependencia', width: 30 },
        { header: 'Fuente', key: 'fuente', width: 18 },
        { header: 'Tipo', key: 'tipo', width: 24 },
        { header: 'Factor', key: 'factor', width: 55 },
        { header: 'Numeral ISO', key: 'numeral_iso', width: 18 },
        { header: 'Descripcion', key: 'descripcion', width: 70 },
      ]

      worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF667EEA' },
      }
      worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' }
      worksheet.getRow(1).height = 24

      for (const row of rows) {
        const excelRow = worksheet.addRow({
          ...row,
          fecha_auditoria: fmtDate(row.fecha_auditoria),
        })
        excelRow.alignment = { vertical: 'top', wrapText: true }
        excelRow.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          }
        })
      }

      worksheet.getRow(1).eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF667EEA' } },
          left: { style: 'thin', color: { argb: 'FF667EEA' } },
          bottom: { style: 'thin', color: { argb: 'FF667EEA' } },
          right: { style: 'thin', color: { argb: 'FF667EEA' } },
        }
      })

      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const stamp = new Date().toISOString().slice(0, 10)
      saveAs(blob, `PlanMejora_General_${stamp}.xlsx`)
      toast.success('Plan de mejora general descargado.')
    } catch (error) {
      console.error('Error descargando PM general:', error)
      toast.error(error?.message || 'No se pudo descargar el PM general.')
    } finally {
      setDescargandoPM(false)
    }
  }

  /* ── filtros declarados como datos: eran 9 <select> casi idénticos ── */
  const filtros = [
    { id: 'dependencia', label: 'Dependencia', placeholder: 'Todas las dependencias', value: filtroDependencia, onChange: setFiltroDependencia, options: opcionesDependencias },
    { id: 'auditor', label: 'Auditor', placeholder: 'Todos los auditores', value: filtroAuditor, onChange: setFiltroAuditor, options: opcionesAuditores },
    { id: 'anio', label: 'Año', placeholder: 'Todos los años', value: filtroAnio, onChange: setFiltroAnio, options: opcionesAnios.map((a) => ({ value: String(a), label: String(a) })) },
    { id: 'semestre', label: 'Semestre', placeholder: 'Todos los semestres', value: filtroSemestre, onChange: setFiltroSemestre, options: [{ value: '1', label: '1' }, { value: '2', label: '2' }] },
    { id: 'tipo', label: 'Tipo', placeholder: 'Todos los tipos', value: filtroTipo, onChange: setFiltroTipo, options: opcionesTipos.map((t) => ({ value: t, label: t })) },
    { id: 'iso', label: 'ISO', placeholder: 'Todas las ISO', value: filtroISO, onChange: setFiltroISO, options: opcionesISO },
    { id: 'capitulo', label: 'Capítulo', placeholder: 'Todos los capítulos', value: filtroCapitulo, onChange: setFiltroCapitulo, options: opcionesCapitulos },
    { id: 'numeral', label: 'Numeral', placeholder: 'Todos los numerales', value: filtroNumeral, onChange: setFiltroNumeral, options: opcionesNumerales },
    { id: 'gestion', label: 'Área', placeholder: 'Todas las áreas', value: filtroGestion, onChange: setFiltroGestion, options: opcionesGestiones.map((g) => ({ value: g, label: g })) },
  ]

  const pct = (n) => (stats.total > 0 ? Math.round((n / stats.total) * 100) : 0)

  return (
    <div className={PAGE_SHELL}>
      <PageHeader
        icon="📊"
        title="Reporte de Hallazgos"
        subtitle="Análisis y seguimiento de hallazgos de auditoría"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => exportarExcel(filtrados)}
              disabled={estaCargando || descargandoPM}
              title="Descargar reporte en Excel"
              className="bg-white/15 text-white shadow-none backdrop-blur-sm hover:bg-white/25"
            >
              <Download />
              Exportar
            </Button>
            <Button
              onClick={descargarPMGeneral}
              disabled={estaCargando || descargandoPM}
              title="Descargar PM General"
              className="bg-white/15 text-white shadow-none backdrop-blur-sm hover:bg-white/25"
            >
              <Download />
              {descargandoPM ? 'Generando PM…' : 'Descargar PM General'}
            </Button>
          </div>
        }
      />

      {/* KPIs */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <StatCard icon="📊" tone="blue" label="Hallazgos filtrados" value={stats.total} />
        <StatCard
          icon="✅"
          tone="green"
          label="Fortalezas"
          value={`${stats.fortalezas} · ${pct(stats.fortalezas)}%`}
        />
        <StatCard
          icon="💡"
          tone="orange"
          label="Oportunidades"
          value={`${stats.oportunidades} · ${pct(stats.oportunidades)}%`}
        />
        <StatCard
          icon="⚠️"
          tone="pink"
          label="No conformidades"
          value={`${stats.noConformidades} · ${pct(stats.noConformidades)}%`}
        />
        <StatCard icon="🔍" tone="purple" label="Registrados en total" value={stats.registrados} />
      </section>

      {/* Filtros */}
      <section className={cn(SECTION_CARD, 'p-4')}>
        <header className="mb-4 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Filtros de búsqueda</h3>
          <Button variant="outline" size="sm" onClick={limpiarFiltros}>
            <FilterX />
            Limpiar filtros
          </Button>
        </header>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="h-busqueda" className="text-xs text-muted-foreground">
              Búsqueda
            </Label>
            <Input
              id="h-busqueda"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Texto o ID de informe"
            />
          </div>

          {filtros.map((f) => (
            <div key={f.id} className="flex flex-col gap-1.5">
              <Label htmlFor={`h-${f.id}`} className="text-xs text-muted-foreground">
                {f.label}
              </Label>
              <Select
                value={f.value || TODOS}
                onValueChange={(v) => f.onChange(v === TODOS ? '' : v)}
              >
                <SelectTrigger id={`h-${f.id}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS}>{f.placeholder}</SelectItem>
                  {f.options.map((o) => (
                    <SelectItem key={o.value} value={String(o.value)}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </section>

      {/* Tabla */}
      <section className={TABLE_CONTAINER}>
        <div className={TABLE_TOOLBAR}>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">Listado de hallazgos</h3>
            <Badge variant="secondary">{filtrados.length} registros</Badge>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-24">Informe</TableHead>
              <TableHead className="w-20">Año</TableHead>
              <TableHead className="w-24">Semestre</TableHead>
              <TableHead>Auditor</TableHead>
              <TableHead>Dependencia</TableHead>
              <TableHead className="w-48">Tipo</TableHead>
              <TableHead className="w-24">ISO</TableHead>
              <TableHead>Capítulo</TableHead>
              <TableHead className="w-28">Numeral</TableHead>
              <TableHead>Descripción</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {estaCargando && <TableEmpty colSpan={10}>Cargando hallazgos…</TableEmpty>}

            {!estaCargando && paginacion.total === 0 && (
              <TableEmpty colSpan={10}>No hay hallazgos para los filtros aplicados.</TableEmpty>
            )}

            {!estaCargando &&
              paginacion.pageItems.map((row) => {
                const tipo = row.tipo || inferirTipoDesdeTabla(row)

                return (
                  <TableRow key={row.key}>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {row.informe_id}
                    </TableCell>
                    <TableCell className="tabular-nums">{getYear(row) ?? 'N/A'}</TableCell>
                    <TableCell className="tabular-nums">{getSemester(row) ?? 'N/A'}</TableCell>
                    <TableCell className="font-medium">{getAuditorLabel(row)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {getDependenciaLabel(row)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn(STATUS_BADGE_TONES[TONO_TIPO(tipo)])}>
                        {tipo}
                      </Badge>
                    </TableCell>
                    <TableCell>{getISOLabel(row)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {getCapituloLabel(row)}
                    </TableCell>
                    <TableCell>{getNumeralLabel(row)}</TableCell>
                    <TableCell className="max-w-lg text-muted-foreground">
                      {row.descripcion}
                    </TableCell>
                  </TableRow>
                )
              })}
          </TableBody>
        </Table>

        <DataTablePagination pagination={paginacion} etiqueta="hallazgos" />
      </section>


      {/* ===================== Modal Carga Excel ===================== */}
      {/* `soloLectura` (que pasa el panel del visualizador) no estaba conectado:
          este modal importa hallazgos en masa e inserta en informes_auditoria,
          fortalezas, oportunidades_mejora y no_conformidades. Hoy su botón está
          comentado, así que no se podía abrir; se cierra igualmente por si vuelve. */}
      <Dialog
        open={isModalOpen && !soloLectura}
        onClose={() => setIsModalOpen(false)}
        className="relative z-50"
      >
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel
            className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md border"
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={async (e) => {
              e.preventDefault()
              setDragOver(false)
              const file = e.dataTransfer.files[0]
              if (file) await handleUploadExcel({ target: { files: [file] } })
              setIsModalOpen(false)
            }}
          >
            <Dialog.Title className="text-lg font-bold mb-4">Subir archivo Excel</Dialog.Title>
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}
            >
              <p className="text-gray-600">Arrastra y suelta tu archivo aquí</p>
              <p className="text-sm text-gray-400 mb-2">o</p>

              <input
                type="file"
                accept=".xlsx"
                onChange={(e) => setArchivoExcel(e.target.files[0])}
                className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
                disabled={estaCargando}
              />

              {archivoExcel && !estaCargando && (
                <div className="mt-4 flex gap-2 justify-center">
                  <button
                    onClick={() => {
                      setCancelarCarga(false)
                      handleUploadExcel({ target: { files: [archivoExcel] } })
                    }}
                    className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                  >
                    Confirmar Carga
                  </button>

                  <button
                    onClick={() => {
                      setArchivoExcel(null)
                      setIsModalOpen(false)
                    }}
                    className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>

            {estaCargando && (
              <>
                <div className="mt-4">
                  <div className="w-full bg-gray-200 rounded-full h-4">
                    <div
                      className="bg-blue-600 h-4 rounded-full transition-all duration-200"
                      style={{ width: `${progresoCarga}%` }}
                    />
                  </div>
                  <p className="text-sm text-center text-gray-600 mt-1">{progresoCarga}% completado</p>
                </div>

                <div className="mt-4 flex justify-center">
                  <button
                    onClick={() => setCancelarCarga(true)}
                    className="bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700"
                  >
                    Detener carga
                  </button>
                </div>
              </>
            )}
          </Dialog.Panel>
        </div>
      </Dialog>
    </div>
  )
}
