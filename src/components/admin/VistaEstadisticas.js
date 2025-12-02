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

// -------------------- Gestiones (pestañas) --------------------

// Claves de gestión para las pestañas
const GESTION_TABS = [
  { key: 'todas', label: 'Todas las gestiones' },
  { key: 'estrategica', label: 'Gestión Estratégica' },
  { key: 'academica', label: 'Gestión Académica' },
  { key: 'investigacion', label: 'Gestión de la Investigación' },
  { key: 'administrativa', label: 'Gestión Administrativa' },
  { key: 'cultura', label: 'Gestión de Cultura y Bienestar' },
  { key: 'control', label: 'Gestión de Control' },
  { key: 'otras', label: 'Otras / sin clasificar' },
]

// 🎯 Mapa de dependencias → gestión
// IMPORTANTE: rellena esto con tus propias dependencias.
// Usa el nombre tal como viene de la BD, pero en minúsculas.
// 🎯 Mapa de dependencias → gestión
// Usa norm() para asegurar coincidencia con el nombre real en BD.
const GESTION_DEP_MAP = {
  [norm('ADMINISTRACIÓN DE EMPRESAS PREGRADO')]: 'academica',
  [norm('ADMINISTRACIÓN FINANCIERA POR CICLOS')]: 'academica',
  [norm('ÁREA DE ADQUISICIONES E INVENTARIOS')]: 'administrativa',
  [norm('ÁREA DE DESARROLLO EDITORIAL')]: 'academica',
  [norm('ÁREA DE EGRESADOS')]: 'estrategica',
  [norm('ÁREA DE GESTIÓN DOCUMENTAL')]: 'administrativa',
  [norm('ÁREA DE INTERACCIÓN SOCIAL')]: 'estrategica',
  [norm('ÁREA DE SEGURIDAD, CONTROL Y MOVILIDAD')]: 'control',

  [norm('ARTES PLÁSTICAS PREGRADO')]: 'academica',
  [norm('BIOLOGÍA PREGRADO')]: 'academica',
  [norm('CENTRO DE GESTIÓN DE LA CALIDAD Y LA ACREDITACION INSTITUCIONAL')]: 'control',
  [norm('CENTRO DE GESTIÓN DE LAS COMUNICACIONES')]: 'estrategica',
  [norm('CENTRO DE POSGRADOS')]: 'academica',
  [norm('CIENCIA POLÍTICA PREGRADO')]: 'academica',
  [norm('COMUNICACIÓN SOCIAL PREGRADO')]: 'academica',
  [norm('CONTADURÍA PÚBLICA PREGRADO')]: 'academica',

  [norm('DERECHO - SEDE POPAYÁN PREGRADO')]: 'academica',
  [norm('DERECHO - SEDE SANTANDER DE QUILICHAO PREGRADO')]: 'academica',
  [norm('DERECHO NOCTURNO - SEDE POPAYÁN PREGRADO')]: 'academica',
  [norm('DERECHO NOCTURNO - SEDE SANTANDER DE QUILICHAO PREGRADO')]: 'academica',
  [norm('DERECHO PREGRADO')]: 'academica',
  [norm('DIRECCIÓN DE BANDA PREGRADO')]: 'academica',
  [norm('DISEÑO GRÁFICO PREGRADO')]: 'academica',

  [norm('DIVISIÓN DE ADMISIONES, REGISTRO Y CONTROL ACADÉMICO - DARCA')]: 'academica',
  [norm('DIVISIÓN DE GESTIÓN DE LA CULTURA')]: 'cultura',
  [norm('DIVISIÓN DE GESTIÓN DE LA RECREACIÓN Y EL DEPORTE')]: 'cultura',
  [norm('DIVISIÓN DE GESTIÓN DE MEDIOS Y RECURSOS BIBLIOGRÁFICOS')]: 'academica',
  [norm('DIVISIÓN DE GESTIÓN DE SALUD INTEGRAL Y DESARROLLO HUMANO')]: 'cultura',
  [norm('DIVISIÓN DE GESTIÓN DEL TALENTO HUMANO')]: 'administrativa',
  [norm('DIVISIÓN DE GESTIÓN FINANCIERA')]: 'administrativa',
  [norm('DIVISIÓN DE INNOVACIÓN, EMPRENDIMIENTO Y ARTICULACIÓN CON EL ENTORNO - DAE')]: 'estrategica',
  [norm('DIVISIÓN DE TECNOLOGÍAS DE LA INFORMACIÓN Y LAS COMUNICACIONES - TICs')]: 'administrativa',

  [norm('DOCTORADO EN ANTROPOLOGÍA')]: 'investigacion',
  [norm('DOCTORADO EN CIENCIAS - QUIMICA')]: 'investigacion',
  [norm('DOCTORADO EN CIENCIAS AGRARIAS Y AGROINDUSTRIALES')]: 'investigacion',
  [norm('DOCTORADO EN CIENCIAS DE LA EDUCACIÓN')]: 'investigacion',
  [norm('DOCTORADO EN CIENCIAS DE LA ELECTRÓNICA')]: 'investigacion',
  [norm('DOCTORADO EN CIENCIAS HUMANAS')]: 'investigacion',
  [norm('DOCTORADO EN CIENCIAS MATEMÁTICAS')]: 'investigacion',
  [norm('DOCTORADO EN ETNOBIOLOGÍA Y ESTUDIOS BIOCULTURALES')]: 'investigacion',
  [norm('DOCTORADO EN INGENIERÍA TELEMÁTICA')]: 'investigacion',

  [norm('ECONOMÍA PREGRADO')]: 'academica',
  [norm('ENFERMERÍA PREGRADO')]: 'academica',

  [norm('ESPECIALIZACIÓN EN ADMINISTRACIÓN HOSPITALARIA')]: 'academica',
  [norm('ESPECIALIZACIÓN EN ANATOMÍA PATOLÓGICA')]: 'academica',
  [norm('ESPECIALIZACIÓN EN AUDITORÍA Y GARANTÍA DE LA CALIDAD EN SALUD CON ÉNFASIS EN EPIDEMIOLOGÍA CONVENIO EAN')]: 'academica',
  [norm('ESPECIALIZACIÓN EN BIOÉTICA, MODALDIAD A DISTANCIA EN CONVENIO CON LA UNIVERSIDAD DEL BOSQUE')]: 'academica',
  [norm('ESPECIALIZACIÓN EN CIRUGÍA GENERAL')]: 'academica',
  [norm('ESPECIALIZACIÓN EN CONTABILIDAD PÚBLICA')]: 'academica',
  [norm('ESPECIALIZACIÓN EN DERECHO ADMINISTRATIVO')]: 'academica',
  [norm('ESPECIALIZACIÓN EN DESARROLLO DE SOLUCIONES INFORMÁTICAS')]: 'academica',
  [norm('ESPECIALIZACIÓN EN EDUCACIÓN COMUNITARIA')]: 'academica',
  [norm('ESPECIALIZACIÓN EN GERENCIA DE IMPUESTOS')]: 'academica',
  [norm('ESPECIALIZACIÓN EN GERENCIA DE PROYECTOS')]: 'academica',
  [norm('ESPECIALIZACIÓN EN GERENCIA DE PROYECTOS CONVENIO UNINARIÑO')]: 'academica',
  [norm('ESPECIALIZACIÓN EN GINECOLOGÍA Y OBSTETRICIA')]: 'academica',
  [norm('ESPECIALIZACIÓN EN INGENIERÍA DE LA CONSTRUCCIÓN')]: 'academica',
  [norm('ESPECIALIZACIÓN EN INGENIERÍA DE VÍAS TERRESTRES')]: 'academica',
  [norm('ESPECIALIZACIÓN EN INTERVENCIÓN DEL LENGUAJE INFANTIL')]: 'academica',
  [norm('ESPECIALIZACIÓN EN MEDICINA FAMILIAR')]: 'academica',
  [norm('ESPECIALIZACIÓN EN MEDICINA INTERNA')]: 'academica',
  [norm('ESPECIALIZACIÓN EN MERCADEO CORPORATIVO')]: 'academica',
  [norm('ESPECIALIZACIÓN EN NEUROREHABILITACIÓN')]: 'academica',
  [norm('ESPECIALIZACIÓN EN PAVIMENTOS')]: 'academica',
  [norm('ESPECIALIZACIÓN EN PEDIATRÍA')]: 'academica',
  [norm('ESPECIALIZACIÓN EN REDES Y SERVICIOS TELEMÁTICOS')]: 'academica',
  [norm('ESPECIALIZACIÓN EN REVISORIA FISCAL Y AUDITORÍA INTERNACIONAL')]: 'academica',
  [norm('ESPECIALIZACIÓN EN SEGURIDAD Y SALUD EN EL TRABAJO')]: 'academica',
  [norm('ESPECIALIZACIÓN EN SISTEMAS DE RADIOCOMUNICACIONES')]: 'academica',
  [norm('ESPECIALIZACIÓN EN SISTEMAS INTEGRADOS DE LA CALIDAD')]: 'academica',
  [norm('ESPECIALIZACIÓN EN TELEMÁTICA')]: 'academica',
  [norm('ESPECIALIZACIÓN EN TRÁNSITO')]: 'academica',

  [norm('FACULTAD DE ARTES')]: 'academica',
  [norm('FACULTAD DE CIENCIAS AGRARIAS')]: 'academica',
  [norm('FACULTAD DE CIENCIAS CONTABLES, ECONÓMICAS Y ADMINISTRATIVAS')]: 'academica',
  [norm('FACULTAD DE CIENCIAS DE LA SALUD')]: 'academica',
  [norm('FACULTAD DE CIENCIAS HUMANAS Y SOCIALES')]: 'academica',
  [norm('FACULTAD DE CIENCIAS NATURALES, EXACTAS Y DE LA EDUCACIÓN')]: 'academica',
  [norm('FACULTAD DE DERECHO, CIENCIAS POLÍTICAS Y SOCIALES')]: 'academica',
  [norm('FACULTAD DE INGENIERÍA CIVIL')]: 'academica',
  [norm('FACULTAD DE INGENIERÍA ELECTRÓNICA Y TELECOMUNICACIONES')]: 'academica',

  [norm('FILOSOFÍA PREGRADO')]: 'academica',
  [norm('FISIOTERAPIA PREGRADO')]: 'academica',
  [norm('FONOAUDIOLOGÍA PREGRADO')]: 'academica',
  [norm('GEOGRAFÍA DEL DESARROLLO REGIONAL Y AMBIENTAL PREGRADO')]: 'academica',
  [norm('GEOTECNOLOGÍA')]: 'academica',

  [norm('GESTIÓN ACADÉMICA')]: 'academica',
  [norm('GESTIÓN ADMINISTRATIVA')]: 'administrativa',
  [norm('GESTIÓN DE BIENES Y SERVICIOS')]: 'administrativa',
  [norm('GESTIÓN DE LA INVESTIGACIÓN')]: 'investigacion',
  [norm('GESTIÓN DEL MANTENIMIENTO DE BIENES MUEBLES, INMUEBLES Y EQUIPOS')]: 'administrativa',

  [norm('HISTORIA PREGRADO')]: 'academica',
  [norm('INGENIERÍA AGROINDUSTRIAL PREGRADO')]: 'academica',
  [norm('INGENIERÍA AGROPECUARIA PREGRADO')]: 'academica',
  [norm('INGENIERÍA AMBIENTAL PREGRADO')]: 'academica',
  [norm('INGENIERÍA CIVIL PREGRADO')]: 'academica',
  [norm('INGENIERÍA DE SISTEMAS PREGRADO')]: 'academica',
  [norm('INGENIERÍA ELECTRÓNICA Y DE TELECOMUNICACIONES PREGRADO')]: 'academica',
  [norm('INGENIERÍA EN AUTOMÁTICA INDUSTRIAL PREGRADO')]: 'academica',
  [norm('INGENIERÍA FÍSICA PREGRADO')]: 'academica',

    [norm('INGENIERÍA FORESTAL PREGRADO')]: 'academica',
  [norm('LICENCIATURA EN EDUCACIÓN BÁSICA CON ÉNFASIS EN CIENCIAS NATURALES Y EDUCACIÓN AMBIENTAL PREGRADO')]: 'academica',
  [norm('LICENCIATURA EN EDUCACIÓN BÁSICA CON ÉNFASIS EN EDUCACIÓN ARTÍSTICA PREGRADO')]: 'academica',
  [norm('LICENCIATURA EN EDUCACIÓN BÁSICA CON ÉNFASIS EN LENGUA CASTELLANA E INGLÉS PREGRADO')]: 'academica',
  [norm('LICENCIATURA EN EDUCACIÓN BÁSICA PRIMARIA PREGRADO')]: 'academica',
  [norm('LICENCIATURA EN EDUCACIÓN FÍSICA, RECREACIÓN Y DEPORTES PREGRADO')]: 'academica',
  [norm('LICENCIATURA EN ETNOEDUCACIÓN PREGRADO')]: 'academica',
  [norm('LICENCIATURA EN LENGUAS MODERNAS CON ÉNFASIS EN INGLÉS Y FRANCÉS - SEDE POPAYÁN PREGRADO')]: 'academica',
  [norm('LICENCIATURA EN LENGUAS MODERNAS CON ÉNFASIS EN INGLÉS Y FRANCÉS - SEDE SANTANDER PREGRADO')]: 'academica',
  [norm('LICENCIATURA EN LITERATURA Y LENGUA CASTELLANA PREGRADO')]: 'academica',
  [norm('LICENCIATURA EN MATEMÁTICAS PREGRADO')]: 'academica',
  [norm('LICENCIATURA EN MÚSICA PREGRADO')]: 'academica',

  [norm('MAESTRÍA EN ADMINISTRACIÓN DE EMPRESAS DE SALUD - MBA_EN_SALUD')]: 'academica',
  [norm('MAESTRÍA EN ANTROPOLOGÍA')]: 'academica',
  [norm('MAESTRÍA EN ARTES INTEGRADAS CON EL AMBIENTE')]: 'academica',
  [norm('MAESTRÍA EN CIENCIAS AGRARIAS')]: 'academica',
  [norm('MAESTRÍA EN CIENCIAS HUMANAS')]: 'academica',
  [norm('MAESTRÍA EN CIENCIAS MATEMÁTICAS')]: 'academica',
  [norm('MAESTRÍA EN CIENCIAS QUÍMICAS')]: 'academica',
  [norm('MAESTRÍA EN COMPUTACIÓN')]: 'academica',
  [norm('MAESTRÍA EN CONTABILIDAD Y FINANZAS')]: 'academica',
  [norm('MAESTRÍA EN COOPERACIÓN INTERNACIONAL CONVENIO NORTE SUR - UNIVERSIDAD DEL CAUCA')]: 'academica',
  [norm('MAESTRÍA EN EDUCACIÓN')]: 'academica',
  [norm('MAESTRÍA EN EDUCACIÓN POPULAR')]: 'academica',
  [norm('MAESTRÍA EN ESTUDIOS DE RIESGOS DE DESASTRE Y ORDENAMIENTO TERRITORIAL')]: 'academica',
  [norm('MAESTRÍA EN ESTUDIOS INTERCULTURALES')]: 'academica',
  [norm('MAESTRÍA EN ESTUDIOS MULTIDISCIPLINARIOS DEL DESARROLLO')]: 'academica',
  [norm('MAESTRÍA EN ÉTICA Y FILOSOFÍA POLÍTICA')]: 'academica',
  [norm('MAESTRÍA EN GESTIÓN DE ORGANIZACIONES Y PROYÉCTOS')]: 'academica',
  [norm('MAESTRÍA EN GOBIERNO')]: 'academica',
  [norm('MAESTRÍA EN HISTORIA')]: 'academica',
  [norm('MAESTRÍA EN INGENIERÍA - ÁREA ELECTRÓNICA Y TELECOMUNICACIONES')]: 'academica',
  [norm('MAESTRÍA EN INGENIERÍA FÍSICA')]: 'academica',
  [norm('MAESTRÍA EN INGENIERÍA TELEMÁTICA')]: 'academica',
  [norm('MAESTRÍA EN MÚSICA')]: 'academica',
  [norm('MAESTRÍA EN RECURSOS HIDROBIOLÓGICAS CONTINENTALES')]: 'academica',
  [norm('MAESTRÍA EN REVITALIZACIÓN Y ENSEÑANZA DE LENGUAS INDÍGENAS')]: 'academica',

  [norm('MATEMÁTICAS PREGRADO')]: 'academica',
  [norm('MEDICINA PREGRADO')]: 'academica',
  [norm('MÚSICA INSTRUMENTAL PREGRADO')]: 'academica',

  [norm('OFICINA DE CONTROL INTERNO - OCI')]: 'control',
  [norm('OFICINA DE PLANEACIÓN Y DESARROLLO INSTITUCIONAL')]: 'estrategica',
  [norm('OFICINA DE RELACIONES INTERINSTITUCIONALES E INTERNACIONALES - ORI')]: 'estrategica',
  [norm('OFICINA JURÍDICA')]: 'administrativa',

  [norm('PROGRAMA DE PERMANENCIA Y GRADUACIÓN')]: 'academica',
  [norm('QUÍMICA PREGRADO')]: 'academica',
  [norm('SECRETARIA GENERAL')]: 'administrativa',
  [norm('TECNOLOGÍA EN TELEMÁTICA')]: 'academica',
  [norm('TURISMO PREGRADO')]: 'academica',

  [norm('UNIDAD DE SALUD')]: 'cultura',
  [norm('VICERRECTORÍA DE CULTURA Y BIENESTAR')]: 'cultura',

}


