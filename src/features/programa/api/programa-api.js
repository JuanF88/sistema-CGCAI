/**
 * Acceso HTTP al programa de auditoría.
 */
import { del, get, post, put, queryString } from '@/lib/api/http'

/** GET /api/programa-auditoria → lista resumida. */
export const listarProgramas = () => get('/api/programa-auditoria')

/** GET /api/programa-auditoria/catalogos → opciones de los desplegables. */
export const obtenerCatalogosPrograma = () => get('/api/programa-auditoria/catalogos')

/** GET /api/programa-auditoria?id=… → cabecera con cronograma y distribución. */
export const obtenerPrograma = (id) => get(`/api/programa-auditoria${queryString({ id })}`)

/** POST /api/programa-auditoria */
export const crearPrograma = (programa) => post('/api/programa-auditoria', programa)

/** PUT /api/programa-auditoria?id=… */
export const actualizarPrograma = (id, programa) =>
  put(`/api/programa-auditoria${queryString({ id })}`, programa)

/** DELETE /api/programa-auditoria?id=… */
export const eliminarPrograma = (id) => del(`/api/programa-auditoria${queryString({ id })}`)
