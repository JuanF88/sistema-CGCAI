'use client'

import { useEffect, useMemo, useState } from 'react'

import { listarAuditores } from '@/features/usuarios/api/usuarios-api'
import {
  listarEvaluaciones,
  listarPeriodosDisponibles,
  obtenerDashboardAuditor,
} from '@/features/evaluaciones/api/evaluaciones-api'
import DashboardConsolidadoGeneral from '@/features/evaluaciones/components/DashboardConsolidadoGeneral'
import DashboardDetalleAuditor from '@/features/evaluaciones/components/DashboardDetalleAuditor'

import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/ui/page-header'
import { SearchInput } from '@/components/ui/search-input'
import { ViewToggle } from '@/components/ui/view-toggle'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PAGE_SHELL, SECTION_CARD } from '@/components/ui/tokens'
import { anioPorDefecto } from '@/lib/fechas/anio'
import { useAnioInicial } from '@/hooks/useAnioInicial'
import { cn } from '@/lib/utils'
import { Cargando } from '@/components/ui/loader'

const MODOS = [
  { key: 'general', label: 'Consolidado general' },
  { key: 'auditor', label: 'Por auditor' },
]

const DEFAULT_AVATAR = '/avatares/Silueta.png'

const sanitizePrefix = (s = '') => {
  return String(s).trim().toLowerCase().replace(/[^a-z0-9._-]/g, '')
}

const getAvatarSrc = (email = '') => {
  const prefix = sanitizePrefix(email?.split('@')?.[0] || '')
  if (!prefix) return DEFAULT_AVATAR
  return `/avatares/${prefix}.png`
}

