'use client'

import { useState, useEffect } from 'react'
import VistaBienvenida from '@/components/VistaBienvenida'
import AuditoriasAsignadas from '@/components/auditor/AuditoriasAsignadas'
import { useRouter, useSearchParams } from 'next/navigation'
import { LogOut, FileText, Home } from 'lucide-react'
import styles from '@/components/CSS/AuditorDashboard.module.css'

export default function AuditorDashboard() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [usuario, setUsuario] = useState(null)
  const [vista, setVista] = useState('bienvenida')
  const [resetAuditorias, setResetAuditorias] = useState(false)

  useEffect(() => {
    const userData = localStorage.getItem('clienteLogueado')
    if (!userData) return router.push('/')
    setUsuario(JSON.parse(userData))

    const subvista = searchParams.get('vista')
    if (subvista) {
      setVista(subvista)
    }
  }, [searchParams])

  const cerrarSesion = () => {
    localStorage.removeItem('clienteLogueado')
    router.push('/')
  }

  return (
    <div className={styles.dashboardContainer}>
      {/* Panel lateral */}
      <aside className={styles.sidebar}>

        <div className={styles.sidebarContent}>
                          <img src="/logo-universidad.png" alt="Logo Universidad" className={styles.logo} />

          <h2 className={styles.title}>Panel Auditor</h2>

          <nav className={styles.nav}>
            <button
              onClick={() => setVista('bienvenida')}
              className={`${styles.navButton} ${
                vista === 'bienvenida' ? styles.active : ''
              }`}
            >
              <Home size={18} /> <span>Inicio</span>
            </button>

            <button
              onClick={() => {
                setVista('asignadas')
                setResetAuditorias(prev => !prev)
              }}
              className={`${styles.navButton} ${
                vista === 'asignadas' ? styles.active : ''
              }`}
            >
              <FileText size={18} /> <span>Auditorías asignadas</span>
            </button>
            
          </nav>
          
        </div>
          
        <button onClick={cerrarSesion} className={styles.logout}>
          
          <LogOut size={16} /> Cerrar sesión
        </button>
      </aside>

      {/* Contenido principal */}
      <main className={styles.mainContent}>
        {vista === 'bienvenida' && usuario && (
          <VistaBienvenida usuario={usuario} />
        )}
        {vista === 'asignadas' && usuario && (
          <AuditoriasAsignadas usuario={usuario} reset={resetAuditorias} />
        )}
      </main>
    </div>
  )
}
