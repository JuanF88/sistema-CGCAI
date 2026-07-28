import { z } from 'zod'
import { numericId, requiredText } from '@/lib/dto/common'

/** Valores admitidos en `dependencias.gestion`. */
export const GESTION_VALUES = [
  'estrategica',
  'academica',
  'investigacion',
  'administrativa',
  'cultura',
  'control',
  'otras',
]

/** Normaliza la gestión: sin tildes, minúsculas. Devuelve null si no es válida. */
export const normalizeGestion = (valor) => {
  if (!valor) return null
  const v = String(valor)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
  return GESTION_VALUES.includes(v) ? v : null
}

const gestionSchema = z
  .string()
  .optional()
  .nullable()
  .transform((v) => normalizeGestion(v))

/** POST /api/dependencias */
export const crearDependenciaSchema = z.object({
  nombre: requiredText('El nombre es requerido.', 255),
  // Si no llega o no es válida, cae en 'otras' (comportamiento histórico).
  gestion: gestionSchema.transform((v) => v ?? 'otras'),
})

/** PUT /api/dependencias?id=… */
export const actualizarDependenciaSchema = z
  .object({
    nombre: z
      .string()
      .trim()
      .min(1, 'El nombre no puede estar vacío.')
      .max(255)
      .optional(),
    gestion: z
      .string()
      .optional()
      .transform((v, ctx) => {
        if (v === undefined) return undefined
        const normalizada = normalizeGestion(v)
        if (!normalizada) {
          ctx.addIssue({ code: 'custom', message: 'Gestión inválida.' })
          return z.NEVER
        }
        return normalizada
      }),
  })
  .refine((data) => data.nombre !== undefined || data.gestion !== undefined, {
    message: 'No hay campos para actualizar.',
  })

/** Query `?id=` de PUT y DELETE. */
export const dependenciaIdSchema = numericId('Falta el parámetro id.')
