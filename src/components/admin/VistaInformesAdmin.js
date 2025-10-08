'use client'

import { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { useRouter } from 'next/navigation'
import DataTable from 'react-data-table-component'
import { createClient } from '@supabase/supabase-js'

// Cliente (usar variables públicas de tu proyecto)
const supabase =
  typeof window !== 'undefined'
    ? createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      )
    : null
// Quita tildes y deja MAYUSCULAS_CON_GUIONES
const toSlugUpper = (s = '') =>
  s.normalize('NFD')
   .replace(/[\u0300-\u036f]/g, '')
   .replace(/[^A-Za-z0-9]+/g, '_')
   .replace(/^_+|_+$/g, '')
   .toUpperCase()

// YYYY-MM-DD seguro (si ya viene como '2025-09-25' lo respeta)
const toYMD = (input) => {
  if (!input) return new Date().toISOString().slice(0,10)
  const s = String(input)
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0,10) : new Date(input).toISOString().slice(0,10)
}

// Path consistente DENTRO del bucket 'validaciones' (sin prefijo repetido)
const buildValidationPath = (a) => {
  const dep = toSlugUpper(a?.dependencias?.nombre || 'SIN_DEPENDENCIA')
  const ymd = toYMD(a?.fecha_auditoria)
  return `Auditoria_${a.id}_${dep}_${ymd}.pdf`
}


const getValidationUrl = async (a) => {
  const path = buildValidationPath(a)

  // 1) intenta URL firmada
  const { data, error } = await supabase
    .storage
    .from('validaciones')
    .createSignedUrl(path, 60)

  if (data?.signedUrl && !error) return data.signedUrl

  // 2) intenta pública (si el bucket/archivo es público)
  const pub = supabase.storage.from('validaciones').getPublicUrl(path)
  if (pub?.data?.publicUrl) return pub.data.publicUrl

  // 3) (fallback) si ya subiste archivos viejos en 'validaciones/...'
  const legacyPath = `validaciones/${path}`
  const legacySigned = await supabase.storage.from('validaciones').createSignedUrl(legacyPath, 60)
  if (legacySigned?.data?.signedUrl) return legacySigned.data.signedUrl

  throw new Error(error?.message || 'No se encontró el archivo')
}


const handleDescargarValidacion = async (row, toast) => {
  try {
    const url = await getValidationUrl(row)
    // Abre en otra pestaña (o cambia a descarga forzada si prefieres)
    window.open(url, '_blank', 'noopener,noreferrer')
  } catch (e) {
    console.error(e)
    toast?.error('No se pudo descargar el informe validado. Verifica que exista en el bucket "validaciones".')
  }
}

