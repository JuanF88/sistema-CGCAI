/**
 * La evaluación de auditados: el formulario como datos.
 *
 * Es la «Propuesta Evaluación de Auditados»: el auditor valora, de 1 a 5, cómo
 * se portó el proceso que auditó en ocho aspectos. Los textos son los del
 * documento; si el formato cambia, se cambia aquí y la pantalla lo sigue.
 *
 * La clave de cada aspecto es el nombre de su columna en
 * `evaluaciones_auditados` (ver `sql/evaluacion-auditados.sql`).
 */

export const INTRODUCCION =
  'La auditoría interna es una oportunidad para revisar cómo se están haciendo las cosas, reconocer lo que funciona bien e identificar aspectos que pueden fortalecerse. Por ello, esta valoración busca recoger de manera sencilla y objetiva la experiencia del proceso auditado durante el desarrollo de la auditoría, de forma que sus resultados aporten al mejoramiento de futuros ejercicios.'

export const OBJETIVO =
  'Valorar la forma en que el proceso auditado se prepara, participa y facilita el desarrollo de la auditoría interna, mediante criterios objetivos asociados con la disponibilidad, suministro de evidencias, interacción con el equipo auditor y atención de los resultados, con el propósito de identificar fortalezas y oportunidades de mejora que contribuyan al fortalecimiento del programa institucional de auditorías.'

/** De mejor a peor, como en el formato. */
export const ESCALA = [
  { valor: 5, etiqueta: 'Excelente' },
  { valor: 4, etiqueta: 'Bueno' },
  { valor: 3, etiqueta: 'Aceptable' },
  { valor: 2, etiqueta: 'Insuficiente' },
  { valor: 1, etiqueta: 'Deficiente' },
]

export const ASPECTOS = [
  {
    clave: 'preparacion',
    titulo: 'Preparación y coordinación de la auditoría',
    descripcion:
      'Se realizó oportunamente la coordinación necesaria, se dispuso del equipo requerido y se facilitó las condiciones para el desarrollo de la auditoría conforme al alcance y programación establecidos.',
  },
  {
    clave: 'disponibilidad',
    titulo: 'Disponibilidad y participación del equipo auditado',
    descripcion:
      'El líder y el equipo estuvieron disponibles en los momentos requeridos y facilitaron la interacción con el auditor líder.',
  },
  {
    clave: 'entrega_informacion',
    titulo: 'Oportunidad en la entrega de información',
    descripcion:
      'La información y las evidencias solicitadas fueron suministradas oportunamente, fueron pertinentes, accesibles y permitieron verificar el cumplimiento y funcionamiento de las actividades evaluadas.',
  },
  {
    clave: 'claridad_informacion',
    titulo: 'Claridad y trazabilidad de la información proporcionada',
    descripcion:
      'Las respuestas y explicaciones proporcionadas permitieron comprender la forma en que opera el proceso y pudieron ser contrastadas con información o evidencia verificable.',
  },
  {
    clave: 'colaboracion',
    titulo: 'Colaboración y disposición durante la auditoría',
    descripcion:
      'Se facilitó el desarrollo del ejercicio, se atendió los requerimientos del equipo auditor y se mantuvo una interacción respetuosa, receptiva y orientada al propósito de la auditoría además de aportar los documentos requerimientos y las firmas necesarias conforme al procedimiento de auditoría.',
  },
  {
    clave: 'aclaraciones',
    titulo: 'Gestión de aclaraciones y diferencias de criterio',
    descripcion:
      'Las aclaraciones o diferencias surgidas durante la auditoría fueron abordadas de manera objetiva, respetuosa y fundamentada en hechos, requisitos y evidencias.',
  },
  {
    clave: 'participacion_cierre',
    titulo: 'Participación en el cierre',
    descripcion:
      'El líder y equipo del proceso participó en la reunión de cierre, atendió los resultados comunicados, presentó las aclaraciones que consideró pertinentes y evidenció disposición para analizar las oportunidades de mejora derivadas del ejercicio de auditoría.',
  },
  {
    clave: 'compromiso_mejora',
    titulo: 'Compromiso con la mejora',
    descripcion:
      'Se mostró disposición para analizar los resultados de la auditoría, definir las acciones requeridas y asumir los compromisos derivados del ejercicio, incluyendo la formulación oportuna del plan de mejora y la concertación de las fechas de seguimiento.',
  },
]

/** Todo lo que se lee de la tabla. */
export const COLUMNAS_EVALUACION = [
  'id',
  'informe_id',
  'lider_proceso',
  'proceso_auditado',
  ...ASPECTOS.map((a) => a.clave),
  'observaciones',
  'updated_at',
].join(', ')

/* ── Lo que hace falta del informe ── */

/**
 * Lo que tiene que estar en el informe antes de evaluar. Es lo mismo que
 * `informeCompleto` (`lib/estado-auditoria.js`) más la fecha, que la
 * evaluación muestra en su cabecera; aquí con nombre, para poder decirle al
 * auditor qué le falta en vez de solo que le falta algo.
 */
const CAMPOS_DEL_INFORME = [
  { campo: 'fecha_auditoria', nombre: 'Fecha de la auditoría' },
  { campo: 'objetivo', nombre: 'Objetivo' },
  { campo: 'criterios', nombre: 'Criterios' },
  { campo: 'conclusiones', nombre: 'Conclusiones' },
  { campo: 'recomendaciones', nombre: 'Recomendaciones' },
]

