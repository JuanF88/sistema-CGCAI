'use client'

/**
 * Cuánto pesa cada fuente en la nota final, para un periodo.
 *
 * La nota del auditor sale de tres sitios —archivos entregados, encuesta de la
 * dependencia auditada y rúbrica del evaluador— y hasta ahora pesaban 33/33/34
 * sin manera de cambiarlo. Se decide por semestre porque es como se organiza el
 * ciclo: cambiar el criterio de 2026 no debe reescribir las notas de 2025.
 *
 * Se exige que sumen 100 y no se normaliza por detrás: unos pesos de 50/50/50
 * darían una nota que nadie sabría explicar en un comité.
 */
import { useEffect, useState } from 'react'
import { Scale } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Cargando } from '@/components/ui/loader'

/** Las tres fuentes, en el orden en que se leen en la tabla de resumen. */
const FUENTES = [
  {
    campo: 'peso_archivos',
    label: 'Archivos',
    ayuda: 'Entrega puntual de los seis documentos de la auditoría.',
  },
  {
    campo: 'peso_encuesta',
    label: 'Encuesta',
    ayuda: 'Lo que respondió la dependencia auditada.',
  },
  {
    campo: 'peso_rubrica',
    label: 'Rúbrica',
    ayuda: 'La evaluación manual del responsable.',
  },
]

export function ModalPesosNotaFinal({ open, onOpenChange, periodo, cargando, config, onGuardar, guardando }) {
  const [pesos, setPesos] = useState(null)

  // Al abrirlo se parte siempre de lo que hay guardado, no de lo que quedara
  // escrito de una edición que se canceló.
  useEffect(() => {
    if (open && config?.pesos) setPesos({ ...config.pesos })
  }, [open, config])

  const suma = pesos ? FUENTES.reduce((n, f) => n + (Number(pesos[f.campo]) || 0), 0) : 0
  const valido = suma === 100

  const cambiar = (campo, valor) => {
    const n = valor === '' ? '' : Math.max(0, Math.min(100, Number(valor)))
    setPesos((prev) => ({ ...prev, [campo]: n }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" />
            Pesos de la nota final
          </DialogTitle>
          <DialogDescription>
            Periodo <strong>{periodo}</strong>. Solo afecta a este semestre; los anteriores
            conservan los pesos con los que se calificaron.
          </DialogDescription>
        </DialogHeader>

        {cargando || !pesos ? (
          <Cargando mensaje="Cargando la configuración…" />
        ) : (
          <>
            <div className="grid gap-4">
              {FUENTES.map(({ campo, label, ayuda }) => (
                <div key={campo} className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <Label htmlFor={campo} className="text-sm font-medium">
                      {label}
                    </Label>
                    <p className="mt-0.5 text-xs text-muted-foreground">{ayuda}</p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <Input
                      id={campo}
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={pesos[campo]}
                      onChange={(e) => cambiar(campo, e.target.value)}
                      className="h-9 w-20 text-right tabular-nums"
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                </div>
              ))}
            </div>

            <div
              className={cn(
                'flex items-center justify-between rounded-xl border px-4 py-3 text-sm',
                valido
                  ? 'border-emerald-300 bg-emerald-50/60 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200'
                  : 'border-amber-300 bg-amber-50/70 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200'
              )}
            >
              <span className="font-semibold">Suma</span>
              <span className="tabular-nums font-bold">
                {suma} %{!valido && ` · faltan ${100 - suma} para 100`}
              </span>
            </div>

            <p className="text-xs text-muted-foreground">
              Si a un auditor le falta alguna fuente —todavía no hay encuestas, por ejemplo—, su
              peso se reparte entre las que sí tiene. Así nadie queda con un techo de nota por algo
              que no depende de él.
            </p>

            {config?.pendienteMigracion ? (
              <p className="rounded-lg border border-amber-300 bg-amber-50/70 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                <strong>⚠️ Falta la migración.</strong> Ejecuta{' '}
                <code className="rounded bg-black/10 px-1 py-0.5">sql/pesos-evaluacion.sql</code> en
                Supabase; hasta entonces no se pueden guardar pesos y todo se califica con 33 / 33 /
                34.
              </p>
            ) : (
              config?.configurado === false && (
                <p className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                  Este periodo todavía no tiene pesos propios: se está calificando con el reparto
                  por defecto de 33 / 33 / 34.
                </p>
              )
            )}

            <DialogFooter className="sm:justify-between">
              <p className="text-xs text-muted-foreground">
                Al guardar se recalculan las{' '}
                <strong className="text-foreground">{config?.evaluaciones ?? 0}</strong> evaluaciones
                del periodo.
              </p>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)} disabled={guardando}>
                  Cancelar
                </Button>
                <Button onClick={() => onGuardar(pesos)} disabled={!valido || guardando}>
                  {guardando ? 'Guardando…' : 'Guardar y recalcular'}
                </Button>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
