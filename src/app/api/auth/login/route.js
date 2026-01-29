import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    const { email, password } = await request.json()

    const cookieStore = await cookies()
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          get(name) {
            return cookieStore.get(name)?.value
          },
          set(name, value, options) {
            try {
              cookieStore.set({ name, value, ...options })
            } catch (error) {
              // Cookies can only be set in Server Actions or Route Handlers
            }
          },
          remove(name, options) {
            try {
              cookieStore.set({ name, value: '', ...options })
            } catch (error) {
              // Cookies can only be set in Server Actions or Route Handlers
            }
          },
        },
      }
    )

    // PASO 1: Intentar login con Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    // Si el login con Supabase Auth funciona, proceder normalmente
    if (!authError && authData.user) {
      // Obtener datos del usuario desde tabla usuarios
      // Usamos service role temporalmente para bypass RLS durante login
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        }
      )

      const { data: usuario, error: usuarioError } = await supabaseAdmin
        .from('usuarios')
        .select('*')
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

    // PASO 2: Si falla, intentar con contraseña antigua (migración gradual)
    // Usamos service role para bypass RLS
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    const { data: usuarioLegacy, error: legacyError } = await supabaseAdmin
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
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
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
        usuario: usuarioLegacy,
        legacy: true,
      })
    }

    return NextResponse.json({
      success: true,
      user: finalAuthData.user,
      usuario: usuarioLegacy,
      migrated: true, // Indica que se migró la contraseña
      session: finalAuthData.session, // Devolver la sesión
    })

  } catch (error) {
    console.error('Error en login:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
