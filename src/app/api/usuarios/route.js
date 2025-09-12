import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const rol = searchParams.get('rol')

  let query = supabase
    .from('usuarios')
    .select('usuario_id, nombre, apellido, email, rol, password, estado')

  if (rol) {
    query = query.eq('rol', rol)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error al obtener usuarios:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

// POST /api/usuarios  -> crea
export async function POST(req) {
  try {
    const body = await req.json()
    const { nombre, apellido, email, password, rol, estado = 'activo' } = body

    if (!email || !rol || !password) {
      return NextResponse.json({ error: 'Email, rol y contraseña son obligatorios.' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('usuarios')
      .insert({ nombre, apellido, email, password, rol, estado })
      .select('usuario_id, nombre, apellido, email, rol, estado')
      .single()

    if (error) {
      // 23505 = unique_violation
      if (error.code === '23505') {
        // Puedes distinguir por el nombre del índice (constraint)
        const msg = error.message || ''
        if (msg.includes('usuarios_email_rol_key')) {
          return NextResponse.json({ error: 'Ya existe un usuario con ese correo y ese rol.' }, { status: 409 })
        }
        if (msg.includes('usuarios_email_password_key')) {
          return NextResponse.json({ error: 'Para ese correo, la contraseña ya está en uso. Usa una diferente.' }, { status: 409 })
        }
        return NextResponse.json({ error: 'Registro duplicado.' }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }
}

// PUT /api/usuarios?id=123  -> actualiza
export async function PUT(req) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Falta id.' }, { status: 400 })

  let body = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }

  // Solo permitimos actualizar campos existentes
  const update = {}
  ;['nombre', 'apellido', 'email', 'password', 'rol', 'estado'].forEach((k) => {
    if (k in body && body[k] !== undefined) update[k] = body[k]
  })

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No hay campos para actualizar.' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('usuarios')
    .update(update)
    .eq('usuario_id', id)
    .select('usuario_id, nombre, apellido, email, rol, estado')
    .single()

  if (error) {
    if (error.code === '23505') {
      const msg = error.message || ''
      if (msg.includes('usuarios_email_rol_key')) {
        return NextResponse.json({ error: 'Ya existe un usuario con ese correo y ese rol.' }, { status: 409 })
      }
      if (msg.includes('usuarios_email_password_key')) {
        return NextResponse.json({ error: 'Para ese correo, la contraseña ya está en uso. Usa una diferente.' }, { status: 409 })
      }
      return NextResponse.json({ error: 'Registro duplicado.' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 })

  return NextResponse.json(data)
}


export async function DELETE(request) {
  const { searchParams } = new URL(request.url)
  const id = Number(searchParams.get('id'))

  if (!id) {
    return NextResponse.json({ error: 'ID de usuario no proporcionado' }, { status: 400 })
  }

  // Si tus RLS no permiten DELETE con el cliente actual, ver opción B (admin)
  const { data, error } = await supabase
    .from('usuarios')
    .delete()
    .eq('usuario_id', id)
    .select('usuario_id')       // devuelve el registro eliminado
    .maybeSingle()

  if (error) {
    // Si hay FK, Postgres puede lanzar error de restricción
    const status = /foreign key/i.test(error.message) ? 409 : 500
    return NextResponse.json({ error: error.message }, { status })
  }

  if (!data) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
  }

  return NextResponse.json({ ok: true, deleted: data })
}
