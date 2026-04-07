'use client'

import { useState } from 'react'
import { BarChart3, TrendingUp } from 'lucide-react'
import VistaEstadisticas from '@/components/admin/VistaEstadisticasNew'
import VistaPowerBI from '@/components/admin/VistaPowerBI'
import styles from './CSS/VistaEstadisticasPanel.module.css'

export default function VistaEstadisticasPanel() {
  const [tab, setTab] = useState('sistema')

  const selector = (
    <div className={styles.viewToggle}>
      <button
        type="button"
        className={`${styles.viewBtn} ${tab === 'sistema' ? styles.viewBtnActive : ''}`}
        onClick={() => setTab('sistema')}
      >
        <BarChart3 size={16} />
        <span>Propias del sistema</span>
      </button>
      <button
        type="button"
        className={`${styles.viewBtn} ${tab === 'powerbi' ? styles.viewBtnActive : ''}`}
        onClick={() => setTab('powerbi')}
      >
        <TrendingUp size={16} />
        <span>Power BI</span>
      </button>
    </div>
  )

  return (
    <div className={styles.container}>
      <div className={styles.modernHeader}>
        <div className={styles.headerContent}>
          <div className={styles.headerLeft}>
            <div className={styles.headerIcon}>📈</div>
            <div>
              <h1 className={styles.headerTitle}>Estadísticas Avanzadas</h1>
              <p className={styles.headerSubtitle}>Panel interactivo de análisis con visualizaciones personalizables</p>
            </div>
          </div>

          <div className={styles.headerRight}>
            {selector}
          </div>
        </div>
      </div>

      <div className={styles.content}>
        {tab === 'sistema' ? (
          <VistaEstadisticas hideMainHeader />
        ) : (
          <VistaPowerBI hideMainHeader />
        )}
      </div>
    </div>
  )
}
