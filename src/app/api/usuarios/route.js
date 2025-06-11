import { supabase } from '@/lib/supabaseClient'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const rol = searchParams.get('rol')

  let query = supabase
    .from('usuarios')
    .select('usuario_id, nombre, apellido, email, rol, password')

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

export async function PUT(request) {
  const { searchParams } = new URL(request.url)
  const id = parseInt(searchParams.get('id'))

  if (!id) {
    return NextResponse.json({ error: 'ID de usuario no proporcionado' }, { status: 400 })
  }

  const body = await request.json()
  const { nombre, apellido, email, password, rol } = body

  console.log('🆔 ID recibido:', id)
  console.log('📝 Intentando actualizar usuario:', body)

  const { error: errorUpdate } = await supabase
    .from('usuarios')
    .update({ nombre, apellido, email, password, rol })
    .eq('usuario_id', id)

  if (errorUpdate) {
    console.error('❌ Error al actualizar usuario:', errorUpdate)
    return NextResponse.json({ error: errorUpdate.message }, { status: 500 })
  }

  const { data: usuarioFinal, error: errorFinal } = await supabase
    .from('usuarios')
    .select('*')
    .eq('usuario_id', id)
    .single()

  if (errorFinal) {
    console.error('⚠️ Error al obtener usuario actualizado:', errorFinal)
    return NextResponse.json({ error: errorFinal.message }, { status: 500 })
  }

  console.log('✅ Usuario actualizado o sin cambios:', usuarioFinal)
  return NextResponse.json(usuarioFinal)
}

export async function POST(request) {
  const body = await request.json()
  const { nombre, apellido, email, password, rol } = body

  if (!nombre || !email || !password || !rol) {
    return NextResponse.json(
      { error: 'Faltan campos obligatorios' },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('usuarios')
    .insert([{ nombre, apellido, email, password, rol }])
    .select()
    .single()

  if (error) {
    console.error('❌ Error al crear usuario:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  console.log('✅ Usuario creado:', data)
  return NextResponse.json(data)
}
