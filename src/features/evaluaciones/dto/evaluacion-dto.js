import { z } from 'zod'
import { numericId, periodo, requiredText } from '@/lib/dto/common'

/** POST /api/evaluaciones-auditores/guardar-rubrica */
export const guardarRubricaSchema = z.object({
  evaluacion_id: numericId('evaluacion_id es requerido'),
  rubrica_respuestas: z.record(z.string(), z.unknown(), {
    message: 'rubrica_respuestas debe ser un objeto válido',
  }),
  nota_rubrica: z.coerce
    .number({ message: 'nota_rubrica es requerida' })
    .min(0, 'nota_rubrica debe estar entre 0 y 5')
    .max(5, 'nota_rubrica debe estar entre 0 y 5'),
})

/** POST /api/evaluaciones-auditores/calcular-archivos */
export const calcularArchivosSchema = z.object({
  auditor_id: requiredText('Faltan parámetros requeridos: auditor_id, periodo, dependencia_auditada', 64),
  periodo: periodo(),
  dependencia_auditada: requiredText(
    'Faltan parámetros requeridos: auditor_id, periodo, dependencia_auditada',
    255
  ),
})

/** POST /api/evaluaciones-auditores/importar-encuestas (viene como FormData). */
export const importarEncuestasSchema = z.object({
  anio: z.coerce.number().int().min(2000).max(2100, 'Año inválido'),
  semestre: z.enum(['S1', 'S2'], { message: 'Semestre inválido' }),
})
