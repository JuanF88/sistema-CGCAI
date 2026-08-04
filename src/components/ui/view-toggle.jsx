'use client'

import { cn } from '@/lib/utils'

/**
 * Selector de vistas (pestañas en forma de píldoras).
 *
 * Se usa tanto sobre fondo claro como sobre el gradiente del `PageHeader`; para
 * ese caso está la variante `onHeader`.
 *
 * @param {Object} props
 * @param {Array<{key: string, label: string, icon?: Function}>} props.options
 * @param {string} props.value
 * @param {(key: string) => void} props.onChange
 * @param {'default'|'onHeader'} [props.variant]
 */
export function ViewToggle({ options, value, onChange, variant = 'default', className }) {
  const enHeader = variant === 'onHeader'

  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex items-center gap-1 rounded-xl p-1',
        enHeader ? 'bg-white/15 backdrop-blur-sm' : 'border border-border bg-muted',
        className
      )}
    >
      {options.map((option) => {
        const Icon = option.icon
        const activo = option.key === value

        return (
          <button
            key={option.key}
            type="button"
            role="tab"
            aria-selected={activo}
            onClick={() => onChange(option.key)}
            className={cn(
              'inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-1.5',
              'text-sm font-semibold transition-all duration-200 cursor-pointer',
              enHeader
                ? activo
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-white/85 hover:bg-white/15 hover:text-white'
                : activo
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {Icon && <Icon className="h-4 w-4" />}
            <span>{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}
