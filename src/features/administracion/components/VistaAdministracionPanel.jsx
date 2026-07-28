'use client'

import { useEffect, useState } from 'react'
import { Building, UserPlus } from 'lucide-react'

import { ViewToggle } from '@/components/ui/view-toggle'
import VistaAdministrarUsuarios from '@/features/usuarios/components/VistaAdministrarUsuarios'
import VistaAdministrarDependencias from '@/features/dependencias/components/VistaAdministrarDependencias'

const TABS = [
  { key: 'usuarios', label: 'Usuarios', icon: UserPlus },
  { key: 'dependencias', label: 'Dependencias', icon: Building },
]

/**
 * Panel que compone las dos pantallas de administración.
 * El selector se le pasa a la pantalla activa como `headerActions`, así que
 * aparece dentro del header con gradiente: de ahí la variante `onHeader`.
 */
export default function VistaAdministracionPanel({ initialTab = 'usuarios' }) {
  const [tab, setTab] = useState(initialTab === 'dependencias' ? 'dependencias' : 'usuarios')

  useEffect(() => {
    setTab(initialTab === 'dependencias' ? 'dependencias' : 'usuarios')
  }, [initialTab])

  const selector = (
    <ViewToggle options={TABS} value={tab} onChange={setTab} variant="onHeader" />
  )

  return tab === 'usuarios' ? (
    <VistaAdministrarUsuarios headerActions={selector} />
  ) : (
    <VistaAdministrarDependencias headerActions={selector} />
  )
}