export default function VistaInformesAdmin() {
  const [informes, setInformes] = useState([])
  const [auditores, setAuditores] = useState([])
  const [dependencias, setDependencias] = useState([])
  const [mostrarModal, setMostrarModal] = useState(false)
  const router = useRouter()
  const [busqueda, setBusqueda] = useState('')
  const [filtroDependencia, setFiltroDependencia] = useState('')
  const [filtroAuditor, setFiltroAuditor] = useState('')
  const [filtroAnio, setFiltroAnio] = useState('')
  const [filtroSemestre, setFiltroSemestre] = useState('')

  const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false)
  const [informeAEliminar, setInformeAEliminar] = useState(null)

  const [mostrarDetalle, setMostrarDetalle] = useState(false)
  const [informeDetalle, setInformeDetalle] = useState(null)

  const informesFiltrados = informes.filter((informe) => {
    const coincideBusqueda =
      busqueda === '' ||
      (informe.usuarios &&
        (`${informe.usuarios.nombre} ${informe.usuarios.apellido}`.toLowerCase().includes(busqueda.toLowerCase()))) ||
      (informe.dependencias?.nombre?.toLowerCase().includes(busqueda.toLowerCase())) ||
      (informe.id?.toString().includes(busqueda))

    const coincideDependencia =
      filtroDependencia === '' || informe.dependencia_id === parseInt(filtroDependencia)

    const coincideAuditor =
      filtroAuditor === '' || informe.usuario_id === parseInt(filtroAuditor)

    const coincideAnio =
      filtroAnio === '' ||
      (informe.fecha_auditoria &&
        new Date(informe.fecha_auditoria).getFullYear().toString() === filtroAnio)

    const coincideSemestre =
      filtroSemestre === '' ||
      (informe.fecha_auditoria &&
        ((new Date(informe.fecha_auditoria).getMonth() + 1 <= 6 && filtroSemestre === '1') ||
          (new Date(informe.fecha_auditoria).getMonth() + 1 > 6 && filtroSemestre === '2')))

    return coincideBusqueda && coincideDependencia && coincideAuditor && coincideAnio && coincideSemestre
  })


  const [nuevoInforme, setNuevoInforme] = useState({
    usuario_id: '',
    dependencia_id: '',
  })

  useEffect(() => {
    const fetchData = async () => {
      try {
        const resInformes = await fetch('/api/informes')
        const dataInformes = await resInformes.json()

        const resAuditores = await fetch('/api/usuarios?rol=auditor')
        const dataAuditores = await resAuditores.json()

        const resDeps = await fetch('/api/dependencias')
        const dataDeps = await resDeps.json()

        setInformes(dataInformes)
        setAuditores(dataAuditores)
        setDependencias(dataDeps)
      } catch (error) {
        console.error('Error al cargar datos:', error)
      }
    }
    fetchData()
  }, [router])

  const handleChange = (e) => {
    const { name, value } = e.target
    setNuevoInforme((prev) => ({ ...prev, [name]: value }))
  }
  const crearInforme = async () => {
    if (!nuevoInforme.usuario_id || !nuevoInforme.dependencia_id) {
      toast.error('Por favor seleccione un auditor y una dependencia');
      return;
    }

    const res = await fetch('/api/informes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nuevoInforme),
    })

    if (res.ok) {
      const creado = await res.json()
      setInformes((prev) => [...prev, creado[0]])
      setNuevoInforme({ usuario_id: '', dependencia_id: '' })
      setMostrarModal(false)
      toast.success('Auditoría asignada con éxito')
      localStorage.setItem('vistaActual', 'crearInforme')
      router.push('/admin?vista=crearInforme')
    } else {
      try {
        const error = await res.json()
        alert('Error al crear informe: ' + (error?.error || 'Error desconocido'))
      } catch {
        alert('Error al crear informe: No se pudo leer el mensaje de error')
      }
    }
  }

  const eliminarInforme = async (id) => {
    try {
      const res = await fetch('/api/informes', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })

      if (res.ok) {
        setInformes(prev => prev.filter(inf => inf.id !== id))
        toast.success('Informe eliminado correctamente')
      } else {
        const error = await res.json()
        toast.error('Error al eliminar: ' + (error?.error || 'desconocido'))
      }
    } catch (err) {
      console.error('Error al eliminar:', err)
      toast.error('Error inesperado al eliminar informe')
    }
  }

  const contarCamposCompletos = (a) => {
    const campos = [
      'objetivo',
      'criterios',
      'conclusiones',
      'fecha_auditoria',
      'asistencia_tipo',
      'fecha_seguimiento',
      'recomendaciones',
      'auditores_acompanantes'
    ]
    return campos.reduce((acc, campo) => (a[campo] ? acc + 1 : acc), 0)
  }

  const calcularAvance = (a) => {
    const total = 8
    const completos = contarCamposCompletos(a)
    const tieneHallazgos =
      (a.fortalezas?.length || 0) > 0 ||
      (a.oportunidades_mejora?.length || 0) > 0 ||
      (a.no_conformidades?.length || 0) > 0

    if (completos < total) return 0
    return tieneHallazgos ? 100 : 50
  }

  const columnas = [
    {
    name: 'ID',
    selector: row => row.id,
    sortable: true,
    width: '64px',
    cell: row => <div className="w-full text-center">{row.id}</div>, // ✅ centra sin props raras
    },
    {
      name: 'Año',
      selector: row => {
        const fecha = row.fecha_auditoria ? new Date(row.fecha_auditoria) : null
        return fecha ? fecha.getFullYear() : 'N/A'
      },
          sortable: true,
    width: '80px',
      
    },
        {
      name: 'Fecha Audtoria',
      selector: row =>  row.fecha_auditoria|| 'N/A',
          sortable: true,
    cell: row => <div className="w-full text-center">{row.fecha_auditoria}</div>, // ✅ centra sin props raras

    },
    {
      name: 'Semestre',
      selector: row => {
        const fecha = row.fecha_auditoria ? new Date(row.fecha_auditoria) : null
        if (!fecha) return 'N/A'
        const mes = fecha.getMonth() + 1
        return mes >= 1 && mes <= 6 ? '1' : '2'
      },
          sortable: true,
    width: '120px',

    },
    {
      name: 'Dependencia',
      selector: row => row.dependencias?.nombre || 'N/A',
      sortable: true
    },
    {
      name: 'Auditor',
      selector: row =>
        row.usuarios ? `${row.usuarios.nombre} ${row.usuarios.apellido}` : 'No asignado',
      sortable: true
    },
    {
      name: 'Avance',
      selector: row => calcularAvance(row),
      sortable: true,
      cell: row => {
        const progreso = calcularAvance(row)
        let color = 'text-gray-600'
        if (progreso === 100) color = 'text-green-600'
        else if (progreso >= 50) color = 'text-yellow-600'
        else color = 'text-red-600'

        return <span className={`font-semibold ${color}`}>{progreso}%</span>
      }
    },
    {
      name: 'Validado',
      selector: row => row.validado,
      sortable: true,
      cell: row => (
        <span className={`font-semibold ${row.validado ? 'text-green-600' : 'text-red-500'}`}>
          {row.validado ? 'Sí' : 'No'}
        </span>
      )
    },

    {
      // FORTALEZAS
      name: <div className="w-full flex justify-end pr-1">F</div>,
      selector: row => row.fortalezas?.length ?? 0,
      sortable: true,
      width: '80px',
      cell: row => (
        <div className="w-full flex justify-end pr-1">
          <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold text-xs">
            {row.fortalezas?.length ?? 0}
          </span>
        </div>
      ),
    },
    {
      // OPORTUNIDADES DE MEJORA
      name: <div className="w-full flex justify-end pr-1">OM</div>,
      selector: row => row.oportunidades_mejora?.length ?? 0,
      sortable: true,
      width: '80px',
      cell: row => (
        <div className="w-full flex justify-end pr-1">
          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold text-xs">
            {row.oportunidades_mejora?.length ?? 0}
          </span>
        </div>
      ),
    },
    {
      // NO CONFORMIDADES
      name: <div className="w-full flex justify-end pr-1">NC</div>,
      selector: row => row.no_conformidades?.length ?? 0,
      sortable: true,
      width: '80px',
      cell: row => (
        <div className="w-full flex justify-end pr-1">
          <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold text-xs">
            {row.no_conformidades?.length ?? 0}
          </span>
        </div>
      ),
    },


{
  name: 'Acciones',
  cell: row => {
    const progreso = calcularAvance(row)
    const puedeDescargar = progreso === 100 && row.validado === true

    return (
      <div className="flex gap-2">
        <button
          onClick={() => {
            setInformeDetalle(row)
            setMostrarDetalle(true)
          }}
          className="bg-blue-500 text-white px-1 py-1 rounded hover:bg-blue-600 text-s"
        >
          Ver más
        </button>

        {puedeDescargar && (
          <button
            onClick={() => handleDescargarValidacion(row, toast)}
            className="bg-emerald-600 text-white px-1 py-1 rounded hover:bg-emerald-700 text-s"
            title="Descargar informe validado"
          >
            Descargar
          </button>
        )}

        <button
          onClick={() => {
            setInformeAEliminar(row.id)
            setMostrarConfirmacion(true)
          }}
          className="bg-red-500 text-white px-1 py-1 rounded hover:bg-red-600 text-s"
        >
          Eliminar
        </button>
      </div>
    )
  }
}


  ]


  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-700">Informes de Auditoría</h2>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
        {/* Búsqueda */}
        <input
          type="text"
          placeholder="Buscar por nombre, dependencia o ID"
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
          {dependencias.map((dep) => (
            <option key={dep.dependencia_id} value={dep.dependencia_id}>
              {dep.nombre}
            </option>
          ))}
        </select>

        {/* Auditor */}
        <select
          value={filtroAuditor}
          onChange={(e) => setFiltroAuditor(e.target.value)}
          className="border p-2 rounded w-full"
        >
          <option value="">Todos los auditores</option>
          {auditores.map((a) => (
            <option key={a.usuario_id} value={a.usuario_id}>
              {a.nombre} {a.apellido}
            </option>
          ))}
        </select>

        {/* Año */}
        <select
          value={filtroAnio}
          onChange={(e) => setFiltroAnio(e.target.value)}
          className="border p-2 rounded w-full"
        >
          <option value="">Todos los años</option>
          {[...new Set(informes.map((i) =>
            i.fecha_auditoria ? new Date(i.fecha_auditoria).getFullYear() : null
          ))]
            .filter((a) => a)
            .sort()
            .map((anio) => (
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

      {/* Tabla de informes */}
      <DataTable
        columns={columnas}
        data={informesFiltrados}
        pagination
        highlightOnHover
        responsive
        striped
        noDataComponent="No hay informes registrados."
      />


      {/* Botón para agregar nuevo */}
      <div className="flex justify-center mt-4">
        <button
          onClick={() => setMostrarModal(true)}
          className="text-3xl text-white bg-emerald-600 hover:bg-emerald-700 rounded-full w-14 h-14 flex items-center justify-center shadow-xl"
          title="Crear nuevo informe"
        >
          +
        </button>
      </div>

      {/* Modal */}
      {mostrarModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-md space-y-4">
            <h3 className="text-xl font-bold text-gray-700">Nueva Auditoria</h3>

            <div>
              <label className="block text-sm font-medium">Dependencia</label>
              <select
                name="dependencia_id"
                value={nuevoInforme.dependencia_id}
                onChange={handleChange}
                className="w-full border p-2 rounded"
              >
                <option value="">Seleccione una dependencia</option>
                {dependencias.map((dep) => (
                  <option key={dep.dependencia_id} value={dep.dependencia_id}>
                    {dep.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium">Auditor Responsable</label>
              <select
                name="usuario_id"
                value={nuevoInforme.usuario_id}
                onChange={handleChange}
                className="w-full border p-2 rounded"
              >
                <option value="">Seleccione un auditor</option>
                {auditores.map((a) => (
                  <option key={a.usuario_id} value={a.usuario_id}>
                    {a.nombre} {a.apellido}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setMostrarModal(false)}
                className="px-4 py-2 rounded text-gray-500 hover:text-gray-700"
              >
                Cancelar
              </button>
              <button
                onClick={crearInforme}
                className="bg-emerald-600 text-white px-4 py-2 rounded hover:bg-emerald-700"
              >
                Crear
              </button>
            </div>
          </div>
        </div>
      )}

      {mostrarConfirmacion && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-md space-y-4">
            <h3 className="text-lg font-bold text-gray-800">¿Eliminar informe?</h3>
            <p className="text-sm text-gray-600">Esta acción eliminará el informe y todos sus hallazgos asociados. ¿Estás seguro?</p>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setMostrarConfirmacion(false)}
                className="px-4 py-2 rounded text-gray-500 hover:text-gray-700"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  await eliminarInforme(informeAEliminar)
                  setMostrarConfirmacion(false)
                }}
                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {mostrarDetalle && informeDetalle && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-gray-700">Detalle del Informe</h3>

            <div className="space-y-2 text-sm text-gray-800">
              <p><strong>ID:</strong> {informeDetalle.id}</p>
              <p><strong>Auditor Responsable:</strong> {informeDetalle.usuarios?.nombre} {informeDetalle.usuarios?.apellido}</p>
              <p><strong>Dependencia:</strong> {informeDetalle.dependencias?.nombre}</p>
              <p><strong>Fecha de Auditoría:</strong> {informeDetalle.fecha_auditoria || 'N/A'}</p>
              <p><strong>Tipo de Asistencia:</strong> {informeDetalle.asistencia_tipo || 'N/A'}</p>
              <p><strong>Fecha de Seguimiento:</strong> {informeDetalle.fecha_seguimiento || 'N/A'}</p>
              <p><strong>Acompañantes:</strong> {informeDetalle.auditores_acompanantes?.join(', ') || 'N/A'}</p>
              <p><strong>Objetivo:</strong> {informeDetalle.objetivo || 'N/A'}</p>
              <p><strong>Criterios:</strong> {informeDetalle.criterios || 'N/A'}</p>
              <p><strong>Conclusiones:</strong> {informeDetalle.conclusiones || 'N/A'}</p>
              <p><strong>Recomendaciones:</strong> {informeDetalle.recomendaciones || 'N/A'}</p>
              <p><strong>Fortalezas:</strong> {informeDetalle.fortalezas?.length || 0}</p>
              <p><strong>Oportunidades de Mejora:</strong> {informeDetalle.oportunidades_mejora?.length || 0}</p>
              <p><strong>No Conformidades:</strong> {informeDetalle.no_conformidades?.length || 0}</p>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setMostrarDetalle(false)}
                className="px-4 py-2 rounded text-gray-600 hover:text-gray-800 border border-gray-300"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
