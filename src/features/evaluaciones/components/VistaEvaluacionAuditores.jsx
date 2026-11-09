'use client'

/**
 * Evaluación de auditores.
 *
 * Este archivo orquesta: elige el periodo, carga sus evaluaciones y coordina
 * las tres pestañas (resumen, matriz de rúbrica e importación de encuestas),
 * que viven en `components/evaluacion/`.
 *
 * La nota final combina archivos entregados, encuesta y rúbrica.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, Calculator, Calendar, Edit3, Filter, RefreshCw, Scale, TrendingUp, Upload } from 'lucide-react'
import { toast } from 'react-toastify'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/ui/page-header'
import { ViewToggle } from '@/components/ui/view-toggle'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PAGE_SHELL, SECTION_CARD } from '@/components/ui/tokens'

import { notaDeCalificaciones, rubricaDelPeriodo } from '@/features/evaluaciones/lib/rubrica'
import { recalcularDetalle } from '@/features/evaluaciones/lib/archivos'
import {
  exportarEvaluacionManual,
  exportarResumenGeneral,
} from '@/features/evaluaciones/lib/exportar-excel'
import { anioActual } from '@/lib/fechas/anio'
import { crearCola } from '@/features/auditorias/hooks/useGuardadoAutomatico'
import { ImportarEncuestas } from './evaluacion/ImportarEncuestas'
import { MatrizRubrica } from './evaluacion/MatrizRubrica'
import { ModalDesgloseArchivos } from './evaluacion/ModalDesgloseArchivos'
import { ModalPesosNotaFinal } from './evaluacion/ModalPesosNotaFinal'
import { TablaResumenEvaluaciones } from './evaluacion/TablaResumenEvaluaciones'
import {
  actualizarFechas,
  calcularArchivos,
  guardarPesos,
  guardarRubrica,
  importarEncuestas,
  listarEvaluaciones,
  listarPeriodosDisponibles,
  obtenerPesos,
} from '@/features/evaluaciones/api/evaluaciones-api'

const TABS = [
  { key: 'resumen', label: 'Resumen general', icon: TrendingUp },
  { key: 'rubrica', label: 'Evaluación manual', icon: Edit3 },
  { key: 'importar', label: 'Importar encuestas', icon: Upload },
]

/**
 * Cuánto esperar tras el último cambio de una fila antes de guardarla. Cada
 * cambio es una elección en un desplegable, no una tecla: basta con agrupar
 * los que se hacen seguidos en la misma fila.
 */
const ESPERA_RUBRICA_MS = 800

