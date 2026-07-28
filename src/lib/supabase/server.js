import 'server-only'

/**
 * Cliente de Supabase para el servidor (Route Handlers y Server Components).
 *
 * Lee y escribe la sesión en cookies, por lo que respeta las políticas RLS
 * del usuario autenticado. Para operaciones que deben saltarse RLS usa
 * `supabaseAdmin()` de `@/lib/supabase/admin`.
 */
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServerEnv } from '@/lib/config/env.server'

export async function createSupabaseServerClient() {
  const cookieStore = await cookies()
  const env = getServerEnv()

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // Las cookies solo pueden escribirse desde Server Actions o Route
            // Handlers. En Server Components esto se ignora a propósito.
          }
        },
      },
    }
  )
}
