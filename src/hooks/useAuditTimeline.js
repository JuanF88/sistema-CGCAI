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
export const FILE_LIMITS = {
  PLAN: 2 * 1024 * 1024,        // 2MB
  ASISTENCIA: 2 * 1024 * 1024,
  EVALUACION: 2 * 1024 * 1024,
  ACTA: 2 * 1024 * 1024,
  ACTA_COMPROMISO: 2 * 1024 * 1024,
  VALIDACION: 1 * 1024 * 1024,  // 1MB (más restrictivo)
  NOVEDAD: 2 * 1024 * 1024,
}

export function validateFileSize(file, type = 'PLAN') {
  const limit = FILE_LIMITS[type] || FILE_LIMITS.PLAN
  if (!file) return { valid: false, error: 'No se seleccionó ningún archivo' }
  if (file.size > limit) {
    const mb = (limit / (1024 * 1024)).toFixed(0)
    return { valid: false, error: `El archivo supera el tamaño máximo de ${mb}MB` }
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
