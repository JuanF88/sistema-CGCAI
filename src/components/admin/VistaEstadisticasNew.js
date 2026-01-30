'use client'

import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
  AreaChart, Area, LineChart, Line, RadarChart, Radar, 
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, ComposedChart,
  ScatterChart, Scatter
} from 'recharts'
import { 
  Check, ChevronDown, Download, RefreshCw, TrendingUp, 
  Calendar, Filter, X, BarChart3, PieChart as PieIcon,
  Activity, Target, Search, FileText, ArrowUpDown
} from 'lucide-react'
import * as SelectPrimitive from '@radix-ui/react-select'
import html2canvas from 'html2canvas'
import styles from './CSS/VistaEstadisticasNew.module.css'

// Paleta de colores
const BRAND = '#667eea'
const BRAND_LIGHT = '#8b9bf7'
const GREEN = '#10b981'
const AMBER = '#f59e0b'
const RED   = '#ef4444'
const CYAN = '#06b6d4'
const INDIGO = '#6366f1'
const PINK = '#ec4899'
const TEAL = '#14b8a6'
const PIE_COLORS = [GREEN, AMBER, RED]
const MULTI_COLORS = [BRAND, GREEN, AMBER, RED, CYAN, INDIGO, PINK, TEAL]

const cn = (...classes) => classes.filter(Boolean).join(' ')

// Helpers
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

const normalizeGestion = (g) => {
  const val = norm(g).normalize('NFD').replace(/\p{Diacritic}/gu, '')
  if (!val) return ''
  const allowed = ['estrategica', 'academica', 'investigacion', 'administrativa', 'cultura', 'control', 'otras']
  return allowed.includes(val) ? val : ''
}

const getGestionFromDependencia = (dep, gestionHint) => {
  const normalized = normalizeGestion(gestionHint)
  return normalized || 'otras'
}

// Opciones de gestión
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

// Períodos de comparación
const PERIODOS = [
  { key: 'ninguno', label: 'Sin comparación' },
  { key: 'anio_anterior', label: 'vs Año anterior' },
  { key: 'semestre_anterior', label: 'vs Semestre anterior' },
]

// Tipos de vista
const VISTA_TIPOS = [
  { key: 'resumen', label: 'Resumen', icon: BarChart3 },
  { key: 'tendencias', label: 'Tendencias', icon: Activity },
  { key: 'comparativa', label: 'Comparativa', icon: ArrowUpDown },
  { key: 'distribucion', label: 'Distribución', icon: PieIcon },
]

// -------------------- Mini-UI --------------------
const Card = ({ children, className = '' }) => (
  <div className={cn(styles.card, className)}>{children}</div>
)
const CardHeader = ({ title, subtitle, right }) => (
  <div className={styles.cardHeader}>
    <div>
      <h3 className={styles.cardTitle}>{title}</h3>
      {subtitle && <p className={styles.cardSubtitle}>{subtitle}</p>}
    </div>
    {right}
  </div>
)
const CardContent = ({ children, className = '' }) => (
  <div className={cn(styles.cardContent, className)}>{children}</div>
)
const KPI = ({ label, value, accent = 'default', trend, icon }) => (
  <div className={cn(styles.kpi, styles[`kpi_${accent}`])}>
    {icon && <div className={styles.kpiIcon}>{icon}</div>}
    <div className={styles.kpiContent}>
      <p className={styles.kpiLabel}>{label}</p>
      <div className={styles.kpiRow}>
        <p className={styles.kpiValue}>{value}</p>
        {trend && <span className={cn(styles.kpiTrend, trend > 0 ? styles.kpiTrendUp : styles.kpiTrendDown)}>
          {trend > 0 ? '+' : ''}{trend}%
        </span>}
      </div>
    </div>
  </div>
)
const Button = ({ children, className = '', variant = 'default', icon: Icon, ...props }) => (
  <button className={cn(styles.btn, styles[`btn_${variant}`], className)} {...props}>
    {Icon && <Icon className={styles.btnIcon} />}
    {children}
  </button>
)

// Radix Select
const Select = SelectPrimitive.Root
const SelectValue = SelectPrimitive.Value
const SelectTrigger = ({ className = '', children, ...props }) => (
  <SelectPrimitive.Trigger className={cn(styles.selectTrigger, className)} {...props}>
    {children}
  </SelectPrimitive.Trigger>
)
const SelectContent = ({ children, className = '', ...props }) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content sideOffset={4} className={cn(styles.selectContent, className)} {...props}>
      <SelectPrimitive.Viewport className={styles.selectViewport}>
        {children}
      </SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
)
const SelectItem = ({ children, value }) => (
  <SelectPrimitive.Item value={value} className={styles.selectItem}>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    <SelectPrimitive.ItemIndicator className={styles.selectIndicator}>
      <Check className="h-4 w-4" />
    </SelectPrimitive.ItemIndicator>
  </SelectPrimitive.Item>
)

