/**
 * Acceso HTTP al registro de actividad.
 */
import { get, queryString } from '@/lib/api/http'

/**
 * GET /api/registro-actividad
 *
 * @param {Object} filtros
 * @param {string} [filtros.tipo]       'dato' | 'archivo' | 'sesion'
 * @param {string} [filtros.accion]     'crear' | 'modificar' | 'eliminar' | 'subir' | …
 * @param {string} [filtros.entidades]  Lista separada por comas
 * @param {number} [filtros.actor]      `usuario_id`
 * @param {string} [filtros.desde]      'YYYY-MM-DD'
 * @param {string} [filtros.hasta]      'YYYY-MM-DD'
 * @param {number} [filtros.pagina]
 * @param {number} [filtros.porPagina]
 * @returns {Promise<{filas: Array, total: number, pagina: number, porPagina: number, hayMas: boolean, accesosNuevos: number}>}
 */
export const listarActividad = (filtros = {}) =>
  get(`/api/registro-actividad${queryString(filtros)}`)
