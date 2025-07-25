// Archivo: /app/api/plan-auditoria/route.js (o route.ts si usas TypeScript)

import { supabase } from '@/lib/supabaseClient'
import { NextResponse } from 'next/server'

export async function GET() {
  const { data, error } = await supabase
    .from('plan_auditoria')
    .select('id, enlace, dependencias(nombre)') // accede al nombre de la dependencia

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Formatear para devolver el nombre directamente
  const resultado = data.map(item => ({
    id: item.id,
    enlace: item.enlace,
    dependencia: item.dependencias?.nombre || 'Sin nombre'
  }))

  return NextResponse.json(resultado)
}
