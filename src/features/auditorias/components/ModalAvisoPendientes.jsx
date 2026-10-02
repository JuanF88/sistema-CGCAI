'use client'

/**
 * Aviso a mano de un documento pendiente, desde una celda del Centro de
 * Control.
 *
 * Primero se ve y después se manda: el modal abre con la previsualización ya
 * calculada —a quién, con qué asunto y con qué texto— y el botón de enviar no
 * aparece hasta que hay algo que enviar. Un correo a un auditor no se dispara
 * por un clic despistado en una celda.
 *
 * La vista previa y el envío salen de la misma ruta y del mismo cálculo, así
 * que lo que se lee aquí es literalmente lo que va a salir.
 */
import { useEffect, useState } from 'react'
import { AlertCircle, BellRing, Send } from 'lucide-react'

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
import { Cargando } from '@/components/ui/loader'
import { EMPTY_STATE, STATUS_BADGE_TONES } from '@/components/ui/tokens'

/** Cómo se presenta cada resultado del cálculo. */
const ESTADOS = {
  pendiente: { etiqueta: 'Se enviará', tono: 'info' },
  'ya-avisado': { etiqueta: 'Ya avisado hoy', tono: 'warning' },
  entregado: { etiqueta: 'Ya entregado', tono: 'success' },
  'sin-correo': { etiqueta: 'Sin correo', tono: 'danger' },
  inactivo: { etiqueta: 'Auditor inactivo', tono: 'danger' },
}

/** El plazo, dicho en palabras. */
const plazoEnPalabras = (dias) => {
  if (dias === null || dias === undefined) return 'sin fecha límite'
  if (dias < 0) {
    const n = Math.abs(dias)
    return `vencido hace ${n} día${n === 1 ? '' : 's'} hábil${n === 1 ? '' : 'es'}`
  }
  if (dias === 0) return 'vence hoy'
  return `quedan ${dias} día${dias === 1 ? '' : 's'} hábil${dias === 1 ? '' : 'es'}`
}

export function ModalAvisoPendientes({ open, onOpenChange, destino, onPrevisualizar, onEnviar }) {
  const [cargando, setCargando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [vista, setVista] = useState(null)

  useEffect(() => {
    if (!open || !destino) return

    let vigente = true
    setVista(null)
    setCargando(true)

    onPrevisualizar(destino)
      .then((datos) => {
        if (vigente) setVista(datos)
      })
      .catch(() => {
        if (vigente) onOpenChange(false)
      })
      .finally(() => {
        if (vigente) setCargando(false)
      })

    return () => {
      vigente = false
    }
    // `onPrevisualizar` se redefine en cada render; el disparador es el destino.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, destino])

  const enviables = vista?.avisos?.filter((a) => a.estado === 'pendiente') ?? []
  const ejemplo = enviables[0]

  const enviar = async () => {
    setEnviando(true)
    const ok = await onEnviar(destino)
    setEnviando(false)
    if (ok) onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BellRing className="h-5 w-5" />
            Avisar de {destino?.label?.toLowerCase() ?? 'un documento'} pendiente
          </DialogTitle>
          <DialogDescription>
            {destino?.dependencia}
            {vista ? ` · ${vista.avisos.length} auditoría(s)` : ''}
          </DialogDescription>
        </DialogHeader>

        {cargando || !vista ? (
          <Cargando mensaje="Calculando a quién le corresponde…" />
        ) : (
          <div className="flex max-h-[55vh] flex-col gap-4 overflow-y-auto pr-1">
            {vista.avisos.length === 0 ? (
              <p className={EMPTY_STATE}>No hay auditorías que avisar.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {vista.avisos.map((a) => {
                  const estado = ESTADOS[a.estado] ?? ESTADOS.pendiente

                  return (
                    <li
                      key={a.informeId}
                      className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-border bg-card p-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">
                          Auditoría #{a.informeId}
                          <span className="ml-2 font-normal text-muted-foreground">
                            {a.auditor || 'Sin auditor'}
                          </span>
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {a.correo || 'sin correo'} · límite {a.vence ?? '—'} ·{' '}
                          {plazoEnPalabras(a.diasRestantes)}
                        </p>
                        {a.motivo && (
                          <p className="mt-1 text-xs text-muted-foreground">{a.motivo}</p>
                        )}
                      </div>

                      <span
                        className={cn(
                          'shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold',
                          STATUS_BADGE_TONES[estado.tono]
                        )}
                      >
                        {estado.etiqueta}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}

            {/* El correo tal y como va a llegar. Se enseña uno: el texto solo
                cambia en el número de la auditoría y en los días de plazo. */}
            {ejemplo && (
              <section className="rounded-xl border border-dashed border-border bg-muted/40 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Así llegará el correo
                </p>
                <p className="mt-2 text-sm font-semibold">{ejemplo.asunto}</p>
                <p className="mt-1 text-sm leading-relaxed">{ejemplo.resumen}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {ejemplo.detalle}
                </p>
                {enviables.length > 1 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Los otros {enviables.length - 1} son iguales, con su número de auditoría y su
                    plazo.
                  </p>
                )}
              </section>
            )}

            {!enviables.length && (
              <p className="flex items-start gap-2 rounded-xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                <AlertCircle className="h-4 w-4 shrink-0" />
                No hay nada que enviar: o ya está entregado, o ya se avisó hoy, o el auditor no
                tiene correo.
              </p>
            )}
          </div>
        )}

        <DialogFooter className="sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {enviables.length
              ? `Se enviarán ${enviables.length} correo(s).`
              : 'No se enviará ningún correo.'}
          </p>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={enviando}>
              Cancelar
            </Button>
            <Button onClick={enviar} disabled={!enviables.length || enviando || cargando}>
              <Send />
              {enviando ? 'Enviando…' : `Enviar ${enviables.length || ''}`.trim()}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
