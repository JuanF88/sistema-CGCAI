import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/api/guard'
import { ROLES } from '@/lib/auth/roles'

// POST /api/evaluaciones-auditores/actualizar-fechas
// Actualiza manualmente las fechas de entrega de archivos
export async function POST(request) {
  const guard = await requireRole(ROLES.ADMIN)
  if (!guard.ok) return guard.response

  const supabaseAdmin = guard.admin

  try {
    const body = await request.json()

    const { 
      evaluacion_id, 
      detalle_archivos, 
      nota_archivos, 
      archivos_cargados,
      porcentaje_completitud 
    } = body

    if (!evaluacion_id || !detalle_archivos) {
      console.error('❌ Faltan parámetros:', { evaluacion_id, detalle_archivos })
      return NextResponse.json(
        { error: 'Faltan parámetros requeridos: evaluacion_id, detalle_archivos' },
        { status: 400 }
      )
    }

    console.log('✅ Parámetros válidos')
    console.log(`   Evaluación ID: ${evaluacion_id}`)
    console.log(`   Nueva nota: ${nota_archivos}`)
    console.log(`   Archivos cargados: ${archivos_cargados}`)

    // Marcar archivos como editados manualmente (solo los que fueron editados en esta sesión)
    const detalle_archivos_marcado = {
      ...detalle_archivos,
      informes: detalle_archivos.informes?.map(informe => ({
        ...informe,
        archivos: (Array.isArray(informe.archivos) ? informe.archivos : Object.values(informe.archivos || {})).map(archivo => {
          // Si fue editado en esta sesión, marcar como editado manualmente
          // Si ya estaba marcado de antes, mantener el flag
          const esNuevoManual = archivo.fue_editado_en_sesion_actual === true
          
          return {
            ...archivo,
            editado_manualmente: esNuevoManual || archivo.editado_manualmente === true,
            fue_editado_en_sesion_actual: undefined // Limpiar flag temporal del frontend
          }
        })
      })) || []
    }

    // Actualizar evaluación con las fechas modificadas manualmente
    const { data: evaluacionActualizada, error: updateError } = await supabaseAdmin
      .from('evaluaciones_auditores')
      .update({
        detalle_archivos: detalle_archivos_marcado,
        nota_archivos: nota_archivos,
        archivos_cargados: archivos_cargados,
        porcentaje_completitud: porcentaje_completitud,
        updated_at: new Date().toISOString()
      })
      .eq('id', evaluacion_id)
      .select('id')
      .single()

    if (updateError) {
      console.error('❌ Error actualizando evaluación:', updateError)
      return NextResponse.json({ error: 'Error al actualizar evaluación' }, { status: 500 })
    }

    console.log('✅ Evaluación actualizada exitosamente')

    // Recalcular nota final usando el ID de la evaluación
    if (evaluacionActualizada?.id) {
      console.log('🔄 Recalculando nota final...')
      const { error: rpcError } = await supabaseAdmin.rpc('calcular_nota_final', {
        evaluacion_id: evaluacionActualizada.id
      })

      if (rpcError) {
        console.error('⚠️ Error calculando nota final:', rpcError)
      } else {
        console.log('✅ Nota final recalculada')
      }
    }

    console.log('✅ PROCESO COMPLETADO')
    console.log('================================\n')

    return NextResponse.json({
      success: true,
      message: 'Fechas actualizadas correctamente',
      evaluacion_id: evaluacion_id,
      nota_archivos: nota_archivos
    })

  } catch (err) {
    console.error('💥 Error en actualizar-fechas:', err)
    console.error('Stack trace:', err.stack)
    return NextResponse.json(
      { error: err.message || 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
