'use client'

import { useEffect, useMemo, useState } from 'react'
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import { toast } from 'react-toastify'
import { Download } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/ui/search-input'
import { PageHeader } from '@/components/ui/page-header'
import { InfoCard } from '@/components/ui/info-card'
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DataTablePagination } from '@/components/ui/data-table-pagination'
import { usePagination } from '@/components/ui/use-pagination'
import { formatearDia } from '@/lib/fechas'
import {
  PAGE_SHELL,
  STATUS_BADGE_TONES,
  TABLE_CONTAINER,
  TABLE_TOOLBAR,
} from '@/components/ui/tokens'
import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/loader'

const CAPITULO_TITULOS = {
  1: 'NO APLICA',
  2: 'NO APLICA',
  3: 'NO APLICA',
  4: 'FACTOR 1, FACTOR 2, FACTOR 3, FACTOR 4 Y FACTOR 7',
  5: 'FACTOR 12',
  6: 'FACTOR 2',
  7: 'FACTOR 3, FACTOR 10, FACTOR 11',
  8: 'FACTOR 2, FACTOR 3, FACTOR 4, FACTOR 5, FACTOR 6, FACTOR 7, FACTOR 8, FACTOR 8 Y FACTOR 11',
  9: 'FACTOR 2, FACTOR 3, FACTOR 5, FACTOR 7, FACTOR 12, FACTOR 8 Y FACTOR 11',
  10: 'FACTOR 9 Y FACTOR 12',
  11: 'NO APLICA',
  12: 'NO APLICA',
}

const normalize = (s) =>
  (s || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

/**
 * Fecha legible. Pasa por `formatearDia`, que lee la cadena tal cual: con
 * `new Date('2026-09-17')` se interpretaba medianoche UTC y en Bogotá salía el
 * 16, un día antes que en el resto del sistema.
 */
const fmtDate = (value) => formatearDia(value) ?? ''

const formatCapitulo = (cap) => {
  if (cap == null) return ''
  const n = parseInt(String(cap).match(/\d+/)?.[0] ?? Number.NaN, 10)
  if (!Number.isNaN(n) && CAPITULO_TITULOS[n]) {
    return `${n}: ${CAPITULO_TITULOS[n]}`
  }
  return String(cap)
}

/** El aro pequeño y su texto, para la fila de una tabla que está cargando. */
function FilaCargando({ texto }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Spinner size="sm" />
      {texto}
    </span>
  )
}

