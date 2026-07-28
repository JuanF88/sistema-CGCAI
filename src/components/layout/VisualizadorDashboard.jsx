'use client'

import { useState } from 'react'
import { Eye } from 'lucide-react'

import AppShell, { avatarFor } from '@/components/layout/AppShell'
import { VISUALIZADOR_NAV } from '@/components/layout/navigation'

import VistaTimeline from '@/features/auditorias/components/VistaTimeline'
import VistaInformesAdmin from '@/features/auditorias/components/VistaInformesAdmin'
import VistaEstadisticas from '@/features/estadisticas/components/VistaEstadisticas'
import VistaAdministrarHallazgos from '@/features/hallazgos/components/VistaAdministrarHallazgos'

// `usuario` llega ya verificado desde el Server Component de la ruta.
export default function VisualizadorDashboard({ usuario }) {
  const [vista, setVista] = useState('malla')
  const [avatarSrc, setAvatarSrc] = useState(() => avatarFor(usuario))

  const irA = (key) => {
    setVista(key)
    window.history.pushState({}, '', `/visualizador?vista=${key}`)
  }

  return (
    <AppShell
      usuario={usuario}
      nav={VISUALIZADOR_NAV}
      vista={vista}
      onVistaChange={irA}
      avatarSrc={avatarSrc}
      onAvatarError={() => setAvatarSrc('/avatares/Silueta.png')}
      badge={
        <p className="mx-auto mb-3 flex w-fit items-center gap-1 rounded-xl bg-emerald-500 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-white">
          <Eye className="h-3 w-3" />
          VISUALIZADOR
        </p>
      }
    >
      {vista === 'malla' && <VistaInformesAdmin soloLectura />}
      {vista === 'timeline' && usuario && <VistaTimeline usuario={usuario} soloLectura />}
      {vista === 'hallazgos' && <VistaAdministrarHallazgos soloLectura />}
      {vista === 'estadisticas' && <VistaEstadisticas soloLectura />}
    </AppShell>
  )
}
