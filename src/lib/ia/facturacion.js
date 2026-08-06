import 'server-only'

/**
 * Cuánto cuesta la IA, por dos caminos distintos y complementarios.
 *
 * ── 1. La estimación nuestra ──
 * Los tokens ya están registrados por revisión, así que multiplicando por el
 * precio del modelo sale el coste **atribuido**: cuánto ha costado esta
 * auditoría, este auditor, este mes. Eso OpenAI no lo puede decir, porque no
 * sabe qué es una auditoría.
 *
 * Es una estimación y se presenta como tal: no descuenta el descuento de la
 * entrada en caché —que en este sistema es la mayor parte del prompt— así que
 * tiende a quedar por encima de lo facturado.
 *
 * ── 2. El gasto real ──
 * El que OpenAI factura de verdad, de su API de administración. Es la cifra
 * buena, pero es de **toda la organización**: si la cuenta se usa para algo
 * más, ese algo más también aparece. Y llega por día, así que no se puede
 * repartir entre auditorías.
 *
 * Las dos juntas responden a preguntas distintas: la primera, «¿quién gasta?»;
 * la segunda, «¿cuánto voy a pagar?». Ninguna sustituye a la otra.
 *
 * Todo esto es opcional. Sin precios configurados no hay estimación, sin clave
 * de administración no hay gasto real, y el panel sigue enseñando los tokens.
 */
import { getServerEnv } from '@/lib/config/env.server'

/** Los precios se declaran por millón de tokens, que es como los publica OpenAI. */
const POR_MILLON = 1_000_000

/** Presupuesto por defecto, si no se declara otro. */
const PRESUPUESTO_POR_DEFECTO = 5

/** Los dólares que hay para gastar en IA. */
export const presupuestoUsd = () =>
  getServerEnv().OPENAI_PRESUPUESTO_USD ?? PRESUPUESTO_POR_DEFECTO

/**
 * Qué parte del presupuesto se lleva un gasto, en porcentaje.
 *
 * Con cuatro decimales, y no por manía: una revisión cuesta unos 0,0018 USD,
 * que sobre cinco dólares es el 0,036 %. Redondeando a un decimal salía «0 %»
 * y el panel parecía roto justo cuando acababa de registrar una revisión de
 * verdad. El formato lo decide la vista; aquí solo se procura no perder la
 * cifra por el camino.
 *
 * Se corta en 100: pasado el presupuesto la barra está llena, y por cuánto se
 * pasó es otra conversación.
 */
export function porcentajeDelPresupuesto(usd) {
  if (usd === null || usd === undefined) return null
  return Math.min(100, Math.round((usd / presupuestoUsd()) * 1_000_000) / 10_000)
}

/**
 * Cuántos días abarca el presupuesto por defecto.
 *
 * Noventa, y el número no es estético: `/costs` solo da buckets de un día y
 * como mucho 31 por respuesta, y la API de administración corta a **diez
 * peticiones por minuto**. Un año son doce páginas encadenadas, o sea un 429
 * seguro; noventa días son tres. Es el error que hacía que el panel se quedara
 * sin la cifra de la cuenta de vez en cuando.
 *
 * Se puede alargar con `OPENAI_PRESUPUESTO_DESDE`, sabiendo que cada mes de
 * más es una petición más de las diez que caben en un minuto.
 */
const DIAS_DEL_PRESUPUESTO = 90

/** Desde cuándo se cuenta el gasto contra el presupuesto. */
export function inicioDelPresupuesto() {
  const declarado = process.env.OPENAI_PRESUPUESTO_DESDE
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(declarado ?? ''))) return declarado

  const d = new Date()
  d.setUTCDate(d.getUTCDate() - DIAS_DEL_PRESUPUESTO)
  return d.toISOString().slice(0, 10)
}

/** Medio minuto largo: es una consulta de panel, no una interactiva. */
const TIEMPO_MAXIMO_MS = 15_000

