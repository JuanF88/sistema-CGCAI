/**
 * Formas de los datos del dominio de hallazgos.
 */

/**
 * @typedef {'Fortaleza'|'Oportunidad de Mejora'|'No Conformidad'} TipoHallazgo
 */

/**
 * Hallazgo unificado tal como lo devuelve `/api/hallazgos`.
 *
 * @typedef {Object} Hallazgo
 * @property {number} id
 * @property {string} key                 Clave estable: `<tipo>-<id>`
 * @property {TipoHallazgo} tipo
 * @property {string} descripcion
 * @property {number} informe_id
 * @property {string} [razon]             Solo en fortalezas
 * @property {string} [para_que]          Solo en oportunidades de mejora
 * @property {string} [evidencia]         Solo en no conformidades
 * @property {{iso: string}|null} iso
 * @property {{capitulo: string}|null} capitulos
 * @property {{numeral: string}|null} numerales
 * @property {Object|null} informes_auditoria
 */

export {}
