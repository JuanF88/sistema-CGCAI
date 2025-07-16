'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, FileText, UserPlus, Home} from 'lucide-react'
import { Lightbulb } from 'lucide-react'
import { BarChart } from 'lucide-react'
import { SpeedInsights } from "@vercel/speed-insights/next"
import { Analytics } from "@vercel/analytics/next"

import styles from '@/components/CSS/AdminDashboard.module.css'


import VistaBienvenida from '@/components/VistaBienvenida'
import VistaInformesAdmin from '@/components/admin/VistaInformesAdmin'
import VistaAdministrarUsuarios from '@/components/admin/VistaAdministrarUsuarios'
import VistaAdministrarHallazgos from '@/components/admin/VistaAdministrarHallazgos'
import VistaEstadisticas from '@/components/admin/VistaEstadisticas'


export default function AdminDashboard() {
  const router = useRouter()
  const [usuario, setUsuario] = useState(null)
  const [vista, setVista] = useState('bienvenida')

  useEffect(() => {
    const userData = localStorage.getItem('clienteLogueado')
    if (!userData) return router.push('/')
    setUsuario(JSON.parse(userData))
  }, [router])

  const cerrarSesion = () => {
    localStorage.removeItem('clienteLogueado')
    router.push('/')
  }

  return (
    <div className={styles.dashboardContainer}>
      <SpeedInsights />
      <Analytics />
      {/* Panel lateral */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarContent}>
          <img src="/logo-universidad.png" alt="Logo Universidad" className={styles.logo} />
          <h2 className={styles.title}>Panel Admin</h2>

          <nav className={styles.nav}>
            <button
              onClick={() => {
                setVista('bienvenida')
                window.history.pushState({}, '', '/admin?vista=bienvenida')
              }}
              className={`${styles.navButton} ${vista === 'bienvenida' ? styles.active : ''}`}
            >
              <Home size={18} /> <span>Inicio</span>
            </button>


            <button
              onClick={() => {
                setVista('crearInforme')
                window.history.pushState({}, '', '/admin?vista=crearInforme')
              }}
              className={`${styles.navButton} ${vista === 'crearInforme' ? styles.active : ''}`}
            >
              <FileText size={18} /> <span>Administrar Auditorías</span>
            </button>


            <button
              onClick={() => {
                setVista('crearUsuario')
                window.history.pushState({}, '', '/admin?vista=crearUsuario')
              }}
              className={`${styles.navButton} ${vista === 'crearUsuario' ? styles.active : ''}`}
            >
              <UserPlus size={18} /> <span>Administrar Usuarios</span>
            </button>

            <button
              onClick={() => {
                setVista('administrarHallazgos')
                window.history.pushState({}, '', '/admin?vista=administrarHallazgos')
              }}
              className={`${styles.navButton} ${vista === 'administrarHallazgos' ? styles.active : ''}`}
            >
              <Lightbulb size={18} /> <span>Reporte de Hallazgos</span>
            </button>

            <button
              onClick={() => {
                setVista('estadisticas')
                window.history.pushState({}, '', '/admin?vista=estadisticas')
              }}
              className={`${styles.navButton} ${vista === 'estadisticas' ? styles.active : ''}`}
            >
              <BarChart size={18} /> <span>Estadísticas</span>
            </button>


        </nav>

        </div>

        <button
          onClick={cerrarSesion}
          className="mt-10 text-sm text-red-100 hover:text-red-400 flex items-center justify-center gap-2 bg-red-600/30 hover:bg-red-600/50 px-3 py-2 rounded-xl transition-all duration-300"
        >
          <LogOut size={16} /> Cerrar sesión
        </button>
      </aside>

      {/* Contenido principal */}
<main className={styles.mainContent}>
  {vista === 'bienvenida' && usuario && <VistaBienvenida usuario={usuario} />}
  {vista === 'crearInforme' && <VistaInformesAdmin />}
  {vista === 'crearUsuario' && <VistaAdministrarUsuarios />}
  {vista === 'administrarHallazgos' && <VistaAdministrarHallazgos />}
  {vista === 'estadisticas' && <VistaEstadisticas />}
  {vista === 'gestionarUsuarios' && (
    <p className="text-lg text-gray-700">Aquí irá la gestión de usuarios</p>
  )}
</main>

    </div>
  )

}



