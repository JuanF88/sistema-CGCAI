'use client'

import { cn } from '@/lib/utils'

/**
 * Grupo de campos dentro de un formulario.
 *
 * Es el patrón de SoluGRH: un panel tintado con un rótulo pequeño en versalitas
 * arriba a la izquierda. Agrupa visualmente sin el peso de una tarjeta con
 * cabecera, así que en un formulario largo se distinguen los bloques de un
 * vistazo sin que cada uno parezca una pantalla aparte.
 *
 * Los dos tonos base separan lo que hay que rellenar de lo que es opcional:
 * `required` con borde continuo, `optional` con borde discontinuo.
 */
const TONOS = {
  /** Lo que hay que diligenciar sí o sí. */
  required: {
    panel: 'border-sky-300/90 bg-sky-50/40 dark:border-sky-800/70 dark:bg-sky-950/20',
    rotulo: 'text-sky-800 dark:text-sky-300',
  },
  /** Lo que se puede dejar en blanco. */
  optional: {
    panel: 'border-dashed border-slate-300 bg-slate-50/60 dark:border-slate-700 dark:bg-slate-900/30',
    rotulo: 'text-slate-600 dark:text-slate-400',
  },
  neutral: {
    panel: 'border-border bg-muted/40',
    rotulo: 'text-muted-foreground',
  },
  success: {
    panel:
      'border-emerald-300/90 bg-emerald-50/40 dark:border-emerald-800/70 dark:bg-emerald-950/20',
    rotulo: 'text-emerald-800 dark:text-emerald-300',
  },
  warning: {
    panel: 'border-amber-300/90 bg-amber-50/40 dark:border-amber-800/70 dark:bg-amber-950/20',
    rotulo: 'text-amber-800 dark:text-amber-300',
  },
  danger: {
    panel: 'border-red-300/90 bg-red-50/40 dark:border-red-900/70 dark:bg-red-950/20',
    rotulo: 'text-red-800 dark:text-red-300',
  },
}

/**
 * @param {Object} props
 * @param {string} props.title                Rótulo en versalitas
 * @param {React.ReactNode} [props.description]
 * @param {'required'|'optional'|'neutral'|'success'|'warning'|'danger'} [props.tone]
 * @param {React.ReactNode} [props.actions]   A la derecha del rótulo
 */
export function FormSection({
  title,
  description,
  tone = 'required',
  actions,
  children,
  className,
}) {
  const t = TONOS[tone] ?? TONOS.required

  return (
    <section
      className={cn(
        'space-y-3 rounded-2xl border p-4',
        // Filo claro arriba: es lo que le da el relieve al panel.
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] dark:shadow-none',
        t.panel,
        className
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className={cn(
              'text-[11px] font-semibold uppercase tracking-[0.14em]',
              t.rotulo
            )}
          >
            {title}
          </p>
          {description && (
            <p className="mt-1 max-w-2xl text-xs text-muted-foreground">{description}</p>
          )}
        </div>

        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </header>

      {children}
    </section>
  )
}
