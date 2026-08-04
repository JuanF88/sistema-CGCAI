/**
 * Estado de una auditoría deducido de sus datos y de los documentos cargados.
 */
import { parseYMD } from '@/features/auditorias/hooks/useAuditTimeline'

/** ¿Está validada? Por archivo firmado o por la bandera de la base de datos. */
export const isAuditValidated = (a) => Boolean(a?.validated?.url) || a?.validado === true

/** ¿Tiene los cuatro campos de texto del informe rellenos? */
export const informeCompleto = (a) =>
  Boolean(a.objetivo?.trim()) &&
  Boolean(a.criterios?.trim()) &&
  Boolean(a.conclusiones?.trim()) &&
  Boolean(a.recomendaciones?.trim())

/** ¿Tiene al menos un hallazgo de cualquier tipo? */
export const tieneHallazgos = (a) =>
  (a.fortalezas?.length || 0) +
    (a.oportunidades_mejora?.length || 0) +
    (a.no_conformidades?.length || 0) >
  0

/**
 * Resumen del estado documental, para filtrar listados y calcular KPI.
 *
 * @returns {{fa: Date|null, tienePlan: boolean, informeCompleto: boolean,
 *   validado: boolean, asistenciaOK: boolean, evaluacionOK: boolean,
 *   actaOK: boolean, actaCompOK: boolean, listoValidar: boolean}}
 */
export function computeFlags(a) {
  const completo = informeCompleto(a)
  const validado = isAuditValidated(a)

  return {
    fa: a.fecha_auditoria ? parseYMD(a.fecha_auditoria) : null,
    tienePlan: Boolean(a.plan?.url || a.plan?.enviado_at),
    informeCompleto: completo,
    validado,
    asistenciaOK: Boolean(a.asistencia?.url),
    evaluacionOK: Boolean(a.evaluacion?.url),
    actaOK: Boolean(a.acta?.url),
    actaCompOK: Boolean(a.acta_compromiso?.url),
    listoValidar: completo && tieneHallazgos(a) && !validado,
  }
}
