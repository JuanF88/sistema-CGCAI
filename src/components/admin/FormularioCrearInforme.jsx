'use client'

import { useEffect, useState } from 'react'

export default function VistaInformesAdmin() {
  const [informes, setInformes] = useState([])
  const [auditores, setAuditores] = useState([])
  const [mostrarModal, setMostrarModal] = useState(false)
  const [nuevoInforme, setNuevoInforme] = useState({ programa: '', usuario_id: '' })
  
  useEffect(() => {
    const fetchData = async () => {
      const [resInformes, resAuditores] = await Promise.all([
        fetch('/api/informes'),
        fetch('/api/usuarios?rol=auditor')
      ])
      const [dataInformes, dataAuditores] = await Promise.all([
        resInformes.json(),
        resAuditores.json()
      ])
      setInformes(dataInformes || [])
      setAuditores(dataAuditores || [])
    }
    fetchData()
  }, [])

  const handleChange = (e) => {
    const { name, value } = e.target
    setNuevoInforme((prev) => ({ ...prev, [name]: value }))
  }

  const crearInforme = async () => {
    const res = await fetch('/api/informes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nuevoInforme),
    })

    if (res.ok) {
      const creado = await res.json()
      setInformes((prev) => [...prev, creado[0]])
      setNuevoInforme({ programa: '', usuario_id: '' })
      setMostrarModal(false)
    } else {
      alert('Error al crear informe')
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-700">Informes de Auditoría</h2>

      {/* Lista de informes */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {informes.map((informe) => (
          <div key={informe.id} className="bg-white p-4 rounded-lg shadow">
            <p className="text-sm text-gray-500">ID: {informe.id}</p>
            <p className="text-lg font-semibold text-gray-800">Programa: {informe.programa || 'N/A'}</p>
            <p className="text-sm text-gray-600">
              Auditor: {informe.usuario_id ? `#${informe.usuario_id}` : 'No asignado'}
            </p>
          </div>
        ))}
      </div>

      {/* Botón para agregar nuevo */}
      <div className="flex justify-center">
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
            <h3 className="text-xl font-bold text-gray-700">Nuevo Informe</h3>

            <div>
              <label className="block text-sm font-medium">Programa</label>
              <input
                type="text"
                name="programa"
                value={nuevoInforme.programa}
                onChange={handleChange}
                className="w-full border p-2 rounded"
              />
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
    </div>
  )
}
