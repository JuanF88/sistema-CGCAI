'use client'

/**
 * La nota libre de una etapa, bajo sus botones de documento.
 *
 * Plegada por defecto y no siempre abierta: son seis etapas por auditoría, y
 * seis cajas de texto vacías en fila convierten la línea de trabajo en un
 * formulario. Cuando hay nota se lee de un vistazo; cuando no, es un botón
 * pequeño que no estorba.
 *
 * Se guarda con un botón y no al perder el foco: escribir una nota y ver que
 * desaparece al hacer clic en otro sitio es de las cosas que hacen desconfiar
 * de un sistema.
 */
import { useId, useState } from 'react'
import { NotebookPen, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'

/**
 * @param {Object} props
 * @param {string} [props.nota]           Lo que hay guardado
 * @param {(texto: string) => Promise<boolean>} [props.onGuardar]
 *        Sin ella la nota es de solo lectura (panel del visualizador)
 */
export function NotaEtapa({ nota = '', onGuardar }) {
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState(nota)
  const [guardando, setGuardando] = useState(false)

  // Hay una nota por etapa y varias pueden estar abiertas a la vez: con un id
  // fijo, la etiqueta de todas apuntaría al primer recuadro.
  const id = useId()

  const soloLectura = typeof onGuardar !== 'function'
  const hayNota = Boolean(String(nota).trim())

  const abrir = () => {
    // Se parte de lo guardado, no de lo que quedara escrito de una edición que
    // se canceló.
    setTexto(nota)
    setEditando(true)
  }

  const guardar = async () => {
    setGuardando(true)
    const ok = await onGuardar(texto)
    setGuardando(false)
    if (ok) setEditando(false)
  }

  if (!hayNota && soloLectura) return null

  if (editando) {
    return (
      <div className="mt-3 rounded-xl border border-dashed border-border bg-background/60 p-3">
        <label
          htmlFor={id}
          className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
        >
          Nota de este paso
        </label>

        <Textarea
          id={id}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={3}
          autoFocus
          spellCheck="true"
          placeholder="Lo que haga falta recordar de este paso: acuerdos, retrasos, quién falta por firmar…"
          className="mt-2 resize-y bg-background text-sm"
        />

        <div className="mt-2 flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setEditando(false)}
            disabled={guardando}
          >
            <X />
            Cancelar
          </Button>
          <Button type="button" size="sm" onClick={guardar} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar nota'}
          </Button>
        </div>
      </div>
    )
  }

  if (!hayNota) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={abrir}
        className="mt-2 h-auto px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <NotebookPen className="h-3.5 w-3.5" />
        Añadir nota
      </Button>
    )
  }

  return (
    <div className="mt-3 rounded-xl border border-border bg-muted/40 p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          <NotebookPen className="h-3.5 w-3.5" aria-hidden="true" />
          Nota
        </p>

        {!soloLectura && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={abrir}
            className="h-auto shrink-0 px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground"
          >
            Editar
          </Button>
        )}
      </div>

      <p className="mt-1 whitespace-pre-line text-sm leading-relaxed">{nota}</p>
    </div>
  )
}
