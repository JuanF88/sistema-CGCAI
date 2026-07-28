'use client'

import { useState } from 'react'

import AppShell from '@/components/layout/AppShell'
import { ADMIN_NAV } from '@/components/layout/navigation'

import VistaTimeline from '@/features/auditorias/components/VistaTimeline'
import VistaInformesAdmin from '@/features/auditorias/components/VistaInformesAdmin'
import VistaAdministracionPanel from '@/features/administracion/components/VistaAdministracionPanel'
import VistaAdministrarHallazgos from '@/features/hallazgos/components/VistaAdministrarHallazgos'
import VistaEstadisticasPanel from '@/features/estadisticas/components/VistaEstadisticasPanel'
import VistaEvaluacionAuditores from '@/features/evaluaciones/components/VistaEvaluacionAuditores'
import VistaDashboardAuditores from '@/features/evaluaciones/components/VistaDashboardAuditores'
import VistaAlertasAuditoria from '@/features/alertas/components/VistaAlertasAuditoria'

// `usuario` llega ya verificado desde el Server Component de la ruta
// (`src/app/admin/page.js`), no desde localStorage.
export default function AdminDashboard({ usuario }) {
  const [vista, setVista] = useState('crearInforme')

  /** Cambia de vista y refleja el cambio en la URL, sin recargar. */
  const irA = (key) => {
    setVista(key)
    window.history.pushState({}, '', `/admin?vista=${key}`)
  }

  return (
    <AppShell
      usuario={usuario}
      nav={ADMIN_NAV}
      vista={vista}
      onVistaChange={irA}
      avatarSrc="/avatares/Silueta.png"
    >
      {vista === 'VistaTimeline' && usuario && <VistaTimeline usuario={usuario} />}
      {vista === 'crearInforme' && <VistaInformesAdmin />}
      {(vista === 'administracion' || vista === 'crearUsuario' || vista === 'adminDependencia') && (
        <VistaAdministracionPanel
          initialTab={vista === 'adminDependencia' ? 'dependencias' : 'usuarios'}
        />
      )}
      {vista === 'administrarHallazgos' && <VistaAdministrarHallazgos />}
      {vista === 'evaluacionAuditores' && <VistaEvaluacionAuditores />}
      {vista === 'dashboardAuditores' && <VistaDashboardAuditores />}
      {vista === 'alertasAuditoria' && <VistaAlertasAuditoria />}
      {(vista === 'estadisticas' || vista === 'powerbi') && <VistaEstadisticasPanel />}
    </AppShell>
  )
}
