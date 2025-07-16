// src/app/api/estadisticas/route.js
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'

export async function GET() {
  // Cargar hallazgos con su año y dependencia
  const tipos = [
    { tabla: 'fortalezas', tipo: 'Fortaleza' },
    { tabla: 'oportunidades_mejora', tipo: 'Oportunidad de Mejora' },
    { tabla: 'no_conformidades', tipo: 'No Conformidad' }
  ]

  const resumenPorTipo = []
  let resumenRaw = []

  for (const { tabla, tipo } of tipos) {
    const { data, error } = await supabase
      .from(tabla)
      .select(`
        id,
        informe_id,
        informes_auditoria (
          id,
          fecha_auditoria,
          dependencias (
            nombre
          )
        )
      `)

    if (error) {
      console.error(`Error cargando ${tabla}:`, error)
      continue
    }

    resumenPorTipo.push({ tipo, cantidad: data.length })

    data.forEach(item => {
      if (!item.informes_auditoria) return
      const anio = new Date(item.informes_auditoria.fecha_auditoria).getFullYear()
      const dependencia = item.informes_auditoria.dependencias?.nombre || 'Desconocida'

      resumenRaw.push({ anio, dependencia })
    })
  }

  // Agrupar por dependencia + año
  const resumenPorDependencia = Object.values(
    resumenRaw.reduce((acc, { anio, dependencia }) => {
      const key = `${anio}-${dependencia}`
      acc[key] = acc[key] || { anio: anio.toString(), dependencia, cantidad: 0 }
      acc[key].cantidad += 1
      return acc
    }, {})
  )

  const anios = [...new Set(resumenRaw.map(r => r.anio.toString()))]
  const dependencias = [...new Set(resumenRaw.map(r => r.dependencia))]

  return NextResponse.json({
    resumenPorDependencia,
    resumenPorTipo,
    anios,
    dependencias
  })
}
