'use client'

/**
 * Guardado automático de un formulario largo.
 *
 * Nace de la pérdida de hallazgos del informe #352: el auditor escribía
 * durante una hora y todo vivía solo en la memoria del navegador hasta que
 * pulsaba «Guardar». Cualquier cosa que reemplazara ese estado —y la había—
 * se llevaba el trabajo por delante sin dejar rastro.
 *
 * Dos tiempos, y los dos hacen falta:
 *
 *  - `esperaMs` cuenta desde la última tecla. Guardar en cada pulsación sería
 *    una petición por letra.
 *  - `maximoMs` es el tope desde el primer cambio sin guardar. Sin él, quien
 *    escribe sin parar —redactando un hallazgo entero— no guardaría nunca,
 *    que es justo el caso que se quiere cubrir.
 *
 * ── Un guardado cada vez, y ninguno perdido ──
 *
 * Todo guardado pasa por `cola`, incluido el del botón. La primera versión
 * solo tenía un `if (enVuelo) return` y eso resultó ser dos fallos:
 *
 *  1. El intento descartado **no lo reprogramaba nadie**. El único sitio que
 *     programaba era el efecto de la firma, así que si el auditor dejaba de
 *     escribir justo después, lo escrito no se guardaba nunca. La barra decía
 *     «Guardado a las …» —por el guardado anterior, que sí terminó— y el
 *     texto se quedaba solo en la pantalla hasta recargar. Es lo que le pasó
 *     al informe #354: tres fortalezas creadas con su norma y su numeral, y
 *     ni un solo `UPDATE` con el texto detrás.
 *  2. El botón «Guardar informe» llamaba a `persistir` por su cuenta, sin
 *     mirar el candado. Un guardado manual encima de uno automático veía la
 *     misma tarjeta todavía sin `id` en las dos ejecuciones y la insertaba
 *     dos veces: en #354 quedaron las filas 2522 y 2523, idénticas, con 139
 *     milisegundos de diferencia.
 *
 * Con la cola, el segundo guardado espera al primero y entonces compara la
 * firma: si el primero ya escribió lo que había, el segundo no hace nada; y
 * si el auditor siguió escribiendo, lo escribe con los `id` ya asignados.
 */
import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Cuánto esperar antes de guardar, contando los dos plazos.
 *
 * `desde` es cuándo apareció el primer cambio sin guardar. Mientras el auditor
 * siga escribiendo, la espera normal se reinicia en cada tecla; el tope impide
 * que eso aplace el guardado indefinidamente, y cuando ya se agotó devuelve 0
 * para guardar en el acto.
 *
 * @param {{desde: number|null, ahora: number, esperaMs: number, maximoMs: number}} args
 */
export function proximaEspera({ desde, ahora, esperaMs, maximoMs }) {
  if (desde === null || desde === undefined) return esperaMs
  const restanteDelTope = Math.max(0, desde + maximoMs - ahora)
  return Math.min(esperaMs, restanteDelTope)
}

/**
 * Una cola de una sola vía: las tareas corren de una en una y por orden.
 *
 * Devuelve la promesa de cada tarea, así que quien encola puede esperar su
 * resultado o su error. Un fallo no rompe la cola: la siguiente tarea corre
 * igual, porque un guardado que falla no debe dejar el formulario sin poder
 * guardar nunca más.
 *
 * @returns {(tarea: () => Promise<any>) => Promise<any>}
 */
export function crearCola() {
  let ultima = Promise.resolve()

  return (tarea) => {
    const siguiente = ultima.then(tarea, tarea)
    ultima = siguiente.then(
      () => {},
      () => {}
    )
    return siguiente
  }
}

/**
 * @param {Object} opciones
 * @param {boolean} opciones.activo   Si no, no se programa nada (informe nuevo, carga fallida…)
 * @param {string}  opciones.firma    Retrato del contenido; cambia cuando hay algo que guardar
 * @param {() => Promise<unknown>} opciones.guardar
 * @param {number} [opciones.esperaMs=2500]
 * @param {number} [opciones.maximoMs=15000]
 * @returns {{estado: 'inactivo'|'pendiente'|'guardando'|'guardado'|'error', guardadoEn: Date|null, error: string|null, guardarYa: () => Promise<any>, marcarGuardado: () => void, hayCambios: boolean}}
 */
