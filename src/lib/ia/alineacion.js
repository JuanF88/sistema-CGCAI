import 'server-only'

/**
 * Revisión de alineación del informe con el objetivo del programa.
 *
 * Compara lo que escribió el auditor —el objetivo de su auditoría y sus
 * conclusiones— contra el objetivo general del programa del que salió la
 * auditoría, y devuelve un veredicto por campo con un comentario y, si hace
 * falta, una redacción alternativa.
 *
 * Es **asesor, nunca bloqueante**: el resultado se muestra y el auditor decide.
 * Un modelo que impide guardar un informe correcto termina siendo un obstáculo
 * que la gente aprende a esquivar.
 *
 * ── Qué sale del sistema ──
 * Solo los tres textos. Ni el nombre del auditor, ni la dependencia, ni el
 * número de informe: para juzgar si un párrafo desarrolla a otro no hacen
 * falta, y lo que no se manda no se puede filtrar.
 *
 * ── Coste ──
 * El orden de los mensajes no es casual. Las instrucciones y el objetivo del
 * programa van primero porque son idénticos en todas las revisiones del mismo
 * programa, y la entrada en caché cuesta una décima parte. Lo que cambia —lo
 * que el auditor está escribiendo— va al final.
 */
import { z } from 'zod'

import { DomainError, ValidationError } from '@/lib/api/errors'
import { DOCTRINA_AUDITORIA } from '@/lib/catalogos/doctrina-auditoria'
import { ESTILO_INFORME } from '@/lib/catalogos/estilo-informe'
import { getServerEnv } from '@/lib/config/env.server'

const ENDPOINT = 'https://api.openai.com/v1/chat/completions'

/**
 * Modelo por defecto.
 *
 * El identificador exacto se confirma en la página de modelos de la
 * plataforma; si no coincide, la API responde 404 y `OPENAI_MODEL` permite
 * corregirlo sin tocar el código.
 */
const MODELO_POR_DEFECTO = 'gpt-5.6-luna'

/**
 * Techo de tokens de salida.
 *
 * Es un techo, no un consumo: solo se paga lo que se use. Cuando se queda
 * corto la respuesta no llega truncada, llega VACÍA: el auditor ve «el modelo
 * no devolvió ninguna revisión» y reintentar no arregla nada. Ya pasó dos
 * veces, así que va holgado a propósito.
 *
 * Medido con los dos campos a la vez y el contexto completo, una revisión
 * gasta entre 1.250 y 1.850, de los que unos mil son de razonamiento y no se
 * ven en la respuesta. Subió al añadir el formato institucional: las
 * conclusiones numeradas que propone son bastante más largas que un párrafo.
 *
 * Aun así sigue siendo el límite de gasto de cada llamada: la salida cuesta
 * seis veces más que la entrada, así que se controla aquí y no en el texto
 * que se manda.
 */
const MAX_TOKENS_SALIDA = 2600

/** Medio minuto: pasado eso, el auditor ya volvió a escribir. */
const TIEMPO_MAXIMO_MS = 30_000

