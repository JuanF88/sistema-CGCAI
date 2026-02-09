import { NextResponse } from 'next/server'
import { getAuthenticatedClient } from '@/lib/authHelper'
import { createClient } from '@supabase/supabase-js'
import {
  toSlugUpper,
  buildPlanPath,
  buildAsistenciaPath,
  buildEvaluacionPath,
  buildActaPath,
  buildActaCompromisoPath,
  buildValidationPath,
  BUCKETS
} from '@/hooks/useAuditTimeline'

// Tipos de archivos esperados para cada auditoría
const ARCHIVOS_ESPERADOS = [
  { tipo: 'plan', bucket: BUCKETS.PLANES, nombre: 'Plan de Auditoría', buildPath: buildPlanPath },
  { tipo: 'asistencia', bucket: BUCKETS.ASISTENCIAS, nombre: 'Asistencia', buildPath: buildAsistenciaPath },
  { tipo: 'evaluacion', bucket: BUCKETS.EVALUACIONES, nombre: 'Evaluación', buildPath: buildEvaluacionPath },
  { tipo: 'acta', bucket: BUCKETS.ACTAS, nombre: 'Acta', buildPath: buildActaPath },
  { tipo: 'actaCompromiso', bucket: BUCKETS.ACTAS_COMPROMISO, nombre: 'Acta de Compromiso', buildPath: buildActaCompromisoPath },
  { tipo: 'validacion', bucket: BUCKETS.VALIDACIONES, nombre: 'Validación', buildPath: buildValidationPath },
]

// Verifica si un archivo existe en el bucket (misma lógica que Centro de Control)
async function fileExists(supabase, bucket, path) {
  try {
    // Extraer directorio y nombre del archivo
    const lastSlash = path.lastIndexOf('/')
    const dir = lastSlash > 0 ? path.substring(0, lastSlash) : ''
    const fileName = lastSlash > 0 ? path.substring(lastSlash + 1) : path
    
    // Listar archivos en el directorio
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(dir, { limit: 1000 })
    
    if (error) {
      return false
    }
    
    const exists = data?.some(file => file.name === fileName) || false
    
    return exists
  } catch (err) {
    return false
  }
}

