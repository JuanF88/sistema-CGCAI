'use client'

/**
 * Panel de estadísticas de hallazgos.
 *
 * Cuatro vistas sobre el mismo conjunto filtrado: resumen, tendencias,
 * comparativa y distribución. Las tarjetas de gráfica, los KPI y el selector de
 * vistas salen del sistema de diseño; aquí solo queda el cálculo de los datos.
 */
import { useEffect, useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Activity,
  ArrowUpDown,
  BarChart3,
  Calendar,
  FileText,
  Filter,
  PieChart as PieIcon,
  RefreshCw,
  Target,
  TrendingUp,
  X,
} from 'lucide-react'

import { obtenerEstadisticas } from '@/features/estadisticas/api/estadisticas-api'
import { useAnioInicial } from '@/hooks/useAnioInicial'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { SearchInput } from '@/components/ui/search-input'
import { PageHeader } from '@/components/ui/page-header'
import { InfoCard } from '@/components/ui/info-card'
import { ViewToggle } from '@/components/ui/view-toggle'
import { ExportableChartCard } from '@/components/ui/chart-card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { EMPTY_STATE, PAGE_SHELL, SECTION_CARD } from '@/components/ui/tokens'

/* ── Paleta de las series ──
   Son colores semánticos del dominio (fortaleza / oportunidad / no
   conformidad), no tokens de tema: se mantienen fijos en claro y oscuro para
   que una gráfica exportada a PNG signifique siempre lo mismo. */
const BRAND = '#6387d6'
const GREEN = '#36c797'
const AMBER = '#ec81e7'
const RED = '#7d008d'
const PIE_COLORS = [GREEN, AMBER, RED]

/** Ejes y rejilla sí siguen el tema, para que se lean en modo oscuro. */
const GRID_COLOR = 'hsl(var(--border))'
const AXIS_COLOR = 'hsl(var(--muted-foreground))'

const SERIES = [
  { key: 'Fortaleza', color: GREEN },
  { key: 'Oportunidad de Mejora', color: AMBER },
  { key: 'No Conformidad', color: RED },
]

/* ── Helpers ── */

const toNum = (v) => Number(v) || 0
const norm = (s) => String(s ?? '').trim().toLowerCase()
const s = (v) => (v == null ? '' : String(v))

const normalizeTipo = (t) => {
  const k = norm(t)
  if (k.startsWith('fort')) return 'Fortaleza'
  if (k.startsWith('oport')) return 'Oportunidad de Mejora'
  if (k.startsWith('no con')) return 'No Conformidad'
  return 'OTRO'
}

const GESTIONES_VALIDAS = [
  'estrategica',
  'academica',
  'investigacion',
  'administrativa',
  'cultura',
  'control',
  'otras',
]

/** Normaliza la gestión; lo que no reconoce cae en «otras». */
const gestionDe = (valor) => {
  const limpio = norm(valor)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
  return GESTIONES_VALIDAS.includes(limpio) ? limpio : 'otras'
}

const OPCIONES_GESTION = [
  { key: 'todas', label: 'Todas las áreas' },
  { key: 'estrategica', label: 'Estratégica' },
  { key: 'academica', label: 'Académica' },
  { key: 'investigacion', label: 'Investigación' },
  { key: 'administrativa', label: 'Administrativa' },
  { key: 'cultura', label: 'Cultura' },
  { key: 'control', label: 'Control' },
  { key: 'otras', label: 'Otras' },
]

const PERIODOS = [
  { key: 'ninguno', label: 'Sin comparación' },
  { key: 'anio_anterior', label: 'vs Año anterior' },
  { key: 'semestre_anterior', label: 'vs Semestre anterior' },
]

const VISTAS = [
  { key: 'resumen', label: 'Resumen', icon: BarChart3 },
  { key: 'tendencias', label: 'Tendencias', icon: Activity },
  { key: 'comparativa', label: 'Comparativa', icon: ArrowUpDown },
  { key: 'distribucion', label: 'Distribución', icon: PieIcon },
]

const FILTROS_INICIALES = {
  anio: 'todos',
  dependencia: 'todas',
  tipo: 'todos',
  iso: 'todos',
  gestion: 'todas',
  busqueda: '',
}