const INSTRUCCIONES = `Eres un revisor de calidad de auditorías internas de una universidad colombiana.

Recibes el objetivo general de un programa de auditoría, los requisitos de las normas que el programa asignó al proceso auditado, y los textos que un auditor escribió para esa auditoría. Tu única tarea es juzgar si esos textos están alineados con el objetivo general y con los requisitos asignados.

Escribe como un auditor con experiencia, no como un corrector de estilo: usa el vocabulario de la norma —conformidad, evidencia objetiva, control operacional, eficacia, causa raíz, parte interesada— cuando venga al caso, y evita las generalidades del tipo «podrías ser más específico».

Recibes además el marco de referencia con el que se juzgan los informes en esta institución. Aplícalo: distingue objetivo de alcance, exige que las conclusiones se apoyen en los hallazgos y respondan al objetivo, y respeta el significado que la institución da a corrección, acción correctiva, monitoreo, seguimiento y evaluación.

Recibes también el formato institucional del informe, con ejemplos reales de informes ya aprobados. Úsalo así:
- La sugerencia de conclusiones va redactada en ese formato: numeradas y en tercera persona. Es lo que el auditor va a pegar en el formulario.
- Para el objetivo, el formato es el criterio con el que juzgas y lo que citas al orientar —infinitivo, sin numerales, alcance acotado—, no algo que tengas que redactar tú.
- No copies los ejemplos ni los cites; solo fijan el registro. No inventes cifras, porcentajes ni evidencias que el auditor no haya escrito: si su texto necesita un dato que no está, pide el dato en el comentario y deja un hueco marcado en la sugerencia.
- El formato por sí solo no cambia el veredicto: unas conclusiones sin numerar pueden estar perfectamente alineadas. Sí lo cambia lo que el formato existe para garantizar; en particular, unas conclusiones que no se pronuncian sobre el logro de los objetivos de la auditoría no responden al objetivo y no pueden ser "alineado".
- Cuando el veredicto no sea "alineado", el comentario empieza por la razón de fondo. Lo que sea solo de formato va al final y dicho como tal.

Sobre los requisitos:
- Cuando el texto se relacione con alguno de los requisitos recibidos, cítalo por su número entre paréntesis. Ejemplo: «lo que planteas se verifica contra 9.1».
- NUNCA cites un numeral que no esté en la lista que recibes. Si crees que aplica otro, descríbelo con palabras sin ponerle número.
- Si no recibes ningún requisito, no menciones numerales en absoluto.
- Que el objetivo no cubra todos los requisitos asignados NO baja el veredicto por sí solo: una auditoría puede acotar su alcance. Señala en el comentario cuáles quedan fuera, pero no rebajes a "parcial" solo por eso. Rebaja el veredicto cuando el texto se desvíe del propósito, no cuando abarque menos.

Antes de juzgar alineación, comprueba que el texto SEA lo que dice ser. Un apunte personal, un marcador de sitio, una frase suelta, un «pendiente» o cualquier cosa sin redactar como objetivo o como conclusiones de auditoría es "desalineado", por breve o improvisado que parezca. No supongas lo que el auditor iba a escribir ni lo juzgues por lo que podría llegar a ser: juzga lo que hay.

Criterios:
- El objetivo de la auditoría debe ser un caso concreto del objetivo general: mismo propósito, alcance acotado. No tiene que repetirlo ni citarlo.
- El objetivo general puede reunir varios propósitos (calidad, planes de mejoramiento, gestión ambiental). Una auditoría no tiene que cubrirlos todos, pero su objetivo debe desarrollar al menos uno de forma reconocible. Si no se puede asociar a ninguno, es "desalineado".
- Las conclusiones deben responder al objetivo de la auditoría y sostenerse en él. Si concluyen sobre asuntos que el objetivo no se planteaba, está desalineado.
- Juzga alineación, no ortografía, ni estilo, ni extensión.
- Si un texto llega vacío, no lo revises: omítelo de la respuesta.

Veredictos:
- "alineado": desarrolla el objetivo general sin desviarse.
- "parcial": es de verdad un objetivo —o unas conclusiones— de auditoría, redactado como tal, pero deja fuera parte del propósito o añade algo ajeno. No uses "parcial" por cortesía ni para suavizar: si el texto no llega a ser un objetivo, es "desalineado".
- "desalineado": trata de otra cosa, o no es un objetivo ni unas conclusiones.

Sé breve y concreto. El comentario, una o dos frases, dirigido al auditor y en segunda persona. Si el veredicto es "desalineado" porque el campo no está redactado, dilo sin rodeos en vez de comentar la suposición que harías.

La sugerencia solo cuando el veredicto no sea "alineado"; si es "alineado", déjala vacía. Y NO es lo mismo según el campo:

- OBJETIVO: no escribas un objetivo. Escribe de dos a cuatro pautas sobre lo que le falta al texto que el auditor ya tiene, una por línea y empezando cada una con "- ". Cada pauta señala algo concreto que añadir, acotar o quitar, y por qué: qué propósito del objetivo general no se reconoce en su texto, qué requisito asignado queda fuera del alcance que declara, qué le falta para ser verificable (proceso, dependencia, periodo, criterio de evaluación), qué sobra por pertenecer al alcance y no al objetivo. Habla de SU texto, no de uno ideal. Nunca entregues una frase que se pueda pegar tal cual en el campo: el objetivo lo redacta el auditor, tú le dices qué tiene que resolver.
- CONCLUSIONES: sí, una reformulación lista para pegar, numerada y en tercera persona, en el registro formal institucional.

Responde únicamente con un objeto JSON con esta forma exacta:
{"revisiones":[{"campo":"objetivo","veredicto":"alineado","comentario":"...","sugerencia":""}]}
donde "campo" es "objetivo" o "conclusiones".`

