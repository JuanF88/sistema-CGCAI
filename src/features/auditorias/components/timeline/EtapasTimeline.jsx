'use client'

/**
 * La línea de tiempo en sí: punto, línea vertical y tarjeta por etapa.
 *
 * La usan los dos paneles. El del auditor marca la etapa actual con «AHORA» y
 * las vencidas con «VENCIDO» (`marcarActual`); el del administrador solo
 * distingue hecha / vencida / pendiente.
 */
import { Check, Download, Eye, FilePen, Pencil, Upload } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { STATUS_BADGE_TONES } from '@/components/ui/tokens'
import { fmt } from '@/features/auditorias/hooks/useAuditTimeline'

import { NotaEtapa } from './NotaEtapa'
import { PUNTO_POR_ESTADO, TARJETA_POR_ESTADO, badgeFor } from './etapas'

/**
 * Variante e icono del botón según el tipo de acción.
 *
 * `fill` es la acción principal de la etapa del informe: se distingue por el
 * relleno sólido y el icono de documento, no por el tamaño — todas las
 * acciones van en `sm` para que la fila quede pareja.
 */
const ESTILO_ACCION = {
  fill: { variant: 'default', icon: <FilePen /> },
  view: { variant: 'outline', icon: <Eye /> },
  edit: { variant: 'secondary', icon: <Pencil /> },
  download: { variant: 'outline', icon: <Download /> },
  replace: { variant: 'default', icon: <Upload /> },
}

/**
 * Un `<a>` o un `<button>` según la acción traiga `href` u `onClick`.
 *
 * @param {{accion: {label: string, href?: string, onClick?: Function, type?: string,
 *   variant?: string, icon?: React.ReactNode, title?: string}}} props
 */
export function AccionEtapa({ accion }) {
  const estilo = ESTILO_ACCION[accion.type] ?? {}
  const variant = accion.variant ?? estilo.variant ?? 'outline'
  const icono = accion.icon ?? estilo.icon ?? null
  const size = estilo.size ?? 'sm'

  if (accion.href) {
    return (
      <Button asChild variant={variant} size={size} title={accion.title}>
        <a href={accion.href} target="_blank" rel="noopener noreferrer">
          {icono}
          {accion.label}
        </a>
      </Button>
    )
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      title={accion.title}
      onClick={(e) => {
        e.stopPropagation()
        accion.onClick?.(e)
      }}
    >
      {icono}
      {accion.label}
    </Button>
  )
}

/**
 * @param {Object} props
 * @param {Array} props.etapas            Etapas ya decoradas (ver `decorarEtapas`)
 * @param {boolean} [props.marcarActual]  Mostrar las etiquetas AHORA / VENCIDO
 * @param {'largo'|'corto'} [props.formatoPlazo]
 * @param {Record<string, string>} [props.notas]  Nota guardada de cada etapa, por clave
 * @param {(etapa: string, texto: string) => Promise<boolean>} [props.onGuardarNota]
 *        Sin ella las notas se leen pero no se editan.
 */
export function EtapasTimeline({
  etapas,
  marcarActual = false,
  formatoPlazo = 'largo',
  notas,
  onGuardarNota,
}) {
  return (
    <ol className="flex flex-col">
      {etapas.map((step, idx) => {
        const esUltima = idx === etapas.length - 1
        const esActual = marcarActual && step.status.startsWith('current')
        const badge = badgeFor(step.days, step.done, formatoPlazo)

        return (
          <li key={step.key} className="flex gap-4" aria-current={esActual ? 'step' : undefined}>
            <div className="flex flex-col items-center pt-1.5">
              <span
                className={cn(
                  'h-3.5 w-3.5 shrink-0 rounded-full ring-4',
                  PUNTO_POR_ESTADO[step.status] ?? PUNTO_POR_ESTADO.upcoming
                )}
              />
              {!esUltima && (
                <span className={cn('w-0.5 flex-1', step.done ? 'bg-emerald-400' : 'bg-border')} />
              )}
            </div>

            <div
              className={cn(
                'mb-4 flex-1 rounded-xl border border-border bg-card p-4 transition-colors',
                marcarActual
                  ? TARJETA_POR_ESTADO[step.status]
                  : step.done && TARJETA_POR_ESTADO.done
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="flex items-center gap-2 font-semibold">
                  {step.title}
                  {esActual && (
                    <span className="rounded-full bg-primary px-2 py-0.5 text-[0.65rem] font-bold text-primary-foreground">
                      AHORA
                    </span>
                  )}
                  {marcarActual && !step.done && step.overdue && (
                    <span className="rounded-full bg-destructive px-2 py-0.5 text-[0.65rem] font-bold text-destructive-foreground">
                      VENCIDO
                    </span>
                  )}
                  {step.done && <Check className="h-4 w-4 text-emerald-600" />}
                </h3>

                <span
                  className={cn(
                    'rounded-full border px-2.5 py-0.5 text-xs font-semibold',
                    STATUS_BADGE_TONES[badge.tone]
                  )}
                >
                  {badge.label}
                </span>
              </div>

              <p className="mt-1.5 text-xs text-muted-foreground">
                Límite: <strong className="text-foreground">{fmt(step.when)}</strong>
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{step.subtitle}</p>

              {step.actions?.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {step.actions.map((act) => (
                    <AccionEtapa key={act.label} accion={act} />
                  ))}
                </div>
              )}

              {/* Debajo de los botones: la nota explica el paso, y muchas veces
                  explica justamente por qué todavía no hay documento que subir.
                  Sin `notas` la pantalla no las usa y no se pinta nada. */}
              {notas && (
                <NotaEtapa
                  nota={notas[step.key] ?? ''}
                  onGuardar={
                    onGuardarNota ? (texto) => onGuardarNota(step.key, texto) : undefined
                  }
                />
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
