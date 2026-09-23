'use client'

/**
 * Un vistazo a Storage para toda la pantalla, en lugar de uno por documento.
 *
 * Antes cada pantalla listaba **el bucket entero una vez por cada documento de
 * cada auditoría**: con 39 auditorías y 6 documentos son 234 listados
 * simultáneos, más una firma por archivo encontrado. Casi quinientas peticiones
 * para leer seis carpetas que caben en seis.
 *
 * Y lo que de verdad dolía: cada una de esas peticiones se envolvía en un
 * `try/catch` que devolvía `null` al fallar, y `null` se dibuja exactamente
 * igual que «no lo han subido». Un corte de red de un segundo, un 429 o un
 * tiempo de espera agotado hacían desaparecer un documento que sí estaba, sin
 * dejar rastro en ninguna parte. De ahí los «de vez en cuando aparece como no
 * entregado».
 *
 * Aquí se lee cada bucket una vez, se firma por lotes, y el fallo se distingue
 * de la ausencia: si no se pudo leer un bucket, sus documentos quedan en
 * «desconocido» y la pantalla lo dice, en vez de afirmar que faltan.
 */
import { supabase } from '@/lib/supabase/client'

/** Lo que dura una URL firmada. */
const EXPIRACION_SEGUNDOS = 60 * 60

/** Techo de objetos por bucket; hoy el mayor ronda los cuarenta. */
const MAXIMO_POR_BUCKET = 1000

/**
 * Lee de una vez el contenido de cada bucket.
 *
 * @param {string[]} buckets
 * @returns {Promise<{indice: Record<string, Map<string, Object>|null>, fallidos: string[]}>}
 *   `null` en un bucket significa «no se pudo leer», que no es lo mismo que
 *   «está vacío».
 */
export async function leerBuckets(buckets) {
  const unicos = [...new Set(buckets)].filter(Boolean)

  const entradas = await Promise.all(
    unicos.map(async (bucket) => {
      try {
        const { data, error } = await supabase.storage
          .from(bucket)
          .list('', { limit: MAXIMO_POR_BUCKET, sortBy: { column: 'name', order: 'asc' } })

        if (error) throw error
        return [bucket, new Map((data ?? []).map((archivo) => [archivo.name, archivo]))]
      } catch (error) {
        console.error(`[archivos] no se pudo listar el bucket «${bucket}»:`, error?.message ?? error)
        return [bucket, null]
      }
    })
  )

  return {
    indice: Object.fromEntries(entradas),
    fallidos: entradas.filter(([, contenido]) => contenido === null).map(([bucket]) => bucket),
  }
}

/**
 * Qué se sabe de un documento concreto.
 *
 * @returns {{existe: boolean, desconocido: boolean, path: string, subido_at: string|null}}
 */
export function buscarDocumento(indice, bucket, path) {
  const contenido = indice?.[bucket]
  const nombre = path.includes('/') ? path.slice(path.lastIndexOf('/') + 1) : path

  if (!contenido) return { existe: false, desconocido: true, path, subido_at: null }

  const archivo = contenido.get(nombre)
  return {
    existe: Boolean(archivo),
    desconocido: false,
    path,
    // `created_at` es la primera entrega; `updated_at` sería la última vez que
    // alguien reemplazó el archivo, que no es la fecha que se evalúa.
    subido_at: archivo ? (archivo.created_at ?? archivo.updated_at ?? null) : null,
  }
}

/**
 * Firma en bloque todas las rutas pedidas: una petición por bucket.
 *
 * @param {Record<string, string[]>} rutasPorBucket
 * @returns {Promise<Map<string, string>>} clave `bucket|path`, valor la URL
 */
export async function firmarDocumentos(rutasPorBucket) {
  const urls = new Map()

  await Promise.all(
    Object.entries(rutasPorBucket).map(async ([bucket, rutas]) => {
      const unicas = [...new Set(rutas)].filter(Boolean)
      if (!unicas.length) return

      try {
        const { data, error } = await supabase.storage
          .from(bucket)
          .createSignedUrls(unicas, EXPIRACION_SEGUNDOS)

        if (error) throw error

        for (const firma of data ?? []) {
          // La respuesta trae `path` y `signedUrl`; si una ruta falla, viene
          // con `error` y sin URL, y simplemente no se añade.
          if (firma?.path && firma?.signedUrl) urls.set(`${bucket}|${firma.path}`, firma.signedUrl)
        }
      } catch (error) {
        console.error(`[archivos] no se pudieron firmar los archivos de «${bucket}»:`, error?.message ?? error)
      }
    })
  )

  return urls
}

/** Mensaje para avisar de los buckets que no se pudieron leer. */
export const avisoDeFallidos = (fallidos) =>
  `No se pudo consultar el almacenamiento (${fallidos.join(', ')}). Algunos documentos pueden aparecer como pendientes sin estarlo; vuelve a cargar la página.`
