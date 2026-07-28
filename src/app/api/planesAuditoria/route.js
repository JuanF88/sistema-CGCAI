// Archivo: /app/api/plan-auditoria/route.js (o route.ts si usas TypeScript)

import { requireRole } from '@/lib/api/guard'
import { AUDITORIA_READ_ROLES } from '@/lib/auth/roles'
import { NextResponse } from 'next/server'

export async function GET() {
  const guard = await requireRole(AUDITORIA_READ_ROLES)
  if (!guard.ok) return guard.response

  const { data, error: dbError } = await guard.admin
    .from('plan_auditoria')
    .select('id, enlace, dependencias(nombre)') // accede al nombre de la dependencia

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  // Formatear para devolver el nombre directamente
  const resultado = data.map(item => ({
    id: item.id,
    enlace: item.enlace,
    dependencia: item.dependencias?.nombre || 'Sin nombre'
  }))

  return NextResponse.json(resultado)
}
