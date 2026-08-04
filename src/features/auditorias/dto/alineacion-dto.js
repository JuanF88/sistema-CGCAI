import { z } from 'zod'

import { nullableNumericId, requiredText } from '@/lib/dto/common'

/**
 * Entrada de la revisión de alineación.
 *
 * El tope de 4.000 caracteres por campo no es una regla de negocio: es el
 * límite de gasto. Cada llamada se paga por token, y sin un techo aquí una
 * petición con medio informe pegado dentro cuesta lo que cien revisiones
 * normales.
 */
const MAX = 4000

const textoOpcional = z
  .string()
  .trim()
  .max(MAX, `Este campo supera los ${MAX} caracteres que admite la revisión.`)
  .optional()
  .default('')

export const revisarAlineacionSchema = z
  .object({
    objetivo_programa: requiredText(
      'Hace falta el objetivo general del programa para poder comparar.',
      MAX
    ),
    objetivo: textoOpcional,
    conclusiones: textoOpcional,

    // Con él se buscan en el cronograma los requisitos ISO del proceso. Sin él
    // la revisión sigue funcionando, solo que sin contexto normativo.
    informe_id: nullableNumericId(),
  })
  .refine((d) => d.objetivo || d.conclusiones, {
    message: 'Escribe el objetivo o las conclusiones antes de pedir la revisión.',
  })
