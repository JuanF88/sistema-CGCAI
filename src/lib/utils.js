import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Compone clases de Tailwind.
 *
 * `clsx` resuelve las condicionales y `tailwind-merge` los conflictos: si dos
 * clases compiten (p. ej. `h-9` y `h-10`), gana la última. Eso es lo que hace
 * que pasar `className` a un primitivo funcione:
 *
 *   cn('h-9 px-4', className)   // tu `h-10` vence al `h-9` por defecto
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}
