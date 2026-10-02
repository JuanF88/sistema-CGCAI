import { z } from 'zod'

import { numericId, requiredText } from '@/lib/dto/common'

/**
 * POST /api/alertas/manual
 *
 * Aviso enviado a mano desde el Centro de Control, sobre un documento y un
 * grupo de auditorías concreto.
 *
 * `enviar: false` —el valor por defecto— solo calcula: devuelve a quién iría,
 * con qué texto y si ya se avisó hoy, sin mandar nada. Es la previsualización.
 * Pedir el envío tiene que ser explícito.
 */
export const avisoManualSchema = z.object({
  proceso_key: requiredText('Falta el documento sobre el que avisar', 60),
  informe_ids: z
    .array(numericId('Identificador de auditoría inválido'))
    .min(1, 'Hay que indicar al menos una auditoría')
    .max(100, 'Demasiadas auditorías en un solo envío'),
  enviar: z.boolean().optional().default(false),
})
