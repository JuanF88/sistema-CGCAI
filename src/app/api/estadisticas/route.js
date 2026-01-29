// src/app/api/estadisticas/route.js
import { NextResponse } from 'next/server'
import { getAuthenticatedClient } from '@/lib/authHelper'
import { createClient } from '@supabase/supabase-js'

const normalizeGestion = (g) => {
  if (!g) return null
  const v = String(g)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
  const allowed = ['estrategica', 'academica', 'investigacion', 'administrativa', 'cultura', 'control', 'otras']
  return allowed.includes(v) ? v : null
}

export async function GET() {
  const { error } = await getAuthenticatedClient()
  
  if (error) {
    return NextResponse.json({ error }, { status: 401 })
  }

  // Usar service role para consultas (bypass RLS temporal)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const tipos = [
    { tabla: 'fortalezas', tipo: 'Fortaleza' },
    { tabla: 'oportunidades_mejora', tipo: 'Oportunidad de Mejora' },
    { tabla: 'no_conformidades', tipo: 'No Conformidad' },
  ]

  try {
    // 1) Trae todo en paralelo
    const results = await Promise.all(
      tipos.map(async ({ tabla, tipo }) => {
        const { data, error } = await supabase
          .from(tabla)
          .select(`
            id,
            informes_auditoria:informe_id (
              id,
              fecha_auditoria,
              dependencias:dependencia_id ( nombre, gestion )
            )
          `)

        return { tipo, data: data || [], error, tabla }
      })
    )

    // 2) Construye DETALLE unificado [{ anio, dependencia, tipo, cantidad }]
    const detalle = []
    const depsMap = new Map() // nombre -> { nombre, gestion }
    for (const { tipo, data, error, tabla } of results) {
      if (error) {
        console.error(`Error cargando ${tabla}:`, error)
        continue
      }
      for (const item of data) {
        const ia = item.informes_auditoria
        if (!ia) continue

        const fecha = ia.fecha_auditoria ? new Date(ia.fecha_auditoria) : null
        const anio =
          fecha && !Number.isNaN(fecha.getTime()) ? fecha.getFullYear() : null

        const dependencia = ia.dependencias?.nombre || 'Desconocida'
        const gestion = normalizeGestion(ia.dependencias?.gestion) || null

        if (dependencia) {
          const prev = depsMap.get(dependencia)
          if (!prev || !prev.gestion) {
            depsMap.set(dependencia, { nombre: dependencia, gestion })
          }
        }

        detalle.push({
          anio,                 // puede ser null; el front lo tolera
          dependencia,
          gestion,
          tipo,
          cantidad: 1,          // cada hallazgo cuenta 1
        })
      }
    }

    // 3) Agregados coherentes (derivados de DETALLE)
    // resumenPorDependencia: { anio, dependencia, cantidad }
    const mapDep = new Map()
    for (const it of detalle) {
      const key = `${it.anio ?? 'SIN_ANIO'}|${it.dependencia}`
      mapDep.set(key, (mapDep.get(key) || 0) + (it.cantidad || 0))
    }
    const resumenPorDependencia = Array.from(mapDep, ([key, cantidad]) => {
      const [anioStr, dependencia] = key.split('|')
      return {
        anio: anioStr === 'SIN_ANIO' ? null : anioStr,
        dependencia,
        cantidad,
      }
    })

    // resumenPorTipo: { tipo, cantidad }
    const mapTipo = new Map()
    for (const it of detalle) {
      const key = it.tipo || 'SIN_TIPO'
      mapTipo.set(key, (mapTipo.get(key) || 0) + (it.cantidad || 0))
    }
    const resumenPorTipo = Array.from(mapTipo, ([tipo, cantidad]) => ({ tipo, cantidad }))

    // 4) Catálogos (ordenados)
    const anios = Array.from(
      new Set(detalle.map(d => d.anio).filter(v => v != null))
    ).sort((a, b) => Number(a) - Number(b))

    const dependencias = Array.from(depsMap.values()).sort((a, b) =>
      (a.nombre || '').localeCompare(b.nombre || '')
    )

    return NextResponse.json({
      // dataset unificado para el front
      detalle,
      // agregados (back-compat si los usas en otros lados)
      resumenPorDependencia,
      resumenPorTipo,
      anios,
      dependencias,
    })
  } catch (err) {
    console.error('Error en /api/estadisticas:', err)
    return NextResponse.json({ error: 'Error cargando estadísticas' }, { status: 500 })
  }
}
