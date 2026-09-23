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
import { useCallback, useEffect, useState } from 'react'
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

import { RUBRICA_CRITERIOS, notaDeCalificaciones } from '@/features/evaluaciones/lib/rubrica'
import { recalcularDetalle } from '@/features/evaluaciones/lib/archivos'
import {
  exportarEvaluacionManual,
  exportarResumenGeneral,
} from '@/features/evaluaciones/lib/exportar-excel'
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
  const [guardandoRubricas, setGuardandoRubricas] = useState(false)

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
        const anioActual = new Date().getFullYear()
        setAniosDisponibles([anioActual, anioActual - 1])
        setAnioSeleccionado(anioActual)
        setSemestreSeleccionado('S2')
      } finally {
        setCargandoPeriodos(false)
      }
    }
    cargarPeriodos()
  }, [])

  const cargarEvaluaciones = async () => {
    if (!periodo) return

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
      setCalificacionesMatriz(matrizInicial)
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
      setCalificaciones(Object.fromEntries(RUBRICA_CRITERIOS.map((c) => [c.id, null])))
    }
  }

  const actualizarCalificacion = (criterioId, valor) => {
    setCalificaciones((prev) => ({ ...prev, [criterioId]: valor }))
  }

  /** Promedio sobre los 6 criterios, normalizado a escala 5. */
  const calcularNotaRubrica = () => {
    const suma = RUBRICA_CRITERIOS.reduce((acc, criterio) => {
      const c = calificaciones[criterio.id]
      return c !== null && c !== undefined ? acc + parseFloat(c) : acc
    }, 0)
    if (suma === 0) return 0
    return (suma / RUBRICA_CRITERIOS.length / 4) * 5
  }

  const guardarEvaluacionRubrica = async () => {
    if (!auditorSeleccionado) {
      toast.warning('No hay auditor seleccionado')
      return
    }

    const sinCalificar = RUBRICA_CRITERIOS.filter(
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

  /* ── Matriz de rúbrica ── */

  const cambiarCalificacion = (evaluacionId, criterioId, valor) => {
    setCalificacionesMatriz((prev) => {
      const fila = { ...(prev[evaluacionId] || {}) }
      if (valor === '') delete fila[criterioId]
      else fila[criterioId] = parseFloat(valor)
      return { ...prev, [evaluacionId]: fila }
    })
  }

  const guardarTodasRubricas = async () => {
    const conCalificaciones = Object.entries(calificacionesMatriz).filter(
      ([, calif]) => Object.keys(calif).length > 0
    )

    if (!conCalificaciones.length) {
      toast.warning('No hay calificaciones para guardar')
      return
    }

    setGuardandoRubricas(true)
    let exitosas = 0
    let fallidas = 0

    try {
      for (const [evaluacionId, respuestas] of conCalificaciones) {
        try {
          await guardarRubrica({
            evaluacionId,
            respuestas,
            nota: notaDeCalificaciones(respuestas),
          })
          exitosas++
        } catch (err) {
          fallidas++
          console.error(`Error guardando evaluación ${evaluacionId}:`, err)
        }
      }

      if (exitosas > 0) toast.success(`${exitosas} evaluación(es) guardada(s)`)
      if (fallidas > 0) {
        toast.error(`${fallidas} evaluación(es) fallaron. Revisa la consola para detalles.`)
      }

      await cargarEvaluaciones()
    } catch (err) {
      console.error('Error general guardando evaluaciones:', err)
      toast.error(`Error al guardar: ${err.message}`)
    } finally {
      setGuardandoRubricas(false)
    }
  }

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

        <div className="grid gap-4 sm:grid-cols-2 lg:max-w-lg">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="eval-anio">
              <Calendar className="h-3.5 w-3.5" />
              Año
            </Label>
            <Select
              value={anioSeleccionado ? String(anioSeleccionado) : undefined}
              onValueChange={(v) => setAnioSeleccionado(Number(v))}
              disabled={cargandoPeriodos || aniosDisponibles.length === 0}
            >
              <SelectTrigger id="eval-anio">
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

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="eval-semestre">
              <Calendar className="h-3.5 w-3.5" />
              Semestre
            </Label>
            <Select
              value={semestreSeleccionado || undefined}
              onValueChange={setSemestreSeleccionado}
              disabled={cargandoPeriodos || semestresDisponibles.length === 0}
            >
              <SelectTrigger id="eval-semestre">
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
          onCalificar={cambiarCalificacion}
          onGuardar={guardarTodasRubricas}
          guardando={guardandoRubricas}
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
