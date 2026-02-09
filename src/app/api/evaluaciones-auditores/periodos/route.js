import { NextResponse } from 'next/server'
import { getAuthenticatedClient } from '@/lib/authHelper'
import { createClient } from '@supabase/supabase-js'

// GET /api/evaluaciones-auditores/periodos
// Obtiene los períodos (año-semestre) que tienen datos
export async function GET(request) {
  const { usuario, error } = await getAuthenticatedClient()
  
  if (error) {
    return NextResponse.json({ error }, { status: 401 })
  }

  // Solo admin y visualizador
  if (usuario?.rol !== 'admin' && usuario?.rol !== 'visualizador') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  try {
    // Obtener períodos únicos de encuestas_auditores
    const { data, error: queryError } = await supabase
      .from('encuestas_auditores')
      .select('anio, semestre, periodo')
      .not('anio', 'is', null)
      .not('semestre', 'is', null)
      .order('anio', { ascending: false })
      .order('semestre', { ascending: false })

    if (queryError) {
      console.error('Error al obtener períodos:', queryError)
      return NextResponse.json({ error: queryError.message }, { status: 500 })
    }

    // Extraer períodos únicos
    const periodosUnicos = []
    const periodosVistos = new Set()

    for (const row of data || []) {
      const key = `${row.anio}-${row.semestre}`
      if (!periodosVistos.has(key)) {
        periodosVistos.add(key)
        periodosUnicos.push({
          anio: row.anio,
          semestre: row.semestre,
          periodo: row.periodo || key
        })
      }
    }

    return NextResponse.json({
      periodos: periodosUnicos,
      total: periodosUnicos.length
    })

  } catch (err) {
    console.error('Error en GET periodos:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
