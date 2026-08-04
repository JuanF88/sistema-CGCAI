import AdminDashboard from '@/components/layout/AdminDashboard'
import { requirePageRole } from '@/lib/auth/session'
import { ROLES } from '@/lib/auth/roles'

export default async function AdminPage() {
  const usuario = await requirePageRole([ROLES.ADMIN])

  return <AdminDashboard usuario={usuario} />
}
