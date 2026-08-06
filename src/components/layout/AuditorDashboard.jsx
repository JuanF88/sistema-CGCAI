'use client'

import { useState, useEffect, Suspense } from 'react'

import AppShell, { avatarFor } from '@/components/layout/AppShell'
import { AUDITOR_NAV } from '@/components/layout/navigation'
import VistaActual from '@/components/layout/VistaActual'
import { Cargando } from '@/components/ui/loader'

// `usuario` llega ya verificado desde el Server Component de la ruta
// (`src/app/auditor/page.js`), no desde localStorage.
export default function AuditorDashboard({ usuario }) {
  const [vista, setVista] = useState('bienvenida')
  const [resetAuditorias, setResetAuditorias] = useState(false)
  const [avatarSrc, setAvatarSrc] = useState(() => avatarFor(usuario))

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

  /** Cambia de vista y refleja el cambio en la URL, sin recargar. */
  const irA = (key) => {
    setVista(key)
    // 'caja' recarga la lista de auditorías al entrar, como antes.
    if (key === 'caja') setResetAuditorias((prev) => !prev)
    window.history.pushState({}, '', `/auditor?vista=${key}`)
  }

  return (
    <AppShell
      usuario={usuario}
      nav={AUDITOR_NAV}
      vista={vista}
      onVistaChange={irA}
      titulo="Panel Auditor"
      avatarSrc={avatarSrc}
      onAvatarError={() => setAvatarSrc('/avatares/Silueta.png')}
    >
      <Suspense fallback={<Cargando mensaje="Cargando vista…" />}>
        <VistaActual
          usuario={usuario}
          reset={resetAuditorias}
          setReset={setResetAuditorias}
        />
      </Suspense>
    </AppShell>
  )
}
