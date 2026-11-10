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
  CalendarRange,
  ClipboardCheck,
  ClipboardList,
  Eye,
  FileText,
  Home,
  LayoutDashboard,
  Lightbulb,
  MessageSquareText,
  ScrollText,
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
 * @property {boolean} [nuevo]   Pinta la etiqueta «Nuevo» junto al rótulo. Se
 *                               quita a mano cuando la función deje de serlo.
 */

/** Panel de administración. */
export const ADMIN_NAV = [
  { key: 'crearInforme', label: 'Inicio', icon: FileText },
  // Va justo después de Inicio porque es por donde empieza el año: primero se
  // programa, y de ahí salen las auditorías que se administran debajo.
  { key: 'programaAuditoria', label: 'Programa de Auditoría', icon: CalendarRange },
  { key: 'VistaTimeline', label: 'Administrar Auditorías', icon: Home },
  {
    key: 'administracion',
    label: 'Administración',
    icon: Building,
    alias: ['crearUsuario', 'adminDependencia'],
  },
  { key: 'administrarHallazgos', label: 'Reporte de Hallazgos', icon: Lightbulb },
  // Después de los hallazgos porque es lo que sale de ellos: el plan se
  // levanta con las oportunidades de mejora y las no conformidades.
  { key: 'planesMejora', label: 'Planes de Mejoramiento', icon: ClipboardCheck },
  { key: 'evaluacionAuditores', label: 'Evaluación de Auditores', icon: Award },
  // Al lado de la de auditores: es la misma idea en sentido contrario, el
  // auditor valorando al proceso que auditó.
  {
    key: 'evaluacionAuditados',
    label: 'Evaluación de Auditados',
    icon: MessageSquareText,
    nuevo: true,
  },
  { key: 'dashboardAuditores', label: 'Dashboard de Auditores', icon: UserRound },
  { key: 'alertasAuditoria', label: 'Alertas de Auditoría', icon: BellRing },
  { key: 'estadisticas', label: 'Estadísticas', icon: BarChart, alias: ['powerbi'] },
  // Al final y aparte: no es una tarea del ciclo de auditoría sino la
  // trazabilidad del sistema en sí, y se consulta cuando hay que averiguar
  // quién tocó algo.
  { key: 'registroActividad', label: 'Registro de Actividad', icon: ScrollText },
]

/** Panel del auditor. */
export const AUDITOR_NAV = [
  { key: 'bienvenida', label: 'Inicio', icon: Home },
  { key: 'timeline', label: 'Auditoría Interna', icon: ClipboardList },
  // El Plan de Mejoramiento se levanta después de cerrar la auditoría, así que
  // va detrás de la línea de trabajo y no dentro de ella. Al salir de los pasos
  // del timeline el auditor se quedaba sin forma de generar el formato.
  { key: 'planes-mejora', label: 'Planes de Mejoramiento', icon: ClipboardCheck },
  // «Evaluación de Auditados» (clave 'evaluacion-auditados') está oculta a los
  // auditores por ahora: todavía no deben diligenciarla. Para abrirla, volver
  // a poner aquí la entrada —con `icon: MessageSquareText, nuevo: true`— y
  // descomentar su vista en `VistaActual.jsx`.
  { key: 'mi-dashboard', label: 'Mi Dashboard', icon: LayoutDashboard },
  { key: 'mis-evaluaciones', label: 'Mis Evaluaciones', icon: Award },
  { key: 'caja', label: 'Caja de Herramientas', icon: Wrench },
]

/** Panel del visualizador (solo lectura). */
export const VISUALIZADOR_NAV = [
  { key: 'malla', label: 'Malla de Control', icon: FileText },
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
