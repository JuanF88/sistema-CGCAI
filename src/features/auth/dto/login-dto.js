import { z } from 'zod'

/** POST /api/auth/login */
export const loginSchema = z.object({
  email: z
    .string({ message: 'El correo es obligatorio.' })
    .trim()
    .min(1, 'El correo es obligatorio.')
    .email('Correo o contraseña incorrectos'),
  password: z
    .string({ message: 'La contraseña es obligatoria.' })
    .min(1, 'La contraseña es obligatoria.'),
})
