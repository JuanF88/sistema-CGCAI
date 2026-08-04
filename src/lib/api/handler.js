/**
 * Envoltorio de Route Handlers — el equivalente al `asyncHandler` + `errorHandler`
 * del backend de SoluGRH.
 *
 * Centraliza el manejo de errores para que los handlers puedan lanzar en vez de
 * construir cada respuesta de error a mano:
 *
 *   export const POST = withRoute(async (request) => {
 *     const guard = await requireRole(ROLES.ADMIN)
 *     if (!guard.ok) return guard.response
 *
 *     const dto = crearInformeSchema.parse(await request.json())  // ZodError → 400
 *     if (yaExiste) throw new ConflictError('Ya existe ese informe.')
 *
 *     return ok(resultado)
 *   })
 */
import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { DomainError, ValidationError } from '@/lib/api/errors'

/** Convierte un ZodError en el `details` que consume el front. */
function zodDetails(error) {
  return {
    fields: error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    })),
  }
}

export function toErrorResponse(error) {
  if (error instanceof ZodError) {
    const validation = new ValidationError('Datos inválidos.', zodDetails(error))
    return NextResponse.json(validation.toResponseBody(), { status: validation.status })
  }

  if (error instanceof DomainError) {
    return NextResponse.json(error.toResponseBody(), { status: error.status })
  }

  if (error instanceof SyntaxError) {
    const invalid = new ValidationError('JSON inválido.')
    return NextResponse.json(invalid.toResponseBody(), { status: invalid.status })
  }

  // No reconocido: se loguea completo y sale genérico, sin filtrar el stack.
  console.error('[api] error no controlado:', error)
  return NextResponse.json(
    {
      code: 'INTERNAL',
      message: 'Error interno del servidor',
      error: 'Error interno del servidor',
    },
    { status: 500 }
  )
}

/**
 * Envuelve un handler para que cualquier `throw` acabe en una respuesta JSON
 * con la forma estándar.
 */
export function withRoute(handler) {
  return async function wrappedRoute(...args) {
    try {
      return await handler(...args)
    } catch (error) {
      return toErrorResponse(error)
    }
  }
}
