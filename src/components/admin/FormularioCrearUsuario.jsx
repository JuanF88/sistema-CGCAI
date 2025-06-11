'use client'

import { useState, useEffect } from 'react'

export default function FormularioCrearUsuario() {
  const [dependencias, setDependencias] = useState([])
  const [formulario, setFormulario] = useState({
    nombre: '',
    apellido: '',
    email: '',
    password: '',
    rol: '',
    dependencia_id: '',
  })

  useEffect(() => {
    const fetchDependencias = async () => {
      const res = await fetch('/api/dependencias')
      const data = await res.json()
      setDependencias(data)
    }

    fetchDependencias()
  }, [])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormulario((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const res = await fetch('/api/usuarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formulario),
    })

    if (res.ok) {
      alert('Usuario creado con éxito')
      setFormulario({
        nombre: '',
        apellido: '',
        email: '',
        password: '',
        rol: '',
        dependencia_id: '',
      })
    } else {
      const error = await res.json()
      alert('Error al crear usuario: ' + error.message)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-xl mx-auto bg-white p-6 rounded-xl shadow-xl">
      <h2 className="text-xl font-bold text-gray-700">Crear Usuario</h2>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium">Nombre</label>
          <input type="text" name="nombre" value={formulario.nombre} onChange={handleChange}
            className="w-full border p-2 rounded" required />
        </div>

        <div>
          <label className="block text-sm font-medium">Apellido</label>
          <input type="text" name="apellido" value={formulario.apellido} onChange={handleChange}
            className="w-full border p-2 rounded" required />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium">Email</label>
        <input type="email" name="email" value={formulario.email} onChange={handleChange}
          className="w-full border p-2 rounded" required />
      </div>

      <div>
        <label className="block text-sm font-medium">Contraseña</label>
        <input type="password" name="password" value={formulario.password} onChange={handleChange}
          className="w-full border p-2 rounded" required />
      </div>

      <div>
        <label className="block text-sm font-medium">Rol</label>
        <select name="rol" value={formulario.rol} onChange={handleChange}
          className="w-full border p-2 rounded" required>
          <option value="">Seleccione un rol</option>
          <option value="auditor">Auditor</option>
          <option value="coordinador">Coordinador</option>
          <option value="gestor">Gestor</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium">Dependencia</label>
        <select name="dependencia_id" value={formulario.dependencia_id} onChange={handleChange}
          className="w-full border p-2 rounded" required>
          <option value="">Seleccione una dependencia</option>
          {dependencias.map((dep) => (
            <option key={dep.dependencia_id} value={dep.dependencia_id}>
              {dep.nombre}
            </option>
          ))}
        </select>
      </div>

      <button type="submit"
        className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 transition">
        Crear Usuario
      </button>
    </form>
  )
}
