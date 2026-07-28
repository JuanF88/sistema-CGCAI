import { requireRole } from '@/lib/api/guard'
import { ROLES } from '@/lib/auth/roles'
import { badRequest, json, serverError } from '@/lib/api/response'
import { getAlertConfigs, updateAlertConfigs } from '@/lib/alertas/auditAlertService'

export async function GET() {
  const guard = await requireRole(ROLES.ADMIN)
  if (!guard.ok) return guard.response

  try {
    const configs = await getAlertConfigs(guard.admin)
    return json({ configs })
  } catch (err) {
    return serverError(err?.message || 'No se pudo cargar la configuración.')
  }
}

export async function PATCH(request) {
  const guard = await requireRole(ROLES.ADMIN)
  if (!guard.ok) return guard.response

  try {
    const body = await request.json()
    const updates = Array.isArray(body?.configs) ? body.configs : body ? [body] : []

    if (!updates.length) {
      return badRequest('No se recibieron configuraciones para guardar.')
    }

    const configs = await updateAlertConfigs(guard.admin, updates)

    return json({ ok: true, configs })
  } catch (err) {
    return serverError(err?.message || 'No se pudo guardar la configuración.')
  }
}
