'use client'

import { useState, useEffect } from 'react'
import { Download } from 'lucide-react'
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

const GESTIONES_MAP = {
  'estrategica': 'Gestión Estratégica',
  'academica': 'Gestión Académica',
  'investigacion': 'Gestión de Investigación, Innovación e Interacción Social',
  'administrativa': 'Gestión Administrativa',
  'cultura': 'Gestión de Cultura y Bienestar',
  'control': 'Gestión de Control y Mejoramiento Continuo',
  'otras': 'Otras / sin clasificar'
}

export default function VistaPowerBI({ hideMainHeader = false }) {
  const [generando, setGenerando] = useState(false)
  
  // Estados para filtros
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

        const anios = new Set()
        const semestres = new Map()

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

  // Actualizar semestres cuando cambia el año
  useEffect(() => {
    if (anioSeleccionado === 'todos') {
      setSemestreSeleccionado('todos')
    }
  }, [anioSeleccionado])

  const generarExcelPowerBI = async () => {
    try {
      setGenerando(true)
      
      let filtrosTexto = ''
      if (anioSeleccionado !== 'todos') {
        filtrosTexto += ` del año ${anioSeleccionado}`
        if (semestreSeleccionado !== 'todos') {
          filtrosTexto += ` (Semestre ${semestreSeleccionado})`
        }
      }
      
      toast.info(`Obteniendo datos de la base de datos${filtrosTexto}...`)

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

          if (anioSeleccionado !== 'todos' && anio !== parseInt(anioSeleccionado)) {
            return false
          }

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

      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('DatosISO')

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

      worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF667eea' }
      }
      worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' }
      worksheet.getRow(1).height = 25

      let totalFilas = 0
      for (const hallazgo of hallazgos) {
        const informe = Array.isArray(hallazgo?.informes_auditoria) 
          ? hallazgo.informes_auditoria[0] 
          : hallazgo?.informes_auditoria

        if (!informe) continue

        const fecha = informe.fecha_auditoria ? new Date(informe.fecha_auditoria) : null
        const anio = fecha ? fecha.getFullYear() : ''
        const iso = hallazgo?.iso?.iso || ''
        const tipoHallazgo = hallazgo.tipo || ''
        const gestionKey = informe?.dependencias?.gestion || 'otras'
        const dependenciaGeneral = GESTIONES_MAP[gestionKey] || 'Otras / sin clasificar'
        const dependenciaNombre = informe?.dependencias?.nombre || ''
        const facultad = dependenciaNombre
        const capitulo = hallazgo?.capitulos?.capitulo || ''
        const numeral = hallazgo?.numerales?.numeral || ''

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

      worksheet.getRow(1).eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF667eea' } },
          left: { style: 'thin', color: { argb: 'FF667eea' } },
          bottom: { style: 'thin', color: { argb: 'FF667eea' } },
          right: { style: 'thin', color: { argb: 'FF667eea' } }
        }
      })

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

      toast.success(`✅ Excel generado exitosamente con ${totalFilas} registros${filtrosTexto}`)
    } catch (error) {
      console.error('Error generando Excel:', error)
      toast.error('Error al generar el archivo Excel')
    } finally {
      setGenerando(false)
    }
  }

  // Los filtros y el botón de exportar van fuera del header: antes vivían
  // dentro y con `hideMainHeader` (que es como se usa desde el panel de
  // Estadísticas) desaparecían, dejando la exportación inalcanzable.
  const barraFiltros = (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pbi-anio" className="text-xs text-muted-foreground">
          Año
        </Label>
        <Select value={anioSeleccionado} onValueChange={setAnioSeleccionado}>
          <SelectTrigger id="pbi-anio" className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            {aniosDisponibles.map((anio) => (
              <SelectItem key={anio} value={String(anio)}>
                {anio}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pbi-semestre" className="text-xs text-muted-foreground">
          Semestre
        </Label>
        <Select
          value={semestreSeleccionado}
          onValueChange={setSemestreSeleccionado}
          disabled={anioSeleccionado === 'todos'}
        >
          <SelectTrigger id="pbi-semestre" className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Ambos</SelectItem>
            {anioSeleccionado !== 'todos' &&
              semestresDisponibles[anioSeleccionado]?.map((sem) => (
                <SelectItem key={sem} value={String(sem)}>
                  Sem. {sem}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      <Button onClick={generarExcelPowerBI} disabled={generando}>
        <Download />
        {generando ? 'Generando…' : 'Actualizar datos'}
      </Button>
    </div>
  )

  return (
    <div className={PAGE_SHELL}>
      {!hideMainHeader && (
        <PageHeader
          title="Estadísticas Power BI"
          subtitle="Dashboard interactivo de análisis de auditorías"
        />
      )}

      <div className={cn(SECTION_CARD, 'p-4')}>{barraFiltros}</div>

      {/* Contenedor del Power BI */}
      <div className={cn(SECTION_CARD, 'overflow-hidden')}>
        <iframe
          title="Nuevo Dashboard - Normalizado"
          className="h-[calc(100vh-320px)] min-h-[560px] w-full border-0"
          src="https://app.powerbi.com/view?r=eyJrIjoiZGQ2YjljYWMtZWNlNS00ZmQzLWE1NWEtYjA1YjMxNzAwM2FhIiwidCI6ImU4MjE0OTM3LTIzM2ItNGIzNi04NmJmLTBiNWYzMzM3YmVlMSIsImMiOjF9"
          allowFullScreen
        />
      </div>
    </div>
  )
}
