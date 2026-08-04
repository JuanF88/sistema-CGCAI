'use client'

/**
 * Campo de fecha con calendario propio.
 *
 * Sustituye al `<input type="date">` nativo por dos motivos. El primero es de
 * tamaño: el nativo ocupa todo lo que le den aunque una fecha necesite doce
 * caracteres, y en una rejilla de tres columnas quedaba un campo enorme medio
 * vacío. El segundo es de aspecto: el desplegable nativo no se puede estilar,
 * lo pinta el sistema operativo y cambia de un equipo a otro.
 *
 * ── Zonas horarias ──
 * El valor es siempre la cadena `YYYY-MM-DD` y no un `Date`. Todo el cálculo
 * se hace con números sueltos: `new Date('2026-07-27')` se interpreta como UTC
 * y en Colombia se convierte en el 26. Ese error ya apareció al generar las
 * auditorías desde el programa y no se repite aquí.
 *
 * ── Dónde se dibuja ──
 * En posición absoluta dentro del campo, como el `Combobox`, y con la capa de
 * los desplegables: así funciona dentro de un panel lateral y de un diálogo.
 * Ver `tokens.js`.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Z_POPOVER } from '@/components/ui/tokens'

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

/** La semana empieza en lunes, como se lee aquí. */
const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

/** `'2026-07-27'` → `{ anio: 2026, mes: 7, dia: 27 }`, o `null`. */
function partes(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? '').trim())
  if (!m) return null
  return { anio: Number(m[1]), mes: Number(m[2]), dia: Number(m[3]) }
}

const aIso = (anio, mes, dia) =>
  `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`

/** Día 0 del mes siguiente es el último del actual. `mes` va de 1 a 12. */
const diasDelMes = (anio, mes) => new Date(anio, mes, 0).getDate()

/** En qué columna cae el día 1, contando el lunes como 0. */
const columnaDelPrimero = (anio, mes) => (new Date(anio, mes - 1, 1).getDay() + 6) % 7

/** Hoy en `YYYY-MM-DD`, en la hora local y no en UTC. */
function hoyIso() {
  const d = new Date()
  return aIso(d.getFullYear(), d.getMonth() + 1, d.getDate())
}

/** `'2026-07-27'` → `'27 jul 2026'`. */
function comoTexto(iso) {
  const p = partes(iso)
  if (!p) return ''
  return `${p.dia} ${MESES[p.mes - 1].slice(0, 3)} ${p.anio}`
}

/** Mueve `mes`/`anio` sin salirse de 1..12. */
function desplazarMes(anio, mes, saltos) {
  const total = (anio * 12 + (mes - 1)) + saltos
  return { anio: Math.floor(total / 12), mes: (total % 12) + 1 }
}

/**
 * @param {Object} props
 * @param {string} props.value        `YYYY-MM-DD`, o `''`
 * @param {(valor: string) => void} props.onChange  Recibe la cadena, no un evento
 * @param {string} [props.min]        `YYYY-MM-DD`; se compara como texto, que en
 *                                    este formato ordena igual que la fecha
 * @param {string} [props.max]
 * @param {boolean} [props.limpiable] Muestra el botón de vaciar. Por defecto sí
 */
