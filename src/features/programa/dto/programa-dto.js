import { z } from 'zod'

import { numericId, nullableText, nullableYmdDate, requiredText } from '@/lib/dto/common'

const ESTADOS = ['borrador', 'aprobado', 'archivado']

/** Texto largo del formato: los bloques del Excel ocupan párrafos enteros. */
const textoLargo = () => nullableText(8000)

/**
 * Lista de párrafos (riesgos, controles, oportunidades).
 *
 * Las entradas en blanco se descartan aquí: el formulario deja añadir una
 * tarjeta vacía y no tiene sentido guardar huecos que luego saldrían como
 * filas en blanco en el Excel.
 */
const listaDeTextos = () =>
  z
    .array(z.string().trim().max(4000))
    .max(50)
    .optional()
    .default([])
    .transform((valores) => valores.filter((v) => v.length > 0))

/** Fila del cronograma (hoja «Programa AI Estratégico»). */
export const cronogramaItemSchema = z.object({
  proceso: requiredText('El proceso a auditar es obligatorio.', 500),
  auditado: nullableText(500),
  auditores: nullableText(500),
  requisitos_9001: nullableText(1000),
  requisitos_14001: nullableText(1000),
})

/**
 * Fila de la distribución (hoja «Distribución»).
 *
 * No hay campo de contraseña a propósito: el Excel original trae una columna
 * con claves en texto plano y no se replica.
 */
export const distribucionItemSchema = z.object({
  responsable_titulo: nullableText(120),
  responsable_nombre: nullableText(255),
  organismo: nullableText(255),
  gestion: nullableText(255),
  facultad: nullableText(255),
  proceso: requiredText('El proceso es obligatorio.', 500),
  auditor_nombre: nullableText(255),
  auditor_correo: nullableText(255),
  auditor_estudios: nullableText(500),
  coordinador_nombre: nullableText(255),
  coordinador_correo: nullableText(255),
  coordinador_alterno: nullableText(255),
  coordinador_nivel: nullableText(120),
  gestor_nombre: nullableText(255),
  gestor_correo: nullableText(255),
  decanatura_nombre: nullableText(255),
  decanatura_correo: nullableText(255),
  decano_titulo: nullableText(120),
  decano_nombre: nullableText(255),
})

/** Campos de la cabecera, compartidos por crear y actualizar. */
const cabecera = {
  anio: z.coerce
    .number({ message: 'El año es obligatorio.' })
    .int()
    .min(2000, 'Año fuera de rango.')
    .max(2100, 'Año fuera de rango.'),
  nombre: requiredText('El nombre del programa es obligatorio.', 255),
  estado: z.enum(ESTADOS).optional().default('borrador'),

  objetivo: textoLargo(),
  alcance: textoLargo(),
  criterios: textoLargo(),
  metodologia: textoLargo(),

  recurso_humano: textoLargo(),
  recurso_financiero: textoLargo(),
  recurso_tecnologico: textoLargo(),

  riesgos: listaDeTextos(),
  controles: listaDeTextos(),
  oportunidades: listaDeTextos(),

  mes_auditoria: nullableText(60),
  nomenclatura: textoLargo(),
  observaciones: textoLargo(),

  elaborado_por: nullableText(255),
  elaborado_cargo: nullableText(255),
  revisado_por: nullableText(255),
  revisado_cargo: nullableText(255),
  aprobado_por: nullableText(255),
  aprobado_cargo: nullableText(255),
  fecha_aprobacion: nullableYmdDate(),
}

/** POST /api/programa-auditoria */
export const crearProgramaSchema = z.object({
  ...cabecera,
  cronograma: z.array(cronogramaItemSchema).max(200).optional().default([]),
  distribucion: z.array(distribucionItemSchema).max(500).optional().default([]),
})

/**
 * PUT /api/programa-auditoria?id=…
 *
 * Las dos listas se reemplazan enteras: es más simple que casar altas, bajas y
 * reordenamientos fila a fila, y son listas cortas.
 */
export const actualizarProgramaSchema = crearProgramaSchema

export const programaIdSchema = numericId('Falta el parámetro id.')