export default function VistaDashboardAuditores() {
  const [modoVista, setModoVista] = useState('general')
  const [auditores, setAuditores] = useState([])
  const [search, setSearch] = useState('')
  const [selectedAuditorId, setSelectedAuditorId] = useState('')
  const [dashboard, setDashboard] = useState(null)
  const [anioFiltro, setAnioFiltro] = useState('todos')
  const [aniosGenerales, setAniosGenerales] = useState([])
  const [anioGeneral, setAnioGeneral] = useState(String(new Date().getFullYear()))
  const [resumenGeneral, setResumenGeneral] = useState(null)
  const [loadingAuditores, setLoadingAuditores] = useState(true)
  const [loadingDashboard, setLoadingDashboard] = useState(false)
  const [loadingGeneral, setLoadingGeneral] = useState(false)
  const [error, setError] = useState('')
  const [avatarSrc, setAvatarSrc] = useState(DEFAULT_AVATAR)

  useEffect(() => {
    const loadAuditores = async () => {
      setLoadingAuditores(true)
      setError('')
      try {
        const data = await listarAuditores()

        const auditoresActivos = (Array.isArray(data) ? data : [])
          .filter((auditor) => auditor?.auth_user_id)
          .sort((a, b) => `${a.nombre || ''} ${a.apellido || ''}`.localeCompare(`${b.nombre || ''} ${b.apellido || ''}`))

        setAuditores(auditoresActivos)
        setSelectedAuditorId((prev) => prev || auditoresActivos[0]?.auth_user_id || '')
      } catch (err) {
        console.error('Error cargando auditores:', err)
        setError(err.message || 'Error cargando auditores')
      } finally {
        setLoadingAuditores(false)
      }
    }

    loadAuditores()
  }, [])

  useEffect(() => {
    const loadAniosDisponibles = async () => {
      try {
        const data = await listarPeriodosDisponibles()

        const anios = Array.isArray(data?.anios) ? data.anios.map((item) => String(item)) : []
        setAniosGenerales(anios)
        if (anios.length) {
          // Si el año que ya estaba elegido sigue teniendo datos se respeta;
          // si no, el actual, y en su defecto el más reciente.
          setAnioGeneral((prev) =>
            anios.includes(prev) ? prev : String(anioPorDefecto(anios, { sinDatos: prev }))
          )
        }
      } catch {
        setAniosGenerales([])
      }
    }

    loadAniosDisponibles()
  }, [])

  useEffect(() => {
    if (!anioGeneral) {
      setResumenGeneral(null)
      return
    }

    const loadGeneral = async () => {
      setLoadingGeneral(true)
      setError('')
      try {
        const data = await listarEvaluaciones({ anio: anioGeneral })

        const evaluaciones = Array.isArray(data?.evaluaciones) ? data.evaluaciones : []
        const porAuditorMap = new Map()
        const estados = { completa: 0, borrador: 0, sin_evaluacion: 0 }
        const acumulados = {
          archivos: { suma: 0, cantidad: 0 },
          encuesta: { suma: 0, cantidad: 0 },
          rubrica: { suma: 0, cantidad: 0 },
          final: { suma: 0, cantidad: 0 },
        }

        evaluaciones.forEach((item) => {
          const auditorKey = String(item.auditor_id || item.auditor_email || 'sin-auditor')
          const auditorNombre = `${item.auditor_nombre || ''} ${item.auditor_apellido || ''}`.trim() || 'Sin nombre'

          if (!porAuditorMap.has(auditorKey)) {
            porAuditorMap.set(auditorKey, {
              auditor_id: auditorKey,
              nombre: auditorNombre,
              email: item.auditor_email || 'Sin correo',
              total: 0,
              sumaFinal: 0,
              notasFinales: 0,
              mejorNota: null,
            })
          }

          const auditor = porAuditorMap.get(auditorKey)
          auditor.total += 1

          if (typeof item.nota_final === 'number') {
            auditor.sumaFinal += item.nota_final
            auditor.notasFinales += 1
            auditor.mejorNota = auditor.mejorNota == null ? item.nota_final : Math.max(auditor.mejorNota, item.nota_final)

            acumulados.final.suma += item.nota_final
            acumulados.final.cantidad += 1
          }

          if (typeof item.nota_archivos === 'number') {
            acumulados.archivos.suma += item.nota_archivos
            acumulados.archivos.cantidad += 1
          }

          if (typeof item.nota_encuesta === 'number') {
            acumulados.encuesta.suma += item.nota_encuesta
            acumulados.encuesta.cantidad += 1
          }

          if (typeof item.nota_rubrica === 'number') {
            acumulados.rubrica.suma += item.nota_rubrica
            acumulados.rubrica.cantidad += 1
          }

          const estado = item.estado || 'sin_evaluacion'
          if (estado === 'completa' || estado === 'borrador') {
            estados[estado] += 1
          } else {
            estados.sin_evaluacion += 1
          }
        })

        const rankingAuditores = Array.from(porAuditorMap.values())
          .map((item) => ({
            ...item,
            promedioFinal: item.notasFinales
              ? Number((item.sumaFinal / item.notasFinales).toFixed(2))
              : null,
          }))
          .sort((a, b) => {
            const promedioA = typeof a.promedioFinal === 'number' ? a.promedioFinal : -1
            const promedioB = typeof b.promedioFinal === 'number' ? b.promedioFinal : -1
            if (promedioB !== promedioA) return promedioB - promedioA
            return b.total - a.total
          })

        const notasFinales = evaluaciones.filter((item) => typeof item.nota_final === 'number')
        const promedioGeneral = notasFinales.length
          ? Number((notasFinales.reduce((acc, item) => acc + item.nota_final, 0) / notasFinales.length).toFixed(2))
          : null

        const promediosGlobales = {
          archivos: acumulados.archivos.cantidad
            ? Number((acumulados.archivos.suma / acumulados.archivos.cantidad).toFixed(2))
            : null,
          encuesta: acumulados.encuesta.cantidad
            ? Number((acumulados.encuesta.suma / acumulados.encuesta.cantidad).toFixed(2))
            : null,
          rubrica: acumulados.rubrica.cantidad
            ? Number((acumulados.rubrica.suma / acumulados.rubrica.cantidad).toFixed(2))
            : null,
          final: acumulados.final.cantidad
            ? Number((acumulados.final.suma / acumulados.final.cantidad).toFixed(2))
            : null,
        }

        setResumenGeneral({
          anio: anioGeneral,
          totalAuditorias: evaluaciones.length,
          auditoresEvaluados: rankingAuditores.length,
          promedioGeneral,
          promediosGlobales,
          totalCompletas: estados.completa,
          totalBorrador: estados.borrador,
          totalSinEvaluacion: estados.sin_evaluacion,
          rankingAuditores,
        })
      } catch (err) {
        setError(err.message || 'No se pudo cargar el consolidado general')
        setResumenGeneral(null)
      } finally {
        setLoadingGeneral(false)
      }
    }

    loadGeneral()
  }, [anioGeneral])

  useEffect(() => {
    if (modoVista !== 'auditor') return
    if (!selectedAuditorId) {
      setDashboard(null)
      return
    }

    const loadDashboard = async () => {
      setLoadingDashboard(true)
      setError('')
      try {
        setDashboard(await obtenerDashboardAuditor(selectedAuditorId))
      } catch (err) {
        console.error('Error cargando dashboard del auditor:', err)
        setError(err.message || 'No se pudo cargar el dashboard del auditor')
        setDashboard(null)
      } finally {
        setLoadingDashboard(false)
      }
    }

    loadDashboard()
  }, [selectedAuditorId, modoVista])

  const filteredAuditores = useMemo(() => {
    const term = (search || '').trim().toLowerCase()
    if (!term) return auditores

    return auditores.filter((auditor) => {
      const haystack = [
        auditor.nombre,
        auditor.apellido,
        auditor.email,
        auditor.tipo_personal,
        auditor.tipo_estudio,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return haystack.includes(term)
    })
  }, [auditores, search])

  const aniosDisponibles = useMemo(() => {
    return (dashboard?.resumenPorAnio || []).map((item) => String(item.anio))
  }, [dashboard])

  useEffect(() => {
    if (!filteredAuditores.length) return
    if (!filteredAuditores.some((auditor) => auditor.auth_user_id === selectedAuditorId)) {
      setSelectedAuditorId(filteredAuditores[0].auth_user_id)
    }
  }, [filteredAuditores, selectedAuditorId])

  useAnioInicial(aniosDisponibles, (anio) => setAnioFiltro(String(anio)))

  useEffect(() => {
    if (anioFiltro !== 'todos' && !aniosDisponibles.includes(anioFiltro)) {
      setAnioFiltro('todos')
    }
  }, [anioFiltro, aniosDisponibles])

  // Actualizar avatar cuando cambia el dashboard
  useEffect(() => {
    if (dashboard?.auditor?.email) {
      setAvatarSrc(getAvatarSrc(dashboard.auditor.email))
    } else {
      setAvatarSrc(DEFAULT_AVATAR)
    }
  }, [dashboard?.auditor?.email])

  const auditoriasFiltradas = useMemo(() => {
    const auditorias = dashboard?.auditorias || []
    if (anioFiltro === 'todos') return auditorias
    return auditorias.filter((item) => String(item.anio) === String(anioFiltro))
  }, [dashboard, anioFiltro])

  const metricasFiltradas = useMemo(() => {
    const total = auditoriasFiltradas.length
    const notasFinales = auditoriasFiltradas.filter((item) => typeof item.nota_final === 'number')
    const promedioFinal = notasFinales.length
      ? Number((notasFinales.reduce((acc, item) => acc + item.nota_final, 0) / notasFinales.length).toFixed(2))
      : null
    const mejor = notasFinales.length
      ? notasFinales.reduce((best, current) => current.nota_final > best.nota_final ? current : best)
      : null

    return {
      total,
      promedioFinal,
      mejorNota: mejor?.nota_final ?? null,
      mejorInforme: mejor?.informe_id ?? null,
    }
  }, [auditoriasFiltradas])

  const chartAuditoriasPorAnio = useMemo(() => {
    return (dashboard?.resumenPorAnio || []).map((item) => ({
      anio: String(item.anio),
      auditorias: item.auditorias,
    }))
  }, [dashboard])

  const chartNotasPorAnio = useMemo(() => {
    return (dashboard?.resumenPorAnio || []).map((item) => ({
      anio: String(item.anio),
      final: item.nota_final_promedio,
      archivos: item.nota_archivos_promedio,
      encuesta: item.nota_encuesta_promedio,
      rubrica: item.nota_rubrica_promedio,
    }))
  }, [dashboard])

  const chartNotasPorAuditoria = useMemo(() => {
    return [...auditoriasFiltradas]
      .sort((a, b) => new Date(a.fecha_auditoria || 0) - new Date(b.fecha_auditoria || 0))
      .map((item) => ({
        informe: `#${item.informe_id}`,
        nota_final: item.nota_final,
        dependencia: item.dependencia_nombre,
      }))
  }, [auditoriasFiltradas])

  const chartGeneralAuditorias = useMemo(() => {
    const base = resumenGeneral?.rankingAuditores || []
    return [...base]
      .sort((a, b) => {
        if (b.total !== a.total) return b.total - a.total
        const promedioA = typeof a.promedioFinal === 'number' ? a.promedioFinal : -1
        const promedioB = typeof b.promedioFinal === 'number' ? b.promedioFinal : -1
        return promedioB - promedioA
      })
      .slice(0, 8)
      .map((item) => ({
        auditor: item.nombre,
        auditorias: item.total,
        promedio: item.promedioFinal,
      }))
  }, [resumenGeneral])

  const chartGeneralPromedios = useMemo(() => {
    const base = resumenGeneral?.rankingAuditores || []
    return base
      .filter((item) => typeof item.promedioFinal === 'number')
      .slice(0, 8)
      .map((item) => ({
        auditor: item.nombre,
        promedio: item.promedioFinal,
      }))
  }, [resumenGeneral])

  const chartPromediosEquipo = useMemo(() => {
    if (!resumenGeneral?.promediosGlobales) return []

    return [
      { criterio: 'Archivos', promedio: resumenGeneral.promediosGlobales.archivos },
      { criterio: 'Encuesta', promedio: resumenGeneral.promediosGlobales.encuesta },
      { criterio: 'Rúbrica', promedio: resumenGeneral.promediosGlobales.rubrica },
      { criterio: 'Final', promedio: resumenGeneral.promediosGlobales.final },
    ]
  }, [resumenGeneral])

  /* ── filtros según el modo ── */
  const filtros =
    modoVista === 'general' ? (
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="dash-anio" className="text-xs text-muted-foreground">
          Año
        </Label>
        <Select
          value={anioGeneral}
          onValueChange={setAnioGeneral}
          disabled={aniosGenerales.length === 0 || loadingGeneral}
        >
          <SelectTrigger id="dash-anio" className="w-40">
            <SelectValue placeholder="Sin años disponibles" />
          </SelectTrigger>
          <SelectContent>
            {aniosGenerales.map((anio) => (
              <SelectItem key={anio} value={anio}>
                {anio}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    ) : (
      <>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">Buscar</Label>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar auditor…"
            className="sm:w-64"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dash-auditor" className="text-xs text-muted-foreground">
            Auditor
          </Label>
          <Select
            value={selectedAuditorId}
            onValueChange={setSelectedAuditorId}
            disabled={loadingAuditores || filteredAuditores.length === 0}
          >
            <SelectTrigger id="dash-auditor" className="w-72">
              <SelectValue placeholder="No hay auditores" />
            </SelectTrigger>
            <SelectContent>
              {filteredAuditores.map((auditor) => (
                <SelectItem key={auditor.auth_user_id} value={auditor.auth_user_id}>
                  {`${auditor.nombre || ''} ${auditor.apellido || ''}`.trim()}
                  {auditor.email ? ` · ${auditor.email}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dash-anio-auditor" className="text-xs text-muted-foreground">
            Año
          </Label>
          <Select
            value={anioFiltro}
            onValueChange={setAnioFiltro}
            disabled={!dashboard || aniosDisponibles.length === 0}
          >
            <SelectTrigger id="dash-anio-auditor" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los años</SelectItem>
              {aniosDisponibles.map((anio) => (
                <SelectItem key={anio} value={anio}>
                  {anio}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </>
    )

  const cargando =
    modoVista === 'general' ? loadingGeneral : loadingAuditores || loadingDashboard

  return (
    <div className={PAGE_SHELL}>
      <PageHeader
        title="Dashboard de Auditores"
        subtitle="Historial completo, evaluaciones y métricas de desempeño"
        actions={
          <ViewToggle
            options={MODOS}
            value={modoVista}
            onChange={setModoVista}
            variant="onHeader"
          />
        }
      />

      <div className={cn(SECTION_CARD, 'flex flex-wrap items-end gap-3 p-4')}>{filtros}</div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      {cargando && (
        <div className="rounded-lg border border-border bg-card">
          <Cargando
            mensaje={
              modoVista === 'general'
                ? 'Cargando análisis general…'
                : 'Cargando dashboard por auditor…'
            }
          />
        </div>
      )}

      {modoVista === 'general' && !loadingGeneral && resumenGeneral && (
        <DashboardConsolidadoGeneral
          resumen={resumenGeneral}
          chartAuditorias={chartGeneralAuditorias}
          chartPromedios={chartGeneralPromedios}
          chartEquipo={chartPromediosEquipo}
        />
      )}

      {modoVista === 'auditor' && !cargando && dashboard?.auditor && (
        <DashboardDetalleAuditor
          dashboard={dashboard}
          metricas={metricasFiltradas}
          auditorias={auditoriasFiltradas}
          avatarSrc={avatarSrc}
          onAvatarError={() => setAvatarSrc(DEFAULT_AVATAR)}
          chartAuditoriasPorAnio={chartAuditoriasPorAnio}
          chartNotasPorAnio={chartNotasPorAnio}
          chartNotasPorAuditoria={chartNotasPorAuditoria}
        />
      )}
    </div>
  )
}
