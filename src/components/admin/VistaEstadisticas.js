'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
  AreaChart, Area
} from 'recharts'
import { Check, ChevronDown } from 'lucide-react'
import * as SelectPrimitive from '@radix-ui/react-select'
import styles from './VistaEstadisticas.module.css'

// Paleta coherente (brand + semáforos)
const BRAND = '#4a47e2ff'        // purple-600
const GREEN = '#55d187ff'        // fortalezas
const AMBER = '#ece13fff'        // oportunidades
const RED   = '#e41818ff'        // no conformidades
const PIE_COLORS = [GREEN, AMBER, RED]

const cn = (...classes) => classes.filter(Boolean).join(' ')

// helpers (arriba del componente)
const toNum = (v) => Number(v) || 0
const norm = (s) => String(s ?? '').trim().toLowerCase()

const normalizeTipo = (t) => {
  const k = norm(t)
  if (k.startsWith('fort')) return 'Fortaleza'
  if (k.startsWith('oport')) return 'Oportunidad de Mejora'
  if (k.startsWith('no con')) return 'No Conformidad'
  return 'OTRO'
}

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
  // Dataset unificado recomendado desde la API: [{ anio, dependencia, tipo, cantidad }]
  const [detalle, setDetalle] = useState([])

  // Back-compat con datasets antiguos
  const [dataResumen, setDataResumen] = useState([]) // resumenPorDependencia
  const [porTipo, setPorTipo] = useState([])         // resumenPorTipo

  const [filtroAnio, setFiltroAnio] = useState('todos')
  const [filtroDependencia, setFiltroDependencia] = useState('todas')
  const [filtroTipo, setFiltroTipo] = useState('todos')
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
    if (detalle.length) return detalle

    // Fallback: intenta derivar del porTipo si trae campos suficientes
    const tieneCampos = porTipo.some(i => 'tipo' in i && 'cantidad' in i && ('anio' in i || 'dependencia' in i))
    if (tieneCampos) return porTipo.map(i => ({
      anio: i.anio ?? null,
      dependencia: i.dependencia ?? null,
      tipo: normalizeTipo(i.tipo),
      cantidad: toNum(i.cantidad),
    }))
    return []
  }, [detalle, porTipo])

  const detalleFiltrado = useMemo(() => {
    return detalleBase.filter(item => {
      const okAnio = filtroAnio === 'todos' || s(item.anio) === s(filtroAnio)
      const okDep  = filtroDependencia === 'todas' || s(item.dependencia) === s(filtroDependencia)
      const okTipo = filtroTipo === 'todos' || s(item.tipo) === s(filtroTipo)
      return okAnio && okDep && okTipo
    })
  }, [detalleBase, filtroAnio, filtroDependencia, filtroTipo])

  // --------- BARRAS (por dependencia) ---------
  const dataBar = useMemo(() => {
    if (!detalleBase.length) {
      // Degradación: aplica solo filtros disponibles sobre el resumen
      return dataResumen.filter(item => {
        const okAnio = filtroAnio === 'todos' || s(item.anio) === s(filtroAnio)
        const okDep  = filtroDependencia === 'todas' || s(item.dependencia) === s(filtroDependencia)
        return okAnio && okDep
      })
    }
    const map = new Map()
    for (const it of detalleFiltrado) {
 const key = s(it.dependencia) || 'SIN_DEP'
 map.set(key, (map.get(key) || 0) + toNum(it.cantidad))
    }
    return Array.from(map, ([dependencia, cantidad]) => ({ dependencia, cantidad }))
  }, [detalleBase, detalleFiltrado, dataResumen, filtroAnio, filtroDependencia])

  // --------- PIE (por tipo) ---------
  const porTipoGrafico = useMemo(() => {
    if (!detalleBase.length) {
      const base = porTipo.filter(i => (filtroTipo === 'todos' ? true : s(i.tipo) === s(filtroTipo)))
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
  }, [detalleBase, detalleFiltrado, porTipo, filtroTipo])

  // --------- TIMELINE (stacked áreas por año) ---------
  // Ignoramos el filtro de tipo para mostrar SIEMPRE las 3 categorías simultáneamente.
  const dataTimeline = useMemo(() => {
    const base = detalleBase.filter(it => {
      const okAnio = filtroAnio === 'todos' || s(it.anio) === s(filtroAnio)
      const okDep  = filtroDependencia === 'todas' || s(it.dependencia) === s(filtroDependencia)
      return okAnio && okDep
    })
    const map = new Map() // anio => { Fortaleza, Oportunidad de Mejora, No Conformidad }
    for (const it of base) {
      const year = s(it.anio) || 'SIN_AÑO'
      if (!map.has(year)) map.set(year, { anio: year, Fortaleza: 0, 'Oportunidad de Mejora': 0, 'No Conformidad': 0 })
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
  }, [detalleBase, filtroAnio, filtroDependencia])

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
  const [hidden, setHidden] = useState({ Fortaleza: false, 'Oportunidad de Mejora': false, 'No Conformidad': false })
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
      {/* HEADER */}
      <div className={styles.headerRow}>
        <div>
          <h2 className={styles.title}>Estadísticas de Hallazgos</h2>
          <p className={styles.subtitle}>Panel interactivo por año, dependencia y tipo</p>
        </div>

        {/* Filtros principales */}
        <div className={styles.filters}>
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
                {dependenciasDisponibles.map(dep => (
                  <SelectItem key={String(dep)} value={String(dep)}>{dep}</SelectItem>
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

          {(filtroAnio !== 'todos' || filtroDependencia !== 'todas' || filtroTipo !== 'todos') && (
            <Button
              variant="outline"
              onClick={() => { setFiltroAnio('todos'); setFiltroDependencia('todas'); setFiltroTipo('todos') }}
            >Limpiar</Button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className={styles.kpiRow}>
        <KPI label="Total Hallazgos" value={totalHallazgos} accent="brand" />
        <KPI label="Fortalezas" value={totalFortalezas} accent="green" />
        <KPI label="Oportunidades de Mejora" value={totalOportunidades} accent="amber" />
        <KPI label="No Conformidades" value={totalNoConformidades} accent="red" />
        <KPI label="Dependencias" value={dependenciasDisponibles.length}/>
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
                <BarChart data={dataBar} margin={{ top: 6, right: 12, bottom: 6, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dependencia" tick={{ fontSize: 0 }} interval={0} angle={-25} textAnchor="end" height={8} />
                  <YAxis allowDecimals={false} />
                  <Tooltip wrapperStyle={{ outline: 'none' }} />
                  <Bar dataKey="cantidad" fill={BRAND} radius={[6,6,0,0]} isAnimationActive />
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
                  />
                  <Legend verticalAlign="bottom" height={24} iconType="circle" />
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
          subtitle={filtroDependencia === 'todas' ? 'Todas las dependencias' : `Dependencia: ${filtroDependencia}`}
          right={(
            <div className={styles.legendToggles}>
              {[
                { k: 'Fortaleza', c: GREEN },
                { k: 'Oportunidad de Mejora', c: AMBER },
                { k: 'No Conformidad', c: RED },
              ].map(({ k, c }) => (
                <button key={k} className={cn(styles.legendBtn, hidden[k] && styles.legendBtn_off)} onClick={() => toggleSeries(k)}>
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
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="anio" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} />
                <Tooltip wrapperStyle={{ outline: 'none' }} />
                {!hidden['Fortaleza'] && (
                  <Area type="monotone" dataKey="Fortaleza" stroke={GREEN} fill={GREEN} fillOpacity={0.18} strokeWidth={2} />
                )}
                {!hidden['Oportunidad de Mejora'] && (
                  <Area type="monotone" dataKey="Oportunidad de Mejora" stroke={AMBER} fill={AMBER} fillOpacity={0.18} strokeWidth={2} />
                )}
                {!hidden['No Conformidad'] && (
                  <Area type="monotone" dataKey="No Conformidad" stroke={RED} fill={RED} fillOpacity={0.18} strokeWidth={2} />
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