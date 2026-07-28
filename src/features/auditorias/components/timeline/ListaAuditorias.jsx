'use client'

/**
 * Barra lateral con las auditorías seleccionables.
 *
 * Los dos paneles muestran lo mismo (dependencia, id, fecha) y se diferencian
 * en las etiquetas de la parte de abajo, que llegan por `badges`.
 */
import { cn } from '@/lib/utils'
import { EMPTY_STATE, SECTION_CARD, STATUS_BADGE_TONES } from '@/components/ui/tokens'
import { fmt, parseYMD } from '@/features/auditorias/hooks/useAuditTimeline'

/** Etiqueta pequeña bajo la fecha. */
export function BadgeMini({ tono = 'neutral', children }) {
  return (
    <span
      className={cn('rounded-full border px-2 py-0.5 font-medium', STATUS_BADGE_TONES[tono])}
    >
      {children}
    </span>
  )
}

/**
 * @param {Object} props
 * @param {string} props.titulo
 * @param {Array} props.auditorias
 * @param {number|null} props.selectedId
 * @param {(id: number) => void} props.onSelect
 * @param {boolean} props.loading
 * @param {string|null} props.error
 * @param {string} props.vacio           Texto cuando no hay nada que mostrar
 * @param {(a: Object) => React.ReactNode} [props.badges]
 */
export function ListaAuditorias({
  titulo,
  auditorias,
  selectedId,
  onSelect,
  loading,
  error,
  vacio,
  badges,
  className,
}) {
  return (
    <aside className={cn(SECTION_CARD, 'flex h-fit flex-col gap-3 p-4', className)}>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {titulo}
      </h2>

      {loading && <p className="py-6 text-center text-sm text-muted-foreground">Cargando…</p>}

      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          ⚠️ {error}
        </p>
      )}

      {!loading && !error && auditorias.length === 0 && <p className={EMPTY_STATE}>{vacio}</p>}

      <ul className="flex flex-col gap-2">
        {auditorias.map((a) => {
          const fa = parseYMD(a.fecha_auditoria)
          const activa = selectedId === a.id

          return (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => onSelect(a.id)}
                aria-current={activa ? 'true' : undefined}
                className={cn(
                  'w-full cursor-pointer rounded-lg border p-3 text-left transition-colors',
                  activa ? 'border-primary bg-primary/10' : 'border-border bg-card hover:bg-accent'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0 text-sm font-semibold leading-tight">
                    {a.dependencias?.nombre || 'Dependencia'}
                  </span>
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
                    #{a.id}
                  </span>
                </div>

                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-muted-foreground">📅 {fa ? fmt(fa) : 'Sin fecha'}</span>
                  {badges?.(a)}
                </div>
              </button>
            </li>
          )
        })}
      </ul>
    </aside>
  )
}
