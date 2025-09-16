'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, FileText, Home, Wrench } from 'lucide-react'
import styles from '@/components/CSS/AuditorDashboard.module.css'
import VistaActual from '@/components/auditor/VistaActual'
import { SpeedInsights } from "@vercel/speed-insights/next"
import { Analytics } from "@vercel/analytics/next"

export default function AuditorDashboard() {
  const router = useRouter()
  const [usuario, setUsuario] = useState(null)
  const [vista, setVista] = useState('bienvenida')
  const [resetAuditorias, setResetAuditorias] = useState(false)

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

          {/* Imagen superior */}
          <img src="/Silueta.png" alt="Avatar" className={styles.avatar} />
          {usuario && <p className={styles.username}>{usuario.nombre}</p>}

          <h2 className={styles.title}>Panel Auditor</h2>

          <nav className={styles.nav}>
            <button
              onClick={() => {
                setVista('bienvenida')
                window.history.pushState({}, '', '/auditor?vista=bienvenida')
              }}
              className={`${styles.navButton} ${vista === 'bienvenida' ? styles.active : ''}`}
            >
              <Home size={20} /> <span>Inicio</span>
            </button>

            <button
              onClick={() => {
                setVista('asignadas')
                setResetAuditorias(prev => !prev)
                window.history.pushState({}, '', '/auditor?vista=asignadas')
              }}
              className={`${styles.navButton} ${vista === 'asignadas' ? styles.active : ''}`}
            >
              <FileText size={20} /> <span>Auditorías</span>
            </button>

            <button
              onClick={() => {
                setVista('caja')
                setResetAuditorias(prev => !prev)
                window.history.pushState({}, '', '/auditor?vista=caja')
              }}
              className={`${styles.navButton} ${vista === 'caja' ? styles.active : ''}`}
            >
<Wrench size={20} /> <span>Caja de Herramientas</span>
            </button>
          </nav>
        </div>

        <div className={styles.sidebarFooter}>
          <img src="/logoBlanco.png" alt="Logo Universidad" className={styles.logoBottom} />
          <button onClick={cerrarSesion} className={styles.logout}>
            <LogOut size={16} /> Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Contenido principal */}
      <main className={styles.mainContent}>
        <Suspense fallback={<p>Cargando vista...</p>}>
          <VistaActual
            usuario={usuario}
            reset={resetAuditorias}
            setReset={setResetAuditorias}
          />
        </Suspense>
      </main>
    </div>
  )
}
