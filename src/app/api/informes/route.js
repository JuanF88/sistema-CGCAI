import { supabase } from '@/lib/supabaseClient'

export async function GET() {
  const { data, error } = await supabase
    .from('informes_auditoria')
    .select(`
      id,
      objetivo,
      criterios,
      conclusiones,
      fecha_auditoria,
      asistencia_tipo,
      fecha_seguimiento,
      recomendaciones,
      auditores_acompanantes,
      usuario_id,
      dependencia_id,
      usuarios:usuario_id (
        nombre,
        apellido
      ),
      dependencias:dependencia_id (
        nombre
      ),
      fortalezas ( id ),
      oportunidades_mejora ( id ),
      no_conformidades ( id )
    `)

  if (error) {
    console.error('❌ Error al obtener informes:', error.message)
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json(data)
}

export async function DELETE(req) {
  const { id } = await req.json()

  if (!id) {
    return Response.json({ error: 'Falta el ID del informe a eliminar' }, { status: 400 })
  }

  const { error } = await supabase
    .from('informes_auditoria')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('❌ Error al eliminar informe:', error.message)
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ mensaje: 'Informe eliminado correctamente' })
}


export async function POST(req) {
  const body = await req.json()
  const { usuario_id, dependencia_id } = body

  if (!usuario_id || !dependencia_id) {
    return Response.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

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
      ),
      fortalezas ( id ),
      oportunidades_mejora ( id ),
      no_conformidades ( id )
    `)

  if (error) {
    console.error('❌ Error al crear informe:', error.message)
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json(data, { status: 201 })
}
