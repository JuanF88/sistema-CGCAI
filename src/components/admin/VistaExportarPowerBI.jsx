'use client'

import { useState, useEffect } from 'react'
import { Download, FileSpreadsheet, AlertCircle } from 'lucide-react'
import { saveAs } from 'file-saver'
import ExcelJS from 'exceljs'
import { toast } from 'react-toastify'
import { supabase } from '@/lib/supabaseClient'
import styles from './CSS/VistaExportarPowerBI.module.css'

const GESTIONES_MAP = {
  'estrategica': 'Gestión Estratégica',
  'academica': 'Gestión Académica',
  'investigacion': 'Gestión de la Investigación',
  'administrativa': 'Gestión Administrativa',
  'cultura': 'Gestión de Cultura y Bienestar',
  'control': 'Gestión de Control',
  'otras': 'Otras / sin clasificar'
}

export default function VistaExportarPowerBI() {
  const [generando, setGenerando] = useState(false)
  const [stats, setStats] = useState(null)
  
  // Nuevos estados para filtros
  const [aniosDisponibles, setAniosDisponibles] = useState([])
  const [semestresDisponibles, setSemestresDisponibles] = useState([])
  const [anioSeleccionado, setAnioSeleccionado] = useState('todos')
  const [semestreSeleccionado, setSemestreSeleccionado] = useState('todos')

  // Obtener años y semestres disponibles
  useEffect(() => {
    const obtenerFiltros = async () => {
      try {
        const { data, error } = await supabase
          .from('informes_auditoria')
          .select('fecha_auditoria')
          .not('fecha_auditoria', 'is', null)
          .order('fecha_auditoria', { ascending: false })

        if (error) throw error

        // Extraer años únicos
        const anios = new Set()
        const semestres = new Map() // Map<año, Set<semestre>>

        data.forEach(item => {
          if (item.fecha_auditoria) {
            const fecha = new Date(item.fecha_auditoria)
            const anio = fecha.getFullYear()
            const mes = fecha.getMonth() + 1
            const semestre = mes <= 6 ? 1 : 2

            anios.add(anio)
            
            if (!semestres.has(anio)) {
              semestres.set(anio, new Set())
            }
            semestres.get(anio).add(semestre)
          }
        })

        setAniosDisponibles(Array.from(anios).sort((a, b) => b - a))
        
        // Convertir el Map a un objeto más fácil de usar
        const semestresObj = {}
        semestres.forEach((sems, anio) => {
          semestresObj[anio] = Array.from(sems).sort()
        })
        setSemestresDisponibles(semestresObj)

      } catch (error) {
        console.error('Error obteniendo filtros:', error)
      }
    }

    obtenerFiltros()
  }, [])

  // Actualizar semestres disponibles cuando cambia el año
  useEffect(() => {
    if (anioSeleccionado === 'todos') {
      setSemestreSeleccionado('todos')
    }
  }, [anioSeleccionado])

  const generarExcelPowerBI = async () => {
    try {
      setGenerando(true)
      
      // Construir mensaje con filtros activos
      let filtrosTexto = ''
      if (anioSeleccionado !== 'todos') {
        filtrosTexto += ` del año ${anioSeleccionado}`
        if (semestreSeleccionado !== 'todos') {
          filtrosTexto += ` (Semestre ${semestreSeleccionado})`
        }
      }
      
      toast.info(`Obteniendo datos de la base de datos${filtrosTexto}...`)

      // Obtener todos los hallazgos con toda la información necesaria
      const res = await fetch('/api/hallazgos')
      if (!res.ok) throw new Error('Error al obtener hallazgos')
      let hallazgos = await res.json()

      if (!hallazgos || hallazgos.length === 0) {
        toast.warning('No hay hallazgos para exportar')
        setGenerando(false)
        return
      }

      // Aplicar filtros de año y semestre
      if (anioSeleccionado !== 'todos' || semestreSeleccionado !== 'todos') {
        hallazgos = hallazgos.filter(hallazgo => {
          const informe = Array.isArray(hallazgo?.informes_auditoria) 
            ? hallazgo.informes_auditoria[0] 
            : hallazgo?.informes_auditoria

          if (!informe?.fecha_auditoria) return false

          const fecha = new Date(informe.fecha_auditoria)
          const anio = fecha.getFullYear()
          const mes = fecha.getMonth() + 1
          const semestre = mes <= 6 ? 1 : 2

          // Filtrar por año
          if (anioSeleccionado !== 'todos' && anio !== parseInt(anioSeleccionado)) {
            return false
          }

          // Filtrar por semestre
          if (semestreSeleccionado !== 'todos' && semestre !== parseInt(semestreSeleccionado)) {
            return false
          }

          return true
        })

        if (hallazgos.length === 0) {
          toast.warning(`No hay hallazgos para los filtros seleccionados${filtrosTexto}`)
          setGenerando(false)
          return
        }
      }

      toast.info('Generando archivo Excel...')

      // Crear workbook
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('DatosISO')

      // Definir columnas
      worksheet.columns = [
        { header: 'ISO', key: 'iso', width: 10 },
        { header: 'Año', key: 'anio', width: 8 },
        { header: 'Hallazgo', key: 'hallazgo', width: 25 },
        { header: 'Dependencia- General', key: 'dependenciaGeneral', width: 30 },
        { header: 'Facultad', key: 'facultad', width: 25 },
        { header: 'Dependencia', key: 'dependencia', width: 35 },
        { header: 'Capítulo', key: 'capitulo', width: 12 },
        { header: 'Requisito ISO', key: 'requisitoISO', width: 15 },
        { header: 'Frecuencia', key: 'frecuencia', width: 12 }
      ]

      // Estilo del encabezado
      worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF667eea' }
      }
      worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' }
      worksheet.getRow(1).height = 25

      // Procesar cada hallazgo
      let totalFilas = 0
      for (const hallazgo of hallazgos) {
        const informe = Array.isArray(hallazgo?.informes_auditoria) 
          ? hallazgo.informes_auditoria[0] 
          : hallazgo?.informes_auditoria

        if (!informe) continue

        // Extraer datos
        const fecha = informe.fecha_auditoria ? new Date(informe.fecha_auditoria) : null
        const anio = fecha ? fecha.getFullYear() : ''
        
        const iso = hallazgo?.iso?.iso || ''
        const tipoHallazgo = hallazgo.tipo || ''
        
        const gestionKey = informe?.dependencias?.gestion || 'otras'
        const dependenciaGeneral = GESTIONES_MAP[gestionKey] || 'Otras / sin clasificar'
        
        const dependenciaNombre = informe?.dependencias?.nombre || ''
        
        // Facultad: podría ser una parte de la dependencia o un campo específico
        // Por ahora lo dejamos vacío o igual a la dependencia
        const facultad = dependenciaNombre
        
        const capitulo = hallazgo?.capitulos?.capitulo || ''
        const numeral = hallazgo?.numerales?.numeral || ''
        
        // Agregar fila
        const row = worksheet.addRow({
          iso,
          anio,
          hallazgo: tipoHallazgo,
          dependenciaGeneral,
          facultad,
          dependencia: dependenciaNombre,
          capitulo,
          requisitoISO: numeral,
          frecuencia: 1
        })

        // Aplicar bordes
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
          }
        })

        totalFilas++
      }

      // Bordes al encabezado
      worksheet.getRow(1).eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF667eea' } },
          left: { style: 'thin', color: { argb: 'FF667eea' } },
          bottom: { style: 'thin', color: { argb: 'FF667eea' } },
          right: { style: 'thin', color: { argb: 'FF667eea' } }
        }
      })

      // Guardar archivo con nombre descriptivo según filtros
      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      })
      
      const fechaActual = new Date().toISOString().split('T')[0]
      let nombreArchivo = `Datos_auditorias_${fechaActual}`
      
      if (anioSeleccionado !== 'todos') {
        nombreArchivo += `_${anioSeleccionado}`
        if (semestreSeleccionado !== 'todos') {
          nombreArchivo += `_S${semestreSeleccionado}`
        }
      }
      
      saveAs(blob, `${nombreArchivo}.xlsx`)

      setStats({
        totalRegistros: totalFilas,
        fecha: new Date().toLocaleString('es-CO'),
        filtros: filtrosTexto || ' (todos los datos)'
      })

      toast.success(`✅ Excel generado exitosamente con ${totalFilas} registros${filtrosTexto}`)
    } catch (error) {
      console.error('Error generando Excel:', error)
      toast.error('Error al generar el archivo Excel')
    } finally {
      setGenerando(false)
    }
  }

  return (
    <div className={styles.container}>
      {/* Header modernizado con filtros */}
      <div className={styles.modernHeader}>
        <div className={styles.headerContent}>
          <div className={styles.headerLeft}>
            <div className={styles.headerIcon}>📊</div>
            <div className={styles.headerInfo}>
              <h1 className={styles.headerTitle}>Exportar Datos para Power BI</h1>
              <p className={styles.headerSubtitle}>
                Genera el archivo Excel con los datos actualizados de la base de datos
              </p>
            </div>
          </div>
          
          {/* Filtros de año y semestre */}
          <div className={styles.headerRight}>
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Año:</label>
              <select 
                className={styles.filterSelect}
                value={anioSeleccionado}
                onChange={(e) => setAnioSeleccionado(e.target.value)}
              >
                <option value="todos">Todos los años</option>
                {aniosDisponibles.map(anio => (
                  <option key={anio} value={anio}>{anio}</option>
                ))}
              </select>
            </div>

            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Semestre:</label>
              <select 
                className={styles.filterSelect}
                value={semestreSeleccionado}
                onChange={(e) => setSemestreSeleccionado(e.target.value)}
                disabled={anioSeleccionado === 'todos'}
              >
                <option value="todos">Ambos semestres</option>
                {anioSeleccionado !== 'todos' && 
                 semestresDisponibles[anioSeleccionado]?.map(sem => (
                  <option key={sem} value={sem}>Semestre {sem}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.content}>
        {/* Card de información */}
        <div className={styles.infoCard}>
          <div className={styles.infoIcon}>
            <AlertCircle size={24} />
          </div>
          <div className={styles.infoText}>
            <h3>¿Cómo funciona?</h3>
            <ol>
              <li>Haz clic en el botón "Generar Excel" para descargar los datos actualizados</li>
              <li>El archivo se generará con el formato requerido por Power BI</li>
              <li>Reemplaza el archivo "Datos auditorias.xlsx" en la carpeta PowerBi con el nuevo archivo</li>
              <li>Abre el archivo .pbix en Power BI Desktop</li>
              <li>Ve a <strong>Inicio → Actualizar</strong> para cargar los nuevos datos</li>
              <li>Publica nuevamente en Power BI Service para ver los cambios en la web</li>
            </ol>
          </div>
        </div>

        {/* Botón de generar */}
        <div className={styles.actionCard}>
          <FileSpreadsheet size={48} className={styles.excelIcon} />
          <h2>Generar Archivo de Datos</h2>
          <p>Exporta todos los hallazgos de auditoría en formato Power BI</p>
          
          <button
            onClick={generarExcelPowerBI}
            disabled={generando}
            className={styles.generateBtn}
          >
            <Download size={20} />
            {generando ? 'Generando Excel...' : 'Generar Excel para Power BI'}
          </button>

          {stats && (
            <div className={styles.statsBox}>
              <p><strong>Última exportación:</strong> {stats.fecha}</p>
              <p><strong>Registros exportados:</strong> {stats.totalRegistros}</p>
              <p><strong>Filtros aplicados:</strong> {stats.filtros}</p>
            </div>
          )}
        </div>

        {/* Card de proceso */}
        <div className={styles.processCard}>
          <h3>Datos incluidos en el archivo:</h3>
          <ul>
            <li><strong>ISO:</strong> Norma ISO del hallazgo</li>
            <li><strong>Año:</strong> Año de la auditoría</li>
            <li><strong>Hallazgo:</strong> Tipo (Fortaleza, Oportunidad de Mejora, No Conformidad)</li>
            <li><strong>Dependencia General:</strong> Tipo de gestión (Estratégica, Académica, etc.)</li>
            <li><strong>Facultad:</strong> Nombre de la dependencia</li>
            <li><strong>Dependencia:</strong> Nombre específico de la dependencia</li>
            <li><strong>Capítulo:</strong> Capítulo de la norma</li>
            <li><strong>Requisito ISO:</strong> Numeral específico</li>
            <li><strong>Frecuencia:</strong> Contador de hallazgos</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
