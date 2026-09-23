/**
 * Los plazos de los documentos de una auditoría, en un único sitio.
 *
 * Todos se cuentan en **días hábiles** desde la fecha de la auditoría. El signo
 * dice de qué lado: negativo es antes, positivo después.
 *
 * Vivían repetidos en cuatro sitios —la línea de trabajo del auditor, la del
 * administrador, el Centro de Control y el cálculo de la nota de archivos— y se
 * habían separado entre sí: el Centro de Control daba el acta por vencida el
 * mismo día de la auditoría y la carta de compromiso quince días naturales
 * *después*, cuando en realidad se entrega cinco días hábiles *antes*. Con la
 * tabla aquí, cambiar un plazo es cambiar un número.
 *
 * Cada documento se llama de tres maneras distintas según el subsistema, así
 * que la equivalencia queda escrita: `etapa` es la clave en las líneas de
 * tiempo, `alerta` la de `alertas_procesos_config` y la propia clave del objeto
 * es el `tipo` que usa la evaluación de archivos.
 */
export const PLAZOS = {
  actaCompromiso: {
    dias: -5,
    etapa: 'acta_compromiso',
    alerta: 'carta_compromiso',
    texto: '5 días hábiles antes',
  },
  plan: {
    dias: -5,
    etapa: 'plan',
    alerta: 'plan_auditoria',
    texto: '5 días hábiles antes',
  },
  /**
   * La asistencia y la evaluación se recogen en la reunión y se digitalizan
   * después, así que el plazo es el día hábil siguiente y no el mismo día: en
   * la práctica nadie escanea y sube mientras cierra la auditoría.
   */
  asistencia: {
    dias: 1,
    etapa: 'asistencia',
    alerta: 'listado_asistencia',
    texto: 'el día hábil siguiente',
  },
  evaluacion: {
    dias: 1,
    etapa: 'evaluacion',
    alerta: 'evaluacion',
    texto: 'el día hábil siguiente',
  },
  acta: {
    dias: 10,
    etapa: 'acta',
    alerta: 'acta_reunion',
    texto: '10 días hábiles después',
  },
  validacion: {
    dias: 10,
    etapa: 'informe',
    alerta: 'informe_auditoria',
    texto: '10 días hábiles después',
  },
}

/** Días hábiles del plazo de un documento, o `null` si el tipo no existe. */
export const diasHabilesDe = (tipo) => PLAZOS[tipo]?.dias ?? null

/** El plazo buscado por su clave en `alertas_procesos_config`. */
export const plazoDeAlerta = (procesoKey) =>
  Object.values(PLAZOS).find((p) => p.alerta === procesoKey) ?? null
