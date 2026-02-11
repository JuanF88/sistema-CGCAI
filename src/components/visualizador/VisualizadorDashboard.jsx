'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, FileText, Home, Eye, BarChart } from 'lucide-react'
import { SpeedInsights } from "@vercel/speed-insights/next"
import { Analytics } from "@vercel/analytics/next"

import styles from '@/components/admin/CSS/AdminDashboard.module.css'

import VistaTimeline from '@/components/admin/VistaTimeline'
import VistaInformesAdmin from '@/components/admin/VistaInformesAdmin'
import VistaEstadisticas from '@/components/admin/VistaEstadisticasNew'
import VistaAdministrarHallazgos from '@/components/admin/VistaAdministrarHallazgos'

export default function VisualizadorDashboard() {
  const router = useRouter()
  const [usuario, setUsuario] = useState(null)
  const [vista, setVista] = useState('malla')

  // --- Avatar ---
  const DEFAULT_AVATAR = '/avatares/Silueta.png'
  const [avatarSrc, setAvatarSrc] = useState(DEFAULT_AVATAR)

  const getEmail = (u) =>
    u?.correo || u?.email || u?.mail || u?.user?.email || u?.usuario || null

  const sanitizePrefix = (s = '') => {
    // solo caracteres seguros para nombres de archivo/ruta
    return String(s).trim().toLowerCase().replace(/[^a-z0-9._-]/g, '')
  }

  useEffect(() => {
    const userData = localStorage.getItem('clienteLogueado')
    if (!userData) return router.push('/')
    const parsed = JSON.parse(userData)
    setUsuario(parsed)

    // preparar avatar
    const email = getEmail(parsed)
    const prefix = sanitizePrefix(email?.split('@')?.[0] || '')
    if (prefix) {
      setAvatarSrc(`/avatares/${prefix}.png`)
    } else {
      setAvatarSrc(DEFAULT_AVATAR)
    }
  }, [router])

  // Reintento de avatar si falla la imagen
  const handleAvatarError = () => {
    setAvatarSrc(DEFAULT_AVATAR)
  }

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

          <img 
            src={avatarSrc} 
            alt="Avatar" 
            className={styles.avatar}
            onError={handleAvatarError}
          />
          {usuario && <p className={styles.username}>{usuario.nombre}</p>}
          <p className={styles.rolTag} style={{
            backgroundColor: '#10b981', 
            color: 'white', 
            fontSize: '11px', 
            padding: '4px 10px', 
            borderRadius: '12px',
            textAlign: 'center',
            marginTop: '-8px',
            marginBottom: '12px',
            fontWeight: '600',
            letterSpacing: '0.3px'
          }}>
            <Eye size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
            VISUALIZADOR
          </p>

          <nav className={styles.nav}>

            <button
              onClick={() => {
                setVista('malla')
                window.history.pushState({}, '', '/visualizador?vista=malla')
              }}
              className={`${styles.navButton} ${vista === 'malla' ? styles.active : ''}`}
            >
              <FileText size={18} /> <span>Malla de Control</span>
            </button>
            
            <button
              onClick={() => {
                setVista('timeline')
                window.history.pushState({}, '', '/visualizador?vista=timeline')
              }}
              className={`${styles.navButton} ${vista === 'timeline' ? styles.active : ''}`}
            >
              <Home className={styles.navIconSmall} size={18} />
              <span className={styles.navTextSmall}>Auditorías</span>
            </button>

            <button
              onClick={() => {
                setVista('hallazgos')
                window.history.pushState({}, '', '/visualizador?vista=hallazgos')
              }}
              className={`${styles.navButton} ${vista === 'hallazgos' ? styles.active : ''}`}
            >
              <Eye className={styles.navIconSmall} size={18} /> 
              <span className={styles.navTextSmall}>Hallazgos</span>
            </button>

            <button
              onClick={() => {
                setVista('estadisticas')
                window.history.pushState({}, '', '/visualizador?vista=estadisticas')
              }}
              className={`${styles.navButton} ${vista === 'estadisticas' ? styles.active : ''}`}
            >
              <BarChart className={styles.navIconSmall} size={18} /> 
              <span className={styles.navTextSmall}>Estadísticas</span>
            </button>

        </nav>

        </div>

        <div className={styles.sidebarFooter}>
          <div className={styles.logosContainer}>
            <img src="/logoBlanco.png" alt="Logo Universidad" className={styles.logoBottom} />
            <img src="/logosIcontec.png" alt="Logo Icontec" className={styles.logoBottom} />
          </div>
          <button onClick={cerrarSesion} className={styles.logout}>
            <LogOut size={16} /> Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Contenido principal */}
      <main className={styles.mainContent}>
        {vista === 'malla' && <VistaInformesAdmin soloLectura={true} />}
        {vista === 'timeline' && usuario && <VistaTimeline usuario={usuario} soloLectura={true} />}
        {vista === 'hallazgos' && <VistaAdministrarHallazgos soloLectura={true} />}
        {vista === 'estadisticas' && <VistaEstadisticas soloLectura={true} />}
      </main>

    </div>
  )

}
