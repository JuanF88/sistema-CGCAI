'use client'

/**
 * Las notas libres de las etapas de una auditoría.
 *
 * Una por (auditoría, etapa). Se cargan todas de golpe al elegir la auditoría
 * —son seis filas cortas— y se guardan una a una desde la tarjeta de su paso.
 *
 * El estado local se actualiza antes de que vuelva el servidor: la nota es del
 * propio auditor y no hay nada que el servidor pueda decidir sobre ella. Si el
 * guardado falla se avisa y se deja lo escrito en pantalla, para que no se
 * pierda mientras se arregla la conexión.
 */
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'react-toastify'

import { supabase } from '@/lib/supabase/client'

/**
 * @param {number|string|null} informeId
 * @returns {{notas: Record<string, string>, guardar: (etapa: string, nota: string) => Promise<boolean>}}
 */
export function useNotasEtapa(informeId) {
  const [notas, setNotas] = useState({})

  useEffect(() => {
    if (!informeId) {
      setNotas({})
      return
    }

    // Al cambiar de auditoría mientras la consulta está en vuelo, la respuesta
    // de la anterior llegaría después y pintaría sus notas en esta.
    let vigente = true

    const cargar = async () => {
      const { data, error } = await supabase
        .from('notas_etapa_auditoria')
        .select('etapa, nota')
        .eq('informe_id', informeId)

      if (!vigente) return

      // Sin `toast`: que falten las notas no debe llenar la pantalla de avisos
      // al abrir la línea de trabajo. El fallo se ve al intentar guardar.
      if (error) {
        console.error('No se pudieron cargar las notas de las etapas:', error)
        setNotas({})
        return
      }

      setNotas(Object.fromEntries((data ?? []).map((n) => [n.etapa, n.nota ?? ''])))
    }

    cargar()
    return () => {
      vigente = false
    }
  }, [informeId])

  const guardar = useCallback(
    async (etapa, nota) => {
      if (!informeId) return false

      const texto = String(nota ?? '').trim()
      setNotas((prev) => ({ ...prev, [etapa]: texto }))

      const { data: userRes } = await supabase.auth.getUser()

      const { error } = await supabase.from('notas_etapa_auditoria').upsert(
        {
          informe_id: informeId,
          etapa,
          nota: texto,
          actualizado_por: userRes?.user?.id || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'informe_id,etapa' }
      )

      if (error) {
        toast.error(`No se pudo guardar la nota: ${error.message}`)
        return false
      }

      return true
    },
    [informeId]
  )

  return { notas, guardar }
}
