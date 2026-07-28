import VisualizadorDashboard from '@/components/layout/VisualizadorDashboard'
import { requirePageRole } from '@/lib/auth/session'
import { ROLES } from '@/lib/auth/roles'

export default async function VisualizadorPage() {
  const usuario = await requirePageRole([ROLES.VISUALIZADOR])

  return <VisualizadorDashboard usuario={usuario} />
}
