'use client'

import { useState } from 'react'
import { BarChart3, Sparkles, TrendingUp } from 'lucide-react'

import { PageHeader } from '@/components/ui/page-header'
import { ViewToggle } from '@/components/ui/view-toggle'
import { PAGE_SHELL } from '@/components/ui/tokens'
import VistaEstadisticas from '@/features/estadisticas/components/VistaEstadisticas'
import VistaPowerBI from '@/features/estadisticas/components/VistaPowerBI'
import VistaUsoIA from '@/features/estadisticas/components/VistaUsoIA'

/**
 * «Uso IA» solo se ve desde aquí, que es panel de administración: es la
 * contabilidad de un servicio que se paga por token, no algo que el auditor
 * deba mirar mientras escribe su informe.
 */
const TABS = [
  { key: 'sistema', label: 'Propias del sistema', icon: BarChart3 },
  { key: 'powerbi', label: 'Power BI', icon: TrendingUp },
  { key: 'ia', label: 'Uso IA', icon: Sparkles },
]

const VISTAS = {
  sistema: () => <VistaEstadisticas hideMainHeader />,
  powerbi: () => <VistaPowerBI hideMainHeader />,
  ia: () => <VistaUsoIA />,
}

export default function VistaEstadisticasPanel() {
  const [tab, setTab] = useState('sistema')

  return (
    <div className={PAGE_SHELL}>
      <PageHeader
        title="Estadísticas Avanzadas"
        subtitle="Panel interactivo de análisis con visualizaciones personalizables"
        actions={
          <ViewToggle options={TABS} value={tab} onChange={setTab} variant="onHeader" />
        }
      />

      {(VISTAS[tab] ?? VISTAS.sistema)()}
    </div>
  )
}
