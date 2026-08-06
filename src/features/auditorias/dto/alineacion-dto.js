import { z } from 'zod'

import { numericId, requiredText } from '@/lib/dto/common'

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

    // Obligatorio: con él se buscan en el cronograma los requisitos ISO del
    // proceso, y sobre todo es la auditoría a la que se le cuenta el consumo.
    // El tope de diez revisiones es por auditoría, así que una revisión sin
    // auditoría sería una revisión sin cupo. En el formulario siempre existe:
    // el botón solo aparece cuando la auditoría viene de un programa.
    informe_id: numericId('Falta la auditoría sobre la que se pide la revisión.'),
  })
  .refine((d) => d.objetivo || d.conclusiones, {
    message: 'Escribe el objetivo o las conclusiones antes de pedir la revisión.',
  })
