'use client'

/**
 * Subida de los documentos de una auditoría.
 *
 * Un solo modal sirve para todos: cuál se sube depende de `docAbierto` y de su
 * entrada en el mapa de documentos (ver `lib/documentos.js`).
 */
import { useState } from 'react'
import { toast } from 'react-toastify'

import { supabase } from '@/lib/supabase/client'

/** Una hora: lo que dura la URL firmada que se devuelve tras subir. */
const EXPIRACION_URL_SEGUNDOS = 60 * 60

/**
 * @param {Object} params
 * @param {Record<string, import('../lib/documentos').Documento>} params.documentos
 * @param {Object|null} params.auditoria  Auditoría sobre la que se sube
 * @param {(campo: string, valor: any, extra?: Object) => void} params.onSubido
 *        Se llama tras subir para que la pantalla refresque su estado local.
 */
export function useSubidaDocumento({ documentos, auditoria, onSubido }) {
  const [docAbierto, setDocAbierto] = useState(null)
  const [subiendo, setSubiendo] = useState(false)

  const doc = docAbierto ? documentos[docAbierto] : null

  const cerrar = () => setDocAbierto(null)

  const subir = async (file) => {
    if (!doc || !auditoria || !file) return

    setSubiendo(true)
    try {
      const filePath = doc.buildPath(auditoria)

      if (doc.reemplazar) {
        await supabase.storage.from(doc.bucket).remove([filePath])
      }

      const { error: upErr } = await supabase.storage
        .from(doc.bucket)
        .upload(filePath, file, { upsert: !doc.reemplazar, contentType: 'application/pdf' })
      if (upErr) throw upErr

      if (doc.despues) await doc.despues(auditoria, filePath)

      const { data: signed } = await supabase.storage
        .from(doc.bucket)
        .createSignedUrl(filePath, EXPIRACION_URL_SEGUNDOS)

      const url = signed?.signedUrl || null
      const valor = doc.aEstado
        ? doc.aEstado(filePath, url)
        : { path: filePath, url, uploaded_at: new Date().toISOString() }

      onSubido(doc.campo, valor, doc.extraEstado)

      toast.success(doc.exito || 'Documento cargado.')
      cerrar()
    } catch (e) {
      console.error(`Error subiendo ${docAbierto}:`, e)
      toast.error(`No se pudo subir: ${e.message || 'error desconocido'}`)
    } finally {
      setSubiendo(false)
    }
  }

  return {
    /** Clave del documento abierto, o `null`. */
    docAbierto,
    /** Abre el modal para un documento: `abrir('plan')`. */
    abrir: setDocAbierto,
    cerrar,
    subiendo,
    /** Configuración del documento abierto. */
    doc,
    /** Handler para el `onUpload` del modal. */
    subir,
  }
}
