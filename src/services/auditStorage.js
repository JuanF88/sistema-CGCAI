/**
 * Servicio centralizado para operaciones de Supabase Storage
 * Maneja uploads, downloads y signed URLs para documentos de auditoría
 */

import { supabase } from '@/lib/supabaseClient'
import { BUCKETS, validateFileSize } from '@/hooks/useAuditTimeline'
import { toast } from 'react-toastify'

/**
 * Crea una signed URL para un archivo en storage
 * @param {string} bucket - Nombre del bucket
 * @param {string} path - Ruta del archivo
 * @param {number} expiresIn - Segundos de expiración (default: 3600)
 * @returns {Promise<{file: string, url: string}|null>}
 */
export async function createSignedUrl(bucket, path, expiresIn = 3600) {
  try {
    const { data, error } = await supabase
      .storage
      .from(bucket)
      .createSignedUrl(path, expiresIn)
    
    if (error) {
      console.error(`Error creando signed URL en ${bucket}/${path}:`, error)
      return null
    }
    
    return data?.signedUrl ? { file: path, url: data.signedUrl } : null
  } catch (err) {
    console.error(`Error inesperado en createSignedUrl:`, err)
    return null
  }
}

/**
 * Sube un archivo a Supabase Storage con validación
 * @param {Object} params
 * @param {string} params.bucket - Bucket de destino
 * @param {string} params.filePath - Ruta dentro del bucket
 * @param {File} params.file - Archivo a subir
 * @param {string} params.fileType - Tipo de archivo para validación (PLAN, ASISTENCIA, etc.)
 * @param {boolean} params.upsert - Permitir reemplazar archivos existentes
 * @returns {Promise<{success: boolean, data?: any, error?: string}>}
 */
export async function uploadFile({ bucket, filePath, file, fileType = 'PLAN', upsert = true }) {
  // Validar tamaño
  const validation = validateFileSize(file, fileType)
  if (!validation.valid) {
    toast.error(validation.error)
    return { success: false, error: validation.error }
  }

  try {
    // Si no es upsert, eliminar archivo existente primero
    if (!upsert) {
      await supabase.storage.from(bucket).remove([filePath])
    }

    const { data, error } = await supabase
      .storage
      .from(bucket)
      .upload(filePath, file, {
        upsert,
        contentType: file.type || 'application/pdf',
      })

    if (error) {
      console.error(`Error subiendo a ${bucket}/${filePath}:`, error)
      toast.error(error.message || `Error al subir ${fileType.toLowerCase()}`)
      return { success: false, error: error.message }
    }

    console.log(`✅ Archivo subido: ${bucket}/${filePath}`)
    return { success: true, data }
  } catch (err) {
    console.error(`Error inesperado subiendo archivo:`, err)
    toast.error('Error inesperado al subir el archivo')
    return { success: false, error: err.message }
  }
}

/**
 * Sube plan de auditoría y actualiza BD
 * @param {Object} auditoria - Objeto de auditoría
 * @param {File} file - Archivo PDF
 * @param {Function} pathBuilder - Función para construir la ruta
 * @returns {Promise<{success: boolean, signedUrl?: string, error?: string}>}
 */
export async function uploadPlanAuditoria(auditoria, file, pathBuilder) {
  const filePath = pathBuilder(auditoria)
  
  const uploadResult = await uploadFile({
    bucket: BUCKETS.PLANES,
    filePath,
    file,
    fileType: 'PLAN',
    upsert: true,
  })

  if (!uploadResult.success) {
    return uploadResult
  }

  try {
    // Obtener usuario actual
    const { data: userRes } = await supabase.auth.getUser()
    const enviado_por = userRes?.user?.id || null

    // Actualizar tabla planes_auditoria_informe
    const { error: dbError } = await supabase
      .from('planes_auditoria_informe')
      .upsert(
        { 
          informe_id: auditoria.id, 
          archivo_path: filePath, 
          enviado_por 
        },
        { onConflict: 'informe_id' }
      )

    if (dbError) {
      console.error('Error actualizando planes_auditoria_informe:', dbError)
      toast.error('Plan subido pero no se pudo actualizar la base de datos')
      return { success: false, error: dbError.message }
    }

    // Crear signed URL
    const signed = await createSignedUrl(BUCKETS.PLANES, filePath)
    
    toast.success('Plan de auditoría cargado correctamente')
    return { 
      success: true, 
      signedUrl: signed?.url,
      filePath,
    }
  } catch (err) {
    console.error('Error en uploadPlanAuditoria:', err)
    return { success: false, error: err.message }
  }
}

/**
 * Sube documento genérico (asistencia, evaluación, acta, acta compromiso)
 * @param {Object} params
 * @param {string} params.bucket - Bucket de destino
 * @param {Object} params.auditoria - Objeto de auditoría
 * @param {File} params.file - Archivo a subir
 * @param {Function} params.pathBuilder - Función para construir ruta
 * @param {string} params.fileType - Tipo de archivo para validación
 * @param {string} params.successMessage - Mensaje de éxito
 * @returns {Promise<{success: boolean, signedUrl?: string, filePath?: string, error?: string}>}
 */
