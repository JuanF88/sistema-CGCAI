import AuditorDashboard from '@/components/layout/AuditorDashboard'
import { requirePageRole } from '@/lib/auth/session'
import { ROLES } from '@/lib/auth/roles'

export default async function AuditorPage() {
  const usuario = await requirePageRole([ROLES.AUDITOR])

  return <AuditorDashboard usuario={usuario} />
}