/** Un filtro con su etiqueta e icono, para no repetir el mismo bloque 6 veces. */
function CampoFiltro({ icon: Icon, label, children }) {
  return (
    <div className="flex min-w-[180px] flex-1 flex-col gap-1.5">
      <Label className="text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </Label>
      {children}
    </div>
  )
}

/** Select de filtro: valor, opciones y placeholder. */
function SelectFiltro({ value, onChange, placeholder, opciones }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {opciones.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** Fila de variación entre los dos últimos periodos. */
function FilaVariacion({ etiqueta, color, datos, mejorEsMenos }) {
  const positivo = mejorEsMenos ? datos.valor <= 0 : datos.valor >= 0
  const signo = datos.valor >= 0 ? '+' : ''

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 p-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold" style={{ color }}>
          {etiqueta}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {datos.periodo1}: <span className="tabular-nums">{datos.valorPeriodo1}</span>
          <span className="mx-1.5">→</span>
          {datos.periodo2}: <span className="tabular-nums">{datos.valorPeriodo2}</span>
        </p>
      </div>

      <span
        className={cn(
          'text-lg font-extrabold tabular-nums',
          positivo ? 'text-emerald-600' : 'text-destructive'
        )}
      >
        {signo}
        {datos.porcentaje.toFixed(1)}%
        <span className="ml-1.5 text-xs font-semibold text-muted-foreground">
          ({signo}
          {datos.valor})
        </span>
      </span>
    </div>
  )
}

/** Mensaje cuando una gráfica se queda sin datos. */
const SinDatos = ({ children = 'No hay datos' }) => (
  <div className={cn(EMPTY_STATE, 'h-full')}>{children}</div>
)

export default function VistaEstadisticas({ headerExtra = null, hideMainHeader = false }) {
  const [detalle, setDetalle] = useState([])
  const [porTipo, setPorTipo] = useState([])
  const [aniosDisponibles, setAniosDisponibles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [filtros, setFiltros] = useState(FILTROS_INICIALES)
  const setFiltro = (campo, valor) => setFiltros((prev) => ({ ...prev, [campo]: valor }))

  /**
   * Elegido en la UI pero todavía sin efecto: ningún cálculo lo lee. El
   * «Análisis de variación» compara siempre los dos últimos años disponibles.
   */
  const [periodoComparacion, setPeriodoComparacion] = useState('ninguno')

  const [vistaActiva, setVistaActiva] = useState('resumen')
  const [showFilters, setShowFilters] = useState(true)
  const [ocultas, setOcultas] = useState({})

  /* ── Carga ── */

  useEffect(() => {
    const cargar = async () => {
      setLoading(true)
      setError('')
      try {
        const json = await obtenerEstadisticas()
        setDetalle(Array.isArray(json.detalle) ? json.detalle : [])
        setPorTipo(json.resumenPorTipo ?? [])
        setAniosDisponibles(json.anios ?? [])
      } catch (e) {
        console.error(e)
        setError('No se pudieron cargar las estadísticas.')
      } finally {
        setLoading(false)
      }
    }
    cargar()
  }, [])

  // Los filtros comparan con `s(...)`, que normaliza a texto.
  useAnioInicial(aniosDisponibles, (anio) => setFiltro('anio', String(anio)))

  /* ── Normalización ── */

  const detalleBase = useMemo(() => {
    const normalizar = (it) => ({
      ...it,
      anio: it.anio ?? null,
      dependencia: it.dependencia ?? null,
      cantidad: toNum(it.cantidad),
      tipo: normalizeTipo(it.tipo),
      iso: it.iso ?? it.iso_id ?? it.isoId ?? null,
      numeral: it.numeral ?? it.numerales?.numeral ?? it.numeral_id ?? null,
      gestion: gestionDe(it.gestion),
    })

    if (detalle.length) return detalle.map(normalizar)

    // Fallback: si la API no trae detalle, se usa el resumen por tipo.
    const sirve = porTipo.some((i) => 'tipo' in i && 'cantidad' in i)
    return sirve ? porTipo.map(normalizar) : []
  }, [detalle, porTipo])

  const isosDisponibles = useMemo(
    () => [...new Set(detalleBase.map((it) => it.iso).filter(Boolean).map(String))].sort(),
    [detalleBase]
  )

  const tiposDisponibles = useMemo(
    () => [...new Set(detalleBase.map((it) => it.tipo).filter(Boolean))],
    [detalleBase]
  )

  /** Dependencias que quedan tras aplicar todo salvo el propio filtro de dependencia. */
  const dependenciasFiltradas = useMemo(() => {
    const set = new Set()
    for (const it of detalleBase) {
      if (!it.dependencia) continue
      const ok =
        (filtros.anio === 'todos' || s(it.anio) === s(filtros.anio)) &&
        (filtros.tipo === 'todos' || it.tipo === filtros.tipo) &&
        (filtros.iso === 'todos' || s(it.iso) === s(filtros.iso)) &&
        (filtros.gestion === 'todas' || it.gestion === filtros.gestion) &&
        (!filtros.busqueda ||
          s(it.dependencia).toLowerCase().includes(filtros.busqueda.toLowerCase()))
      if (ok) set.add(s(it.dependencia))
    }
    return [...set].sort()
  }, [detalleBase, filtros])

  const detalleFiltrado = useMemo(
    () =>
      detalleBase.filter(
        (it) =>
          (filtros.anio === 'todos' || s(it.anio) === s(filtros.anio)) &&
          (filtros.dependencia === 'todas' || s(it.dependencia) === s(filtros.dependencia)) &&
          (filtros.tipo === 'todos' || it.tipo === filtros.tipo) &&
          (filtros.iso === 'todos' || s(it.iso) === s(filtros.iso)) &&
          (filtros.gestion === 'todas' || it.gestion === filtros.gestion)
      ),
    [detalleBase, filtros]
  )

  /* ── Series ── */

  /** Suma `cantidad` agrupando por el resultado de `clave`. */
  const agrupar = (filas, clave) => {
    const map = new Map()
    for (const it of filas) map.set(clave(it), (map.get(clave(it)) || 0) + toNum(it.cantidad))
    return map
  }

  /** Fila con una columna por tipo de hallazgo: `{ [eje]: …, Fortaleza: n, … }`. */
  const agruparPorTipo = (filas, eje, nombreEje) => {
    const map = new Map()
    for (const it of filas) {
      const clave = eje(it)
      if (clave === '') continue
      if (!map.has(clave)) {
        map.set(clave, {
          [nombreEje]: clave,
          ...Object.fromEntries(SERIES.map((serie) => [serie.key, 0])),
        })
      }
      const fila = map.get(clave)
      if (fila[it.tipo] !== undefined) fila[it.tipo] += toNum(it.cantidad)
    }
    return [...map.values()]
  }

  const dataBar = useMemo(
    () =>
      [...agrupar(detalleFiltrado, (it) => s(it.dependencia) || 'SIN_DEP')]
        .map(([dependencia, cantidad]) => ({ dependencia, cantidad }))
        .sort((a, b) => b.cantidad - a.cantidad)
        .slice(0, 10),
    [detalleFiltrado]
  )

  const porTipoGrafico = useMemo(
    () =>
      [...agrupar(detalleFiltrado, (it) => it.tipo)].map(([tipo, cantidad]) => ({
        tipo,
        cantidad,
      })),
    [detalleFiltrado]
  )

  const dataTimeline = useMemo(
    () =>
      agruparPorTipo(detalleFiltrado, (it) => s(it.anio) || 'SIN_AÑO', 'anio').sort(
        (a, b) => Number(a.anio) - Number(b.anio)
      ),
    [detalleFiltrado]
  )

  const dataRadar = useMemo(
    () =>
      [...agrupar(detalleFiltrado, (it) => it.gestion || 'otras')].map(([clave, hallazgos]) => ({
        gestion: OPCIONES_GESTION.find((g) => g.key === clave)?.label || clave,
        hallazgos,
      })),
    [detalleFiltrado]
  )

  const dataNumerales = useMemo(() => {
    /** «4.2.1» → [4, 2, 1], para ordenar los numerales como números y no como texto. */
    const partes = (valor) => String(valor).split(/\D+/).filter(Boolean).map(Number)

    return agruparPorTipo(detalleFiltrado, (it) => s(it.numeral).trim(), 'numeral').sort((a, b) => {
      const pa = partes(a.numeral)
      const pb = partes(b.numeral)
      for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
        const da = pa[i] ?? -1
        const db = pb[i] ?? -1
        if (da !== db) return da - db
      }
      return a.numeral.localeCompare(b.numeral)
    })
  }, [detalleFiltrado])

  /* ── KPIs y variaciones ── */

  const totalHallazgos = porTipoGrafico.reduce((sum, i) => sum + i.cantidad, 0)
  const totalDe = (tipo) => porTipoGrafico.find((i) => i.tipo === tipo)?.cantidad ?? 0
  const totalFortalezas = totalDe('Fortaleza')
  const totalOportunidades = totalDe('Oportunidad de Mejora')
  const totalNoConformidades = totalDe('No Conformidad')

  const variaciones = useMemo(() => {
    const vacia = { valor: 0, porcentaje: 0, periodo1: '', periodo2: '', valorPeriodo1: 0, valorPeriodo2: 0 }
    if (dataTimeline.length < 2) {
      return Object.fromEntries(SERIES.map((serie) => [serie.key, vacia]))
    }

    const p1 = dataTimeline[dataTimeline.length - 2]
    const p2 = dataTimeline[dataTimeline.length - 1]

    return Object.fromEntries(
      SERIES.map(({ key }) => {
        const v1 = p1[key] || 0
        const v2 = p2[key] || 0
        const diferencia = v2 - v1
        return [
          key,
          {
            valor: diferencia,
            porcentaje: v1 > 0 ? (diferencia / v1) * 100 : v2 > 0 ? 100 : 0,
            periodo1: p1.anio,
            periodo2: p2.anio,
            valorPeriodo1: v1,
            valorPeriodo2: v2,
          },
        ]
      })
    )
  }, [dataTimeline])

  /* ── Filtros ── */

  const filtrosActivos = [
    filtros.anio !== 'todos',
    filtros.dependencia !== 'todas',
    filtros.tipo !== 'todos',
    filtros.iso !== 'todos',
    filtros.gestion !== 'todas',
    Boolean(filtros.busqueda),
  ].filter(Boolean).length

  /* ── Estados de carga y error ── */

  if (loading) {
    return (
      <div className={PAGE_SHELL}>
        <div className="h-32 animate-pulse rounded-[20px] bg-muted" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
        <div className="h-80 animate-pulse rounded-xl bg-muted" />
      </div>
    )
  }

  if (error) {
    return (
      <div className={PAGE_SHELL}>
        <div className={cn(SECTION_CARD, 'flex flex-col items-center gap-4 p-10 text-center')}>
          <p className="font-medium text-destructive">{error}</p>
          <Button variant="outline" onClick={() => location.reload()}>
            <RefreshCw />
            Reintentar
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className={PAGE_SHELL}>
      {!hideMainHeader && (
        <PageHeader
          title="Estadísticas avanzadas"
          subtitle="Panel interactivo de análisis con visualizaciones personalizables"
          actions={
            <Button
              variant="secondary"
              onClick={() => location.reload()}
              className="bg-white/15 text-white hover:bg-white/25"
            >
              <RefreshCw />
              Actualizar
            </Button>
          }
        />
      )}

      {headerExtra}

      <ViewToggle
        options={VISTAS}
        value={vistaActiva}
        onChange={setVistaActiva}
        className="self-start"
      />

      {/* ── Filtros ── */}
      <section className={cn(SECTION_CARD, 'p-4')}>
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Filtros avanzados</span>
            {filtrosActivos > 0 && <Badge>{filtrosActivos} activos</Badge>}
          </div>

          <div className="flex items-center gap-2">
            {filtrosActivos > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setFiltros(FILTROS_INICIALES)}>
                <X />
                Limpiar
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setShowFilters((v) => !v)}>
              {showFilters ? 'Ocultar' : 'Mostrar'}
            </Button>
          </div>
        </header>

        {showFilters && (
          <div className="mt-4 flex flex-wrap gap-4">
            <CampoFiltro icon={Calendar} label="Año">
              <SelectFiltro
                value={filtros.anio}
                onChange={(v) => setFiltro('anio', v)}
                placeholder="Año"
                opciones={[
                  { value: 'todos', label: 'Todos los años' },
                  ...aniosDisponibles.map((a) => ({ value: String(a), label: String(a) })),
                ]}
              />
            </CampoFiltro>

            <CampoFiltro icon={Target} label="Buscar dependencia">
              <SearchInput
                value={filtros.busqueda}
                onChange={(v) => setFiltro('busqueda', v)}
                placeholder="Escribe para buscar…"
                className="w-full sm:w-full"
              />
            </CampoFiltro>

            <CampoFiltro icon={Target} label="Dependencia">
              <SelectFiltro
                value={filtros.dependencia}
                onChange={(v) => setFiltro('dependencia', v)}
                placeholder="Dependencia"
                opciones={[
                  { value: 'todas', label: 'Todas las dependencias' },
                  ...dependenciasFiltradas.map((d) => ({ value: d, label: d })),
                ]}
              />
            </CampoFiltro>

            <CampoFiltro icon={FileText} label="Tipo">
              <SelectFiltro
                value={filtros.tipo}
                onChange={(v) => setFiltro('tipo', v)}
                placeholder="Tipo"
                opciones={[
                  { value: 'todos', label: 'Todos los tipos' },
                  ...tiposDisponibles.map((t) => ({ value: String(t), label: String(t) })),
                ]}
              />
            </CampoFiltro>

            <CampoFiltro icon={FileText} label="ISO">
              <SelectFiltro
                value={filtros.iso}
                onChange={(v) => setFiltro('iso', v)}
                placeholder="ISO"
                opciones={[
                  { value: 'todos', label: 'Todas las ISO' },
                  ...isosDisponibles.map((i) => ({ value: i, label: i })),
                ]}
              />
            </CampoFiltro>

            <CampoFiltro icon={TrendingUp} label="Comparar con">
              <SelectFiltro
                value={periodoComparacion}
                onChange={setPeriodoComparacion}
                placeholder="Comparación"
                opciones={PERIODOS.map((p) => ({ value: p.key, label: p.label }))}
              />
            </CampoFiltro>

            <CampoFiltro icon={Target} label="Área">
              <SelectFiltro
                value={filtros.gestion}
                onChange={(v) => setFiltro('gestion', v)}
                placeholder="Área"
                opciones={OPCIONES_GESTION.map((g) => ({ value: g.key, label: g.label }))}
              />
            </CampoFiltro>
          </div>
        )}
      </section>

      {/* ── KPIs ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <InfoCard label="Total hallazgos" value={totalHallazgos} tone="indigo" />
        <InfoCard label="Fortalezas" value={totalFortalezas} tone="green" />
        <InfoCard label="Oportunidades" value={totalOportunidades} tone="pink" />
        <InfoCard label="No conformidades" value={totalNoConformidades} tone="purple" />
        <InfoCard label="Dependencias" value={dependenciasFiltradas.length} tone="gray" />
      </div>

      {/* ── Resumen ── */}
      {vistaActiva === 'resumen' && (
        <div className="grid gap-4 lg:grid-cols-3">
          <ExportableChartCard
            title="Top 10 dependencias con más hallazgos"
            downloadName="top-10-dependencias"
            height={300}
          >
            {(Tip) =>
              dataBar.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dataBar} margin={{ top: 6, right: 12, bottom: 60, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                    <XAxis
                      dataKey="dependencia"
                      tick={{ fontSize: 8, fill: AXIS_COLOR }}
                      interval={0}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis allowDecimals={false} tick={{ fill: AXIS_COLOR }} />
                    <Tooltip content={<Tip />} cursor={{ fill: 'hsl(var(--muted))' }} />
                    <Bar dataKey="cantidad" fill={BRAND} radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <SinDatos />
              )
            }
          </ExportableChartCard>

          <ExportableChartCard
            title={`Distribución por tipo · ${totalHallazgos} hallazgos`}
            downloadName="distribucion-por-tipo"
            height={300}
          >
            {(Tip) =>
              porTipoGrafico.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={porTipoGrafico}
                      dataKey="cantidad"
                      nameKey="tipo"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                    >
                      {porTipoGrafico.map((entry, i) => (
                        <Cell key={entry.tipo} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<Tip />} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <SinDatos />
              )
            }
          </ExportableChartCard>

          <ExportableChartCard
            title="Distribución por gestión"
            downloadName="distribucion-por-gestion"
            height={300}
          >
            {(Tip) =>
              dataRadar.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={dataRadar}>
                    <PolarGrid stroke={GRID_COLOR} />
                    <PolarAngleAxis dataKey="gestion" tick={{ fontSize: 11, fill: AXIS_COLOR }} />
                    <PolarRadiusAxis angle={90} domain={[0, 'auto']} tick={{ fill: AXIS_COLOR }} />
                    <Radar
                      name="Hallazgos"
                      dataKey="hallazgos"
                      stroke={BRAND}
                      fill={BRAND}
                      fillOpacity={0.5}
                    />
                    <Tooltip content={<Tip />} />
                  </RadarChart>
                </ResponsiveContainer>
              ) : (
                <SinDatos />
              )
            }
          </ExportableChartCard>

          <ExportableChartCard
            className="lg:col-span-3"
            title="Hallazgos por numeral evaluado"
            downloadName="hallazgos-por-numeral"
            height={420}
          >
            {(Tip) =>
              dataNumerales.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={dataNumerales}
                    margin={{ top: 10, right: 24, bottom: 85, left: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                    <XAxis
                      dataKey="numeral"
                      interval={0}
                      angle={-35}
                      textAnchor="end"
                      tick={{ fontSize: 11, fill: AXIS_COLOR }}
                      tickMargin={10}
                      height={100}
                    />
                    <YAxis allowDecimals={false} tick={{ fill: AXIS_COLOR }} />
                    <Tooltip content={<Tip />} />
                    <Legend />
                    {SERIES.map(({ key, color }) => (
                      <Area
                        key={key}
                        type="monotone"
                        dataKey={key}
                        stroke={color}
                        fill={color}
                        fillOpacity={0.22}
                        strokeWidth={2}
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <SinDatos>No hay numerales evaluados para los filtros seleccionados</SinDatos>
              )
            }
          </ExportableChartCard>
        </div>
      )}

      {/* ── Tendencias ── */}
      {vistaActiva === 'tendencias' && (
        <div className="flex flex-col gap-4">
          {/* Alternar series: se aplica a la evolución temporal. */}
          <div className="flex flex-wrap gap-2">
            {SERIES.map(({ key, color }) => (
              <button
                key={key}
                type="button"
                onClick={() => setOcultas((prev) => ({ ...prev, [key]: !prev[key] }))}
                aria-pressed={!ocultas[key]}
                className={cn(
                  'inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  ocultas[key]
                    ? 'border-border bg-muted text-muted-foreground line-through'
                    : 'border-border bg-card text-foreground hover:bg-accent'
                )}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                {key}
              </button>
            ))}
          </div>

          <ExportableChartCard
            title="Evolución temporal por tipo"
            downloadName="evolucion-temporal"
            height={400}
          >
            {(Tip) =>
              dataTimeline.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dataTimeline} margin={{ top: 8, right: 18, bottom: 8, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                    <XAxis dataKey="anio" tick={{ fontSize: 12, fill: AXIS_COLOR }} />
                    <YAxis allowDecimals={false} tick={{ fill: AXIS_COLOR }} />
                    <Tooltip content={<Tip />} />
                    {SERIES.filter(({ key }) => !ocultas[key]).map(({ key, color }) => (
                      <Area
                        key={key}
                        type="monotone"
                        dataKey={key}
                        stroke={color}
                        fill={color}
                        fillOpacity={0.2}
                        strokeWidth={3}
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <SinDatos />
              )
            }
          </ExportableChartCard>

          <ExportableChartCard
            title="Hallazgos por año y tipo"
            downloadName="hallazgos-por-anio"
            height={340}
          >
            {(Tip) =>
              dataTimeline.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={dataTimeline}
                    margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                    <XAxis dataKey="anio" tick={{ fill: AXIS_COLOR }} />
                    <YAxis tick={{ fill: AXIS_COLOR }} />
                    <Tooltip content={<Tip />} cursor={{ fill: 'hsl(var(--muted))' }} />
                    <Legend />
                    {SERIES.map(({ key, color }) => (
                      <Bar key={key} dataKey={key} fill={color} stackId="a" />
                    ))}
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <SinDatos />
              )
            }
          </ExportableChartCard>
        </div>
      )}

      {/* ── Comparativa ── */}
      {vistaActiva === 'comparativa' && (
        <div className="grid gap-4 lg:grid-cols-3">
          <ExportableChartCard
            className="lg:col-span-2"
            title="Comparativa interanual"
            downloadName="comparativa-interanual"
            height={400}
          >
            {(Tip) =>
              dataTimeline.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dataTimeline} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                    <XAxis dataKey="anio" tick={{ fill: AXIS_COLOR }} />
                    <YAxis tick={{ fill: AXIS_COLOR }} />
                    <Tooltip content={<Tip />} />
                    <Legend />
                    {SERIES.map(({ key, color }) => (
                      <Line
                        key={key}
                        type="monotone"
                        dataKey={key}
                        stroke={color}
                        strokeWidth={3}
                        dot={{ r: 5 }}
                        activeDot={{ r: 8 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <SinDatos />
              )
            }
          </ExportableChartCard>

          <section className={cn(SECTION_CARD, 'flex flex-col gap-3 p-4')}>
            <header>
              <h3 className="text-sm font-semibold">Análisis de variación</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {dataTimeline.length >= 2
                  ? `Comparación: ${variaciones.Fortaleza.periodo1} vs ${variaciones.Fortaleza.periodo2}`
                  : 'Requiere al menos 2 periodos para comparar'}
              </p>
            </header>

            {dataTimeline.length >= 2 ? (
              <div className="flex flex-col gap-2">
                <FilaVariacion
                  etiqueta="✅ Fortalezas"
                  color={GREEN}
                  datos={variaciones.Fortaleza}
                />
                <FilaVariacion
                  etiqueta="⚠️ Oportunidades"
                  color={AMBER}
                  datos={variaciones['Oportunidad de Mejora']}
                  mejorEsMenos
                />
                <FilaVariacion
                  etiqueta="❌ No conformidades"
                  color={RED}
                  datos={variaciones['No Conformidad']}
                  mejorEsMenos
                />
              </div>
            ) : (
              <div className={EMPTY_STATE}>
                No hay suficientes datos para calcular variaciones. Se requieren al menos 2 periodos.
              </div>
            )}
          </section>
        </div>
      )}

      {/* ── Distribución ── */}
      {vistaActiva === 'distribucion' && (
        <div className="grid gap-4 lg:grid-cols-3">
          <ExportableChartCard
            className="lg:col-span-2"
            title={`Distribución detallada por tipo · ${totalHallazgos} hallazgos`}
            downloadName="distribucion-detallada"
            height={420}
          >
            {(Tip) =>
              porTipoGrafico.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={porTipoGrafico}
                      dataKey="cantidad"
                      nameKey="tipo"
                      cx="50%"
                      cy="50%"
                      outerRadius={140}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                      labelLine={{ stroke: AXIS_COLOR, strokeWidth: 1 }}
                    >
                      {porTipoGrafico.map((entry, i) => (
                        <Cell key={entry.tipo} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<Tip />} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <SinDatos />
              )
            }
          </ExportableChartCard>

          <section className={cn(SECTION_CARD, 'flex flex-col gap-3 p-4')}>
            <header>
              <h3 className="text-sm font-semibold">Resumen numérico</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">Valores absolutos y porcentajes</p>
            </header>

            <div className="flex flex-col gap-2">
              {[
                { label: 'Fortalezas', valor: totalFortalezas, color: GREEN },
                { label: 'Oportunidades', valor: totalOportunidades, color: AMBER },
                { label: 'No conformidades', valor: totalNoConformidades, color: RED },
              ].map(({ label, valor, color }) => (
                <div
                  key={label}
                  className="flex items-center justify-between gap-3 rounded-lg border border-l-4 border-border bg-muted/40 p-3"
                  style={{ borderLeftColor: color }}
                >
                  <span className="text-sm font-medium">{label}</span>
                  <span className="flex items-baseline gap-2">
                    <span className="text-lg font-extrabold tabular-nums">{valor}</span>
                    <span className="text-xs font-semibold text-muted-foreground tabular-nums">
                      {totalHallazgos ? ((valor / totalHallazgos) * 100).toFixed(1) : 0}%
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
