/**
 * Desplazamiento hasta un elemento sin arrastrar media pantalla con él.
 */

/** Aire que se deja por encima del elemento al que se salta. */
const MARGEN_SCROLL = 16

/** Antecesor que realmente desplaza a `el`; `null` si es la propia ventana. */
function contenedorConScroll(el) {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const { overflowY } = getComputedStyle(p)
    const desplaza = overflowY === 'auto' || overflowY === 'scroll'
    if (desplaza && p.scrollHeight > p.clientHeight) return p
  }
  return null
}

/**
 * Deja `el` arriba de su zona visible.
 *
 * No se usa `scrollIntoView` porque desplaza **todos** los antecesores con
 * scroll, la ventana incluida: dentro de un drawer eso sube el panel entero
 * hasta chocar con el borde superior. Aquí solo se mueve el contenedor que
 * corresponde.
 */
export function desplazarHasta(el) {
  if (!el) return

  const contenedor = contenedorConScroll(el)

  if (!contenedor) {
    const top = el.getBoundingClientRect().top + window.scrollY - MARGEN_SCROLL
    window.scrollTo({ top, behavior: 'smooth' })
    return
  }

  const top =
    el.getBoundingClientRect().top -
    contenedor.getBoundingClientRect().top +
    contenedor.scrollTop -
    MARGEN_SCROLL

  contenedor.scrollTo({ top, behavior: 'smooth' })
}

/**
 * Sube al principio el contenedor que desplaza a `el`.
 *
 * Para cambiar de pestaña dentro de un panel: el contenido es otro, pero el
 * scroll se queda donde estaba y la pestaña nueva aparece empezada por la mitad.
 * Sin animación a propósito —no es un salto dentro de la misma página, sino
 * contenido distinto— y sin tocar la ventana.
 */
export function subirAlInicio(el) {
  if (!el) return

  const contenedor = contenedorConScroll(el)
  if (contenedor) contenedor.scrollTop = 0
  else window.scrollTo({ top: 0 })
}

/**
 * Lleva la vista y el foco al elemento recién añadido.
 *
 * `preventScroll` evita que el foco haga su propio salto y pelee con el
 * desplazamiento suave.
 */
export function enfocarNuevo(el) {
  if (!el) return

  desplazarHasta(el)
  el.querySelector('[role="combobox"], textarea, input')?.focus({ preventScroll: true })
}
