/**
 * Formas de los datos del dominio de auditorías.
 */

/**
 * Referencia mínima a un hallazgo (la API solo devuelve el id para contar).
 * @typedef {Object} HallazgoRef
 * @property {number} id
 */

/**
 * Fila de `informes_auditoria` con sus relaciones expandidas.
 *
 * @typedef {Object} Informe
 * @property {number} id
 * @property {number} usuario_id
 * @property {number} dependencia_id
 * @property {string} fecha_auditoria      Formato YYYY-MM-DD
 * @property {string|null} fecha_seguimiento
 * @property {boolean} validado
 * @property {string} asistencia_tipo
 * @property {Array<string|number>} auditores_acompanantes
 * @property {string|null} objetivo
 * @property {string|null} criterios
 * @property {string|null} conclusiones
 * @property {string|null} recomendaciones
 * @property {{nombre: string, apellido: string}|null} usuarios
 * @property {{nombre: string, gestion?: string}|null} dependencias
 * @property {HallazgoRef[]} [fortalezas]
 * @property {HallazgoRef[]} [oportunidades_mejora]
 * @property {HallazgoRef[]} [no_conformidades]
 */

/**
 * Entrada del plan anual de auditoría.
 *
 * @typedef {Object} PlanAuditoria
 * @property {number} id
 * @property {string} enlace
 * @property {string} dependencia
 */

export {}
