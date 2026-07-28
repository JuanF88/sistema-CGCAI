/**
 * Menú lateral de cada panel, como datos.
 *
 * Los ítems se agregan o quitan **aquí**, no en el componente del shell.
 * Cada entrada declara qué roles la ven, y el shell solo la renderiza.
 */
import {
  Award,
  BarChart,
  BellRing,
  Building,
  ClipboardList,
  Eye,
  FileText,
  Home,
  LayoutDashboard,
  Lightbulb,
  UserRound,
  Wrench,
} from 'lucide-react'

import { ROLES } from '@/lib/auth/roles'

/**
 * @typedef {Object} NavItem
 * @property {string} key        Vista que activa (lo que guarda el estado del shell)
 * @property {string} label      Texto visible
 * @property {Function} icon     Componente de icono de lucide
 * @property {string[]} [alias]  Otras vistas que deben marcar este ítem como activo
 */

/** Panel de administración. */
export const ADMIN_NAV = [
  { key: 'crearInforme', label: 'Inicio', icon: FileText },
  { key: 'VistaTimeline', label: 'Administrar Auditorías', icon: Home },
  {
    key: 'administracion',
    label: 'Administración',
    icon: Building,
    alias: ['crearUsuario', 'adminDependencia'],
  },
  { key: 'administrarHallazgos', label: 'Reporte de Hallazgos', icon: Lightbulb },
  { key: 'evaluacionAuditores', label: 'Evaluación de Auditores', icon: Award },
  { key: 'dashboardAuditores', label: 'Dashboard de Auditores', icon: UserRound },
  { key: 'alertasAuditoria', label: 'Alertas de Auditoría', icon: BellRing },
  { key: 'estadisticas', label: 'Estadísticas', icon: BarChart, alias: ['powerbi'] },
]

/** Panel del auditor. */
export const AUDITOR_NAV = [
  { key: 'bienvenida', label: 'Inicio', icon: Home },
  { key: 'timeline', label: 'Auditoría Interna', icon: ClipboardList },
  { key: 'mi-dashboard', label: 'Mi Dashboard', icon: LayoutDashboard },
  { key: 'caja', label: 'Caja de Herramientas', icon: Wrench },
]

/** Panel del visualizador (solo lectura). */
export const VISUALIZADOR_NAV = [
  { key: 'malla', label: 'Malla de Control', icon: FileText },
  { key: 'timeline', label: 'Auditorías', icon: Home },
  { key: 'hallazgos', label: 'Hallazgos', icon: Eye },
  { key: 'estadisticas', label: 'Estadísticas', icon: BarChart },
]

/** Menú que corresponde a cada rol. */
export const NAV_BY_ROLE = {
  [ROLES.ADMIN]: ADMIN_NAV,
  [ROLES.AUDITOR]: AUDITOR_NAV,
  [ROLES.VISUALIZADOR]: VISUALIZADOR_NAV,
}

/** ¿Este ítem debe verse como activo para la vista actual? */
export const isNavItemActive = (item, vistaActual) =>
  item.key === vistaActual || (item.alias?.includes(vistaActual) ?? false)
