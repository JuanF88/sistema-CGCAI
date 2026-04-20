const PROCESS_DEFINITIONS = [
  {
    key: 'carta_compromiso',
    label: 'Carta de compromiso',
    bucket: 'actascompromiso',
    dueOffsetBusinessDays: -5,
    completionKind: 'storage',
  },
  {
    key: 'plan_auditoria',
    label: 'Plan de auditoría',
    bucket: 'planes',
    dueOffsetBusinessDays: -5,
    completionKind: 'storage',
  },
  {
    key: 'listado_asistencia',
    label: 'Listado de asistencia',
    bucket: 'asistencias',
    dueOffsetBusinessDays: 0,
    completionKind: 'storage',
  },
  {
    key: 'evaluacion',
    label: 'Evaluación',
    bucket: 'evaluaciones',
    dueOffsetBusinessDays: 0,
    completionKind: 'storage',
  },
  {
    key: 'acta_reunion',
    label: 'Acta de reunión',
    bucket: 'actas',
    dueOffsetBusinessDays: 10,
    completionKind: 'storage',
  },
  {
    key: 'informe_auditoria',
    label: 'Informe de auditoría',
    bucket: 'validaciones',
    dueOffsetBusinessDays: 10,
    completionKind: 'report',
  },
]

export const DEFAULT_ALERT_CONFIGS = PROCESS_DEFINITIONS.map((process) => ({
  proceso_key: process.key,
  proceso_label: process.label,
  bucket: process.bucket,
  due_offset_business_days: process.dueOffsetBusinessDays,
  activo: true,
  alerta_5_dias: true,
  alerta_1_dia: true,
  alerta_vencido: true,
  dias_repeticion_vencido: 10,
}))

export function parseYMD(ymd) {
  if (!ymd) return null
  const [year, month, day] = String(ymd).split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

export function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function addBusinessDays(date, amount) {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const step = amount >= 0 ? 1 : -1
  let counted = 0

  while (counted < Math.abs(amount)) {
    result.setDate(result.getDate() + step)
    const dayOfWeek = result.getDay()
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      counted += 1
    }
  }

  return result
}

export function diffInBusinessDays(from, to) {
  const start = startOfDay(from)
  const end = startOfDay(to)
  const step = end >= start ? 1 : -1
  let current = new Date(start)
  let count = 0

  while ((step > 0 && current < end) || (step < 0 && current > end)) {
    current.setDate(current.getDate() + step)
    const dayOfWeek = current.getDay()
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      count += step
    }
  }

  return count
}

export function formatYMD(date) {
  if (!date) return ''
  return date.toISOString().slice(0, 10)
}

export function getProcessDefinitions() {
  return PROCESS_DEFINITIONS
}

export function getProcessDefinition(processKey) {
  return PROCESS_DEFINITIONS.find((item) => item.key === processKey) || null
}

export function getDueDateForProcess(fechaAuditoria, processKey) {
  const processDefinition = getProcessDefinition(processKey)
  const auditDate = parseYMD(fechaAuditoria)

  if (!processDefinition || !auditDate) {
    return null
  }

  return addBusinessDays(auditDate, processDefinition.dueOffsetBusinessDays)
}

export async function buildStorageIndex(supabaseAdmin, buckets = []) {
  const uniqueBuckets = [...new Set(buckets)].filter(Boolean)

  const entries = await Promise.all(uniqueBuckets.map(async (bucket) => {
    const { data, error } = await supabaseAdmin
      .storage
      .from(bucket)
      .list('', { limit: 1000, sortBy: { column: 'name', order: 'asc' } })

    if (error) {
      return [bucket, []]
    }

    return [bucket, Array.isArray(data) ? data : []]
  }))

  return Object.fromEntries(entries)
}

export function hasAuditFile(storageFilesByBucket, bucket, auditId) {
  const files = storageFilesByBucket?.[bucket] || []
  const auditKey = String(auditId)

  return files.some((file) => {
    const name = String(file?.name || '')
    return name.includes(`_${auditKey}_`) || name.includes(auditKey)
  })
}

