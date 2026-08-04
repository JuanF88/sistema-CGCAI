/**
 * Acceso HTTP al dominio de autenticación.
 */
import { post } from '@/lib/api/http'

/**
 * POST /api/auth/login
 * @param {{email: string, password: string}} credenciales
 */
export const iniciarSesion = (credenciales) => post('/api/auth/login', credenciales)

/** POST /api/auth/logout */
export const cerrarSesionEnServidor = () => post('/api/auth/logout')

/**
 * POST /api/auth/migrate — migración puntual de usuarios a Supabase Auth.
 * Requiere sesión de admin.
 */
export const migrarUsuariosAAuth = () => post('/api/auth/migrate')
