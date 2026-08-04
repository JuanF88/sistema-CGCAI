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

/** Una dependencia auditada dentro de una sección del cronograma. */
export const cronogramaDependenciaSchema = z.object({
  auditado: requiredText('Cada línea necesita la dependencia auditada.', 500),
  auditores: nullableText(500),
  // Texto libre: suele ser alguien que no está en el catálogo de usuarios.
  auditor_acompanante: nullableText(500),
})

/**
 * Sección del cronograma: un proceso del mapa institucional.
 *
 * Los requisitos ISO y las semanas son del proceso entero —en el Excel van
 * combinados verticalmente en todo el bloque—; lo que cambia línea a línea son
 * las dependencias auditadas y sus auditores.
 *
 * `semanas` son las del mes de auditoría, separadas por comas («1,3»): la
 * cuadrícula de cuatro columnas a la derecha de los requisitos ISO 14001.
 */
export const cronogramaSeccionSchema = z.object({
  // La clave del proceso (`dependencias.gestion`); el nombre impreso va aparte.
  proceso_clave: nullableText(40),
  proceso: requiredText('El proceso es obligatorio.', 500),
  requisitos_9001: nullableText(1000),
  requisitos_14001: nullableText(1000),
  semanas: nullableText(20),
  dependencias: z.array(cronogramaDependenciaSchema).max(200).optional().default([]),
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

/**
 * POST /api/programa-auditoria
 *
 * Las secciones del cronograma llegan siempre (una por proceso), así que lo que
 * se exige es que **alguna** tenga dependencias: un cronograma con los seis
 * procesos vacíos no programa nada. La distribución sí es opcional: sin ella el
 * Excel sale con una sola hoja.
 */
export const crearProgramaSchema = z.object({
  ...cabecera,
  cronograma: z
    .array(cronogramaSeccionSchema)
    .max(20)
    .refine((secciones) => secciones.some((s) => s.dependencias.length > 0), {
      message: 'El cronograma necesita al menos una dependencia en algún proceso.',
    }),
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
