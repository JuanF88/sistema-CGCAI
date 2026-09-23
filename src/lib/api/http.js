/**
 * Cliente HTTP central del frontend.
 *
 * Regla del proyecto: los componentes **no llaman `fetch` directamente**.
 * Llaman a una función de `features/<dominio>/api/`, y esa función usa
 * `fetchJson`. Así el manejo de errores y la forma de la respuesta viven en un
 * único sitio.
 *
 * El backend responde los errores como `{ code, message, details }`
 * (ver `@/lib/api/errors`), así que aquí se normaliza a un `ApiError`.
 */

export class ApiError extends Error {
  constructor(message, { status, code = 'HTTP_ERROR', details } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

/** Cuántos motivos se listan antes de resumir; más no se lee en un aviso. */
const MAX_MOTIVOS = 3

/** A partir de aquí, un texto plano deja de parecer un mensaje para el usuario. */
const MAX_TEXTO_PLANO = 300

/**
 * Los motivos concretos de un error de validación.
 *
 * El backend manda `message: 'Datos inválidos.'` y los mensajes de verdad en
 * `details.fields`. Sin esto, un formulario rechazado decía «Datos inválidos» y
 * nada más: el usuario veía que fallaba, pero no qué corregir.
 *
 * Se usan solo los mensajes, no las rutas: `cronograma.0.dependencias.1.auditado`
 * no le dice nada a nadie, y los mensajes ya están escritos para leerse.
 */
function motivosDeValidacion(details) {
  const mensajes = (details?.fields ?? [])
    .map((campo) => String(campo?.message ?? '').trim())
    .filter(Boolean)

  // Un mismo mensaje se repite por cada fila que lo incumple.
  const unicos = [...new Set(mensajes)]
  if (!unicos.length) return ''

  const visibles = unicos.slice(0, MAX_MOTIVOS).join(' · ')
  const resto = unicos.length - MAX_MOTIVOS

  return resto > 0 ? `${visibles} · y ${resto} más` : visibles
}

/** ¿El cuerpo es una página de error del servidor en vez de un mensaje? */
const pareceHtml = (texto) => /^\s*<!?[a-z]/i.test(texto)

/** Mensaje legible a partir del cuerpo de error del backend. */
export function getApiErrorMessage(data, status) {
  // Un cuerpo que no es JSON casi siempre es la página de error de Next o de
  // la plataforma. Enseñarla tal cual metía el HTML entero en el aviso rojo
  // del formulario: media pantalla de etiquetas donde debía ir una frase.
  // Solo se acepta el texto si de verdad parece un mensaje corto.
  if (typeof data === 'string') {
    const texto = data.trim()
    if (texto && !pareceHtml(texto) && texto.length <= MAX_TEXTO_PLANO) return texto
  }

  const motivos = motivosDeValidacion(data?.details)
  if (motivos) return motivos

  if (data?.message) return data.message
  if (data?.error) return data.error // alias en desuso
  if (status === 401) return 'Tu sesión expiró. Vuelve a iniciar sesión.'
  if (status === 403) return 'No tienes permisos para hacer esto.'
  if (status === 404) return 'No se encontró el recurso solicitado.'
  if (status >= 500) return 'El servidor falló al procesar la petición. Intenta nuevamente.'
  return 'No se pudo completar la operación. Intenta nuevamente.'
}

/**
 * Hace la petición y devuelve el JSON ya parseado.
 * Lanza `ApiError` si la respuesta no es 2xx.
 *
 * @param {string} url
 * @param {{method?: string, body?: unknown, headers?: Record<string,string>, signal?: AbortSignal}} [options]
 */
export async function fetchJson(url, options = {}) {
  const { method = 'GET', body, headers, ...rest } = options

  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData
  const sendsJson = body !== undefined && !isFormData

  const response = await fetch(url, {
    method,
    headers: {
      ...(sendsJson ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: sendsJson ? JSON.stringify(body) : body,
    ...rest,
  })

  const text = await response.text()
  let data = null

  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }

  if (!response.ok) {
    throw new ApiError(getApiErrorMessage(data, response.status), {
      status: response.status,
      code: data?.code,
      details: data?.details,
    })
  }

  return data
}

/** Atajos por verbo, para que las funciones de `api/` queden de una línea. */
export const get = (url, options) => fetchJson(url, { ...options, method: 'GET' })
export const post = (url, body, options) => fetchJson(url, { ...options, method: 'POST', body })
export const put = (url, body, options) => fetchJson(url, { ...options, method: 'PUT', body })
export const patch = (url, body, options) => fetchJson(url, { ...options, method: 'PATCH', body })
export const del = (url, body, options) => fetchJson(url, { ...options, method: 'DELETE', body })

/** Construye un query string omitiendo los valores vacíos. */
export const queryString = (params = {}) => {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    search.set(key, String(value))
  }
  const qs = search.toString()
  return qs ? `?${qs}` : ''
}
