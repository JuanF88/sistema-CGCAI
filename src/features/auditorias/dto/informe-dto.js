import { z } from 'zod'
import {
  nullableNumericId,
  nullableText,
  nullableYmdDate,
  numericId,
  ymdDate,
} from '@/lib/dto/common'

/**
 * POST /api/informes
 *
 * El cliente a veces envía el cuerpo anidado como `{ nuevoInforme: {...} }`;
 * eso se aplana antes de validar (ver `flattenInformeBody`).
 */
export const crearInformeSchema = z.object({
  usuario_id: numericId('Falta usuario_id (numérico)'),
  dependencia_id: numericId('Falta dependencia_id (numérico)'),
  fecha_auditoria: ymdDate('Falta fecha_auditoria (YYYY-MM-DD)'),
  fecha_seguimiento: nullableYmdDate(),
  validado: z.boolean().optional().default(false),
  asistencia_tipo: z.string().trim().max(60).optional().default('Digital'),
  auditores_acompanantes: z.array(z.union([z.string(), z.number()])).optional().default([]),
  objetivo: nullableText(),
  criterios: nullableText(),
  conclusiones: nullableText(),
  recomendaciones: nullableText(),

  /**
   * Programa que generó la auditoría; `null` si se creó a mano.
   *
   * Opcional a propósito: crear una auditoría suelta desde «Nueva auditoría»
   * seguirá siendo válido, y las que ya existen se quedan en `null`.
   */
  programa_auditoria_id: nullableNumericId(),
})

/** DELETE /api/informes */
export const eliminarInformeSchema = z.object({
  id: numericId('Falta el ID del informe a eliminar'),
})

/**
 * Aplana `{ nuevoInforme: {...}, ...resto }` en un único objeto.
 * Los campos de `nuevoInforme` tienen prioridad.
 */
export const flattenInformeBody = (raw) =>
  raw?.nuevoInforme && typeof raw.nuevoInforme === 'object'
    ? { ...raw, ...raw.nuevoInforme }
    : raw
