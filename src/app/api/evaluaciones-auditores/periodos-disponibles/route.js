import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/api/guard'
import { EVALUACION_READ_ROLES } from '@/lib/auth/roles'
import { anioDe, periodoDe } from '@/lib/fechas'

// GET /api/evaluaciones-auditores/periodos-disponibles
// Retorna años y semestres únicos basándose en las auditorías existentes
export async function GET() {
  const guard = await requireRole(EVALUACION_READ_ROLES)
  if (!guard.ok) return guard.response

  const supabase = guard.admin

  try {
    // Obtener todas las fechas de auditoría disponibles
    const { data: informes, error: informesError } = await supabase
      .from('informes_auditoria')
      .select('fecha_auditoria')
      .order('fecha_auditoria', { ascending: false })

    if (informesError) {
      console.error('Error obteniendo fechas:', informesError)
      return NextResponse.json({ error: informesError.message }, { status: 500 })
    }

    if (!informes || informes.length === 0) {
      return NextResponse.json({
        periodos: [],
        anios: [],
        semestres: []
      })
    }

    // Procesar fechas para extraer años y semestres únicos
    const periodosSet = new Set()
    const aniosSet = new Set()
    
    informes.forEach(informe => {
      if (!informe.fecha_auditoria) return
      
      // Se lee la cadena, no un `Date`: `new Date('2026-07-01')` es medianoche
      // UTC y en Bogotá retrocede al 30 de junio, así que una auditoría del 1
      // de julio caía en S1 y una del 1 de enero, en el año anterior. Además
      // daba resultados distintos en el navegador y en el servidor.
      const anio = anioDe(informe.fecha_auditoria)
      if (!anio) return

      aniosSet.add(anio)
      periodosSet.add(periodoDe(informe.fecha_auditoria))
    })

    // Convertir a arrays y ordenar
    const anios = Array.from(aniosSet).sort((a, b) => b - a)
    const periodos = Array.from(periodosSet).sort((a, b) => {
      const [anioA, semA] = a.split('-')
      const [anioB, semB] = b.split('-')
      
      if (anioA !== anioB) return parseInt(anioB) - parseInt(anioA)
      return semB.localeCompare(semA)
    })

    // Extraer semestres únicos (normalmente siempre S1 y S2, pero por si acaso)
    const semestresSet = new Set()
    periodos.forEach(p => {
      const [, sem] = p.split('-')
      semestresSet.add(sem)
    })
    const semestres = Array.from(semestresSet).sort()

    return NextResponse.json({
      periodos,
      anios,
      semestres,
      masReciente: periodos[0] || null // El periodo más reciente
    })

  } catch (err) {
    console.error('Error en periodos-disponibles:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
