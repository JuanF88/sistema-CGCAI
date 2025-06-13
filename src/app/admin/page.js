'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import VistaBienvenida from '@/components/VistaBienvenida'
import VistaInformesAdmin from '@/components/admin/VistaInformesAdmin'
import VistaAdministrarUsuarios from '@/components/admin/VistaAdministrarUsuarios'
import { LogOut, FileText, UserPlus, Home } from 'lucide-react'

export default function AdminDashboard() {
  const router = useRouter()
  const [usuario, setUsuario] = useState(null)
  const [vista, setVista] = useState('bienvenida')

  useEffect(() => {
    const userData = localStorage.getItem('clienteLogueado')
    if (!userData) return router.push('/')
    setUsuario(JSON.parse(userData))
  }, [])

  const cerrarSesion = () => {
    localStorage.removeItem('clienteLogueado')
    router.push('/')
  }

  return (
    <div className="flex min-h-screen">
      {/* Panel lateral */}
      <aside className="w-64 bg-gradient-to-b from-purple-600 to-indigo-500 text-white flex flex-col p-6 shadow-2xl rounded-r-3xl animate-slide-in-left">
        <h2 className="text-2xl font-black mb-6 text-center tracking-wider drop-shadow-md uppercase">
          Panel Admin
        </h2>
        <nav className="flex-1 space-y-3">
          <button
            onClick={() => setVista('bienvenida')}
            className={`w-full flex items-center gap-2 px-4 py-2 rounded-xl transition-all font-medium text-sm whitespace-nowrap ${vista === 'bienvenida'
                ? 'bg-white/30 shadow-inner'
                : 'hover:bg-white/20 hover:translate-x-1'
              }`}
          >
            <Home size={18} /> <span className="truncate">Inicio</span>
          </button>

          <button
            onClick={() => setVista('crearInforme')}
            className={`w-full flex items-center gap-2 px-4 py-2 rounded-xl transition-all font-medium text-sm whitespace-nowrap ${vista === 'crearInforme'
                ? 'bg-white/30 shadow-inner'
                : 'hover:bg-white/20 hover:translate-x-1'
              }`}
          >
            <FileText size={18} /> <span className="truncate">Administrar Auditorías</span>
          </button>

          <button
            onClick={() => setVista('crearUsuario')}
            className={`w-full flex items-center gap-2 px-4 py-2 rounded-xl transition-all font-medium text-sm whitespace-nowrap ${vista === 'crearUsuario'
                ? 'bg-white/30 shadow-inner'
                : 'hover:bg-white/20 hover:translate-x-1'
              }`}
          >
            <UserPlus size={18} /> <span className="truncate">Administrar Usuarios</span>
          </button>

        </nav>


        <button
          onClick={cerrarSesion}
          className="mt-10 text-sm text-red-100 hover:text-red-400 flex items-center justify-center gap-2 bg-red-600/30 hover:bg-red-600/50 px-3 py-2 rounded-xl transition-all duration-300"
        >
          <LogOut size={16} /> Cerrar sesión
        </button>
      </aside>

      {/* Contenido principal */}
      <main className="flex-1 bg-gray-50 p-10">
        {vista === 'bienvenida' && usuario && <VistaBienvenida usuario={usuario} />}
        {vista === 'crearInforme' && <VistaInformesAdmin />}
        {vista === 'crearUsuario' && <VistaAdministrarUsuarios />}
        {vista === 'gestionarUsuarios' && <p className="text-lg text-gray-700">Aquí irá la gestión de usuarios</p>}
      </main>
    </div>
  )
}
