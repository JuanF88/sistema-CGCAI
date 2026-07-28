'use client'

/**
 * Deja el filtro de año en el año en curso la primera vez que hay datos.
 *
 * Los años disponibles casi nunca se conocen en el primer render: salen de una
 * consulta o de los propios registros ya cargados. Por eso no basta con un
 * `useState` inicial y hace falta esperar a que lleguen.
 *
 * Solo actúa **una vez**: si después el usuario cambia el filtro y la lista de
 * años se recalcula, no se le vuelve a mover la selección debajo.
 */
import { useEffect, useRef } from 'react'

import { anioPorDefecto } from '@/lib/fechas/anio'

/**
 * @param {Array<string|number>} disponibles  Años con datos
 * @param {(anio: string|number) => void} aplicar
 * @param {Object} [opciones]
 * @param {string|number} [opciones.sinDatos]  Valor de «todos» en esta vista
 * @param {boolean} [opciones.activo]  `false` mientras no interese aplicarlo
 */
export function useAnioInicial(disponibles, aplicar, { sinDatos = 'todos', activo = true } = {}) {
  const aplicado = useRef(false)
  // En una ref para no re-disparar el efecto cada vez que el componente
  // vuelve a crear la función.
  const ultimoAplicar = useRef(aplicar)
  ultimoAplicar.current = aplicar

  useEffect(() => {
    if (aplicado.current || !activo || !disponibles?.length) return

    aplicado.current = true
    ultimoAplicar.current(anioPorDefecto(disponibles, { sinDatos }))
  }, [disponibles, sinDatos, activo])
}
