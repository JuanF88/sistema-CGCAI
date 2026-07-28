/**
 * Variables de entorno públicas (`NEXT_PUBLIC_*`), validadas con Zod.
 *
 * Se pueden importar desde cualquier sitio, cliente incluido.
 *
 * ⚠️ Los accesos a `process.env.NEXT_PUBLIC_*` tienen que estar escritos
 * literalmente: Next los sustituye por su valor en tiempo de build y una
 * lectura dinámica (`process.env[nombre]`) no se inlinea.
 */
import { z } from 'zod'

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('NEXT_PUBLIC_SUPABASE_URL debe ser una URL válida'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY es obligatoria'),
})

const parsed = schema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
})

if (!parsed.success) {
  // No lanzamos: durante el build estático estas variables pueden faltar y
  // romperían el prerender. El fallo real aparece al llamar a Supabase.
  console.warn(
    '[env] Variables públicas incompletas:',
    parsed.error.issues.map((i) => i.path.join('.')).join(', ')
  )
}

export const publicEnv = parsed.success
  ? parsed.data
  : {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    }
