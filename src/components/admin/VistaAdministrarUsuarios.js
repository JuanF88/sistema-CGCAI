'use client'

import { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { useRouter } from 'next/navigation'
import DataTable from 'react-data-table-component'
import { Eye, EyeOff } from 'lucide-react'
import { Mail } from 'lucide-react'

export default function VistaAdministrarUsuarios() {
  const [usuarios, setUsuarios] = useState([])
  const [mostrarModal, setMostrarModal] = useState(false)
  const [editando, setEditando] = useState(false)
  const [mostrarPassword, setMostrarPassword] = useState(false)


  // Enviar correo
  const [credOpen, setCredOpen] = useState(false)
  const [credUsuario, setCredUsuario] = useState(null) // el row seleccionado
  const [credPassword, setCredPassword] = useState('') // por si NO viene del backend y quieres escribirla
  const [credBody, setCredBody] = useState('')
  const [credSubject, setCredSubject] = useState('')

  const plantillaCredenciales = ({ nombre, apellido, email, password }) => {
    return `Buen día ${nombre} ${apellido},

    Te comparto tus credenciales de acceso:

    Usuario: ${email}
    Contraseña: ${password}

    Puedes ingresar aquí: https://sistema-cgcai.vercel.app/

    Saludos.`
  }

  const abrirCredenciales = (usuario) => {
    const pwd = usuario.password || ''
    setCredUsuario(usuario)
    setCredPassword(pwd)

    const subject = `Credenciales de acceso`
    const body = plantillaCredenciales({
      nombre: usuario.nombre || '',
      apellido: usuario.apellido || '',
      email: usuario.email || '',
      password: pwd || '*** (edita antes de enviar)'
    })

    setCredSubject(subject)
    setCredBody(body)
    setCredOpen(true)
  }

  const cerrarCredenciales = () => {
    setCredOpen(false)
    setCredUsuario(null)
    setCredPassword('')
    setCredBody('')
    setCredSubject('')
  }

  const copiarCredenciales = async () => {
    try {
      await navigator.clipboard.writeText(credBody)
      toast.success('Texto copiado al portapapeles')
    } catch {
      toast.error('No se pudo copiar')
    }
  }


  const abrirGmailCompose = () => {
    if (!credUsuario?.email) {
      toast.error('Falta el correo del usuario.')
      return
    }
    const to = encodeURIComponent(credUsuario.email)
    const su = encodeURIComponent(credSubject)
    const bo = encodeURIComponent(credBody)
    const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${to}&su=${su}&body=${bo}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }
  // Eliminación
  const [eliminandoId, setEliminandoId] = useState(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [usuarioAEliminar, setUsuarioAEliminar] = useState(null)

  const router = useRouter()

  const [formulario, setFormulario] = useState({
    usuario_id: null,
    nombre: '',
    apellido: '',
    email: '',
    password: '',
    rol: '',
    estado: 'activo'
  })

  useEffect(() => {
    const fetchData = async () => {
      const resUsuarios = await fetch('/api/usuarios')
      const dataUsuarios = await resUsuarios.json()
      setUsuarios(dataUsuarios)
    }
    fetchData()
  }, [router])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormulario((prev) => ({ ...prev, [name]: value }))
  }

  // --- Eliminación con modal ---
  const solicitarEliminacion = (usuario) => {
    setUsuarioAEliminar(usuario)
    setConfirmOpen(true)
  }

  const confirmarEliminacion = async () => {
    if (!usuarioAEliminar) return
    try {
      setEliminandoId(usuarioAEliminar.usuario_id)
      const res = await fetch(`/api/usuarios?id=${usuarioAEliminar.usuario_id}`, { method: 'DELETE' })

      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error || 'Error al eliminar')
      }

      // Optimista: quita de la tabla
      setUsuarios(prev => prev.filter(u => u.usuario_id !== usuarioAEliminar.usuario_id))
      toast.success('Usuario eliminado')
      setConfirmOpen(false)
      setUsuarioAEliminar(null)
    } catch (e) {
      toast.error(e.message || 'No se pudo eliminar')
    } finally {
      setEliminandoId(null)
    }
  }

  const cancelarEliminacion = () => {
    setConfirmOpen(false)
    setUsuarioAEliminar(null)
  }
  // --- fin eliminación ---

  const handleSubmit = async () => {
    try {
      let res, data

      if (editando) {
        if (!formulario.usuario_id) {
          toast.error('No se especificó el ID del usuario a actualizar.')
          return
        }

        res = await fetch(`/api/usuarios?id=${formulario.usuario_id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formulario)
        })
      } else {
        res = await fetch('/api/usuarios', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formulario)
        })
      }

      if (!res.ok) {
        const err = await res.json().catch(() => null)
        toast.error('Error al guardar: ' + (err?.error || 'Desconocido'))
        return
      }

      data = await res.json()
      setUsuarios((prev) =>
        editando
          ? prev.map((u) => (u.usuario_id === data.usuario_id ? data : u))
          : [...prev, data]
      )

      cerrarModal()
      toast.success('Usuario actualizado/creado con éxito')
      localStorage.setItem('vistaAdmin', 'bienvenida')
      router.push('/admin?vista=bienvenida')
    } catch {
      toast.error('Error inesperado al guardar')
    }
  }

  const abrirEdicion = (usuario) => {
    setFormulario({ ...usuario })
    setEditando(true)
    setMostrarModal(true)
  }

  const abrirNuevo = () => {
    setFormulario({
      usuario_id: null,
      nombre: '',
      apellido: '',
      email: '',
      password: '',
      rol: '',
      estado: 'activo'
    })
    setEditando(false)
    setMostrarModal(true)
  }

  const cerrarModal = () => {
    setFormulario({
      usuario_id: null,
      nombre: '',
      apellido: '',
      email: '',
      password: '',
      rol: '',
      estado: 'activo'
    })
    setMostrarModal(false)
    setEditando(false)
  }

  const columnas = [
    {
      name: 'ID',
      selector: row => row.usuario_id,
      sortable: true,
      width: '80px'
    },
    {
      name: 'Nombre',
      selector: row => `${row.nombre} ${row.apellido}`,
      sortable: true,
    },
    {
      name: 'Email',
      selector: row => row.email,
      sortable: true,
    },
    {
      name: 'Rol',
      selector: row => row.rol,
      sortable: true,
    },
    {
      name: 'Estado',
      selector: row => row.estado,
      sortable: true,
    },
    {
      name: 'Acciones',
      cell: row => (
        <div className="flex gap-2">
          <button
            onClick={() => abrirEdicion(row)}
            className="bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600"
          >
            Editar
          </button>

          <button
            onClick={() => solicitarEliminacion(row)}
            disabled={eliminandoId === row.usuario_id}
            className={`px-2 py-1 rounded text-white ${eliminandoId === row.usuario_id
              ? 'bg-red-300 cursor-not-allowed'
              : 'bg-red-600 hover:bg-red-700'
              }`}
            title="Eliminar usuario"
          >
            {eliminandoId === row.usuario_id ? 'Eliminando...' : 'Eliminar'}
          </button>

          {/* NUEVO: Enviar credenciales */}
          <button
            onClick={() => abrirCredenciales(row)}
            className="bg-emerald-600 text-white px-2 py-1 rounded hover:bg-emerald-700 flex items-center gap-1"
            title="Preparar correo con credenciales"
          >
            <Mail size={16} />
            Credenciales
          </button>
        </div>
      )
    }

  ]

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-700">Usuarios</h2>

      <DataTable
        columns={columnas}
        data={usuarios}
        pagination
        highlightOnHover
        responsive
        striped
        noDataComponent="No hay usuarios registrados."
      />

      <div className="flex justify-center">
        <button
          onClick={abrirNuevo}
          className="text-3xl text-white bg-blue-600 hover:bg-blue-700 rounded-full w-14 h-14 flex items-center justify-center shadow-xl"
          title="Crear nuevo usuario"
        >
          +
        </button>
      </div>

      {/* Modal crear/editar */}
      {mostrarModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-md space-y-4">
            <h3 className="text-xl font-bold text-gray-700">
              {editando ? 'Editar Usuario' : 'Nuevo Usuario'}
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <input
                type="text"
                name="nombre"
                placeholder="Nombre"
                value={formulario.nombre}
                onChange={handleChange}
                className="border p-2 rounded"
              />
              <input
                type="text"
                name="apellido"
                placeholder="Apellido"
                value={formulario.apellido}
                onChange={handleChange}
                className="border p-2 rounded"
              />
            </div>

            <input
              type="email"
              name="email"
              placeholder="Email"
              value={formulario.email}
              onChange={handleChange}
              className="w-full border p-2 rounded"
            />

            <div className="relative">
              <input
                type={mostrarPassword ? 'text' : 'password'}
                name="password"
                placeholder="Contraseña"
                value={formulario.password}
                onChange={handleChange}
                className="w-full border p-2 pr-10 rounded"
                autoComplete="new-password"
              />

              <button
                type="button"
                onClick={() => setMostrarPassword((v) => !v)}
                className="absolute inset-y-0 right-2 flex items-center"
                aria-label={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                title={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {mostrarPassword ? <EyeOff size={20} className="text-gray-500" /> : <Eye size={20} className="text-gray-500" />}
              </button>
            </div>


            <select
              name="rol"
              value={formulario.rol}
              onChange={handleChange}
              className="w-full border p-2 rounded"
            >
              <option value="">Seleccione un rol</option>
              <option value="auditor">Auditor</option>
              <option value="admin">Administrador</option>
              <option value="gestor">Gestor</option>
            </select>

            <select
              name="estado"
              value={formulario.estado}
              onChange={handleChange}
              className="w-full border p-2 rounded"
            >
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo</option>
            </select>

            <div className="flex justify-end gap-2">
              <button onClick={cerrarModal} className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700">
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

      {/* Modal de confirmación de eliminación */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={cancelarEliminacion} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-start gap-3">
              <div className="shrink-0 rounded-full bg-red-100 p-2">
                <span className="text-red-600 text-xl">⚠️</span>
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-semibold text-gray-800">Eliminar usuario</h3>
                <p className="text-sm text-gray-600">
                  Vas a eliminar a{' '}
                  <span className="font-medium">
                    {usuarioAEliminar?.nombre} {usuarioAEliminar?.apellido}
                  </span>{' '}
                  ({usuarioAEliminar?.email}). Esta acción no se puede deshacer.
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
                disabled={eliminandoId === usuarioAEliminar?.usuario_id}
                className={`px-4 py-2 rounded text-white ${eliminandoId === usuarioAEliminar?.usuario_id
                  ? 'bg-red-300 cursor-not-allowed'
                  : 'bg-red-600 hover:bg-red-700'
                  }`}
              >
                {eliminandoId === usuarioAEliminar?.usuario_id ? 'Eliminando…' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal credenciales */}
      {credOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-xl space-y-4">
            <h3 className="text-xl font-bold text-gray-800">
              Enviar credenciales
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Para</label>
                <input
                  type="email"
                  value={credUsuario?.email || ''}
                  readOnly
                  className="w-full border p-2 rounded bg-gray-50"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Asunto</label>
                <input
                  type="text"
                  value={credSubject}
                  onChange={(e) => setCredSubject(e.target.value)}
                  className="w-full border p-2 rounded"
                />
              </div>
            </div>

            {/* Si necesitas escribir/ajustar la contraseña a enviar */}
            <div>
              <label className="block text-sm text-gray-600 mb-1">Contraseña a incluir</label>
              <input
                type="text"
                placeholder="Escribe la contraseña (o temporal)"
                value={credPassword}
                onChange={(e) => {
                  const pwd = e.target.value
                  setCredPassword(pwd)
                  const nuevoBody = plantillaCredenciales({
                    nombre: credUsuario?.nombre || '',
                    apellido: credUsuario?.apellido || '',
                    email: credUsuario?.email || '',
                    password: pwd || '*** (edita antes de enviar)'
                  })
                  setCredBody(nuevoBody)
                }}
                className="w-full border p-2 rounded"
              />
              <p className="text-xs text-gray-500 mt-1">
                Nota: si tu API no devuelve la contraseña, puedes definir una temporal y obligar el cambio al primer ingreso.
              </p>
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">Cuerpo</label>
              <textarea
                rows={8}
                value={credBody}
                onChange={(e) => setCredBody(e.target.value)}
                className="w-full border p-2 rounded font-mono"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={cerrarCredenciales}
                className="px-4 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Cerrar
              </button>
              <button
                onClick={copiarCredenciales}
                className="px-4 py-2 rounded bg-gray-800 text-white hover:bg-gray-900"
              >
                Copiar cuerpo
              </button>
              <button
                onClick={abrirGmailCompose}
                className="px-4 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700"
              >
                Abrir en Gmail
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
