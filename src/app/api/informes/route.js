import { requireRole } from '@/lib/api/guard'
import { withRoute } from '@/lib/api/handler'
import { fromPostgresError } from '@/lib/api/errors'
import { AUDITORIA_READ_ROLES, AUDITORIA_WRITE_ROLES } from '@/lib/auth/roles'
import { sendAuditAssignmentEmail } from '@/lib/notifications'
import {
  crearInformeSchema,
  eliminarInformeSchema,
  flattenInformeBody,
} from '@/features/auditorias/dto/informe-dto'

export async function GET() {
  const guard = await requireRole(AUDITORIA_READ_ROLES)
  if (!guard.ok) return guard.response

  const { data, error: dbError } = await guard.admin
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
      programa_auditoria_id,
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

  if (dbError) {
    console.error('❌ Error al obtener informes:', dbError.message)
    return Response.json({ error: dbError.message }, { status: 500 })
  }

  return Response.json(data)
}

export const DELETE = withRoute(async (request) => {
  const guard = await requireRole(AUDITORIA_WRITE_ROLES)
  if (!guard.ok) return guard.response

  const { id } = eliminarInformeSchema.parse(await request.json())

  // Con `admin`, como el resto de escrituras: las políticas RLS de esta tabla
  // solo cubren SELECT, y quién puede borrar ya lo decide `requireRole`.
  const { error } = await guard.admin
    .from('informes_auditoria')
    .delete()
    .eq('id', id)

  if (error) throw fromPostgresError(error)

  return Response.json({ mensaje: 'Informe eliminado correctamente' })
})

export const POST = withRoute(async (req) => {
  const guard = await requireRole(AUDITORIA_WRITE_ROLES)
  if (!guard.ok) return guard.response

  // Sin try/catch: `withRoute` traduce el ZodError a 400 y cualquier otro
  // error a la respuesta estándar.
  const payload = crearInformeSchema.parse(flattenInformeBody(await req.json()))
  const { usuario_id, fecha_auditoria, fecha_seguimiento } = payload

  // Con `admin`, igual que el DELETE de más arriba: las políticas RLS de esta
  // tabla solo cubren SELECT y quién puede crear ya lo decide `requireRole`.
  const { data, error } = await guard.admin
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
      programa_auditoria_id,
      usuarios:usuario_id ( nombre, apellido ),
      dependencias:dependencia_id ( nombre ),
      fortalezas ( id ),
      oportunidades_mejora ( id ),
      no_conformidades ( id )
    `)

  if (error) throw fromPostgresError(error)

  // Notificación de asignación al auditor (no bloqueante para la creación).
  try {
    const { data: auditorData, error: auditorError } = await guard.admin
      .from('usuarios')
      .select('usuario_id, nombre, apellido, email, estado')
      .eq('usuario_id', usuario_id)
      .maybeSingle()

    if (auditorError) {
      console.warn('[POST /api/informes] No se pudo consultar auditor para notificar:', auditorError.message)
    } else if (auditorData?.email && (auditorData.estado || '').toLowerCase() === 'activo') {
      const informeCreado = Array.isArray(data) ? data[0] : data
      const dependenciaNombre = informeCreado?.dependencias?.nombre || 'Dependencia asignada'

      const notificationResult = await sendAuditAssignmentEmail({
        nombre: auditorData.nombre || '',
        apellido: auditorData.apellido || '',
        email: auditorData.email,
        dependencia: dependenciaNombre,
        fechaAuditoria: fecha_auditoria,
        fechaSeguimiento: fecha_seguimiento,
      })

      if (!notificationResult?.ok) {
        console.warn('[POST /api/informes] Informe creado, pero correo de asignación no enviado:', notificationResult)
      }
    }
  } catch (notificationError) {
    console.warn('[POST /api/informes] Informe creado, pero falló la notificación de asignación:', notificationError?.message || notificationError)
  }

  return Response.json(data, { status: 201 })
})