// POST /api/evaluaciones-auditores/calcular-archivos
// Calcula la nota de archivos para un auditor en un periodo/dependencia
export async function POST(request) {
  const { usuario, error } = await getAuthenticatedClient()
  
  if (error) {
    return NextResponse.json({ error }, { status: 401 })
  }

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
    const { auditor_id, periodo, dependencia_auditada } = body

    if (!auditor_id || !periodo || !dependencia_auditada) {
      return NextResponse.json(
        { error: 'Faltan parámetros requeridos: auditor_id, periodo, dependencia_auditada' },
        { status: 400 }
      )
    }

    // Determinar rango de fechas del periodo
    const [anio, semestreStr] = periodo.split('-')
    const semestre = parseInt(semestreStr.replace('S', ''))
    
    let fechaInicio, fechaFin
    if (semestre === 1) {
      fechaInicio = `${anio}-01-01`
      fechaFin = `${anio}-06-30`
    } else {
      fechaInicio = `${anio}-07-01`
      fechaFin = `${anio}-12-31`
    }

    // Primero obtener el ID numérico del usuario desde la tabla usuarios
    const { data: usuario, error: usuarioError } = await supabaseAdmin
      .from('usuarios')
      .select('usuario_id')
      .eq('auth_user_id', auditor_id)
      .single()

    if (usuarioError || !usuario) {
      console.error('Error obteniendo usuario:', usuarioError)
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    const usuarioId = usuario.usuario_id

    // Obtener todos los informes del auditor en el periodo
    // usuario_id en informes_auditoria es el ID numérico (bigint)
    const { data: informes, error: informesError } = await supabaseAdmin
      .from('informes_auditoria')
      .select(`
        id,
        fecha_auditoria,
        dependencia_id,
        dependencias:dependencias (nombre)
      `)
      .eq('usuario_id', usuarioId)
      .gte('fecha_auditoria', fechaInicio)
      .lte('fecha_auditoria', fechaFin)

    if (informesError) {
      console.error('Error obteniendo informes:', informesError)
      return NextResponse.json({ error: 'Error al obtener informes' }, { status: 500 })
    }

    // Filtrar por dependencia (fuzzy match con el nombre guardado)
    const informesFiltrados = (informes || []).filter(inf => {
      const depNombre = inf.dependencias?.nombre || ''
      const depNormalizada = toSlugUpper(depNombre)
      const buscadaNormalizada = toSlugUpper(dependencia_auditada)
      
      return depNormalizada === buscadaNormalizada || depNombre === dependencia_auditada
    })

    if (informesFiltrados.length === 0) {
      // No hay informes, marcar todo en 0
      const { data: evaluacionActualizada, error: updateError } = await supabaseAdmin
        .from('evaluaciones_auditores')
        .update({
          informe_auditoria_id: null,
          nota_archivos: 0,
          archivos_esperados: 0,
          archivos_cargados: 0,
          porcentaje_completitud: 0,
          detalle_archivos: { 
            informes: [],
            total_esperados: 0,
            total_cargados: 0,
            mensaje: 'No se encontraron informes de auditoría en este periodo para esta dependencia'
          },
          updated_at: new Date().toISOString()
        })
        .eq('auditor_id', auditor_id)
        .eq('periodo', periodo)
        .eq('dependencia_auditada', dependencia_auditada)
        .select('id')
        .single()

      if (updateError) {
        console.error('Error actualizando evaluación:', updateError)
        return NextResponse.json({ error: 'Error al actualizar evaluación' }, { status: 500 })
      }

      // Recalcular nota final usando el ID de la evaluación
      if (evaluacionActualizada?.id) {
        await supabaseAdmin.rpc('calcular_nota_final', {
          evaluacion_id: evaluacionActualizada.id
        })
      }

      return NextResponse.json({
        success: true,
        nota_archivos: 0,
        archivos_esperados: 0,
        archivos_cargados: 0,
        porcentaje_completitud: 0,
        detalle: {
          informes: [],
          mensaje: 'No se encontraron informes en el periodo'
        }
      })
    }

    // Verificar archivos para cada informe (usando misma lógica que Centro de Control)
    let totalEsperados = 0
    let totalCargados = 0
    const detalleInformes = []

    for (const informe of informesFiltrados) {
      const dependenciaNombre = informe.dependencias?.nombre || 'SIN_DEP'
      const informeDetalle = {
        informe_id: informe.id,
        fecha_auditoria: informe.fecha_auditoria,
        dependencia: dependenciaNombre,
        archivos: {}
      }

      // Verificar los 6 archivos en paralelo (como en Centro de Control)
      const [hasPlan, hasAsis, hasEval, hasActa, hasActaComp, hasValid] = await Promise.all([
        fileExists(supabaseAdmin, BUCKETS.PLANES, buildPlanPath(informe)),
        fileExists(supabaseAdmin, BUCKETS.ASISTENCIAS, buildAsistenciaPath(informe)),
        fileExists(supabaseAdmin, BUCKETS.EVALUACIONES, buildEvaluacionPath(informe)),
        fileExists(supabaseAdmin, BUCKETS.ACTAS, buildActaPath(informe)),
        fileExists(supabaseAdmin, BUCKETS.ACTAS_COMPROMISO, buildActaCompromisoPath(informe)),
        fileExists(supabaseAdmin, BUCKETS.VALIDACIONES, buildValidationPath(informe)),
      ])

      const archivosStatus = [
        { tipo: 'plan', existe: hasPlan, nombre: 'Plan de Auditoría', path: buildPlanPath(informe) },
        { tipo: 'asistencia', existe: hasAsis, nombre: 'Asistencia', path: buildAsistenciaPath(informe) },
        { tipo: 'evaluacion', existe: hasEval, nombre: 'Evaluación', path: buildEvaluacionPath(informe) },
        { tipo: 'acta', existe: hasActa, nombre: 'Acta', path: buildActaPath(informe) },
        { tipo: 'actaCompromiso', existe: hasActaComp, nombre: 'Acta de Compromiso', path: buildActaCompromisoPath(informe) },
        { tipo: 'validacion', existe: hasValid, nombre: 'Validación', path: buildValidationPath(informe) },
      ]

      for (const archivo of archivosStatus) {
        totalEsperados++
        informeDetalle.archivos[archivo.tipo] = {
          nombre: archivo.nombre,
          path: archivo.path,
          existe: archivo.existe
        }
        if (archivo.existe) {
          totalCargados++
        }
      }

      detalleInformes.push(informeDetalle)
    }

    // Calcular porcentaje y nota
    const porcentaje = totalEsperados > 0 
      ? Math.round((totalCargados / totalEsperados) * 100)
      : 0
    
    const nota_archivos = totalEsperados > 0
      ? Number(((totalCargados / totalEsperados) * 5).toFixed(2))
      : 0

    // Si hay informes, vincular el primero (o el más reciente) como informe principal
    const informePrincipalId = informesFiltrados.length > 0 
      ? informesFiltrados[informesFiltrados.length - 1].id 
      : null

    // Actualizar evaluación
    const { data: evaluacionActualizada, error: updateError } = await supabaseAdmin
      .from('evaluaciones_auditores')
      .update({
        informe_auditoria_id: informePrincipalId,
        nota_archivos: nota_archivos,
        archivos_esperados: totalEsperados,
        archivos_cargados: totalCargados,
        porcentaje_completitud: porcentaje,
        detalle_archivos: {
          informes: detalleInformes,
          total_esperados: totalEsperados,
          total_cargados: totalCargados,
          porcentaje: porcentaje
        },
        updated_at: new Date().toISOString()
      })
      .eq('auditor_id', auditor_id)
      .eq('periodo', periodo)
      .eq('dependencia_auditada', dependencia_auditada)
      .select('id')
      .single()

    if (updateError) {
      console.error('Error actualizando evaluación:', updateError)
      return NextResponse.json({ error: 'Error al actualizar evaluación' }, { status: 500 })
    }

    // Recalcular nota final usando el ID de la evaluación
    if (evaluacionActualizada?.id) {
      const { error: rpcError } = await supabaseAdmin.rpc('calcular_nota_final', {
        evaluacion_id: evaluacionActualizada.id
      })

      if (rpcError) {
        console.error('Error calculando nota final:', rpcError)
      }
    }

    return NextResponse.json({
      success: true,
      nota_archivos: nota_archivos,
      archivos_esperados: totalEsperados,
      archivos_cargados: totalCargados,
      porcentaje_completitud: porcentaje,
      detalle: {
        informes: detalleInformes,
        total_esperados: totalEsperados,
        total_cargados: totalCargados
      }
    })

  } catch (err) {
    console.error('Error en calcular-archivos:', err)
    return NextResponse.json(
      { error: err.message || 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
