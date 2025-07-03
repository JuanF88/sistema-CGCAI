'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'react-toastify'
import { supabase } from '@/lib/supabaseClient'
import styles from './formulario.module.css'

export default function FormularioRegistro({ usuario, auditoria }) {
  const [form, setForm] = useState({
    fecha_auditoria: '',
    asistencia_tipo: 'Digital',
    auditores_acompanantes: '',
    objetivo: '',
    criterios: '',
    conclusiones: '',
    fecha_seguimiento: '',
    recomendaciones: ''
  })

  const [fortalezas, setFortalezas] = useState([])
  const [oportunidades, setOportunidades] = useState([])
  const [noConformidades, setNoConformidades] = useState([])
  const [listaIso, setListaIso] = useState([])
  const [listaCapitulos, setListaCapitulos] = useState({})
  const [listaNumerales, setListaNumerales] = useState({})
  const [loading, setLoading] = useState(false)


  const router = useRouter()

  useEffect(() => {
    const cargarISO = async () => {
      const { data } = await supabase.from('iso').select('*')
      if (data) setListaIso(data)
    }
    cargarISO()
  }, [])

  useEffect(() => {
    if (auditoria) {
      setForm({
        fecha_auditoria: auditoria.fecha_auditoria || '',
        asistencia_tipo: auditoria.asistencia_tipo || 'Digital',
        auditores_acompanantes: (auditoria.auditores_acompanantes || []).join(', '),
        objetivo: auditoria.objetivo || '',
        criterios: auditoria.criterios || '',
        conclusiones: auditoria.conclusiones || '',
        fecha_seguimiento: auditoria.fecha_seguimiento || '',
        recomendaciones: auditoria.recomendaciones || ''
      })
      const cargarHallazgos = async () => {
        const [fort, opor, noConfor] = await Promise.all([
          supabase.from('fortalezas').select('*').eq('informe_id', auditoria.id),
          supabase.from('oportunidades_mejora').select('*').eq('informe_id', auditoria.id),
          supabase.from('no_conformidades').select('*').eq('informe_id', auditoria.id),
        ])

        // Fortalezas
        if (fort.data) {
          const fortalezasFormateadas = fort.data.map(f => ({
            iso: f.iso_id,
            capitulo: f.capitulo_id,
            numeral: f.numeral_id,
            descripcion: f.descripcion,
            razon: f.razon,
          }))
          setFortalezas(fortalezasFormateadas)

          for (const f of fortalezasFormateadas) {
            if (f.iso) await cargarCapitulos(f.iso)
            if (f.capitulo) await cargarNumerales(f.capitulo)
          }
        }

        // Oportunidades de mejora
        if (opor.data) {
          const oportunidadesFormateadas = opor.data.map(o => ({
            iso: o.iso_id,
            capitulo: o.capitulo_id,
            numeral: o.numeral_id,
            descripcion: o.descripcion,
            para_que: o.para_que,
          }))
          setOportunidades(oportunidadesFormateadas)

          for (const o of oportunidadesFormateadas) {
            if (o.iso) await cargarCapitulos(o.iso)
            if (o.capitulo) await cargarNumerales(o.capitulo)
          }
        }

        // No conformidades
        if (noConfor.data) {
          const noConformidadesFormateadas = noConfor.data.map(n => ({
            iso: n.iso_id,
            capitulo: n.capitulo_id,
            numeral: n.numeral_id,
            descripcion: n.descripcion,
            evidencia: n.evidencia,
          }))
          setNoConformidades(noConformidadesFormateadas)

          for (const n of noConformidadesFormateadas) {
            if (n.iso) await cargarCapitulos(n.iso)
            if (n.capitulo) await cargarNumerales(n.capitulo)
          }
        }

      }

      cargarHallazgos()

    }
  }, [auditoria])

  const cargarCapitulos = async (isoId) => {
    if (listaCapitulos[isoId]) return
    const { data } = await supabase.from('capitulos').select('*').eq('iso_id', isoId)
    if (data) setListaCapitulos(prev => ({ ...prev, [isoId]: data }))
  }

  const cargarNumerales = async (capituloId) => {
    if (listaNumerales[capituloId]) return
    const { data } = await supabase.from('numerales').select('*').eq('capitulo_id', capituloId)
    if (data) setListaNumerales(prev => ({ ...prev, [capituloId]: data }))
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleFortalezaChange = (index, field, value) => {
    const nuevas = [...fortalezas]
    nuevas[index][field] = value
    setFortalezas(nuevas)
  }

  const handleOportunidadChange = (index, field, value) => {
    const nuevas = [...oportunidades]
    nuevas[index][field] = value
    setOportunidades(nuevas)
  }

  const handleNoConformidadChange = (index, field, value) => {
    const nuevas = [...noConformidades]
    nuevas[index][field] = value
    setNoConformidades(nuevas)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (loading) return // prevenir doble clic
    setLoading(true)

    const payload = {
      ...form,
      auditores_acompanantes: form.auditores_acompanantes
        ? form.auditores_acompanantes.split(',').map(s => s.trim())
        : []
    }

    try {
      let informeId

      if (auditoria) {
        const { error } = await supabase
          .from('informes_auditoria')
          .update(payload)
          .eq('id', auditoria.id)

        if (error) throw error
        informeId = auditoria.id

        await supabase.from('fortalezas').delete().eq('informe_id', informeId)
        await supabase.from('oportunidades_mejora').delete().eq('informe_id', informeId)
        await supabase.from('no_conformidades').delete().eq('informe_id', informeId)
      } else {
        const { data: nueva, error } = await supabase
          .from('informes_auditoria')
          .insert({
            ...payload,
            usuario_id: usuario.usuario_id,
            dependencia_id: usuario.dependencia_id
          })
          .select()
          .single()

        if (error) throw error
        informeId = nueva.id
      }

      for (const f of fortalezas) {
        const insert = await supabase.from('fortalezas').insert({
          informe_id: informeId,
          iso_id: f.iso,
          capitulo_id: f.capitulo,
          numeral_id: f.numeral,
          descripcion: f.descripcion,
          razon: f.razon
        })
        if (insert.error) throw insert.error
      }

      for (const o of oportunidades) {
        const insert = await supabase.from('oportunidades_mejora').insert({
          informe_id: informeId,
          iso_id: o.iso,
          capitulo_id: o.capitulo,
          numeral_id: o.numeral,
          descripcion: o.descripcion,
          para_que: o.para_que
        })
        if (insert.error) throw insert.error
      }

      for (const n of noConformidades) {
        const insert = await supabase.from('no_conformidades').insert({
          informe_id: informeId,
          iso_id: n.iso,
          capitulo_id: n.capitulo,
          numeral_id: n.numeral,
          descripcion: n.descripcion,
          evidencia: n.evidencia
        })
        if (insert.error) throw insert.error
      }

      toast.success('Informe y hallazgos guardados correctamente')
      localStorage.setItem('vistaAuditor', 'bienvenida')
      router.push('/auditor?vista=bienvenida')

    } catch (err) {
      console.error('❌ Error al guardar:', err)
      toast.error('Error al guardar informe y hallazgos')
    } finally {
      setLoading(false)
    }
  }


  return (
    <div className="bg-white p-8 rounded-xl shadow-lg max-w-4xl mx-auto animate-fade-in">
      <h2 className={styles.tituloEstilo}>
        {auditoria ? 'Llenar Informe de Auditoría' : 'Nuevo Informe de Auditoría'}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Campos del informe */}
        <label className={styles.etiqueta} htmlFor="fecha_auditoria">Fecha de la auditoría</label>
        <input
          type="date"
          id="fecha_auditoria"
          name="fecha_auditoria"
          value={form.fecha_auditoria}
          onChange={handleChange}
          className={styles.inputEstilo}
        />

        <label className={styles.etiqueta} htmlFor="asistencia_tipo">Tipo de proceso (Digital/Físico)</label>
        <select
          id="asistencia_tipo"
          name="asistencia_tipo"
          value={form.asistencia_tipo}
          onChange={handleChange}
          className={styles.inputEstilo}
        >
          <option value="Digital">Digital</option>
          <option value="Físico">Físico</option>
        </select>

        <label className={styles.etiqueta} htmlFor="auditores_acompanantes">Auditores acompañantes</label>
        <input
          type="text"
          id="auditores_acompanantes"
          name="auditores_acompanantes"
          value={form.auditores_acompanantes}
          onChange={handleChange}
          className={styles.inputEstilo}
        />

        <label className={styles.etiqueta} htmlFor="objetivo">Objetivo</label>
        <textarea
          id="objetivo"
          name="objetivo"
          value={form.objetivo}
          onChange={handleChange}
          className={styles.inputEstilo}
        />

        <label className={styles.etiqueta} htmlFor="criterios">Criterios</label>
        <textarea
          id="criterios"
          name="criterios"
          value={form.criterios}
          onChange={handleChange}
          className={styles.inputEstilo}
        />

        <label className={styles.etiqueta} htmlFor="conclusiones">Conclusiones</label>
        <textarea
          id="conclusiones"
          name="conclusiones"
          value={form.conclusiones}
          onChange={handleChange}
          className={styles.inputEstilo}
        />

        <label className={styles.etiqueta} htmlFor="fecha_seguimiento">Fecha de seguimiento</label>
        <input
          type="date"
          id="fecha_seguimiento"
          name="fecha_seguimiento"
          value={form.fecha_seguimiento}
          onChange={handleChange}
          className={styles.inputEstilo}
        />

        <label className={styles.etiqueta} htmlFor="recomendaciones">Recomendaciones</label>
        <textarea
          id="recomendaciones"
          name="recomendaciones"
          value={form.recomendaciones}
          onChange={handleChange}
          className={styles.inputEstilo}
        />


        {/* Subformulario de fortalezas */}
        <h3 className={styles.etiquetaTituloFortalezas}>Fortalezas</h3>
        {fortalezas.map((f, i) => (
          <div key={i} className={`${styles.subformulario} ${styles.fortalezaBg} relative`}>
            {/* Botón para eliminar */}
            <button
              type="button"
              onClick={() => setFortalezas(prev => prev.filter((_, j) => j !== i))}
              className="absolute top-2 right-2 text-red-500 hover:text-red-700 text-xl font-bold"
              title="Eliminar fortaleza"
            >
              ✖
            </button>

            <label className={styles.etiqueta} htmlFor={`iso-${i}`}>ISO</label>
            <select
              id={`iso-${i}`}
              value={f.iso}
              onChange={async (e) => {
                const isoId = parseInt(e.target.value)
                handleFortalezaChange(i, 'iso', isoId)
                handleFortalezaChange(i, 'capitulo', '')
                handleFortalezaChange(i, 'numeral', '')
                await cargarCapitulos(isoId)
              }}
              className={styles.inputCampo}
            >
              <option value="">Seleccionar ISO</option>
              {listaIso.map(iso => (
                <option key={iso.id} value={iso.id}>{iso.iso}</option>
              ))}
            </select>

            <label className={styles.etiqueta} htmlFor={`capitulo-${i}`}>Capítulo</label>
            <select
              id={`capitulo-${i}`}
              value={f.capitulo}
              onChange={async (e) => {
                const capId = parseInt(e.target.value)
                handleFortalezaChange(i, 'capitulo', capId)
                handleFortalezaChange(i, 'numeral', '')
                await cargarNumerales(capId)
              }}
              disabled={!f.iso}
              className={styles.inputCampo}
            >
              <option value="">Capítulo</option>
              {(listaCapitulos[f.iso] || []).map(c => (
                <option key={c.id} value={c.id}>{c.capitulo}</option>
              ))}
            </select>

            <label className={styles.etiqueta} htmlFor={`numeral-${i}`}>Numeral</label>
            <select
              id={`numeral-${i}`}
              value={f.numeral}
              onChange={(e) => handleFortalezaChange(i, 'numeral', parseInt(e.target.value))}
              disabled={!f.capitulo}
              className={styles.inputCampo}
            >
              <option value="">Numeral</option>
              {(listaNumerales[f.capitulo] || []).map(n => (
                <option key={n.id} value={n.id}>{n.numeral}</option>
              ))}
            </select>

            <label className={styles.etiqueta} htmlFor={`descripcion-${i}`}>Descripción</label>
            <input
              type="text"
              id={`descripcion-${i}`}
              value={f.descripcion}
              onChange={(e) => handleFortalezaChange(i, 'descripcion', e.target.value)}
              className={styles.inputCampo}
            />

            <label className={styles.etiqueta} htmlFor={`razon-${i}`}>Razón</label>
            <input
              type="text"
              id={`razon-${i}`}
              value={f.razon}
              onChange={(e) => handleFortalezaChange(i, 'razon', e.target.value)}
              className={styles.inputCampo}
            />
          </div>
        ))}


        {/* Subformulario de oportunidades de mejora */}
        <h3 className={styles.etiquetaTituloOportunidades}>Oportunidades de Mejora</h3>
        {oportunidades.map((o, i) => (
          <div key={i} className={`${styles.subformulario} ${styles.oportunidadBg} relative`}>
            {/* Botón para eliminar */}
            <button
              type="button"
              onClick={() => setOportunidades(prev => prev.filter((_, j) => j !== i))}
              className="absolute top-2 right-2 text-red-500 hover:text-red-700 text-xl font-bold"
              title="Eliminar oportunidad"
            >
              ✖
            </button>

            <label className={styles.etiqueta} htmlFor={`oportunidad-iso-${i}`}>ISO</label>
            <select
              id={`oportunidad-iso-${i}`}
              value={o.iso}
              onChange={async (e) => {
                const isoId = parseInt(e.target.value)
                handleOportunidadChange(i, 'iso', isoId)
                handleOportunidadChange(i, 'capitulo', '')
                handleOportunidadChange(i, 'numeral', '')
                await cargarCapitulos(isoId)
              }}
              className={styles.inputCampo}
            >
              <option value="">Seleccionar ISO</option>
              {listaIso.map(iso => <option key={iso.id} value={iso.id}>{iso.iso}</option>)}
            </select>

            <label className={styles.etiqueta} htmlFor={`oportunidad-capitulo-${i}`}>Capítulo</label>
            <select
              id={`oportunidad-capitulo-${i}`}
              value={o.capitulo}
              onChange={async (e) => {
                const capId = parseInt(e.target.value)
                handleOportunidadChange(i, 'capitulo', capId)
                handleOportunidadChange(i, 'numeral', '')
                await cargarNumerales(capId)
              }}
              disabled={!o.iso}
              className={styles.inputCampo}
            >
              <option value="">Capítulo</option>
              {(listaCapitulos[o.iso] || []).map(c => <option key={c.id} value={c.id}>{c.capitulo}</option>)}
            </select>

            <label className={styles.etiqueta} htmlFor={`oportunidad-numeral-${i}`}>Numeral</label>
            <select
              id={`oportunidad-numeral-${i}`}
              value={o.numeral}
              onChange={(e) => handleOportunidadChange(i, 'numeral', parseInt(e.target.value))}
              disabled={!o.capitulo}
              className={styles.inputCampo}
            >
              <option value="">Numeral</option>
              {(listaNumerales[o.capitulo] || []).map(n => <option key={n.id} value={n.id}>{n.numeral}</option>)}
            </select>

            <label className={styles.etiqueta} htmlFor={`oportunidad-descripcion-${i}`}>Descripción</label>
            <input
              type="text"
              id={`oportunidad-descripcion-${i}`}
              value={o.descripcion}
              onChange={(e) => handleOportunidadChange(i, 'descripcion', e.target.value)}
              className={styles.inputCampo}
            />

            <label className={styles.etiqueta} htmlFor={`oportunidad-para-que-${i}`}>¿Para qué?</label>
            <input
              type="text"
              id={`oportunidad-para-que-${i}`}
              value={o.para_que}
              onChange={(e) => handleOportunidadChange(i, 'para_que', e.target.value)}
              className={styles.inputCampo}
            />
          </div>
        ))}


        {/* Subformulario de no conformidades*/}


        <h3 className={styles.etiquetaTituloNoConformidad}>No Conformidades</h3>
        {noConformidades.map((n, i) => (
          <div key={i} className={`${styles.subformulario} ${styles.noConformidadBg} relative`}>
            {/* Botón para eliminar */}
            <button
              type="button"
              onClick={() => setNoConformidades(prev => prev.filter((_, j) => j !== i))}
              className="absolute top-2 right-2 text-red-500 hover:text-red-700 text-xl font-bold"
              title="Eliminar no conformidad"
            >
              ✖
            </button>

            <label className={styles.etiqueta} htmlFor={`noConformidad-iso-${i}`}>ISO</label>
            <select
              id={`noConformidad-iso-${i}`}
              value={n.iso}
              onChange={async (e) => {
                const isoId = parseInt(e.target.value)
                handleNoConformidadChange(i, 'iso', isoId)
                handleNoConformidadChange(i, 'capitulo', '')
                handleNoConformidadChange(i, 'numeral', '')
                await cargarCapitulos(isoId)
              }}
              className={styles.inputCampo}
            >
              <option value="">Seleccionar ISO</option>
              {listaIso.map(iso => <option key={iso.id} value={iso.id}>{iso.iso}</option>)}
            </select>

            <label className={styles.etiqueta} htmlFor={`noConformidad-capitulo-${i}`}>Capítulo</label>
            <select
              id={`noConformidad-capitulo-${i}`}
              value={n.capitulo}
              onChange={async (e) => {
                const capId = parseInt(e.target.value)
                handleNoConformidadChange(i, 'capitulo', capId)
                handleNoConformidadChange(i, 'numeral', '')
                await cargarNumerales(capId)
              }}
              disabled={!n.iso}
              className={styles.inputCampo}
            >
              <option value="">Capítulo</option>
              {(listaCapitulos[n.iso] || []).map(c => <option key={c.id} value={c.id}>{c.capitulo}</option>)}
            </select>

            <label className={styles.etiqueta} htmlFor={`noConformidad-numeral-${i}`}>Numeral</label>
            <select
              id={`noConformidad-numeral-${i}`}
              value={n.numeral}
              onChange={(e) => handleNoConformidadChange(i, 'numeral', parseInt(e.target.value))}
              disabled={!n.capitulo}
              className={styles.inputCampo}
            >
              <option value="">Numeral</option>
              {(listaNumerales[n.capitulo] || []).map(nu => <option key={nu.id} value={nu.id}>{nu.numeral}</option>)}
            </select>

            <label className={styles.etiqueta} htmlFor={`noConformidad-descripcion-${i}`}>Descripción</label>
            <input
              type="text"
              id={`noConformidad-descripcion-${i}`}
              value={n.descripcion}
              onChange={(e) => handleNoConformidadChange(i, 'descripcion', e.target.value)}
              className={styles.inputCampo}
            />

            <label className={styles.etiqueta} htmlFor={`noConformidad-evidencia-${i}`}>Evidencia</label>
            <input
              type="text"
              id={`noConformidad-evidencia-${i}`}
              value={n.evidencia}
              onChange={(e) => handleNoConformidadChange(i, 'evidencia', e.target.value)}
              className={styles.inputCampo}
            />
          </div>
        ))}

        <button type="button" onClick={() => setFortalezas([...fortalezas, { iso: '', capitulo: '', numeral: '', descripcion: '', razon: '' }])} className={`${styles.botonHallazgo} ${styles.verde}`}>➕ Fortaleza</button>
        <button type="button" onClick={() => setOportunidades([...oportunidades, { iso: '', capitulo: '', numeral: '', descripcion: '', para_que: '' }])} className={`${styles.botonHallazgo} ${styles.azul}`}>➕ Oportunidad</button>
        <button type="button" onClick={() => setNoConformidades([...noConformidades, { iso: '', capitulo: '', numeral: '', descripcion: '', evidencia: '' }])} className={`${styles.botonHallazgo} ${styles.rojo}`}> ➕ No Conformidad </button>

        <button
          type="submit"
          className={styles.botonGuardar}
          disabled={loading}
        >
          {loading ? 'Guardando...' : (auditoria ? 'Actualizar informe' : 'Guardar informe')}
        </button>

      </form>
    </div>
  )
}
