'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
  AreaChart, Area, LineChart, Line, RadarChart, Radar, 
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, ComposedChart
} from 'recharts'
import { Check, ChevronDown, Download, RefreshCw, TrendingUp, Calendar, Filter, X } from 'lucide-react'
import * as SelectPrimitive from '@radix-ui/react-select'
import styles from './VistaEstadisticas.module.css'
import * as XLSX from 'xlsx'

// Paleta coherente (brand + semáforos)
const BRAND = '#667eea'        // purple-600
const BRAND_LIGHT = '#8b9bf7'
const GREEN = '#10b981'        // fortalezas
const AMBER = '#f59e0b'        // oportunidades
const RED   = '#ef4444'        // no conformidades
const CYAN = '#06b6d4'
const INDIGO = '#6366f1'
const PINK = '#ec4899'
const PIE_COLORS = [GREEN, AMBER, RED]
const MULTI_COLORS = [BRAND, GREEN, AMBER, RED, CYAN, INDIGO, PINK]

const cn = (...classes) => classes.filter(Boolean).join(' ')

// helpers (arriba del componente)
const toNum = (v) => Number(v) || 0
const norm = (s) => String(s ?? '').trim().toLowerCase()
const strip = (s) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '')

const normalizeTipo = (t) => {
  const k = norm(t)
  if (k.startsWith('fort')) return 'Fortaleza'
  if (k.startsWith('oport')) return 'Oportunidad de Mejora'
  if (k.startsWith('no con')) return 'No Conformidad'
  return 'OTRO'
}

const normalizeGestion = (g) => {
  const val = norm(g)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
  if (!val) return ''
  const allowed = ['estrategica', 'academica', 'investigacion', 'administrativa', 'cultura', 'control', 'otras']
  return allowed.includes(val) ? val : ''
}

const depNombre = (d) => (typeof d === 'string' ? d : d?.nombre || '')
const depGestion = (d) => (typeof d === 'object' && d ? d.gestion : undefined)

const getGestionFromDependencia = (dep, gestionHint) => {
  const normalized = normalizeGestion(gestionHint)
  return normalized || 'otras'
}

// -------------------- Gestiones (pestañas) --------------------
const GESTION_TABS = [
  { key: 'todas', label: 'Todas', icon: '🌐' },
  { key: 'estrategica', label: 'Estratégica', icon: '🎯' },
  { key: 'academica', label: 'Académica', icon: '📚' },
  { key: 'investigacion', label: 'Investigación', icon: '🔬' },
  { key: 'administrativa', label: 'Administrativa', icon: '🏢' },
  { key: 'cultura', label: 'Cultura', icon: '🎭' },
  { key: 'control', label: 'Control', icon: '✅' },
  { key: 'otras', label: 'Otras', icon: '📋' },
]

// Períodos de comparación
const PERIODOS_COMPARACION = [
  { key: 'ninguno', label: 'Sin comparación' },
  { key: 'anio_anterior', label: 'Año anterior' },
  { key: 'semestre_anterior', label: 'Semestre anterior' },
  { key: 'custom', label: 'Período personalizado' },
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
const KPI = ({ label, value, accent = 'default' }) => (
  <div className={cn(styles.kpi, styles[`kpi_${accent}`])}>
    <p className={styles.kpiLabel}>{label}</p>
    <p className={styles.kpiValue}>{value}</p>
  </div>
)
const Button = ({ children, className = '', variant = 'default', ...props }) => (
  <button
    className={cn(styles.btn, styles[`btn_${variant}`], className)}
    {...props}
  >{children}</button>
)

// -------------------- Radix Select wrappers --------------------
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
      <Check className="h-4 w-4 text-purple-600" />
    </SelectPrimitive.ItemIndicator>
  </SelectPrimitive.Item>
)

