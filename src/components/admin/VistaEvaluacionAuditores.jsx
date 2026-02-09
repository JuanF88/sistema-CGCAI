'use client'

import { useState, useEffect } from 'react'
import { 
  Upload, FileText, Calculator, Edit3, TrendingUp, 
  Calendar, Filter, Download, RefreshCw, CheckCircle,
  AlertCircle, Eye, ChevronDown, X 
} from 'lucide-react'
import { toast } from 'react-toastify'
import styles from './CSS/VistaEvaluacionAuditores.module.css'

export default function VistaEvaluacionAuditores() {
  // Estado de filtros principales
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1
  const currentSemestre = currentMonth <= 6 ? 'S1' : 'S2'
  
  const [anioSeleccionado, setAnioSeleccionado] = useState(2025) // Año fijo 2025
  const [semestreSeleccionado, setSemestreSeleccionado] = useState('S2') // Semestre fijo S2
  
  // Tabs del módulo
  const [tabActiva, setTabActiva] = useState('resumen')
  
  // Estados de carga
  const [loading, setLoading] = useState(false)
  const [actualizandoDatos, setActualizandoDatos] = useState(false)
  const [error, setError] = useState('')
  
  // Datos
  const [evaluaciones, setEvaluaciones] = useState([])
  const [auditores, setAuditores] = useState([])
  
  // Estado de importación de encuestas
  const [archivoEncuesta, setArchivoEncuesta] = useState(null)
  const [progreso, setProgreso] = useState(null)
  
  // Estados de evaluación manual
  const [auditorSeleccionado, setAuditorSeleccionado] = useState(null)
  const [evaluacionActual, setEvaluacionActual] = useState(null)
  const [calificaciones, setCalificaciones] = useState({})
  const [guardandoRubrica, setGuardandoRubrica] = useState(false)
  
  // Años disponibles (últimos 5 años)
  const aniosDisponibles = Array.from({ length: 5 }, (_, i) => 2025 - i)
  
  // Estructura de la rúbrica (basada en Rubrica.xlsx)
  const RUBRICA_CRITERIOS = [
    {
      id: 'c1',
      nombre: '1. Identificación del Informe',
      descripcion: 'Exactitud y completitud en la codificación, nombre del proceso, fecha, versión, etc.',
      peso: 1/6,
      niveles: {
        4: 'Excelente: Todos los datos completos, claros y correctamente codificados, firmados, con fechas claras.',
        3.8: 'Destacable: Datos completos y bien presentados, con leves detalles mejorables.',
        3.5: 'Muy bueno: Datos principales correctos, con omisiones menores sin afectar entendimiento.',
        3.3: 'Óptimo: Información clara en su mayoría, con errores puntuales, leve claridad de seguimiento.',
        3: 'Aceptable: Datos necesarios incluidos, con errores menores de presentación o codificación.',
        2: 'Deficiente: Datos incompletos, varias casillas sin diligenciar o mal organizados.',
        1: 'Insuficiente: Falta información básica o codificación incorrecta, sin firmas, sin fechas e interés de continuidad.'
      }
    },
    {
      id: 'c2',
      nombre: '2. Objetivo y Alcance de la Auditoría',
      descripcion: 'Claridad en la definición del objetivo y alcance, en coherencia con el programa de auditoría.',
      peso: 1/6,
      niveles: {
        4: 'Excelente: Objetivo y alcance completamente definidos, con redacción clara, precisa y coherente, muestra lineamientos personalizados.',
        3.8: 'Destacable: Objetivo y alcance definidos, con redacción clara y relación coherente al programa, se atreve a plasmar varios lineamientos.',
        3.5: 'Muy bueno: Objetivo y alcance presentes, aunque mejorables en claridad o profundidad, intenta atreverse a mostrar propios lineamientos.',
        3.3: 'Óptimo: Objetivo y alcance abordados con redacción menos precisa, se atreve poco a mostrar propios lineamientos.',
        3: 'Aceptable: Objetivo y alcance definidos, aunque con redacción mejorable.',
        2: 'Deficiente: Objetivo y alcance poco claros o no vinculados al programa.',
        1: 'Insuficiente: Objetivo y alcance no definidos.'
      }
    },
    {
      id: 'c3',
      nombre: '3. Oportunidades de Mejora',
      descripcion: 'Registro preciso y sustentado de oportunidades de mejora, con evidencia objetiva.',
      peso: 1/6,
      niveles: {
        4: 'Excelente: Registro completo, bien redactado, con evidencias objetivas y relevantes, buena definición respecto a la norma.',
        3.8: 'Destacable: Redacción clara y respaldada por análisis; se pueden mejorar algunos aspectos.',
        3.5: 'Muy bueno: Claras y justificadas con menor profundidad analítica y con redacción que no corresponde al tipo de hallazgo.',
        3.3: 'Óptimo: Adecuadas pero con escasa justificación o redacción mejorable.',
        3: 'Aceptable: Listadas pero con redacción deficiente o justificación débil.',
        2: 'Deficiente: Sin justificación clara o dista un poco respecto a la interpretación del requisito de norma.',
        1: 'Insuficiente: No se identifican hallazgos pero tampoco se plasma evidencia objetiva que respalde la conformidad.'
      }
    },
    {
      id: 'c4',
      nombre: '4. No Conformidades',
      descripcion: 'Registro preciso y sustentado de No Conformidades, con evidencia objetiva.',
      peso: 1/6,
      niveles: {
        4: 'Excelente: No conformidades claramente identificadas, bien fundamentadas y basadas en evidencia.',
        3.8: 'Destacable: Bien definidas y justificadas, con redacción técnica adecuada. Entendimiento entre lo encontrado y el requisito de norma.',
        3.5: 'Muy bueno: Presentes con claridad básica; puede faltar detalle o evidencia.',
        3.3: 'Óptimo: Redacción aceptable con algunos elementos faltantes.',
        3: 'Aceptable: Mencionadas sin suficiente claridad ni evidencia.',
        2: 'Deficiente: Mal redactadas o sin sustento objetivo.',
        1: 'Insuficiente: Poco fundamento, poca equidad con requisito de norma.'
      }
    },
    {
      id: 'c5',
      nombre: '5. Redacción y Lenguaje Técnico',
      descripcion: 'Claridad, coherencia, ortografía, uso de terminología adecuada y estilo profesional.',
      peso: 1/6,
      niveles: {
        4: 'Excelente: Redacción impecable, lenguaje técnico preciso y estilo profesional.',
        3.8: 'Destacable: Lenguaje profesional con mínimas imprecisiones. Se mantiene claridad y tono técnico adecuado.',
        3.5: 'Muy bueno: Buena redacción con algunos errores de forma o estilo técnico, sin comprometer comprensión.',
        3.3: 'Óptimo: Redacción adecuada pero con errores ocasionales o uso técnico mejorable.',
        3: 'Aceptable: Varios errores de forma, coherencia o terminología.',
        2: 'Deficiente: Redacción confusa o poco técnica en algunos apartados.',
        1: 'Insuficiente: Redacción deficiente con numerosos errores.'
      }
    },
    {
      id: 'c6',
      nombre: '6. Análisis Crítico y Valor Agregado',
      descripcion: 'Aporte reflexivo y valor agregado al proceso/dependencia auditada.',
      peso: 1/6,
      niveles: {
        4: 'Excelente: Presenta análisis reflexivo, aporta ideas y genera valor al proceso/dependencia/programa auditado.',
        3.8: 'Destacable: Se evidencia reflexión y propuesta de mejoras, aunque con menor profundidad.',
        3.5: 'Muy bueno: Aporta ideas útiles y análisis moderado, con oportunidad de profundización.',
        3.3: 'Óptimo: Contiene elementos de análisis, aunque superficiales o poco desarrollados.',
        3: 'Aceptable: Se evidencia análisis pero con menor profundidad.',
        2: 'Deficiente: Análisis escaso o sin aporte claro.',
        1: 'Insuficiente: Ausencia de análisis o valor agregado.'
      }
    }
  ]
  
  // Cargar evaluaciones cuando cambian los filtros
  useEffect(() => {
    cargarEvaluaciones()
  }, [anioSeleccionado, semestreSeleccionado])
  
  const cargarEvaluaciones = async () => {
    setLoading(true)
    setError('')
    try {
      const periodo = `${anioSeleccionado}-${semestreSeleccionado}`
      
      const res = await fetch(`/api/evaluaciones-auditores?periodo=${periodo}`)
      
      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Error al cargar evaluaciones')
      }
      
      const data = await res.json()
      
      setEvaluaciones(data.evaluaciones || [])
      setAuditores(data.auditores || [])
    } catch (err) {
      console.error('Error cargando evaluaciones:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }
  
  // Recalcular notas de archivos manualmente
  const recalcularNotasArchivos = async () => {
    if (!evaluaciones || evaluaciones.length === 0) {
      toast.warning('No hay evaluaciones para recalcular')
      return
    }

    setActualizandoDatos(true)
    
    try {
      const periodo = `${anioSeleccionado}-${semestreSeleccionado}`
      
      for (const ev of evaluaciones) {
        await fetch('/api/evaluaciones-auditores/calcular-archivos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            auditor_id: ev.auditor_id,
            periodo: periodo,
            dependencia_auditada: ev.auditor_dependencia_nombre || ev.dependencia_auditada
          })
        })
      }
      
      // Recargar evaluaciones
      const res = await fetch(`/api/evaluaciones-auditores?periodo=${periodo}`)
      if (res.ok) {
        const data = await res.json()
        setEvaluaciones(data.evaluaciones || [])
      }
    } catch (err) {
      console.error('Error recalculando archivos:', err)
      setError('Error al recalcular notas de archivos')
    } finally {
      setActualizandoDatos(false)
    }
  }

  // Seleccionar auditor para evaluar
  const seleccionarAuditor = (evaluacion) => {
    setAuditorSeleccionado(evaluacion)
    setEvaluacionActual(evaluacion)
    
    // Cargar calificaciones existentes si ya hay una evaluación de rúbrica
    if (evaluacion.rubrica_respuestas) {
      setCalificaciones(evaluacion.rubrica_respuestas)
    } else {
      // Inicializar calificaciones vacías
      const calificacionesIniciales = {}
      RUBRICA_CRITERIOS.forEach(criterio => {
        calificacionesIniciales[criterio.id] = null
      })
      setCalificaciones(calificacionesIniciales)
    }
  }

  // Actualizar calificación de un criterio
  const actualizarCalificacion = (criterioId, valor) => {
    setCalificaciones(prev => ({
      ...prev,
      [criterioId]: valor
    }))
  }

  // Calcular nota de rúbrica (promedio ponderado y normalizado a escala 5)
  const calcularNotaRubrica = () => {
    let sumaTotal = 0
    let criteriosCalificados = 0
    
    RUBRICA_CRITERIOS.forEach(criterio => {
      const calificacion = calificaciones[criterio.id]
      if (calificacion !== null && calificacion !== undefined) {
        sumaTotal += parseFloat(calificacion)
        criteriosCalificados++
      }
    })
    
    if (criteriosCalificados === 0) return 0
    
    // Calcular promedio simple (escala 1-4)
    const promedioRubrica = sumaTotal / RUBRICA_CRITERIOS.length
    
    // Normalizar a escala de 5: (promedio / 4) * 5
    const notaNormalizada = (promedioRubrica / 4) * 5
    
    return notaNormalizada
  }

  // Guardar evaluación de rúbrica
  const guardarEvaluacionRubrica = async () => {
    if (!auditorSeleccionado) {
      toast.warning('No hay auditor seleccionado')
      return
    }

    // Validar que todos los criterios estén calificados
    const criteriosSinCalificar = RUBRICA_CRITERIOS.filter(c => 
      calificaciones[c.id] === null || calificaciones[c.id] === undefined
    )

    if (criteriosSinCalificar.length > 0) {
      toast.warning(
        `Hay ${criteriosSinCalificar.length} criterio(s) sin calificar. Completa todos los criterios para una evaluación precisa.`,
        { autoClose: 4000 }
      )
      return
    }

    setGuardandoRubrica(true)

    try {
      const notaRubrica = calcularNotaRubrica()

      const res = await fetch('/api/evaluaciones-auditores/guardar-rubrica', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          evaluacion_id: auditorSeleccionado.id,
          rubrica_respuestas: calificaciones,
          nota_rubrica: notaRubrica
        })
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Error al guardar evaluación')
      }

      toast.success('Evaluación guardada exitosamente', {
        position: 'top-right',
        autoClose: 3000
      })
      
      // Recargar evaluaciones
      await cargarEvaluaciones()
      
      // Limpiar selección
      setAuditorSeleccionado(null)
      setEvaluacionActual(null)
      setCalificaciones({})

    } catch (err) {
      console.error('Error guardando evaluación:', err)
      toast.error(`Error al guardar: ${err.message}`, {
        position: 'top-right',
        autoClose: 5000
      })
    } finally {
      setGuardandoRubrica(false)
    }
  }

  // Cancelar evaluación
  const cancelarEvaluacion = () => {
    const tieneCambios = Object.values(calificaciones).some(v => v !== null)
    
    if (tieneCambios) {
      toast.info('Cambios descartados', { autoClose: 2000 })
    }
    
    setAuditorSeleccionado(null)
    setEvaluacionActual(null)
    setCalificaciones({})
  }

  // Descargar plantilla de ejemplo
  const descargarPlantilla = () => {
    // Descargar el archivo Excel desde public/plantillas
    const link = document.createElement('a')
    link.href = '/plantillas/Evaluación Auditores (respuestas).xlsx'
    link.download = 'Evaluación Auditores (respuestas).xlsx'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast.success('Plantilla descargada. Completa los datos y vuelve a importar', {
      autoClose: 3000
    })
  }

  // Handler para importar encuestas
  const handleImportarEncuestas = async (e) => {
    e.preventDefault()
    
    if (!archivoEncuesta) {
      toast.warning('Por favor selecciona un archivo Excel')
      return
    }

    setLoading(true)
    setProgreso({ mensaje: 'Procesando archivo...', porcentaje: 0 })

    try {
      const formData = new FormData()
      formData.append('archivo', archivoEncuesta)
      formData.append('anio', anioSeleccionado)
      formData.append('semestre', semestreSeleccionado)

      const res = await fetch('/api/evaluaciones-auditores/importar-encuestas', {
        method: 'POST',
        body: formData
      })

      if (!res.ok) throw new Error('Error al importar encuestas')

      const result = await res.json()
      
      const mensajeExito = result.nuevos > 0 && result.actualizados > 0
        ? `✅ ${result.nuevos} nuevas encuestas, ${result.actualizados} actualizadas`
        : result.nuevos > 0
        ? `✅ ${result.nuevos} encuestas importadas`
        : result.actualizados > 0
        ? `✅ ${result.actualizados} encuestas actualizadas`
        : '✅ Importación completada'
      
      setProgreso({
        mensaje: mensajeExito,
        porcentaje: 100,
        detalles: result
      })

      // Recargar evaluaciones
      setTimeout(() => {
        cargarEvaluaciones()
        setArchivoEncuesta(null)
      }, 2000)

    } catch (err) {
      console.error(err)
      setProgreso({
        mensaje: `❌ Error: ${err.message}`,
        porcentaje: 0,
        error: true
      })
    } finally {
      setLoading(false)
    }
  }

  const tabs = [
    { key: 'resumen', label: 'Resumen General', icon: TrendingUp },
        { key: 'rubrica', label: 'Evaluación Manual', icon: Edit3 },
    { key: 'importar', label: 'Importar Encuestas', icon: Upload }

  ]

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}>📊</div>
          <div>
            <h1 className={styles.title}>Evaluación de Auditores</h1>
            <p className={styles.subtitle}>
              Calificación integral basada en archivos, encuestas y rúbrica manual
            </p>
          </div>
        </div>
        <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
          {actualizandoDatos && (
            <div className={styles.actualizandoBanner}>
              <div className={styles.spinnerSmall}></div>
              <span>Actualizando notas...</span>
            </div>
          )}
          <button 
            className={styles.btnSecondary} 
            onClick={recalcularNotasArchivos}
            disabled={loading || actualizandoDatos || evaluaciones.length === 0}
            title="Recalcular notas de archivos verificando los buckets de almacenamiento"
          >
            <Calculator size={18} />
            Recalcular Archivos
          </button>
          <button className={styles.btnRefresh} onClick={cargarEvaluaciones}>
            <RefreshCw size={18} />
            Actualizar
          </button>
        </div>
      </div>

      {/* Filtros principales: Año y Semestre */}
      <div className={styles.filtrosCard}>
        <div className={styles.filtrosHeader}>
          <Filter size={20} />
          <span className={styles.filtrosTitle}>Periodo de Evaluación</span>
        </div>
        <div className={styles.filtrosRow}>
          {/* Selector de Año */}
          <div className={styles.filtroItem}>
            <label className={styles.filtroLabel}>
              <Calendar size={16} />
              Año
            </label>
            <select 
              value={anioSeleccionado}
              onChange={(e) => setAnioSeleccionado(Number(e.target.value))}
              className={styles.select}
              disabled={aniosDisponibles.length === 0}
            >
              {aniosDisponibles.map(anio => (
                <option key={anio} value={anio}>{anio}</option>
              ))}
              {aniosDisponibles.length === 0 && (
                <option value="">No hay datos</option>
              )}
            </select>
          </div>

          {/* Selector de Semestre */}
          <div className={styles.filtroItem}>
            <label className={styles.filtroLabel}>
              <Calendar size={16} />
              Semestre
            </label>
            <select
              value={semestreSeleccionado}
              onChange={(e) => setSemestreSeleccionado(e.target.value)}
              className={styles.select}
            >
              <option value="S1">Semestre 1</option>
              <option value="S2">Semestre 2</option>
            </select>
          </div>

          {/* Badge del periodo actual */}
          <div className={styles.periodoBadge}>
            <span className={styles.periodoTexto}>
              Periodo: {anioSeleccionado}-{semestreSeleccionado}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs de navegación */}
      <div className={styles.tabs}>
        {tabs.map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.key}
              onClick={() => setTabActiva(tab.key)}
              className={`${styles.tab} ${tabActiva === tab.key ? styles.tabActive : ''}`}
            >
              <Icon size={18} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Contenido de las tabs */}
      <div className={styles.content}>
        {/* Tab: Resumen General */}
        {tabActiva === 'resumen' && (
          <div className={styles.tabContent}>
            <h2 className={styles.tabTitle}>📈 Resumen General de Evaluaciones</h2>
            <p className={styles.tabSubtitle}>
              Vista consolidada de todas las evaluaciones del periodo {anioSeleccionado}-{semestreSeleccionado}
            </p>

            {loading ? (
              <div className={styles.loading}>Cargando evaluaciones...</div>
            ) : evaluaciones.length === 0 ? (
              <div className={styles.empty}>
                <AlertCircle size={48} />
                <p>No hay evaluaciones registradas para este periodo</p>
                <p className={styles.emptyHint}>
                  Comienza importando las encuestas desde Google Forms
                </p>
              </div>
            ) : (
              <div className={styles.tableContainer}>
                <div className={styles.infoBox} style={{marginBottom: '20px'}}>
                  <div className={styles.infoHeader}>
                    <FileText size={20} />
                    <h3>Notas de Archivos</h3>
                  </div>
                  <p>
                    Las notas de archivos verifican la presencia de:
                    Plan, Asistencia, Evaluación, Acta, Acta de Compromiso y Validación.
                    La nota se calcula como: (Archivos Cargados / Archivos Esperados) × 5.0
                  </p>
                  <p style={{marginTop: '8px', fontSize: '13px', color: '#64748b'}}>
                    💡 Usa el botón "Recalcular Archivos" si has subido nuevos documentos.
                  </p>
                </div>
                
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>ID Informe</th>
                      <th>Auditor</th>
                      <th>Dependencia</th>
                      <th>Fecha Auditoría</th>
                      <th>Archivos</th>
                      <th>Nota Archivos</th>
                      <th>Nota Encuesta</th>
                      <th>Nota Rúbrica</th>
                      <th>Nota Final</th>
                    </tr>
                  </thead>
                  <tbody>
                    {evaluaciones.map(ev => (
                      <tr key={ev.id}>
                        <td>
                          <span style={{fontFamily: 'monospace', fontSize: '0.9em', color: '#0066cc'}}>
                            {ev.informe_auditoria_id || '-'}
                          </span>
                        </td>
                        <td>
                          <div style={{fontWeight: '500'}}>{ev.auditor_nombre} {ev.auditor_apellido}</div>
                        </td>
                        <td>
                          <span style={{fontSize: '0.9em', color: '#666'}}>
                            {ev.auditor_dependencia_nombre || '-'}
                          </span>
                        </td>
                        <td>
                          <span style={{fontSize: '0.85em', color: '#666'}}>
                            {ev.fecha_auditoria || '-'}
                          </span>
                        </td>
                        <td>
                          <span style={{fontSize: '0.85em', color: '#666'}}>
                            {ev.archivos_cargados || 0}/{ev.archivos_esperados || 0}
                            {ev.porcentaje_completitud !== null && (
                              <span style={{marginLeft: '5px', color: ev.porcentaje_completitud === 100 ? '#22c55e' : '#f59e0b'}}>
                                ({ev.porcentaje_completitud.toFixed(0)}%)
                              </span>
                            )}
                          </span>
                        </td>
                        <td>
                          {ev.nota_archivos !== null ? (
                            <span style={{fontWeight: '500', color: ev.nota_archivos >= 4 ? '#22c55e' : ev.nota_archivos >= 3 ? '#f59e0b' : '#ef4444'}}>
                              {ev.nota_archivos.toFixed(2)}
                            </span>
                          ) : '-'}
                        </td>
                        <td>
                          {ev.nota_encuesta !== null ? (
                            <span style={{fontWeight: '500', color: ev.nota_encuesta >= 4 ? '#22c55e' : ev.nota_encuesta >= 3 ? '#f59e0b' : '#ef4444'}}>
                              {ev.nota_encuesta.toFixed(2)}
                            </span>
                          ) : (
                            <span style={{color: '#94a3b8'}}>-</span>
                          )}
                        </td>
                        <td>
                          {ev.nota_rubrica !== null ? (
                            <span style={{fontWeight: '500', color: ev.nota_rubrica >= 4 ? '#22c55e' : ev.nota_rubrica >= 3 ? '#f59e0b' : '#ef4444'}}>
                              {ev.nota_rubrica.toFixed(2)}
                            </span>
                          ) : (
                            <span style={{color: '#94a3b8'}}>-</span>
                          )}
                        </td>
                        <td>
                          <span className={styles.notaFinal}>
                            {ev.nota_final?.toFixed(2) || '-'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab: Evaluación Manual */}
        {tabActiva === 'rubrica' && (
          <div className={styles.tabContent}>
            <h2 className={styles.tabTitle}>✍️ Evaluación Manual con Rúbrica</h2>
            <p className={styles.tabSubtitle}>
              Calificación individual de auditores según criterios establecidos
            </p>

            {loading ? (
              <div className={styles.loading}>Cargando evaluaciones...</div>
            ) : !auditorSeleccionado ? (
              /* Vista de selección de auditor */
              <div>
                <div className={styles.infoBox} style={{marginBottom: '20px'}}>
                  <div className={styles.infoHeader}>
                    <Edit3 size={20} />
                    <h3>Instrucciones de Evaluación</h3>
                  </div>
                  <p>
                    Selecciona un auditor de la lista para iniciar su evaluación manual.
                    La rúbrica evalúa 6 criterios con una escala de 1 a 4 puntos.
                  </p>
                  <p style={{marginTop: '8px', fontSize: '13px', color: '#64748b'}}>
                    💡 La nota de rúbrica se calcula como el promedio de los 6 criterios evaluados.
                  </p>
                </div>

                {evaluaciones.length === 0 ? (
                  <div className={styles.empty}>
                    <AlertCircle size={48} />
                    <p>No hay evaluaciones registradas para este periodo</p>
                    <p className={styles.emptyHint}>
                      Las evaluaciones se crean automáticamente al importar encuestas
                    </p>
                  </div>
                ) : (
                  <div className={styles.tableContainer}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>ID Informe</th>
                          <th>Auditor</th>
                          <th>Dependencia</th>
                          <th>Fecha</th>
                          <th>Nota Rúbrica</th>
                          <th>Estado Evaluación</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {evaluaciones.map(ev => (
                          <tr key={ev.id}>
                            <td>
                              <span style={{fontFamily: 'monospace', fontSize: '0.9em', color: '#0066cc'}}>
                                {ev.informe_auditoria_id || '-'}
                              </span>
                            </td>
                            <td>
                              <div style={{fontWeight: '500'}}>
                                {ev.auditor_nombre} {ev.auditor_apellido}
                              </div>
                            </td>
                            <td>
                              <span style={{fontSize: '0.9em', color: '#666'}}>
                                {ev.auditor_dependencia_nombre || '-'}
                              </span>
                            </td>
                            <td>
                              <span style={{fontSize: '0.85em', color: '#666'}}>
                                {ev.fecha_auditoria || '-'}
                              </span>
                            </td>
                            <td>
                              {ev.nota_rubrica !== null ? (
                                <span style={{fontWeight: '500', color: '#22c55e'}}>
                                  {ev.nota_rubrica.toFixed(2)}
                                </span>
                              ) : (
                                <span style={{color: '#94a3b8'}}>Sin evaluar</span>
                              )}
                            </td>
                            <td>
                              {ev.nota_rubrica !== null ? (
                                <span className={styles.badge} style={{background: '#22c55e20', color: '#22c55e'}}>
                                  <CheckCircle size={14} /> Evaluado
                                </span>
                              ) : (
                                <span className={styles.badge} style={{background: '#f59e0b20', color: '#f59e0b'}}>
                                  <AlertCircle size={14} /> Pendiente
                                </span>
                              )}
                            </td>
                            <td>
                              <button 
                                className={styles.btnPrimary}
                                onClick={() => seleccionarAuditor(ev)}
                                style={{padding: '6px 12px', fontSize: '13px'}}
                              >
                                <Edit3 size={14} />
                                {ev.nota_rubrica !== null ? 'Editar' : 'Evaluar'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              /* Vista de evaluación del auditor seleccionado */
              <div className={styles.evaluacionForm}>
                {/* Header de evaluación */}
                <div className={styles.evaluacionHeader}>
                  <div>
                    <h3 className={styles.evaluacionTitulo}>
                      Evaluando a: {auditorSeleccionado.auditor_nombre} {auditorSeleccionado.auditor_apellido}
                    </h3>
                    <p className={styles.evaluacionSubtitulo}>
                      Dependencia: {auditorSeleccionado.auditor_dependencia_nombre} | 
                      Informe ID: {auditorSeleccionado.informe_auditoria_id} | 
                      Fecha: {auditorSeleccionado.fecha_auditoria || 'N/A'}
                    </p>
                  </div>
                  <button 
                    className={styles.btnClose}
                    onClick={cancelarEvaluacion}
                    title="Cancelar evaluación"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Nota calculada en tiempo real */}
                <div className={styles.notaPreview}>
                  <div className={styles.notaLabel}>Nota de Rúbrica (calculada):</div>
                  <div className={styles.notaValor}>
                    {calcularNotaRubrica().toFixed(2)}
                  </div>
                  <div className={styles.notaEscala}>/ 5.00</div>
                </div>

                {/* Formulario de criterios */}
                <div className={styles.criteriosGrid}>
                  {RUBRICA_CRITERIOS.map((criterio, idx) => (
                    <div key={criterio.id} className={styles.criterioCard}>
                      <div className={styles.criterioHeader}>
                        <h4 className={styles.criterioNombre}>{criterio.nombre}</h4>
                        <p className={styles.criterioDescripcion}>{criterio.descripcion}</p>
                      </div>

                      {/* Opciones de calificación */}
                      <div className={styles.nivelesContainer}>
                        {Object.keys(criterio.niveles).sort((a, b) => b - a).map(nivel => (
                          <label 
                            key={nivel}
                            className={`${styles.nivelOpcion} ${calificaciones[criterio.id] == nivel ? styles.nivelSeleccionado : ''}`}
                          >
                            <input
                              type="radio"
                              name={criterio.id}
                              value={nivel}
                              checked={calificaciones[criterio.id] == nivel}
                              onChange={(e) => actualizarCalificacion(criterio.id, parseFloat(e.target.value))}
                              className={styles.radioInput}
                            />
                            <div className={styles.nivelContenido}>
                              <div className={styles.nivelPuntos}>{nivel} pts</div>
                              <div className={styles.nivelDescripcion}>
                                {criterio.niveles[nivel]}
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>

                      {/* Indicador de selección */}
                      {calificaciones[criterio.id] !== null && calificaciones[criterio.id] !== undefined && (
                        <div className={styles.criterioSeleccionado}>
                          ✓ Seleccionado: {calificaciones[criterio.id]} puntos
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Botones de acción */}
                <div className={styles.evaluacionAcciones}>
                  <button 
                    className={styles.btnSecondary}
                    onClick={cancelarEvaluacion}
                  >
                    Cancelar
                  </button>
                  <button 
                    className={styles.btnPrimary}
                    onClick={guardarEvaluacionRubrica}
                    disabled={guardandoRubrica}
                  >
                    {guardandoRubrica ? 'Guardando...' : '💾 Guardar Evaluación'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab: Importar Encuestas */}
        {tabActiva === 'importar' && (
          <div className={styles.tabContent}>
            <h2 className={styles.tabTitle}>📋 Importar Encuestas de Evaluación</h2>
            <p className={styles.tabSubtitle}>
              Carga el archivo Excel exportado desde Google Forms con las respuestas de evaluación
            </p>

            <div className={styles.importCard}>
              {/* Instrucciones */}
              <div className={styles.instrucciones}>
                <h3>📌 Instrucciones</h3>
                <ol>
                  <li>Exporta las respuestas del Google Forms en formato Excel (.xlsx)</li>
                  <li>Asegúrate de que el archivo contenga todas las columnas requeridas</li>
                  <li>Selecciona el archivo y haz clic en "Importar"</li>
                  <li>El sistema procesará y vinculará automáticamente con los auditores</li>
                </ol>
              </div>

              {/* Formulario de importación */}
              <form onSubmit={handleImportarEncuestas} className={styles.uploadForm}>
                <div className={styles.uploadZone}>
                  <Upload size={48} color="#667eea" />
                  <p className={styles.uploadText}>
                    {archivoEncuesta 
                      ? `✅ ${archivoEncuesta.name}` 
                      : 'Selecciona un archivo Excel (.xlsx)'}
                  </p>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(e) => setArchivoEncuesta(e.target.files[0])}
                    className={styles.fileInput}
                  />
                  {archivoEncuesta && (
                    <button
                      type="button"
                      onClick={() => setArchivoEncuesta(null)}
                      className={styles.btnClear}
                    >
                      <X size={16} />
                      Limpiar
                    </button>
                  )}
                </div>

                <button 
                  type="submit" 
                  disabled={!archivoEncuesta || loading}
                  className={styles.btnImportar}
                >
                  {loading ? 'Procesando...' : 'Importar Encuestas'}
                </button>
              </form>

              {/* Progreso */}
              {progreso && (
                <div className={`${styles.progreso} ${progreso.error ? styles.progresoError : styles.progresoSuccess}`}>
                  <p>{progreso.mensaje}</p>
                  {progreso.detalles && (
                    <div className={styles.progresoDetalles}>
                      <p>✓ Total procesado: {progreso.detalles.importados}</p>
                      {progreso.detalles.nuevos > 0 && (
                        <p style={{color: '#22c55e'}}>➕ Nuevas encuestas: {progreso.detalles.nuevos}</p>
                      )}
                      {progreso.detalles.actualizados > 0 && (
                        <p style={{color: '#3b82f6'}}>🔄 Actualizadas: {progreso.detalles.actualizados}</p>
                      )}
                      {progreso.detalles.errores && progreso.detalles.errores.length > 0 && (
                        <p style={{color: '#ef4444'}}>⚠ Errores: {progreso.detalles.errores.length}</p>
                      )}
                      
                      {/* Mostrar errores detallados */}
                      {progreso.detalles.errores && progreso.detalles.errores.length > 0 && (
                        <details style={{marginTop: '10px'}}>
                          <summary style={{cursor: 'pointer', fontWeight: 'bold'}}>
                            👉 Ver detalles de errores
                          </summary>
                          <div style={{
                            maxHeight: '300px', 
                            overflow: 'auto', 
                            marginTop: '10px',
                            padding: '10px',
                            background: '#fff',
                            borderRadius: '4px',
                            fontSize: '12px'
                          }}>
                            {progreso.detalles.errores.slice(0, 20).map((err, idx) => (
                              <div key={idx} style={{marginBottom: '5px', borderBottom: '1px solid #eee', paddingBottom: '5px'}}>
                                {err}
                              </div>
                            ))}
                            {progreso.detalles.errores.length > 20 && (
                              <p style={{fontStyle: 'italic', marginTop: '10px'}}>
                                ... y {progreso.detalles.errores.length - 20} errores más
                              </p>
                            )}
                          </div>
                        </details>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Descargar plantilla */}
              <div className={styles.plantilla}>
                <FileText size={20} />
                <span>¿No tienes el formato?</span>
                <button 
                  type="button"
                  className={styles.btnPlantilla}
                  onClick={descargarPlantilla}
                >
                  <Download size={16} />
                  Descargar plantilla de ejemplo
                </button>
              </div>
            </div>
          </div>
        )}


      </div>

      {/* Error global */}
      {error && (
        <div className={styles.errorBanner}>
          <AlertCircle size={20} />
          {error}
        </div>
      )}
    </div>
  )
}
