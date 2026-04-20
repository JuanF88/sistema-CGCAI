import { NextResponse } from 'next/server'
import { getAuthenticatedClient } from '@/lib/authHelper'
import { createClient } from '@supabase/supabase-js'
import {
  buildDeadlineNotifications,
  buildStorageIndex,
  getAlertConfigs,
  getProcessDefinitions,
  getLatestAlertSentAt,
} from '@/lib/alertas/auditAlertService'

function buildSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(request) {
  const authResult = await getAuthenticatedClient()
  const usuario = authResult.usuario
  
  if (authResult.error) {
    return NextResponse.json({ error: authResult.error }, { status: 401 })
  }

  if (usuario?.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
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

    const notifications = buildDeadlineNotifications({
      audits: audits || [],
      configs,
      storageIndex,
      today: new Date(),
    })

    const preview = []

    for (const notification of notifications) {
      const auditor = notification.audit
      const processLabel = notification.processDefinition.label
      const dueDateText = notification.dueDate?.toISOString().slice(0, 10) || 'Por definir'
      const dependencyName = auditor?.dependencia_nombre || auditor?.dependencias?.nombre || 'Dependencia'

      const existingSentAt = await getLatestAlertSentAt(supabaseAdmin, {
        informeId: auditor.id,
        procesoKey: notification.processDefinition.key,
        tipoAlerta: notification.alertType,
        diasReferencia: notification.referenceDays,
      })

      if (existingSentAt) {
        preview.push({
          auditId: auditor.id,
          processLabel,
          email: auditor.auditor_email || 'Sin correo',
          dependencyName,
          alertType: notification.alertType,
          daysLeft: notification.daysLeft,
          status: 'omitida',
          reason: 'ya_enviada_recientemente',
        })
        continue
      }

      if (!auditor?.auditor_email) {
        preview.push({
          auditId: auditor.id,
          processLabel,
          email: 'Sin correo',
          dependencyName,
          alertType: notification.alertType,
          daysLeft: notification.daysLeft,
          status: 'fallida',
          reason: 'auditor_sin_correo',
        })
        continue
      }

      preview.push({
        auditId: auditor.id,
        processLabel,
        email: auditor.auditor_email,
        dependencyName,
        alertType: notification.alertType,
        daysLeft: notification.daysLeft,
        status: 'sera_enviado',
        reason: 'sera_enviado',
      })
    }

    const stats = {
      sera_enviado: preview.filter((item) => item.status === 'sera_enviado').length,
      omitida: preview.filter((item) => item.status === 'omitida').length,
      fallida: preview.filter((item) => item.status === 'fallida').length,
    }

    return NextResponse.json({ ok: true, preview, stats })
  } catch (err) {
    return NextResponse.json({ error: err?.message || 'No se pudo generar la vista previa de alertas.' }, { status: 500 })
  }
}
