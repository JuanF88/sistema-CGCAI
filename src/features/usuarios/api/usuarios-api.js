/**
 * Acceso HTTP al dominio de usuarios.
 * Los componentes usan estas funciones; nunca `fetch` directamente.
 */
import { del, get, post, put, queryString } from '@/lib/api/http'

/** @typedef {import('../types/usuario').Usuario} Usuario */

/**
 * GET /api/usuarios
 * @param {{rol?: string}} [filtros]
 * @returns {Promise<Usuario[]>}
 */
export const listarUsuarios = (filtros = {}) =>
  get(`/api/usuarios${queryString(filtros)}`)

/** Atajo de uso frecuente: solo los auditores. */
export const listarAuditores = () => listarUsuarios({ rol: 'auditor' })

/**
 * POST /api/usuarios
 * @param {Partial<Usuario> & {password: string, sendCredentials?: boolean}} usuario
 */
export const crearUsuario = (usuario) => post('/api/usuarios', usuario)

/**
 * PUT /api/usuarios?id=…
 * Actualización parcial: solo se envían los campos presentes.
 */
export const actualizarUsuario = (usuarioId, cambios) =>
  put(`/api/usuarios${queryString({ id: usuarioId })}`, cambios)

/** DELETE /api/usuarios?id=… */
export const eliminarUsuario = (usuarioId) =>
  del(`/api/usuarios${queryString({ id: usuarioId })}`)

/** POST /api/usuarios/send-credentials */
export const enviarCredenciales = (usuarioId) =>
  post('/api/usuarios/send-credentials', { usuario_id: usuarioId })