/** Lo que aceptamos de vuelta del modelo. */
const respuestaSchema = z.object({
  revisiones: z
    .array(
      z.object({
        campo: z.enum(['objetivo', 'conclusiones']),
        veredicto: z.enum(['alineado', 'parcial', 'desalineado']),
        comentario: z.string().trim().max(800).default(''),
        sugerencia: z.string().trim().max(2000).nullish().transform((v) => v ?? ''),
      })
    )
    .max(4)
    .default([]),
})

/** Los textos a revisar, en el orden en que se leen. */
function bloqueDeTextos({ objetivo, conclusiones }) {
  const partes = []
  if (objetivo) partes.push(`OBJETIVO DE LA AUDITORÍA:\n${objetivo}`)
  if (conclusiones) partes.push(`CONCLUSIONES DE LA AUDITORÍA:\n${conclusiones}`)
  return partes.join('\n\n')
}

/**
 * Traduce el fallo de la API a algo que el auditor pueda entender o reportar.
 *
 * Los tres primeros casos son los que de verdad pasan al poner esto en marcha:
 * la clave mal copiada, el identificador del modelo cambiado y el saldo
 * agotado. Dejarlos como «error 400» obligaría a abrir los logs cada vez.
 */
function errorDeApi(status, cuerpo) {
  const detalle = String(cuerpo?.error?.message ?? '').trim()

  if (status === 401) {
    return new DomainError(
      'La clave de OpenAI no es válida. Revisa OPENAI_API_KEY.',
      { status: 502, code: 'IA_AUTH' }
    )
  }

  if (status === 404 || /model/i.test(detalle)) {
    return new DomainError(
      `El modelo configurado no existe o no está disponible para esta cuenta. Ajusta OPENAI_MODEL.${detalle ? ` (${detalle})` : ''}`,
      { status: 502, code: 'IA_MODELO' }
    )
  }

  if (status === 429) {
    return new DomainError(
      'OpenAI rechazó la petición por límite de uso o saldo agotado. Inténtalo en un momento o revisa el saldo de la cuenta.',
      { status: 502, code: 'IA_LIMITE' }
    )
  }

  return new DomainError(
    `La revisión no se pudo completar${detalle ? `: ${detalle}` : '.'}`,
    { status: 502, code: 'IA_ERROR' }
  )
}

/**
 * Pide la revisión y devuelve el veredicto ya validado.
 *
 * @param {Object} entrada
 * @param {string} entrada.objetivoPrograma  Objetivo general del programa
 * @param {string} [entrada.objetivo]        Objetivo escrito por el auditor
 * @param {string} [entrada.conclusiones]    Conclusiones escritas por el auditor
 * @param {string} [entrada.requisitos]      Requisitos ISO del proceso, ya resueltos a texto
 * @returns {Promise<{revisiones: Array, modelo: string, tokens: {entrada: number, salida: number}}>}
 */
