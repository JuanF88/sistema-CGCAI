/**
 * Rúbrica de evaluación de auditores (según `docs/Rubrica.xlsx`).
 *
 * Seis criterios con el mismo peso, calificados de 1 a 4. Cada nivel lleva su
 * descripción para que el evaluador vea qué significa cada nota.
 */

/**
 * @typedef {Object} CriterioRubrica
 * @property {string} id
 * @property {string} nombre
 * @property {string} descripcion
 * @property {number} peso
 * @property {Record<string, string>} niveles  nota → qué significa
 */

/** @type {CriterioRubrica[]} */
export const RUBRICA_CRITERIOS = [
  {
    id: 'c1',
    nombre: '1. Identificación del Informe',
    descripcion:
      'Exactitud y completitud en la codificación, nombre del proceso, fecha, versión, etc.',
    peso: 1 / 6,
    niveles: {
      4: 'Excelente: Todos los datos completos, claros y correctamente codificados, firmados, con fechas claras.',
      3.8: 'Destacable: Datos completos y bien presentados, con leves detalles mejorables.',
      3.5: 'Muy bueno: Datos principales correctos, con omisiones menores sin afectar entendimiento.',
      3.3: 'Óptimo: Información clara en su mayoría, con errores puntuales, leve claridad de seguimiento.',
      3: 'Aceptable: Datos necesarios incluidos, con errores menores de presentación o codificación.',
      2: 'Deficiente: Datos incompletos, varias casillas sin diligenciar o mal organizados.',
      1: 'Insuficiente: Falta información básica o codificación incorrecta, sin firmas, sin fechas e interés de continuidad.',
    },
  },
  {
    id: 'c2',
    nombre: '2. Objetivo y Alcance de la Auditoría',
    descripcion:
      'Claridad en la definición del objetivo y alcance, en coherencia con el programa de auditoría.',
    peso: 1 / 6,
    niveles: {
      4: 'Excelente: Objetivo y alcance completamente definidos, con redacción clara, precisa y coherente, muestra lineamientos personalizados.',
      3.8: 'Destacable: Objetivo y alcance definidos, con redacción clara y relación coherente al programa, se atreve a plasmar varios lineamientos.',
      3.5: 'Muy bueno: Objetivo y alcance presentes, aunque mejorables en claridad o profundidad, intenta atreverse a mostrar propios lineamientos.',
      3.3: 'Óptimo: Objetivo y alcance abordados con redacción menos precisa, se atreve poco a mostrar propios lineamientos.',
      3: 'Aceptable: Objetivo y alcance definidos, aunque con redacción mejorable.',
      2: 'Deficiente: Objetivo y alcance poco claros o no vinculados al programa.',
      1: 'Insuficiente: Objetivo y alcance no definidos.',
    },
  },
  {
    id: 'c3',
    nombre: '3. Oportunidades de Mejora',
    descripcion:
      'Registro preciso y sustentado de oportunidades de mejora, con evidencia objetiva.',
    peso: 1 / 6,
    niveles: {
      4: 'Excelente: Registro completo, bien redactado, con evidencias objetivas y relevantes, buena definición respecto a la norma.',
      3.8: 'Destacable: Redacción clara y respaldada por análisis; se pueden mejorar algunos aspectos.',
      3.5: 'Muy bueno: Claras y justificadas con menor profundidad analítica y con redacción que no corresponde al tipo de hallazgo.',
      3.3: 'Óptimo: Adecuadas pero con escasa justificación o redacción mejorable.',
      3: 'Aceptable: Listadas pero con redacción deficiente o justificación débil.',
      2: 'Deficiente: Sin justificación clara o dista un poco respecto a la interpretación del requisito de norma.',
      1: 'Insuficiente: No se identifican hallazgos pero tampoco se plasma evidencia objetiva que respalde la conformidad.',
    },
  },
  {
    id: 'c4',
    nombre: '4. No Conformidades',
    descripcion: 'Registro preciso y sustentado de No Conformidades, con evidencia objetiva.',
    peso: 1 / 6,
    niveles: {
      4: 'Excelente: No conformidades claramente identificadas, bien fundamentadas y basadas en evidencia.',
      3.8: 'Destacable: Bien definidas y justificadas, con redacción técnica adecuada. Entendimiento entre lo encontrado y el requisito de norma.',
      3.5: 'Muy bueno: Presentes con claridad básica; puede faltar detalle o evidencia.',
      3.3: 'Óptimo: Redacción aceptable con algunos elementos faltantes.',
      3: 'Aceptable: Mencionadas sin suficiente claridad ni evidencia.',
      2: 'Deficiente: Mal redactadas o sin sustento objetivo.',
      1: 'Insuficiente: Poco fundamento, poca equidad con requisito de norma.',
    },
  },
  {
    id: 'c5',
    nombre: '5. Redacción y Lenguaje Técnico',
    descripcion:
      'Claridad, coherencia, ortografía, uso de terminología adecuada y estilo profesional.',
    peso: 1 / 6,
    niveles: {
      4: 'Excelente: Redacción impecable, lenguaje técnico preciso y estilo profesional.',
      3.8: 'Destacable: Lenguaje profesional con mínimas imprecisiones. Se mantiene claridad y tono técnico adecuado.',
      3.5: 'Muy bueno: Buena redacción con algunos errores de forma o estilo técnico, sin comprometer comprensión.',
      3.3: 'Óptimo: Redacción adecuada pero con errores ocasionales o uso técnico mejorable.',
      3: 'Aceptable: Varios errores de forma, coherencia o terminología.',
      2: 'Deficiente: Redacción confusa o poco técnica en algunos apartados.',
      1: 'Insuficiente: Redacción deficiente con numerosos errores.',
    },
  },
  {
    id: 'c6',
    nombre: '6. Análisis Crítico y Valor Agregado',
    descripcion: 'Aporte reflexivo y valor agregado al proceso/dependencia auditada.',
    peso: 1 / 6,
    niveles: {
      4: 'Excelente: Presenta análisis reflexivo, aporta ideas y genera valor al proceso/dependencia/programa auditado.',
      3.8: 'Destacable: Se evidencia reflexión y propuesta de mejoras, aunque con menor profundidad.',
      3.5: 'Muy bueno: Aporta ideas útiles y análisis moderado, con oportunidad de profundización.',
      3.3: 'Óptimo: Contiene elementos de análisis, aunque superficiales o poco desarrollados.',
      3: 'Aceptable: Se evidencia análisis pero con menor profundidad.',
      2: 'Deficiente: Análisis escaso o sin aporte claro.',
      1: 'Insuficiente: Ausencia de análisis o valor agregado.',
    },
  },
]

/** Niveles de un criterio, de mayor a menor. */
export const nivelesOrdenados = (criterio) =>
  Object.keys(criterio.niveles).sort((a, b) => Number(b) - Number(a))

/**
 * Nota de la matriz: promedio de los criterios calificados en escala 1-4,
 * reescalado a 1-5. No hace falta calificarlos todos.
 */
export function notaDeCalificaciones(calificaciones = {}) {
  const calificados = RUBRICA_CRITERIOS.filter((c) => calificaciones[c.id])
  if (!calificados.length) return 0

  const promedio =
    calificados.reduce((acc, c) => acc + parseFloat(calificaciones[c.id]), 0) / calificados.length
  return 1 + (promedio - 1) * (4 / 3)
}

/** Color de una nota sobre 5. */
export const colorNota = (nota) =>
  nota >= 4 ? 'text-emerald-600' : nota >= 3 ? 'text-amber-600' : 'text-destructive'
