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
  { tipo: 'plan', bucket: BUCKETS.PLANES, nombre: 'Plan de Auditoría', buildPath: buildPlanPath, diasLimite: -5 },
  { tipo: 'asistencia', bucket: BUCKETS.ASISTENCIAS, nombre: 'Asistencia', buildPath: buildAsistenciaPath, diasLimite: 2 },
  { tipo: 'evaluacion', bucket: BUCKETS.EVALUACIONES, nombre: 'Evaluación', buildPath: buildEvaluacionPath, diasLimite: 2 },
  { tipo: 'acta', bucket: BUCKETS.ACTAS, nombre: 'Acta', buildPath: buildActaPath, diasLimite: 2 },
  { tipo: 'actaCompromiso', bucket: BUCKETS.ACTAS_COMPROMISO, nombre: 'Acta de Compromiso', buildPath: buildActaCompromisoPath, diasLimite: 15 },
  { tipo: 'validacion', bucket: BUCKETS.VALIDACIONES, nombre: 'Validación', buildPath: buildValidationPath, diasLimite: 10 },
]

// Calcula la fecha límite para un tipo de archivo
function calcularFechaLimite(fechaAuditoria, diasLimite) {
  const fecha = new Date(fechaAuditoria + 'T00:00:00')
  fecha.setDate(fecha.getDate() + diasLimite)
  return fecha
}

// Formatea una fecha al formato Colombia
function formatearFecha(fecha) {
  if (!fecha) return null
  try {
    return new Intl.DateTimeFormat('es-CO', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: 'short',
      day: '2-digit'
    }).format(new Date(fecha))
  } catch {
    return new Date(fecha).toLocaleDateString()
  }
}

// Verifica si un archivo existe en el bucket y obtiene su metadata
async function getFileMetadata(supabase, bucket, path) {
  try {
    // Extraer directorio y nombre del archivo
    const lastSlash = path.lastIndexOf('/')
    const dir = lastSlash > 0 ? path.substring(0, lastSlash) : ''
    const fileName = lastSlash > 0 ? path.substring(lastSlash + 1) : path
    
    // Listar archivos en el directorio para obtener metadata completa
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(dir || undefined, { 
        limit: 1000,
        sortBy: { column: 'name', order: 'asc' }
      })
    
    if (error) {
      console.error(`Error listing files in ${bucket}/${dir}:`, error)
      return null
    }
    
    // Buscar el archivo específico
    const file = data?.find(f => f.name === fileName)
    
    if (!file) {
      return null
    }
    
    // Retornar metadata completa (usar updated_at como fecha de carga)
    return {
      existe: true,
      created_at: file.created_at,
      updated_at: file.updated_at, // Esta es la última modificación
      last_accessed_at: file.last_accessed_at,
      size: file.metadata?.size || 0,
      name: file.name
    }
  } catch (err) {
    console.error(`Error getting metadata for ${bucket}/${path}:`, err)
    return null
  }
}

