// src/components/auditor/VistaActual.jsx
'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import VistaBienvenida from '@/components/ui/VistaBienvenida'
import AuditoriasAsignadas from '@/features/auditorias/components/AuditoriasAsignadas'
import CajadeHerramientas from '@/features/herramientas/components/CajadeHerramientas'
import AuditoriasTimeline from '@/features/auditorias/components/AuditoriasTimeline'
import MiDashboardAuditor from '@/features/evaluaciones/components/MiDashboardAuditor'


// `setReset` no se usa: el shell del auditor ya alterna `reset` al entrar en
// «Caja de herramientas», y ninguna vista de aquí necesita cambiarlo.
export default function VistaActual({ usuario, reset }) {
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
      {vista === 'caja' && (
        <CajadeHerramientas usuario={usuario} reset={reset} />
      )}
      {vista === 'timeline' && (
        <AuditoriasTimeline usuario={usuario} reset={reset} />
      )}
      {vista === 'mi-dashboard' && (
        <MiDashboardAuditor usuario={usuario} />
      )}
    </>
  )
}
