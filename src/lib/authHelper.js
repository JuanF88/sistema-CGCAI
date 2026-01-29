import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

/**
 * Helper para obtener sesión autenticada en API routes
 * @returns {Promise<{supabase, session, usuario, error}>}
 */
export async function getAuthenticatedClient() {
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
            // Cookies solo se pueden establecer en Server Actions/Route Handlers
          }
        },
        remove(name, options) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch (error) {
            // Cookies solo se pueden establecer en Server Actions/Route Handlers
          }
        },
      },
    }
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    return { supabase, session: null, usuario: null, error: 'No autenticado' }
  }

  // Obtener datos del usuario desde tabla usuarios
  // Usamos service role temporalmente para bypass RLS al obtener datos del usuario
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

  const { data: usuario } = await supabaseAdmin
    .from('usuarios')
    .select('*')
    .eq('auth_user_id', user.id)
    .single()

  return { supabase, session: { user }, usuario, error: null }
}