/**
 * Caché del gasto facturado.
 *
 * `/costs` solo admite buckets de un día y como mucho 31 por respuesta, así que
 * un año son doce páginas encadenadas —hay que leer el cursor de una para pedir
 * la siguiente— y unos dieciséis segundos. Medido. Con eso, cualquier tropiezo
 * en una de las doce tumbaba la consulta entera y el panel se quedaba sin la
 * cifra de la cuenta.
 *
 * Cinco minutos de caché lo arreglan por los dos lados: la segunda visita es
 * instantánea, y si OpenAI falla se sigue enseñando lo último bueno —marcado
 * como viejo— en vez de un hueco.
 */
const CACHE_MS = 5 * 60 * 1000
let cache = null

/**
 * Coste estimado de unos tokens, en dólares.
 *
 * Devuelve `null` —y no cero— si no hay precios configurados: cero es una
 * cifra, y afirmar que algo costó cero cuando no se sabe es mentir en un panel
 * de gasto.
 */
export function costeEstimado({ entrada = 0, salida = 0 }) {
  const env = getServerEnv()
  const precioEntrada = env.OPENAI_PRECIO_ENTRADA_USD
  const precioSalida = env.OPENAI_PRECIO_SALIDA_USD

  if (precioEntrada === undefined || precioSalida === undefined) return null

  return (entrada * precioEntrada + salida * precioSalida) / POR_MILLON
}

/** ¿Hay precios para estimar? */
export const hayPrecios = () => costeEstimado({ entrada: 0, salida: 0 }) !== null

/** Los precios configurados, para poder enseñarlos junto a la estimación. */
export function preciosConfigurados() {
  const env = getServerEnv()
  if (!hayPrecios()) return null

  return {
    entrada: env.OPENAI_PRECIO_ENTRADA_USD,
    salida: env.OPENAI_PRECIO_SALIDA_USD,
  }
}

/** Fecha `YYYY-MM-DD` → segundos Unix, que es lo que pide la API. */
const enSegundos = (fecha) => Math.floor(new Date(`${fecha}T00:00:00Z`).getTime() / 1000)

/** Un día en segundos. */
const UN_DIA = 86_400

/**
 * Cuántos días pide cada página, y cuántas páginas como mucho.
 *
 * `limit` no acota el rango, acota los **buckets por respuesta**: pidiendo
 * desde enero con `limit=180` la respuesta llegaba hasta finales de junio y lo
 * de después no existía. El panel habría enseñado cero mientras la cuenta
 * gastaba. De ahí el bucle de páginas.
 *
 * 31 y no más porque es el máximo documentado para buckets de un día —la API
 * lo dice al pasarse: «Maximums are: 1440 for 1m, 168 for 1h, and 31 for 1d»—.
 * Trece páginas cubren algo más de un año, que es de sobra para un panel que
 * arranca en el primer día con uso registrado.
 */
const DIAS_POR_PAGINA = 31

/**
 * Ocho páginas como mucho, y no trece.
 *
 * La API de administración admite diez peticiones por minuto; pasarse devuelve
 * 429 y se pierde la consulta entera. Ocho deja margen para que el panel se
 * recargue sin chocar contra el límite. Si el periodo pedido no cabe en ocho,
 * la respuesta lo dice (`truncado`) en vez de dar un total a medias como si
 * fuera completo.
 */
const MAXIMO_PAGINAS = 8

/**
 * Vuelca los buckets de una respuesta en el acumulado.
 *
 * La respuesta viene en «buckets» por periodo, y cada uno trae sus resultados
 * con un `amount`. El importe llega como **cadena** con muchos decimales
 * (`"0.02541922000000000000"`), de ahí el `Number`.
 *
 * Se recorre a la defensiva —campos opcionales, formas que pueden cambiar—
 * porque es una API externa y esto es un panel de consulta: si cambiara de
 * forma, mejor «no disponible» que tumbar la pestaña entera.
 */
function acumularBuckets(cuerpo, porDia) {
  let total = 0

  for (const bucket of Array.isArray(cuerpo?.data) ? cuerpo.data : []) {
    const resultados = Array.isArray(bucket?.results) ? bucket.results : []
    const importe = resultados.reduce((suma, r) => suma + (Number(r?.amount?.value) || 0), 0)

    total += importe

    // Solo los días con gasto: un calendario de ceros no dice nada.
    if (bucket?.start_time && importe > 0) {
      porDia.push({
        fecha: new Date(bucket.start_time * 1000).toISOString().slice(0, 10),
        usd: importe,
      })
    }
  }

  return total
}

