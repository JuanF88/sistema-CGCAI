import { NextResponse } from 'next/server'
import { getAuthenticatedClient } from '@/lib/authHelper'
import { createClient } from '@supabase/supabase-js'

const GESTION_VALUES = [
  'estrategica',
  'academica',
  'investigacion',
  'administrativa',
  'cultura',
  'control',
  'otras',
]

const normalizeGestion = (g) => {
  if (!g) return null
  const v = String(g)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
  return GESTION_VALUES.includes(v) ? v : null
}

// GET /api/dependencias
// app/api/dependencias/route.js
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
    .from('dependencias')
    .select('dependencia_id, nombre, gestion')
    .order('nombre', { ascending: true })

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }
  return NextResponse.json(data ?? [])
}

// POST /api/dependencias
// body: { nombre: string }
export async function POST(req) {
  const { supabase, usuario, error } = await getAuthenticatedClient()
  
  if (error) {
    return NextResponse.json({ error }, { status: 401 })
  }

  // Solo admin puede crear dependencias
  if (usuario?.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  try {
    const { nombre, gestion } = await req.json()

    if (!nombre || typeof nombre !== 'string' || !nombre.trim()) {
      return NextResponse.json({ error: 'El nombre es requerido.' }, { status: 400 })
    }

    const gestionValue = normalizeGestion(gestion) || 'otras'

    const { data, error: dbError } = await supabase
      .from('dependencias')
      .insert({ nombre: nombre.trim(), gestion: gestionValue })
      .select('dependencia_id, nombre, gestion')
      .single()

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }
}

// PUT /api/dependencias?id=123
// body: { nombre?: string }
export async function PUT(req) {
  const { supabase, usuario, error } = await getAuthenticatedClient()
  
  if (error) {
    return NextResponse.json({ error }, { status: 401 })
  }

  // Solo admin puede actualizar dependencias
  if (usuario?.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

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

  if (body.gestion !== undefined) {
    const gestionValue = normalizeGestion(body.gestion)
    if (!gestionValue) {
      return NextResponse.json({ error: 'Gestión inválida.' }, { status: 400 })
    }
    update.gestion = gestionValue
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No hay campos para actualizar.' }, { status: 400 })
  }

  const { data, error: dbError } = await supabase
    .from('dependencias')
    .update(update)
    .eq('dependencia_id', id)
    .select('dependencia_id, nombre, gestion')
    .single()

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'Dependencia no encontrada.' }, { status: 404 })
  }

  return NextResponse.json(data)
}

// DELETE /api/dependencias?id=123
export async function DELETE(req) {
  const { supabase, usuario, error } = await getAuthenticatedClient()
  
  if (error) {
    return NextResponse.json({ error }, { status: 401 })
  }

  // Solo admin puede eliminar dependencias
  if (usuario?.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'Falta el parámetro id.' }, { status: 400 })
  }

  const { error: dbError } = await supabase
    .from('dependencias')
    .delete()
    .eq('dependencia_id', id)

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
