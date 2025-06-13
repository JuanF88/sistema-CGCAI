// src/components/auditor/VistaActual.jsx
'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import VistaBienvenida from '@/components/VistaBienvenida'
import AuditoriasAsignadas from '@/components/auditor/AuditoriasAsignadas'

export default function VistaActual({ usuario, reset, setReset }) {
  const searchParams = useSearchParams()
  const [vista, setVista] = useState('bienvenida')

  useEffect(() => {
    const subvista = searchParams.get('vista')
    if (subvista) setVista(subvista)
  }, [searchParams])

  if (!usuario) return null

  return (
    <>
      {vista === 'bienvenida' && <VistaBienvenida usuario={usuario} />}
      {vista === 'asignadas' && (
        <AuditoriasAsignadas usuario={usuario} reset={reset} />
      )}
    </>
  )
}
