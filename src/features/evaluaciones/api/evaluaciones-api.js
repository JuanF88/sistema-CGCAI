/**
 * Acceso HTTP al dominio de evaluación de auditores.
 */
import { fetchJson, get, post, put, queryString } from '@/lib/api/http'

/**
 * GET /api/evaluaciones-auditores
 * @param {{periodo?: string, anio?: string|number, auditor_id?: string}} filtros
 */
export const listarEvaluaciones = (filtros = {}) =>
  get(`/api/evaluaciones-auditores${queryString(filtros)}`)

/** GET /api/evaluaciones-auditores/periodos-disponibles */
export const listarPeriodosDisponibles = () =>
  get('/api/evaluaciones-auditores/periodos-disponibles')

/** GET /api/evaluaciones-auditores/periodos */
export const listarPeriodos = () => get('/api/evaluaciones-auditores/periodos')

/**
 * GET /api/evaluaciones-auditores/pesos?periodo=2026-S2
 * Cuánto pesa cada fuente en la nota final de ese periodo.
 */
export const obtenerPesos = (periodo) =>
  get(`/api/evaluaciones-auditores/pesos${queryString({ periodo })}`)

/**
 * PUT /api/evaluaciones-auditores/pesos
 * Guarda los pesos del periodo y recalcula sus evaluaciones.
 * @param {{periodo: string, peso_archivos: number, peso_encuesta: number, peso_rubrica: number}} pesos
 */
export const guardarPesos = (pesos) => put('/api/evaluaciones-auditores/pesos', pesos)

/** GET /api/evaluaciones-auditores/auditor-dashboard?auditor_id=… */
export const obtenerDashboardAuditor = (auditorId) =>
  get(`/api/evaluaciones-auditores/auditor-dashboard${queryString({ auditor_id: auditorId })}`)

/** POST /api/evaluaciones-auditores */
export const guardarEvaluacion = (evaluacion) =>
  post('/api/evaluaciones-auditores', evaluacion)

/** POST /api/evaluaciones-auditores/guardar-rubrica */
export const guardarRubrica = ({ evaluacionId, respuestas, nota }) =>
  post('/api/evaluaciones-auditores/guardar-rubrica', {
    evaluacion_id: evaluacionId,
    rubrica_respuestas: respuestas,
    nota_rubrica: nota,
  })

/** POST /api/evaluaciones-auditores/calcular-archivos */
export const calcularArchivos = ({ auditorId, periodo, dependenciaAuditada }) =>
  post('/api/evaluaciones-auditores/calcular-archivos', {
    auditor_id: auditorId,
    periodo,
    dependencia_auditada: dependenciaAuditada,
  })

/** POST /api/evaluaciones-auditores/actualizar-fechas */
export const actualizarFechas = (payload) =>
  post('/api/evaluaciones-auditores/actualizar-fechas', payload)

/**
 * POST /api/evaluaciones-auditores/importar-encuestas
 * Va como `multipart/form-data`: `fetchJson` detecta el FormData y no fija
 * Content-Type (lo pone el navegador con su boundary).
 *
 * @param {{archivo: File, anio: number|string, semestre: 'S1'|'S2'}} datos
 */
export const importarEncuestas = ({ archivo, anio, semestre }) => {
  const formData = new FormData()
  formData.append('archivo', archivo)
  formData.append('anio', String(anio))
  formData.append('semestre', semestre)

  return fetchJson('/api/evaluaciones-auditores/importar-encuestas', {
    method: 'POST',
    body: formData,
  })
}
