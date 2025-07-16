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

// -------------------- COMPONENTES UI --------------------
const Card = ({ children }) => (
  <div className="bg-white shadow-md rounded-2xl p-4 border border-gray-200">
    {children}
  </div>
)

const CardContent = ({ children, className = '' }) => (
  <div className={`p-2 ${className}`}>
    {children}
  </div>
)

const Label = ({ children, className = '' }) => (
  <label className={cn('text-sm font-medium leading-none', className)}>
    {children}
  </label>
)

const Button = ({ children, className = '', variant = 'default', ...props }) => {
  const baseStyle = 'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none'
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
const SelectGroup = SelectPrimitive.Group
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

export default function VistaEstadisticas() {

  
  const [dataResumen, setDataResumen] = useState([])
  
  const [porTipo, setPorTipo] = useState([])
  const [filtroAnio, setFiltroAnio] = useState('todos')
  const [filtroDependencia, setFiltroDependencia] = useState('todas')
  const [aniosDisponibles, setAniosDisponibles] = useState([])
  const [dependenciasDisponibles, setDependenciasDisponibles] = useState([])
  const [filtroTipo, setFiltroTipo] = useState('todos')

const dataFiltrada = dataResumen.filter(item => {
  const coincideAnio = filtroAnio !== 'todos' ? item.anio === filtroAnio : true
  const coincideDep = filtroDependencia !== 'todas' ? item.dependencia === filtroDependencia : true
  const coincideTipo = filtroTipo !== 'todos' ? item.tipo === filtroTipo : true
  return coincideAnio && coincideDep && coincideTipo
})

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/estadisticas')
        if (!res.ok) throw new Error('Error en la API')

        const {
          resumenPorDependencia = [],
          resumenPorTipo = [],
          anios = [],
          dependencias = []
        } = await res.json()

        setDataResumen(resumenPorDependencia)
        setPorTipo(resumenPorTipo)
        setAniosDisponibles(anios)
        setDependenciasDisponibles(dependencias)
      } catch (error) {
        console.error('Error cargando estadísticas:', error)
      }
    }

    fetchData()
  }, [])


  console.log('Ejemplo de dataFiltrada:', dataFiltrada[0])


  // Agrupar dataFiltrada por tipo para la gráfica de pastel
  const porTipoFiltrado = dataFiltrada.reduce((acc, curr) => {
    const existente = acc.find(item => item.tipo === curr.tipo)
    if (existente) {
      existente.cantidad += curr.cantidad
    } else {
      acc.push({ tipo: curr.tipo, cantidad: curr.cantidad })
    }
    return acc
  }, [])

  // Calcular el total de hallazgos
  const totalHallazgos = porTipoFiltrado.reduce((sum, item) => sum + item.cantidad, 0)

  // Totales por tipo
  const totalFortalezas = porTipo
    .filter(item => item.tipo === 'Fortaleza')
    .reduce((sum, item) => sum + item.cantidad, 0)

  const totalOportunidades = porTipo
    .filter(item => item.tipo === 'Oportunidad de Mejora')
    .reduce((sum, item) => sum + item.cantidad, 0)

  const totalNoConformidades = porTipo
    .filter(item => item.tipo === 'No Conformidad')
    .reduce((sum, item) => sum + item.cantidad, 0)
console.log('Tipos disponibles:', porTipo.map(p => p.tipo))


const tiposDisponibles = [...new Set(porTipo.map(p => p.tipo))].filter(Boolean)

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
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
  {/* FILTRO AÑO */}
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
          <SelectItem key={anio} value={anio}>{anio}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>

  {/* FILTRO DEPENDENCIA */}
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
          <SelectItem key={dep} value={dep}>{dep}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>

  {/* FILTRO TIPO */}
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
          <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>

  {/* BOTÓN LIMPIAR */}
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

      {/* GRAFICOS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardContent className="h-80 pt-6">
            <h3 className="font-semibold text-lg text-center mb-2">Hallazgos por dependencia</h3>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dataFiltrada}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="dependencia" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="cantidad" fill="#6a0c81ff" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="h-80 pt-6">
            <h3 className="font-semibold text-lg text-center mb-2">Distribución por tipo</h3>

            <div className="flex justify-end mb-2 text-sm text-gray-500">
              Total hallazgos: <span className="font-semibold ml-1">{totalHallazgos}</span>
            </div>

            {porTipoFiltrado.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={porTipoFiltrado}
                    dataKey="cantidad"
                    nameKey="tipo"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                  >
                    {porTipoFiltrado.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend verticalAlign="bottom" height={36} />
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
