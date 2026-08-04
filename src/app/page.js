import { redirect } from 'next/navigation'
import LoginForm from '@/features/auth/components/LoginForm'
import { getCurrentUser } from '@/lib/auth/session'
import { HOME_BY_ROLE } from '@/lib/auth/roles'

export default async function LoginPage() {
  // Si ya hay sesión válida, no mostramos el formulario otra vez.
  const usuario = await getCurrentUser()
  if (usuario && HOME_BY_ROLE[usuario.rol]) {
    redirect(HOME_BY_ROLE[usuario.rol])
  }

  return <LoginForm />
}
