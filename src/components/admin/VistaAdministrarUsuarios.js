'use client'

import { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { useRouter } from 'next/navigation'

export default function VistaAdministrarUsuarios() {
  const [usuarios, setUsuarios] = useState([])
  const [mostrarModal, setMostrarModal] = useState(false)
  const [editando, setEditando] = useState(false)

  const router = useRouter()
  

  const [formulario, setFormulario] = useState({
    usuario_id: null,
    nombre: '',
    apellido: '',
    email: '',
    password: '',
    rol: ''
  })

  useEffect(() => {
    const fetchData = async () => {
      const resUsuarios = await fetch('/api/usuarios')
      const resDeps = await fetch('/api/dependencias')

      const dataUsuarios = await resUsuarios.json()

      setUsuarios(dataUsuarios)
    }

    fetchData()
  }, [])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormulario((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async () => {
    try {
      console.info('📤 Formulario a enviar:', formulario)

      let res, data

      if (editando) {
        if (!formulario.usuario_id) {
          console.error('⚠️ Falta usuario_id para actualizar:', formulario)
          alert('Error: No se especificó el ID del usuario a actualizar.')
          return
        }

        res = await fetch(`/api/usuarios?id=${formulario.usuario_id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nombre: formulario.nombre,
            apellido: formulario.apellido,
            email: formulario.email,
            rol: formulario.rol,
            password: formulario.password
          })
        })
      } else {
          res = await fetch('/api/usuarios', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formulario)
        })
      }

      if (!res.ok) {
        const err = await res.json()
        console.error('❌ Error en respuesta:', err)
        alert('Error al guardar: ' + (err?.error || 'Desconocido'))
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

    } catch (err) {
      console.error('❌ Error inesperado en handleSubmit:', err)
      alert('Error inesperado al guardar')
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
      rol: ''
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
      rol: ''
    })
    setMostrarModal(false)
    setEditando(false)
  }


  //VISTA

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-700">Usuarios</h2>

      {['admin', 'auditor', 'gestor'].map((rol) => {
        const color =
          rol === 'admin'
            ? 'border-blue-500'
            : rol === 'auditor'
              ? 'border-green-500'
              : 'border-yellow-500'

        return (
          <div key={rol} className="mb-8">
            <h3 className="text-xl font-semibold text-gray-700 capitalize mb-2">
              {rol === 'admin' ? 'Administradores' : rol === 'auditor' ? 'Auditores' : 'Gestores'}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {usuarios
                .filter((u) => u.rol === rol)
                .map((usuario) => (
                  <div
                    key={usuario.usuario_id}
                    className={`bg-white p-4 rounded shadow cursor-pointer hover:bg-gray-50 border-l-4 ${color}`}
                    onClick={() => abrirEdicion(usuario)}
                  >
                    <p className="font-semibold text-gray-800">
                      {usuario.nombre} {usuario.apellido}
                    </p>
                    <p className="text-sm text-gray-600">{usuario.email}</p>
                    <p className="text-sm text-gray-500 capitalize">{usuario.rol}</p>
                  </div>
                ))}
            </div>
          </div>
        )
      })}

      <div className="flex justify-center">
        <button
          onClick={abrirNuevo}
          className="text-3xl text-white bg-purple-600 hover:bg-purple-700 rounded-full w-14 h-14 flex items-center justify-center shadow-xl"
          title="Crear nuevo usuario"
        >
          +
        </button>
      </div>

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

            <input
              type="password"
              name="password"
              placeholder="Contraseña"
              value={formulario.password}
              onChange={handleChange}
              className="w-full border p-2 rounded"
            />

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

            <div className="flex justify-end gap-2">
              <button onClick={cerrarModal} className="text-gray-500 px-4 py-2 rounded hover:text-gray-700">
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
              >
                {editando ? 'Actualizar' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )




}
