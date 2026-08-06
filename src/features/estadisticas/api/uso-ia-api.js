/**
 * Acceso HTTP al consumo de la revisión con IA.
 */
import { get } from '@/lib/api/http'

/**
 * GET /api/ia/uso — solo administración.
 *
 * @returns {Promise<{
 *   limite: number,
 *   truncado: boolean,
 *   resumen: {revisiones: number, ok: number, errores: number, bloqueadas: number,
 *             tokensEntrada: number, tokensSalida: number, tokensTotal: number,
 *             auditorias: number, usuarios: number, agotadas: number,
 *             mediaTokens: number, mediaDuracionMs: number, mediaPorAuditoria: number},
 *   presupuesto: {limiteUsd: number, usadoPct: number|null, sistemaPct: number|null,
 *                 origen: 'facturado'|'estimado'|null,
 *                 facturacion: {disponible: boolean, motivo: string|null,
 *                               desde: string|null, hasta: string|null, dias: number}},
 *   veredictos: {alineado: number, parcial: number, desalineado: number},
 *   errores: Array<{codigo: string, veces: number}>,
 *   porDia: Array<{fecha: string, revisiones: number, tokens: number}>,
 *   porAuditoria: Array<{informeId: number, dependencia: string, usos: number,
 *                        consumidas: number, restantes: number, bloqueadas: number,
 *                        tokens: number, partePct: number, ultima: string}>,
 *   porUsuario: Array<{usuario: string, usos: number, tokens: number,
 *                      partePct: number, auditorias: number}>,
 * }>}
 */
export const obtenerUsoIA = () => get('/api/ia/uso')