/**
 * Gasto facturado por OpenAI entre dos fechas (`YYYY-MM-DD`).
 *
 * Nunca lanza: el panel de uso tiene que salir aunque OpenAI no conteste. Los
 * fallos vuelven como `{ disponible: false, motivo }` para poder decirle al
 * administrador qué falta en vez de dejar un hueco.
 *
 * ⚠️ La forma exacta de la respuesta la define OpenAI en su API de
 * administración (`/v1/organization/costs`), y aquí se lee a la defensiva. Si
 * cambian el contrato, esto devuelve «no disponible» y hay que ajustar
 * `sumarCostes`, no el resto del panel.
 */
export async function gastoFacturado({ desde, hasta }) {
  const env = getServerEnv()

  if (!env.OPENAI_ADMIN_KEY) {
    return {
      disponible: false,
      motivo:
        'Falta OPENAI_ADMIN_KEY. Es una clave de organización (sk-admin-…) que crea un propietario de la cuenta en OpenAI; sin ella no se puede consultar el gasto facturado.',
    }
  }

  const clave = `${desde}|${hasta}`
  const ahora = Date.now()

  if (cache?.clave === clave && ahora - cache.momento < CACHE_MS) {
    return { ...cache.valor, deCache: true }
  }

  /** Lo último que sí funcionó, para no dejar el panel a ciegas por un fallo. */
  const respaldo = (motivo) =>
    cache?.clave === clave
      ? { ...cache.valor, deCache: true, viejo: true, motivo }
      : { disponible: false, motivo }

  // `end_time` es exclusivo —comprobado: pidiendo hasta el día 5 el último
  // bucket es el 4—, así que se pide el día siguiente para incluir hoy.
  const inicio = enSegundos(desde)
  const fin = enSegundos(hasta) + UN_DIA

  let total = 0
  const porDia = []
  let cursor = null

  for (let pagina = 0; pagina < MAXIMO_PAGINAS; pagina++) {
    const url = new URL('https://api.openai.com/v1/organization/costs')
    url.searchParams.set('start_time', String(inicio))
    url.searchParams.set('end_time', String(fin))
    url.searchParams.set('bucket_width', '1d')
    url.searchParams.set('limit', String(DIAS_POR_PAGINA))
    if (cursor) url.searchParams.set('page', cursor)

    let respuesta
    try {
      respuesta = await fetch(url, {
        headers: { Authorization: `Bearer ${env.OPENAI_ADMIN_KEY}` },
        signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
        cache: 'no-store',
      })
    } catch {
      return respaldo('No se pudo contactar con OpenAI.')
    }

    const cuerpo = await respuesta.json().catch(() => null)

    if (!respuesta.ok) {
      const detalle = String(cuerpo?.error?.message ?? '').trim()

      // 401 con una clave puesta casi siempre es una clave de uso donde debería
      // ir una de administración: son distintas y no se parecen en el error.
      const motivo =
        respuesta.status === 401
          ? 'OpenAI rechazó la clave. OPENAI_ADMIN_KEY tiene que ser una clave de organización con permiso de lectura de uso, no la clave normal de la API.'
          : respuesta.status === 429
            ? 'OpenAI limita las consultas de administración a diez por minuto y se alcanzó el tope. Vuelve a intentarlo en un minuto.'
            : `OpenAI respondió ${respuesta.status}${detalle ? `: ${detalle}` : '.'}`

      return respaldo(motivo)
    }

    total += acumularBuckets(cuerpo, porDia)

    cursor = cuerpo?.has_more && cuerpo?.next_page ? cuerpo.next_page : null
    if (!cursor) break
  }

  const valor = {
    disponible: true,
    desde,
    hasta,
    totalUsd: total,
    porDia,
    // Quedaron páginas sin pedir: el total es de un periodo más corto que el
    // solicitado, y el panel tiene que poder decirlo.
    truncado: Boolean(cursor),
    // Es de toda la cuenta, no solo de este sistema.
    alcance: 'organizacion',
  }

  cache = { clave, momento: ahora, valor }
  return valor
}
