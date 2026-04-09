'use client'

import { useEffect, useMemo, useState } from 'react'
import DataTable from 'react-data-table-component'
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import { toast } from 'react-toastify'
import { Download, Search, FilterX } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import styles from './CSS/VistaPlanMejoraAdmin.module.css'

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

const fmtDate = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('es-CO')
}

const formatCapitulo = (cap) => {
  if (cap == null) return ''
  const n = parseInt(String(cap).match(/\d+/)?.[0] ?? Number.NaN, 10)
  if (!Number.isNaN(n) && CAPITULO_TITULOS[n]) {
    return `${n}: ${CAPITULO_TITULOS[n]}`
  }
  return String(cap)
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

  const columnas = [
    {
      name: 'PM #',
      selector: (row) => row.pm_numero,
      sortable: true,
      width: '90px',
      cell: (row) => <span className={styles.pmPill}>PM-{row.pm_numero}</span>,
    },
    {
      name: 'Auditor',
      selector: (row) => row.auditor,
      sortable: true,
      grow: 1.2,
      cell: (row) => <span className={styles.primaryLine}>{row.auditor}</span>,
    },
    {
      name: 'Dependencia',
      selector: (row) => row.dependencia,
      sortable: true,
      grow: 1.3,
      cell: (row) => <span className={styles.areaText}>{row.dependencia}</span>,
    },
    {
      name: 'Tipo',
      selector: (row) => row.tipo,
      sortable: true,
      cell: (row) => (
        <span className={`${styles.badge} ${row.tipo === 'No Conformidad' ? styles.badgeNc : styles.badgeOm}`}>
          {row.tipo}
        </span>
      ),
    },
    {
      name: 'Factor',
      selector: (row) => row.factor,
      sortable: true,
      grow: 1.9,
      cell: (row) => <span className={styles.factorText}>{row.factor || 'Sin factor'}</span>,
    },
    {
      name: 'Numeral ISO',
      selector: (row) => row.numeral_iso || '',
      sortable: true,
      width: '150px',
      cell: (row) => <span className={styles.numeralPill}>{row.numeral_iso || 'Sin numeral'}</span>,
    },
    {
      name: 'Descripcion',
      selector: (row) => row.descripcion,
      sortable: true,
      grow: 2.1,
      cell: (row) => <span className={styles.descText}>{row.descripcion || 'Sin descripcion'}</span>,
    },
  ]

  return (
    <div className={styles.container}>
      <div className={styles.modernHeader}>
        <div className={styles.headerContent}>
          <div className={styles.headerLeft}>
            <div className={styles.headerIcon}>📄</div>
            <div className={styles.headerInfo}>
              <h1 className={styles.headerTitle}>Plan de Mejora General</h1>
              <p className={styles.headerSubtitle}>Consolidado de Oportunidades de Mejora y No Conformidades por auditoria</p>
            </div>
          </div>
          <div className={styles.headerRight}>
            <button className={styles.modernActionBtn} onClick={descargarExcel} disabled={descargando || loading}>
              <Download size={16} />
              <span>{descargando ? 'Generando...' : 'Descargar PM General'}</span>
            </button>
          </div>
        </div>
      </div>

      <div className={styles.kpiGrid}>
        <div className={`${styles.kpiCard} ${styles.kpiCardBlue}`}>
          <div className={styles.kpiIcon}>🗂️</div>
          <div className={styles.kpiContent}>
            <div className={styles.kpiLabel}>Planes Generados</div>
            <div className={styles.kpiValue}>{stats.totalPlanes}</div>
          </div>
        </div>
        <div className={`${styles.kpiCard} ${styles.kpiCardGreen}`}>
          <div className={styles.kpiIcon}>🧩</div>
          <div className={styles.kpiContent}>
            <div className={styles.kpiLabel}>Hallazgos Totales</div>
            <div className={styles.kpiValue}>{stats.totalHallazgos}</div>
          </div>
        </div>
        <div className={`${styles.kpiCard} ${styles.kpiCardCyan}`}>
          <div className={styles.kpiIcon}>✅</div>
          <div className={styles.kpiContent}>
            <div className={styles.kpiLabel}>Oportunidades</div>
            <div className={styles.kpiValue}>{stats.totalOm}</div>
          </div>
        </div>
        <div className={`${styles.kpiCard} ${styles.kpiCardOrange}`}>
          <div className={styles.kpiIcon}>⚠️</div>
          <div className={styles.kpiContent}>
            <div className={styles.kpiLabel}>No Conformidades</div>
            <div className={styles.kpiValue}>{stats.totalNc}</div>
          </div>
        </div>
      </div>

      <div className={styles.tableCard}>
        <div className={styles.tableHeader}>
          <div className={styles.tableTitleWrap}>
            <h3 className={styles.tableTitle}>Listado Consolidado PM</h3>
            <span className={styles.tableCountChip}>{registrosVista.length} registros</span>
          </div>
          <div className={styles.searchBox}>
            <Search size={16} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Buscar por PM, auditor, dependencia, tipo, factor o descripcion..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className={styles.searchInput}
            />
            {busqueda && (
              <button onClick={() => setBusqueda('')} className={styles.clearBtn} title="Limpiar filtro">
                <FilterX size={14} />
              </button>
            )}
          </div>
        </div>

        <div className={styles.tableWrapper}>
          <DataTable
            columns={columnas}
            data={registrosVista}
            progressPending={loading}
            progressComponent={<div className={styles.loadingBox}>Cargando plan de mejora general...</div>}
            pagination
            paginationPerPage={30}
            paginationRowsPerPageOptions={[30, 50, 100]}
            defaultSortFieldId={1}
            highlightOnHover
            responsive
            noDataComponent="No hay hallazgos OM/NC para generar planes de mejora."
            customStyles={{
              table: {
                style: {
                  backgroundColor: '#ffffff',
                },
              },
              headRow: {
                style: {
                  minHeight: '54px',
                  background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
                  borderBottom: '1px solid #dbe6f6',
                  fontWeight: '700',
                  fontSize: '12px',
                  color: '#334155',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                },
              },
              headCells: {
                style: {
                  paddingLeft: '14px',
                  paddingRight: '14px',
                },
              },
              rows: {
                style: {
                  minHeight: '62px',
                  fontSize: '14px',
                  color: '#1e293b',
                  borderBottom: '1px solid #eef2f7',
                  '&:hover': {
                    backgroundColor: '#f8fbff',
                  },
                },
              },
              cells: {
                style: {
                  paddingLeft: '14px',
                  paddingRight: '14px',
                },
              },
              pagination: {
                style: {
                  borderTop: '1px solid #e5edf7',
                  padding: '8px 12px',
                  fontSize: '13px',
                  color: '#475569',
                },
                pageButtonsStyle: {
                  borderRadius: '10px',
                  height: '32px',
                  width: '32px',
                  padding: 0,
                  margin: '0 2px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  color: '#1e40af',
                  fill: '#1e40af',
                  backgroundColor: '#eff6ff',
                },
              },
            }}
          />
        </div>
      </div>
    </div>
  )
}
