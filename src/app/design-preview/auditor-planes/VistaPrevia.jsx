'use client'

// TEMPORAL — solo para revisar el diseño. Se elimina tras validar.
import { useState } from 'react'

import AppShell from '@/components/layout/AppShell'
import { AUDITOR_NAV } from '@/components/layout/navigation'
import VistaPlanesMejora from '@/features/auditorias/components/VistaPlanesMejora'

/** Un auditor de los de verdad, para que la cabecera no salga vacía. */
const AUDITOR = {
  nombre: 'Adriana Milena',
  apellido: 'Hurtado Montoya',
  email: 'adrianah@unicauca.edu.co',
  rol: 'auditor',
}

export default function VistaPrevia({ auditorId }) {
  const [vista, setVista] = useState('planes-mejora')
  const [avatarSrc, setAvatarSrc] = useState('/avatares/Silueta.png')

  return (
    <AppShell
      usuario={{ ...AUDITOR, usuario_id: auditorId }}
      nav={AUDITOR_NAV}
      vista={vista}
      onVistaChange={setVista}
      titulo="Panel Auditor"
      avatarSrc={avatarSrc}
      onAvatarError={() => setAvatarSrc('/avatares/Silueta.png')}
    >
      <VistaPlanesMejora usuarioId={auditorId} />
    </AppShell>
  )
}