export default function VistaEvaluacionAuditores() {
  // Periodo
  const [anioSeleccionado, setAnioSeleccionado] = useState(null)
  const [semestreSeleccionado, setSemestreSeleccionado] = useState(null)
  const [aniosDisponibles, setAniosDisponibles] = useState([])
  const [semestresDisponibles, setSemestresDisponibles] = useState(['S1', 'S2'])
  const [cargandoPeriodos, setCargandoPeriodos] = useState(true)

  const [tabActiva, setTabActiva] = useState('resumen')

  const [loading, setLoading] = useState(false)
  const [actualizandoDatos, setActualizandoDatos] = useState(false)
  const [error, setError] = useState('')

  const [evaluaciones, setEvaluaciones] = useState([])

  // Importación de encuestas
  const [archivoEncuesta, setArchivoEncuesta] = useState(null)
  const [progreso, setProgreso] = useState(null)

  // Matriz de rúbrica: { evaluacion_id: { c1: 4, c2: 3.5, … } }
  const [calificacionesMatriz, setCalificacionesMatriz] = useState({})
  /**
   * Cómo va el guardado de cada fila de la matriz:
   * 'pendiente' | 'guardando' | 'guardado' | 'error'.
   */
  const [estadoFilas, setEstadoFilas] = useState({})

  // Modal de desglose de archivos
  const [evaluacionArchivos, setEvaluacionArchivos] = useState(null)
  const [archivosEditados, setArchivosEditados] = useState({})
  const [guardandoFechas, setGuardandoFechas] = useState(false)

  /* ------------------------------------------------------------------
   * Flujo de evaluación de un auditor a la vez.
   *
   * `auditores`, `seleccionarAuditor`, `actualizarCalificacion`,
   * `calcularNotaRubrica`, `guardarEvaluacionRubrica` y `cancelarEvaluacion`
   * están escritos pero hoy no se llaman desde ningún sitio de esta pantalla:
   * la evaluación se hace desde la matriz. Se conservan a propósito —el flujo
   * está previsto y solo falta conectarlo a la UI—, junto con el estado que
   * necesitan para funcionar el día que se enganchen.
   * ------------------------------------------------------------------ */
  /* eslint-disable @typescript-eslint/no-unused-vars */
  const [auditores, setAuditores] = useState([])
  const [auditorSeleccionado, setAuditorSeleccionado] = useState(null)
  const [evaluacionActual, setEvaluacionActual] = useState(null)
  const [calificaciones, setCalificaciones] = useState({})
  const [guardandoRubrica, setGuardandoRubrica] = useState(false)
  /* eslint-enable @typescript-eslint/no-unused-vars */

  const periodo =
    anioSeleccionado && semestreSeleccionado ? `${anioSeleccionado}-${semestreSeleccionado}` : null
  const periodoLabel = periodo || 'Sin periodo'

  /* ── Carga ── */

  useEffect(() => {
    const cargarPeriodos = async () => {
      setCargandoPeriodos(true)
      try {
        const data = await listarPeriodosDisponibles()
        setAniosDisponibles(data.anios || [])
        setSemestresDisponibles(data.semestres || ['S1', 'S2'])

        if (data.masReciente) {
          const [anio, semestre] = data.masReciente.split('-')
          setAnioSeleccionado(parseInt(anio))
          setSemestreSeleccionado(semestre)
        } else if (data.anios?.length) {
          setAnioSeleccionado(data.anios[0])
          setSemestreSeleccionado('S2')
        }
      } catch (err) {
        console.error('Error cargando periodos disponibles:', err)
        toast.error('No se pudieron cargar los periodos disponibles')
        const esteAnio = anioActual()
        setAniosDisponibles([esteAnio, esteAnio - 1])
        setAnioSeleccionado(esteAnio)
        setSemestreSeleccionado('S2')
      } finally {
        setCargandoPeriodos(false)
      }
    }
    cargarPeriodos()
  }, [])

  const cargarEvaluaciones = async () => {
    if (!periodo) return

    // Lo que quedara por guardar va antes de leer: si no, la lectura traería
    // las notas de antes y la matriz las pintaría encima de lo elegido.
    await guardarPendientes()

    setLoading(true)
    setError('')
    try {
      const data = await listarEvaluaciones({ periodo })
      setEvaluaciones(data.evaluaciones || [])
      setAuditores(data.auditores || [])

      // La matriz arranca con las calificaciones ya guardadas.
      const matrizInicial = {}
      data.evaluaciones?.forEach((ev) => {
        matrizInicial[ev.id] = ev.rubrica_respuestas || {}
      })
      matrizRef.current = matrizInicial
      periodoMatriz.current = periodo
      setCalificacionesMatriz(matrizInicial)
      setEstadoFilas({})
    } catch (err) {
      console.error('Error cargando evaluaciones:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (periodo) cargarEvaluaciones()
    // `cargarEvaluaciones` se redefine en cada render; el disparador real es el periodo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo])

  /* ── Pesos de la nota final ── */

  const [pesosAbierto, setPesosAbierto] = useState(false)
  const [pesosConfig, setPesosConfig] = useState(null)
  const [pesosCargando, setPesosCargando] = useState(false)
  const [pesosGuardando, setPesosGuardando] = useState(false)

  const abrirPesos = useCallback(async () => {
    if (!periodo) return

    setPesosAbierto(true)
    setPesosCargando(true)
    try {
      setPesosConfig(await obtenerPesos(periodo))
    } catch (err) {
      toast.error(`No se pudieron cargar los pesos: ${err.message}`)
      setPesosAbierto(false)
    } finally {
      setPesosCargando(false)
    }
  }, [periodo])

  const guardarPesosDelPeriodo = async (pesos) => {
    setPesosGuardando(true)
    try {
      const res = await guardarPesos({ periodo, ...pesos })

      toast.success(
        `Pesos guardados: ${res.pesos.peso_archivos} / ${res.pesos.peso_encuesta} / ${res.pesos.peso_rubrica} %` +
          ` · ${res.recalculadas} evaluación(es) recalculada(s)`
      )
      if (res.fallidas) toast.warning(`${res.fallidas} evaluación(es) no se pudieron recalcular.`)

      setPesosAbierto(false)
      await cargarEvaluaciones()
    } catch (err) {
      toast.error(`No se pudieron guardar los pesos: ${err.message}`)
    } finally {
      setPesosGuardando(false)
    }
  }

  /* ── Recalcular notas de archivos ── */

  const recalcularNotasArchivos = async () => {
    if (!periodo) {
      toast.warning('Selecciona un periodo válido')
      return
    }
    if (!evaluaciones.length) {
      toast.warning('No hay evaluaciones para recalcular')
      return
    }

    setActualizandoDatos(true)
    let exitosos = 0
    let errores = 0

    try {
      for (const ev of evaluaciones) {
        try {
          await calcularArchivos({
            auditorId: ev.auditor_id,
            periodo,
            dependenciaAuditada: ev.auditor_dependencia_nombre || ev.dependencia_auditada,
          })
          exitosos++
        } catch (e) {
          console.error(`Error recalculando archivos del auditor ${ev.auditor_id}:`, e)
          errores++
        }
      }

      if (exitosos > 0) {
        toast.success(`Recálculo completado: ${exitosos} evaluaciones actualizadas`)
      }
      if (errores > 0) {
        toast.warning(`${errores} evaluaciones tuvieron errores. Revisa la consola.`)
      }

      const data = await listarEvaluaciones({ periodo })
      setEvaluaciones(data.evaluaciones || [])
    } catch (err) {
      console.error('Error recalculando archivos:', err)
      toast.error(`Error al recalcular: ${err.message}`)
      setError('Error al recalcular notas de archivos')
    } finally {
      setActualizandoDatos(false)
    }
  }

  /* ------------------------------------------------------------------
   * Flujo por auditor (conservado, ver nota de arriba).
   * ------------------------------------------------------------------ */
  /* eslint-disable @typescript-eslint/no-unused-vars */

  const seleccionarAuditor = (evaluacion) => {
    setAuditorSeleccionado(evaluacion)
    setEvaluacionActual(evaluacion)

    if (evaluacion.rubrica_respuestas) {
      setCalificaciones(evaluacion.rubrica_respuestas)
    } else {
      setCalificaciones(
        Object.fromEntries(rubricaDelPeriodo(periodo).criterios.map((c) => [c.id, null]))
      )
    }
  }

  const actualizarCalificacion = (criterioId, valor) => {
    setCalificaciones((prev) => ({ ...prev, [criterioId]: valor }))
  }

  const calcularNotaRubrica = () => notaDeCalificaciones(calificaciones, periodo)

  const guardarEvaluacionRubrica = async () => {
    if (!auditorSeleccionado) {
      toast.warning('No hay auditor seleccionado')
      return
    }

    const sinCalificar = rubricaDelPeriodo(periodo).criterios.filter(
      (c) => calificaciones[c.id] === null || calificaciones[c.id] === undefined
    )
    if (sinCalificar.length > 0) {
      toast.warning(
        `Hay ${sinCalificar.length} criterio(s) sin calificar. Completa todos los criterios para una evaluación precisa.`
      )
      return
    }

    setGuardandoRubrica(true)
    try {
      await guardarRubrica({
        evaluacionId: auditorSeleccionado.id,
        respuestas: calificaciones,
        nota: calcularNotaRubrica(),
      })

      toast.success('Evaluación guardada exitosamente')
      await cargarEvaluaciones()

      setAuditorSeleccionado(null)
      setEvaluacionActual(null)
      setCalificaciones({})
    } catch (err) {
      console.error('Error guardando evaluación:', err)
      toast.error(`Error al guardar: ${err.message}`)
    } finally {
      setGuardandoRubrica(false)
    }
  }

  const cancelarEvaluacion = () => {
    if (Object.values(calificaciones).some((v) => v !== null)) {
      toast.info('Cambios descartados')
    }
    setAuditorSeleccionado(null)
    setEvaluacionActual(null)
    setCalificaciones({})
  }

  /* eslint-enable @typescript-eslint/no-unused-vars */

  /* ── Matriz de rúbrica: se guarda sola ──
   *
   * Cada fila se guarda por su cuenta un momento después de su último cambio.
   * Antes todo dependía del botón «Guardar todas las evaluaciones» del final
   * de la tabla: quien calificaba a veinte auditores y cambiaba de pestaña, de
   * periodo o cerraba sin pulsarlo, lo perdía todo.
   *
   * - `matrizRef` es la copia que leen los guardados. El estado de React solo
   *   está al día en el siguiente render, y un temporizador que lo leyera por
   *   cierre guardaría la elección anterior.
   * - Cada guardado se lleva una **foto** de la fila en el momento de salir,
   *   no la lee al ejecutarse: si entre tanto se carga otro periodo, la cola
   *   no guarda la fila vacía del periodo nuevo en lugar de la elegida.
   * - Una sola cola para todos: los guardados van de uno en uno y en orden, así
   *   que dos cambios seguidos de la misma fila nunca llegan al revés.
   */
  const matrizRef = useRef({})
  /** El periodo de lo que hay en `matrizRef`: de él depende la escala de la nota. */
  const periodoMatriz = useRef(null)
  const temporizadores = useRef(new Map())
  const enVuelo = useRef(0)
  const colaRubrica = useRef(null)
  if (!colaRubrica.current) colaRubrica.current = crearCola()
  /** Hubo guardados desde la última lectura: el resumen tiene notas viejas. */
  const huboGuardados = useRef(false)

  const marcarFila = (evaluacionId, estado) =>
    setEstadoFilas((prev) => ({ ...prev, [evaluacionId]: estado }))

  const guardarFila = useCallback((evaluacionId) => {
    clearTimeout(temporizadores.current.get(evaluacionId))
    temporizadores.current.delete(evaluacionId)

    const respuestas = { ...(matrizRef.current[evaluacionId] || {}) }
    // Sin ninguna nota se guarda vacía (`null`), no 0: un 0 bajaría la nota
    // final, y no enviarla dejaría en la base la nota que se acaba de quitar.
    const nota = notaDeCalificaciones(respuestas, periodoMatriz.current) || null

    enVuelo.current++
    return colaRubrica.current(async () => {
      marcarFila(evaluacionId, 'guardando')
      try {
        await guardarRubrica({
          evaluacionId,
          respuestas,
          nota,
        })
        huboGuardados.current = true
        // Si se volvió a cambiar mientras se guardaba, aún hay otro en camino.
        marcarFila(
          evaluacionId,
          temporizadores.current.has(evaluacionId) ? 'pendiente' : 'guardado'
        )
      } catch (err) {
        console.error(`Error guardando la rúbrica ${evaluacionId}:`, err)
        marcarFila(evaluacionId, 'error')
        // Un solo aviso aunque fallen varias filas a la vez.
        toast.error(`No se pudo guardar la rúbrica: ${err.message}`, {
          toastId: 'rubrica-error',
        })
      } finally {
        enVuelo.current--
      }
    })
  }, [])

  /** Guarda ya todo lo que esté esperando su turno. */
  const guardarPendientes = useCallback(
    () => Promise.all([...temporizadores.current.keys()].map(guardarFila)),
    [guardarFila]
  )

  const cambiarCalificacion = (evaluacionId, criterioId, valor) => {
    const fila = { ...(matrizRef.current[evaluacionId] || {}) }
    if (valor === '') delete fila[criterioId]
    else fila[criterioId] = parseFloat(valor)

    matrizRef.current = { ...matrizRef.current, [evaluacionId]: fila }
    setCalificacionesMatriz(matrizRef.current)

    clearTimeout(temporizadores.current.get(evaluacionId))
    temporizadores.current.set(
      evaluacionId,
      setTimeout(() => guardarFila(evaluacionId), ESPERA_RUBRICA_MS)
    )
    marcarFila(evaluacionId, 'pendiente')
  }

  const reintentarFallidas = () => {
    Object.entries(estadoFilas)
      .filter(([, estado]) => estado === 'error')
      .forEach(([evaluacionId]) => guardarFila(evaluacionId))
  }

  // Al salir de la pantalla no se espera al temporizador: se guarda ya.
  useEffect(() => () => void guardarPendientes(), [guardarPendientes])

  // Y si se cierra la pestaña con algo sin guardar, el navegador pregunta.
  useEffect(() => {
    const avisar = (e) => {
      if (!temporizadores.current.size && !enVuelo.current) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [])

  // La nota final la recalcula la base al guardar cada rúbrica, así que el
  // resumen se vuelve a leer al salir de la matriz si se guardó algo.
  useEffect(() => {
    if (tabActiva === 'rubrica' || !huboGuardados.current) return
    huboGuardados.current = false
    cargarEvaluaciones()
    // `cargarEvaluaciones` se redefine en cada render; el disparador es la pestaña.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabActiva])

  /* ── Desglose de archivos ── */

  const cerrarModalArchivos = () => {
    setEvaluacionArchivos(null)
    setArchivosEditados({})
  }

  const handleFechaEntregaChange = (informeIdx, archivoIdx, nuevaFecha) => {
    setArchivosEditados((prev) => ({
      ...prev,
      [`${informeIdx}-${archivoIdx}`]: { informeIdx, archivoIdx, fechaCarga: nuevaFecha },
    }))
  }

  const guardarFechasEditadas = async () => {
    if (!Object.keys(archivosEditados).length) {
      toast.info('No hay cambios para guardar')
      return
    }

    setGuardandoFechas(true)
    try {
      const recalculado = recalcularDetalle(
        evaluacionArchivos.detalle_archivos.informes,
        archivosEditados
      )

      await actualizarFechas({
        evaluacion_id: evaluacionArchivos.id,
        detalle_archivos: {
          informes: recalculado.informes,
          total_esperados: recalculado.totalEsperados,
          total_cargados: recalculado.totalCargados,
          total_puntos: recalculado.totalPuntos,
          porcentaje: recalculado.porcentaje,
        },
        nota_archivos: recalculado.nota,
        archivos_cargados: recalculado.totalCargados,
        porcentaje_completitud: recalculado.porcentaje,
      })

      toast.success('Fechas actualizadas correctamente')
      await cargarEvaluaciones()
      cerrarModalArchivos()
    } catch (err) {
      console.error('Error guardando fechas:', err)
      toast.error(`Error al guardar: ${err.message}`)
    } finally {
      setGuardandoFechas(false)
    }
  }

  /* ── Importación ── */

  const handleImportarEncuestas = async (e) => {
    e.preventDefault()

    if (!archivoEncuesta) {
      toast.warning('Por favor selecciona un archivo Excel')
      return
    }
    if (!periodo) {
      toast.warning('Selecciona un periodo válido')
      return
    }

    setLoading(true)
    setProgreso({ mensaje: 'Procesando archivo...', porcentaje: 0 })

    try {
      const result = await importarEncuestas({
        archivo: archivoEncuesta,
        anio: anioSeleccionado,
        semestre: semestreSeleccionado,
      })

      const partes = []
      if (result.nuevos > 0) partes.push(`${result.nuevos} nuevas encuestas`)
      if (result.actualizados > 0) partes.push(`${result.actualizados} actualizadas`)

      setProgreso({
        mensaje: partes.length ? `✅ ${partes.join(', ')}` : '✅ Importación completada',
        porcentaje: 100,
        detalles: result,
      })

      setTimeout(() => {
        cargarEvaluaciones()
        setArchivoEncuesta(null)
      }, 2000)
    } catch (err) {
      console.error(err)
      setProgreso({ mensaje: `❌ Error: ${err.message}`, porcentaje: 0, error: true })
    } finally {
      setLoading(false)
    }
  }

  /* ── Render ── */

  return (
    <div className={PAGE_SHELL}>
      <PageHeader
        title="Evaluación de auditores"
        subtitle="Calificación integral basada en archivos, encuestas y rúbrica manual"
        actions={
          <>
            {actualizandoDatos && (
              <span className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-3 py-2 text-sm font-medium text-white">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Actualizando notas…
              </span>
            )}
            <Button
              variant="secondary"
              onClick={recalcularNotasArchivos}
              disabled={loading || actualizandoDatos || evaluaciones.length === 0}
              title="Recalcular notas de archivos verificando los buckets de almacenamiento"
              className="bg-white/15 text-white hover:bg-white/25"
            >
              <Calculator />
              Recalcular archivos
            </Button>
            <Button
              variant="secondary"
              onClick={abrirPesos}
              disabled={!periodo}
              title="Cuánto pesa cada fuente en la nota final de este periodo"
              className="bg-white/15 text-white hover:bg-white/25"
            >
              <Scale />
              Pesos
            </Button>
            <Button
              variant="secondary"
              onClick={cargarEvaluaciones}
              disabled={loading}
              className="bg-white/15 text-white hover:bg-white/25"
            >
              <RefreshCw className={cn(loading && 'animate-spin')} />
              Actualizar
            </Button>
          </>
        }
      />

      {/* ── Periodo ── */}
      <section className={cn(SECTION_CARD, 'flex flex-col gap-4 p-4')}>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Periodo de evaluación</span>
          {periodo && <Badge variant="secondary">{periodo}</Badge>}
        </div>

        {/* Icono, rótulo y desplegable en una sola línea por campo. */}
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <div className="flex items-center gap-2">
            <Label htmlFor="eval-anio" className="flex shrink-0 items-center gap-1.5">
              <Calendar className="h-4 w-4 text-primary" />
              Año
            </Label>
            <Select
              value={anioSeleccionado ? String(anioSeleccionado) : undefined}
              onValueChange={(v) => setAnioSeleccionado(Number(v))}
              disabled={cargandoPeriodos || aniosDisponibles.length === 0}
            >
              <SelectTrigger id="eval-anio" className="w-36">
                <SelectValue placeholder={cargandoPeriodos ? 'Cargando…' : 'No hay datos'} />
              </SelectTrigger>
              <SelectContent>
                {aniosDisponibles.map((anio) => (
                  <SelectItem key={anio} value={String(anio)}>
                    {anio}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Label htmlFor="eval-semestre" className="flex shrink-0 items-center gap-1.5">
              <Calendar className="h-4 w-4 text-primary" />
              Semestre
            </Label>
            <Select
              value={semestreSeleccionado || undefined}
              onValueChange={setSemestreSeleccionado}
              disabled={cargandoPeriodos || semestresDisponibles.length === 0}
            >
              <SelectTrigger id="eval-semestre" className="w-40">
                <SelectValue placeholder={cargandoPeriodos ? 'Cargando…' : 'Semestre'} />
              </SelectTrigger>
              <SelectContent>
                {semestresDisponibles.map((sem) => (
                  <SelectItem key={sem} value={sem}>
                    {sem === 'S1' ? 'Semestre 1' : 'Semestre 2'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      <ViewToggle options={TABS} value={tabActiva} onChange={setTabActiva} className="self-start" />

      {error && (
        <p className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      {tabActiva === 'resumen' && (
        <TablaResumenEvaluaciones
          evaluaciones={evaluaciones}
          loading={loading}
          periodo={periodoLabel}
          onExportar={() => exportarResumenGeneral({ evaluaciones, periodo: periodoLabel })}
          onVerArchivos={setEvaluacionArchivos}
        />
      )}

      {tabActiva === 'rubrica' && (
        <MatrizRubrica
          evaluaciones={evaluaciones}
          calificaciones={calificacionesMatriz}
          periodo={periodo}
          onCalificar={cambiarCalificacion}
          estadoFilas={estadoFilas}
          onReintentar={reintentarFallidas}
          loading={loading}
          onExportar={() =>
            exportarEvaluacionManual({ evaluaciones, calificacionesMatriz, periodo: periodoLabel })
          }
        />
      )}

      {tabActiva === 'importar' && (
        <ImportarEncuestas
          archivo={archivoEncuesta}
          onArchivo={setArchivoEncuesta}
          onImportar={handleImportarEncuestas}
          progreso={progreso}
          loading={loading}
        />
      )}

      <ModalDesgloseArchivos
        evaluacion={evaluacionArchivos}
        open={Boolean(evaluacionArchivos)}
        onOpenChange={(o) => (o ? null : cerrarModalArchivos())}
        editados={archivosEditados}
        onFecha={handleFechaEntregaChange}
        onDescartar={() => setArchivosEditados({})}
        onGuardar={guardarFechasEditadas}
        guardando={guardandoFechas}
      />

      <ModalPesosNotaFinal
        open={pesosAbierto}
        onOpenChange={setPesosAbierto}
        periodo={periodoLabel}
        cargando={pesosCargando}
        config={pesosConfig}
        onGuardar={guardarPesosDelPeriodo}
        guardando={pesosGuardando}
      />
    </div>
  )
}
