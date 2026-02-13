import { NextResponse } from 'next/server'
import { getAuthenticatedClient } from '@/lib/authHelper'
import { createClient } from '@supabase/supabase-js'

// POST /api/evaluaciones-auditores/actualizar-fechas
// Actualiza manualmente las fechas de entrega de archivos
export async function POST(request) {
  console.log('\n================================')
  console.log('📝 INICIO: Actualizar fechas manualmente')
  console.log('================================')
  
  const { usuario, error } = await getAuthenticatedClient()
  
  if (error) {
    console.error('❌ Error de autenticación:', error)
    return NextResponse.json({ error }, { status: 401 })
  }

  if (usuario?.rol !== 'admin') {
    console.error('❌ Usuario no autorizado:', usuario?.rol)
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  console.log('✅ Usuario autenticado:', usuario.email)

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  try {
    const body = await request.json()
    console.log('📦 Body recibido:', body)
    
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

    // Actualizar evaluación con las fechas modificadas manualmente
    const { data: evaluacionActualizada, error: updateError } = await supabaseAdmin
      .from('evaluaciones_auditores')
      .update({
        detalle_archivos: detalle_archivos,
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
