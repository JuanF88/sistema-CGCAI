'use client'

import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts'
import { Check, ChevronDown } from 'lucide-react'
import * as SelectPrimitive from '@radix-ui/react-select'

const COLORS = ['#dd6bd7ff', '#8c28ffff', '#700158ff']

const cn = (...classes) => classes.filter(Boolean).join(' ')

// -------------------- UI --------------------
const Card = ({ children }) => (
  <div className="bg-white shadow-md rounded-2xl p-4 border border-gray-200">
    {children}
  </div>
)

const CardContent = ({ children, className = '' }) => (
  <div className={`p-2 ${className}`}>{children}</div>
)

const Label = ({ children, className = '' }) => (
  <label className={cn('text-sm font-medium leading-none', className)}>{children}</label>
)

const Button = ({ children, className = '', variant = 'default', ...props }) => {
  const baseStyle =
    'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none'
  const variants = {
    default: 'bg-purple-600 text-white hover:bg-purple-700',
    outline: 'border border-gray-300 text-gray-800 hover:bg-gray-100',
  }
  return (
    <button className={`${baseStyle} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  )
}

const Select = SelectPrimitive.Root
const SelectValue = SelectPrimitive.Value
const SelectTrigger = SelectPrimitive.Trigger
const SelectContent = ({ children, className = '', ...props }) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      sideOffset={4}
      className={cn(
        'z-[9999] min-w-[10rem] rounded-md border border-gray-300 bg-white shadow-md text-sm text-gray-900',
        'focus:outline-none',
        className
      )}
      {...props}
    >
      <SelectPrimitive.Viewport className="p-1">
        {children}
      </SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
)

const SelectItem = ({ children, value }) => (
  <SelectPrimitive.Item
    value={value}
    className="cursor-pointer select-none px-3 py-2 rounded-sm hover:bg-purple-100 focus:bg-purple-100 focus:outline-none"
  >
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    <SelectPrimitive.ItemIndicator className="absolute right-2">
      <Check className="h-4 w-4 text-purple-600" />
    </SelectPrimitive.ItemIndicator>
  </SelectPrimitive.Item>
)

// -------------------- PAGE --------------------
export default function VistaEstadisticas() {
  // Dataset unificado recomendado desde la API: [{ anio, dependencia, tipo, cantidad }]
  const [detalle, setDetalle] = useState([])

  // También admitimos datasets “viejos” para backwards-compat
  const [dataResumen, setDataResumen] = useState([]) // resumenPorDependencia
  const [porTipo, setPorTipo] = useState([])         // resumenPorTipo

  const [filtroAnio, setFiltroAnio] = useState('todos')
  const [filtroDependencia, setFiltroDependencia] = useState('todas')
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [aniosDisponibles, setAniosDisponibles] = useState([])
  const [dependenciasDisponibles, setDependenciasDisponibles] = useState([])

  const s = (v) => (v == null ? '' : String(v))

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/estadisticas')
        if (!res.ok) throw new Error('Error en la API')

        const json = await res.json()
        const {
          detalle: detalleApi = [],               // 👈 preferido
          resumenPorDependencia = [],
          resumenPorTipo = [],
          anios = [],
          dependencias = []
        } = json

        // Guardamos datasets crudos
        setDetalle(Array.isArray(detalleApi) ? detalleApi : [])
        setDataResumen(resumenPorDependencia ?? [])
        setPorTipo(resumenPorTipo ?? [])

        // Catálogos
        setAniosDisponibles(anios ?? [])
        setDependenciasDisponibles(dependencias ?? [])

        // Degradación si la API aún no envía `detalle`
        if ((!detalleApi || !detalleApi.length) && (resumenPorDependencia.length || resumenPorTipo.length)) {
          console.warn(
            '[VistaEstadisticas] La API no envió `detalle`. ' +
            'Los filtros por (año/dependencia/tipo) no afectarán ambas gráficas al 100%. ' +
            'Recomendado: enviar `detalle: [{ anio, dependencia, tipo, cantidad }]`.'
          )
        }
      } catch (error) {
        console.error('Error cargando estadísticas:', error)
      }
    }

    fetchData()
  }, [])

  // -------------------- FILTRADO UNIFICADO --------------------
  // Preferimos `detalle`. Si no existe, intentamos construir algo aproximado:
  const detalleBase = (() => {
    if (detalle.length) return detalle

    // Fallback 1: si `resumenPorTipo` tiene anio/dep/tipo, úsalo
    const tieneCampos = porTipo.some(i => 'tipo' in i && 'cantidad' in i && ('anio' in i || 'dependencia' in i))
    if (tieneCampos) return porTipo.map(i => ({
      anio: i.anio ?? null,
      dependencia: i.dependencia ?? null,
      tipo: i.tipo ?? 'SIN_TIPO',
      cantidad: i.cantidad ?? 0,
    }))

    // Fallback 2: último recurso: compón con lo que hay (pierdes granularidad)
    // - Si solo hay `resumenPorTipo`, no hay forma de aplicar año/dep de forma correcta.
    // - Si solo hay `resumenPorDependencia`, no hay `tipo` para el pie.
    // Creamos dataset vacío para no romper la UI.
    return []
  })()

  // Aplica TODOS los filtros
  const detalleFiltrado = detalleBase.filter(item => {
    const okAnio = filtroAnio === 'todos' || s(item.anio) === s(filtroAnio)
    const okDep = filtroDependencia === 'todas' || s(item.dependencia) === s(filtroDependencia)
    const okTipo = filtroTipo === 'todos' || s(item.tipo) === s(filtroTipo)
    return okAnio && okDep && okTipo
  })

  // Agrupar por dependencia para la BARRA
  const dataBar = (() => {
    // Si no hay `detalle`, degradamos a `dataResumen` con filtros parciales (año/dep)
    if (!detalleBase.length) {
      return dataResumen.filter(item => {
        const okAnio = filtroAnio === 'todos' || s(item.anio) === s(filtroAnio)
        const okDep = filtroDependencia === 'todas' || s(item.dependencia) === s(filtroDependencia)
        return okAnio && okDep
      })
    }

    const map = new Map()
    for (const it of detalleFiltrado) {
      const key = s(it.dependencia) || 'SIN_DEP'
      const prev = map.get(key) || 0
      map.set(key, prev + (it.cantidad || 0))
    }
    return Array.from(map, ([dependencia, cantidad]) => ({ dependencia, cantidad }))
  })()

  // Agrupar por tipo para el PIE
  const porTipoGrafico = (() => {
    if (!detalleBase.length) {
      // Degradación: usa `porTipo` filtrando solo por tipo (si `anio/dep` no existen, no hay como aplicar)
      const base = porTipo.filter(i =>
        filtroTipo === 'todos' ? true : s(i.tipo) === s(filtroTipo)
      )
      const map = new Map()
      for (const it of base) {
        const key = s(it.tipo) || 'SIN_TIPO'
        const prev = map.get(key) || 0
        map.set(key, prev + (it.cantidad || 0))
      }
      return Array.from(map, ([tipo, cantidad]) => ({ tipo, cantidad }))
    }

    const map = new Map()
    for (const it of detalleFiltrado) {
      const key = s(it.tipo) || 'SIN_TIPO'
      const prev = map.get(key) || 0
      map.set(key, prev + (it.cantidad || 0))
    }
    return Array.from(map, ([tipo, cantidad]) => ({ tipo, cantidad }))
  })()

  // Totales (desde el mismo origen del pie, para coherencia)
  const totalHallazgos = porTipoGrafico.reduce((sum, i) => sum + i.cantidad, 0)
  const findTotal = (k) => porTipoGrafico.find(i => i.tipo === k)?.cantidad ?? 0
  const totalFortalezas = findTotal('Fortaleza')
  const totalOportunidades = findTotal('Oportunidad de Mejora')
  const totalNoConformidades = findTotal('No Conformidad')

  // Tipos disponibles (únicos)
  const tiposDisponibles = Array.from(new Set(
    (detalleBase.length ? detalleBase : porTipo).map(p => p.tipo).filter(Boolean)
  ))

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Estadísticas de Hallazgos</h2>

      {/* RESUMEN GENERAL */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-purple-100 text-purple-800 p-4 rounded-xl shadow-sm">
          <p className="text-xs uppercase font-semibold">Total Hallazgos</p>
          <p className="text-2xl font-bold">{totalHallazgos}</p>
        </div>
        <div className="bg-green-100 text-green-800 p-4 rounded-xl shadow-sm">
          <p className="text-xs uppercase font-semibold">Fortalezas</p>
          <p className="text-2xl font-bold">{totalFortalezas}</p>
        </div>
        <div className="bg-yellow-100 text-yellow-800 p-4 rounded-xl shadow-sm">
          <p className="text-xs uppercase font-semibold">Oportunidades de mejora</p>
          <p className="text-2xl font-bold">{totalOportunidades}</p>
        </div>
        <div className="bg-red-100 text-red-800 p-4 rounded-xl shadow-sm">
          <p className="text-xs uppercase font-semibold">No conformidades</p>
          <p className="text-2xl font-bold">{totalNoConformidades}</p>
        </div>
        <div className="bg-blue-100 text-blue-800 p-4 rounded-xl shadow-sm">
          <p className="text-xs uppercase font-semibold">Dependencias</p>
          <p className="text-2xl font-bold">{dependenciasDisponibles.length}</p>
        </div>
      </div>

      {/* FILTROS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
        {/* AÑO */}
        <div className="space-y-1">
          <Label>Año</Label>
          <Select onValueChange={setFiltroAnio} value={filtroAnio}>
            <SelectTrigger className="w-full bg-white border shadow-sm px-3 py-2 rounded-md">
              <SelectValue placeholder="Selecciona un año" />
              <ChevronDown className="h-4 w-4 ml-2 opacity-50" />
            </SelectTrigger>
            <SelectContent className="w-[--radix-select-trigger-width]">
              <SelectItem value="todos">Todos</SelectItem>
              {aniosDisponibles.map(anio => (
                <SelectItem key={String(anio)} value={String(anio)}>{anio}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* DEPENDENCIA */}
        <div className="space-y-1">
          <Label>Dependencia</Label>
          <Select onValueChange={setFiltroDependencia} value={filtroDependencia}>
            <SelectTrigger className="w-full bg-white border shadow-sm px-3 py-2 rounded-md">
              <SelectValue placeholder="Selecciona una dependencia" />
              <ChevronDown className="h-4 w-4 ml-2 opacity-50" />
            </SelectTrigger>
            <SelectContent className="w-[--radix-select-trigger-width]">
              <SelectItem value="todas">Todas</SelectItem>
              {dependenciasDisponibles.map(dep => (
                <SelectItem key={String(dep)} value={String(dep)}>{dep}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* TIPO */}
        <div className="space-y-1">
          <Label>Tipo de hallazgo</Label>
          <Select onValueChange={setFiltroTipo} value={filtroTipo}>
            <SelectTrigger className="w-full bg-white border shadow-sm px-3 py-2 rounded-md">
              <SelectValue placeholder="Selecciona un tipo" />
              <ChevronDown className="h-4 w-4 ml-2 opacity-50" />
            </SelectTrigger>
            <SelectContent className="w-[--radix-select-trigger-width]">
              <SelectItem value="todos">Todos</SelectItem>
              {tiposDisponibles.map(tipo => (
                <SelectItem key={String(tipo)} value={String(tipo)}>{tipo}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* LIMPIAR */}
        {(filtroAnio !== 'todos' || filtroDependencia !== 'todas' || filtroTipo !== 'todos') && (
          <Button
            variant="outline"
            className="w-full sm:w-fit mt-2"
            onClick={() => {
              setFiltroAnio('todos')
              setFiltroDependencia('todas')
              setFiltroTipo('todos')
            }}
          >
            Limpiar filtros
          </Button>
        )}
      </div>

      {/* GRÁFICAS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Barras por dependencia */}
        <Card>
          <CardContent className="h-80 pt-6">
            <h3 className="font-semibold text-lg text-center mb-2">Hallazgos por dependencia</h3>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dataBar}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="dependencia" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="cantidad" fill="#6a0c81ff" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Pie por tipo */}
        <Card>
          <CardContent className="h-80 pt-6">
            <h3 className="font-semibold text-lg text-center mb-2">Distribución por tipo</h3>

            <div className="flex justify-end mb-2 text-sm text-gray-500">
              Total hallazgos: <span className="font-semibold ml-1">{totalHallazgos}</span>
            </div>

            {porTipoGrafico.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart
                  margin={{ top: 10, right: 100, bottom: 80, left: 8 }}  // 👈 deja espacio para la leyenda
                >
                  <Pie
                    data={porTipoGrafico}
                    dataKey="cantidad"
                    nameKey="tipo"
                    cx="45%"          // 👈 corre el pie un poco a la izquierda
                    cy="50%"
                    outerRadius={100}  // 👈 un poco más chico para que no se solape
                  >
                    {porTipoGrafico.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>

                  {/* Tooltip: tipo + valor + % */}
                  <Tooltip
                    formatter={(value, _name, { payload }) => {
                      const tipo = payload?.tipo ?? payload?.name ?? 'Tipo'
                      const pct =
                        payload?.percent != null ? ` (${(payload.percent * 100).toFixed(0)}%)` : ''
                      return [`${value}${pct}`, tipo]
                    }}
                    wrapperStyle={{ outline: 'none' }}
                  />

                  {/* 👇 Leyenda DENTRO del chart, a la derecha */}
                  <Legend
                    layout="vertical"
                    verticalAlign="middle"
                    align="right"
                    iconType="circle"
                    wrapperStyle={{ right: 12 }}   // ajusta si quieres más/menos margen
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-gray-500 mt-6">
                No hay datos para esta combinación de filtros.
              </p>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