export function isProcessCompleted(processKey, audit, storageFilesByBucket) {
  const processDefinition = getProcessDefinition(processKey)
  if (!processDefinition) return true

  if (processDefinition.completionKind === 'report') {
    return Boolean(audit?.validado === true)
  }

  return hasAuditFile(storageFilesByBucket, processDefinition.bucket, audit?.id)
}

export function shouldTriggerAlert({ daysLeft, alertType, config }) {
  if (!config?.activo) return false

  if (alertType === 'before_5') return config.alerta_5_dias && daysLeft === 5
  if (alertType === 'before_1') return config.alerta_1_dia && daysLeft === 1

  if (alertType === 'overdue') {
    const overdueDays = Math.abs(daysLeft)
    const cycle = Number(config.dias_repeticion_vencido || 10)
    if (!config.alerta_vencido || overdueDays <= 0) return false
    return overdueDays % cycle === 0
  }

  return false
}

export function buildAlertMessage({ processLabel, alertType, daysLeft, dueDate, audit, dependencyName }) {
  const dueDateText = dueDate ? formatYMD(dueDate) : 'Sin fecha'
  const dependency = dependencyName || 'la dependencia asignada'

  if (alertType === 'before_5') {
    return {
      subject: `Recordatorio: ${processLabel} vence en 5 días - Auditoría #${audit.id}`,
      title: `${processLabel} próximo a vencer`,
      summary: `Faltan 5 días para el vencimiento de ${processLabel.toLowerCase()} de la auditoría #${audit.id} en ${dependency}.`,
      detail: `Fecha límite: ${dueDateText}. Te recomendamos consultar el sistema y cargar la información a tiempo para evitar retrasos.`,
      ctaLabel: 'Revisar en el sistema',
    }
  }

  if (alertType === 'before_1') {
    return {
      subject: `Recordatorio urgente: ${processLabel} vence mañana - Auditoría #${audit.id}`,
      title: `${processLabel} vence mañana`,
      summary: `Solo queda 1 día para el vencimiento de ${processLabel.toLowerCase()} de la auditoría #${audit.id} en ${dependency}.`,
      detail: `Fecha límite: ${dueDateText}. Por favor revisa el sistema y sube la información pendiente lo antes posible.`,
      ctaLabel: 'Ir al sistema',
    }
  }

  return {
    subject: `Recordatorio: ${processLabel} vencido - Auditoría #${audit.id}`,
    title: `${processLabel} vencido`,
    summary: `${processLabel} de la auditoría #${audit.id} en ${dependency} ya superó su fecha límite.`,
    detail: `Fecha de vencimiento: ${dueDateText}. Seguiremos enviando este recordatorio cada 10 días mientras la información continúe pendiente.`,
    ctaLabel: 'Consultar auditoría',
  }
}

export async function ensureAlertConfigRows(supabaseAdmin) {
  const { data: existing, error } = await supabaseAdmin
    .from('alertas_procesos_config')
    .select('proceso_key')

  if (error) {
    throw new Error(error.message)
  }

  if (!Array.isArray(existing) || existing.length === 0) {
    const { error: insertError } = await supabaseAdmin
      .from('alertas_procesos_config')
      .insert(DEFAULT_ALERT_CONFIGS)

    if (insertError) {
      throw new Error(insertError.message)
    }
  }
}

