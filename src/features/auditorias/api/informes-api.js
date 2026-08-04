/**
 * Acceso HTTP al dominio de informes de auditoría.
 */
import { del, get, post } from '@/lib/api/http'

/** @typedef {import('../types/informe').Informe} Informe */

/**
 * GET /api/informes
 * @returns {Promise<Informe[]>}
 */
export const listarInformes = () => get('/api/informes')

/**
 * POST /api/informes
 * @param {Partial<Informe>} informe
 * @returns {Promise<Informe[]>}
 */
export const crearInforme = (informe) => post('/api/informes', informe)

/** DELETE /api/informes */
export const eliminarInforme = (informeId) => del('/api/informes', { id: informeId })

/** GET /api/planesAuditoria */
export const listarPlanesAuditoria = () => get('/api/planesAuditoria')

/**
 * POST /api/informes/validar-alineacion
 *
 * Revisa contra el objetivo del programa. No guarda nada: es una consulta.
 *
 * @param {{objetivo_programa: string, objetivo?: string, conclusiones?: string}} textos
 * @returns {Promise<{revisiones: Array<{campo: string, veredicto: string, comentario: string, sugerencia: string}>, modelo: string, tokens: {entrada: number, salida: number}}>}
 */
export const validarAlineacion = (textos) => post('/api/informes/validar-alineacion', textos)
