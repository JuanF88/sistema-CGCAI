'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export function useAuth() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [usuario, setUsuario] = useState(null) // datos de tabla usuarios

  useEffect(() => {
    // Obtener sesión inicial
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user ?? null)
      
      if (session?.user) {
        // Cargar datos del usuario desde tabla usuarios
        const { data } = await supabase
          .from('usuarios')
          .select('*')
          .eq('auth_user_id', session.user.id)
          .single()
        
        setUsuario(data)
      }
      
      setLoading(false)
    }

    getSession()

    // Escuchar cambios de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null)
      
      if (session?.user) {
        const { data } = await supabase
          .from('usuarios')
          .select('*')
          .eq('auth_user_id', session.user.id)
          .single()
        
        setUsuario(data)
      } else {
        setUsuario(null)
      }
      
      setLoading(false)
    })

    return () => {
      subscription?.unsubscribe()
    }
  }, [])

  return {
    user,        // Usuario de Supabase Auth (auth.users)
    usuario,     // Datos de tabla usuarios (rol, nombre, etc.)
    loading,
    isAuthenticated: !!user,
  }
}
