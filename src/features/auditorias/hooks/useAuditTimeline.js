/**
 * Custom Hook para gestionar lógica de timeline de auditorías
 * Centraliza utilidades de fecha, cálculos de progreso y gestión de etapas
 */

import { useMemo } from 'react'

/* ---- Utilidades de Fecha ---- */
export function parseYMD(ymd) {
  if (!ymd) return null
  const [y, m, d] = ymd.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

export function addDays(date, n) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  d.setDate(d.getDate() + n)
  return d
}

export function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function diffInDays(from, to) {
  const ms = startOfDay(to) - startOfDay(from)
  return Math.round(ms / 86400000)
}

/**
 * Suma días hábiles (lunes-viernes) a una fecha
 * Excluye fines de semana
 */
export function addBusinessDays(date, n) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const step = n >= 0 ? 1 : -1
  let count = 0
  
  while (count < Math.abs(n)) {
    d.setDate(d.getDate() + step)
    const dayOfWeek = d.getDay()
    // dayOfWeek: 0=domingo, 1-5=lunes-viernes, 6=sábado
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      count++
    }
  }
  
  return d
}

/**
 * Calcula diferencia en días hábiles (lunes-viernes)
 * Excluye fines de semana
 */
export function diffInBusinessDays(from, to) {
  const start = startOfDay(from)
  const end = startOfDay(to)
  const step = end >= start ? 1 : -1
  const current = new Date(start)
  let count = 0
  
  while ((step > 0 && current < end) || (step < 0 && current > end)) {
    current.setDate(current.getDate() + step)
    const dayOfWeek = current.getDay()
    // dayOfWeek: 0=domingo, 1-5=lunes-viernes, 6=sábado
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      count += step
    }
  }
  
  return count
}

export function fmt(date) {
  try {
    return new Intl.DateTimeFormat('es-CO', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: 'short',
      day: '2-digit'
    }).format(date)
  } catch {
    return date.toLocaleDateString()
  }
}

/* ---- Sistema de Badges ---- */
export function badgeFor(daysLeft, explicitDone = false, styles = {}) {
  if (explicitDone) return { label: 'Completado', cls: styles.badgeOk || 'badgeOk' }
  if (daysLeft < 0) return { label: `Vencido ${Math.abs(daysLeft)} d`, cls: styles.badgeOverdue || 'badgeOverdue' }
  if (daysLeft === 0) return { label: 'Hoy', cls: styles.badgeToday || 'badgeToday' }
  if (daysLeft <= 3) return { label: `En ${daysLeft} d`, cls: styles.badgeSoon || 'badgeSoon' }
  return { label: `Faltan ${daysLeft} d`, cls: styles.badgePending || 'badgePending' }
}

/* ---- Normalización de nombres ---- */
export const toSlugUpper = (s = '') =>
  s.normalize('NFD')
   .replace(/[\u0300-\u036f]/g, '')
   .replace(/[^A-Za-z0-9]+/g, '_')
   .replace(/^_+|_+$/g, '')
   .toUpperCase()

export const toYMD = (input) => {
  if (!input) return new Date().toISOString().slice(0, 10)
  const s = String(input)
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : new Date(input).toISOString().slice(0, 10)
}

/* ---- Constantes de Buckets ---- */
export const BUCKETS = {
  PLANES: 'planes',
  ASISTENCIAS: 'asistencias',
  EVALUACIONES: 'evaluaciones',
  ACTAS: 'actas',
  ACTAS_COMPROMISO: 'actascompromiso',
  VALIDACIONES: 'validaciones',
  NOVEDADES: 'novedades',
}

/* ---- Validación de Archivos ---- */

/**
 * Tamaño máximo por tipo de documento, en megabytes. **Dos para todos.**
 *
 * Única fuente del límite. Antes el número vivía por triplicado —aquí, en
 * `lib/documentos.js` y escrito a mano en el modal de «Mis auditorías»—, y se
 * desincronizaron: el modal anunciaba 2 MB mientras el código rechazaba a
 * partir de 1. El informe firmado se quedaba con ese 1 MB, el límite más
 * pequeño del sistema para el documento que más pesa; de los veinte informes
 * subidos, el mayor pesa 0,94 MB, pegado al techo.
 *
 * Se mantienen todos iguales a propósito: un único número que explicar al
 * auditor, y un solo sitio que tocar si algún día se queda corto. Los buckets
 * de Storage no imponen tope propio, así que esto es el único freno que hay.
 */
