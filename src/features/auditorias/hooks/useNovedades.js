'use client'

/**
 * Novedades de una auditoría: documentos sueltos que se guardan en su propia
 * carpeta del bucket, sin límite de cuántos.
 */
import { useCallback, useState } from 'react'
import { toast } from 'react-toastify'

import { supabase } from '@/lib/supabase/client'
import { BUCKETS, fmt, toYMD } from '@/features/auditorias/hooks/useAuditTimeline'

const MAX_MB = 2

/** Una carpeta por auditoría. */
const carpetaDe = (auditoria) => `auditoria_${auditoria.id}`

/** `Novedad_<numero>_<YYYY-MM-DD>.<ext>` */
const rutaDe = (auditoria, file, numero) => {
  const ext = (file?.name?.split('.').pop() || 'pdf').toLowerCase()
  return `${carpetaDe(auditoria)}/Novedad_${numero}_${toYMD(new Date())}.${ext}`
}

export function useNovedades() {
  const [abierto, setAbierto] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [novedades, setNovedades] = useState([])
  const [archivo, setArchivo] = useState(null)
  const [subiendo, setSubiendo] = useState(false)

  const cargar = useCallback(async (auditoria) => {
    if (!auditoria) return
    setCargando(true)
    try {
      const carpeta = carpetaDe(auditoria)
      const { data, error } = await supabase.storage
        .from(BUCKETS.NOVEDADES)
        .list(carpeta, { limit: 100, sortBy: { column: 'name', order: 'asc' } })

      if (error) {
        console.error('Error al listar novedades:', error)
        toast.error(error.message || 'No se pudieron cargar las novedades.')
        setNovedades([])
        return
      }

      // Supabase crea un objeto placeholder al crear la carpeta; no es una novedad.
      const reales = (data || []).filter((obj) => {
        const n = (obj.name || '').toLowerCase()
        return n && !n.includes('emptyfolder')
      })

      setNovedades(
        await Promise.all(
          reales.map(async (obj, index) => {
            const path = `${carpeta}/${obj.name}`
            const { data: s } = await supabase.storage
              .from(BUCKETS.NOVEDADES)
              .createSignedUrl(path, 3600)
            const createdAt = obj.created_at ? new Date(obj.created_at) : null

            return {
              name: obj.name,
              path,
              url: s?.signedUrl || null,
              displayLabel: `Novedad ${index + 1}${createdAt ? ` — ${fmt(createdAt)}` : ''}`,
            }
          })
        )
      )
    } catch (e) {
      console.error('Cargar novedades error inesperado:', e)
      toast.error('No se pudieron cargar las novedades.')
      setNovedades([])
    } finally {
      setCargando(false)
    }
  }, [])

  const abrir = useCallback(
    (auditoria) => {
      if (!auditoria) return
      setNovedades([])
      setArchivo(null)
      setAbierto(true)
      cargar(auditoria)
    },
    [cargar]
  )

  const cerrar = useCallback(() => {
    setAbierto(false)
    setArchivo(null)
  }, [])

  /** Rechaza lo que pase de `MAX_MB`; devuelve `false` si no se aceptó. */
  const seleccionar = useCallback((file) => {
    if (file && file.size > MAX_MB * 1024 * 1024) {
      toast.warn(`Máximo ${MAX_MB} MB`)
      return false
    }
    setArchivo(file)
    return true
  }, [])

  const subir = async (auditoria) => {
    if (!auditoria || !archivo) return
    setSubiendo(true)
    try {
      const { error } = await supabase.storage
        .from(BUCKETS.NOVEDADES)
        .upload(rutaDe(auditoria, archivo, novedades.length + 1), archivo, {
          upsert: false,
          contentType: archivo.type || 'application/pdf',
        })
      if (error) throw error

      toast.success('Novedad registrada.')
      setArchivo(null)
      await cargar(auditoria)
    } catch (err) {
      console.error('Novedad error:', err)
      toast.error(err?.message || 'No se pudo registrar la novedad.')
    } finally {
      setSubiendo(false)
    }
  }

  return { abierto, cargando, novedades, archivo, subiendo, maxMB: MAX_MB, abrir, cerrar, seleccionar, subir }
}
