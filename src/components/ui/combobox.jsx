'use client'

/**
 * Campo de texto con sugerencias de la base de datos.
 *
 * A diferencia de un `Select`, **no obliga a elegir**: lo que se escribe vale
 * aunque no esté en la lista. Los formatos institucionales se llenan con datos
 * que muchas veces todavía no están registrados —un decano que acaba de entrar,
 * una facultad nueva—, y un desplegable cerrado obligaría a dar de alta al
 * usuario antes de poder programar la auditoría.
 *
 * La lista solo aporta: escribe, y si lo que buscas ya existe, lo eliges.
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, X } from 'lucide-react'

import { cn } from '@/lib/utils'

/** Quita tildes y mayúsculas para comparar «Peña» con «pena». */
const normalizar = (texto) =>
  String(texto ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()

/**
 * @typedef {Object} OpcionCombobox
 * @property {string} value        Texto que se escribe en el campo al elegirla
 * @property {string} [label]      Texto visible; por defecto `value`
 * @property {string} [description] Segunda línea (correo, gestión, cargo…)
 * @property {Object} [datos]      Carga útil para quien la usa (autocompletar)
 */

/**
 * @param {Object} props
 * @param {string} props.value
 * @param {(valor: string, opcion: OpcionCombobox | null) => void} props.onChange
 *        `opcion` solo llega cuando se elige de la lista; al teclear es `null`.
 * @param {OpcionCombobox[]} props.options
 * @param {string} [props.placeholder]
 * @param {string} [props.vacio]    Texto cuando ninguna sugerencia coincide
 * @param {number} [props.maximo]   Sugerencias visibles a la vez
 * @param {(texto: string) => void} [props.onEnter]
 *        Enter sin sugerencia resaltada. Lo usa `ComboboxMultiple` para
 *        aceptar un valor escrito a mano.
 */
export function Combobox({
  id,
  value = '',
  onChange,
  options = [],
  placeholder,
  vacio = 'Sin coincidencias. Puedes escribirlo igualmente.',
  maximo = 50,
  onEnter,
  className,
  ...props
}) {
  const [abierto, setAbierto] = useState(false)
  const [resaltado, setResaltado] = useState(0)
  // Mientras está cerrado la lista se filtra por el valor completo; al teclear,
  // por lo tecleado. Es lo mismo, pero hace falta saber si el usuario ha
  // escrito algo para no filtrar de golpe al abrir con el ratón.
  const [filtrando, setFiltrando] = useState(false)

  const contenedor = useRef(null)
  const lista = useRef(null)
  const listaId = `${useId()}-lista`

  // Se guarda cuántas coinciden en total, no solo las que se pintan: la lista
  // se corta en `maximo` y, sin decir cuántas quedan fuera, el usuario cree que
  // no hay más.
  const { sugerencias, coincidencias } = useMemo(() => {
    const q = filtrando ? normalizar(value) : ''

    const casan = q
      ? options.filter(
          (o) =>
            normalizar(o.label ?? o.value).includes(q) || normalizar(o.description).includes(q)
        )
      : options

    return { sugerencias: casan.slice(0, maximo), coincidencias: casan.length }
  }, [options, value, filtrando, maximo])

  /**
   * Que el resaltado se vea al moverse con el teclado.
   *
   * En la lista caben siete opciones y puede haber cincuenta: sin esto, bajar
   * con la flecha más allá de la séptima resaltaba opciones fuera de la vista
   * y parecía que la lista se acababa ahí.
   */
  useEffect(() => {
    if (!abierto) return
    lista.current?.children[resaltado]?.scrollIntoView({ block: 'nearest' })
  }, [abierto, resaltado])

  // Cerrar al pulsar fuera.
  useEffect(() => {
    if (!abierto) return

    const fuera = (evento) => {
      if (!contenedor.current?.contains(evento.target)) setAbierto(false)
    }

    document.addEventListener('mousedown', fuera)
    return () => document.removeEventListener('mousedown', fuera)
  }, [abierto])

  const elegir = (opcion) => {
    onChange(opcion.value, opcion)
    setAbierto(false)
    setFiltrando(false)
  }

  const teclado = (evento) => {
    if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') {
      evento.preventDefault()
      if (!abierto) return setAbierto(true)
      const paso = evento.key === 'ArrowDown' ? 1 : -1
      setResaltado((i) => (i + paso + sugerencias.length) % Math.max(sugerencias.length, 1))
      return
    }

    if (evento.key === 'Enter') {
      const resaltada = abierto ? sugerencias[resaltado] : null

      if (resaltada) {
        evento.preventDefault()
        elegir(resaltada)
        return
      }

      // Sin nada resaltado, Enter no debe enviar el formulario entero: aquí
      // significa «acepto lo que he escrito».
      if (onEnter) {
        evento.preventDefault()
        onEnter(value)
        setAbierto(false)
        setFiltrando(false)
      }
      return
    }

    if (evento.key === 'Escape' && abierto) {
      evento.preventDefault()
      setAbierto(false)
    }
  }

  return (
    <div ref={contenedor} className="relative">
      <input
        id={id}
        role="combobox"
        aria-expanded={abierto}
        aria-controls={listaId}
        aria-autocomplete="list"
        autoComplete="off"
        // Son nombres propios y correos: el corrector solo añadiría ruido.
        spellCheck={false}
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value, null)
          setFiltrando(true)
          setAbierto(true)
          setResaltado(0)
        }}
        onFocus={() => setAbierto(true)}
        onKeyDown={teclado}
        className={cn(
          'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 pr-8 text-sm shadow-sm transition-colors',
          'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        {...props}
      />

      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onClick={() => {
          setFiltrando(false)
          setAbierto((v) => !v)
        }}
        className="absolute right-0 top-0 flex h-9 w-8 items-center justify-center text-muted-foreground"
      >
        <ChevronDown className={cn('h-4 w-4 transition-transform', abierto && 'rotate-180')} />
      </button>

      {abierto && (
        <div
          className={cn(
            'absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-border',
            'bg-popover text-popover-foreground shadow-md'
          )}
        >
          {/* 20rem son unas siete opciones de dos renglones. Eran 15rem —cinco
              justas— y con 319 numerales parecía que solo había cinco. */}
          <ul
            id={listaId}
            role="listbox"
            ref={lista}
            className="max-h-[20rem] overflow-y-auto p-1"
          >
          {sugerencias.length === 0 && (
            <li className="px-2 py-3 text-center text-xs text-muted-foreground">{vacio}</li>
          )}

          {sugerencias.map((opcion, i) => {
            const elegida = opcion.value === value

            return (
              <li key={`${opcion.value}-${i}`}>
                <button
                  type="button"
                  role="option"
                  aria-selected={elegida}
                  // `mousedown` en vez de `click`: el `blur` del input llegaría
                  // antes y la lista se cerraría sin haber elegido nada.
                  onMouseDown={(e) => {
                    e.preventDefault()
                    elegir(opcion)
                  }}
                  onMouseEnter={() => setResaltado(i)}
                  className={cn(
                    'flex w-full items-start gap-2 rounded-sm px-2 py-1.5 text-left text-sm',
                    i === resaltado && 'bg-accent text-accent-foreground'
                  )}
                >
                  <Check
                    className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', !elegida && 'opacity-0')}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{opcion.label ?? opcion.value}</span>
                    {opcion.description && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {opcion.description}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            )
          })}
          </ul>

          {coincidencias > sugerencias.length && (
            <p className="border-t border-border px-3 py-1.5 text-center text-[0.7rem] text-muted-foreground">
              {sugerencias.length} de {coincidencias}. Escribe para afinar la búsqueda.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Variante de selección múltiple
 * ------------------------------------------------------------------ */

/** Separa «4.1, 4.2, 4.3» en sus partes, sin vacíos. */
const partir = (texto) =>
  String(texto ?? '')
    .split(/\s*,\s*/)
    .map((v) => v.trim())
    .filter(Boolean)

/**
 * Varios valores en un mismo campo, mostrados como etiquetas.
 *
 * El valor sigue siendo **una cadena separada por comas**, no un array: así es
 * como lo guarda el formato y como sale en el Excel («4.1, 4.2, 5.1»). El
 * componente solo se encarga de que elegirlos sea cómodo.
 *
 * @param {Object} props
 * @param {string} props.value
 * @param {(valor: string) => void} props.onChange
 * @param {OpcionCombobox[]} props.options
 */
export function ComboboxMultiple({
  id,
  value = '',
  onChange,
  options = [],
  placeholder = 'Busca y añade…',
  vacio,
  className,
}) {
  const [borrador, setBorrador] = useState('')

  const elegidos = useMemo(() => partir(value), [value])

  // Lo ya elegido desaparece de la lista: reofrecerlo solo estorba.
  const disponibles = useMemo(() => {
    const puestos = new Set(elegidos.map(normalizar))
    return options.filter((o) => !puestos.has(normalizar(o.value)))
  }, [options, elegidos])

  const anadir = (texto) => {
    const limpio = String(texto ?? '').trim()
    if (!limpio) return

    // Sin duplicados, comparando sin tildes ni mayúsculas.
    if (elegidos.some((v) => normalizar(v) === normalizar(limpio))) {
      setBorrador('')
      return
    }

    onChange([...elegidos, limpio].join(', '))
    setBorrador('')
  }

  const quitar = (indice) => onChange(elegidos.filter((_, i) => i !== indice).join(', '))

  return (
    <div className={cn('space-y-2', className)}>
      {elegidos.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {elegidos.map((texto, i) => (
            <li key={`${texto}-${i}`}>
              <span className="inline-flex max-w-full items-center gap-1 rounded-md border border-border bg-muted/60 py-0.5 pl-2 pr-1 text-xs">
                <span className="truncate">{texto}</span>
                <button
                  type="button"
                  onClick={() => quitar(i)}
                  title={`Quitar ${texto}`}
                  className="rounded-sm p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                  <span className="sr-only">Quitar {texto}</span>
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <Combobox
        id={id}
        value={borrador}
        // Elegir de la lista añade; teclear solo actualiza el borrador.
        onChange={(texto, opcion) => (opcion ? anadir(opcion.value) : setBorrador(texto))}
        onEnter={anadir}
        options={disponibles}
        placeholder={placeholder}
        vacio={vacio ?? 'Sin coincidencias. Pulsa Enter para añadirlo igualmente.'}
      />
    </div>
  )
}