export const MAX_MB = {
  PLAN: 2,
  ASISTENCIA: 2,
  EVALUACION: 2,
  ACTA: 2,
  ACTA_COMPROMISO: 2,
  VALIDACION: 2,
  NOVEDAD: 2,
}

export const FILE_LIMITS = Object.fromEntries(
  Object.entries(MAX_MB).map(([tipo, mb]) => [tipo, mb * 1024 * 1024])
)

export function validateFileSize(file, type = 'PLAN') {
  const limit = FILE_LIMITS[type] || FILE_LIMITS.PLAN
  if (!file) return { valid: false, error: 'No se seleccionó ningún archivo' }
  if (file.size > limit) {
    const mb = (limit / (1024 * 1024)).toFixed(0)
    return { valid: false, error: `El archivo supera el tamaño máximo de ${mb} MB.` }
  }
  return { valid: true, error: null }
}

/* ---- Constructores de Rutas ---- */
// ✅ SIN FECHA: Los archivos mantienen el mismo nombre aunque cambies la fecha de auditoría
export const buildPlanPath = (a) => 
  `PlanAuditoria_${a.id}_${toSlugUpper(a?.dependencias?.nombre || 'SIN_DEP')}.pdf`

export const buildAsistenciaPath = (a) => 
  `Asistencia_${a.id}_${toSlugUpper(a?.dependencias?.nombre || 'SIN_DEP')}.pdf`

export const buildEvaluacionPath = (a) => 
  `Evaluacion_${a.id}_${toSlugUpper(a?.dependencias?.nombre || 'SIN_DEP')}.pdf`

export const buildActaPath = (a) => 
  `Acta_${a.id}_${toSlugUpper(a?.dependencias?.nombre || 'SIN_DEP')}.pdf`

export const buildActaCompromisoPath = (a) => 
  `ActaCompromiso_${a.id}_${toSlugUpper(a?.dependencias?.nombre || 'SIN_DEP')}.pdf`

export const buildValidationPath = (a) => 
  `Auditoria_${a.id}_${toSlugUpper(a?.dependencias?.nombre || 'SIN_DEPENDENCIA')}.pdf`

/* ---- Cálculo de Timeline ---- */
export function useTimelineCalculation(selectedAudit) {
  return useMemo(() => {
    if (!selectedAudit?.fecha_auditoria) return []
    
    const hoy = startOfDay(new Date())
    const fa = parseYMD(selectedAudit.fecha_auditoria)
    if (!fa) return []

    const planDate = addDays(fa, -5)
    const informeLimit = addDays(fa, 10)
    const pmLimit = addDays(fa, 20)
    const actaCompromisoLimit = addDays(fa, 15)

    return {
      planDate,
      auditDate: fa,
      informeLimit,
      pmLimit,
      actaCompromisoLimit,
      today: hoy,
      // Días restantes para cada etapa
      planDays: diffInDays(hoy, planDate),
      auditDays: diffInDays(hoy, fa),
      informeDays: diffInDays(hoy, informeLimit),
      pmDays: diffInDays(hoy, pmLimit),
      actaCompDays: diffInDays(hoy, actaCompromisoLimit),
    }
  }, [selectedAudit])
}

/* ---- Validación de estado de informe ---- */
export function getInformeStatus(informe) {
  const isFilled = Boolean(
    informe?.objetivo?.trim() && 
    informe?.criterios?.trim() && 
    informe?.conclusiones?.trim() && 
    informe?.recomendaciones?.trim()
  )
  
  const hallCount = 
    (informe?.fortalezas?.length || 0) + 
    (informe?.oportunidades_mejora?.length || 0) + 
    (informe?.no_conformidades?.length || 0)
  
  const hasHallazgos = hallCount > 0
  const isValidated = Boolean(informe?.validated?.url) || informe?.validado === true
  const isReadyToValidate = isFilled && hasHallazgos && !isValidated

  return {
    isFilled,
    hasHallazgos,
    hallCount,
    isValidated,
    isReadyToValidate,
  }
}
