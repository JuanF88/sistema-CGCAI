/**
 * Cliente de Supabase con service-role.
 *
 * ⚠️ Se salta por completo RLS. Solo puede importarse desde código de servidor
 * (Route Handlers, Server Actions, scripts) y nunca desde un componente
 * marcado con 'use client'.
 *
 * Antes se instanciaba en línea en cada handler (28 veces). Aquí se crea una
 * sola vez por proceso y se reutiliza.
 */
import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { getServerEnv } from '@/lib/config/env.server'

let cached = null

export function supabaseAdmin() {
  if (cached) return cached

  const env = getServerEnv()

  cached = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  return cached
}
