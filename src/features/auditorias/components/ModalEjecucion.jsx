'use client'

/**
 * Marcar a mano qué auditorías de una dependencia se llevaron a cabo.
 *
 * La celda de la malla resume varias auditorías, así que no puede ser un solo
 * interruptor: hay que decir cuál. El modal las lista y cada una se marca por
 * separado.
 *
 * Cada clic se guarda al momento, no al cerrar: la celda se pinta en cuanto el
 * cambio está en la base, y si algo falla se deshace solo ese y se dice cuál.
 * Un «Guardar» al final obligaría a decidir qué hacer cuando tres se guardan y
 * la cuarta no.
 */
import { useState } from 'react'
import { Check, CircleCheck, CircleSlash, X } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatearDia } from '@/lib/fechas'

export default function ModalEjecucion({ destino, onClose, onMarcar }) {
  /** Id de la auditoría que se está guardando, para bloquear solo su fila. */
  const [guardando, setGuardando] = useState(null)

  const auditorias = destino?.auditorias ?? []
  const marcadas = auditorias.filter((a) => a.ejecutada).length

  const cambiar = async (auditoria, ejecutada) => {
    setGuardando(auditoria.id)
    try {
      await onMarcar(auditoria, ejecutada)
    } finally {
      setGuardando(null)
    }
  }

  return (
    <Dialog open={Boolean(destino)} onOpenChange={(abierto) => (abierto ? null : onClose())}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Auditorías ejecutadas</DialogTitle>
          <DialogDescription>
            {destino?.dependencia} · {marcadas} de {auditorias.length} marcada
            {auditorias.length === 1 ? '' : 's'} como ejecutada
            {auditorias.length === 1 ? '' : 's'}.
          </DialogDescription>
        </DialogHeader>

        <ul className="flex flex-col gap-2">
          {auditorias.map((a) => {
            const ocupada = guardando === a.id

            return (
              <li
                key={a.id}
                className={cn(
                  'flex items-center justify-between gap-3 rounded-xl border p-3',
                  a.ejecutada
                    ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/50 dark:bg-emerald-950/30'
                    : 'border-border bg-muted/30'
                )}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    Auditoría #{a.id}
                    {a.fecha_auditoria ? ` · ${formatearDia(a.fecha_auditoria)}` : ''}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[a.usuarios?.nombre, a.usuarios?.apellido].filter(Boolean).join(' ') ||
                      'Sin auditor asignado'}
                    {a.ejecutada && a.ejecutada_at
                      ? ` · marcada el ${formatearDia(a.ejecutada_at)}`
                      : ''}
                  </p>
                </div>

                {/* Dos botones y no un interruptor: el estado de partida es
                    «no», y con un interruptor no se distingue «dijeron que no»
                    de «nadie lo ha mirado». Aquí el sí marcado se ve. */}
                <div className="flex shrink-0 items-center gap-1.5">
                  <Button
                    size="sm"
                    variant={a.ejecutada ? 'success' : 'outline'}
                    disabled={ocupada}
                    onClick={() => cambiar(a, true)}
                    title={`Marcar la auditoría #${a.id} como ejecutada`}
                  >
                    {a.ejecutada ? <CircleCheck /> : <Check />}
                    Sí
                  </Button>
                  <Button
                    size="sm"
                    variant={a.ejecutada ? 'outline' : 'secondary'}
                    disabled={ocupada}
                    onClick={() => cambiar(a, false)}
                    title={`Marcar la auditoría #${a.id} como no ejecutada`}
                  >
                    {a.ejecutada ? <X /> : <CircleSlash />}
                    No
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>

        <p className="text-xs text-muted-foreground">
          Es un control manual: no se deduce de los documentos cargados. Se puede cambiar cuantas
          veces haga falta.
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