export default function VistaPlanMejoraAdmin() {
  const [registros, setRegistros] = useState([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [descargando, setDescargando] = useState(false)

  const cargarDatos = async () => {
    try {
      setLoading(true)

      const [informesRes, omRes, ncRes] = await Promise.all([
        supabase
          .from('informes_auditoria')
          .select(`
            id,
            fecha_auditoria,
            usuarios:usuario_id ( nombre, apellido ),
            dependencias:dependencias ( nombre )
          `)
          .order('fecha_auditoria', { ascending: true }),
        supabase
          .from('oportunidades_mejora')
          .select('informe_id, descripcion, capitulo:capitulo_id ( capitulo ), numeral:numeral_id ( numeral )')
          .order('informe_id', { ascending: true }),
        supabase
          .from('no_conformidades')
          .select('informe_id, descripcion, capitulo:capitulo_id ( capitulo ), numeral:numeral_id ( numeral )')
          .order('informe_id', { ascending: true }),
      ])

      if (informesRes.error) throw informesRes.error
      if (omRes.error) throw omRes.error
      if (ncRes.error) throw ncRes.error

      const informes = Array.isArray(informesRes.data) ? informesRes.data : []
      const oportunidades = Array.isArray(omRes.data) ? omRes.data : []
      const noConformidades = Array.isArray(ncRes.data) ? ncRes.data : []

      const omByInforme = oportunidades.reduce((acc, item) => {
        const key = String(item.informe_id)
        if (!acc[key]) acc[key] = []
        acc[key].push(item)
        return acc
      }, {})

      const ncByInforme = noConformidades.reduce((acc, item) => {
        const key = String(item.informe_id)
        if (!acc[key]) acc[key] = []
        acc[key].push(item)
        return acc
      }, {})

      const rows = []
      let pmNumero = 0

      for (const informe of informes) {
        const informeId = String(informe.id)
        const om = omByInforme[informeId] || []
        const nc = ncByInforme[informeId] || []

        if (!om.length && !nc.length) continue

        pmNumero += 1

        const auditor = `${informe.usuarios?.nombre || ''} ${informe.usuarios?.apellido || ''}`.trim() || 'Sin auditor'
        const dependencia = informe.dependencias?.nombre || 'Sin dependencia'
        const fechaAuditoria = informe.fecha_auditoria || null

        for (const item of om) {
          rows.push({
            pm_numero: pmNumero,
            auditor,
            fecha_auditoria: fechaAuditoria,
            dependencia,
            fuente: 'Auditoria interna',
            tipo: 'Oportunidad de Mejora',
            factor: formatCapitulo(item?.capitulo?.capitulo),
            numeral_iso: item?.numeral?.numeral || '',
            descripcion: item.descripcion || '',
          })
        }

        for (const item of nc) {
          rows.push({
            pm_numero: pmNumero,
            auditor,
            fecha_auditoria: fechaAuditoria,
            dependencia,
            fuente: 'Auditoria interna',
            tipo: 'No Conformidad',
            factor: formatCapitulo(item?.capitulo?.capitulo),
            numeral_iso: item?.numeral?.numeral || '',
            descripcion: item.descripcion || '',
          })
        }
      }

      setRegistros(rows)
    } catch (error) {
      console.error('Error cargando PM general:', error)
      toast.error(error?.message || 'No se pudo cargar el plan de mejora general.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargarDatos()
  }, [])

  const registrosVista = useMemo(() => {
    const q = normalize(busqueda)
    if (!q) return registros

    return registros.filter((row) =>
      [
        row.pm_numero,
        row.auditor,
        row.fecha_auditoria,
        row.dependencia,
        row.fuente,
        row.tipo,
        row.factor,
        row.numeral_iso,
        row.descripcion,
      ].some((value) => normalize(value).includes(q))
    )
  }, [registros, busqueda])

  const stats = useMemo(() => {
    const totalHallazgos = registros.length
    const totalPlanes = new Set(registros.map((r) => r.pm_numero)).size
    const totalOm = registros.filter((r) => r.tipo === 'Oportunidad de Mejora').length
    const totalNc = registros.filter((r) => r.tipo === 'No Conformidad').length
    return { totalHallazgos, totalPlanes, totalOm, totalNc }
  }, [registros])

  const descargarExcel = async () => {
    if (!registros.length) {
      toast.info('No hay datos para exportar.')
      return
    }

    try {
      setDescargando(true)

      const wb = new ExcelJS.Workbook()
      const ws = wb.addWorksheet('Plan de mejora general')

      ws.columns = [
        { header: 'PM #', key: 'pm_numero', width: 10 },
        { header: 'Auditor', key: 'auditor', width: 28 },
        { header: 'Fecha auditoria', key: 'fecha_auditoria', width: 16 },
        { header: 'Dependencia', key: 'dependencia', width: 30 },
        { header: 'Fuente', key: 'fuente', width: 18 },
        { header: 'Tipo', key: 'tipo', width: 24 },
        { header: 'Factor', key: 'factor', width: 55 },
        { header: 'Numeral ISO', key: 'numeral_iso', width: 18 },
        { header: 'Descripcion', key: 'descripcion', width: 70 },
      ]

      ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
      ws.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF667EEA' },
      }
      ws.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' }
      ws.getRow(1).height = 24

      for (const row of registros) {
        const excelRow = ws.addRow({
          ...row,
          fecha_auditoria: fmtDate(row.fecha_auditoria),
        })

        excelRow.alignment = { vertical: 'top', wrapText: true }
        excelRow.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          }
        })
      }

      ws.getRow(1).eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF667EEA' } },
          left: { style: 'thin', color: { argb: 'FF667EEA' } },
          bottom: { style: 'thin', color: { argb: 'FF667EEA' } },
          right: { style: 'thin', color: { argb: 'FF667EEA' } },
        }
      })

      const buffer = await wb.xlsx.writeBuffer()
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const stamp = new Date().toISOString().slice(0, 10)
      saveAs(blob, `PlanMejora_General_${stamp}.xlsx`)
      toast.success('Plan de mejora general descargado.')
    } catch (error) {
      console.error('Error exportando PM general:', error)
      toast.error('No se pudo descargar el archivo.')
    } finally {
      setDescargando(false)
    }
  }

  const paginacion = usePagination(registrosVista, 30)

  return (
    <div className={PAGE_SHELL}>
      <PageHeader
        title="Plan de Mejora General"
        subtitle="Consolidado de Oportunidades de Mejora y No Conformidades por auditoría"
        actions={
          <Button
            onClick={descargarExcel}
            disabled={descargando || loading}
            className="bg-white/15 text-white shadow-none backdrop-blur-sm hover:bg-white/25"
          >
            <Download />
            {descargando ? 'Generando…' : 'Descargar PM General'}
          </Button>
        }
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <InfoCard tone="blue" label="Planes generados" value={stats.totalPlanes} />
        <InfoCard tone="green" label="Hallazgos totales" value={stats.totalHallazgos} />
        <InfoCard tone="cyan" label="Oportunidades" value={stats.totalOm} />
        <InfoCard tone="orange" label="No conformidades" value={stats.totalNc} />
      </section>

      <section className={TABLE_CONTAINER}>
        <div className={TABLE_TOOLBAR}>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">Listado consolidado PM</h3>
            <Badge variant="secondary">{registrosVista.length} registros</Badge>
          </div>

          <SearchInput
            value={busqueda}
            onChange={setBusqueda}
            placeholder="Buscar por PM, auditor, dependencia, tipo, factor o descripción…"
            className="sm:w-96"
          />
        </div>

        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-24">PM #</TableHead>
              <TableHead>Auditor</TableHead>
              <TableHead>Dependencia</TableHead>
              <TableHead className="w-44">Tipo</TableHead>
              <TableHead>Factor</TableHead>
              <TableHead className="w-36">Numeral ISO</TableHead>
              <TableHead>Descripción</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {loading && <TableEmpty colSpan={7}>
                <FilaCargando texto="Cargando plan de mejora general…" />
              </TableEmpty>}

            {!loading && paginacion.total === 0 && (
              <TableEmpty colSpan={7}>
                No hay hallazgos OM/NC para generar planes de mejora.
              </TableEmpty>
            )}

            {!loading &&
              paginacion.pageItems.map((row) => (
                <TableRow key={`${row.pm_numero}-${row.tipo}-${row.descripcion?.slice(0, 24)}`}>
                  <TableCell>
                    <Badge variant="secondary" className="tabular-nums">
                      PM-{row.pm_numero}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{row.auditor}</TableCell>
                  <TableCell className="text-muted-foreground">{row.dependencia}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn(
                        STATUS_BADGE_TONES[row.tipo === 'No Conformidad' ? 'danger' : 'info']
                      )}
                    >
                      {row.tipo}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.factor || 'Sin factor'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{row.numeral_iso || 'Sin numeral'}</Badge>
                  </TableCell>
                  <TableCell className="max-w-md text-muted-foreground">
                    {row.descripcion || 'Sin descripción'}
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>

        <DataTablePagination pagination={paginacion} etiqueta="registros" />
      </section>
    </div>
  )
}
