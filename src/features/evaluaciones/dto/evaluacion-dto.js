import { z } from 'zod'
import { periodo, requiredText, uuidId } from '@/lib/dto/common'

/**
 * POST /api/evaluaciones-auditores/guardar-rubrica
 *
 * `evaluacion_id` es un UUID, no un entero. Estaba declarado como id numérico,
 * así que la validación rechazaba toda petición antes de llegar a la base y
 * guardar la rúbrica devolvía «Datos inválidos».
 */
export const guardarRubricaSchema = z.object({
  evaluacion_id: uuidId('evaluacion_id es requerido'),
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

/** Peso de una fuente, en porcentaje entero. */
const peso = (fuente) =>
  z.coerce
    .number({ message: `El peso de ${fuente} debe ser un número` })
    .int(`El peso de ${fuente} debe ser un número entero`)
    .min(0, `El peso de ${fuente} no puede ser negativo`)
    .max(100, `El peso de ${fuente} no puede pasar de 100`)

/**
 * PUT /api/evaluaciones-auditores/pesos
 *
 * Los tres tienen que sumar 100. Es la condición que hace que la nota se
 * pueda explicar: «40 % archivos, 30 % encuesta, 30 % rúbrica».
 */
export const pesosEvaluacionSchema = z
  .object({
    periodo: periodo(),
    peso_archivos: peso('archivos'),
    peso_encuesta: peso('la encuesta'),
    peso_rubrica: peso('la rúbrica'),
  })
  .refine((d) => d.peso_archivos + d.peso_encuesta + d.peso_rubrica === 100, {
    message: 'Los tres pesos tienen que sumar 100 %.',
  })
