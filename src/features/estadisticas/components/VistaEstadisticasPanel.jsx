'use client'

import { useState } from 'react'
import { BarChart3, TrendingUp } from 'lucide-react'

import { PageHeader } from '@/components/ui/page-header'
import { ViewToggle } from '@/components/ui/view-toggle'
import { PAGE_SHELL } from '@/components/ui/tokens'
import VistaEstadisticas from '@/features/estadisticas/components/VistaEstadisticas'
import VistaPowerBI from '@/features/estadisticas/components/VistaPowerBI'

const TABS = [
  { key: 'sistema', label: 'Propias del sistema', icon: BarChart3 },
  { key: 'powerbi', label: 'Power BI', icon: TrendingUp },
]

export default function VistaEstadisticasPanel() {
  const [tab, setTab] = useState('sistema')

  return (
    <div className={PAGE_SHELL}>
      <PageHeader
        icon="📈"
        title="Estadísticas Avanzadas"
        subtitle="Panel interactivo de análisis con visualizaciones personalizables"
        actions={
          <ViewToggle options={TABS} value={tab} onChange={setTab} variant="onHeader" />
        }
      />

      {tab === 'sistema' ? <VistaEstadisticas hideMainHeader /> : <VistaPowerBI hideMainHeader />}
    </div>
  )
}
