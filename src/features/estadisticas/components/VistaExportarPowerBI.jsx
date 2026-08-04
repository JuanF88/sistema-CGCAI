'use client'

import { useState, useEffect } from 'react'
import { Download, FileSpreadsheet, AlertCircle } from 'lucide-react'
import { saveAs } from 'file-saver'
import ExcelJS from 'exceljs'
import { toast } from 'react-toastify'
import { supabase } from '@/lib/supabase/client'
import { listarHallazgos } from '@/features/hallazgos/api/hallazgos-api'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/ui/page-header'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PAGE_SHELL, SECTION_CARD } from '@/components/ui/tokens'
import { cn } from '@/lib/utils'

/** Pasos para refrescar el informe de Power BI con el archivo generado. */
const PASOS = [
  'Haz clic en «Generar Excel» para descargar los datos actualizados.',
  'El archivo se genera con el formato que espera Power BI.',
  'Reemplaza «Datos auditorias.xlsx» en la carpeta PowerBi con el nuevo archivo.',
  'Abre el archivo .pbix en Power BI Desktop.',
  'Ve a Inicio → Actualizar para cargar los nuevos datos.',
  'Publica de nuevo en Power BI Service para verlo en la web.',
]

/** Columnas que lleva el archivo exportado. */
const COLUMNAS = [
  ['ISO', 'Norma ISO del hallazgo'],
  ['Año', 'Año de la auditoría'],
  ['Hallazgo', 'Tipo: fortaleza, oportunidad de mejora o no conformidad'],
  ['Dependencia General', 'Tipo de gestión (estratégica, académica…)'],
  ['Facultad', 'Nombre de la dependencia'],
  ['Dependencia', 'Nombre específico de la dependencia'],
  ['Capítulo', 'Capítulo de la norma'],
  ['Requisito ISO', 'Numeral específico'],
  ['Frecuencia', 'Contador de hallazgos'],
]

const GESTIONES_MAP = {
  'estrategica': 'Gestión Estratégica',
  'academica': 'Gestión Académica',
  'investigacion': 'Gestión de Investigación, Innovación e Interacción Social',
  'administrativa': 'Gestión Administrativa',
  'cultura': 'Gestión de Cultura y Bienestar',
  'control': 'Gestión de Control y Mejoramiento Continuo',
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
      let hallazgos = await listarHallazgos()

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
    <div className={PAGE_SHELL}>
      <PageHeader
        icon="📊"
        title="Exportar Datos para Power BI"
        subtitle="Genera el archivo Excel con los datos actualizados de la base de datos"
        actions={
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="exp-anio" className="text-xs text-white/80">
                Año
              </Label>
              <Select value={anioSeleccionado} onValueChange={setAnioSeleccionado}>
                <SelectTrigger id="exp-anio" className="w-40 border-white/25 bg-white/15 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los años</SelectItem>
                  {aniosDisponibles.map((anio) => (
                    <SelectItem key={anio} value={String(anio)}>
                      {anio}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="exp-semestre" className="text-xs text-white/80">
                Semestre
              </Label>
              <Select
                value={semestreSeleccionado}
                onValueChange={setSemestreSeleccionado}
                disabled={anioSeleccionado === 'todos'}
              >
                <SelectTrigger
                  id="exp-semestre"
                  className="w-44 border-white/25 bg-white/15 text-white"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Ambos semestres</SelectItem>
                  {anioSeleccionado !== 'todos' &&
                    semestresDisponibles[anioSeleccionado]?.map((sem) => (
                      <SelectItem key={sem} value={String(sem)}>
                        Semestre {sem}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Cómo funciona */}
        <article className={cn(SECTION_CARD, 'p-5 lg:col-span-2')}>
          <header className="mb-3 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-primary" />
            <h3 className="text-sm font-semibold">¿Cómo funciona?</h3>
          </header>
          <ol className="ml-5 list-decimal space-y-1.5 text-sm text-muted-foreground">
            {PASOS.map((paso) => (
              <li key={paso}>{paso}</li>
            ))}
          </ol>
        </article>

        {/* Acción principal */}
        <article className={cn(SECTION_CARD, 'flex flex-col items-center gap-3 p-6 text-center')}>
          <FileSpreadsheet className="h-12 w-12 text-emerald-600" />
          <h2 className="text-base font-semibold">Generar archivo de datos</h2>
          <p className="text-sm text-muted-foreground">
            Exporta todos los hallazgos de auditoría en formato Power BI.
          </p>

          <Button onClick={generarExcelPowerBI} disabled={generando} size="lg" className="w-full">
            <Download />
            {generando ? 'Generando Excel…' : 'Generar Excel'}
          </Button>

          {stats && (
            <dl className="w-full space-y-1 rounded-lg bg-muted/50 p-3 text-left text-xs text-muted-foreground">
              <div className="flex justify-between gap-2">
                <dt className="font-medium text-foreground">Última exportación</dt>
                <dd>{stats.fecha}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="font-medium text-foreground">Registros</dt>
                <dd className="tabular-nums">{stats.totalRegistros}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="font-medium text-foreground">Filtros</dt>
                <dd className="text-right">{stats.filtros}</dd>
              </div>
            </dl>
          )}
        </article>
      </div>

      {/* Columnas del archivo */}
      <article className={cn(SECTION_CARD, 'p-5')}>
        <h3 className="mb-3 text-sm font-semibold">Datos incluidos en el archivo</h3>
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {COLUMNAS.map(([nombre, descripcion]) => (
            <div key={nombre} className="flex flex-col">
              <dt className="font-semibold text-foreground">{nombre}</dt>
              <dd className="text-xs text-muted-foreground">{descripcion}</dd>
            </div>
          ))}
        </dl>
      </article>
    </div>
  )
}
