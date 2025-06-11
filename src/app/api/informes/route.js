import { supabase } from '@/lib/supabaseClient'

export async function GET() {
  const { data, error } = await supabase
    .from('informes_auditoria')
    .select(`
      id,
      dependencia_id,
      fecha_auditoria,
      usuario_id,
      dependencia_id,
      usuarios:usuario_id (
        nombre,
        apellido
      ),
      dependencias:dependencia_id (
        nombre
      )
    `)

  if (error) {
    console.error('❌ Error al obtener informes:', error.message)
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json(data)
}

export async function POST(req) {
  const body = await req.json()
  const { usuario_id, dependencia_id } = body

  const { data, error } = await supabase
    .from('informes_auditoria')
    .insert([{ usuario_id, dependencia_id }])
    .select(`
      id,
      usuario_id,
      dependencia_id,
      usuarios:usuario_id (
        nombre,
        apellido
      ),
      dependencias:dependencia_id (
        nombre
      )
    `)

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json(data, { status: 201 })
}