// -------------------- Página --------------------
export default function VistaEstadisticas() {
  // Dataset unificado recomendado desde la API: [{ anio, dependencia, tipo, cantidad, iso }]
  const [detalle, setDetalle] = useState([])

  // Back-compat con datasets antiguos
  const [dataResumen, setDataResumen] = useState([]) // resumenPorDependencia
  const [porTipo, setPorTipo] = useState([])         // resumenPorTipo

  const [filtroAnio, setFiltroAnio] = useState('todos')
  const [filtroDependencia, setFiltroDependencia] = useState('todas')
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [filtroIso, setFiltroIso] = useState('todos')
  const [filtroGestion, setFiltroGestion] = useState('todas')

  const [aniosDisponibles, setAniosDisponibles] = useState([])
  const [dependenciasDisponibles, setDependenciasDisponibles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const s = (v) => (v == null ? '' : String(v))

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

        console.log('📊 detalleApi[0]:', detalleApi?.[0])
        console.log('📊 Total items en detalle:', detalleApi?.length)
        console.log('📊 dependencias array:', dependencias)

        // detalleApi se guarda tal cual para conservar campos extra (iso, etc.)
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

  // -------------------- Filtrado unificado --------------------
  const detalleBase = useMemo(() => {
  if (detalle.length) {
    // Normalizamos siempre tipo e ISO
    const normalized = detalle.map(it => ({
      ...it,
      tipo: normalizeTipo(it.tipo),
      // aquí miramos varios nombres posibles
      iso: it.iso ?? it.iso_id ?? it.isoId ?? null,
      gestion: getGestionFromDependencia(it.dependencia, it.gestion),
    }))
    
    const gestiones = [...new Set(normalized.map(x => x.gestion))]
    console.log('📊 detalleBase[0] normalizado:', normalized[0])
    console.log('📊 Gestiones únicas:', gestiones)
    console.log('📊 Primera gestión detectada:', gestiones[0])
    console.log('📊 Ejemplo de dependencia y gestión:', {
      dependencia: normalized[0]?.dependencia,
      gestionDB: normalized[0]?.gestion,
      gestionCalculada: getGestionFromDependencia(normalized[0]?.dependencia, normalized[0]?.gestion)
    })
    
    return normalized
  }

  // Fallback: intenta derivar del porTipo si trae campos suficientes
  const tieneCampos = porTipo.some(
    i => 'tipo' in i && 'cantidad' in i && ('anio' in i || 'dependencia' in i)
  )

  if (tieneCampos) {
    return porTipo.map(i => ({
      anio: i.anio ?? null,
      dependencia: i.dependencia ?? null,
      tipo: normalizeTipo(i.tipo),
      cantidad: toNum(i.cantidad),
      iso: i.iso ?? i.iso_id ?? null,   // por si el resumen trae algo de ISO
      gestion: getGestionFromDependencia(i.dependencia, i.gestion),
    }))
  }

  return []
}, [detalle, porTipo])

  const dependenciasFiltradas = useMemo(() => {
    // Si tenemos detalleBase (caso normal)
    if (detalleBase.length) {
      const set = new Set()

      detalleBase.forEach(it => {
        if (!it.dependencia) return

        const okAnio = filtroAnio === 'todos' || s(it.anio) === s(filtroAnio)
        const okTipo = filtroTipo === 'todos' || s(it.tipo) === s(filtroTipo)
        const okIso  = filtroIso === 'todos'  || s(it.iso)  === s(filtroIso)

        const gestionItem = getGestionFromDependencia(it.dependencia, it.gestion)
        const okGestion = filtroGestion === 'todas' || gestionItem === filtroGestion

        if (okAnio && okTipo && okIso && okGestion) {
          set.add(s(it.dependencia))
        }
      })

      return Array.from(set).sort()
    }

    // Fallback: si por alguna razón no hay detalleBase,
    // usamos la lista que viene de la API filtrada por gestión
    if (dependenciasDisponibles.length) {
      const list = dependenciasDisponibles.map((dep) => ({
        nombre: depNombre(dep),
        gestion: getGestionFromDependencia(depNombre(dep), depGestion(dep)),
      }))

      const filtradas = filtroGestion === 'todas'
        ? list
        : list.filter((d) => d.gestion === filtroGestion)

      return filtradas
        .map((d) => d.nombre)
        .filter(Boolean)
        .sort()
    }

    return []
  }, [detalleBase, dependenciasDisponibles, filtroAnio, filtroTipo, filtroIso, filtroGestion])

  useEffect(() => {
    if (
      filtroDependencia !== 'todas' &&
      !dependenciasFiltradas.includes(filtroDependencia)
    ) {
      setFiltroDependencia('todas')
    }
  }, [filtroDependencia, dependenciasFiltradas])

  const detalleFiltrado = useMemo(() => {
    const filtered = detalleBase.filter(item => {
      const okAnio = filtroAnio === 'todos' || s(item.anio) === s(filtroAnio)
      const okDep  = filtroDependencia === 'todas' || s(item.dependencia) === s(filtroDependencia)
      const okTipo = filtroTipo === 'todos' || s(item.tipo) === s(filtroTipo)
      const okIso  = filtroIso === 'todos' || s(item.iso) === s(filtroIso)
      const gestionItem = getGestionFromDependencia(item.dependencia, item.gestion)
      const okGestion = filtroGestion === 'todas' || gestionItem === filtroGestion
      return okAnio && okDep && okTipo && okIso && okGestion
    })
    
    console.log('📊 filtroGestion actual:', filtroGestion)
    console.log('📊 Items después de filtrar:', filtered.length)
    if (filtroGestion !== 'todas') {
      console.log('📊 Ejemplo de item filtrado:', filtered[0])
    }
    
    return filtered
  }, [detalleBase, filtroAnio, filtroDependencia, filtroTipo, filtroIso, filtroGestion])

  // --------- BARRAS (por dependencia) ---------
  const dataBar = useMemo(() => {
    if (!detalleBase.length) {
      // Degradación: aplica filtros posibles sobre el resumen
      return dataResumen.filter(item => {
        const okAnio = filtroAnio === 'todos' || s(item.anio) === s(filtroAnio)
        const okDep  = filtroDependencia === 'todas' || s(item.dependencia) === s(filtroDependencia)
        const okIso  = filtroIso === 'todos' || s(item.iso) === s(filtroIso)
        const gestionItem = getGestionFromDependencia(item.dependencia, item.gestion)
        const okGestion = filtroGestion === 'todas' || gestionItem === filtroGestion
        return okAnio && okDep && okIso && okGestion
      })
    }
    const map = new Map()
    for (const it of detalleFiltrado) {
      const key = s(it.dependencia) || 'SIN_DEP'
      map.set(key, (map.get(key) || 0) + toNum(it.cantidad))
    }
    return Array.from(map, ([dependencia, cantidad]) => ({ dependencia, cantidad }))
  }, [detalleBase, detalleFiltrado, dataResumen, filtroAnio, filtroDependencia, filtroIso, filtroGestion])

  // --------- PIE (por tipo) ---------
  const porTipoGrafico = useMemo(() => {
    if (!detalleBase.length) {
      const base = porTipo.filter(i => {
        const okTipo = filtroTipo === 'todos' || s(i.tipo) === s(filtroTipo)
        const okAnio = filtroAnio === 'todos' || s(i.anio) === s(filtroAnio)
        const okDep  = filtroDependencia === 'todas' || s(i.dependencia) === s(filtroDependencia)
        const okIso  = filtroIso === 'todos' || s(i.iso) === s(filtroIso)
        const gestionItem = getGestionFromDependencia(i.dependencia, i.gestion)
        const okGestion = filtroGestion === 'todas' || gestionItem === filtroGestion
        return okTipo && okAnio && okDep && okIso && okGestion
      })

      const map = new Map()
      for (const it of base) {
        const key = s(it.tipo) || 'SIN_TIPO'
        map.set(key, (map.get(key) || 0) + (it.cantidad || 0))
      }
      return Array.from(map, ([tipo, cantidad]) => ({ tipo, cantidad }))
    }

    const map = new Map()
    for (const it of detalleFiltrado) {
      const key = normalizeTipo(it.tipo)
      map.set(key, (map.get(key) || 0) + toNum(it.cantidad))
    }
    return Array.from(map, ([tipo, cantidad]) => ({ tipo, cantidad }))
  }, [detalleBase, detalleFiltrado, porTipo, filtroTipo, filtroAnio, filtroDependencia, filtroIso, filtroGestion])

  // --------- TIMELINE (stacked áreas por año) ---------
  // Ignoramos el filtro de tipo para mostrar SIEMPRE las 3 categorías simultáneamente.
  const dataTimeline = useMemo(() => {
    const base = detalleBase.filter(it => {
      const okAnio = filtroAnio === 'todos' || s(it.anio) === s(filtroAnio)
      const okDep  = filtroDependencia === 'todas' || s(it.dependencia) === s(filtroDependencia)
      const okIso  = filtroIso === 'todos' || s(it.iso) === s(filtroIso)
      const gestionItem = getGestionFromDependencia(it.dependencia, it.gestion)
      const okGestion = filtroGestion === 'todas' || gestionItem === filtroGestion
      return okAnio && okDep && okIso && okGestion
    })

    const map = new Map() // anio => { Fortaleza, Oportunidad de Mejora, No Conformidad }
    for (const it of base) {
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
    // Ordenar por año ascendente si es numérico
    arr.sort((a, b) => Number(a.anio) - Number(b.anio))
    return arr
  }, [detalleBase, filtroAnio, filtroDependencia, filtroIso, filtroGestion])

  // --------- Totales y catálogos ---------
  const totalHallazgos = porTipoGrafico.reduce((sum, i) => sum + i.cantidad, 0)
  const findTotal = (k) => porTipoGrafico.find(i => i.tipo === k)?.cantidad ?? 0
  const totalFortalezas = findTotal('Fortaleza')
  const totalOportunidades = findTotal('Oportunidad de Mejora')
  const totalNoConformidades = findTotal('No Conformidad')

  const tiposDisponibles = Array.from(new Set(
    (detalleBase.length ? detalleBase : porTipo).map(p => p.tipo).filter(Boolean)
  ))

  // --------- Interacción: ocultar series en timeline ---------
  const [hidden, setHidden] = useState({
    Fortaleza: false,
    'Oportunidad de Mejora': false,
    'No Conformidad': false
  })
  const toggleSeries = (key) => setHidden(prev => ({ ...prev, [key]: !prev[key] }))

  // --------- Loading / Error ---------
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
          <CardHeader title="Estadísticas de Hallazgos" subtitle="" />
          <CardContent>
            <p className={styles.error}>{error}</p>
            <Button variant="outline" onClick={() => location.reload()}>Reintentar</Button>
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
              <h1 className={styles.headerTitle}>Estadísticas de Hallazgos</h1>
              <p className={styles.headerSubtitle}>Panel interactivo por gestión, año, dependencia, tipo e ISO</p>
            </div>
          </div>
        </div>
      </div>

      {/* FILTROS PRINCIPALES */}
      <div className={styles.filterCard}>
        <div className={styles.filterRow}>
          {/* Año */}
          <div className={styles.filterItem}>
            <label className={styles.filterLabel}>Año</label>
            <Select value={filtroAnio} onValueChange={setFiltroAnio}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un año" />
                <ChevronDown className={styles.chevron} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {aniosDisponibles.map(anio => (
                  <SelectItem key={String(anio)} value={String(anio)}>{anio}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Dependencia */}
          <div className={styles.filterItem}>
            <label className={styles.filterLabel}>Dependencia</label>
            <Select value={filtroDependencia} onValueChange={setFiltroDependencia}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona una dependencia" />
                <ChevronDown className={styles.chevron} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {dependenciasFiltradas.map(dep => (
                  <SelectItem key={dep} value={dep}>
                    {dep}
                  </SelectItem>
                ))}

              </SelectContent>
            </Select>
          </div>

          {/* Tipo */}
          <div className={styles.filterItem}>
            <label className={styles.filterLabel}>Tipo de hallazgo</label>
            <Select value={filtroTipo} onValueChange={setFiltroTipo}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un tipo" />
                <ChevronDown className={styles.chevron} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {tiposDisponibles.map(tipo => (
                  <SelectItem key={String(tipo)} value={String(tipo)}>{tipo}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>


          {(filtroAnio !== 'todos' ||
            filtroDependencia !== 'todas' ||
            filtroTipo !== 'todos' ||
            filtroIso !== 'todos' ||
            filtroGestion !== 'todas') && (
            <Button
              variant="outline"
              onClick={() => {
                setFiltroAnio('todos')
                setFiltroDependencia('todas')
                setFiltroTipo('todos')
                setFiltroIso('todos')
                setFiltroGestion('todas')
              }}
            >
              Limpiar
            </Button>
          )}
        </div>
      </div>

      {/* PESTAÑAS DE GESTIÓN */}
      <div className={styles.tabsRow}>
        {GESTION_TABS.map(tab => (
          <button
            key={tab.key}
            className={cn(
              styles.tabBtn,
              filtroGestion === tab.key && styles.tabBtnActive
            )}
            onClick={() => setFiltroGestion(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* KPIs */}
      <div className={styles.kpiRow}>
        <KPI label="Total Hallazgos" value={totalHallazgos} accent="brand" />
        <KPI label="Fortalezas" value={totalFortalezas} accent="green" />
        <KPI label="Oportunidades de Mejora" value={totalOportunidades} accent="amber" />
        <KPI label="No Conformidades" value={totalNoConformidades} accent="red" />
        <KPI label="Dependencias" value={dependenciasFiltradas.length} />
      </div>

      {/* Gráficas */}
      <div className={styles.gridCharts}>
        {/* Barras por dependencia */}
        <Card>
          <CardHeader
            title="Hallazgos por dependencia"
            subtitle={filtroAnio === 'todos' ? 'Todos los años' : `Año ${filtroAnio}`}
          />
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
                    height={50}
                  />
                  <YAxis allowDecimals={false} tick={{ fill: '#1e293b' }} />
                  <Tooltip wrapperStyle={{ outline: 'none' }} />
                  <Bar dataKey="cantidad" fill={BRAND} radius={[6, 6, 0, 0]} isAnimationActive />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className={styles.empty}>No hay datos para esta combinación de filtros.</div>
            )}
          </CardContent>
        </Card>

        {/* Pie por tipo */}
        <Card>
          <CardHeader
            title="Distribución por tipo"
            subtitle={`Total: ${totalHallazgos}`}
          />
          <CardContent className={styles.chartBox}>
            {porTipoGrafico.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 12, right: 12, bottom: 12, left: 12 }}>
                  <Pie data={porTipoGrafico} dataKey="cantidad" nameKey="tipo" cx="50%" cy="50%" outerRadius={96}>
                    {porTipoGrafico.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, _name, { payload }) => {
                      const pct = payload?.percent != null ? ` (${(payload.percent * 100).toFixed(0)}%)` : ''
                      return [`${value}${pct}`, payload?.tipo || 'Tipo']
                    }}
                    wrapperStyle={{ outline: 'none' }}
                    contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={24} 
                    iconType="circle" 
                    wrapperStyle={{ color: '#1e293b', fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className={styles.empty}>No hay datos para esta combinación de filtros.</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Timeline stacked por año */}
      <Card>
        <CardHeader
          title="Evolución anual por tipo"
          subtitle={
            filtroDependencia === 'todas'
              ? 'Todas las dependencias'
              : `Dependencia: ${filtroDependencia}`
          }
          right={(
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
          )}
        />
        <CardContent className={styles.chartBoxTall}>
          {dataTimeline.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dataTimeline} margin={{ top: 8, right: 18, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="anio" tick={{ fontSize: 12, fill: '#1e293b' }} />
                <YAxis allowDecimals={false} tick={{ fill: '#1e293b' }} />
                <Tooltip wrapperStyle={{ outline: 'none' }} />
                {!hidden['Fortaleza'] && (
                  <Area
                    type="monotone"
                    dataKey="Fortaleza"
                    stroke={GREEN}
                    fill={GREEN}
                    fillOpacity={0.18}
                    strokeWidth={2}
                  />
                )}
                {!hidden['Oportunidad de Mejora'] && (
                  <Area
                    type="monotone"
                    dataKey="Oportunidad de Mejora"
                    stroke={AMBER}
                    fill={AMBER}
                    fillOpacity={0.18}
                    strokeWidth={2}
                  />
                )}
                {!hidden['No Conformidad'] && (
                  <Area
                    type="monotone"
                    dataKey="No Conformidad"
                    stroke={RED}
                    fill={RED}
                    fillOpacity={0.18}
                    strokeWidth={2}
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className={styles.empty}>No hay datos para construir la línea de tiempo.</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
