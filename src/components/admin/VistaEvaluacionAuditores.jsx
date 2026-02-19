'use client'

import { useState, useEffect } from 'react'
import { 
  Upload, FileText, Calculator, Edit3, TrendingUp, 
  Calendar, Filter, Download, RefreshCw, CheckCircle,
  AlertCircle, Eye, ChevronDown, X, Award 
} from 'lucide-react'
import { toast } from 'react-toastify'
import styles from './CSS/VistaEvaluacionAuditores.module.css'

export default function VistaEvaluacionAuditores() {
  // Estado de filtros principales
  const [anioSeleccionado, setAnioSeleccionado] = useState(null)
  const [semestreSeleccionado, setSemestreSeleccionado] = useState(null)
  
  // Años y semestres disponibles (dinámicos desde la BD)
  const [aniosDisponibles, setAniosDisponibles] = useState([])
  const [semestresDisponibles, setSemestresDisponibles] = useState(['S1', 'S2'])
  const [cargandoPeriodos, setCargandoPeriodos] = useState(true)
  
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
  
  // Estado para modal de desglose de archivos
  const [modalArchivosVisible, setModalArchivosVisible] = useState(false)
  const [evaluacionSeleccionadaArchivos, setEvaluacionSeleccionadaArchivos] = useState(null)
  const [archivosEditados, setArchivosEditados] = useState({})
  const [guardandoFechas, setGuardandoFechas] = useState(false)
  
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
  
  // Cargar periodos disponibles al montar el componente
  useEffect(() => {
    cargarPeriodosDisponibles()
  }, [])

  const cargarPeriodosDisponibles = async () => {
    setCargandoPeriodos(true)
    try {
      const res = await fetch('/api/evaluaciones-auditores/periodos-disponibles')
      
      if (!res.ok) {
        throw new Error('Error al cargar periodos disponibles')
      }
      
      const data = await res.json()
      
      setAniosDisponibles(data.anios || [])
      setSemestresDisponibles(data.semestres || ['S1', 'S2'])
      
      // Establecer el periodo más reciente por defecto
      if (data.masReciente) {
        const [anio, semestre] = data.masReciente.split('-')
        setAnioSeleccionado(parseInt(anio))
        setSemestreSeleccionado(semestre)
      } else if (data.anios.length > 0) {
        // Si no hay periodo más reciente, usar el primer año y S1
        setAnioSeleccionado(data.anios[0])
        setSemestreSeleccionado('S2')
      }
    } catch (err) {
      console.error('Error cargando periodos disponibles:', err)
      toast.error('No se pudieron cargar los periodos disponibles')
      // Valores por defecto en caso de error
      const currentYear = new Date().getFullYear()
      setAniosDisponibles([currentYear, currentYear - 1])
      setAnioSeleccionado(currentYear)
      setSemestreSeleccionado('S2')
    } finally {
      setCargandoPeriodos(false)
    }
  }
  
  // Cargar evaluaciones cuando cambian los filtros (solo si ya se cargaron los periodos)
  useEffect(() => {
    if (anioSeleccionado !== null && semestreSeleccionado !== null) {
      cargarEvaluaciones()
    }
  }, [anioSeleccionado, semestreSeleccionado])
  
  const cargarEvaluaciones = async () => {
    // Evitar cargar si aún no se han establecido los filtros
    if (anioSeleccionado === null || semestreSeleccionado === null) {
      return
    }
    
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
    console.log('🔘 BOTÓN CLICKED - recalcularNotasArchivos')
    
    if (anioSeleccionado === null || semestreSeleccionado === null) {
      toast.warning('Selecciona un periodo válido')
      return
    }
    
    if (!evaluaciones || evaluaciones.length === 0) {
      console.log('⚠️ No hay evaluaciones')
      toast.warning('No hay evaluaciones para recalcular')
      return
    }

    console.log(`📊 Evaluaciones disponibles: ${evaluaciones.length}`)
    
    setActualizandoDatos(true)
    console.log('🔄 Iniciando recálculo de archivos...')
    
    try {
      const periodo = `${anioSeleccionado}-${semestreSeleccionado}`
      console.log(`📅 Periodo: ${periodo}`)
      console.log(`📊 Evaluaciones a procesar: ${evaluaciones.length}`)
      
      let exitosos = 0
      let errores = 0
      
      for (const ev of evaluaciones) {
        console.log(`\n🔍 Procesando evaluación de ${ev.auditor_nombre} ${ev.auditor_apellido}...`)
        console.log(`   Auditor ID: ${ev.auditor_id}`)
        console.log(`   Dependencia: ${ev.auditor_dependencia_nombre}`)
        
        try {
          console.log('   📡 Enviando petición a /api/evaluaciones-auditores/calcular-archivos...')
          
          const res = await fetch('/api/evaluaciones-auditores/calcular-archivos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              auditor_id: ev.auditor_id,
              periodo: periodo,
              dependencia_auditada: ev.auditor_dependencia_nombre || ev.dependencia_auditada
            })
          })
          
          console.log(`   📨 Respuesta recibida - Status: ${res.status}`)
          
          if (res.ok) {
            const data = await res.json()
            console.log(`   ✅ Éxito:`, data)
            exitosos++
          } else {
            const errorText = await res.text()
            console.error(`   ❌ Error (${res.status}):`, errorText)
            try {
              const errorData = JSON.parse(errorText)
              console.error(`   Error parseado:`, errorData)
            } catch (e) {
              console.error(`   No se pudo parsear el error`)
            }
            errores++
          }
        } catch (fetchError) {
          console.error(`   💥 Error en fetch:`, fetchError)
          errores++
        }
      }
      
      console.log(`\n📈 Resumen: ${exitosos} exitosos, ${errores} errores`)
      
      if (exitosos > 0) {
        toast.success(`Recálculo completado: ${exitosos} evaluaciones actualizadas`, {
          autoClose: 3000
        })
      }
      
      if (errores > 0) {
        toast.warning(`${errores} evaluaciones tuvieron errores. Revisa la consola.`, {
          autoClose: 5000
        })
      }
      
      // Recargar evaluaciones
      console.log('🔄 Recargando evaluaciones...')
      const res = await fetch(`/api/evaluaciones-auditores?periodo=${periodo}`)
      console.log(`📨 Respuesta carga evaluaciones - Status: ${res.status}`)
      
      if (res.ok) {
        const data = await res.json()
        console.log('📦 Datos recibidos:', data)
        setEvaluaciones(data.evaluaciones || [])
        console.log('✅ Evaluaciones recargadas:', data.evaluaciones?.length)
      } else {
        const errorText = await res.text()
        console.error('❌ Error recargando evaluaciones:', errorText)
      }
    } catch (err) {
      console.error('💥 Error fatal recalculando archivos:', err)
      console.error('Stack:', err.stack)
      toast.error(`Error al recalcular: ${err.message}`, {
        autoClose: 5000
      })
      setError('Error al recalcular notas de archivos')
    } finally {
      console.log('✅ Finalizando proceso...')
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
  
  // Abrir modalcondetalles de archivos
  const mostrarDesgloseArchivos = (evaluacion) => {
    console.log('👁️ Abriendo modal de desglose de archivos')
    console.log('📦 Evaluación seleccionada:', evaluacion)
    console.log('📂 detalle_archivos:', evaluacion.detalle_archivos)
    
    if (evaluacion.detalle_archivos) {
      console.log('📋 Informes:', evaluacion.detalle_archivos.informes)
      if (evaluacion.detalle_archivos.informes && evaluacion.detalle_archivos.informes.length > 0) {
        console.log('📄 Primer informe:', evaluacion.detalle_archivos.informes[0])
        if (evaluacion.detalle_archivos.informes[0].archivos) {
          console.log('📎 Archivos del primer informe:', evaluacion.detalle_archivos.informes[0].archivos)
        }
      }
    } else {
      console.warn('⚠️ No hay detalle_archivos en esta evaluación')
    }
    
    setEvaluacionSeleccionadaArchivos(evaluacion)
    setModalArchivosVisible(true)
  }
  
  // Cerrar modal de archivos
  const cerrarModalArchivos = () => {
    setModalArchivosVisible(false)
    setEvaluacionSeleccionadaArchivos(null)
    setArchivosEditados({})
  }
  
  // Calcular puntos basado en fechas
  const calcularPuntos = (fechaCarga, fechaLimite) => {
    if (!fechaCarga) return 0
    
    const carga = new Date(fechaCarga + 'T00:00:00')
    const limite = new Date(fechaLimite + 'T00:00:00')
    
    const diferenciaMs = carga - limite
    const diasRetraso = Math.ceil(diferenciaMs / (1000 * 60 * 60 * 24))
    
    if (diasRetraso <= 0) {
      return 5
    } else {
      return 1
    }
  }
  
  // Calcular estado basado en fechas
  const calcularEstado = (fechaCarga, fechaLimite) => {
    if (!fechaCarga) return 'No entregado'
    
    const carga = new Date(fechaCarga + 'T00:00:00')
    const limite = new Date(fechaLimite + 'T00:00:00')
    
    const diferenciaMs = carga - limite
    const diasRetraso = Math.ceil(diferenciaMs / (1000 * 60 * 60 * 24))
    
    if (diasRetraso < 0) {
      return `Anticipado (${Math.abs(diasRetraso)} día${Math.abs(diasRetraso) !== 1 ? 's' : ''})`
    } else if (diasRetraso === 0) {
      return 'A tiempo'
    } else {
      return `Tarde (${diasRetraso} día${diasRetraso !== 1 ? 's' : ''})`
    }
  }
  
  // Manejar cambio de fecha de entrega
  const handleFechaEntregaChange = (informeIdx, archivoIdx, nuevaFecha) => {
    const key = `${informeIdx}-${archivoIdx}`
    setArchivosEditados(prev => ({
      ...prev,
      [key]: {
        informeIdx,
        archivoIdx,
        fechaCarga: nuevaFecha
      }
    }))
  }
  
  // Guardar fechas editadas
  const guardarFechasEditadas = async () => {
    if (Object.keys(archivosEditados).length === 0) {
      toast.info('No hay cambios para guardar')
      return
    }
    
    setGuardandoFechas(true)
    
    try {
      // Crear una copia de los informes con las fechas actualizadas
      const informesActualizados = evaluacionSeleccionadaArchivos.detalle_archivos.informes.map((informe, infIdx) => {
        const archivosArray = Array.isArray(informe.archivos) 
          ? informe.archivos 
          : Object.values(informe.archivos || {})
        
        const archivosActualizados = archivosArray.map((archivo, archIdx) => {
          const key = `${infIdx}-${archIdx}`
          if (archivosEditados[key]) {
            const nuevaFechaCarga = archivosEditados[key].fechaCarga
            const nuevaFechaISO = nuevaFechaCarga ? new Date(nuevaFechaCarga + 'T00:00:00').toISOString() : null
            
            // Recalcular puntos y estado
            const puntos = calcularPuntos(nuevaFechaCarga, archivo.fechaLimite?.split('T')[0])
            const estado = calcularEstado(nuevaFechaCarga, archivo.fechaLimite?.split('T')[0])
            
            return {
              ...archivo,
              fechaCarga: nuevaFechaISO,
              fechaCargaFormateada: nuevaFechaCarga ? formatearFechaLocal(nuevaFechaCarga) : null,
              puntos: puntos,
              estado: estado,
              existe: !!nuevaFechaCarga
            }
          }
          return archivo
        })
        
        return {
          ...informe,
          archivos: archivosActualizados
        }
      })
      
      // Calcular nueva nota
      let totalPuntos = 0
      let totalEsperados = 0
      let totalCargados = 0
      
      informesActualizados.forEach(informe => {
        const archivosArray = Array.isArray(informe.archivos) 
          ? informe.archivos 
          : Object.values(informe.archivos || {})
        
        archivosArray.forEach(archivo => {
          totalEsperados++
          totalPuntos += archivo.puntos || 0
          if (archivo.existe) totalCargados++
        })
      })
      
      const nuevaNota = totalEsperados > 0 ? Number((totalPuntos / totalEsperados).toFixed(2)) : 0
      const porcentaje = totalEsperados > 0 ? Math.round((totalCargados / totalEsperados) * 100) : 0
      
      // Guardar en la base de datos
      const res = await fetch('/api/evaluaciones-auditores/actualizar-fechas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          evaluacion_id: evaluacionSeleccionadaArchivos.id,
          detalle_archivos: {
            informes: informesActualizados,
            total_esperados: totalEsperados,
            total_cargados: totalCargados,
            total_puntos: totalPuntos,
            porcentaje: porcentaje
          },
          nota_archivos: nuevaNota,
          archivos_cargados: totalCargados,
          porcentaje_completitud: porcentaje
        })
      })
      
      if (!res.ok) {
        throw new Error('Error al guardar las fechas')
      }
      
      toast.success('Fechas actualizadas correctamente', { autoClose: 2000 })
      
      // Recargar evaluaciones
      const periodo = `${anioSeleccionado}-${semestreSeleccionado}`
      await cargarEvaluaciones()
      
      // Cerrar modal
      cerrarModalArchivos()
      
    } catch (err) {
      console.error('Error guardando fechas:', err)
      toast.error(`Error al guardar: ${err.message}`)
    } finally {
      setGuardandoFechas(false)
    }
  }
  
  // Formatear fecha local
  const formatearFechaLocal = (fecha) => {
    try {
      return new Intl.DateTimeFormat('es-CO', {
        year: 'numeric',
        month: 'short',
        day: '2-digit'
      }).format(new Date(fecha + 'T00:00:00'))
    } catch {
      return fecha
    }
  }

  // Handler para importar encuestas
  const handleImportarEncuestas = async (e) => {
    e.preventDefault()
    
    if (!archivoEncuesta) {
      toast.warning('Por favor selecciona un archivo Excel')
      return
    }

    if (anioSeleccionado === null || semestreSeleccionado === null) {
      toast.warning('Selecciona un periodo válido')
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
      {/* HEADER MODERNO */}
      <div className={styles.modernHeader}>
        <div className={styles.headerContent}>
          <div className={styles.headerLeft}>
            <div className={styles.headerIcon}><Award size={48} /></div>
            <div className={styles.headerInfo}>
              <h1 className={styles.headerTitle}>Evaluación de Auditores</h1>
              <p className={styles.headerSubtitle}>
                Calificación integral basada en archivos, encuestas y rúbrica manual
              </p>
            </div>
          </div>
          <div className={styles.headerRight}>
            {actualizandoDatos && (
              <div className={styles.actualizandoBanner}>
                <div className={styles.spinnerSmall}></div>
                <span>Actualizando notas...</span>
              </div>
            )}
            <button 
              className={styles.modernBtnSecondary} 
              onClick={recalcularNotasArchivos}
              disabled={loading || actualizandoDatos || evaluaciones.length === 0}
              title="Recalcular notas de archivos verificando los buckets de almacenamiento"
            >
              <Calculator size={18} />
              <span>Recalcular Archivos</span>
            </button>
            <button className={styles.modernBtnRefresh} onClick={cargarEvaluaciones}>
              <RefreshCw size={18} />
              <span>Actualizar</span>
            </button>
          </div>
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
              value={anioSeleccionado || ''}
              onChange={(e) => setAnioSeleccionado(Number(e.target.value))}
              className={styles.select}
              disabled={cargandoPeriodos || aniosDisponibles.length === 0}
            >
              {cargandoPeriodos && <option value="">Cargando...</option>}
              {!cargandoPeriodos && aniosDisponibles.length === 0 && (
                <option value="">No hay datos</option>
              )}
              {aniosDisponibles.map(anio => (
                <option key={anio} value={anio}>{anio}</option>
              ))}
            </select>
          </div>

          {/* Selector de Semestre */}
          <div className={styles.filtroItem}>
            <label className={styles.filtroLabel}>
              <Calendar size={16} />
              Semestre
            </label>
            <select
              value={semestreSeleccionado || ''}
              onChange={(e) => setSemestreSeleccionado(e.target.value)}
              className={styles.select}
              disabled={cargandoPeriodos || semestresDisponibles.length === 0}
            >
              {cargandoPeriodos && <option value="">Cargando...</option>}
              {semestresDisponibles.map(sem => (
                <option key={sem} value={sem}>
                  {sem === 'S1' ? 'Semestre 1' : 'Semestre 2'}
                </option>
              ))}
            </select>
          </div>

          {/* Badge del periodo actual */}
          {anioSeleccionado && semestreSeleccionado && (
            <div className={styles.periodoBadge}>
              <span className={styles.periodoTexto}>
                Periodo: {anioSeleccionado}-{semestreSeleccionado}
              </span>
            </div>
          )}
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
                    Las notas de archivos evalúan la entrega oportuna de: Plan, Asistencia, Evaluación, Acta, Acta de Compromiso y Validación.
                    <br/>
                    <strong>Sistema de puntuación:</strong> 5 puntos si se entregó a tiempo, 1 punto si se entregó tarde.
                    <br/>
                    La nota final es el promedio de todos los archivos.
                  </p>
                  <p style={{marginTop: '8px', fontSize: '13px', color: '#64748b'}}>
                    💡 Haz clic en la nota de archivos para ver el desglose completo de entregas.
                  </p>
                </div>
                
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>ID Informe</th>
                      <th>Auditor</th>
                      <th>Dependencia</th>
                      <th>Fecha Auditoría</th>
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
                          {ev.nota_archivos !== null ? (
                            <button
                              onClick={() => mostrarDesgloseArchivos(ev)}
                              style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                transition: 'background 0.2s',
                                fontWeight: '500',
                                color: ev.nota_archivos >= 4 ? '#22c55e' : ev.nota_archivos >= 3 ? '#f59e0b' : '#ef4444'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                              title="Click para ver desglose de archivos"
                            >
                              {ev.nota_archivos.toFixed(2)} 👁️
                            </button>
                          ) : (
                            '-'
                          )}
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

      {/* Modal de Desglose de Archivos */}
      {modalArchivosVisible && evaluacionSeleccionadaArchivos && (
        <div className={styles.modalOverlay} onClick={cerrarModalArchivos}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h2 className={styles.modalTitle}>
                  📂 Desglose de Evaluación de Archivos
                </h2>
                <p className={styles.modalSubtitle}>
                  {evaluacionSeleccionadaArchivos.auditor_nombre} {evaluacionSeleccionadaArchivos.auditor_apellido} - {evaluacionSeleccionadaArchivos.auditor_dependencia_nombre}
                </p>
              </div>
              <button 
                className={styles.modalClose}
                onClick={cerrarModalArchivos}
                title="Cerrar"
              >
                <X size={24} />
              </button>
            </div>

            <div className={styles.modalBody}>
              {evaluacionSeleccionadaArchivos.detalle_archivos?.informes?.length > 0 ? (
                <>
                  {evaluacionSeleccionadaArchivos.detalle_archivos.informes.map((informe, idx) => {
                    // Convertir archivos a array si es un objeto (compatibilidad con formato antiguo)
                    const archivosArray = Array.isArray(informe.archivos) 
                      ? informe.archivos 
                      : Object.values(informe.archivos || {})
                    
                    return (
                    <div key={idx} className={styles.informeCard}>
                      <div className={styles.informeHeader}>
                        <h3>Informe #{informe.informe_id}</h3>
                        <span className={styles.informeFecha}>
                          Auditoría: {informe.fecha_auditoria}
                        </span>
                      </div>

                      <table className={styles.tableArchivos}>
                        <thead>
                          <tr>
                            <th>Documento</th>
                            <th>Fecha Límite</th>
                            <th>Fecha Entrega</th>
                            <th>Estado</th>
                            <th>Puntos</th>
                          </tr>
                        </thead>
                        <tbody>
                          {archivosArray.map((archivo, archIdx) => {
                            const key = `${idx}-${archIdx}`
                            const fechaEditada = archivosEditados[key]
                            const fechaCargaActual = fechaEditada?.fechaCarga || archivo.fechaCarga?.split('T')[0]
                            const fechaLimiteActual = archivo.fechaLimite?.split('T')[0]
                            
                            // Calcular puntos y estado con la fecha editada si existe
                            const puntosActuales = fechaEditada 
                              ? calcularPuntos(fechaCargaActual, fechaLimiteActual)
                              : archivo.puntos
                            const estadoActual = fechaEditada
                              ? calcularEstado(fechaCargaActual, fechaLimiteActual)
                              : archivo.estado
                            
                            return (
                            <tr key={archIdx}>
                              <td>
                                <strong>{archivo.nombre}</strong>
                              </td>
                              <td>
                                <span className={styles.fecha}>
                                  {archivo.fechaLimiteFormateada || '-'}
                                </span>
                              </td>
                              <td>
                                {archivo.existe || fechaEditada ? (
                                  <input
                                    type="date"
                                    value={fechaCargaActual || ''}
                                    onChange={(e) => handleFechaEntregaChange(idx, archIdx, e.target.value)}
                                    style={{
                                      padding: '6px 10px',
                                      border: fechaEditada ? '2px solid #667eea' : '1px solid #e2e8f0',
                                      borderRadius: '6px',
                                      fontSize: '13px',
                                      fontFamily: 'monospace',
                                      background: fechaEditada ? '#eff6ff' : 'white',
                                      cursor: 'pointer',
                                      transition: 'all 0.2s'
                                    }}
                                    title="Haz clic para cambiar la fecha de entrega"
                                  />
                                ) : (
                                  <button
                                    onClick={() => {
                                      const hoy = new Date().toISOString().split('T')[0]
                                      handleFechaEntregaChange(idx, archIdx, hoy)
                                    }}
                                    style={{
                                      padding: '6px 12px',
                                      background: '#22c55e',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '6px',
                                      fontSize: '12px',
                                      cursor: 'pointer',
                                      fontWeight: '500'
                                    }}
                                  >
                                    + Agregar fecha
                                  </button>
                                )}
                              </td>
                              <td>
                                <span className={`${styles.badge} ${
                                  puntosActuales === 5 
                                    ? styles.badgeSuccess 
                                    : puntosActuales === 1 
                                    ? styles.badgeWarning 
                                    : styles.badgeDanger
                                }`}>
                                  {estadoActual || 'No disponible'}
                                  {fechaEditada && <span style={{marginLeft: '4px'}}>✏️</span>}
                                </span>
                              </td>
                              <td>
                                <span style={{
                                  fontWeight: 'bold',
                                  fontSize: '1.1em',
                                  color: puntosActuales === 5 ? '#22c55e' : puntosActuales === 1 ? '#f59e0b' : '#ef4444'
                                }}>
                                  {puntosActuales !== undefined ? `${puntosActuales}/5` : '-'}
                                </span>
                              </td>
                            </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                    )
                  })}

                  <div className={styles.resumenFinal}>
                    <div className={styles.resumenItem}>
                      <span className={styles.resumenLabel}>Total archivos esperados:</span>
                      <span className={styles.resumenValor}>
                        {evaluacionSeleccionadaArchivos.detalle_archivos.total_esperados || 0}
                      </span>
                    </div>
                    <div className={styles.resumenItem}>
                      <span className={styles.resumenLabel}>Archivos entregados:</span>
                      <span className={styles.resumenValor}>
                        {evaluacionSeleccionadaArchivos.detalle_archivos.total_cargados || 0}
                      </span>
                    </div>
                    <div className={styles.resumenItem}>
                      <span className={styles.resumenLabel}>Puntos totales:</span>
                      <span className={styles.resumenValor}>
                        {evaluacionSeleccionadaArchivos.detalle_archivos.total_puntos || 0}
                      </span>
                    </div>
                    <div className={styles.resumenItem} style={{borderTop: '2px solid #e2e8f0', paddingTop: '12px', marginTop: '12px'}}>
                      <span className={styles.resumenLabel} style={{fontSize: '1.1em', fontWeight: 'bold'}}>
                        Nota Final de Archivos:
                      </span>
                      <span className={styles.resumenValor} style={{
                        fontSize: '1.5em',
                        fontWeight: 'bold',
                        color: evaluacionSeleccionadaArchivos.nota_archivos >= 4 
                          ? '#22c55e' 
                          : evaluacionSeleccionadaArchivos.nota_archivos >= 3 
                          ? '#f59e0b' 
                          : '#ef4444'
                      }}>
                        {evaluacionSeleccionadaArchivos.nota_archivos?.toFixed(2) || '0.00'}
                      </span>
                    </div>
                  </div>

                  <div className={styles.infoMetodo}>
                    <AlertCircle size={16} />
                    <span>
                      {evaluacionSeleccionadaArchivos.detalle_archivos.metodo_calculo || 
                       'La nota se calcula como el promedio de puntos obtenidos en todos los archivos'}
                    </span>
                  </div>
                  
                  {/* Botón para guardar cambios */}
                  {Object.keys(archivosEditados).length > 0 && (
                    <div style={{
                      marginTop: '20px',
                      padding: '16px',
                      background: '#eff6ff',
                      border: '2px solid #3b82f6',
                      borderRadius: '8px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div>
                        <strong style={{color: '#1e40af'}}>
                          ✏️ {Object.keys(archivosEditados).length} cambio(s) pendiente(s)
                        </strong>
                        <p style={{margin: '4px 0 0 0', fontSize: '13px', color: '#3b82f6'}}>
                          Las fechas se actualizarán y se recalcularán los puntos automáticamente
                        </p>
                      </div>
                      <div style={{display: 'flex', gap: '10px'}}>
                        <button
                          onClick={() => setArchivosEditados({})}
                          disabled={guardandoFechas}
                          style={{
                            padding: '10px 20px',
                            background: 'white',
                            border: '1px solid #cbd5e1',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: '500',
                            color: '#64748b'
                          }}
                        >
                          Descartar
                        </button>
                        <button
                          onClick={guardarFechasEditadas}
                          disabled={guardandoFechas}
                          style={{
                            padding: '10px 24px',
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: guardandoFechas ? 'not-allowed' : 'pointer',
                            fontSize: '14px',
                            fontWeight: '600',
                            color: 'white',
                            opacity: guardandoFechas ? 0.6 : 1
                          }}
                        >
                          {guardandoFechas ? '⏳ Guardando...' : '💾 Guardar Cambios'}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className={styles.empty}>
                  <AlertCircle size={48} />
                  <p>No hay información de archivos disponible</p>
                  <p className={styles.emptyHint}>
                    Usa el botón "Recalcular Archivos" para generar el desglose
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
