/**
 * Respuestas JSON con forma homogénea para todas las rutas de API.
 *
 * Éxito → el payload tal cual.
 * Error → `{ code, message, details?, error }`, donde `error` es un alias en
 * desuso que se mantiene porque varios componentes todavía leen `data.error`.
 */
import { NextResponse } from 'next/server'
import {
  AuthError,
  ConflictError,
  DomainError,
  NotFoundError,
  ValidationError,
} from '@/lib/api/errors'

export const json = (data, init) => NextResponse.json(data, init)

export const ok = (data = { ok: true }) => NextResponse.json(data)

export const created = (data) => NextResponse.json(data, { status: 201 })

/** Construye la respuesta de error a partir de un `DomainError`. */
export const failWith = (error) =>
  NextResponse.json(error.toResponseBody(), { status: error.status })

export const fail = (message, status = 500, code = 'INTERNAL', details) =>
  failWith(new DomainError(message, { status, code, details }))

export const badRequest = (message = 'Solicitud inválida', details) =>
  failWith(new ValidationError(message, details))

export const unauthorized = (message = 'No autenticado', details) =>
  failWith(AuthError.unauthorized(message, details))

export const forbidden = (message = 'No autorizado', details) =>
  failWith(AuthError.forbidden(message, details))

export const notFound = (message = 'Recurso no encontrado', details) =>
  failWith(new NotFoundError(message, details))

export const conflict = (message = 'Registro duplicado', details) =>
  failWith(new ConflictError(message, details))

export const serverError = (message = 'Error interno del servidor', details) =>
  fail(message, 500, 'INTERNAL', details)
