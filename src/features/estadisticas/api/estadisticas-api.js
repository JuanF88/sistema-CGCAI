/**
 * Acceso HTTP a las estadísticas agregadas de hallazgos.
 */
import { get } from '@/lib/api/http'

/**
 * GET /api/estadisticas
 *
 * @returns {Promise<{
 *   detalle: Array<{anio: number|null, dependencia: string, gestion: string|null, tipo: string, iso: string|null, numeral: string|null, cantidad: number}>,
 *   resumenPorDependencia: Array<{anio: string|null, dependencia: string, cantidad: number}>,
 *   resumenPorTipo: Array<{tipo: string, cantidad: number}>,
 *   anios: Array<number|string>,
 *   dependencias: Array<{nombre: string, gestion: string|null}>,
 * }>}
 */
export const obtenerEstadisticas = () => get('/api/estadisticas')
