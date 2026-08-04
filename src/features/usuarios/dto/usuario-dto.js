import { z } from 'zod'
import {
  nullableNumericId,
  nullableText,
  numericId,
  requiredText,
} from '@/lib/dto/common'
import { ROLES } from '@/lib/auth/roles'

const rolSchema = z.enum(Object.values(ROLES), {
  message: 'Rol no reconocido.',
})

const estadoSchema = z.enum(['activo', 'inactivo']).default('activo')

/** POST /api/usuarios */
export const crearUsuarioSchema = z.object({
  nombre: nullableText(120),
  apellido: nullableText(120),
  email: z.string({ message: 'El correo es obligatorio.' }).trim().email('Correo inválido.'),
  password: requiredText('La contraseña es obligatoria.', 200),
  rol: rolSchema,
  sendCredentials: z.boolean().optional().default(false),
  estado: estadoSchema,
  tipo_personal: nullableText(120),
  dependencia_id: nullableNumericId(),
  estudios: nullableText(500),
  tipo_estudio: nullableText(120),
  celular: nullableText(40),
})

/**
 * PUT /api/usuarios?id=…
 *
 * ⚠️ Actualización parcial: un campo ausente debe quedarse en `undefined`, NO
 * convertirse en `null`. Por eso aquí no se usa `nullableText()` — ese helper
 * normaliza la ausencia a `null` y borraría el dato guardado.
 */
const optionalText = (max) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v === '' ? null : v))

export const actualizarUsuarioSchema = z
  .object({
    nombre: optionalText(120),
    apellido: optionalText(120),
    email: z.string().trim().email('Correo inválido.').optional(),
    password: z.string().trim().min(1).max(200).optional(),
    rol: rolSchema.optional(),
    estado: z.enum(['activo', 'inactivo']).optional(),
    tipo_personal: optionalText(120),
    // Histórico: un valor vacío se guarda como null.
    dependencia_id: nullableNumericId(),
    estudios: optionalText(500),
    tipo_estudio: optionalText(120),
    celular: optionalText(40),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: 'No hay campos para actualizar.',
  })

/** POST /api/usuarios/send-credentials */
export const enviarCredencialesSchema = z.object({
  usuario_id: numericId('usuario_id es obligatorio.'),
})

/** Query `?id=` de PUT y DELETE. */
export const usuarioIdSchema = numericId('ID de usuario no proporcionado')
