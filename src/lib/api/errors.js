/**
 * Errores de dominio.
 *
 * Mismo patrón que el backend de SoluGRH: todo cuelga de `DomainError`, que
 * lleva mensaje + status + código, y la respuesta siempre tiene la misma forma:
 *
 *   { code, message, details }
 *
 * El campo `details` es el canal para que el front reaccione distinto según el
 * caso sin tener que parsear el mensaje.
 *
 * El mensaje va en español (lo lee el usuario final); el `code` en inglés
 * mayúsculas, porque lo lee el código.
 */

export class DomainError extends Error {
  constructor(message, { status = 500, code = 'INTERNAL', details } = {}) {
    super(message)
    this.name = new.target.name
    this.status = status
    this.code = code
    this.details = details
  }

  toResponseBody() {
    return {
      code: this.code,
      message: this.message,
      ...(this.details !== undefined ? { details: this.details } : {}),
      // Alias en desuso: muchos componentes todavía leen `data.error`.
      error: this.message,
    }
  }
}

/** 400 — entrada inválida o regla de negocio incumplida. */
export class ValidationError extends DomainError {
  constructor(message = 'Solicitud inválida', details) {
    super(message, { status: 400, code: 'VALIDATION_ERROR', details })
  }
}

/** 404 — el recurso no existe. */
export class NotFoundError extends DomainError {
  constructor(message = 'Recurso no encontrado', details) {
    super(message, { status: 404, code: 'NOT_FOUND', details })
  }
}

/** 409 — choque de estado (duplicado, ya procesado). */
export class ConflictError extends DomainError {
  constructor(message = 'Registro duplicado', details) {
    super(message, { status: 409, code: 'CONFLICT', details })
  }
}

/** 401 / 403 — problemas de sesión o de permisos. */
export class AuthError extends DomainError {
  static unauthorized(message = 'No autenticado', details) {
    return new AuthError(message, { status: 401, code: 'UNAUTHORIZED', details })
  }

  static forbidden(message = 'No autorizado', details) {
    return new AuthError(message, { status: 403, code: 'FORBIDDEN', details })
  }
}

/**
 * Traduce un error de Postgres/Supabase a un error de dominio.
 * Solo cubre los códigos que el sistema ya manejaba a mano.
 */
export function fromPostgresError(error, fallbackMessage = 'Error en la base de datos') {
  if (!error) return null

  // 23505 = unique_violation
  if (error.code === '23505') {
    const msg = error.message || ''
    if (msg.includes('usuarios_email_rol_key')) {
      return new ConflictError('Ya existe un usuario con ese correo y ese rol.')
    }
    if (msg.includes('usuarios_email_password_key')) {
      return new ConflictError('Para ese correo, la contraseña ya está en uso. Usa una diferente.')
    }
    return new ConflictError('Registro duplicado.')
  }

  // 23503 = foreign_key_violation
  if (error.code === '23503' || /foreign key/i.test(error.message || '')) {
    return new ConflictError('No se puede completar: hay registros que dependen de este.')
  }

  return new DomainError(error.message || fallbackMessage, { status: 500, code: 'DB_ERROR' })
}
