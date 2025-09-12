import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'

// GET /api/dependencias
// app/api/dependencias/route.js
export async function GET() {
  const { data, error } = await supabase
    .from('dependencias')
    .select('dependencia_id, nombre')
    .order('nombre', { ascending: true }) // 👈 orden alfabético

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data ?? [])
}

// POST /api/dependencias
// body: { nombre: string }
export async function POST(req) {
  try {
    const { nombre } = await req.json()

    if (!nombre || typeof nombre !== 'string' || !nombre.trim()) {
      return NextResponse.json({ error: 'El nombre es requerido.' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('dependencias')
      .insert({ nombre: nombre.trim() })
      .select('dependencia_id, nombre')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }
}

// PUT /api/dependencias?id=123
// body: { nombre?: string }
export async function PUT(req) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'Falta el parámetro id.' }, { status: 400 })
  }

  let body = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }

  const update = {}
  if (typeof body.nombre === 'string') {
    const trimmed = body.nombre.trim()
    if (!trimmed) {
      return NextResponse.json({ error: 'El nombre no puede estar vacío.' }, { status: 400 })
    }
    update.nombre = trimmed
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No hay campos para actualizar.' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('dependencias')
    .update(update)
    .eq('dependencia_id', id)
    .select('dependencia_id, nombre')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'Dependencia no encontrada.' }, { status: 404 })
  }

  return NextResponse.json(data)
}

// DELETE /api/dependencias?id=123
export async function DELETE(req) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'Falta el parámetro id.' }, { status: 400 })
  }

  const { error } = await supabase
    .from('dependencias')
    .delete()
    .eq('dependencia_id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
