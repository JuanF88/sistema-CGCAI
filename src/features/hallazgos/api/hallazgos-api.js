/**
 * Acceso HTTP al dominio de hallazgos.
 *
 * El endpoint devuelve fortalezas, oportunidades de mejora y no conformidades
 * ya unificadas en una sola lista, con el campo `tipo` para distinguirlas.
 */
import { get } from '@/lib/api/http'

/** @typedef {import('../types/hallazgo').Hallazgo} Hallazgo */

/**
 * GET /api/hallazgos
 * @returns {Promise<Hallazgo[]>}
 */
export const listarHallazgos = () => get('/api/hallazgos')
