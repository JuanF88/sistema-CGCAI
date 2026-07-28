'use client'

/**
 * Riesgos, controles y oportunidades del programa.
 *
 * Mismo gesto que los hallazgos del informe de auditoría: los botones arriba,
 * cada uno añade una tarjeta de color con su campo de texto, y la vista salta
 * a la recién creada con el cursor ya dentro.
 *
 * El Excel solo dibuja dos filas de cada uno, pero el formato no tiene por qué
 * imponer el límite: se añaden las que hagan falta y la exportación crece.
 */
import { useEffect, useRef, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'

import { cn } from '@/lib/utils'
import { enfocarNuevo } from '@/lib/dom/desplazar'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'

/**
 * @typedef {Object} TipoLista
 * @property {string} key       Campo del formulario
 * @property {string} singular
 * @property {string} plural
 * @property {string} emoji
 * @property {string} guia      Ayuda bajo el rótulo de la tarjeta
 * @property {string} tarjeta   Clases del panel
 * @property {string} rotulo    Clases del rótulo
 * @property {string} boton     Clases del botón de añadir
 */

/** @type {TipoLista[]} */
export const TIPOS_METODOLOGIA = [
  {
    key: 'riesgos',
    singular: 'Riesgo',
    plural: 'Riesgos',
    emoji: '⚠️',
    guia: 'Qué puede impedir que el programa cumpla su objetivo.',
    tarjeta:
      'border-amber-300/90 border-l-amber-500 bg-amber-50/40 dark:border-amber-800/70 dark:border-l-amber-500 dark:bg-amber-950/20',
    rotulo: 'text-amber-800 dark:text-amber-300',
    boton:
      'border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-950/40',
  },
  {
    key: 'controles',
    singular: 'Control',
    plural: 'Controles',
    emoji: '🛡️',
    guia: 'Qué se hace para que ese riesgo no se materialice.',
    tarjeta:
      'border-sky-300/90 border-l-sky-500 bg-sky-50/40 dark:border-sky-800/70 dark:border-l-sky-500 dark:bg-sky-950/20',
    rotulo: 'text-sky-800 dark:text-sky-300',
    boton:
      'border-sky-300 text-sky-700 hover:bg-sky-50 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950/40',
  },
  {
    key: 'oportunidades',
    singular: 'Oportunidad',
    plural: 'Oportunidades',
    emoji: '📈',
    guia: 'Qué se puede ganar más allá de verificar la conformidad.',
    tarjeta:
      'border-emerald-300/90 border-l-emerald-500 bg-emerald-50/40 dark:border-emerald-800/70 dark:border-l-emerald-500 dark:bg-emerald-950/20',
    rotulo: 'text-emerald-800 dark:text-emerald-300',
    boton:
      'border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/40',
  },
]

/**
 * @param {Object} props
 * @param {{riesgos: string[], controles: string[], oportunidades: string[]}} props.listas
 * @param {(key: string, valores: string[]) => void} props.onChange
 */
export function ListasMetodologia({ listas, onChange }) {
  /** Tarjeta de cada entrada, indexada por `${tipo}-${posición}`. */
  const tarjetas = useRef({})

  /** Clave de la tarjeta recién añadida, para llevarle el foco. */
  const [reciente, setReciente] = useState(null)

  const valores = (key) => listas[key] ?? []

  const agregar = (tipo) => {
    const posicion = valores(tipo.key).length
    onChange(tipo.key, [...valores(tipo.key), ''])
    setReciente(`${tipo.key}-${posicion}`)
  }

  const editar = (tipo, indice, texto) =>
    onChange(
      tipo.key,
      valores(tipo.key).map((v, i) => (i === indice ? texto : v))
    )

  const eliminar = (tipo, indice) =>
    onChange(
      tipo.key,
      valores(tipo.key).filter((_, i) => i !== indice)
    )

  useEffect(() => {
    if (!reciente) return

    enfocarNuevo(tarjetas.current[reciente])
    setReciente(null)
  }, [reciente])

  return (
    <div className="space-y-4">
      {/* Arriba: con la lista larga, tenerlos al final obliga a recorrerla entera. */}
      <div className="grid gap-2 sm:grid-cols-3">
        {TIPOS_METODOLOGIA.map((tipo) => (
          <Button
            key={tipo.key}
            type="button"
            variant="outline"
            onClick={() => agregar(tipo)}
            className={cn('h-auto justify-start gap-2 bg-background py-2.5 text-sm', tipo.boton)}
          >
            <Plus />
            <span className="font-semibold">{tipo.plural}</span>
            <span className="ml-auto text-xs tabular-nums opacity-70">
              {valores(tipo.key).length}
            </span>
          </Button>
        ))}
      </div>

      {TIPOS_METODOLOGIA.every((t) => valores(t.key).length === 0) && (
        <p className="rounded-xl border border-dashed border-border bg-background/60 px-4 py-6 text-center text-xs text-muted-foreground">
          Todavía no hay riesgos, controles ni oportunidades. Añádelos con los botones de arriba.
        </p>
      )}

      {TIPOS_METODOLOGIA.map((tipo) =>
        valores(tipo.key).map((texto, i) => (
          <article
            key={`${tipo.key}-${i}`}
            ref={(el) => {
              tarjetas.current[`${tipo.key}-${i}`] = el
            }}
            className={cn(
              // `scroll-mt-4`: al saltar hasta ella deja un respiro arriba en
              // vez de pegarse al borde del panel.
              'animate-fade-in relative scroll-mt-4 space-y-2 rounded-2xl border border-l-[5px] p-4',
              'shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] dark:shadow-none',
              tipo.tarjeta
            )}
          >
            <header className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p
                  className={cn(
                    'text-[11px] font-semibold uppercase tracking-[0.14em]',
                    tipo.rotulo
                  )}
                >
                  {tipo.emoji} {tipo.singular} #{i + 1}
                </p>
                <p className="mt-1 max-w-2xl text-xs text-muted-foreground">{tipo.guia}</p>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => eliminar(tipo, i)}
                title={`Eliminar ${tipo.singular.toLowerCase()} #${i + 1}`}
                className="h-7 w-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">
                  Eliminar {tipo.singular.toLowerCase()} #{i + 1}
                </span>
              </Button>
            </header>

            <Textarea
              value={texto}
              onChange={(e) => editar(tipo, i, e.target.value)}
              rows={4}
              spellCheck="true"
              placeholder={`Describe ${tipo.singular.toLowerCase() === 'oportunidad' ? 'la' : 'el'} ${tipo.singular.toLowerCase()}…`}
              className="bg-background"
            />
          </article>
        ))
      )}
    </div>
  )
}
