'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import DataTable from 'react-data-table-component'
import { toast } from 'react-toastify'
import { Edit2, Trash2 } from 'lucide-react'
import styles from './CSS/VistaAdministrarDependencias.module.css'

const GESTIONES = [
  { value: 'estrategica', label: 'Gestión Estratégica' },
  { value: 'academica', label: 'Gestión Académica' },
  { value: 'investigacion', label: 'Gestión de Investigación, Innovación e Interacción Social' },
  { value: 'administrativa', label: 'Gestión Administrativa' },
  { value: 'cultura', label: 'Gestión de Cultura y Bienestar' },
  { value: 'control', label: 'Gestión de Control y Mejoramiento Continuo' },
  { value: 'otras', label: 'Otras / sin clasificar' },
]

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
    nombre: '',
    gestion: 'otras',
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
    setForm({ dependencia_id: null, nombre: '', gestion: 'otras' })
    setEditando(false)
    setMostrarModal(true)
  }

  const abrirEdicion = (row) => {
    setForm({ dependencia_id: row.dependencia_id, nombre: row.nombre, gestion: row.gestion || 'otras' })
    setEditando(true)
    setMostrarModal(true)
  }

  const cerrarModal = () => {
    setForm({ dependencia_id: null, nombre: '', gestion: 'otras' })
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

      const gestionVal = form.gestion || 'otras'

      if (editando) {
        if (!form.dependencia_id) {
          toast.error('Falta el ID para actualizar.')
          return
        }
        res = await fetch(`/api/dependencias?id=${form.dependencia_id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre: form.nombre.trim(), gestion: gestionVal })
        })
      } else {
        res = await fetch('/api/dependencias', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre: form.nombre.trim(), gestion: gestionVal })
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
      id: 'gestion',
      name: 'Gestión',
      selector: (row) => row.gestion || 'otras',
      sortable: true,
      width: '220px',
      cell: (row) => {
        const found = GESTIONES.find((g) => g.value === (row.gestion || 'otras'))
        return found?.label || row.gestion || 'Otras / sin clasificar'
      },
      sortFunction: (a, b) => normalize(a.gestion || '').localeCompare(normalize(b.gestion || '')),
    },
    {
      name: 'Acciones',
      width: '180px',
      cell: (row) => (
        <div className={styles.actionButtons}>
          <button
            onClick={() => abrirEdicion(row)}
            className={styles.btnEdit}
            title="Editar dependencia"
          >
            <Edit2 size={14} />
          </button>

          <button
            onClick={() => solicitarEliminacion(row)}
            disabled={eliminandoId === row.dependencia_id}
            className={`${styles.btnDelete} ${eliminandoId === row.dependencia_id ? styles.btnDisabled : ''}`}
            title="Eliminar dependencia"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )
    }
  ]

  // KPIs por gestión
  const stats = useMemo(() => {
    const total = dependencias.length
    const porGestion = {}
    GESTIONES.forEach(g => {
      porGestion[g.value] = dependencias.filter(d => (d.gestion || 'otras') === g.value).length
    })
    return { total, ...porGestion }
  }, [dependencias])

  return (
    <div className={styles.container}>
      {/* HEADER MODERNO */}
      <div className={styles.modernHeader}>
        <div className={styles.headerContent}>
          <div className={styles.headerLeft}>
            <div className={styles.headerIcon}>🏢</div>
            <div className={styles.headerInfo}>
              <h1 className={styles.headerTitle}>Administrar Dependencias</h1>
              <p className={styles.headerSubtitle}>Gestión de dependencias y áreas organizacionales</p>
            </div>
          </div>
          <div className={styles.headerRight}>
            <button className={styles.modernAddBtn} onClick={abrirNuevo} title="Crear nueva dependencia">
              <span className={styles.addIcon}>+</span>
              <span>Nueva Dependencia</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className={styles.kpiGrid}>
        <div className={`${styles.kpiCard} ${styles.kpiCardBlue}`}>
          <div className={styles.kpiIcon}>🏢</div>
          <div className={styles.kpiContent}>
            <div className={styles.kpiLabel}>Total Dependencias</div>
            <div className={styles.kpiValue}>{stats.total}</div>
          </div>
        </div>
        <div className={`${styles.kpiCard} ${styles.kpiCardPurple}`}>
          <div className={styles.kpiIcon}>🎯</div>
          <div className={styles.kpiContent}>
            <div className={styles.kpiLabel}>G. Estratégica</div>
            <div className={styles.kpiValue}>{stats.estrategica || 0}</div>
          </div>
        </div>
        <div className={`${styles.kpiCard} ${styles.kpiCardGreen}`}>
          <div className={styles.kpiIcon}>🎓</div>
          <div className={styles.kpiContent}>
            <div className={styles.kpiLabel}>G. Académica</div>
            <div className={styles.kpiValue}>{stats.academica || 0}</div>
          </div>
        </div>
        <div className={`${styles.kpiCard} ${styles.kpiCardCyan}`}>
          <div className={styles.kpiIcon}>🔬</div>
          <div className={styles.kpiContent}>
            <div className={styles.kpiLabel}>G. Investigación</div>
            <div className={styles.kpiValue}>{stats.investigacion || 0}</div>
          </div>
        </div>
        <div className={`${styles.kpiCard} ${styles.kpiCardOrange}`}>
          <div className={styles.kpiIcon}>💼</div>
          <div className={styles.kpiContent}>
            <div className={styles.kpiLabel}>G. Administrativa</div>
            <div className={styles.kpiValue}>{stats.administrativa || 0}</div>
          </div>
        </div>
        <div className={`${styles.kpiCard} ${styles.kpiCardPink}`}>
          <div className={styles.kpiIcon}>🎨</div>
          <div className={styles.kpiContent}>
            <div className={styles.kpiLabel}>G. Cultura</div>
            <div className={styles.kpiValue}>{stats.cultura || 0}</div>
          </div>
        </div>
        <div className={`${styles.kpiCard} ${styles.kpiCardIndigo}`}>
          <div className={styles.kpiIcon}>🔒</div>
          <div className={styles.kpiContent}>
            <div className={styles.kpiLabel}>G. Control</div>
            <div className={styles.kpiValue}>{stats.control || 0}</div>
          </div>
        </div>
        <div className={`${styles.kpiCard} ${styles.kpiCardGray}`}>
          <div className={styles.kpiIcon}>📁</div>
          <div className={styles.kpiContent}>
            <div className={styles.kpiLabel}>Otras</div>
            <div className={styles.kpiValue}>{stats.otras || 0}</div>
          </div>
        </div>
      </div>

      {/* TABLA */}
      <div className={styles.tableCard}>
        <div className={styles.tableHeader}>
          <h3 className={styles.tableTitle}>Listado de Dependencias</h3>
          <div className={styles.searchBox}>
            <input
              type="text"
              placeholder="Buscar por nombre..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className={styles.searchInput}
            />
            {busqueda && (
              <button onClick={() => setBusqueda('')} className={styles.clearBtn}>
                ✖
              </button>
            )}
          </div>
        </div>

        <div className={styles.tableWrapper}>
          <DataTable
            columns={columnas}
            data={dependenciasVista}
            pagination
            progressPending={cargando}
            highlightOnHover
            responsive
            striped
            noDataComponent="No hay dependencias registradas."
            defaultSortFieldId="nombre"
            defaultSortAsc={true}
            customStyles={{
              headRow: {
                style: {
                  backgroundColor: '#f8fafc',
                  borderBottom: '2px solid #e5e7eb',
                  fontWeight: '700',
                  fontSize: '13px',
                  color: '#475569',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }
              },
              rows: {
                style: {
                  fontSize: '14px',
                  color: '#1e293b',
                  '&:hover': {
                    backgroundColor: '#f1f5f9'
                  }
                }
              }
            }}
          />
        </div>
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

            <select
              name="gestion"
              value={form.gestion}
              onChange={handleChange}
              className="w-full border p-2 rounded"
            >
              {GESTIONES.map((g) => (
                <option key={g.value} value={g.value}>{g.label}</option>
              ))}
            </select>
            
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
