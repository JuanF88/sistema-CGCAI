// Archivo: /app/api/plan-auditoria/route.js (o route.ts si usas TypeScript)

import { getAuthenticatedClient } from '@/lib/authHelper'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET() {
  const { error } = await getAuthenticatedClient()
  
  if (error) {
    return NextResponse.json({ error }, { status: 401 })
  }

  // Usar service role para consultas (bypass RLS temporal)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data, error: dbError } = await supabase
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
