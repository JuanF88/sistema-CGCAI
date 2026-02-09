import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request) {
  try {
    const body = await request.json()
    const { evaluacion_id, rubrica_respuestas, nota_rubrica } = body

    if (!evaluacion_id) {
      return NextResponse.json(
        { error: 'evaluacion_id es requerido' },
        { status: 400 }
      )
    }

    if (!rubrica_respuestas || typeof rubrica_respuestas !== 'object') {
      return NextResponse.json(
        { error: 'rubrica_respuestas debe ser un objeto válido' },
        { status: 400 }
      )
    }

    if (nota_rubrica === null || nota_rubrica === undefined) {
      return NextResponse.json(
        { error: 'nota_rubrica es requerida' },
        { status: 400 }
      )
    }

    // Validar que la nota esté en el rango válido (0-5)
    const notaFinal = parseFloat(nota_rubrica)
    if (isNaN(notaFinal) || notaFinal < 0 || notaFinal > 5) {
      return NextResponse.json(
        { error: 'nota_rubrica debe estar entre 0 y 5' },
        { status: 400 }
      )
    }

    // Actualizar la evaluación con los datos de la rúbrica
    const { data: updateData, error: updateError } = await supabase
      .from('evaluaciones_auditores')
      .update({
        rubrica_respuestas: rubrica_respuestas,
        nota_rubrica: notaFinal,
        updated_at: new Date().toISOString()
      })
      .eq('id', evaluacion_id)
      .select()

    if (updateError) {
      console.error('Error actualizando evaluación:', updateError)
      return NextResponse.json(
        { error: 'Error al actualizar evaluación: ' + updateError.message },
        { status: 500 }
      )
    }

    // Después de actualizar la nota de rúbrica, recalcular la nota final
    // usando la función calcular_nota_final de PostgreSQL
    const { data: recalcData, error: recalcError } = await supabase
      .rpc('calcular_nota_final', { evaluacion_id_param: evaluacion_id })

    if (recalcError) {
      console.error('Error recalculando nota final:', recalcError)
      // No retornamos error porque la rúbrica sí se guardó correctamente
      // Solo notificamos el problema del recálculo
      return NextResponse.json({
        success: true,
        message: 'Rúbrica guardada correctamente',
        warning: 'No se pudo recalcular la nota final automáticamente',
        data: updateData
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Evaluación de rúbrica guardada exitosamente',
      data: updateData,
      nota_final_recalculada: true
    })

  } catch (error) {
    console.error('Error en guardar-rubrica:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor: ' + error.message },
      { status: 500 }
    )
  }
}
