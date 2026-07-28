'use client'

import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'

/**
 * Un campo de formulario: etiqueta, control, ayuda y error.
 *
 * Sigue el patrón de SoluGRH: separación mínima entre etiqueta y control
 * (`space-y-1`), el asterisco dentro del propio texto de la etiqueta y el error
 * como una línea pequeña en rojo debajo. Sin iconos ni cajas: en una rejilla de
 * tres columnas cualquier adorno se come el espacio.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.label
 * @param {string}   [props.htmlFor]   `id` del control, para el `<label>`
 * @param {boolean}  [props.required]  Añade el asterisco
 * @param {React.ReactNode} [props.help]   Texto de apoyo bajo el control
 * @param {string}   [props.error]     Mensaje de error; manda sobre `help`
 * @param {React.ReactNode} [props.action] A la derecha de la etiqueta
 * @param {boolean}  [props.wide]      Ocupa toda la fila de la rejilla
 */
export function Field({
  label,
  htmlFor,
  required,
  help,
  error,
  action,
  wide,
  children,
  className,
}) {
  return (
    <div
      className={cn(
        'space-y-1',
        wide && 'sm:col-span-2 lg:col-span-3',
        // El control no necesita saber que hay error: se pinta desde aquí.
        error &&
          '[&_input]:border-destructive [&_button[role=combobox]]:border-destructive [&_textarea]:border-destructive',
        className
      )}
    >
      {(label || action) && (
        <div className="flex items-center justify-between gap-2">
          {label && (
            <Label htmlFor={htmlFor}>
              {label}
              {required && <span className="ml-0.5 text-destructive">*</span>}
            </Label>
          )}
          {action}
        </div>
      )}

      {children}

      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : (
        help && <p className="text-xs text-muted-foreground">{help}</p>
      )}
    </div>
  )
}

/**
 * Rejilla de campos.
 *
 * Por defecto tres columnas, como en SoluGRH: los campos de un formulario
 * administrativo son cortos y a dos columnas sobra sitio a los lados.
 */
export function FieldGrid({ columns = 3, children, className }) {
  return (
    <div
      className={cn(
        'grid gap-4',
        columns === 2 && 'sm:grid-cols-2',
        columns === 3 && 'sm:grid-cols-2 lg:grid-cols-3',
        className
      )}
    >
      {children}
    </div>
  )
}
