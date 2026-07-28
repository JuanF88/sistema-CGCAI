import { requireRole } from '@/lib/api/guard'
import { AUDITORIA_READ_ROLES } from '@/lib/auth/roles'

export async function GET() {
  const guard = await requireRole(AUDITORIA_READ_ROLES)
  if (!guard.ok) return guard.response

  const supabase = guard.admin

  // Fortalezas
  const { data: fortalezas, error: errorFortalezas } = await supabase
    .from('fortalezas')
    .select(`
      id,
      descripcion,
      razon,
      informe_id,
      iso:iso_id ( iso ),
      capitulos:capitulo_id ( capitulo ),
      numerales:numeral_id ( numeral ),
      informes_auditoria:informe_id (
        id,
        fecha_auditoria,
        recomendaciones,
        conclusiones,
        usuarios:usuario_id ( nombre, apellido ),
        dependencias:dependencia_id ( nombre, gestion )
      )
    `)

  if (errorFortalezas) {
    console.error('❌ Error fortalezas:', errorFortalezas.message)
    return Response.json({ error: errorFortalezas.message }, { status: 500 })
  }

  // Oportunidades de mejora
  const { data: oportunidades, error: errorOportunidades } = await supabase
    .from('oportunidades_mejora')
    .select(`
      id,
      descripcion,
      para_que,
      informe_id,
      iso:iso_id ( iso ),
      capitulos:capitulo_id ( capitulo ),
      numerales:numeral_id ( numeral ),
      informes_auditoria:informe_id (
        id,
        fecha_auditoria,
        recomendaciones,
        conclusiones,
        usuarios:usuario_id ( nombre, apellido ),
        dependencias:dependencia_id ( nombre, gestion )
      )
    `)

  if (errorOportunidades) {
    console.error('❌ Error oportunidades:', errorOportunidades.message)
    return Response.json({ error: errorOportunidades.message }, { status: 500 })
  }

  // No conformidades
  const { data: noConformidades, error: errorNoConf } = await supabase
    .from('no_conformidades')
    .select(`
      id,
      descripcion,
      evidencia,
      informe_id,
      iso:iso_id ( iso ),
      capitulos:capitulo_id ( capitulo ),
      numerales:numeral_id ( numeral ),
      informes_auditoria:informe_id (
        id,
        fecha_auditoria,
        recomendaciones,
        conclusiones,
        usuarios:usuario_id ( nombre, apellido ),
        dependencias:dependencia_id ( nombre, gestion )
      )
    `)

  if (errorNoConf) {
    console.error('❌ Error no conformidades:', errorNoConf.message)
    return Response.json({ error: errorNoConf.message }, { status: 500 })
  }

  // Combinar todo en una sola lista
const mapped = [
  ...(fortalezas || []).map(h => ({ ...h, tipo: 'Fortaleza', key: `fortaleza-${h.id}` })),
  ...(oportunidades || []).map(h => ({ ...h, tipo: 'Oportunidad de Mejora', key: `oportunidad-${h.id}` })),
  ...(noConformidades || []).map(h => ({ ...h, tipo: 'No Conformidad', key: `noconf-${h.id}` })),
]


  return Response.json(mapped)
}
