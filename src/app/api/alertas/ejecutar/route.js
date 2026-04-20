import { NextResponse } from 'next/server'
import { getAuthenticatedClient } from '@/lib/authHelper'
import { createClient } from '@supabase/supabase-js'
import {
  buildAlertMessage,
  buildDeadlineNotifications,
  buildStorageIndex,
  getAlertConfigs,
  getProcessDefinitions,
  getLatestAlertSentAt,
  registerAlertSent,
} from '@/lib/alertas/auditAlertService'
import { sendAuditDeadlineAlertEmail } from '@/lib/notifications'

function buildSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

function extractCronToken(request) {
  return request.headers.get('x-cron-secret') || request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || ''
}

function hasValidCronAccess(request) {
  const cronToken = extractCronToken(request)
  if (!cronToken) return false

  const validSecrets = [process.env.ALERTAS_CRON_SECRET, process.env.CRON_SECRET].filter(Boolean)
  if (!validSecrets.length) return false

  return validSecrets.includes(cronToken)
}

async function executeAlerts(request) {
  const hasCronAccess = hasValidCronAccess(request)

  let usuario = null
  if (!hasCronAccess) {
    const authResult = await getAuthenticatedClient()
    usuario = authResult.usuario
    if (authResult.error) {
      return NextResponse.json({ error: authResult.error }, { status: 401 })
    }

    if (usuario?.rol !== 'admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }
  }

  try {
    const supabaseAdmin = buildSupabaseAdmin()
    const configs = await getAlertConfigs(supabaseAdmin)
    const processDefinitions = getProcessDefinitions()
    const buckets = processDefinitions.map((item) => item.bucket)
    const storageIndex = await buildStorageIndex(supabaseAdmin, buckets)

    const { data: audits, error: auditsError } = await supabaseAdmin
      .from('informes_auditoria')
      .select(`
        id,
        usuario_id,
        dependencia_id,
        fecha_auditoria,
        validado,
        usuarios:usuario_id ( nombre, apellido, email, estado ),
        dependencias:dependencia_id ( nombre )
      `)

    if (auditsError) {
      return NextResponse.json({ error: auditsError.message }, { status: 500 })
    }

    console.log(`[Alertas] Iniciando barrido. Auditorías encontradas: ${audits?.length || 0}, Configuraciones: ${configs?.length || 0}`)

    const notifications = buildDeadlineNotifications({
      audits: audits || [],
      configs,
      storageIndex,
      today: new Date(),
    })

    console.log(`[Alertas] Notificaciones generadas: ${notifications.length}`)

    const summary = {
      revisadas: audits?.length || 0,
      configuradas: configs?.length || 0,
      generadas: notifications.length,
      enviadas: 0,
      omitidas: 0,
      fallidas: 0,
      detalle: [],
    }

    for (const notification of notifications) {
      try {
        const auditor = notification.audit
        const processLabel = notification.processDefinition.label
        const config = notification.config
        const dueDateText = notification.dueDate?.toISOString().slice(0, 10) || 'Por definir'
        const dependencyName = auditor?.dependencia_nombre || auditor?.dependencias?.nombre || 'Dependencia'

        const existingSentAt = await getLatestAlertSentAt(supabaseAdmin, {
          informeId: auditor.id,
          procesoKey: notification.processDefinition.key,
          tipoAlerta: notification.alertType,
          diasReferencia: notification.referenceDays,
        })

        if (existingSentAt) {
          summary.omitidas += 1
          summary.detalle.push({ 
            auditId: auditor.id, 
            processLabel, 
            email: auditor.auditor_email,
            dependencyName,
            alertType: notification.alertType,
            daysLeft: notification.daysLeft,
            reason: 'ya_enviada_recientemente',
            status: 'omitida' 
          })
          continue
        }

        if (!auditor?.auditor_email) {
          summary.fallidas += 1
          summary.detalle.push({ 
            auditId: auditor.id, 
            processLabel, 
            dependencyName,
            alertType: notification.alertType,
            daysLeft: notification.daysLeft,
            reason: 'auditor_sin_correo',
            status: 'fallida'
          })
          continue
        }

        const message = buildAlertMessage({
          processLabel,
          alertType: notification.alertType,
          daysLeft: notification.daysLeft,
          dueDate: notification.dueDate,
          audit: auditor,
          dependencyName,
        })

        const result = await sendAuditDeadlineAlertEmail({
          email: auditor.auditor_email,
          nombre: auditor.auditor_nombre,
          apellido: auditor.auditor_apellido,
          processLabel,
          alertTitle: message.subject,
          summary: message.summary,
          detail: message.detail,
          ctaLabel: message.ctaLabel,
          dependencyName,
          auditId: auditor.id,
          dueDateText,
        })

        if (!result?.ok) {
          summary.fallidas += 1
          summary.detalle.push({ 
            auditId: auditor.id, 
            processLabel, 
            email: auditor.auditor_email,
            dependencyName,
            alertType: notification.alertType,
            daysLeft: notification.daysLeft,
            reason: result?.message || 'error_envio',
            status: 'fallida'
          })
          continue
        }

        try {
          await registerAlertSent(supabaseAdmin, {
            informe_id: auditor.id,
            proceso_key: notification.processDefinition.key,
            proceso_label: processLabel,
            tipo_alerta: notification.alertType,
            dias_referencia: notification.referenceDays,
            fecha_vencimiento: dueDateText,
            correo_destino: auditor.auditor_email,
            enviado_por: null,
          })
          console.log(`[Alertas] ✅ Registrado: Auditoría ${auditor.id}, Proceso: ${processLabel}, Tipo: ${notification.alertType}`)
        } catch (registerError) {
          console.error(`[Alertas] ❌ Error registrando alerta para auditoría ${auditor.id}:`, {
            error: registerError?.message,
            procesoKey: notification.processDefinition.key,
            tipoAlerta: notification.alertType,
            diasReferencia: notification.referenceDays,
            stack: registerError?.stack
          })
          summary.fallidas += 1
          summary.detalle.push({ 
            auditId: auditor.id, 
            processLabel, 
            email: auditor.auditor_email,
            dependencyName,
            alertType: notification.alertType,
            daysLeft: notification.daysLeft,
            reason: `error_registro_bd: ${registerError?.message || 'desconocido'}`,
            status: 'fallida'
          })
          continue
        }

        summary.enviadas += 1
        summary.detalle.push({ 
          auditId: auditor.id, 
          processLabel, 
          email: auditor.auditor_email,
          dependencyName,
          alertType: notification.alertType,
          daysLeft: notification.daysLeft,
          status: 'enviado' 
        })
      } catch (itemError) {
        console.error('[Alertas] Error procesando notificación:', itemError)
        summary.fallidas += 1
      }
    }

    console.log(`[Alertas] ✨ Ejecución completada:`, {
      revisadas: summary.revisadas,
      generadas: summary.generadas,
      enviadas: summary.enviadas,
      omitidas: summary.omitidas,
      fallidas: summary.fallidas,
      detalles: summary.detalle.slice(0, 5) // Primeros 5 items
    })

    return NextResponse.json({ ok: true, summary })
  } catch (err) {
    console.error('[Alertas] Error en ejecución de alertas:', err)
    return NextResponse.json({ 
      error: err?.message || 'No se pudo ejecutar el barrido de alertas.',
      details: process.env.NODE_ENV === 'development' ? err?.stack : undefined
    }, { status: 500 })
  }
}

export async function POST(request) {
  return executeAlerts(request)
}

export async function GET(request) {
  return executeAlerts(request)
}
