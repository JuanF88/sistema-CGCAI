'use client'

import { useState, useEffect, Suspense, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, FileText, Home, Wrench, ClipboardList } from 'lucide-react'
import styles from '@/components/CSS/AuditorDashboard.module.css'
import VistaActual from '@/components/auditor/VistaActual'
import { SpeedInsights } from "@vercel/speed-insights/next"
import { Analytics } from "@vercel/analytics/next"

export default function AuditorDashboard() {
  const router = useRouter()
  const [usuario, setUsuario] = useState(null)
  const [vista, setVista] = useState('bienvenida')
  const [resetAuditorias, setResetAuditorias] = useState(false)

  // --- Avatar ---
  const DEFAULT_AVATAR = '/avatares/Silueta.png'
  const [avatarSrc, setAvatarSrc] = useState(DEFAULT_AVATAR)
  const [avatarTryIndex, setAvatarTryIndex] = useState(0)

  const getEmail = (u) =>
    u?.correo || u?.email || u?.mail || u?.user?.email || u?.usuario || null

  const sanitizePrefix = (s = '') => {
    // solo caracteres seguros para nombres de archivo/ruta
    return String(s).trim().toLowerCase().replace(/[^a-z0-9._-]/g, '')
  }

  const makeCandidates = useCallback((prefix) => {
    // orden de preferencia
    const exts = ['png']
    return exts.map(ext => `/avatares/${prefix}.${ext}`)
  }, [])

  // Cargar usuario desde localStorage
  useEffect(() => {
    const userData = localStorage.getItem('clienteLogueado')
    if (!userData) return router.push('/')
    const parsed = JSON.parse(userData)
    setUsuario(parsed)

    // preparar avatar
    const email = getEmail(parsed)
    const prefix = sanitizePrefix(email?.split('@')?.[0] || '')
    if (prefix) {
      const cands = makeCandidates(prefix)
      setAvatarTryIndex(0)
      setAvatarSrc(cands[0]) // primer intento
    } else {
      setAvatarSrc(DEFAULT_AVATAR)
    }
  }, [router, makeCandidates])

  // Reintento de avatar si falla la imagen
  const handleAvatarError = () => {
    // cuando falla, probamos siguiente extensión; si se acaban, usamos default
    const email = getEmail(usuario)
    const prefix = sanitizePrefix(email?.split('@')?.[0] || '')
    const cands = makeCandidates(prefix)

    const next = avatarTryIndex + 1
    if (!prefix || next >= cands.length) {
      setAvatarSrc(DEFAULT_AVATAR)
      return
    }
    setAvatarTryIndex(next)
    setAvatarSrc(cands[next])
  }

  // Lee la vista inicial desde la URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const v = params.get('vista')
    if (v) setVista(v)
  }, [])

  // Mantén la UI sincronizada con el historial del navegador
  useEffect(() => {
    const onPopState = () => {
      const params = new URLSearchParams(window.location.search)
      setVista(params.get('vista') || 'bienvenida')
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

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
          <img
            src={avatarSrc}
            alt={usuario?.nombre ? `Avatar de ${usuario.nombre}` : 'Avatar'}
            className={styles.avatar}
            onError={handleAvatarError}
          />
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
                setVista('timeline')
                window.history.pushState({}, '', '/auditor?vista=timeline')
              }}
              className={`${styles.navButton} ${vista === 'timeline' ? styles.active : ''}`}
            >
              <ClipboardList size={20} /> <span>Auditoría Interna</span>
            </button>

            {/* <button
              onClick={() => {
                setVista('asignadas')
                setResetAuditorias(prev => !prev)
                window.history.pushState({}, '', '/auditor?vista=asignadas')
              }}
              className={`${styles.navButton} ${vista === 'asignadas' ? styles.active : ''}`}
            >
              <FileText size={20} /> <span>Informes de Auditoría</span>
            </button> */}

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
