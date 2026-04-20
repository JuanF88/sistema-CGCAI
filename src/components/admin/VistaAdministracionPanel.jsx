'use client'

import { useEffect, useState } from 'react'
import { Building, UserPlus } from 'lucide-react'
import VistaAdministrarUsuarios from '@/components/admin/VistaAdministrarUsuarios'
import VistaAdministrarDependencias from '@/components/admin/VistaAdministrarDependencias'
import styles from './CSS/VistaAdministracionPanel.module.css'

export default function VistaAdministracionPanel({ initialTab = 'usuarios' }) {
  const [tab, setTab] = useState(initialTab === 'dependencias' ? 'dependencias' : 'usuarios')

  useEffect(() => {
    setTab(initialTab === 'dependencias' ? 'dependencias' : 'usuarios')
  }, [initialTab])

  const toggleControl = (
    <div className={styles.viewToggle}>
      <button
        type="button"
        className={`${styles.viewBtn} ${tab === 'usuarios' ? styles.viewBtnActive : ''}`}
        onClick={() => setTab('usuarios')}
      >
        <UserPlus size={16} />
        <span>Usuarios</span>
      </button>
      <button
        type="button"
        className={`${styles.viewBtn} ${tab === 'dependencias' ? styles.viewBtnActive : ''}`}
        onClick={() => setTab('dependencias')}
      >
        <Building size={16} />
        <span>Dependencias</span>
      </button>
    </div>
  )

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        {tab === 'usuarios' ? (
          <VistaAdministrarUsuarios headerActions={toggleControl} />
        ) : (
          <VistaAdministrarDependencias headerActions={toggleControl} />
        )}
      </div>
    </div>
  )
}
