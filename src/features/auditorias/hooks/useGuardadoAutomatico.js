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
 * Nunca hay dos guardados a la vez, y si el auditor sigue escribiendo mientras
 * uno está en vuelo, al terminar se programa el siguiente: se compara la firma
 * que se acaba de persistir con la de la pantalla, no un booleano.
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
 * @param {Object} opciones
 * @param {boolean} opciones.activo   Si no, no se programa nada (informe nuevo, carga fallida…)
 * @param {string}  opciones.firma    Retrato del contenido; cambia cuando hay algo que guardar
 * @param {() => Promise<unknown>} opciones.guardar
 * @param {number} [opciones.esperaMs=2500]
 * @param {number} [opciones.maximoMs=15000]
 * @returns {{estado: 'inactivo'|'pendiente'|'guardando'|'guardado'|'error', guardadoEn: Date|null, error: string|null, guardarYa: () => Promise<void>, hayCambios: boolean}}
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
  const enVuelo = useRef(false)
  const temporizador = useRef(null)
  /** Cuándo apareció el primer cambio sin guardar, para el tope de `maximoMs`. */
  const desde = useRef(null)
  const montado = useRef(true)

  useEffect(() => {
    montado.current = true
    return () => {
      montado.current = false
    }
  }, [])

  const ejecutar = useCallback(async () => {
    if (enVuelo.current) return

    const objetivo = firmaRef.current
    if (objetivo === persistida.current) return

    enVuelo.current = true
    if (montado.current) setEstado('guardando')

    try {
      await guardarRef.current()
      // Se marca como persistida la firma con la que se entró, no la actual:
      // si el auditor escribió mientras se guardaba, su cambio sigue pendiente
      // y el efecto lo programará.
      persistida.current = objetivo
      desde.current = null
      if (montado.current) {
        setError(null)
        setGuardadoEn(new Date())
        setEstado('guardado')
        setHayCambios(firmaRef.current !== objetivo)
      }
    } catch (err) {
      // No se toca `persistida`: el cambio sigue pendiente y se reintentará en
      // el siguiente cambio o al cerrar.
      if (montado.current) {
        setError(err?.message || 'No se pudo guardar automáticamente.')
        setEstado('error')
      }
    } finally {
      enVuelo.current = false
    }
  }, [])

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

    const espera = proximaEspera({
      desde: desde.current,
      ahora: Date.now(),
      esperaMs,
      maximoMs,
    })

    clearTimeout(temporizador.current)
    temporizador.current = setTimeout(ejecutar, espera)

    return () => clearTimeout(temporizador.current)
  }, [activo, firma, esperaMs, maximoMs, ejecutar])

  /* ── Al cerrar ── */

  const guardarYa = useCallback(async () => {
    clearTimeout(temporizador.current)
    await ejecutar()
  }, [ejecutar])

  /**
   * «Esto que hay en pantalla ya está en la base, lo guardó otro».
   *
   * Lo llama el botón de guardar. Sin esto, al cerrar el formulario el barrido
   * de desmontaje vería la firma distinta de la última que registró el
   * automático y lanzaría un guardado idéntico detrás del manual.
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
    return () => {
      clearTimeout(temporizador.current)
      if (!activo) return
      if (firmaRef.current === persistida.current) return
      // Sin `await`: el componente se está yendo. La petición ya salió.
      Promise.resolve(guardarRef.current()).catch((err) =>
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
