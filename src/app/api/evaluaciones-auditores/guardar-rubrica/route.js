import { requireRole } from '@/lib/api/guard'
import { withRoute } from '@/lib/api/handler'
import { fromPostgresError } from '@/lib/api/errors'
import { json } from '@/lib/api/response'
import { ROLES } from '@/lib/auth/roles'
import { guardarRubricaSchema } from '@/features/evaluaciones/dto/evaluacion-dto'

export const POST = withRoute(async (request) => {
  const guard = await requireRole(ROLES.ADMIN)
  if (!guard.ok) return guard.response

  const supabase = guard.admin
  const { evaluacion_id, rubrica_respuestas, nota_rubrica } = guardarRubricaSchema.parse(
    await request.json()
  )

  const { data, error } = await supabase
    .from('evaluaciones_auditores')
    .update({
      rubrica_respuestas,
      nota_rubrica,
      updated_at: new Date().toISOString(),
    })
    .eq('id', evaluacion_id)
    .select()

  if (error) throw fromPostgresError(error, 'Error al actualizar evaluación')

  // Recalcular la nota final con la función de PostgreSQL. Si falla, la rúbrica
  // ya quedó guardada: se avisa pero no se considera error.
  //
  // El parámetro se llama `evaluacion_id`. Iba como `evaluacion_id_param`, que
  // no existe, así que Postgres devolvía «función no encontrada» y la nota
  // final no se recalculaba nunca al guardar una rúbrica; como el fallo solo
  // se avisaba, nadie se enteraba.
  const { error: recalcError } = await supabase.rpc('calcular_nota_final', {
    evaluacion_id,
  })

  if (recalcError) {
    console.error('Error recalculando nota final:', recalcError)
    return json({
      success: true,
      message: 'Rúbrica guardada correctamente',
      warning: 'No se pudo recalcular la nota final automáticamente',
      data,
    })
  }

  return json({
    success: true,
    message: 'Evaluación de rúbrica guardada exitosamente',
    data,
    nota_final_recalculada: true,
  })
})
