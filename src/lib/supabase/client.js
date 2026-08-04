/**
 * Cliente de Supabase para el navegador.
 *
 * Usa la clave anónima y queda sujeto a las políticas RLS del usuario
 * autenticado. Es el único cliente que debe importarse desde componentes
 * marcados con 'use client'.
 */
import { createBrowserClient } from '@supabase/ssr'
import { publicEnv } from '@/lib/config/env.public'

/**
 * Instancia compartida del cliente de navegador.
 * `createBrowserClient` mantiene la sesión en cookies, de modo que el proxy y
 * las rutas de API ven la misma sesión que el cliente.
 */
export const supabase = createBrowserClient(
  publicEnv.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'
)

export default supabase