export function DatePicker({
  id,
  value = '',
  onChange,
  min,
  max,
  disabled,
  placeholder = 'Elegir fecha',
  limpiable = true,
  className,
  ...props
}) {
  const [abierto, setAbierto] = useState(false)
  const contenedor = useRef(null)

  const elegido = partes(value)
  const hoy = hoyIso()

  // El mes que se está mirando, que no tiene por qué ser el de la fecha
  // elegida: se puede navegar sin seleccionar nada.
  const [vista, setVista] = useState(() => {
    const p = elegido ?? partes(hoy)
    return { anio: p.anio, mes: p.mes }
  })

  // Al abrir se vuelve al mes de la fecha elegida; si se navegó lejos y se
  // cerró sin elegir, reabrir en aquel mes despistaba.
  useEffect(() => {
    if (!abierto) return
    const p = partes(value) ?? partes(hoyIso())
    setVista({ anio: p.anio, mes: p.mes })
  }, [abierto, value])

  useEffect(() => {
    if (!abierto) return

    const fuera = (e) => {
      if (!contenedor.current?.contains(e.target)) setAbierto(false)
    }
    const escape = (e) => {
      if (e.key === 'Escape') setAbierto(false)
    }

    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('mousedown', fuera)
      document.removeEventListener('keydown', escape)
    }
  }, [abierto])

  /** Las seis semanas de la cuadrícula, con los bordes del mes vecino. */
  const celdas = useMemo(() => {
    const { anio, mes } = vista
    const hueco = columnaDelPrimero(anio, mes)
    const total = diasDelMes(anio, mes)

    const anterior = desplazarMes(anio, mes, -1)
    const siguiente = desplazarMes(anio, mes, 1)
    const totalAnterior = diasDelMes(anterior.anio, anterior.mes)

    const lista = []

    for (let i = hueco - 1; i >= 0; i--) {
      lista.push({ ...anterior, dia: totalAnterior - i, fuera: true })
    }
    for (let d = 1; d <= total; d++) {
      lista.push({ anio, mes, dia: d, fuera: false })
    }
    for (let d = 1; lista.length < 42; d++) {
      lista.push({ ...siguiente, dia: d, fuera: true })
    }

    return lista
  }, [vista])

  const fueraDeRango = (iso) => (min && iso < min) || (max && iso > max)

  const elegir = (iso) => {
    if (fueraDeRango(iso)) return
    onChange?.(iso)
    setAbierto(false)
  }

  return (
    <div ref={contenedor} className="relative">
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => setAbierto((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={abierto}
        className={cn(
          // Ancho medido para «27 sept 2026» más el icono; sin él el campo se
          // estiraba a toda la columna de la rejilla.
          'flex h-9 w-full max-w-[11.5rem] items-center justify-between gap-2 rounded-md',
          'border border-input bg-transparent py-1 pl-3 pr-2 text-left text-sm shadow-sm transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
          'disabled:cursor-not-allowed disabled:opacity-50',
          abierto && 'ring-2 ring-ring ring-offset-1',
          className
        )}
        {...props}
      >
        <span className={cn('truncate', !elegido && 'text-muted-foreground')}>
          {elegido ? comoTexto(value) : placeholder}
        </span>
        {/* Pegado al borde: es el asa del campo y así se acierta sin apuntar. */}
        <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      {abierto && (
        <div
          role="dialog"
          aria-label="Calendario"
          className={cn(
            'absolute left-0 top-[calc(100%+0.35rem)] w-[17.5rem] overflow-hidden rounded-xl',
            'border border-border bg-popover text-popover-foreground shadow-xl',
            Z_POPOVER
          )}
        >
          {/* Azul institucional y no el degradado de la IA: aquí no hay nada
              de IA, es un campo del formulario como cualquier otro. */}
          <header className="flex items-center justify-between gap-1 bg-primary px-2 py-2 text-primary-foreground">
            <BotonMes
              titulo="Mes anterior"
              onClick={() => setVista((v) => desplazarMes(v.anio, v.mes, -1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </BotonMes>

            <p className="flex-1 text-center text-sm font-semibold capitalize">
              {MESES[vista.mes - 1]} {vista.anio}
            </p>

            <BotonMes
              titulo="Mes siguiente"
              onClick={() => setVista((v) => desplazarMes(v.anio, v.mes, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </BotonMes>
          </header>

          <div className="grid grid-cols-7 gap-0.5 px-2 pb-1 pt-2">
            {DIAS.map((d, i) => (
              <span
                key={`${d}-${i}`}
                className="py-1 text-center text-[11px] font-semibold uppercase text-muted-foreground"
              >
                {d}
              </span>
            ))}

            {celdas.map((c) => {
              const iso = aIso(c.anio, c.mes, c.dia)
              const seleccionado = iso === value
              const esHoy = iso === hoy
              const bloqueado = fueraDeRango(iso)

              return (
                <button
                  key={iso}
                  type="button"
                  disabled={bloqueado}
                  aria-current={esHoy ? 'date' : undefined}
                  aria-pressed={seleccionado}
                  onClick={() => elegir(iso)}
                  className={cn(
                    'h-8 rounded-md text-sm tabular-nums transition-colors',
                    'hover:bg-accent hover:text-accent-foreground',
                    c.fuera && 'text-muted-foreground/45',
                    esHoy && !seleccionado && 'font-semibold text-primary ring-1 ring-primary/50',
                    seleccionado &&
                      'bg-primary font-semibold text-primary-foreground shadow-sm hover:bg-primary hover:text-primary-foreground',
                    bloqueado && 'cursor-not-allowed opacity-30 hover:bg-transparent'
                  )}
                >
                  {c.dia}
                </button>
              )
            })}
          </div>

          <footer className="flex items-center justify-between gap-2 border-t border-border px-2 py-1.5">
            <button
              type="button"
              onClick={() => elegir(hoy)}
              disabled={fueraDeRango(hoy)}
              className="rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-accent disabled:opacity-40"
            >
              Hoy
            </button>

            {limpiable && (
              <button
                type="button"
                onClick={() => {
                  onChange?.('')
                  setAbierto(false)
                }}
                className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
              >
                Limpiar
              </button>
            )}
          </footer>
        </div>
      )}
    </div>
  )
}

/** Flecha de la cabecera del calendario. */
function BotonMes({ onClick, titulo, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={titulo}
      className="rounded-md p-1 text-primary-foreground/85 transition-colors hover:bg-white/20 hover:text-primary-foreground"
    >
      {children}
      <span className="sr-only">{titulo}</span>
    </button>
  )
}
