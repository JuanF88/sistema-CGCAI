/**
 * Tokens de clase compartidos.
 *
 * Un token es "una decisión de estilo con nombre". Cuando un patrón se repite
 * entre pantallas, se extrae aquí y se importa; no se copia el string.
 *
 * La escalera que seguimos al estilar una pantalla:
 *   1. clase Tailwind inline      → para lo puntual y único
 *   2. constante local al archivo → si se repite dentro de la misma pantalla
 *   3. token de aquí o componente → si se repite entre pantallas
 */

/* ── Orden de capas ── */

/**
 * Quién tapa a quién.
 *
 * Las capas flotantes se portan al `<body>`, así que el orden del DOM las pone
 * unas encima de otras sin que el z-index lo diga: la última en montarse gana
 * si empatan. Eso ya rompió tres cosas —el modal de ayuda del informe, los
 * avisos y las listas de los desplegables, todos dentro de un panel lateral—,
 * de modo que los valores viven aquí y no repartidos por los componentes.
 *
 * La regla: cada capa puede abrirse **dentro** de la anterior, así que va por
 * encima.
 *
 *   panel lateral  9998 / 9999
 *   diálogo       10000   se abre desde dentro de un panel
 *   desplegable   10010   se abre dentro de un panel o de un diálogo
 *   aviso         10050   nunca lo tapa nada
 *
 * Son strings literales y no números porque Tailwind necesita ver la clase
 * completa en el código para generarla.
 */
export const Z_DRAWER_OVERLAY = 'z-[9998]'
export const Z_DRAWER = 'z-[9999]'
export const Z_DIALOG = 'z-[10000]'
export const Z_POPOVER = 'z-[10010]'

/** El aviso se aplica con `style`; ver `ToastProvider`. */
export const Z_TOAST = 10050

/* ── Estructura de página ── */

/**
 * Padding del área de contenido. Lo aplica **solo** `AppShell`; ninguna
 * pantalla debe repetirlo o se duplica.
 */
export const PAGE_PADDING = 'p-5 sm:p-6 lg:p-[30px]'

/**
 * Anula el padding de `AppShell` para que un elemento llegue a los bordes
 * (el carrusel de la pantalla de bienvenida). Va emparejado con `PAGE_PADDING`:
 * si cambia uno, cambia el otro.
 */
export const PAGE_BLEED = '-mx-5 -mt-5 sm:-mx-6 sm:-mt-6 lg:-mx-[30px] lg:-mt-[30px]'

/**
 * Contenedor de una pantalla. **Sin padding a propósito**: el padding de página
 * lo pone `AppShell`, así no se duplica al anidar.
 */
export const PAGE_SHELL = 'flex flex-col gap-6'

export const PAGE_HEADER =
  'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'

export const PAGE_TITLE = 'text-2xl font-semibold tracking-tight text-foreground'

export const PAGE_SUBTITLE = 'text-sm text-muted-foreground'

export const SECTION_CARD = 'rounded-xl border border-border bg-card shadow-sm'

/* ── Tablas ── */

export const TABLE_CONTAINER = 'rounded-xl border border-border bg-card shadow-sm overflow-hidden'

export const TABLE_SCROLL = 'overflow-x-auto'

export const TABLE_TOOLBAR =
  'flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between'

/* ── Badges de estado ──
   Tonos canónicos: usar estos, no colores sueltos por pantalla. */

export const STATUS_BADGE_TONES = {
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  danger: 'bg-red-50 text-red-700 border-red-200',
  info: 'bg-sky-50 text-sky-700 border-sky-200',
  neutral: 'bg-slate-100 text-slate-600 border-slate-200',
  accent: 'bg-primary/10 text-primary border-primary/20',
}

/* ── Píldoras de filtro ── */

export const FILTER_PILLS_CONTAINER = 'flex flex-wrap items-center gap-2'

export const FILTER_PILL_BASE =
  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors cursor-pointer'

export const FILTER_PILL_ACTIVE = 'border-primary bg-primary text-primary-foreground'

export const FILTER_PILL_INACTIVE =
  'border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground'

/* ── Formularios ── */

export const FORM_GRID = 'grid gap-4 sm:grid-cols-2'

export const FORM_FIELD = 'flex flex-col gap-1.5'

export const FORM_HELP = 'text-xs text-muted-foreground'

export const FORM_ERROR = 'text-xs font-medium text-destructive'

/* ── Estados de lista ── */

export const EMPTY_STATE =
  'flex flex-col items-center justify-center gap-2 py-12 text-center text-sm text-muted-foreground'
