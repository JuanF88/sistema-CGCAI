/**
 * Los documentos que se pueden subir desde la línea de tiempo de una auditoría.
 *
 * Cada entrada declara **solo lo que cambia** entre un documento y otro; el
 * proceso de subida es común y vive en `useSubidaDocumento`.
 *
 * Los dos paneles comparten los cinco primeros documentos y se diferencian en
 * la validación: el auditor deja además constancia en `validaciones_informe`, y
 * el administrador reemplaza el archivo en vez de sobrescribirlo.
 *
 * @typedef {Object} Documento
 * @property {string}   titulo          Título del modal de subida
 * @property {string}   bucket          Bucket de Supabase Storage
 * @property {Function} buildPath       (auditoria) => ruta dentro del bucket
 * @property {number}   maxSizeMB
 * @property {string}   campo           Campo del objeto auditoría que actualiza
 * @property {string}   exito           Mensaje del toast al terminar
 * @property {string}   [etiquetaBoton]
 * @property {boolean}  [reemplazar]    Borrar y volver a subir en vez de upsert
 * @property {Object}   [extraEstado]   Campos extra a fusionar en la auditoría
 * @property {Function} [aEstado]       (ruta, url) => valor guardado en `campo`
 * @property {Function} [despues]       (auditoria, ruta) => efectos adicionales
 */
import { supabase } from '@/lib/supabase/client'

import {
  BUCKETS,
  MAX_MB,
  buildActaCompromisoPath,
  buildActaPath,
  buildAsistenciaPath,
  buildEvaluacionPath,
  buildPlanPath,
  buildValidationPath,
} from '@/features/auditorias/hooks/useAuditTimeline'

/** Deja constancia del plan subido en `planes_auditoria_informe`. */
async function registrarPlan(auditoria, filePath) {
  const { data: userRes } = await supabase.auth.getUser()
  const { error } = await supabase.from('planes_auditoria_informe').upsert(
    {
      informe_id: auditoria.id,
      archivo_path: filePath,
      enviado_por: userRes?.user?.id || null,
    },
    { onConflict: 'informe_id' }
  )
  if (error) throw error
}

/** Marca el informe como validado. */
async function marcarValidado(auditoria) {
  const { error } = await supabase
    .from('informes_auditoria')
    .update({ validado: true })
    .eq('id', auditoria.id)
  if (error) throw error
}

/** Los cinco documentos que se suben igual en los dos paneles. */
const COMUNES = {
  plan: {
    titulo: 'Subir plan de auditoría',
    bucket: BUCKETS.PLANES,
    buildPath: buildPlanPath,
    maxSizeMB: MAX_MB.PLAN,
    campo: 'plan',
    exito: 'Plan cargado.',
    aEstado: (filePath, url) => ({ path: filePath, enviado_at: new Date().toISOString(), url }),
    despues: registrarPlan,
  },

  actaCompromiso: {
    titulo: 'Subir carta de compromiso',
    bucket: BUCKETS.ACTAS_COMPROMISO,
    buildPath: buildActaCompromisoPath,
    maxSizeMB: MAX_MB.ACTA_COMPROMISO,
    campo: 'acta_compromiso',
    exito: 'Carta de compromiso cargada.',
  },

  asistencia: {
    titulo: 'Subir listado de asistencia',
    bucket: BUCKETS.ASISTENCIAS,
    buildPath: buildAsistenciaPath,
    maxSizeMB: MAX_MB.ASISTENCIA,
    campo: 'asistencia',
    exito: 'Asistencia cargada.',
  },

  evaluacion: {
    titulo: 'Subir evaluación',
    bucket: BUCKETS.EVALUACIONES,
    buildPath: buildEvaluacionPath,
    maxSizeMB: MAX_MB.EVALUACION,
    campo: 'evaluacion',
    exito: 'Evaluación cargada.',
  },

  acta: {
    titulo: 'Subir acta de reunión',
    bucket: BUCKETS.ACTAS,
    buildPath: buildActaPath,
    maxSizeMB: MAX_MB.ACTA,
    campo: 'acta',
    exito: 'Acta cargada.',
  },
}

/** Parte de la validación que es igual en los dos paneles. */
const VALIDACION_BASE = {
  titulo: 'Validar informe — subir PDF firmado',
  bucket: BUCKETS.VALIDACIONES,
  buildPath: buildValidationPath,
  maxSizeMB: MAX_MB.VALIDACION,
  campo: 'validated',
  etiquetaBoton: 'Subir y validar',
  exito: 'Informe validado.',
  aEstado: (filePath, url) => ({ file: filePath, url }),
}

/** @type {Record<string, Documento>} */
export const DOCUMENTOS_AUDITOR = {
  ...COMUNES,
  validacion: {
    ...VALIDACION_BASE,
    despues: async (auditoria, filePath) => {
      await supabase
        .from('validaciones_informe')
        .insert([{ informe_id: auditoria.id, archivo_url: filePath }])
      await marcarValidado(auditoria)
    },
  },
}

/** @type {Record<string, Documento>} */
export const DOCUMENTOS_ADMIN = {
  ...COMUNES,
  validacion: {
    ...VALIDACION_BASE,
    // El validado se borra y se vuelve a subir en vez de hacer upsert.
    reemplazar: true,
    extraEstado: { validado: true },
    despues: marcarValidado,
  },
}