export async function uploadGenericDocument({ 
  bucket, 
  auditoria, 
  file, 
  pathBuilder, 
  fileType,
  successMessage 
}) {
  const filePath = pathBuilder(auditoria)
  
  const uploadResult = await uploadFile({
    bucket,
    filePath,
    file,
    fileType,
    upsert: true,
  })

  if (!uploadResult.success) {
    return uploadResult
  }

  // Crear signed URL
  const signed = await createSignedUrl(bucket, filePath)
  
  toast.success(successMessage || 'Documento cargado correctamente')
  return { 
    success: true, 
    signedUrl: signed?.url,
    filePath,
  }
}

/**
 * Valida informe (sube PDF firmado y actualiza estado en BD)
 * @param {Object} auditoria - Objeto de auditoría
 * @param {File} file - PDF firmado
 * @param {Function} pathBuilder - Función para construir ruta
 * @returns {Promise<{success: boolean, signedUrl?: string, error?: string}>}
 */
export async function validateInforme(auditoria, file, pathBuilder) {
  const filePath = pathBuilder(auditoria)
  
  // Eliminar archivo anterior y subir nuevo (sin upsert)
  const uploadResult = await uploadFile({
    bucket: BUCKETS.VALIDACIONES,
    filePath,
    file,
    fileType: 'VALIDACION',
    upsert: false, // Fuerza eliminación y re-subida
  })

  if (!uploadResult.success) {
    return uploadResult
  }

  try {
    // Actualizar campo validado en informes_auditoria
    const { error: dbError } = await supabase
      .from('informes_auditoria')
      .update({ validado: true })
      .eq('id', auditoria.id)

    if (dbError) {
      console.error('Error actualizando validado:', dbError)
      toast.error('PDF subido pero no se pudo marcar como validado')
      return { success: false, error: dbError.message }
    }

    // Crear signed URL
    const signed = await createSignedUrl(BUCKETS.VALIDACIONES, filePath)
    
    toast.success('Informe validado correctamente')
    return { 
      success: true, 
      signedUrl: signed?.url,
      filePath,
    }
  } catch (err) {
    console.error('Error en validateInforme:', err)
    return { success: false, error: err.message }
  }
}

/**
 * Carga múltiples signed URLs en paralelo (optimización para loadData)
 * @param {Array<{bucket: string, path: string}>} requests - Array de solicitudes
 * @returns {Promise<Array<{file: string, url: string}|null>>}
 */
export async function batchCreateSignedUrls(requests) {
  return Promise.all(
    requests.map(({ bucket, path }) => createSignedUrl(bucket, path))
  )
}

/**
 * Lista archivos de una carpeta en storage
 * @param {string} bucket - Bucket a consultar
 * @param {string} folder - Carpeta dentro del bucket
 * @param {number} limit - Límite de resultados
 * @returns {Promise<Array>}
 */
export async function listFiles(bucket, folder, limit = 100) {
  try {
    const { data, error } = await supabase
      .storage
      .from(bucket)
      .list(folder, {
        limit,
        sortBy: { column: 'name', order: 'asc' },
      })

    if (error) {
      console.error(`Error listando archivos en ${bucket}/${folder}:`, error)
      toast.error(error.message || 'No se pudieron cargar los archivos')
      return []
    }

    // Filtrar placeholders de carpetas vacías
    return (data || []).filter(obj => {
      const name = (obj.name || '').toLowerCase()
      return name && 
             !name.includes('emptyfolderplaceholder') && 
             name !== '.emptyfolderplaceholder' && 
             name !== '.emptyfolder'
    })
  } catch (err) {
    console.error(`Error inesperado listando archivos:`, err)
    return []
  }
}

/**
 * Sube novedad y retorna información del archivo
 * @param {Object} auditoria - Objeto de auditoría
 * @param {File} file - Archivo PDF
 * @param {number} index - Índice de novedad (1, 2, 3...)
 * @param {Function} pathBuilder - Función para construir ruta
 * @returns {Promise<{success: boolean, signedUrl?: string, error?: string}>}
 */
export async function uploadNovedad(auditoria, file, index, pathBuilder) {
  const filePath = pathBuilder(auditoria, file, index)
  
  const uploadResult = await uploadFile({
    bucket: BUCKETS.NOVEDADES,
    filePath,
    file,
    fileType: 'NOVEDAD',
    upsert: false, // No permitir reemplazar novedades
  })

  if (!uploadResult.success) {
    return uploadResult
  }

  // Crear signed URL
  const signed = await createSignedUrl(BUCKETS.NOVEDADES, filePath)
  
  toast.success('Novedad registrada correctamente')
  return { 
    success: true, 
    signedUrl: signed?.url,
    filePath,
  }
}