/** Los campos del informe que aún están vacíos, por su nombre. */
export const faltantesDelInforme = (informe) =>
  CAMPOS_DEL_INFORME.filter(({ campo }) => !String(informe?.[campo] ?? '').trim()).map(
    ({ nombre }) => nombre
  )

/**
 * - `bloqueada`   el informe aún no está diligenciado
 * - `pendiente`   se puede evaluar y no se ha hecho
 * - `diligenciada`
 */
export function estadoEvaluacion(informe, evaluacion) {
  if (evaluacion) return 'diligenciada'
  return faltantesDelInforme(informe).length ? 'bloqueada' : 'pendiente'
}

/* ── El proceso, desde el programa ── */

/** Sin tildes ni mayúsculas, para casar nombres escritos a mano. */
const normalizar = (texto) =>
  String(texto ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .trim()

/**
 * El proceso del cronograma en el que aparece la dependencia de la auditoría.
 *
 * Las auditorías generadas desde el programa salen de una línea del
 * cronograma, pero no guardan cuál: se reconoce por el nombre de la
 * dependencia, igual que al generarlas (`generar-auditorias/route.js`). Las
 * creadas a mano no tienen programa y devuelven `''`: el auditor lo escribe.
 *
 * @param {{ dependencias?: { nombre?: string } }} informe
 * @param {Array<{ proceso: string, dependencias?: Array<{ auditado: string }> }>} cronograma
 */
export function procesoDelPrograma(informe, cronograma) {
  const dependencia = normalizar(informe?.dependencias?.nombre)
  if (!dependencia || !cronograma?.length) return ''

  const linea = cronograma.find((c) =>
    (c.dependencias ?? []).some((d) => normalizar(d.auditado) === dependencia)
  )

  return String(linea?.proceso ?? '').trim()
}

/* ── El formulario ── */

/** Lo que se pinta al abrir: la evaluación guardada o una en blanco. */
export function aFormulario(evaluacion, procesoSugerido = '') {
  return {
    lider_proceso: evaluacion?.lider_proceso ?? '',
    proceso_auditado: evaluacion?.proceso_auditado ?? procesoSugerido,
    ...Object.fromEntries(ASPECTOS.map((a) => [a.clave, evaluacion?.[a.clave] ?? null])),
    observaciones: evaluacion?.observaciones ?? '',
  }
}

/** Errores por campo; vacío si se puede guardar. */
export function validarEvaluacion(form) {
  const errores = {}

  if (!form.lider_proceso.trim()) errores.lider_proceso = 'Indica quién lidera el proceso.'
  if (!form.proceso_auditado.trim()) errores.proceso_auditado = 'Indica el proceso auditado.'

  for (const { clave } of ASPECTOS) {
    if (!ESCALA.some((e) => e.valor === form[clave])) errores[clave] = 'Elige una valoración.'
  }

  return errores
}

/** La fila que se escribe, ya recortada. */
export function aFila(form, informeId) {
  return {
    informe_id: informeId,
    lider_proceso: form.lider_proceso.trim(),
    proceso_auditado: form.proceso_auditado.trim(),
    ...Object.fromEntries(ASPECTOS.map((a) => [a.clave, form[a.clave]])),
    observaciones: form.observaciones.trim(),
    updated_at: new Date().toISOString(),
  }
}

/** Media de los ocho aspectos, con un decimal; `null` sin evaluación. */
export function promedioEvaluacion(evaluacion) {
  if (!evaluacion) return null

  // El `null` de un aspecto sin responder no puede contar: `Number(null)` es 0.
  const valores = ASPECTOS.map((a) => evaluacion[a.clave])
    .filter((v) => v != null)
    .map(Number)
    .filter(Number.isFinite)
  if (!valores.length) return null

  return Math.round((valores.reduce((s, v) => s + v, 0) / valores.length) * 10) / 10
}

const media = (valores) =>
  valores.length
    ? Math.round((valores.reduce((s, v) => s + v, 0) / valores.length) * 10) / 10
    : null

/**
 * La media de cada aspecto entre varias evaluaciones, en el orden del
 * formulario. `pregunta` es la etiqueta corta de la tabla (P1…P8).
 */
export const promedioPorAspecto = (evaluaciones) =>
  ASPECTOS.map((aspecto, i) => ({
    pregunta: `P${i + 1}`,
    titulo: aspecto.titulo,
    promedio: media(
      evaluaciones.map((e) => e[aspecto.clave]).filter((v) => v != null).map(Number)
    ),
  }))

/** Cuántas veces se marcó cada valoración, sumando todos los aspectos. */
export function distribucionDeValoraciones(evaluaciones) {
  const veces = new Map(ESCALA.map((e) => [e.valor, 0]))

  evaluaciones.forEach((e) =>
    ASPECTOS.forEach(({ clave }) => {
      if (veces.has(e[clave])) veces.set(e[clave], veces.get(e[clave]) + 1)
    })
  )

  return ESCALA.map((e) => ({ valoracion: e.etiqueta, veces: veces.get(e.valor) }))
}

/** La media de los promedios de varias evaluaciones. */
export const promedioGeneral = (evaluaciones) =>
  media(evaluaciones.map(promedioEvaluacion).filter((n) => n != null))

/** La etiqueta de la escala más cercana a una nota (para el promedio). */
export const etiquetaDeNota = (nota) =>
  nota == null ? '' : (ESCALA.find((e) => e.valor === Math.round(nota))?.etiqueta ?? '')