// POST /api/evaluaciones-auditores/calcular-archivos
// Calcula la nota de archivos para un auditor en un periodo/dependencia
export async function POST(request) {
  console.log('\n================================')
  console.log('🚀 INICIO: Calcular archivos')
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
    
    const { auditor_id, periodo, dependencia_auditada } = body

    if (!auditor_id || !periodo || !dependencia_auditada) {
      console.error('❌ Faltan parámetros:', { auditor_id, periodo, dependencia_auditada })
      return NextResponse.json(
        { error: 'Faltan parámetros requeridos: auditor_id, periodo, dependencia_auditada' },
        { status: 400 }
      )
    }

    console.log('✅ Parámetros válidos')
    console.log(`   Auditor ID: ${auditor_id}`)
    console.log(`   Periodo: ${periodo}`)
    console.log(`   Dependencia: ${dependencia_auditada}`)

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

    console.log(`📅 Rango de fechas: ${fechaInicio} a ${fechaFin}`)

    console.log(`📅 Rango de fechas: ${fechaInicio} a ${fechaFin}`)

    // Primero obtener el ID numérico del usuario desde la tabla usuarios
    console.log('🔍 Buscando usuario en BD...')
    const { data: usuario, error: usuarioError } = await supabaseAdmin
      .from('usuarios')
      .select('usuario_id')
      .eq('auth_user_id', auditor_id)
      .single()

    if (usuarioError || !usuario) {
      console.error('❌ Error obteniendo usuario:', usuarioError)
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    const usuarioId = usuario.usuario_id
    console.log(`✅ Usuario encontrado - ID numérico: ${usuarioId}`)

    // Obtener todos los informes del auditor en el periodo
    console.log('🔍 Buscando informes...')
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
      console.error('❌ Error obteniendo informes:', informesError)
      return NextResponse.json({ error: 'Error al obtener informes' }, { status: 500 })
    }

    console.log(`📋 Informes encontrados: ${informes?.length || 0}`)
    if (informes && informes.length > 0) {
      informes.forEach(inf => {
        console.log(`   - Informe #${inf.id}: ${inf.dependencias?.nombre} (${inf.fecha_auditoria})`)
      })
    }

    // Filtrar por dependencia (fuzzy match con el nombre guardado)
    const informesFiltrados = (informes || []).filter(inf => {
      const depNombre = inf.dependencias?.nombre || ''
      const depNormalizada = toSlugUpper(depNombre)
      const buscadaNormalizada = toSlugUpper(dependencia_auditada)
      
      return depNormalizada === buscadaNormalizada || depNombre === dependencia_auditada
    })

    console.log(`🔍 Filtrado por dependencia "${dependencia_auditada}":`)
    console.log(`   Informes después del filtro: ${informesFiltrados.length}`)
    if (informesFiltrados.length > 0) {
      informesFiltrados.forEach(inf => {
        console.log(`   ✓ Informe #${inf.id}: ${inf.dependencias?.nombre}`)
      })
    }

    if (informesFiltrados.length === 0) {
      console.log('⚠️ No hay informes para esta dependencia - Guardando evaluación con nota 0')
      
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
    let totalPuntos = 0
    const detalleInformes = []

    console.log(`Procesando ${informesFiltrados.length} informes para auditor ${auditor_id}`)

    for (const informe of informesFiltrados) {
      const dependenciaNombre = informe.dependencias?.nombre || 'SIN_DEP'
      const fechaAuditoria = informe.fecha_auditoria
      
      console.log(`Procesando informe #${informe.id} - Fecha auditoría: ${fechaAuditoria}`)
      
      const informeDetalle = {
        informe_id: informe.id,
        fecha_auditoria: fechaAuditoria,
        dependencia: dependenciaNombre,
        archivos: []
      }

      // Verificar los 6 archivos en paralelo y obtener sus metadatos
      const metadataResults = await Promise.all(
        ARCHIVOS_ESPERADOS.map(async (archivoEsperado) => {
          const path = archivoEsperado.buildPath(informe)
          console.log(`Buscando archivo: ${archivoEsperado.nombre} en bucket ${archivoEsperado.bucket} - Path: ${path}`)
          
          const metadata = await getFileMetadata(supabaseAdmin, archivoEsperado.bucket, path)
          
          if (metadata) {
            console.log(`✓ Archivo encontrado: ${archivoEsperado.nombre}`, {
              updated_at: metadata.updated_at,
              created_at: metadata.created_at,
              size: metadata.size
            })
          } else {
            console.log(`✗ Archivo NO encontrado: ${archivoEsperado.nombre}`)
          }
          
          // Calcular fecha límite
          const fechaLimite = calcularFechaLimite(fechaAuditoria, archivoEsperado.diasLimite)
          console.log(`Fecha límite para ${archivoEsperado.nombre}: ${formatearFecha(fechaLimite)} (${archivoEsperado.diasLimite} días desde auditoría)`)
          
          let puntos = 0
          let estado = 'No entregado'
          let fechaCarga = null
          let diasRetraso = null
          
          if (metadata && metadata.existe) {
            // Usar updated_at (última modificación) como fecha de carga
            fechaCarga = new Date(metadata.updated_at || metadata.created_at)
            const diferenciaMs = fechaCarga - fechaLimite
            diasRetraso = Math.ceil(diferenciaMs / (1000 * 60 * 60 * 24))
            
            console.log(`Análisis de ${archivoEsperado.nombre}: Cargado el ${formatearFecha(fechaCarga)}, límite ${formatearFecha(fechaLimite)}, retraso: ${diasRetraso} días`)
            
            if (diasRetraso <= 0) {
              // Entregado a tiempo o antes
              puntos = 5
              estado = diasRetraso === 0 ? 'A tiempo' : `Anticipado (${Math.abs(diasRetraso)} día${Math.abs(diasRetraso) !== 1 ? 's' : ''})`
            } else {
              // Entregado tarde
              puntos = 1
              estado = `Tarde (${diasRetraso} día${diasRetraso !== 1 ? 's' : ''})`
            }
          }
          
          return {
            tipo: archivoEsperado.tipo,
            nombre: archivoEsperado.nombre,
            path: path,
            existe: metadata ? metadata.existe : false,
            fechaLimite: fechaLimite.toISOString(),
            fechaLimiteFormateada: formatearFecha(fechaLimite),
            fechaCarga: fechaCarga ? fechaCarga.toISOString() : null,
            fechaCargaFormateada: fechaCarga ? formatearFecha(fechaCarga) : null,
            diasRetraso: diasRetraso,
            puntos: puntos,
            estado: estado
          }
        })
      )

      // Procesar resultados
      for (const archivoInfo of metadataResults) {
        totalEsperados++
        totalPuntos += archivoInfo.puntos
        informeDetalle.archivos.push(archivoInfo)
      }

      detalleInformes.push(informeDetalle)
    }

    // Calcular nota promedio (promedio de puntos obtenidos)
    const nota_archivos = totalEsperados > 0
      ? Number((totalPuntos / totalEsperados).toFixed(2))
      : 0
    
    // Calcular archivos cargados (existe = true)
    const totalCargados = detalleInformes.reduce((acc, inf) => {
      return acc + inf.archivos.filter(a => a.existe).length
    }, 0)
    
    // Calcular porcentaje de completitud
    const porcentaje = totalEsperados > 0 
      ? Math.round((totalCargados / totalEsperados) * 100)
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
          total_puntos: totalPuntos,
          porcentaje: porcentaje,
          metodo_calculo: 'Basado en fechas límite: 5 puntos si se entrega a tiempo, 1 punto si se entrega tarde'
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

    console.log(`\n✅ PROCESO COMPLETADO`)
    console.log(`   Nota final: ${nota_archivos}`)
    console.log(`   Archivos: ${totalCargados}/${totalEsperados}`)
    console.log(`   Puntos totales: ${totalPuntos}`)
    console.log('================================\n')

    return NextResponse.json({
      success: true,
      nota_archivos: nota_archivos,
      archivos_esperados: totalEsperados,
      archivos_cargados: totalCargados,
      total_puntos: totalPuntos,
      porcentaje_completitud: porcentaje,
      detalle: {
        informes: detalleInformes,
        total_esperados: totalEsperados,
        total_cargados: totalCargados,
        total_puntos: totalPuntos
      }
    })

  } catch (err) {
    console.error('💥 Error en calcular-archivos:', err)
    console.error('Stack trace:', err.stack)
    return NextResponse.json(
      { error: err.message || 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