export async function getAlertConfigs(supabaseAdmin) {
  await ensureAlertConfigRows(supabaseAdmin)

  const { data, error } = await supabaseAdmin
    .from('alertas_procesos_config')
    .select('*')
    .order('proceso_label', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return data || []
}

export async function updateAlertConfigs(supabaseAdmin, updates = []) {
  const payload = Array.isArray(updates) ? updates : [updates]

  if (!payload.length) return []

  const normalized = payload
    .filter((item) => item?.proceso_key)
    .map((item) => ({
      proceso_key: item.proceso_key,
      proceso_label: item.proceso_label,
      bucket: item.bucket,
      due_offset_business_days: Number.isFinite(Number(item.due_offset_business_days)) ? Number(item.due_offset_business_days) : null,
      activo: Boolean(item.activo),
      alerta_5_dias: Boolean(item.alerta_5_dias),
      alerta_1_dia: Boolean(item.alerta_1_dia),
      alerta_vencido: Boolean(item.alerta_vencido),
      dias_repeticion_vencido: Number.isFinite(Number(item.dias_repeticion_vencido)) ? Number(item.dias_repeticion_vencido) : 10,
    }))

  if (!normalized.length) return []

  const { data, error } = await supabaseAdmin
    .from('alertas_procesos_config')
    .upsert(normalized, { onConflict: 'proceso_key' })
    .select('*')

  if (error) {
    throw new Error(error.message)
  }

  return data || []
}

export async function getLatestAlertSentAt(supabaseAdmin, { informeId, procesoKey, tipoAlerta, diasReferencia }) {
  const { data, error } = await supabaseAdmin
    .from('alertas_historial')
    .select('enviado_at')
    .eq('informe_id', informeId)
    .eq('proceso_key', procesoKey)
    .eq('tipo_alerta', tipoAlerta)
    .eq('dias_referencia', diasReferencia)
    .order('enviado_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return data?.enviado_at || null
}

export async function registerAlertSent(supabaseAdmin, payload) {
  if (!payload.informe_id || !payload.tipo_alerta) {
    throw new Error(`Datos incompletos: informe_id=${payload.informe_id}, tipo_alerta=${payload.tipo_alerta}`)
  }

  const { data, error } = await supabaseAdmin
    .from('alertas_historial')
    .insert([payload])
    .select()

  if (error) {
    console.error('[registerAlertSent] Error de BD:', {
      code: error.code,
      message: error.message,
      payload: payload
    })
    throw new Error(`${error.code}: ${error.message}`)
  }

  return data
}

export function normalizeAuditRow(audit) {
  return {
    id: audit?.id,
    usuario_id: audit?.usuario_id,
    fecha_auditoria: audit?.fecha_auditoria,
    validado: audit?.validado,
    dependencia_nombre: audit?.dependencias?.nombre || audit?.dependencia_nombre || '',
    auditor_nombre: audit?.usuarios?.nombre || audit?.auditor_nombre || '',
    auditor_apellido: audit?.usuarios?.apellido || audit?.auditor_apellido || '',
    auditor_email: audit?.usuarios?.email || audit?.auditor_email || '',
  }
}

export function buildDeadlineNotifications({ audits = [], configs = [], storageIndex = {}, today = new Date() }) {
  const currentDay = startOfDay(today)
  const configMap = new Map((configs || []).map((item) => [item.proceso_key, item]))
  const notifications = []

  for (const rawAudit of audits || []) {
    const audit = normalizeAuditRow(rawAudit)
    const auditDate = parseYMD(audit.fecha_auditoria)

    if (!audit?.id || !auditDate) continue

    for (const processDefinition of PROCESS_DEFINITIONS) {
      const config = configMap.get(processDefinition.key)
      if (!config?.activo) continue

      const dueDate = getDueDateForProcess(audit.fecha_auditoria, processDefinition.key)
      if (!dueDate) continue

      const daysLeft = diffInBusinessDays(currentDay, dueDate)
      const completed = isProcessCompleted(processDefinition.key, rawAudit, storageIndex)

      if (completed) continue

      const alertCandidates = [
        { type: 'before_5', enabled: config.alerta_5_dias, days: 5 },
        { type: 'before_1', enabled: config.alerta_1_dia, days: 1 },
      ]

      for (const candidate of alertCandidates) {
        if (!candidate.enabled || daysLeft !== candidate.days) continue

        notifications.push({
          audit,
          processDefinition,
          config,
          dueDate,
          daysLeft,
          alertType: candidate.type,
          referenceDays: candidate.days,
        })
      }

      if (config.alerta_vencido && daysLeft < 0) {
        const overdueDays = Math.abs(daysLeft)
        const cycle = Math.max(1, Number(config.dias_repeticion_vencido || 10))

        if (overdueDays % cycle === 0) {
          notifications.push({
            audit,
            processDefinition,
            config,
            dueDate,
            daysLeft,
            alertType: 'overdue',
            referenceDays: overdueDays,
          })
        }
      }
    }
  }

  return notifications
}

