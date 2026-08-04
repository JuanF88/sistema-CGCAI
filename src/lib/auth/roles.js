/**
 * Roles del sistema y las rutas que puede ver cada uno.
 *
 * Es la única fuente de verdad: la usan el proxy (protección de rutas), el
 * guard de las rutas de API y el redirect posterior al login.
 */
export const ROLES = {
  ADMIN: 'admin',
  AUDITOR: 'auditor',
  VISUALIZADOR: 'visualizador',
  GESTOR: 'gestor',
}

/** Normaliza el rol tal como viene de la tabla `usuarios`. */
export const normalizeRole = (rol) => String(rol ?? '').trim().toLowerCase()

/**
 * Agrupaciones reutilizables de roles.
 *
 * Usa estas constantes en las rutas y en la navegación en vez de escribir
 * arrays sueltos: cuando cambie quién puede ver qué, se cambia aquí.
 */

/** Puede leer auditorías, informes, hallazgos y estadísticas. */
export const AUDITORIA_READ_ROLES = [ROLES.ADMIN, ROLES.AUDITOR, ROLES.VISUALIZADOR]

/** Puede crear o modificar informes de auditoría. */
export const AUDITORIA_WRITE_ROLES = [ROLES.ADMIN, ROLES.AUDITOR]

/** Puede consultar la evaluación de auditores (consolidados y dashboards). */
export const EVALUACION_READ_ROLES = [ROLES.ADMIN, ROLES.VISUALIZADOR]

/** Operaciones exclusivas de administración del sistema. */
export const ADMIN_ONLY_ROLES = [ROLES.ADMIN]

/** Ruta de inicio de cada rol tras iniciar sesión. */
export const HOME_BY_ROLE = {
  [ROLES.ADMIN]: '/admin',
  [ROLES.AUDITOR]: '/auditor',
  [ROLES.VISUALIZADOR]: '/visualizador',
  [ROLES.GESTOR]: '/gestor',
}

/**
 * Prefijos de ruta protegidos y los roles admitidos en cada uno.
 * El orden importa: se evalúa la primera coincidencia por prefijo.
 */
export const PROTECTED_ROUTES = [
  { prefix: '/admin', roles: [ROLES.ADMIN] },
  { prefix: '/auditor', roles: [ROLES.AUDITOR] },
  { prefix: '/visualizador', roles: [ROLES.VISUALIZADOR] },
  { prefix: '/gestor', roles: [ROLES.GESTOR] },
]

/**
 * Devuelve la regla que aplica a un pathname, o null si es una ruta pública.
 * @param {string} pathname
 */
export function matchProtectedRoute(pathname) {
  return (
    PROTECTED_ROUTES.find(
      (route) =>
        pathname === route.prefix || pathname.startsWith(`${route.prefix}/`)
    ) ?? null
  )
}

/** ¿El rol puede entrar a esa ruta? */
export function canAccess(rol, pathname) {
  const rule = matchProtectedRoute(pathname)
  if (!rule) return true
  return rule.roles.includes(normalizeRole(rol))
}
