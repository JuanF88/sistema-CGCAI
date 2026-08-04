import MigrateContent from './MigrateContent'
import { requirePageRole } from '@/lib/auth/session'
import { ROLES } from '@/lib/auth/roles'

export default async function MigratePage() {
  await requirePageRole([ROLES.ADMIN])

  return <MigrateContent />
}
