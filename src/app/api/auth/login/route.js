import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { toErrorResponse } from '@/lib/api/handler'
import { loginSchema } from '@/features/auth/dto/login-dto'

/**
 * Campos del usuario que devolvemos al cliente. Nunca incluye `password`,
 * que sigue existiendo solo para el camino de login legacy.
 */
const USUARIO_PUBLIC_FIELDS =
  'usuario_id, nombre, apellido, email, rol, estado, auth_user_id, tipo_personal, dependencia_id, estudios, tipo_estudio, celular'

/** Quita `password` antes de enviar el usuario al cliente. */
const sanitizeUsuario = (usuario) => {
  if (!usuario) return usuario
  const rest = { ...usuario }
  delete rest.password
  return rest
}

export async function POST(request) {
  try {
    const { email, password } = loginSchema.parse(await request.json())

    const supabase = await createSupabaseServerClient()
    const admin = supabaseAdmin()

    // PASO 1: Intentar login con Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    // Si el login con Supabase Auth funciona, proceder normalmente
    if (!authError && authData.user) {
      // La tabla `usuarios` está bajo RLS, así que leemos el perfil con
      // service-role para poder resolver el rol durante el login.
      const { data: usuario, error: usuarioError } = await admin
        .from('usuarios')
        .select(USUARIO_PUBLIC_FIELDS)
        .eq('auth_user_id', authData.user.id)
        .eq('estado', 'activo')
        .single()

      if (usuarioError || !usuario) {
        await supabase.auth.signOut()
        return NextResponse.json(
          { error: 'Usuario no encontrado o inactivo' },
          { status: 403 }
        )
      }

      if (!usuario.rol) {
        await supabase.auth.signOut()
        return NextResponse.json(
          { error: 'Este usuario no tiene un rol definido' },
          { status: 403 }
        )
      }

      return NextResponse.json({
        success: true,
        user: authData.user,
        usuario: usuario,
        session: authData.session, // Devolver la sesión para establecerla en el cliente
      })
    }

    // PASO 2: Si falla, intentar con contraseña antigua (migración gradual).
    // ⚠️ Camino legacy: compara contra `usuarios.password` en texto plano.
    // Se mantiene hasta que todos los usuarios tengan `auth_user_id`; ver
    // docs/MIGRACION-PASSWORDS.md para el procedimiento de retirada.
    const { data: usuarioLegacy, error: legacyError } = await admin
      .from('usuarios')
      .select('*')
      .eq('email', email)
      .eq('password', password)
      .eq('estado', 'activo')
      .single()

    if (legacyError || !usuarioLegacy) {
      return NextResponse.json(
        { error: 'Correo o contraseña incorrectos' },
        { status: 401 }
      )
    }

    if (!usuarioLegacy.rol) {
      return NextResponse.json(
        { error: 'Este usuario no tiene un rol definido' },
        { status: 403 }
      )
    }

    // PASO 3: Login antiguo exitoso - migrar contraseña a Supabase Auth
    if (usuarioLegacy.auth_user_id) {
      // Actualizar contraseña en Supabase Auth
      const { error: updateError } = await admin.auth.admin.updateUserById(
        usuarioLegacy.auth_user_id,
        { password: password }
      )

      if (!updateError) {
        console.log(`✓ Contraseña migrada automáticamente para: ${email}`)
      }
    }

    // PASO 4: Crear sesión manualmente con Supabase Auth
    const { data: finalAuthData, error: finalAuthError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (finalAuthError) {
      // Si aún falla, retornar datos legacy (fallback)
      return NextResponse.json({
        success: true,
        user: { id: usuarioLegacy.auth_user_id || usuarioLegacy.usuario_id, email: usuarioLegacy.email },
        usuario: sanitizeUsuario(usuarioLegacy),
        legacy: true,
      })
    }

    return NextResponse.json({
      success: true,
      user: finalAuthData.user,
      usuario: sanitizeUsuario(usuarioLegacy),
      migrated: true, // Indica que se migró la contraseña
      session: finalAuthData.session, // Devolver la sesión
    })

  } catch (error) {
    // Un ZodError sale como 400 con el detalle de los campos; el resto como 500.
    return toErrorResponse(error)
  }
}
