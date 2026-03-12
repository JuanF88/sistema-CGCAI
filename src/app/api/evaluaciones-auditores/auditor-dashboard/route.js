import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedClient } from '@/lib/authHelper'

export async function GET(request) {
  const { usuario, error } = await getAuthenticatedClient()

  if (error) {
    return NextResponse.json({ error }, { status: 401 })
  }

  if (usuario?.rol !== 'admin' && usuario?.rol !== 'visualizador') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  try {
    const { searchParams } = new URL(request.url)
    const auditorId = searchParams.get('auditor_id')

    if (!auditorId) {
      return NextResponse.json({ error: 'auditor_id es obligatorio' }, { status: 400 })
    }

    const { data: auditor, error: auditorError } = await supabase
      .from('usuarios')
      .select(`
        usuario_id,
        auth_user_id,
        nombre,
        apellido,
        email,
        rol,
        estado,
        tipo_personal,
        estudios,
        tipo_estudio,
        celular,
        dependencias:dependencia_id (
          dependencia_id,
          nombre
        )
      `)
      .eq('auth_user_id', auditorId)
      .maybeSingle()

    if (auditorError) {
      return NextResponse.json({ error: auditorError.message }, { status: 500 })
    }

    if (!auditor) {
      return NextResponse.json({ error: 'Auditor no encontrado' }, { status: 404 })
    }

    const { data: informes, error: informesError } = await supabase
      .from('informes_auditoria')
      .select(`
        id,
        fecha_auditoria,
        fecha_seguimiento,
        asistencia_tipo,
        usuario_id,
        dependencia_id,
        dependencias:dependencia_id (
          dependencia_id,
          nombre
        )
      `)
      .eq('usuario_id', auditor.usuario_id)
      .order('fecha_auditoria', { ascending: false })

    if (informesError) {
      return NextResponse.json({ error: informesError.message }, { status: 500 })
    }

    const informeIds = (informes || []).map((informe) => informe.id)

    let evaluaciones = []
    if (informeIds.length) {
      const { data: evaluacionesData, error: evaluacionesError } = await supabase
        .from('evaluaciones_auditores')
        .select(`
          id,
          auditor_id,
          informe_auditoria_id,
          periodo,
          anio,
          estado,
          nota_archivos,
          nota_encuesta,
          nota_rubrica,
          nota_final,
          rubrica_respuestas,
          observaciones_generales,
          detalle_archivos,
          created_at,
          updated_at
        `)
        .in('informe_auditoria_id', informeIds)

      if (evaluacionesError) {
        return NextResponse.json({ error: evaluacionesError.message }, { status: 500 })
      }

      evaluaciones = evaluacionesData || []
    }

    const evaluacionesPorInforme = new Map(
      evaluaciones.map((evaluacion) => [evaluacion.informe_auditoria_id, evaluacion])
    )

    const auditorias = (informes || []).map((informe) => {
      const evaluacion = evaluacionesPorInforme.get(informe.id) || null
      const fecha = informe.fecha_auditoria ? new Date(informe.fecha_auditoria) : null
      const anio = fecha && !Number.isNaN(fecha.getTime()) ? fecha.getFullYear() : null

      return {
        informe_id: informe.id,
        fecha_auditoria: informe.fecha_auditoria,
        fecha_seguimiento: informe.fecha_seguimiento,
        asistencia_tipo: informe.asistencia_tipo,
        dependencia_nombre: informe.dependencias?.nombre || 'Sin dependencia',
        anio,
        periodo: evaluacion?.periodo || (anio ? `${anio}-${fecha.getMonth() < 6 ? 'S1' : 'S2'}` : null),
        estado_evaluacion: evaluacion?.estado || 'sin_evaluacion',
        nota_archivos: evaluacion?.nota_archivos ?? null,
        nota_encuesta: evaluacion?.nota_encuesta ?? null,
        nota_rubrica: evaluacion?.nota_rubrica ?? null,
        nota_final: evaluacion?.nota_final ?? null,
        rubrica_respuestas: evaluacion?.rubrica_respuestas || {},
        observaciones_generales: evaluacion?.observaciones_generales || '',
        evaluacion_id: evaluacion?.id || null,
      }
    })

    // Actualizar estado a 'completa' si todas las notas están presentes
    const evaluacionesAActualizar = auditorias.filter((auditoria) => {
      if (!auditoria.evaluacion_id) return false
      const tieneTodasLasNotas =
        typeof auditoria.nota_archivos === 'number' &&
        typeof auditoria.nota_encuesta === 'number' &&
        typeof auditoria.nota_rubrica === 'number'
      const estadoEsBorrador = auditoria.estado_evaluacion === 'borrador'
      return tieneTodasLasNotas && estadoEsBorrador
    })

    // Actualizar en paralelo
    if (evaluacionesAActualizar.length > 0) {
      await Promise.all(
        evaluacionesAActualizar.map((auditoria) =>
          supabase
            .from('evaluaciones_auditores')
            .update({ estado: 'completa' })
            .eq('id', auditoria.evaluacion_id)
        )
      )

      // Actualizar el estado en los objetos locales
      evaluacionesAActualizar.forEach((auditoria) => {
        auditoria.estado_evaluacion = 'completa'
      })
    }

    const resumenPorAnioMap = new Map()

    auditorias.forEach((auditoria) => {
      if (!auditoria.anio) return

      if (!resumenPorAnioMap.has(auditoria.anio)) {
        resumenPorAnioMap.set(auditoria.anio, {
          anio: auditoria.anio,
          auditorias: 0,
          sumaNotaFinal: 0,
          notasFinales: 0,
          sumaNotaArchivos: 0,
          notasArchivos: 0,
          sumaNotaEncuesta: 0,
          notasEncuesta: 0,
          sumaNotaRubrica: 0,
          notasRubrica: 0,
        })
      }

      const resumen = resumenPorAnioMap.get(auditoria.anio)
      resumen.auditorias += 1

      if (typeof auditoria.nota_final === 'number') {
        resumen.sumaNotaFinal += auditoria.nota_final
        resumen.notasFinales += 1
      }

      if (typeof auditoria.nota_archivos === 'number') {
        resumen.sumaNotaArchivos += auditoria.nota_archivos
        resumen.notasArchivos += 1
      }

      if (typeof auditoria.nota_encuesta === 'number') {
        resumen.sumaNotaEncuesta += auditoria.nota_encuesta
        resumen.notasEncuesta += 1
      }

      if (typeof auditoria.nota_rubrica === 'number') {
        resumen.sumaNotaRubrica += auditoria.nota_rubrica
        resumen.notasRubrica += 1
      }
    })

    const resumenPorAnio = Array.from(resumenPorAnioMap.values())
      .sort((a, b) => a.anio - b.anio)
      .map((item) => ({
        anio: item.anio,
        auditorias: item.auditorias,
        nota_final_promedio: item.notasFinales ? Number((item.sumaNotaFinal / item.notasFinales).toFixed(2)) : null,
        nota_archivos_promedio: item.notasArchivos ? Number((item.sumaNotaArchivos / item.notasArchivos).toFixed(2)) : null,
        nota_encuesta_promedio: item.notasEncuesta ? Number((item.sumaNotaEncuesta / item.notasEncuesta).toFixed(2)) : null,
        nota_rubrica_promedio: item.notasRubrica ? Number((item.sumaNotaRubrica / item.notasRubrica).toFixed(2)) : null,
      }))

    const auditoriasConNotaFinal = auditorias.filter((item) => typeof item.nota_final === 'number')
    const promedioFinal = auditoriasConNotaFinal.length
      ? Number((auditoriasConNotaFinal.reduce((acc, item) => acc + item.nota_final, 0) / auditoriasConNotaFinal.length).toFixed(2))
      : null

    const mejorAuditoria = auditoriasConNotaFinal.length
      ? auditoriasConNotaFinal.reduce((best, current) => current.nota_final > best.nota_final ? current : best)
      : null

    return NextResponse.json({
      auditor: {
        usuario_id: auditor.usuario_id,
        auth_user_id: auditor.auth_user_id,
        nombre: auditor.nombre,
        apellido: auditor.apellido,
        email: auditor.email,
        rol: auditor.rol,
        estado: auditor.estado,
        tipo_personal: auditor.tipo_personal,
        estudios: auditor.estudios,
        tipo_estudio: auditor.tipo_estudio,
        celular: auditor.celular,
        dependencia_nombre: auditor.dependencias?.nombre || 'Sin dependencia',
      },
      auditorias,
      resumenPorAnio,
      metricas: {
        total_auditorias: auditorias.length,
        anios_con_auditorias: resumenPorAnio.length,
        promedio_nota_final: promedioFinal,
        mejor_nota_final: mejorAuditoria?.nota_final ?? null,
        mejor_informe_id: mejorAuditoria?.informe_id ?? null,
      },
    })
  } catch (err) {
    console.error('Error en auditor-dashboard:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}