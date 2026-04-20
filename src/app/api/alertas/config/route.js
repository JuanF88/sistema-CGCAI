import { NextResponse } from 'next/server'
import { getAuthenticatedClient } from '@/lib/authHelper'
import { createClient } from '@supabase/supabase-js'
import { getAlertConfigs, updateAlertConfigs } from '@/lib/alertas/auditAlertService'

function buildSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function GET() {
  const { usuario, error } = await getAuthenticatedClient()

  if (error) {
    return NextResponse.json({ error }, { status: 401 })
  }

  if (usuario?.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  try {
    const supabaseAdmin = buildSupabaseAdmin()
    const configs = await getAlertConfigs(supabaseAdmin)
    return NextResponse.json({ configs })
  } catch (err) {
    return NextResponse.json({ error: err?.message || 'No se pudo cargar la configuración.' }, { status: 500 })
  }
}

export async function PATCH(request) {
  const { usuario, error } = await getAuthenticatedClient()

  if (error) {
    return NextResponse.json({ error }, { status: 401 })
  }

  if (usuario?.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const updates = Array.isArray(body?.configs) ? body.configs : (body ? [body] : [])

    if (!updates.length) {
      return NextResponse.json({ error: 'No se recibieron configuraciones para guardar.' }, { status: 400 })
    }

    const supabaseAdmin = buildSupabaseAdmin()
    const configs = await updateAlertConfigs(supabaseAdmin, updates)

    return NextResponse.json({ ok: true, configs })
  } catch (err) {
    return NextResponse.json({ error: err?.message || 'No se pudo guardar la configuración.' }, { status: 500 })
  }
}
