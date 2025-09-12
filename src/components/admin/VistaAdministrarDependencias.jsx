'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import DataTable from 'react-data-table-component'
import { toast } from 'react-toastify'

export default function VistaAdministrarDependencias() {
  const router = useRouter()
  const [dependencias, setDependencias] = useState([])
  const [cargando, setCargando] = useState(true)

  // 🔎 Buscador
  const [busqueda, setBusqueda] = useState('') // 👈

  // Modal crear/editar
  const [mostrarModal, setMostrarModal] = useState(false)
  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState({
    dependencia_id: null,
    nombre: ''
  })

  // Eliminar
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [eliminandoId, setEliminandoId] = useState(null)
  const [filaAEliminar, setFilaAEliminar] = useState(null)

  // Cargar datos
  useEffect(() => {
    const fetchData = async () => {
      try {
        setCargando(true)
        const res = await fetch('/api/dependencias')
        if (!res.ok) {
          const err = await res.json().catch(() => null)
          throw new Error(err?.error || 'No se pudo cargar dependencias.')
        }
        const data = await res.json()
        setDependencias(data)
      } catch (e) {
        toast.error(e.message || 'Error cargando dependencias')
      } finally {
        setCargando(false)
      }
    }
    fetchData()
  }, [router])

  const abrirNuevo = () => {
    setForm({ dependencia_id: null, nombre: '' })
    setEditando(false)
    setMostrarModal(true)
  }

  const abrirEdicion = (row) => {
    setForm({ dependencia_id: row.dependencia_id, nombre: row.nombre })
    setEditando(true)
    setMostrarModal(true)
  }

  const cerrarModal = () => {
    setForm({ dependencia_id: null, nombre: '' })
    setEditando(false)
    setMostrarModal(false)
  }

    const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
        ...prev,
        [name]: name === "nombre" ? value.toUpperCase() : value,
    }));
    };


  const handleSubmit = async () => {
    try {
      let res
      if (!form.nombre || !form.nombre.trim()) {
        toast.error('El nombre es requerido.')
        return
      }

      if (editando) {
        if (!form.dependencia_id) {
          toast.error('Falta el ID para actualizar.')
          return
        }
        res = await fetch(`/api/dependencias?id=${form.dependencia_id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre: form.nombre.trim() })
        })
      } else {
        res = await fetch('/api/dependencias', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre: form.nombre.trim() })
        })
      }

      if (!res.ok) {
        const err = await res.json().catch(() => null)
        toast.error('Error al guardar: ' + (err?.error || 'Desconocido'))
        return
      }

      const data = await res.json()

      setDependencias((prev) =>
        editando
          ? prev.map((d) => (d.dependencia_id === data.dependencia_id ? data : d))
          : [...prev, data]
      )

      toast.success(editando ? 'Dependencia actualizada' : 'Dependencia creada')
      cerrarModal()
    } catch {
      toast.error('Error inesperado al guardar')
    }
  }

  // Eliminar
  const solicitarEliminacion = (row) => {
    setFilaAEliminar(row)
    setConfirmOpen(true)
  }

  const cancelarEliminacion = () => {
    setConfirmOpen(false)
    setFilaAEliminar(null)
  }

  const confirmarEliminacion = async () => {
    if (!filaAEliminar) return
    try {
      setEliminandoId(filaAEliminar.dependencia_id)

      const res = await fetch(`/api/dependencias?id=${filaAEliminar.dependencia_id}`, {
        method: 'DELETE'
      })

      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error || 'No se pudo eliminar')
      }

      setDependencias((prev) =>
        prev.filter((d) => d.dependencia_id !== filaAEliminar.dependencia_id)
      )
      toast.success('Dependencia eliminada')
      cancelarEliminacion()
    } catch (e) {
      toast.error(e.message || 'Error eliminando dependencia')
    } finally {
      setEliminandoId(null)
    }
  }

  // Normaliza para búsqueda sin acentos y case-insensitive 👇
  const normalize = (s) =>
    (s || '')
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()

  // Filtrar y ordenar alfabeticamente SIEMPRE 👇
  const dependenciasVista = useMemo(() => {
    const q = normalize(busqueda)
    const filtradas = dependencias.filter((d) =>
      normalize(d.nombre).includes(q)
    )
    // orden A-Z por nombre
    filtradas.sort((a, b) => normalize(a.nombre).localeCompare(normalize(b.nombre)))
    return filtradas
  }, [dependencias, busqueda])

  const columnas = [
    {
      id: 'id',
      name: 'ID',
      selector: (row) => row.dependencia_id,
      sortable: true,
      width: '90px'
    },
    {
      id: 'nombre', // 👈 para defaultSortFieldId
      name: 'Nombre',
      selector: (row) => row.nombre,
      sortable: true,
      wrap: true,
      sortFunction: (a, b) => normalize(a.nombre).localeCompare(normalize(b.nombre)) // 👈 orden consistente al click
    },
    {
      name: 'Acciones',
      cell: (row) => (
        <div className="flex gap-2">
          <button
            onClick={() => abrirEdicion(row)}
            className="bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
          >
            Editar
          </button>

          <button
            onClick={() => solicitarEliminacion(row)}
            disabled={eliminandoId === row.dependencia_id}
            className={`px-2 py-1 rounded text-white ${
              eliminandoId === row.dependencia_id
                ? 'bg-red-300 cursor-not-allowed'
                : 'bg-red-600 hover:bg-red-700'
            }`}
            title="Eliminar dependencia"
          >
            {eliminandoId === row.dependencia_id ? 'Eliminando...' : 'Eliminar'}
          </button>
        </div>
      )
    }
  ]

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-700">Dependencias</h2>

      {/* 🔎 Buscador */}
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Buscar por nombre..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="border p-2 rounded w-full max-w-md"
        />
        {busqueda && (
          <button
            onClick={() => setBusqueda('')}
            className="px-3 py-2 rounded border border-gray-300 hover:bg-gray-50"
          >
            Limpiar
          </button>
        )}
      </div>

      <DataTable
        columns={columnas}
        data={dependenciasVista}               // 👈 usamos la vista filtrada+ordenada
        pagination
        progressPending={cargando}
        highlightOnHover
        responsive
        striped
        noDataComponent="No hay dependencias registradas."
        defaultSortFieldId="nombre"           // 👈 arranca ordenado por Nombre
        defaultSortAsc={true}
      />

      <div className="flex justify-center">
        <button
          onClick={abrirNuevo}
          className="text-3xl text-white bg-blue-600 hover:bg-blue-700 rounded-full w-14 h-14 flex items-center justify-center shadow-xl"
          title="Crear dependencia"
        >
          +
        </button>
      </div>

      {/* Modal crear/editar */}
      {mostrarModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-md space-y-4">
            <h3 className="text-xl font-bold text-gray-700">
              {editando ? 'Editar Dependencia' : 'Nueva Dependencia'}
            </h3>

            <input
            type="text"
            name="nombre"
            placeholder="Nombre de la dependencia"
            value={form.nombre}
            onChange={handleChange}
            className="w-full border p-2 rounded uppercase"
            />
            
            <div className="flex justify-end gap-2">
              <button
                onClick={cerrarModal}
                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                {editando ? 'Actualizar' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmación eliminar */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={cancelarEliminacion} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-start gap-3">
              <div className="shrink-0 rounded-full bg-red-100 p-2">
                <span className="text-red-600 text-xl">⚠️</span>
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-semibold text-gray-800">Eliminar dependencia</h3>
                <p className="text-sm text-gray-600">
                  Vas a eliminar{' '}
                  <span className="font-medium">{filaAEliminar?.nombre}</span>. Esta acción no se
                  puede deshacer.
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={cancelarEliminacion}
                className="px-4 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarEliminacion}
                disabled={eliminandoId === filaAEliminar?.dependencia_id}
                className={`px-4 py-2 rounded text-white ${
                  eliminandoId === filaAEliminar?.dependencia_id
                    ? 'bg-red-300 cursor-not-allowed'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {eliminandoId === filaAEliminar?.dependencia_id ? 'Eliminando…' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
