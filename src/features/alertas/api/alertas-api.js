/**
 * Acceso HTTP al dominio de alertas de auditoría.
 */
import { get, patch, post } from '@/lib/api/http'

/** GET /api/alertas/config */
export const obtenerConfiguracionAlertas = () => get('/api/alertas/config')

/**
 * PATCH /api/alertas/config
 * @param {Array<Object>} configs
 */
export const guardarConfiguracionAlertas = (configs) =>
  patch('/api/alertas/config', { configs })

/**
 * POST /api/alertas/ejecutar — dispara el barrido real (envía correos).
 * También lo llama el cron de Vercel con su secreto.
 */
export const ejecutarAlertas = () => post('/api/alertas/ejecutar')

/** POST /api/alertas/preview — simulacro: calcula sin enviar nada. */
export const previsualizarAlertas = () => post('/api/alertas/preview')
