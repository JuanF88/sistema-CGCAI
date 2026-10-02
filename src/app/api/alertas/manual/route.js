/**
 * POST /api/alertas/manual
 *
 * Avisa a mano de un documento pendiente, desde las celdas del Centro de
 * Control. El barrido automático solo escribe en tres momentos —cinco días
 * antes, un día antes y cada diez días hábiles de retraso—; entre uno y otro no
 * había forma de recordarle nada a nadie.
 *
 * La misma ruta previsualiza y envía: con `enviar: false` (el valor por
 * defecto) calcula a quién iría, con qué texto y si ya se le avisó hoy, sin
 * mandar un solo correo. Son el mismo cálculo a propósito: si la vista previa
 * se hiciera en otro sitio, acabaría enseñando algo distinto de lo que sale.
 *
 * No se comprueba aquí si el plazo «toca»: el documento falta y alguien con
 * criterio ha decidido reclamarlo. Lo que sí se comprueba es que de verdad
 * falte, para no reclamar algo ya entregado.
 */
import { requireRole } from '@/lib/api/guard'
import { withRoute } from '@/lib/api/handler'
import { DomainError, fromPostgresError } from '@/lib/api/errors'
import { json } from '@/lib/api/response'
import { ROLES } from '@/lib/auth/roles'
import {
  buildAlertMessage,
  buildStorageIndex,
  diffInBusinessDays,
  getDueDateForProcess,
  getProcessDefinition,
  isProcessCompleted,
  normalizeAuditRow,
  startOfDay,
} from '@/lib/alertas/auditAlertService'
import { sendAuditDeadlineAlertEmail } from '@/lib/notifications'
import { avisoManualSchema } from '@/features/alertas/dto/alerta-dto'
import { formatearDia } from '@/lib/fechas'

const SELECT = `
  id, usuario_id, dependencia_id, fecha_auditoria, validado,
  usuarios:usuario_id ( nombre, apellido, email, estado ),
  dependencias:dependencia_id ( nombre )
`

/** Un envío a mano por auditoría, documento y día: ver `sql/alertas-manuales.sql`. */
const TIPO = 'manual'

export const POST = withRoute(async (request) => {
  const guard = await requireRole(ROLES.ADMIN)
  if (!guard.ok) return guard.response

  const db = guard.admin
  const { proceso_key, informe_ids, enviar } = avisoManualSchema.parse(await request.json())

  const proceso = getProcessDefinition(proceso_key)
  if (!proceso) {
    throw new DomainError(`No existe el documento «${proceso_key}».`, {
      status: 400,
      code: 'PROCESO_DESCONOCIDO',
    })
  }

  const { data: auditorias, error } = await db.from('informes_auditoria').select(SELECT).in('id', informe_ids)
  if (error) throw fromPostgresError(error, 'No se pudieron leer las auditorías')

  const storageIndex = await buildStorageIndex(db, [proceso.bucket])
  const hoy = startOfDay(new Date())

  const avisos = []

  for (const cruda of auditorias ?? []) {
    const auditoria = normalizeAuditRow(cruda)
    const dependencia = auditoria.dependencia_nombre || 'Dependencia'
    const limite = getDueDateForProcess(auditoria.fecha_auditoria, proceso_key)
    const diasRestantes = limite ? diffInBusinessDays(hoy, limite) : null

    const base = {
      informeId: auditoria.id,
      dependencia,
      auditor: [auditoria.auditor_nombre, auditoria.auditor_apellido].filter(Boolean).join(' ').trim(),
      correo: auditoria.auditor_email || null,
      fechaAuditoria: auditoria.fecha_auditoria,
      vence: limite ? formatearDia(limite) : null,
      diasRestantes,
    }

    // Que el documento ya esté no es un error: es la razón de no escribir.
    if (isProcessCompleted(proceso_key, cruda, storageIndex)) {
      avisos.push({ ...base, estado: 'entregado', motivo: 'El documento ya está cargado.' })
      continue
    }

    if (!base.correo) {
      avisos.push({ ...base, estado: 'sin-correo', motivo: 'El auditor no tiene correo registrado.' })
      continue
    }

    if (cruda.usuarios?.estado && cruda.usuarios.estado !== 'activo') {
      avisos.push({ ...base, estado: 'inactivo', motivo: 'El auditor está inactivo.' })
      continue
    }

    const mensaje = buildAlertMessage({
      processLabel: proceso.label,
      alertType: TIPO,
      dueDate: limite,
      audit: auditoria,
      dependencyName: dependencia,
      daysLeft: diasRestantes,
    })

    // Ya avisado hoy: el índice único de `alertas_historial` lo impediría de
    // todas formas, pero es mejor decirlo antes que fallar al enviar.
    const { data: previo } = await db
      .from('alertas_historial')
      .select('enviado_at')
      .eq('informe_id', auditoria.id)
      .eq('proceso_key', proceso_key)
      .eq('tipo_alerta', TIPO)
      .eq('dias_referencia', diasRestantes ?? 0)
      .maybeSingle()

    avisos.push({
      ...base,
      estado: previo ? 'ya-avisado' : 'pendiente',
      motivo: previo ? 'Ya se le avisó hoy de este documento.' : null,
      asunto: mensaje.subject,
      resumen: mensaje.summary,
      detalle: mensaje.detail,
    })
  }

  const enviables = avisos.filter((a) => a.estado === 'pendiente')

  if (!enviar) {
    return json({
      proceso: { key: proceso_key, label: proceso.label },
      avisos,
      resumen: {
        enviables: enviables.length,
        entregados: avisos.filter((a) => a.estado === 'entregado').length,
        yaAvisados: avisos.filter((a) => a.estado === 'ya-avisado').length,
        sinCorreo: avisos.filter((a) => a.estado === 'sin-correo').length,
        inactivos: avisos.filter((a) => a.estado === 'inactivo').length,
      },
    })
  }

  let enviados = 0
  const fallidos = []

  for (const aviso of enviables) {
    try {
      const resultado = await sendAuditDeadlineAlertEmail({
        email: aviso.correo,
        nombre: aviso.auditor,
        apellido: '',
        processLabel: proceso.label,
        alertTitle: aviso.asunto,
        summary: aviso.resumen,
        detail: aviso.detalle,
        ctaLabel: 'Subir el documento',
        dependencyName: aviso.dependencia,
        auditId: aviso.informeId,
        dueDateText: aviso.vence || 'Por definir',
      })

      if (!resultado?.ok) throw new Error(resultado?.message || 'El correo no salió')

      const { error: errorHistorial } = await db.from('alertas_historial').insert([
        {
          informe_id: aviso.informeId,
          proceso_key,
          proceso_label: proceso.label,
          tipo_alerta: TIPO,
          dias_referencia: aviso.diasRestantes ?? 0,
          fecha_vencimiento: aviso.vence ? aviso.fechaAuditoria : null,
          correo_destino: aviso.correo,
          enviado_por: guard.usuario?.auth_user_id ?? null,
        },
      ])

      // El correo ya salió: un fallo al dejar constancia se avisa, pero no
      // convierte el envío en un fracaso.
      if (errorHistorial) {
        console.error(`[alertas] enviado pero sin registrar #${aviso.informeId}:`, errorHistorial.message)
      }

      enviados++
    } catch (err) {
      console.error(`[alertas] no se pudo avisar de #${aviso.informeId}:`, err?.message ?? err)
      fallidos.push({ informeId: aviso.informeId, motivo: err?.message ?? 'Error desconocido' })
    }
  }

  return json({
    proceso: { key: proceso_key, label: proceso.label },
    enviados,
    fallidos,
  })
})
