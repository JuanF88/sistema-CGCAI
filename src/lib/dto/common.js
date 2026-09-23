/**
 * Piezas de Zod reutilizables por todos los DTOs.
 *
 * Aquí es donde se normaliza la entrada antes de que toque el dominio:
 * `.trim()`, `""` → `null`, límites de longitud, formato de fechas.
 */
import { z } from 'zod'

/** Texto obligatorio, sin espacios sobrantes. */
export const requiredText = (mensaje, max = 255) =>
  z.string({ message: mensaje }).trim().min(1, mensaje).max(max)

/** Texto opcional: `undefined` o `""` se normalizan a `null`. */
export const nullableText = (max = 4000) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v === undefined || v === '' ? null : v))

/**
 * Identificador UUID.
 *
 * No se usa `z.string().uuid()` porque cambió de sitio entre versiones de Zod;
 * la expresión regular dice lo mismo y no se mueve.
 */
export const uuidId = (mensaje = 'Identificador inválido') =>
  z
    .string({ message: mensaje })
    .trim()
    .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, mensaje)

/** Id numérico que puede llegar como string desde un query param o un form. */
export const numericId = (mensaje = 'Identificador inválido') =>
  z.coerce.number({ message: mensaje }).int(mensaje).positive(mensaje)

/** Id numérico opcional; `""`, `null` y `undefined` se vuelven `null`. */
export const nullableNumericId = () =>
  z
    .union([z.coerce.number().int().positive(), z.literal(''), z.null()])
    .optional()
    .transform((v) => (v === '' || v === null || v === undefined ? null : v))

/** Fecha en formato `YYYY-MM-DD`. Acepta ISO completo y lo recorta. */
export const ymdDate = (mensaje = 'La fecha debe tener formato YYYY-MM-DD') =>
  z
    .union([z.string(), z.date()])
    .transform((v) => {
      if (v instanceof Date) return v.toISOString().slice(0, 10)
      const s = String(v).trim()
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
      const d = new Date(s)
      return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
    })
    .refine((v) => v !== null, { message: mensaje })

/** Igual que `ymdDate` pero admite ausencia; devuelve `null`. */
export const nullableYmdDate = () =>
  z
    .union([z.string(), z.date(), z.null()])
    .optional()
    .transform((v) => {
      if (v === undefined || v === null || v === '') return null
      if (v instanceof Date) return v.toISOString().slice(0, 10)
      const s = String(v).trim()
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
      const d = new Date(s)
      return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
    })

/** Periodo académico con forma `2026-S1`. */
export const periodo = (mensaje = 'El periodo debe tener formato AAAA-S1 o AAAA-S2') =>
  z.string().trim().regex(/^\d{4}-S[12]$/, mensaje)
