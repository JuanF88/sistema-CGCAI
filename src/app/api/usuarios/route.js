import { NextResponse } from 'next/server'
import { getAuthenticatedClient } from '@/lib/authHelper'
import { createClient } from '@supabase/supabase-js'

export async function GET(request) {
  const { usuario, error } = await getAuthenticatedClient()
  
  if (error) {
    return NextResponse.json({ error }, { status: 401 })
  }

  // Solo admins pueden listar usuarios
  if (usuario?.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  // Usar service role para consultas (bypass RLS temporal)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { searchParams } = new URL(request.url)
  const rol = searchParams.get('rol')

  let query = supabase
    .from('usuarios')
    .select('usuario_id, nombre, apellido, email, rol, password, estado, auth_user_id')

  if (rol) {
    query = query.eq('rol', rol)
  }

  const { data, error: dbError } = await query

  if (dbError) {
    console.error('Error al obtener usuarios:', dbError.message)
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

// POST /api/usuarios  -> crea (solo admin)
export async function POST(req) {
  const { usuario, error } = await getAuthenticatedClient()
  
  if (error) {
    return NextResponse.json({ error }, { status: 401 })
  }

  // Solo admins pueden crear usuarios
  if (usuario?.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  // Usar service role para insertar (bypass RLS)
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  try {
    const body = await req.json()
    const { nombre, apellido, email, password, rol, estado = 'activo' } = body

    if (!email || !rol || !password) {
      return NextResponse.json({ error: 'Email, rol y contraseña son obligatorios.' }, { status: 400 })
    }

    // PASO 1: Crear usuario en Supabase Auth
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Confirmar email automáticamente
    })

    if (authError) {
      console.error('Error al crear usuario en Auth:', authError)
      if (authError.message.includes('already registered')) {
        return NextResponse.json({ error: 'Este correo ya está registrado en el sistema.' }, { status: 409 })
      }
      return NextResponse.json({ error: authError.message }, { status: 500 })
    }

    // PASO 2: Insertar en tabla usuarios con el auth_user_id
    const { data, error: dbError } = await supabaseAdmin
      .from('usuarios')
      .insert({ 
        nombre, 
        apellido, 
        email, 
        password, 
        rol, 
        estado,
        auth_user_id: authUser.user.id // ← CLAVE: vincular con Supabase Auth
      })
      .select('usuario_id, nombre, apellido, email, rol, estado, auth_user_id')
      .single()

    if (dbError) {
      // Si falla la inserción en la tabla, eliminar el usuario de Auth para mantener consistencia
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id)
      
      // 23505 = unique_violation
      if (dbError.code === '23505') {
        const msg = dbError.message || ''
        if (msg.includes('usuarios_email_rol_key')) {
          return NextResponse.json({ error: 'Ya existe un usuario con ese correo y ese rol.' }, { status: 409 })
        }
        if (msg.includes('usuarios_email_password_key')) {
          return NextResponse.json({ error: 'Para ese correo, la contraseña ya está en uso. Usa una diferente.' }, { status: 409 })
        }
        return NextResponse.json({ error: 'Registro duplicado.' }, { status: 409 })
      }
      return NextResponse.json({ error: dbError.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Error en POST /api/usuarios:', error)
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 })
  }
}

// PUT /api/usuarios?id=123  -> actualiza (solo admin)
export async function PUT(req) {
  const { usuario, error: authError } = await getAuthenticatedClient()
  
  if (authError) {
    return NextResponse.json({ error: authError }, { status: 401 })
  }

  // Solo admins pueden actualizar usuarios
  if (usuario?.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  // Usar service role para actualizar (bypass RLS)
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

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

  const { data, error } = await supabaseAdmin
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
  const { usuario, error: authError } = await getAuthenticatedClient()
  
  if (authError) {
    return NextResponse.json({ error: authError }, { status: 401 })
  }

  // Solo admins pueden eliminar usuarios
  if (usuario?.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  // Usar service role para eliminar (bypass RLS)
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { searchParams } = new URL(request.url)
  const id = Number(searchParams.get('id'))

  if (!id) {
    return NextResponse.json({ error: 'ID de usuario no proporcionado' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('usuarios')
    .delete()
    .eq('usuario_id', id)
    .select('usuario_id')
    .maybeSingle()

  if (error) {
    const status = /foreign key/i.test(error.message) ? 409 : 500
    return NextResponse.json({ error: error.message }, { status })
  }

  if (!data) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
  }

  return NextResponse.json({ ok: true, deleted: data })
}
