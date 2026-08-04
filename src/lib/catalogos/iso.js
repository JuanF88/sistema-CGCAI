/**
 * Los numerales ISO, resueltos a texto.
 *
 * La base solo guarda el número —`numerales.numeral` es «4.1»—, así que sin
 * esto el modelo recibe una lista de cifras que no significan nada. Aquí se
 * traducen a título y a qué verifica cada uno, con el catálogo de
 * `iso-numerales.json`.
 *
 * ── Qué NO hay aquí ──
 * El texto normativo de las NTC-ISO 9001:2015 y 14001:2015 no se reproduce:
 * son documentos con derechos de autor de ICONTEC/ISO. El JSON lleva el número,
 * el título de la cláusula y una descripción propia de lo que se audita.
 */
// El atributo `with` es obligatorio en el estándar para importar JSON. Sin él
// el empaquetador lo acepta igual, pero el módulo deja de poder ejecutarse en
// Node a secas y no se puede comprobar fuera de la aplicación.
import CATALOGO from './iso-numerales.json' with { type: 'json' }

/**
 * El número de un requisito, venga como venga escrito.
 *
 * En la base están como «4.1», pero el cronograma se rellena a mano y admite
 * texto libre, así que llegan cosas como «4.1 Contexto», «Numeral 8.5.1» o
 * «8.5.» con el punto colgando. Se busca el primer grupo de cifras separadas
 * por puntos y se le quita el punto final.
 *
 * @returns {string} `''` si no hay ningún número reconocible
 */
export function normalizarNumeral(texto) {
  const encontrado = String(texto ?? '').match(/\d+(?:\.\d+)*/)
  return encontrado ? encontrado[0].replace(/\.$/, '') : ''
}

/** «4.1, 4.2, 8.5» → ['4.1', '4.2', '8.5'], sin vacíos ni repetidos. */
export function partirNumerales(texto) {
  const vistos = new Set()

  for (const parte of String(texto ?? '').split(/[,;\n]/)) {
    const numero = normalizarNumeral(parte)
    if (numero) vistos.add(numero)
  }

  return [...vistos]
}

/**
 * La ficha de un numeral, subiendo por la jerarquía si hace falta.
 *
 * Si se pide «8.5.1» y el catálogo solo llega al segundo nivel, devuelve la de
 * «8.5» conservando el número pedido: es preferible dar el contexto del
 * requisito padre que no dar ninguno. Nunca sube hasta el capítulo suelto
 * («8»), que es demasiado genérico para aportar algo.
 */
export function fichaDeNumeral(codigoNorma, numeral) {
  const numerales = CATALOGO[codigoNorma]?.numerales
  if (!numerales) return null

  let clave = normalizarNumeral(numeral)
  if (!clave) return null

  while (clave.includes('.')) {
    if (numerales[clave]) {
      return { numeral: normalizarNumeral(numeral), ...numerales[clave] }
    }
    clave = clave.slice(0, clave.lastIndexOf('.'))
  }

  return null
}

/** El nombre de la norma tal como se cita en los informes. */
export const nombreNorma = (codigoNorma) => CATALOGO[codigoNorma]?.norma ?? ''

/**
 * Bloque de texto con los requisitos de una norma, listo para el prompt.
 *
 * Los numerales que no estén en el catálogo se omiten en silencio: el
 * cronograma admite texto libre y un requisito mal escrito no debe impedir que
 * los demás lleguen.
 *
 * @param {'9001'|'14001'} codigoNorma
 * @param {string} requisitos  Lista separada por comas, como la guarda el cronograma
 * @returns {string} `''` si no hay ningún numeral reconocible
 */
export function bloqueDeRequisitos(codigoNorma, requisitos) {
  const fichas = partirNumerales(requisitos)
    .map((numero) => fichaDeNumeral(codigoNorma, numero))
    .filter(Boolean)

  if (!fichas.length) return ''

  const lineas = fichas.map((f) => `- ${f.numeral} ${f.titulo}: ${f.verifica}`)
  return `${nombreNorma(codigoNorma)}\n${lineas.join('\n')}`
}

/**
 * Todo el contexto normativo de una auditoría.
 *
 * @param {{requisitos_9001?: string, requisitos_14001?: string}} seccion
 * @returns {string} `''` si la sección no declara requisitos
 */
export function contextoNormativo(seccion) {
  return [
    bloqueDeRequisitos('9001', seccion?.requisitos_9001),
    bloqueDeRequisitos('14001', seccion?.requisitos_14001),
  ]
    .filter(Boolean)
    .join('\n\n')
}
