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
      validado,
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
  try {
    const raw = await req.json()
    console.log('[POST /api/informes] body recibido:', raw)

    // Si viene anidado como { nuevoInforme: {...}, ... } lo aplanamos
    const src = raw?.nuevoInforme && typeof raw.nuevoInforme === 'object'
      ? { ...raw, ...raw.nuevoInforme }  // los campos dentro de nuevoInforme prevalecen
      : raw

    const usuario_id = Number.parseInt(src?.usuario_id, 10)
    const dependencia_id = Number.parseInt(src?.dependencia_id, 10)

    const toYMD = (v) => {
      if (!v) return null
      const s = String(v)
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
      const d = new Date(s)
      return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
    }

    const fecha_auditoria = toYMD(src?.fecha_auditoria)
    const fecha_seguimiento = toYMD(src?.fecha_seguimiento)

    if (!Number.isInteger(usuario_id)) {
      return Response.json({ error: 'Falta usuario_id (numérico)' }, { status: 400 })
    }
    if (!Number.isInteger(dependencia_id)) {
      return Response.json({ error: 'Falta dependencia_id (numérico)' }, { status: 400 })
    }
    if (!fecha_auditoria) {
      return Response.json({ error: 'Falta fecha_auditoria (YYYY-MM-DD)' }, { status: 400 })
    }

    const payload = {
      usuario_id,
      dependencia_id,
      validado: src?.validado === true,
      fecha_auditoria,
      asistencia_tipo: src?.asistencia_tipo ?? 'Digital',
      auditores_acompanantes: Array.isArray(src?.auditores_acompanantes) ? src.auditores_acompanantes : [],
      objetivo: src?.objetivo ?? null,
      criterios: src?.criterios ?? null,
      conclusiones: src?.conclusiones ?? null,
      fecha_seguimiento,
      recomendaciones: src?.recomendaciones ?? null,
    }

    console.log('[POST /api/informes] payload a insertar:', payload)

    const { data, error } = await supabase
      .from('informes_auditoria')
      .insert([payload])
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
        validado,
        usuarios:usuario_id ( nombre, apellido ),
        dependencias:dependencia_id ( nombre ),
        fortalezas ( id ),
        oportunidades_mejora ( id ),
        no_conformidades ( id )
      `)

    if (error) {
      console.error('❌ Error al crear informe:', error.message)
      return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json(data, { status: 201 })
  } catch (e) {
    console.error('❌ POST /api/informes EX:', e)
    return Response.json({ error: e.message || 'Error inesperado' }, { status: 500 })
  }
}
