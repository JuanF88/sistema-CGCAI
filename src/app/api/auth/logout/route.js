import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function POST() {
  try {
    const supabase = await createSupabaseServerClient()

    const { error } = await supabase.auth.signOut()

    if (error) {
      console.error('[logout] error al cerrar sesión:', error.message)
      return NextResponse.json({ error: 'Error al cerrar sesión' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error en logout:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
