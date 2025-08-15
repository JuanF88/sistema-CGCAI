'use client'

import { useEffect, useMemo, useState } from 'react'
import DataTable from 'react-data-table-component'

import { saveAs } from 'file-saver'
import ExcelJS from 'exceljs'
import { supabase } from '@/lib/supabaseClient'

import { Dialog } from '@headlessui/react'
import { CloudUpload } from 'lucide-react'
import { toast } from 'react-toastify'

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

  worksheet.addRow([
    'Informe ID', 'Año', 'Semestre', 'Auditor', 'Dependencia',
    'Tipo de Hallazgo', 'ISO', 'Capítulo', 'Numeral', 'Descripción'
  ])

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

    worksheet.addRow([
      hallazgo.informe_id ?? '',
      anio || '',
      semestre || '',
      auditor,
      dependencia,
      tipo || '',
      iso,
      capitulo,
      numeral,
      descripcion
    ])
  }

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  saveAs(blob, 'reporte_hallazgos.xlsx')
}

/* ===================== Componente ===================== */
export default function VistaHallazgosAdmin() {
  const [hallazgos, setHallazgos] = useState([])

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

  const fetchHallazgos = async () => {
    const res = await fetch('/api/hallazgos')
    const data = await res.json()
    setHallazgos(data)
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
  };
}, [hallazgos]);


  /* ===================== Aplicación de filtros ===================== */
  const filtrados = useMemo(() => {
    const q = norm(busqueda)
    return hallazgos.filter((row) => {
      if (filtroAnio && String(getYear(row)) !== String(filtroAnio)) return false
      if (filtroSemestre && String(getSemester(row)) !== String(filtroSemestre)) return false

      if (filtroAuditor && getAuditorKey(row) !== filtroAuditor) return false
      if (filtroDependencia && getDependenciaKey(row) !== filtroDependencia) return false

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

  /* ===================== Columnas ===================== */
  const columnas = [
    { name: 'Informe ID', selector: row => row.informe_id, sortable: true },
    { name: 'Año', selector: row => getYear(row) ?? 'N/A', sortable: true },
    { name: 'Semestre', selector: row => getSemester(row) ?? 'N/A', sortable: true },
    { name: 'Auditor', sortable: true, cell: row => <span>{getAuditorLabel(row)}</span> },
    { name: 'Dependencia', sortable: true, cell: row => <span>{getDependenciaLabel(row)}</span> },
    { name: 'Tipo', selector: row => row.tipo || inferirTipoDesdeTabla(row), sortable: true },
    { name: 'ISO', selector: row => getISOLabel(row), sortable: true },
    { name: 'Capítulo', selector: row => getCapituloLabel(row), sortable: true },
    { name: 'Numeral', selector: row => getNumeralLabel(row), sortable: true },
    { name: 'Descripción', selector: row => row.descripcion, wrap: true },
  ]

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-700">Reporte de Hallazgos</h2>

      {/* ========================== Filtros (fila 1) ========================== */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-2">
        {/* Búsqueda */}
        <input
          type="text"
          placeholder="Buscar por texto o ID de informe"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="border p-2 rounded w-full"
        />

        {/* Dependencia */}
        <select
          value={filtroDependencia}
          onChange={(e) => setFiltroDependencia(e.target.value)}
          className="border p-2 rounded w-full"
        >
          <option value="">Todas las dependencias</option>
          {opcionesDependencias.map((d) => (
            <option key={d.value} value={d.value}>{d.label}</option>
          ))}
        </select>

        {/* Auditor */}
        <select
          value={filtroAuditor}
          onChange={(e) => setFiltroAuditor(e.target.value)}
          className="border p-2 rounded w-full"
        >
          <option value="">Todos los auditores</option>
          {opcionesAuditores.map((a) => (
            <option key={a.value} value={a.value}>{a.label}</option>
          ))}
        </select>

        {/* Año */}
        <select
          value={filtroAnio}
          onChange={(e) => setFiltroAnio(e.target.value)}
          className="border p-2 rounded w-full"
        >
          <option value="">Todos los años</option>
          {opcionesAnios.map((anio) => (
            <option key={anio} value={anio}>{anio}</option>
          ))}
        </select>

        {/* Semestre */}
        <select
          value={filtroSemestre}
          onChange={(e) => setFiltroSemestre(e.target.value)}
          className="border p-2 rounded w-full"
        >
          <option value="">Todos los semestres</option>
          <option value="1">1</option>
          <option value="2">2</option>
        </select>
      </div>

      {/* ========================== Filtros (fila 2) ========================== */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        {/* Tipo */}
        <select
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value)}
          className="border p-2 rounded w-full"
        >
          <option value="">Todos los tipos</option>
          {opcionesTipos.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        {/* ISO */}
        <select
          value={filtroISO}
          onChange={(e) => setFiltroISO(e.target.value)}
          className="border p-2 rounded w-full"
        >
          <option value="">Todas las ISO</option>
          {opcionesISO.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* Capítulo */}
        <select
          value={filtroCapitulo}
          onChange={(e) => setFiltroCapitulo(e.target.value)}
          className="border p-2 rounded w-full"
        >
          <option value="">Todos los capítulos</option>
          {opcionesCapitulos.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>

        {/* Numeral */}
        <select
          value={filtroNumeral}
          onChange={(e) => setFiltroNumeral(e.target.value)}
          className="border p-2 rounded w-full"
        >
          <option value="">Todos los numerales</option>
          {opcionesNumerales.map((n) => (
            <option key={n.value} value={n.value}>{n.label}</option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={limpiarFiltros}
          className="bg-gray-200 text-gray-800 px-3 py-2 rounded hover:bg-gray-300"
        >
          Limpiar filtros
        </button>
      </div>

      {/* ===================== Acciones ===================== */}
      <div className="flex justify-between items-center mb-4 gap-4">
        <button
          onClick={() => setIsModalOpen(true)}
          disabled={estaCargando}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
        >
          <CloudUpload size={18} />
          Cargar Excel
        </button>

        <button
          onClick={() => exportarExcel(filtrados)}
          disabled={estaCargando}
          className="bg-emerald-600 text-white px-4 py-2 rounded hover:bg-emerald-700 disabled:opacity-50"
        >
          Descargar Excel
        </button>
      </div>

      {/* ===================== Tabla ===================== */}
      <DataTable
        columns={columnas}
        data={filtrados}
        keyField="key"
        pagination
        highlightOnHover
        responsive
        striped
        noDataComponent="No hay hallazgos registrados."
      />

      {/* ===================== Modal Carga Excel ===================== */}
      <Dialog open={isModalOpen} onClose={() => setIsModalOpen(false)} className="relative z-50">
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