export function useGuardadoAutomatico({
  activo,
  firma,
  guardar,
  esperaMs = 2500,
  maximoMs = 15000,
}) {
  const [estado, setEstado] = useState('inactivo')
  const [guardadoEn, setGuardadoEn] = useState(null)
  const [error, setError] = useState(null)
  const [hayCambios, setHayCambios] = useState(false)

  // Lo que cambia en cada render se lee por referencia: así los efectos y el
  // temporizador no se reinician a cada tecla.
  const guardarRef = useRef(guardar)
  guardarRef.current = guardar
  const firmaRef = useRef(firma)
  firmaRef.current = firma

  /** La última firma que de verdad está en la base. */
  const persistida = useRef(null)
  const temporizador = useRef(null)
  /** Cuándo apareció el primer cambio sin guardar, para el tope de `maximoMs`. */
  const desde = useRef(null)
  const montado = useRef(true)

  const cola = useRef(null)
  if (cola.current === null) cola.current = crearCola()

  useEffect(() => {
    montado.current = true
    return () => {
      montado.current = false
    }
  }, [])

  /**
   * El guardado encolado, por referencia.
   *
   * `programar` necesita llamarlo y se define antes que él; la referencia
   * rompe esa dependencia circular sin rehacer el temporizador en cada render.
   */
  const ejecutarRef = useRef(null)

  /**
   * Programa el siguiente guardado.
   *
   * Vive aparte porque hacen falta dos sitios que lo llamen: el efecto de la
   * firma y el final de un guardado que dejó cambios detrás.
   */
  const programar = useCallback((retraso) => {
    clearTimeout(temporizador.current)
    temporizador.current = setTimeout(() => {
      // El error ya lo recoge `correr` en el estado; aquí solo evita un
      // rechazo sin dueño.
      ejecutarRef.current().catch(() => {})
    }, retraso)
  }, [])

  /** El guardado en sí, ya dentro de la cola. */
  const correr = useCallback(
    async ({ forzar = false } = {}) => {
      const objetivo = firmaRef.current

      // Nada que escribir. Pasa de verdad: un guardado encolado detrás de otro
      // se encuentra con que el primero ya escribió lo mismo.
      if (!forzar && objetivo === persistida.current) return undefined

      if (montado.current) setEstado('guardando')

      try {
        const resultado = await guardarRef.current()

        // Se marca como persistida la firma con la que se entró, no la actual:
        // si el auditor escribió mientras se guardaba, su cambio sigue
        // pendiente.
        persistida.current = objetivo
        desde.current = null

        // Y ese pendiente se programa aquí mismo. Apuntarlo solo en
        // `hayCambios`, como antes, dejaba lo escrito sin guardar en cuanto el
        // auditor paraba de teclear: nada volvía a programar el guardado.
        const quedaPendiente = firmaRef.current !== persistida.current

        if (montado.current) {
          setError(null)
          setGuardadoEn(new Date())
          setEstado(quedaPendiente ? 'pendiente' : 'guardado')
          setHayCambios(quedaPendiente)
        }

        if (quedaPendiente) {
          desde.current = Date.now()
          programar(esperaMs)
        }

        return resultado
      } catch (err) {
        // No se toca `persistida`: el cambio sigue pendiente y se reintentará
        // al seguir escribiendo, al pulsar el botón o al cerrar.
        if (montado.current) {
          setError(err?.message || 'No se pudo guardar automáticamente.')
          setEstado('error')
        }
        throw err
      }
    },
    [esperaMs, programar]
  )

  /** Encola un guardado. Devuelve lo que devuelva `guardar`, o lanza su error. */
  const ejecutar = useCallback((opciones) => cola.current(() => correr(opciones)), [correr])
  ejecutarRef.current = ejecutar

  /* ── Programación ── */

  useEffect(() => {
    if (!activo) return

    // La primera firma es lo que vino de la base: no hay nada que guardar.
    if (persistida.current === null) {
      persistida.current = firma
      return
    }

    if (firma === persistida.current) {
      setHayCambios(false)
      return
    }

    setHayCambios(true)
    setEstado((previo) => (previo === 'guardando' ? previo : 'pendiente'))

    if (desde.current === null) desde.current = Date.now()

    programar(
      proximaEspera({
        desde: desde.current,
        ahora: Date.now(),
        esperaMs,
        maximoMs,
      })
    )

    return () => clearTimeout(temporizador.current)
  }, [activo, firma, esperaMs, maximoMs, programar])

  /* ── Guardado a petición ── */

  /**
   * Guarda ahora y espera a que termine.
   *
   * Lo usa el botón «Guardar informe», y por eso va por la misma cola: si hay
   * un automático en vuelo, este espera a que acabe en vez de escribir a la
   * vez. `forzar` hace que escriba aunque la firma no haya cambiado, porque el
   * auditor lo ha pedido y el aviso debe contar lo que hay de verdad.
   */
  const guardarYa = useCallback(
    (opciones) => {
      clearTimeout(temporizador.current)
      return ejecutar({ forzar: true, ...opciones })
    },
    [ejecutar]
  )

  /**
   * «Esto que hay en pantalla ya está en la base, lo guardó otro».
   *
   * Queda para quien guarde por fuera del hook. Lo normal es no necesitarlo:
   * `guardarYa` ya deja la firma marcada.
   */
  const marcarGuardado = useCallback(() => {
    clearTimeout(temporizador.current)
    persistida.current = firmaRef.current
    desde.current = null
    if (montado.current) {
      setError(null)
      setGuardadoEn(new Date())
      setEstado('guardado')
      setHayCambios(false)
    }
  }, [])

  // Si queda algo sin guardar al desmontar —cerrar el panel, cambiar de
  // auditoría—, se lanza el guardado aunque ya no haya nada que lo muestre.
  useEffect(() => {
    const encolar = cola.current
    return () => {
      clearTimeout(temporizador.current)
      if (!activo) return
      if (firmaRef.current === persistida.current) return
      // Sin `await`: el componente se está yendo. Va por la cola igualmente,
      // para no cruzarse con el guardado que pueda estar en vuelo.
      encolar(() => guardarRef.current()).catch((err) =>
        console.error('[guardado automático] al cerrar:', err)
      )
    }
  }, [activo])

  // Y si cierra la pestaña con cambios pendientes, el navegador pregunta.
  useEffect(() => {
    if (!activo) return

    const avisar = (evento) => {
      if (firmaRef.current === persistida.current) return
      evento.preventDefault()
      evento.returnValue = ''
    }

    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [activo])

  return { estado, guardadoEn, error, guardarYa, marcarGuardado, hayCambios }
}

export default useGuardadoAutomatico