export async function revisarAlineacion({
  objetivoPrograma,
  objetivo,
  conclusiones,
  requisitos = '',
}) {
  const env = getServerEnv()

  if (!env.OPENAI_API_KEY) {
    throw new DomainError(
      'La revisión con IA no está configurada en este entorno. Falta OPENAI_API_KEY.',
      { status: 503, code: 'IA_SIN_CONFIGURAR' }
    )
  }

  const textos = bloqueDeTextos({ objetivo, conclusiones })
  if (!textos) {
    throw new ValidationError('Escribe el objetivo o las conclusiones antes de pedir la revisión.')
  }

  const modelo = env.OPENAI_MODEL || MODELO_POR_DEFECTO

  let respuesta
  try {
    respuesta = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
      body: JSON.stringify({
        model: modelo,
        // De lo más estable a lo más cambiante, para que la cabecera entre en
        // caché: las instrucciones no cambian nunca, el objetivo del programa
        // es el mismo todo el año y los requisitos son los mismos para todas
        // las auditorías del proceso. Solo varía el último mensaje.
        messages: [
          { role: 'system', content: INSTRUCCIONES },
          { role: 'system', content: DOCTRINA_AUDITORIA },
          { role: 'system', content: ESTILO_INFORME },
          {
            role: 'user',
            content: `OBJETIVO GENERAL DEL PROGRAMA:\n${objetivoPrograma}`,
          },
          ...(requisitos
            ? [
                {
                  role: 'user',
                  content: `REQUISITOS ASIGNADOS AL PROCESO AUDITADO:\n${requisitos}`,
                },
              ]
            : []),
          { role: 'user', content: textos },
        ],
        response_format: { type: 'json_object' },
        max_completion_tokens: MAX_TOKENS_SALIDA,
      }),
    })
  } catch (error) {
    // `AbortSignal.timeout` lanza TimeoutError; el resto es red caída.
    const agotado = error?.name === 'TimeoutError'
    throw new DomainError(
      agotado
        ? 'La revisión tardó demasiado. Inténtalo de nuevo.'
        : 'No se pudo contactar con OpenAI. Revisa la conexión.',
      { status: 504, code: 'IA_SIN_RESPUESTA' }
    )
  }

  const cuerpo = await respuesta.json().catch(() => null)

  if (!respuesta.ok) {
    console.error('[ia] respuesta de error de OpenAI:', respuesta.status, cuerpo?.error?.message)
    throw errorDeApi(respuesta.status, cuerpo)
  }

  const tokens = {
    entrada: cuerpo?.usage?.prompt_tokens ?? 0,
    salida: cuerpo?.usage?.completion_tokens ?? 0,
  }

  /**
   * Los fallos de aquí abajo ya están pagados: el modelo respondió, aunque lo
   * que devolvió no sirva. Se le cuelgan los tokens al error para que el
   * registro los contabilice y le descuente cupo a la auditoría; si no, un
   * bucle de respuestas vacías saldría gratis para el tope y caro para la
   * cuenta.
   */
  const yaPagado = (error) => Object.assign(error, { tokens })

  const contenido = cuerpo?.choices?.[0]?.message?.content

  if (!contenido) {
    // Pasa cuando el techo de salida se consume sin llegar a escribir nada.
    throw yaPagado(
      new DomainError('El modelo no devolvió ninguna revisión. Inténtalo de nuevo.', {
        status: 502,
        code: 'IA_VACIO',
      })
    )
  }

  let crudo
  try {
    crudo = JSON.parse(contenido)
  } catch {
    throw yaPagado(
      new DomainError('El modelo devolvió una respuesta que no se pudo leer.', {
        status: 502,
        code: 'IA_FORMATO',
      })
    )
  }

  const validado = respuestaSchema.safeParse(crudo)
  if (!validado.success) {
    console.error('[ia] veredicto con forma inesperada:', contenido)
    throw yaPagado(
      new DomainError('El modelo devolvió una revisión con un formato inesperado.', {
        status: 502,
        code: 'IA_FORMATO',
      })
    )
  }

  return {
    revisiones: validado.data.revisiones,
    modelo: cuerpo?.model ?? modelo,
    // Se devuelve para poder vigilar el gasto desde el propio sistema.
    tokens,
  }
}
