import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/api/guard'
import { withRoute } from '@/lib/api/handler'
import { ROLES } from '@/lib/auth/roles'
import { sendCredentialsEmail } from '@/lib/notifications'
import { enviarCredencialesSchema } from '@/features/usuarios/dto/usuario-dto'

export const POST = withRoute(async (request) => {
  const guard = await requireRole(ROLES.ADMIN)
  if (!guard.ok) return guard.response

  try {
    const { usuario_id } = enviarCredencialesSchema.parse(await request.json())

    // `password` solo se lee aquí, en el servidor, para poder enviarlo por
    // correo. Nunca sale por la API.
    const { data: userData, error: dbError } = await guard.admin
      .from('usuarios')
      .select('usuario_id, nombre, apellido, email, password, estado')
      .eq('usuario_id', usuario_id)
      .maybeSingle()

    if (dbError) {
      return NextResponse.json({ error: dbError.message || 'No se pudo consultar el usuario.' }, { status: 500 })
    }

    if (!userData) {
      return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 })
    }

    if ((userData.estado || '').toLowerCase() !== 'activo') {
      return NextResponse.json({ error: 'No se pueden enviar credenciales a usuarios inactivos.' }, { status: 400 })
    }

    if (!userData.email || !userData.password) {
      return NextResponse.json({ error: 'El usuario no tiene credenciales completas para enviar.' }, { status: 400 })
    }

    const result = await sendCredentialsEmail({
      nombre: userData.nombre || '',
      apellido: userData.apellido || '',
      email: userData.email,
      password: userData.password,
    })

    if (result.ok) {
      return NextResponse.json({ ok: true, notification: result })
    }

    return NextResponse.json({ ok: false, notification: result }, { status: 400 })
  } catch (err) {
    // Los errores de validación los traduce `withRoute`; el resto se re-lanza.
    throw err
  }
})
