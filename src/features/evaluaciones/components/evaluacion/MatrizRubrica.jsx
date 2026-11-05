'use client'

/**
 * Matriz de evaluación: un auditor por fila, un criterio de la rúbrica por
 * columna. Es una tabla nativa y no el primitivo `Table` porque necesita
 * cabecera y primera columna fijas al hacer scroll en las dos direcciones.
 */
import { useState } from 'react'
import { AlertCircle, Check, Download, Edit3, Info, Loader2, RotateCcw } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { EMPTY_STATE, SECTION_CARD, TABLE_CONTAINER } from '@/components/ui/tokens'
import {
  RUBRICA_CRITERIOS,
  nivelesOrdenados,
  notaDeCalificaciones,
} from '@/features/evaluaciones/lib/rubrica'

import { InfoBox } from './InfoBox'
import { Cargando } from '@/components/ui/loader'

/** Guía de niveles del criterio bajo el cursor, anclada junto a la celda. */
function GuiaCriterio({ tooltip }) {
  const { criterio, x, y } = tooltip
  // Si hay más sitio arriba que abajo, se ancla por abajo.
  const haciaArriba = y - 8 > window.innerHeight - y - 8

  return (
    <div
      className="pointer-events-none fixed z-50 w-[310px] overflow-hidden rounded-xl border border-border bg-popover p-4 shadow-xl"
      style={{
        left: Math.min(x, window.innerWidth - 328),
        ...(haciaArriba
          ? { bottom: window.innerHeight - y, maxHeight: Math.min(500, y - 8) }
          : { top: y, maxHeight: Math.min(500, window.innerHeight - y - 8) }),
      }}
    >
      <p className="mb-2 border-b border-border pb-2 text-sm font-bold">{criterio.nombre}</p>
      <div className="flex flex-col gap-1.5">
        {nivelesOrdenados(criterio).map((nivel) => (
          <div key={nivel} className="flex items-start gap-2">
            <span className="flex h-5 w-9 shrink-0 items-center justify-center rounded bg-primary text-xs font-bold text-primary-foreground">
              {nivel}
            </span>
            <span className="text-xs leading-snug text-muted-foreground">
              {criterio.niveles[nivel]}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Cómo se dice, en la fila, en qué va su guardado. */
const ESTADO_FILA = {
  pendiente: { texto: 'Guardando…', icono: Loader2, clase: 'text-muted-foreground', gira: true },
  guardando: { texto: 'Guardando…', icono: Loader2, clase: 'text-muted-foreground', gira: true },
  guardado: { texto: 'Guardado', icono: Check, clase: 'text-emerald-600 dark:text-emerald-400' },
  error: { texto: 'No se guardó', icono: AlertCircle, clase: 'text-destructive' },
}

/** El resumen de arriba de la tabla: lo peor que esté pasando manda. */
function EstadoGuardado({ estadoFilas, onReintentar }) {
  const estados = Object.values(estadoFilas)
  const fallidas = estados.filter((e) => e === 'error').length
  const enCurso = estados.some((e) => e === 'pendiente' || e === 'guardando')
  const algunoGuardado = estados.includes('guardado')

  if (fallidas) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm text-destructive">
        <AlertCircle className="h-4 w-4" />
        {fallidas === 1 ? 'Una fila no se pudo guardar.' : `${fallidas} filas no se pudieron guardar.`}
        <Button size="sm" variant="outline" onClick={onReintentar}>
          <RotateCcw />
          Reintentar
        </Button>
      </div>
    )
  }

  if (enCurso) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Guardando cambios…
      </p>
    )
  }

  return (
    <p
      className={cn(
        'flex items-center gap-2 text-sm',
        algunoGuardado ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
      )}
    >
      <Check className="h-4 w-4" />
      {algunoGuardado
        ? 'Todos los cambios están guardados.'
        : 'Los cambios se guardan automáticamente.'}
    </p>
  )
}

export function MatrizRubrica({
  evaluaciones,
  calificaciones,
  onCalificar,
  estadoFilas = {},
  onReintentar,
  loading,
  onExportar,
}) {
  const [tooltip, setTooltip] = useState(null)
  const vacio = !loading && evaluaciones.length === 0

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Evaluación manual con rúbrica</h2>
          <p className="text-sm text-muted-foreground">
            Matriz de evaluación: califica a todos los auditores de una vez
          </p>
        </div>

        {!vacio && !loading && (
          <Button variant="outline" onClick={onExportar}>
            <Download />
            Descargar Excel
          </Button>
        )}
      </div>

      <InfoBox icon={Edit3} title="Instrucciones de evaluación">
        <p>
          Califica cada criterio en la escala de 1 a 4. Pasa el cursor sobre una celda para ver la
          descripción de cada nivel <Info className="inline h-3.5 w-3.5 align-middle" />.
        </p>
        <p>
          💡 La nota final (escala 1 a 5) se calcula como el promedio escalado de los criterios
          calificados. No hace falta calificarlos todos.
        </p>
        <p>
          💾 Cada calificación se guarda sola al elegirla; no hace falta pulsar ningún botón.
        </p>
      </InfoBox>

      {loading ? (
        <div className={SECTION_CARD}>
        <Cargando mensaje="Cargando evaluaciones…" />
      </div>
      ) : vacio ? (
        <p className={cn(SECTION_CARD, EMPTY_STATE)}>
          No hay evaluaciones registradas para este periodo. Se crean automáticamente al importar
          encuestas.
        </p>
      ) : (
        <>
          <EstadoGuardado estadoFilas={estadoFilas} onReintentar={onReintentar} />

          <div className={cn(TABLE_CONTAINER, 'max-h-[65vh] overflow-auto')}>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-border bg-muted">
                  <th className="sticky left-0 top-0 z-20 min-w-[200px] border-r-2 border-border bg-muted px-4 py-3 text-left font-semibold">
                    Auditor / Auditoría
                  </th>
                  {RUBRICA_CRITERIOS.map((criterio) => (
                    <th
                      key={criterio.id}
                      className="sticky top-0 z-10 min-w-[160px] bg-muted px-2 py-3 text-center text-xs font-semibold leading-snug"
                    >
                      {criterio.nombre}
                    </th>
                  ))}
                  <th className="sticky top-0 z-10 min-w-[96px] border-l-2 border-border bg-amber-100 px-2 py-3 text-center font-semibold text-amber-900 dark:bg-amber-950/60 dark:text-amber-100">
                    Nota final (1-5)
                  </th>
                </tr>
              </thead>

              <tbody>
                {evaluaciones.map((ev) => {
                  const fila = calificaciones[ev.id] || {}
                  const notaFinal = notaDeCalificaciones(fila)
                  const guardado = ESTADO_FILA[estadoFilas[ev.id]]

                  return (
                    <tr key={ev.id} className="border-b border-border">
                      <td className="sticky left-0 z-[5] border-r-2 border-border bg-card px-4 py-2.5">
                        <div className="font-medium">
                          {ev.auditor_nombre} {ev.auditor_apellido}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {ev.auditor_dependencia_nombre || '-'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          ID: {ev.informe_auditoria_id} | {ev.fecha_auditoria || '-'}
                        </div>
                        {guardado && (
                          <div
                            className={cn(
                              'mt-1 flex items-center gap-1 text-xs font-medium',
                              guardado.clase
                            )}
                          >
                            <guardado.icono
                              className={cn('h-3.5 w-3.5', guardado.gira && 'animate-spin')}
                            />
                            {guardado.texto}
                          </div>
                        )}
                      </td>

                      {RUBRICA_CRITERIOS.map((criterio) => {
                        const valor = fila[criterio.id]
                        return (
                          <td
                            key={criterio.id}
                            onMouseEnter={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect()
                              setTooltip({ criterio, x: rect.right + 8, y: rect.top })
                            }}
                            onMouseLeave={() => setTooltip(null)}
                            className={cn(
                              'p-2 text-center',
                              valor && 'bg-emerald-50/60 dark:bg-emerald-950/25'
                            )}
                          >
                            <select
                              value={valor || ''}
                              onChange={(e) => onCalificar(ev.id, criterio.id, e.target.value)}
                              aria-label={`${criterio.nombre} — ${ev.auditor_nombre}`}
                              className={cn(
                                'w-full cursor-pointer rounded-md border border-input bg-transparent px-2 py-1.5 text-sm',
                                'focus:outline-none focus:ring-2 focus:ring-ring',
                                valor
                                  ? 'border-emerald-300 bg-emerald-100 font-semibold text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-100'
                                  : 'text-muted-foreground'
                              )}
                            >
                              <option value="">-</option>
                              {nivelesOrdenados(criterio).map((nivel) => (
                                <option key={nivel} value={nivel}>
                                  {nivel}
                                </option>
                              ))}
                            </select>
                          </td>
                        )
                      })}

                      <td
                        className={cn(
                          'border-l-2 border-border bg-amber-50 p-2 text-center text-sm font-bold tabular-nums dark:bg-amber-950/40',
                          notaFinal >= 3.5
                            ? 'text-emerald-600'
                            : notaFinal >= 3
                              ? 'text-amber-600'
                              : 'text-destructive'
                        )}
                      >
                        {notaFinal > 0 ? notaFinal.toFixed(2) : '-'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tooltip && <GuiaCriterio tooltip={tooltip} />}
    </section>
  )
}
