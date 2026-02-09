'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, FileText, UserPlus, Home, TrendingUp, Award} from 'lucide-react'
import { Lightbulb } from 'lucide-react'
import { Building } from 'lucide-react'   
import { BarChart } from 'lucide-react'
import { SpeedInsights } from "@vercel/speed-insights/next"
import { Analytics } from "@vercel/analytics/next"

import styles from '@/components/admin/CSS/AdminDashboard.module.css'

import VistaTimeline from '@/components/admin/VistaTimeline'
import VistaInformesAdmin from '@/components/admin/VistaInformesAdmin'
import VistaAdministrarUsuarios from '@/components/admin/VistaAdministrarUsuarios'
import VistaAdministrarDependencias from '@/components/admin/VistaAdministrarDependencias'
import VistaAdministrarHallazgos from '@/components/admin/VistaAdministrarHallazgos'
import VistaEstadisticas from '@/components/admin/VistaEstadisticasNew'
import VistaPowerBI from '@/components/admin/VistaPowerBI'
import VistaEvaluacionAuditores from '@/components/admin/VistaEvaluacionAuditores'

export default function AdminDashboard() {
  const router = useRouter()
  const [usuario, setUsuario] = useState(null)
  const [vista, setVista] = useState('crearInforme')

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

          <img src="avatares/Silueta.png" alt="Avatar" className={styles.avatar} />
          {usuario && <p className={styles.username}>{usuario.nombre}</p>}
          <nav className={styles.nav}>

            {<button
              onClick={() => {
                setVista('crearInforme')
                window.history.pushState({}, '', '/admin?vista=crearInforme')
              }}
              className={`${styles.navButton} ${vista === 'crearInforme' ? styles.active : ''}`}
            >
              <FileText size={18} /> <span>Inicio </span>
            </button>}
            
            <button
              onClick={() => {
                setVista('VistaTimeline')
                window.history.pushState({}, '', '/admin?vista=VistaTimeline')
              }}
              className={`${styles.navButton} ${vista === 'VistaTimeline' ? styles.active : ''}`}
            >
              <Home className={styles.navIconSmall} size={18} />
              <span className={styles.navTextSmall}>Administrar Auditorías</span>
            </button>

            <button
              onClick={() => {
                setVista('crearUsuario')
                window.history.pushState({}, '', '/admin?vista=crearUsuario')
              }}
              className={`${styles.navButton} ${vista === 'crearUsuario' ? styles.active : ''}`}
            >

              <UserPlus  className={styles.navIconSmall} size={18} /> <span className={styles.navTextSmall}>Administrar Usuarios</span>
            </button>

            <button
              onClick={() => {
                setVista('adminDependencia')
                window.history.pushState({}, '', '/admin?vista=adminDependencia')
              }}
              className={`${styles.navButton} ${vista === 'adminDependencia' ? styles.active : ''}`}
            >
              <Building className={styles.navIconSmall} size={18} /> <span className={styles.navTextSmall}>Administrar Dependencia</span>
            </button>

            <button
              onClick={() => {
                setVista('administrarHallazgos')
                window.history.pushState({}, '', '/admin?vista=administrarHallazgos')
              }}
              className={`${styles.navButton} ${vista === 'administrarHallazgos' ? styles.active : ''}`}
            >
              <Lightbulb className={styles.navIconSmall} size={18} /> <span className={styles.navTextSmall}> Reporte de Hallazgos</span>
            </button>

            {/* <button
              onClick={() => {
                setVista('evaluacionAuditores')
                window.history.pushState({}, '', '/admin?vista=evaluacionAuditores')
              }}
              className={`${styles.navButton} ${vista === 'evaluacionAuditores' ? styles.active : ''}`}
            >
              <Award className={styles.navIconSmall} size={18} /> <span className={styles.navTextSmall}>Evaluación de Auditores</span>
            </button> */}

            <button
              onClick={() => {
                setVista('estadisticas')
                window.history.pushState({}, '', '/admin?vista=estadisticas')
              }}
              className={`${styles.navButton} ${vista === 'estadisticas' ? styles.active : ''}`}
            >
              <BarChart className={styles.navIconSmall} size={18} /> <span className={styles.navTextSmall}>Estadísticas</span>
            </button>

            <button
              onClick={() => {
                setVista('powerbi')
                window.history.pushState({}, '', '/admin?vista=powerbi')
              }}
              className={`${styles.navButton} ${vista === 'powerbi' ? styles.active : ''}`}
            >
              <TrendingUp className={styles.navIconSmall} size={18} /> <span className={styles.navTextSmall}>Estadísticas Power BI</span>
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
  {vista === 'VistaTimeline' && usuario && <VistaTimeline usuario={usuario} />}
  {vista === 'crearInforme' && <VistaInformesAdmin />}
  {vista === 'crearUsuario' && <VistaAdministrarUsuarios />}
  {vista === 'adminDependencia' && <VistaAdministrarDependencias />}
  {vista === 'administrarHallazgos' && <VistaAdministrarHallazgos />}
  {vista === 'evaluacionAuditores' && <VistaEvaluacionAuditores />}
  {vista === 'estadisticas' && <VistaEstadisticas />}
  {vista === 'powerbi' && <VistaPowerBI />}
  {vista === 'gestionarUsuarios' && (
    <p className="text-lg text-gray-700">Aquí irá la gestión de usuarios</p>
  )}
</main>

    </div>
  )

}



