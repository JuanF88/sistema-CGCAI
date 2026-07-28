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
