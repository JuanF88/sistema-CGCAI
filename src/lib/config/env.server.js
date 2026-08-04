import 'server-only'

/**
 * Variables de entorno del servidor, validadas con Zod.
 *
 * Ningún módulo debe leer `process.env` directamente: se declara aquí y se
 * importa desde aquí. El import de `server-only` hace que el build falle si
 * este archivo llega por error a un bundle de cliente.
 *
 * La validación es perezosa (`getServerEnv()`), no al importar: durante el
 * build de Next hay rutas que se evalúan sin todas las variables presentes y
 * un throw a nivel de módulo rompería el `next build`.
 */
import { z } from 'zod'

const schema = z.object({
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // Correo (opcional: si falta, el envío se desactiva sin romper la operación)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_SECURE: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((v) => v === true || v === 'true'),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  APP_LOGIN_URL: z.string().url().optional(),
  APP_ASSET_BASE_URL: z.string().url().optional(),

  // Cron de alertas
  CRON_SECRET: z.string().optional(),
  ALERTAS_CRON_SECRET: z.string().optional(),

  // Revisión de alineación con IA (opcional: sin clave, el botón avisa y ya).
  //
  // Sin prefijo `NEXT_PUBLIC_` a propósito: una clave de API en el bundle del
  // navegador la lee cualquiera con las herramientas de desarrollador y gasta
  // el saldo. Solo se usa desde la ruta del servidor.
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().optional(),
})

let cached = null

/**
 * Devuelve el entorno del servidor ya validado. Lanza con el detalle de las
 * variables que faltan la primera vez que se usa.
 */
export function getServerEnv() {
  if (cached) return cached

  const result = schema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_SECURE: process.env.SMTP_SECURE,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS,
    SMTP_FROM: process.env.SMTP_FROM,
    APP_LOGIN_URL: process.env.APP_LOGIN_URL,
    APP_ASSET_BASE_URL: process.env.APP_ASSET_BASE_URL,
    CRON_SECRET: process.env.CRON_SECRET,
    ALERTAS_CRON_SECRET: process.env.ALERTAS_CRON_SECRET,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_MODEL: process.env.OPENAI_MODEL,
  })

  if (!result.success) {
    const faltantes = result.error.issues.map((i) => i.path.join('.')).join(', ')
    throw new Error(`[env] Variables de entorno inválidas o ausentes: ${faltantes}`)
  }

  cached = result.data
  return cached
}

/** ¿Está configurado el envío de correo? */
export function isSmtpConfigured() {
  const env = getServerEnv()
  return Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS)
}

/** ¿Está configurada la revisión de alineación con IA? */
export function isOpenAiConfigured() {
  return Boolean(getServerEnv().OPENAI_API_KEY)
}

/** Secretos válidos para autorizar el cron de alertas. */
export function getCronSecrets() {
  const env = getServerEnv()
  return [env.ALERTAS_CRON_SECRET, env.CRON_SECRET].filter(Boolean)
}
