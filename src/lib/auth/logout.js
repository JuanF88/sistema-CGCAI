'use client'

/**
 * Cierre de sesión.
 *
 * Antes los paneles solo hacían `localStorage.removeItem('clienteLogueado')`,
 * de modo que la cookie de Supabase seguía viva y la sesión del servidor no se
 * cerraba nunca. Esto invalida la sesión en ambos lados.
 */
import { supabase } from '@/lib/supabase/client'
import { cerrarSesionEnServidor } from '@/features/auth/api/auth-api'

export async function cerrarSesion(router) {
  try {
    await supabase.auth.signOut()
  } catch (error) {
    console.error('[logout] fallo al cerrar sesión en el cliente:', error)
  }

  try {
    await cerrarSesionEnServidor()
  } catch (error) {
    console.error('[logout] fallo al cerrar sesión en el servidor:', error)
  }

  if (router) {
    router.replace('/')
    router.refresh()
  } else if (typeof window !== 'undefined') {
    window.location.assign('/')
  }
}
