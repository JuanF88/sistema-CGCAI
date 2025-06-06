'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import FormularioRegistro from '@/components/FormularioRegistro'
import FormularioActualizar from '@/components/FormularioActualizar'
import VistaBienvenida from '@/components/VistaBienvenida'
import { LogOut, FileText, Home } from 'lucide-react'

export default function AuditorDashboard() {
  const router = useRouter()
  const [usuario, setUsuario] = useState(null)
  const [vista, setVista] = useState('bienvenida')

  useEffect(() => {
    const userData = localStorage.getItem('clienteLogueado')
    if (!userData) return router.push('/login')
    setUsuario(JSON.parse(userData))
  }, [])

  const cerrarSesion = () => {
    localStorage.removeItem('clienteLogueado')
    router.push('/login')
  }

  return (
    <div className="flex min-h-screen">
      {/* Panel lateral */}
      <aside className="w-64 bg-gradient-to-b from-sky-600 to-emerald-500 text-white flex flex-col p-6 shadow-2xl rounded-r-3xl animate-slide-in-left">
        <h2 className="text-2xl font-black mb-6 text-center tracking-wider drop-shadow-md uppercase">
          Panel Auditor
        </h2>

        <nav className="flex-1 space-y-3">
          <button
            onClick={() => setVista('bienvenida')}
            className={`w-full flex items-center gap-3 px-4 py-2 rounded-xl transition-all font-medium ${
              vista === 'bienvenida'
                ? 'bg-white/30 shadow-inner'
                : 'hover:bg-white/20 hover:translate-x-1'
            }`}
          >
            <Home size={18} /> Inicio
          </button>

          <button
            onClick={() => setVista('registro')}
            className={`w-full flex items-center gap-3 px-4 py-2 rounded-xl transition-all font-medium ${
              vista === 'registro'
                ? 'bg-white/30 shadow-inner'
                : 'hover:bg-white/20 hover:translate-x-1'
            }`}
          >
            <FileText size={18} /> Registrar Informe
          </button>

           <button
            onClick={() => setVista('actualizar')}
            className={`w-full flex items-center gap-3 px-4 py-2 rounded-xl transition-all font-medium ${
              vista === 'actualizar'
                ? 'bg-white/30 shadow-inner'
                : 'hover:bg-white/20 hover:translate-x-1'
            }`}
          >
            <FileText size={18} /> Actualizar Informe
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
        {vista === 'registro' && usuario && <FormularioRegistro usuario={usuario} />}
        {vista === 'actualizar' && usuario && <FormularioActualizar usuario={usuario} />}

      </main>
    </div>
  )
}
