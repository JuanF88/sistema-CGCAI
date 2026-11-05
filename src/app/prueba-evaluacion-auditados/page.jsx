'use client'

// TEMPORAL — vista previa de la Evaluación de Auditados del auditor, con datos
// inventados. No lee ni escribe en Supabase: `supabase.from` se sustituye en
// esta página por una base en memoria. Borrar antes de hacer commit.
import { useState } from 'react'

import AppShell from '@/components/layout/AppShell'
import { ADMIN_NAV, AUDITOR_NAV } from '@/components/layout/navigation'
import { supabase } from '@/lib/supabase/client'
import VistaEvaluacionAuditados from '@/features/evaluaciones/components/VistaEvaluacionAuditados'

const LLENO = { objetivo: 'x', criterios: 'x', conclusiones: 'x', recomendaciones: 'x' }

const datos = {
  informes_auditoria: [
    {
      id: 901, fecha_auditoria: '2026-10-14', ...LLENO, usuario_id: 7, programa_auditoria_id: 1,
      dependencias: { nombre: 'División de Gestión del Talento Humano' }, usuarios: { nombre: 'Ana', apellido: 'Gómez' },
    },
    {
      id: 902, fecha_auditoria: '2026-10-21', ...LLENO, usuario_id: 7, programa_auditoria_id: null,
      dependencias: { nombre: 'Facultad de Ciencias de la Salud' }, usuarios: { nombre: 'Luis', apellido: 'Rojas' },
    },
    {
      id: 903, fecha_auditoria: '2026-09-30', ...LLENO, usuario_id: 7, programa_auditoria_id: 1,
      dependencias: { nombre: 'Vicerrectoría Administrativa' }, usuarios: { nombre: 'Ana', apellido: 'Gómez' },
    },
    {
      id: 904, fecha_auditoria: '2026-11-12', objetivo: 'x', criterios: '', conclusiones: '',
      recomendaciones: '', usuario_id: 7, programa_auditoria_id: 1,
      dependencias: { nombre: 'Vicerrectoría de Investigaciones' }, usuarios: { nombre: 'Luis', apellido: 'Rojas' },
    },
  ],
  evaluaciones_auditados: [
    {
      id: 1, informe_id: 903, lider_proceso: 'María Pérez', proceso_auditado: 'Gestión Administrativa',
      preparacion: 5, disponibilidad: 4, entrega_informacion: 4, claridad_informacion: 5,
      colaboracion: 5, aclaraciones: 4, participacion_cierre: 3, compromiso_mejora: 4,
      observaciones: 'Muy buena disposición del equipo.', updated_at: '2026-10-02T15:00:00Z',
    },
  ],
  programa_auditoria_cronograma: [
    {
      programa_id: 1, proceso: 'Gestión del Talento Humano',
      dependencias: [{ auditado: 'DIVISION DE GESTION DEL TALENTO HUMANO' }],
    },
    {
      programa_id: 1, proceso: 'Gestión Administrativa',
      dependencias: [{ auditado: 'VICERRECTORIA ADMINISTRATIVA' }],
    },
  ],
}

// Consulta encadenable mínima sobre `datos`.
if (typeof window !== 'undefined' && !window.__evaluacionDePrueba) {
  window.__evaluacionDePrueba = true
  supabase.from = (tabla) => {
    let filas = datos[tabla] ?? []
    let escrito = null
    const q = {
      select: () => q,
      order: () => q,
      in: () => q,
      maybeSingle: () => q,
      eq: (columna, valor) => {
        filas = filas.filter((f) => f[columna] === valor)
        return q
      },
      upsert: (fila) => {
        escrito = { id: Date.now(), ...fila }
        datos[tabla] = [...(datos[tabla] ?? []).filter((f) => f.informe_id !== fila.informe_id), escrito]
        return q
      },
      then: (ok, ko) =>
        new Promise((r) => setTimeout(r, 300))
          .then(() => ({ data: escrito ?? filas, error: null }))
          .then(ok, ko),
    }
    return q
  }
}

export default function VistaPreviaEvaluacionAuditados() {
  const [avatarSrc, setAvatarSrc] = useState('/avatares/Silueta.png')
  const [admin, setAdmin] = useState(false)

  return (
    <AppShell
      usuario={{ nombre: 'Auditor de prueba', usuario_id: 7, rol: 'auditor' }}
      nav={admin ? ADMIN_NAV : AUDITOR_NAV}
      vista={admin ? 'evaluacionAuditados' : 'evaluacion-auditados'}
      onVistaChange={() => {}}
      titulo={admin ? 'Panel Admin' : 'Panel Auditor'}
      avatarSrc={avatarSrc}
      onAvatarError={() => setAvatarSrc('/avatares/Silueta.png')}
    >
      <p className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
        Vista de prueba con datos inventados: nada de lo que guardes aquí llega a la base.{' '}
        <button type="button" onClick={() => setAdmin((a) => !a)} className="ml-2 cursor-pointer font-semibold underline">
          {admin ? 'Ver como auditor' : 'Ver como admin'}
        </button>
      </p>
      <VistaEvaluacionAuditados key={String(admin)} usuario={{ usuario_id: 7 }} todas={admin} />
    </AppShell>
  )
}
