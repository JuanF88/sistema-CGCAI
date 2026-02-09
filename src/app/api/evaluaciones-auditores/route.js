import { NextResponse } from 'next/server'
import { getAuthenticatedClient } from '@/lib/authHelper'
import { createClient } from '@supabase/supabase-js'

// GET /api/evaluaciones-auditores
// Carga evaluaciones basándose en informes_auditoria del periodo
export async function GET(request) {
  const { usuario, error } = await getAuthenticatedClient()
  
  if (error) {
    return NextResponse.json({ error }, { status: 401 })
  }

  // Solo admin puede ver evaluaciones
  if (usuario?.rol !== 'admin' && usuario?.rol !== 'visualizador') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  // Usar service role para consultas
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  try {
    const { searchParams } = new URL(request.url)
    const periodo = searchParams.get('periodo') // Formato: "2024-S1"
    const anio = searchParams.get('anio')
    const auditor_id = searchParams.get('auditor_id')

    // Determinar rango de fechas
    let fechaInicio, fechaFin
    if (periodo) {
      const [anioStr, semestreStr] = periodo.split('-')
      const semestre = parseInt(semestreStr.replace('S', ''))
      
      if (semestre === 1) {
        fechaInicio = `${anioStr}-01-01`
        fechaFin = `${anioStr}-06-30`
      } else {
        fechaInicio = `${anioStr}-07-01`
        fechaFin = `${anioStr}-12-31`
      }
    } else if (anio) {
      fechaInicio = `${anio}-01-01`
      fechaFin = `${anio}-12-31`
    }

    // Si se filtró por auditor_id (UUID), convertir a ID numérico
    let usuarioIdNumerico = null
    if (auditor_id) {
      const { data: usuarioData } = await supabase
        .from('usuarios')
        .select('usuario_id')
        .eq('auth_user_id', auditor_id)
        .single()
      
      usuarioIdNumerico = usuarioData?.usuario_id
    }

    // 1. Obtener TODOS los informes del periodo
    let queryInformes = supabase
      .from('informes_auditoria')
      .select(`
        id,
        fecha_auditoria,
        usuario_id,
        dependencia_id,
        usuarios:usuario_id (
          auth_user_id,
          nombre,
          apellido,
          email
        ),
        dependencias:dependencia_id (
          dependencia_id,
          nombre
        )
      `)
      .gte('fecha_auditoria', fechaInicio)
      .lte('fecha_auditoria', fechaFin)
      .order('fecha_auditoria', { ascending: false })

    if (usuarioIdNumerico) {
      queryInformes = queryInformes.eq('usuario_id', usuarioIdNumerico)
    }

    const { data: informes, error: informesError } = await queryInformes

    if (informesError) {
      console.error('Error obteniendo informes:', informesError)
      return NextResponse.json({ error: informesError.message }, { status: 500 })
    }

    if (!informes || informes.length === 0) {
      return NextResponse.json({
        evaluaciones: [],
        auditores: []
      })
    }

    // 2. Por cada informe, crear o buscar su evaluación
    const evaluaciones = []
    
    for (const informe of informes) {
      const auditor = informe.usuarios
      const dependencia = informe.dependencias
      
      if (!auditor || !dependencia) continue

      // Determinar periodo del informe
      const fechaAud = new Date(informe.fecha_auditoria)
      const anioInf = fechaAud.getFullYear()
      const mes = fechaAud.getMonth() + 1
      const semestreInf = mes <= 6 ? 'S1' : 'S2'
      const periodoInf = `${anioInf}-${semestreInf}`

      // Buscar evaluación existente
      const { data: evalExistente } = await supabase
        .from('evaluaciones_auditores')
        .select('*')
        .eq('informe_auditoria_id', informe.id)
        .maybeSingle()

      let evaluacion = evalExistente

      if (!evaluacion) {
        // Crear evaluación automáticamente
        const { data: nuevaEval, error: createError } = await supabase
          .from('evaluaciones_auditores')
          .insert({
            auditor_id: auditor.auth_user_id,
            informe_auditoria_id: informe.id,
            dependencia_auditada: dependencia.nombre,
            dependencia_id: dependencia.dependencia_id,
            periodo: periodoInf,
            anio: anioInf,
            estado: 'borrador'
          })
          .select()
          .single()

        if (createError) {
          console.error('Error creando evaluación:', createError)
          continue
        }

        evaluacion = nuevaEval
      }

      // Agregar info completa
      evaluaciones.push({
        ...evaluacion,
        informe_auditoria_id: informe.id,
        fecha_auditoria: informe.fecha_auditoria,
        auditor_nombre: auditor.nombre,
        auditor_apellido: auditor.apellido,
        auditor_email: auditor.email,
        auditor_dependencia_nombre: dependencia.nombre
      })
    }

    // Ordenar por nombre de auditor
    evaluaciones.sort((a, b) => {
      const nombreA = `${a.auditor_nombre} ${a.auditor_apellido}`.toLowerCase()
      const nombreB = `${b.auditor_nombre} ${b.auditor_apellido}`.toLowerCase()
      return nombreA.localeCompare(nombreB)
    })

    // Obtener lista de auditores
    const { data: auditores } = await supabase
      .from('usuarios')
      .select('auth_user_id, nombre, apellido, email')
      .eq('rol', 'auditor')
      .eq('estado', 'activo')

    return NextResponse.json({
      evaluaciones: evaluaciones || [],
      auditores: auditores || [],
      total: evaluaciones?.length || 0
    })

  } catch (err) {
    console.error('Error en GET evaluaciones:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST /api/evaluaciones-auditores
// Crea o actualiza una evaluación
export async function POST(request) {
  const { usuario, error } = await getAuthenticatedClient()
  
  if (error) {
    return NextResponse.json({ error }, { status: 401 })
  }

  // Solo admin puede crear evaluaciones
  if (usuario?.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  try {
    const body = await request.json()
    const {
      auditor_id,
      auditoria_id,
      periodo,
      anio,
      nota_archivos,
      nota_encuesta,
      nota_rubrica,
      observaciones_generales,
      estado
    } = body

    if (!auditor_id || !periodo || !anio) {
      return NextResponse.json({ 
        error: 'auditor_id, periodo y anio son obligatorios' 
      }, { status: 400 })
    }

    // Verificar si ya existe una evaluación para este auditor/periodo
    const { data: existing } = await supabaseAdmin
      .from('evaluaciones_auditores')
      .select('id')
      .eq('auditor_id', auditor_id)
      .eq('periodo', periodo)
      .eq('auditoria_id', auditoria_id || null)
      .single()

    let result

    if (existing) {
      // Actualizar evaluación existente
      const { data, error: updateError } = await supabaseAdmin
        .from('evaluaciones_auditores')
        .update({
          nota_archivos,
          nota_encuesta,
          nota_rubrica,
          observaciones_generales,
          estado,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()
        .single()

      if (updateError) throw updateError
      result = data

      // Recalcular nota final
      await supabaseAdmin.rpc('calcular_nota_final', { evaluacion_id: existing.id })

    } else {
      // Crear nueva evaluación
      const { data, error: insertError } = await supabaseAdmin
        .from('evaluaciones_auditores')
        .insert({
          auditor_id,
          auditoria_id,
          periodo,
          anio,
          nota_archivos,
          nota_encuesta,
          nota_rubrica,
          observaciones_generales,
          estado: estado || 'borrador'
        })
        .select()
        .single()

      if (insertError) throw insertError
      result = data

      // Recalcular nota final
      if (result.id) {
        await supabaseAdmin.rpc('calcular_nota_final', { evaluacion_id: result.id })
      }
    }

    return NextResponse.json({
      success: true,
      evaluacion: result
    })

  } catch (err) {
    console.error('Error en POST evaluacion:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
