/**
 * Generación y descarga de los documentos derivados de un informe.
 *
 * Los dos paneles (auditor y administrador) descargan lo mismo; lo único que
 * cambia es de dónde sale el nombre del auditor que va en la portada.
 */
import { toast } from 'react-toastify'

import { supabase } from '@/lib/supabase/client'
import { generarInformeAuditoria } from '@/features/auditorias/utils/generarInformeAuditoria'
import { generarPlanMejora2 } from '@/features/auditorias/utils/generarPlanMejora2.xpp'

/** Los generadores necesitan la ISO, el capítulo y el numeral resueltos. */
const RELACIONES = `*, iso:iso_id ( iso ), capitulo:capitulo_id ( capitulo ), numeral:numeral_id ( numeral )`

const hallazgosDe = (tabla, informeId) =>
  supabase.from(tabla).select(RELACIONES).eq('informe_id', informeId).order('id')

/**
 * Los hallazgos de un informe, o un error que corta la descarga.
 *
 * Antes cada consulta se leía como `respuesta.data || []`, así que una lectura
 * rechazada —un token caducado, un corte de red— producía un documento
 * perfecto al que le faltaban hallazgos, sin un solo aviso. Un informe de
 * auditoría que se firma y se entrega no puede salir incompleto en silencio:
 * si una consulta falla, no hay documento.
 */
async function leerHallazgosParaDocumento(informeId, tablas) {
  const respuestas = await Promise.all(tablas.map((t) => hallazgosDe(t, informeId)))

  const fallos = tablas
    .map((tabla, i) => (respuestas[i].error ? `${tabla}: ${respuestas[i].error.message}` : null))
    .filter(Boolean)

  if (fallos.length) {
    throw new Error(
      `No se pudieron leer todos los hallazgos del informe (${fallos.join(' · ')}). ` +
        `El documento no se genera para que no salga incompleto.`
    )
  }

  return respuestas.map((r) => r.data ?? [])
}

/** Opciones de la plantilla del Plan de Mejoramiento (`/plantillas/PlanMejora.xlsx`). */
const OPCIONES_PM = {
  templateUrl: '/plantillas/PlanMejora.xlsx',
  writeMeta: true,
  metaCells: { dependencia: 'D8', fechaGeneracion: 'F49' },
  metaDateFormat: 'dd/mm/yyyy',
  startRow: 12,
  rowsPerItem: 2,
  pairsCount: 14,
  cols: { fuente: 'A', tipo: 'B', factor: 'C', descripcion: 'D' },
  wrapTextColumns: ['D'],
}

/**
 * Descarga el informe de auditoría en borrador con sus hallazgos.
 *
 * @param {Object} informe
 * @param {Object} [usuario] Quien firma. Si no se pasa, se toma del informe.
 */
export async function descargarInformeAuditoria(informe, usuario) {
  try {
    const [fort, opor, noConfor] = await leerHallazgosParaDocumento(informe.id, [
      'fortalezas',
      'oportunidades_mejora',
      'no_conformidades',
    ])

    const firmante = usuario || {
      nombre: informe.usuarios?.nombre || 'ADMIN',
      apellido: informe.usuarios?.apellido || '',
    }

    await generarInformeAuditoria(informe, fort, opor, noConfor, firmante)
  } catch (err) {
    console.error('Descargar informe (borrador) error:', err)
    toast.error(err?.message || 'No se pudo generar/descargar el informe.')
  }
}

/**
 * Descarga el formato de Plan de Mejoramiento con las oportunidades de mejora
 * y las no conformidades del informe.
 */
export async function descargarPlanMejora(informe) {
  try {
    const [om, nc] = await leerHallazgosParaDocumento(informe.id, [
      'oportunidades_mejora',
      'no_conformidades',
    ])

    if (!om.length && !nc.length) {
      toast.info('Este informe no tiene oportunidades de mejora ni no conformidades.')
      return
    }

    await generarPlanMejora2(informe, om, nc, null, OPCIONES_PM)
  } catch (err) {
    console.error('Descargar Plan de Mejora error:', err)
    toast.error(err?.message || 'No se pudo generar/descargar el Plan de Mejora.')
  }
}
