import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/api/guard'
import { EVALUACION_READ_ROLES } from '@/lib/auth/roles'

// GET /api/evaluaciones-auditores/periodos
// Obtiene los períodos (año-semestre) que tienen datos
export async function GET() {
  const guard = await requireRole(EVALUACION_READ_ROLES)
  if (!guard.ok) return guard.response

  const supabase = guard.admin

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