// -------------------- Componente Principal --------------------
// Componente Card con Descarga
function ChartCard({ title, subtitle, children, downloadName, className = '' }) {
  const chartRef = useRef(null)
  
  const descargarPNG = async () => {
    if (!chartRef.current) return
    try {
      const canvas = await html2canvas(chartRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
        useCORS: true
      })
      const url = canvas.toDataURL('image/png')
      const link = document.createElement('a')
      link.download = `${downloadName}_${new Date().toISOString().split('T')[0]}.png`
      link.href = url
      link.click()
    } catch (error) {
      console.error('Error al descargar gráfica:', error)
    }
  }
  
  return (
    <Card className={className}>
      <CardHeader
        title={title}
        subtitle={subtitle}
        right={
          <Button variant="ghost" onClick={descargarPNG} icon={Download}>
            PNG
          </Button>
        }
      />
      <div ref={chartRef}>
        {children}
      </div>
    </Card>
  )
}

export default function VistaEstadisticasNew() {
  const [detalle, setDetalle] = useState([])
  const [dataResumen, setDataResumen] = useState([])
  const [porTipo, setPorTipo] = useState([])
  
  // Filtros principales
  const [filtroAnio, setFiltroAnio] = useState('todos')
  const [filtroDependencia, setFiltroDependencia] = useState('todas')
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [filtroIso, setFiltroIso] = useState('todos')
  const [filtroGestion, setFiltroGestion] = useState('todas')
  const [busquedaDep, setBusquedaDep] = useState('')
  
  // Comparación
  const [periodoComparacion, setPeriodoComparacion] = useState('ninguno')
  
  // Vista activa
  const [vistaActiva, setVistaActiva] = useState('resumen')
  
  // Control de visibilidad de series
  const [hidden, setHidden] = useState({
    Fortaleza: false,
    'Oportunidad de Mejora': false,
    'No Conformidad': false
  })
  
  const [aniosDisponibles, setAniosDisponibles] = useState([])
  const [dependenciasDisponibles, setDependenciasDisponibles] = useState([])
  const [isosDisponibles, setIsosDisponibles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showFilters, setShowFilters] = useState(true)

  // Cargar datos
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      setError('')
      try {
        const res = await fetch('/api/estadisticas')
        if (!res.ok) throw new Error('Error en la API')
        const json = await res.json()
        const {
          detalle: detalleApi = [],
          resumenPorDependencia = [],
          resumenPorTipo = [],
          anios = [],
          dependencias = []
        } = json

        setDetalle(Array.isArray(detalleApi) ? detalleApi : [])
        setDataResumen(resumenPorDependencia ?? [])
        setPorTipo(resumenPorTipo ?? [])
        setAniosDisponibles(anios ?? [])
        setDependenciasDisponibles(dependencias ?? [])
      } catch (e) {
        console.error(e)
        setError('No se pudieron cargar las estadísticas.')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // Normalizar datos base
  const detalleBase = useMemo(() => {
    if (detalle.length) {
      return detalle.map(it => ({
        ...it,
        tipo: normalizeTipo(it.tipo),
        iso: it.iso ?? it.iso_id ?? it.isoId ?? null,
        gestion: getGestionFromDependencia(it.dependencia, it.gestion),
      }))
    }

    const tieneCampos = porTipo.some(i => 'tipo' in i && 'cantidad' in i)
    if (tieneCampos) {
      return porTipo.map(i => ({
        anio: i.anio ?? null,
        dependencia: i.dependencia ?? null,
        tipo: normalizeTipo(i.tipo),
        cantidad: toNum(i.cantidad),
        iso: i.iso ?? i.iso_id ?? null,
        gestion: getGestionFromDependencia(i.dependencia, i.gestion),
      }))
    }
    return []
  }, [detalle, porTipo])

  // Generar lista de ISOs únicas disponibles
  useEffect(() => {
    const isos = new Set()
    detalleBase.forEach(item => {
      if (item.iso) isos.add(String(item.iso))
    })
    setIsosDisponibles(Array.from(isos).sort())
  }, [detalleBase])

  // Dependencias filtradas
  const dependenciasFiltradas = useMemo(() => {
    if (detalleBase.length) {
      const set = new Set()
      detalleBase.forEach(it => {
        if (!it.dependencia) return
        const okAnio = filtroAnio === 'todos' || s(it.anio) === s(filtroAnio)
        const okTipo = filtroTipo === 'todos' || s(it.tipo) === s(filtroTipo)
        const okIso  = filtroIso === 'todos'  || s(it.iso)  === s(filtroIso)
        const gestionItem = getGestionFromDependencia(it.dependencia, it.gestion)
        const okGestion = filtroGestion === 'todas' || gestionItem === filtroGestion
        const okBusqueda = !busquedaDep || s(it.dependencia).toLowerCase().includes(busquedaDep.toLowerCase())
        
        if (okAnio && okTipo && okIso && okGestion && okBusqueda) {
          set.add(s(it.dependencia))
        }
      })
      return Array.from(set).sort()
    }
    return []
  }, [detalleBase, filtroAnio, filtroTipo, filtroIso, filtroGestion, busquedaDep])

  // Datos filtrados
  const detalleFiltrado = useMemo(() => {
    return detalleBase.filter(item => {
      const okAnio = filtroAnio === 'todos' || s(item.anio) === s(filtroAnio)
      const okDep  = filtroDependencia === 'todas' || s(item.dependencia) === s(filtroDependencia)
      const okTipo = filtroTipo === 'todos' || s(item.tipo) === s(filtroTipo)
      const okIso  = filtroIso === 'todos' || s(item.iso) === s(filtroIso)
      const gestionItem = getGestionFromDependencia(item.dependencia, item.gestion)
      const okGestion = filtroGestion === 'todas' || gestionItem === filtroGestion
      return okAnio && okDep && okTipo && okIso && okGestion
    })
  }, [detalleBase, filtroAnio, filtroDependencia, filtroTipo, filtroIso, filtroGestion])

  // Datos para gráficas
  const dataBar = useMemo(() => {
    const map = new Map()
    for (const it of detalleFiltrado) {
      const key = s(it.dependencia) || 'SIN_DEP'
      map.set(key, (map.get(key) || 0) + toNum(it.cantidad))
    }
    return Array.from(map, ([dependencia, cantidad]) => ({ dependencia, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 15) // Top 15
  }, [detalleFiltrado])

  const porTipoGrafico = useMemo(() => {
    const map = new Map()
    for (const it of detalleFiltrado) {
      const key = normalizeTipo(it.tipo)
      map.set(key, (map.get(key) || 0) + toNum(it.cantidad))
    }
    return Array.from(map, ([tipo, cantidad]) => ({ tipo, cantidad }))
  }, [detalleFiltrado])

  const dataTimeline = useMemo(() => {
    const map = new Map()
    for (const it of detalleFiltrado) {
      const year = s(it.anio) || 'SIN_AÑO'
      if (!map.has(year)) {
        map.set(year, { anio: year, Fortaleza: 0, 'Oportunidad de Mejora': 0, 'No Conformidad': 0 })
      }
      const row = map.get(year)
      const t = normalizeTipo(it.tipo)
      if (t === 'Fortaleza') row.Fortaleza += toNum(it.cantidad)
      else if (t === 'Oportunidad de Mejora') row['Oportunidad de Mejora'] += toNum(it.cantidad)
      else if (t === 'No Conformidad') row['No Conformidad'] += toNum(it.cantidad)
    }
    const arr = Array.from(map.values())
    arr.sort((a, b) => Number(a.anio) - Number(b.anio))
    return arr
  }, [detalleFiltrado])

  // Datos para Radar (por gestión)
  const dataRadar = useMemo(() => {
    const map = new Map()
    for (const it of detalleFiltrado) {
      const key = it.gestion || 'otras'
      map.set(key, (map.get(key) || 0) + toNum(it.cantidad))
    }
    return Array.from(map, ([gestion, hallazgos]) => ({ 
      gestion: OPCIONES_GESTION.find(g => g.key === gestion)?.label || gestion, 
      hallazgos 
    }))
  }, [detalleFiltrado])

  // Heatmap: tendencia mensual (simulado por año)
  const dataHeatmap = useMemo(() => {
    const map = new Map()
    for (const it of detalleFiltrado) {
      const year = s(it.anio)
      const tipo = normalizeTipo(it.tipo)
      const key = `${year}-${tipo}`
      map.set(key, (map.get(key) || 0) + toNum(it.cantidad))
    }
    
    const years = Array.from(new Set(detalleFiltrado.map(i => s(i.anio)))).sort()
    const tipos = ['Fortaleza', 'Oportunidad de Mejora', 'No Conformidad']
    
    return years.map(year => {
      const row = { year }
      tipos.forEach(tipo => {
        row[tipo] = map.get(`${year}-${tipo}`) || 0
      })
      return row
    })
  }, [detalleFiltrado])

  // KPIs con tendencias
  const totalHallazgos = porTipoGrafico.reduce((sum, i) => sum + i.cantidad, 0)
  const findTotal = (k) => porTipoGrafico.find(i => i.tipo === k)?.cantidad ?? 0
  const totalFortalezas = findTotal('Fortaleza')
  const totalOportunidades = findTotal('Oportunidad de Mejora')
  const totalNoConformidades = findTotal('No Conformidad')

  const tiposDisponibles = Array.from(new Set(
    detalleBase.map(p => p.tipo).filter(Boolean)
  ))

  // Calcular variaciones entre los dos últimos periodos
  const variaciones = useMemo(() => {
    if (dataTimeline.length < 2) {
      return {
        fortaleza: { valor: 0, porcentaje: 0, periodo1: '', periodo2: '' },
        oportunidad: { valor: 0, porcentaje: 0, periodo1: '', periodo2: '' },
        noConformidad: { valor: 0, porcentaje: 0, periodo1: '', periodo2: '' }
      }
    }

    // Ordenar por año y tomar los dos últimos
    const sorted = [...dataTimeline].sort((a, b) => Number(a.anio) - Number(b.anio))
    const periodo1 = sorted[sorted.length - 2]
    const periodo2 = sorted[sorted.length - 1]

    const calcVariacion = (tipo) => {
      const valor1 = periodo1[tipo] || 0
      const valor2 = periodo2[tipo] || 0
      const diferencia = valor2 - valor1
      const porcentaje = valor1 > 0 ? ((diferencia / valor1) * 100) : (valor2 > 0 ? 100 : 0)
      
      return {
        valor: diferencia,
        porcentaje: porcentaje,
        periodo1: periodo1.anio,
        periodo2: periodo2.anio,
        valorPeriodo1: valor1,
        valorPeriodo2: valor2
      }
    }

    return {
      fortaleza: calcVariacion('Fortaleza'),
      oportunidad: calcVariacion('Oportunidad de Mejora'),
      noConformidad: calcVariacion('No Conformidad')
    }
  }, [dataTimeline])

  // Toggle series
  const toggleSeries = (key) => setHidden(prev => ({ ...prev, [key]: !prev[key] }))

  // Limpiar filtros
  const limpiarFiltros = () => {
    setFiltroAnio('todos')
    setFiltroDependencia('todas')
    setFiltroTipo('todos')
    setFiltroIso('todos')
    setFiltroGestion('todas')
    setBusquedaDep('')
  }

  const hayFiltrosActivos = filtroAnio !== 'todos' || filtroDependencia !== 'todas' || 
                           filtroTipo !== 'todos' || filtroIso !== 'todos' || 
                           filtroGestion !== 'todas' || busquedaDep

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.skeletonHeader} />
        <div className={styles.skeletonGrid} />
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.page}>
        <Card>
          <CardHeader title="Error" subtitle="" />
          <CardContent>
            <p className={styles.error}>{error}</p>
            <Button variant="outline" onClick={() => location.reload()} icon={RefreshCw}>
              Reintentar
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      {/* MODERN HEADER */}
      <div className={styles.modernHeader}>
        <div className={styles.headerContent}>
          <div className={styles.headerLeft}>
            <div className={styles.headerIcon}>📊</div>
            <div className={styles.headerInfo}>
              <h1 className={styles.headerTitle}>Estadísticas Avanzadas</h1>
              <p className={styles.headerSubtitle}>
                Panel interactivo de análisis con visualizaciones personalizables
              </p>
            </div>
          </div>
          <div className={styles.headerActions}>
            <Button variant="outline" onClick={() => location.reload()} icon={RefreshCw}>
              Actualizar
            </Button>
          </div>
        </div>
      </div>

      {/* TABS DE VISTA */}
      <div className={styles.viewTabs}>
        {VISTA_TIPOS.map(vista => {
          const IconComponent = vista.icon
          return (
            <button
              key={vista.key}
              className={cn(styles.viewTab, vistaActiva === vista.key && styles.viewTabActive)}
              onClick={() => setVistaActiva(vista.key)}
            >
              <IconComponent className={styles.viewTabIcon} />
              {vista.label}
            </button>
          )
        })}
      </div>

      {/* FILTROS */}
      <div className={styles.filterCard}>
        <div className={styles.filterHeader}>
          <div className={styles.filterHeaderLeft}>
            <Filter className={styles.filterHeaderIcon} />
            <span className={styles.filterHeaderTitle}>Filtros Avanzados</span>
            {hayFiltrosActivos && (
              <span className={styles.filterBadge}>{
                [filtroAnio !== 'todos', filtroDependencia !== 'todas', filtroTipo !== 'todos', 
                 filtroIso !== 'todos', filtroGestion !== 'todas', busquedaDep].filter(Boolean).length
              } activos</span>
            )}
          </div>
          <button 
            className={styles.filterToggle}
            onClick={() => setShowFilters(!showFilters)}
          >
            {showFilters ? 'Ocultar' : 'Mostrar'}
          </button>
        </div>

        {showFilters && (
          <>
            <div className={styles.filterRow}>
              {/* Año */}
              <div className={styles.filterItem}>
                <label className={styles.filterLabel}>
                  <Calendar className={styles.filterLabelIcon} />
                  Año
                </label>
                <Select value={filtroAnio} onValueChange={setFiltroAnio}>
                  <SelectTrigger>
                    <SelectValue placeholder="Año" />
                    <ChevronDown className={styles.chevron} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los años</SelectItem>
                    {aniosDisponibles.map(anio => (
                      <SelectItem key={String(anio)} value={String(anio)}>{anio}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Búsqueda de Dependencia */}
              <div className={styles.filterItem}>
                <label className={styles.filterLabel}>
                  <Search className={styles.filterLabelIcon} />
                  Buscar Dependencia
                </label>
                <div className={styles.searchWrapper}>
                  <Search className={styles.searchIcon} />
                  <input
                    type="text"
                    className={styles.searchInput}
                    placeholder="Escriba para buscar..."
                    value={busquedaDep}
                    onChange={e => setBusquedaDep(e.target.value)}
                  />
                  {busquedaDep && (
                    <button className={styles.searchClear} onClick={() => setBusquedaDep('')}>
                      <X className={styles.searchClearIcon} />
                    </button>
                  )}
                </div>
              </div>

              {/* Dependencia */}
              <div className={styles.filterItem}>
                <label className={styles.filterLabel}>
                  <Target className={styles.filterLabelIcon} />
                  Dependencia
                </label>
                <Select value={filtroDependencia} onValueChange={setFiltroDependencia}>
                  <SelectTrigger>
                    <SelectValue placeholder="Dependencia" />
                    <ChevronDown className={styles.chevron} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas las dependencias</SelectItem>
                    {dependenciasFiltradas.map(dep => (
                      <SelectItem key={dep} value={dep}>{dep}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Tipo */}
              <div className={styles.filterItem}>
                <label className={styles.filterLabel}>
                  <FileText className={styles.filterLabelIcon} />
                  Tipo
                </label>
                <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tipo" />
                    <ChevronDown className={styles.chevron} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los tipos</SelectItem>
                    {tiposDisponibles.map(tipo => (
                      <SelectItem key={String(tipo)} value={String(tipo)}>{tipo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* ISO */}
              <div className={styles.filterItem}>
                <label className={styles.filterLabel}>
                  <FileText className={styles.filterLabelIcon} />
                  ISO
                </label>
                <Select value={filtroIso} onValueChange={setFiltroIso}>
                  <SelectTrigger>
                    <SelectValue placeholder="ISO" />
                    <ChevronDown className={styles.chevron} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas las ISO</SelectItem>
                    {isosDisponibles.map(iso => (
                      <SelectItem key={String(iso)} value={String(iso)}>{iso}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Comparación */}
              <div className={styles.filterItem}>
                <label className={styles.filterLabel}>
                  <TrendingUp className={styles.filterLabelIcon} />
                  Comparar con
                </label>
                <Select value={periodoComparacion} onValueChange={setPeriodoComparacion}>
                  <SelectTrigger>
                    <SelectValue placeholder="Comparación" />
                    <ChevronDown className={styles.chevron} />
                  </SelectTrigger>
                  <SelectContent>
                    {PERIODOS.map(p => (
                      <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Área/Gestión */}
              <div className={styles.filterItem}>
                <label className={styles.filterLabel}>
                  <Target className={styles.filterLabelIcon} />
                  Área
                </label>
                <Select value={filtroGestion} onValueChange={setFiltroGestion}>
                  <SelectTrigger>
                    <SelectValue placeholder="Área" />
                    <ChevronDown className={styles.chevron} />
                  </SelectTrigger>
                  <SelectContent>
                    {OPCIONES_GESTION.map(g => (
                      <SelectItem key={g.key} value={g.key}>{g.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {hayFiltrosActivos && (
                <Button variant="ghost" onClick={limpiarFiltros} icon={X}>
                  Limpiar
                </Button>
              )}
            </div>
          </>
        )}
      </div>

      {/* KPIs */}
      <div className={styles.kpiRow}>
        <KPI 
          label="Total Hallazgos" 
          value={totalHallazgos} 
          accent="brand" 
          icon="📊"
        />
        <KPI 
          label="Fortalezas" 
          value={totalFortalezas} 
          accent="green" 
          icon="✅"
        />
        <KPI 
          label="Oportunidades" 
          value={totalOportunidades} 
          accent="amber" 
          icon="⚠️"
        />
        <KPI 
          label="No Conformidades" 
          value={totalNoConformidades} 
          accent="red" 
          icon="❌"
        />
        <KPI 
          label="Dependencias" 
          value={dependenciasFiltradas.length} 
          icon="🏢"
        />
      </div>

      {/* CONTENIDO SEGÚN VISTA ACTIVA */}
      {vistaActiva === 'resumen' && (
        <div className={styles.gridCharts}>
          {/* Barras Top 15 */}
          <ChartCard 
            className={styles.cardWide}
            title="Top 15 Dependencias con Más Hallazgos"
            subtitle={filtroAnio === 'todos' ? 'Todos los años' : `Año ${filtroAnio}`}
            downloadName="top-15-dependencias"
          >
            <CardContent className={styles.chartBox}>
              {dataBar.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dataBar} margin={{ top: 6, right: 12, bottom: 60, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="dependencia"
                      tick={{ fontSize: 11, fill: '#1e293b' }}
                      interval={0}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis allowDecimals={false} tick={{ fill: '#1e293b' }} />
                    <Tooltip wrapperStyle={{ outline: 'none' }} />
                    <Bar dataKey="cantidad" fill={BRAND} radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className={styles.empty}>No hay datos</div>
              )}
            </CardContent>
          </ChartCard>

          {/* Pie */}
          <ChartCard
            title="Distribución por Tipo"
            subtitle={`Total: ${totalHallazgos}`}
            downloadName="distribucion-por-tipo"
          >
            <CardContent className={styles.chartBox}>
              {porTipoGrafico.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie 
                      data={porTipoGrafico} 
                      dataKey="cantidad" 
                      nameKey="tipo" 
                      cx="50%" 
                      cy="50%" 
                      outerRadius={100}
                      label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                    >
                      {porTipoGrafico.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className={styles.empty}>No hay datos</div>
              )}
            </CardContent>
          </ChartCard>

          {/* Radar por Gestión */}
          <ChartCard
            title="Distribución por Gestión"
            subtitle="Vista radial comparativa"
            downloadName="distribucion-por-gestion"
          >
            <CardContent className={styles.chartBox}>
              {dataRadar.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={dataRadar}>
                    <PolarGrid stroke="#e5e7eb" />
                    <PolarAngleAxis dataKey="gestion" tick={{ fontSize: 11 }} />
                    <PolarRadiusAxis angle={90} domain={[0, 'auto']} />
                    <Radar 
                      name="Hallazgos" 
                      dataKey="hallazgos" 
                      stroke={BRAND} 
                      fill={BRAND} 
                      fillOpacity={0.5} 
                    />
                    <Tooltip />
                    <Legend />
                  </RadarChart>
                </ResponsiveContainer>
              ) : (
                <div className={styles.empty}>No hay datos</div>
              )}
            </CardContent>
          </ChartCard>
        </div>
      )}

      {vistaActiva === 'tendencias' && (
        <>
          {/* Timeline */}
          <ChartCard 
            className={styles.cardFull}
            title="Evolución Temporal por Tipo"
            subtitle="Tendencia histórica de hallazgos"
            downloadName="evolucion-temporal"
          >
            <div className={styles.legendToggles}>
              {[
                { k: 'Fortaleza', c: GREEN },
                { k: 'Oportunidad de Mejora', c: AMBER },
                { k: 'No Conformidad', c: RED },
              ].map(({ k, c }) => (
                <button
                  key={k}
                  className={cn(styles.legendBtn, hidden[k] && styles.legendBtn_off)}
                  onClick={() => toggleSeries(k)}
                >
                  <span className={styles.legendDot} style={{ backgroundColor: c }} />
                  {k}
                </button>
              ))}
            </div>
            <CardContent className={styles.chartBoxTall}>
              {dataTimeline.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dataTimeline} margin={{ top: 8, right: 18, bottom: 8, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="anio" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    {!hidden['Fortaleza'] && (
                      <Area
                        type="monotone"
                        dataKey="Fortaleza"
                        stroke={GREEN}
                        fill={GREEN}
                        fillOpacity={0.2}
                        strokeWidth={3}
                      />
                    )}
                    {!hidden['Oportunidad de Mejora'] && (
                      <Area
                        type="monotone"
                        dataKey="Oportunidad de Mejora"
                        stroke={AMBER}
                        fill={AMBER}
                        fillOpacity={0.2}
                        strokeWidth={3}
                      />
                    )}
                    {!hidden['No Conformidad'] && (
                      <Area
                        type="monotone"
                        dataKey="No Conformidad"
                        stroke={RED}
                        fill={RED}
                        fillOpacity={0.2}
                        strokeWidth={3}
                      />
                    )}
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className={styles.empty}>No hay datos</div>
              )}
            </CardContent>
          </ChartCard>

          {/* Heatmap de tendencias */}
          <ChartCard 
            className={styles.cardFull}
            title="Mapa de Calor por Año y Tipo"
            subtitle="Intensidad de hallazgos en el tiempo"
            downloadName="mapa-calor"
          >
            <CardContent className={styles.chartBoxMedium}>
              {dataHeatmap.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={dataHeatmap} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="year" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Fortaleza" fill={GREEN} stackId="a" />
                    <Bar dataKey="Oportunidad de Mejora" fill={AMBER} stackId="a" />
                    <Bar dataKey="No Conformidad" fill={RED} stackId="a" />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className={styles.empty}>No hay datos</div>
              )}
            </CardContent>
          </ChartCard>
        </>
      )}

      {vistaActiva === 'comparativa' && (
        <div className={styles.gridCharts}>
          <ChartCard 
            className={styles.cardWide}
            title="Comparativa Interanual"
            subtitle="Evolución año a año por tipo de hallazgo"
            downloadName="comparativa-interanual"
          >
            <CardContent className={styles.chartBoxTall}>
              {dataTimeline.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dataTimeline} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="anio" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="Fortaleza" 
                      stroke={GREEN} 
                      strokeWidth={3}
                      dot={{ r: 5 }}
                      activeDot={{ r: 8 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="Oportunidad de Mejora" 
                      stroke={AMBER} 
                      strokeWidth={3}
                      dot={{ r: 5 }}
                      activeDot={{ r: 8 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="No Conformidad" 
                      stroke={RED} 
                      strokeWidth={3}
                      dot={{ r: 5 }}
                      activeDot={{ r: 8 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className={styles.empty}>No hay datos</div>
              )}
            </CardContent>
          </ChartCard>

          {/* Análisis de Variación - no tiene gráfica, solo Card normal */}
          <Card>
            <CardHeader
              title="Análisis de Variación"
              subtitle={dataTimeline.length >= 2 
                ? `Comparación: ${variaciones.fortaleza.periodo1} vs ${variaciones.fortaleza.periodo2}`
                : "Requiere al menos 2 periodos para comparar"
              }
            />
            <CardContent>
              {dataTimeline.length >= 2 ? (
                <div className={styles.variacionList}>
                  <div className={styles.variacionItem}>
                    <div className={styles.variacionHeader}>
                      <span className={styles.variacionLabel} style={{ color: GREEN }}>✅ Fortalezas</span>
                      <div className={styles.variacionDetalle}>
                        <span className={styles.variacionPeriodo}>{variaciones.fortaleza.periodo1}: {variaciones.fortaleza.valorPeriodo1}</span>
                        <span className={styles.variacionArrow}>→</span>
                        <span className={styles.variacionPeriodo}>{variaciones.fortaleza.periodo2}: {variaciones.fortaleza.valorPeriodo2}</span>
                      </div>
                    </div>
                    <span className={cn(
                      styles.variacionValue, 
                      variaciones.fortaleza.valor >= 0 ? styles.variacionPositive : styles.variacionNegative
                    )}>
                      {variaciones.fortaleza.valor >= 0 ? '+' : ''}{variaciones.fortaleza.porcentaje.toFixed(1)}%
                      <span className={styles.variacionAbsoluta}>({variaciones.fortaleza.valor >= 0 ? '+' : ''}{variaciones.fortaleza.valor})</span>
                    </span>
                  </div>
                  <div className={styles.variacionItem}>
                    <div className={styles.variacionHeader}>
                      <span className={styles.variacionLabel} style={{ color: AMBER }}>⚠️ Oportunidades</span>
                      <div className={styles.variacionDetalle}>
                        <span className={styles.variacionPeriodo}>{variaciones.oportunidad.periodo1}: {variaciones.oportunidad.valorPeriodo1}</span>
                        <span className={styles.variacionArrow}>→</span>
                        <span className={styles.variacionPeriodo}>{variaciones.oportunidad.periodo2}: {variaciones.oportunidad.valorPeriodo2}</span>
                      </div>
                    </div>
                    <span className={cn(
                      styles.variacionValue,
                      variaciones.oportunidad.valor <= 0 ? styles.variacionPositive : styles.variacionNegative
                    )}>
                      {variaciones.oportunidad.valor >= 0 ? '+' : ''}{variaciones.oportunidad.porcentaje.toFixed(1)}%
                      <span className={styles.variacionAbsoluta}>({variaciones.oportunidad.valor >= 0 ? '+' : ''}{variaciones.oportunidad.valor})</span>
                    </span>
                  </div>
                  <div className={styles.variacionItem}>
                    <div className={styles.variacionHeader}>
                      <span className={styles.variacionLabel} style={{ color: RED }}>❌ No Conformidades</span>
                      <div className={styles.variacionDetalle}>
                        <span className={styles.variacionPeriodo}>{variaciones.noConformidad.periodo1}: {variaciones.noConformidad.valorPeriodo1}</span>
                        <span className={styles.variacionArrow}>→</span>
                        <span className={styles.variacionPeriodo}>{variaciones.noConformidad.periodo2}: {variaciones.noConformidad.valorPeriodo2}</span>
                      </div>
                    </div>
                    <span className={cn(
                      styles.variacionValue,
                      variaciones.noConformidad.valor <= 0 ? styles.variacionPositive : styles.variacionNegative
                    )}>
                      {variaciones.noConformidad.valor >= 0 ? '+' : ''}{variaciones.noConformidad.porcentaje.toFixed(1)}%
                      <span className={styles.variacionAbsoluta}>({variaciones.noConformidad.valor >= 0 ? '+' : ''}{variaciones.noConformidad.valor})</span>
                    </span>
                  </div>
                </div>
              ) : (
                <div className={styles.empty}>
                  No hay suficientes datos para calcular variaciones. Se requieren al menos 2 periodos.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {vistaActiva === 'distribucion' && (
        <div className={styles.gridCharts}>
          {/* Pie grande */}
          <ChartCard 
            className={styles.cardWide}
            title="Distribución Detallada por Tipo"
            subtitle={`Total de ${totalHallazgos} hallazgos registrados`}
            downloadName="distribucion-detallada"
          >
            <CardContent className={styles.chartBoxTall}>
              {porTipoGrafico.length ? (
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
                      labelLine={{ stroke: '#666', strokeWidth: 1 }}
                    >
                      {porTipoGrafico.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value, name, { payload }) => [
                        `${value} hallazgos (${(payload.percent * 100).toFixed(1)}%)`,
                        name
                      ]}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className={styles.empty}>No hay datos</div>
              )}
            </CardContent>
          </ChartCard>

          {/* Tabla resumen - no tiene gráfica, solo Card normal */}
          <Card>
            <CardHeader
              title="Resumen Numérico"
              subtitle="Valores absolutos y porcentajes"
            />
            <CardContent>
              <div className={styles.resumenTable}>
                <div className={styles.resumenRow}>
                  <div className={styles.resumenCell} style={{ borderLeft: `4px solid ${GREEN}` }}>
                    <span className={styles.resumenLabel}>Fortalezas</span>
                    <span className={styles.resumenValue}>{totalFortalezas}</span>
                    <span className={styles.resumenPercent}>
                      {totalHallazgos ? ((totalFortalezas / totalHallazgos) * 100).toFixed(1) : 0}%
                    </span>
                  </div>
                </div>
                <div className={styles.resumenRow}>
                  <div className={styles.resumenCell} style={{ borderLeft: `4px solid ${AMBER}` }}>
                    <span className={styles.resumenLabel}>Oportunidades</span>
                    <span className={styles.resumenValue}>{totalOportunidades}</span>
                    <span className={styles.resumenPercent}>
                      {totalHallazgos ? ((totalOportunidades / totalHallazgos) * 100).toFixed(1) : 0}%
                    </span>
                  </div>
                </div>
                <div className={styles.resumenRow}>
                  <div className={styles.resumenCell} style={{ borderLeft: `4px solid ${RED}` }}>
                    <span className={styles.resumenLabel}>No Conformidades</span>
                    <span className={styles.resumenValue}>{totalNoConformidades}</span>
                    <span className={styles.resumenPercent}>
                      {totalHallazgos ? ((totalNoConformidades / totalHallazgos) * 100).toFixed(1) : 0}%
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
