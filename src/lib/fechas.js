/**
 * Las fechas del sistema, contadas por días de calendario en Colombia.
 *
 * Vive en `lib/` y no dentro de una funcionalidad porque lo usan las líneas de
 * trabajo, el Centro de Control, la evaluación de auditores y las estadísticas.
 *
 * Todo lo de aquí trabaja con cadenas «YYYY-MM-DD» y hace la aritmética sobre
 * `Date.UTC`. No es un capricho: el mismo cálculo corre en el navegador del
 * administrador (Bogotá) y en el servidor de Vercel (UTC), y la versión
 * anterior usaba fechas locales, así que daba resultados distintos en cada
 * sitio. En producción todos los plazos se guardaron un día antes de lo
 * debido; en local salían bien, que es lo que hacía tan difícil de ver el
 * fallo.
 *
 * La otra mitad del problema era comparar un **instante** con una
 * **medianoche**: la asistencia subida a las once de la mañana del día del
 * plazo quedaba «Tarde (1 día)», porque la medianoche de ese día ya había
 * pasado. Un plazo es un día entero y se cumple hasta que termina, así que
 * aquí se compara día contra día y nunca hora contra hora.
 */

/** Lo que ve el auditor está en hora de Colombia. */
const ZONA = 'America/Bogota'

/** `en-CA` da «YYYY-MM-DD» directamente, que es el formato con el que se opera. */
const DIA = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/**
 * Para mostrar. Va en UTC a propósito: recibe la medianoche UTC que representa
 * un día suelto, y pasarla por la zona de Bogotá la retrocedería al anterior.
 */
const BONITO = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'UTC',
  year: 'numeric',
  month: 'short',
  day: '2-digit',
})

const UN_DIA = 86_400_000

/** Medianoche UTC del día indicado, para poder sumar y restar sin husos. */
const enUTC = (dia) => {
  const [anio, mes, numero] = String(dia).slice(0, 10).split('-').map(Number)
  return Date.UTC(anio, mes - 1, numero)
}

/**
 * El día de calendario, en Bogotá, de cualquier fecha.
 *
 * Acepta tanto «2026-09-17» como el instante ISO que devuelve Storage
 * («2026-09-18T01:12:00Z», que en Bogotá todavía es el 17). Una fecha que ya
 * viene sin hora se devuelve tal cual: pasarla por `Date` la leería como
 * medianoche UTC y en Bogotá retrocedería un día.
 */
export function aDia(valor) {
  if (!valor) return null

  const texto = String(valor)
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto

  const instante = new Date(texto)
  return Number.isNaN(instante.getTime()) ? null : DIA.format(instante)
}

/** Días naturales de `desde` a `hasta`. Negativo = `hasta` es anterior. */
export function diferenciaEnDias(desde, hasta) {
  const a = aDia(desde)
  const b = aDia(hasta)
  if (!a || !b) return null
  return Math.round((enUTC(b) - enUTC(a)) / UN_DIA)
}

/** `dia` más n días naturales. */
export const sumarDias = (dia, n) => new Date(enUTC(dia) + n * UN_DIA).toISOString().slice(0, 10)

/** `dia` más n días hábiles (de lunes a viernes). */
export function sumarDiasHabiles(dia, n) {
  let instante = enUTC(dia)
  const paso = n >= 0 ? 1 : -1
  let contados = 0

  while (contados < Math.abs(n)) {
    instante += paso * UN_DIA
    const diaSemana = new Date(instante).getUTCDay()
    if (diaSemana >= 1 && diaSemana <= 5) contados++
  }

  return new Date(instante).toISOString().slice(0, 10)
}

/** «2026-09-17» → «17 sept 2026». */
export function formatearDia(valor) {
  const dia = aDia(valor)
  return dia ? BONITO.format(new Date(enUTC(dia))) : null
}

/**
 * El día de hoy en Colombia, «YYYY-MM-DD».
 *
 * `new Date().toISOString().slice(0, 10)` da el día en UTC, que a partir de las
 * siete de la tarde en Bogotá ya es mañana. Bastaba con rellenar un formulario
 * de noche para que la fecha por defecto saliera del día siguiente.
 */
export const hoy = () => DIA.format(new Date())

/**
 * El año de una fecha, leyendo la cadena y no un `Date`.
 *
 * `new Date('2026-01-01').getFullYear()` devuelve 2025 en Bogotá: la cadena sin
 * hora se interpreta como medianoche UTC y al leerla en local retrocede al 31
 * de diciembre. Con las fechas de auditoría eso movía de año —y de semestre—
 * cualquier auditoría del día 1, y además daba resultados distintos en el
 * navegador y en el servidor.
 */
export function anioDe(valor) {
  const dia = aDia(valor)
  return dia ? Number(dia.slice(0, 4)) : null
}

/** El mes (1-12) de una fecha, con el mismo criterio que `anioDe`. */
export function mesDe(valor) {
  const dia = aDia(valor)
  return dia ? Number(dia.slice(5, 7)) : null
}

/** «S1» si la fecha cae en el primer semestre, «S2» si no. */
export function semestreDe(valor) {
  const mes = mesDe(valor)
  return mes ? (mes <= 6 ? 'S1' : 'S2') : null
}

/**
 * Cualquier fecha recortada a su día en Colombia, con hoy como respaldo.
 *
 * Es lo que se usa al rellenar un formulario o al nombrar un archivo con la
 * fecha del momento.
 */
export const toYMD = (valor) => aDia(valor) ?? hoy()

/** El periodo de evaluación de una fecha: «2026-S2». */
export function periodoDe(valor) {
  const anio = anioDe(valor)
  const semestre = semestreDe(valor)
  return anio && semestre ? `${anio}-${semestre}` : null
}
