/**
 * Acceso HTTP al catálogo de dependencias.
 */
import { del, get, post, put, queryString } from '@/lib/api/http'

/** @typedef {import('../types/dependencia').Dependencia} Dependencia */

/**
 * GET /api/dependencias
 * @returns {Promise<Dependencia[]>}
 */
export const listarDependencias = () => get('/api/dependencias')

/**
 * POST /api/dependencias
 * @param {{nombre: string, gestion?: string}} dependencia
 */
export const crearDependencia = (dependencia) => post('/api/dependencias', dependencia)

/** PUT /api/dependencias?id=… */
export const actualizarDependencia = (dependenciaId, cambios) =>
  put(`/api/dependencias${queryString({ id: dependenciaId })}`, cambios)

/** DELETE /api/dependencias?id=… */
export const eliminarDependencia = (dependenciaId) =>
  del(`/api/dependencias${queryString({ id: dependenciaId })}`)
