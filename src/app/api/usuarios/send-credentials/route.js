import { NextResponse } from 'next/server'
import { getAuthenticatedClient } from '@/lib/authHelper'
import { createClient } from '@supabase/supabase-js'
import { sendCredentialsEmail } from '@/lib/notifications'

export async function POST(request) {
  const { usuario, error } = await getAuthenticatedClient()

  if (error) {
    return NextResponse.json({ error }, { status: 401 })
  }

  if (usuario?.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { usuario_id } = body || {}

    if (!usuario_id) {
      return NextResponse.json({ error: 'usuario_id es obligatorio.' }, { status: 400 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: userData, error: dbError } = await supabaseAdmin
      .from('usuarios')
      .select('usuario_id, nombre, apellido, email, password, estado')
      .eq('usuario_id', usuario_id)
      .maybeSingle()

    if (dbError) {
      return NextResponse.json({ error: dbError.message || 'No se pudo consultar el usuario.' }, { status: 500 })
    }

    if (!userData) {
      return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 })
    }

    if ((userData.estado || '').toLowerCase() !== 'activo') {
      return NextResponse.json({ error: 'No se pueden enviar credenciales a usuarios inactivos.' }, { status: 400 })
    }

    if (!userData.email || !userData.password) {
      return NextResponse.json({ error: 'El usuario no tiene credenciales completas para enviar.' }, { status: 400 })
    }

    const result = await sendCredentialsEmail({
      nombre: userData.nombre || '',
      apellido: userData.apellido || '',
      email: userData.email,
      password: userData.password,
    })

    if (result.ok) {
      return NextResponse.json({ ok: true, notification: result })
    }

    return NextResponse.json({ ok: false, notification: result }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ error: err?.message || 'Error interno del servidor.' }, { status: 500 })
  }
}