const getGestionFromDependencia = (dep) => {
  if (!dep) return 'otras'
  const key = norm(dep)
  return GESTION_DEP_MAP[key] || 'otras'
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

        console.log('detalleApi[0]:', detalleApi?.[0])

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
    return detalle.map(it => ({
      ...it,
      tipo: normalizeTipo(it.tipo),
      // aquí miramos varios nombres posibles
      iso: it.iso ?? it.iso_id ?? it.isoId ?? null,
    }))
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

        const gestionItem = getGestionFromDependencia(it.dependencia)
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
      if (filtroGestion === 'todas') {
        return [...dependenciasDisponibles].sort()
      }
      return dependenciasDisponibles
        .filter(dep => getGestionFromDependencia(dep) === filtroGestion)
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
    return detalleBase.filter(item => {
      const okAnio = filtroAnio === 'todos' || s(item.anio) === s(filtroAnio)
      const okDep  = filtroDependencia === 'todas' || s(item.dependencia) === s(filtroDependencia)
      const okTipo = filtroTipo === 'todos' || s(item.tipo) === s(filtroTipo)
      const okIso  = filtroIso === 'todos' || s(item.iso) === s(filtroIso)
      const gestionItem = getGestionFromDependencia(item.dependencia)
      const okGestion = filtroGestion === 'todas' || gestionItem === filtroGestion
      return okAnio && okDep && okTipo && okIso && okGestion
    })
  }, [detalleBase, filtroAnio, filtroDependencia, filtroTipo, filtroIso, filtroGestion])

  // --------- BARRAS (por dependencia) ---------
  const dataBar = useMemo(() => {
    if (!detalleBase.length) {
      // Degradación: aplica filtros posibles sobre el resumen
      return dataResumen.filter(item => {
        const okAnio = filtroAnio === 'todos' || s(item.anio) === s(filtroAnio)
        const okDep  = filtroDependencia === 'todas' || s(item.dependencia) === s(filtroDependencia)
        const okIso  = filtroIso === 'todos' || s(item.iso) === s(filtroIso)
        const gestionItem = getGestionFromDependencia(item.dependencia)
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
        const gestionItem = getGestionFromDependencia(i.dependencia)
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
      const gestionItem = getGestionFromDependencia(it.dependencia)
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
      {/* HEADER */}
      <div className={styles.headerRow}>
        <div>
          <h2 className={styles.title}>Estadísticas de Hallazgos</h2>
          <p className={styles.subtitle}>
            Panel interactivo por gestión, año, dependencia, tipo e ISO
          </p>
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
                <BarChart data={dataBar} margin={{ top: 6, right: 12, bottom: 6, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="dependencia"
                    tick={{ fontSize: 0 }}
                    interval={0}
                    angle={-25}
                    textAnchor="end"
                    height={8}
                  />
                  <YAxis allowDecimals={false} />
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
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="anio" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} />
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
