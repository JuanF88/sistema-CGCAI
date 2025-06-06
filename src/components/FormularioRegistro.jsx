'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import styles from './CSS/formulario.module.css'

export default function FormularioRegistro({ usuario }) {
  const [form, setForm] = useState({
    fecha_auditoria: '',
    proceso: '',
    asistencia_tipo: 'Digital',
    auditores_acompanantes: '',
    objetivo: '',
    criterios: ''
  })

  const usuarioId = usuario?.usuario_id
  const [fortalezas, setFortalezas] = useState([])
  const [oportunidades, setOportunidades] = useState([])
  const [noConformidades, setNoConformidades] = useState([])

  const [listaIso, setListaIso] = useState([])
  const [listaCapitulos, setListaCapitulos] = useState({})
  const [listaNumerales, setListaNumerales] = useState({})

  useEffect(() => {
    const cargarISO = async () => {
      const { data, error } = await supabase.from('iso').select('*')
      if (!error) setListaIso(data)
    }
    cargarISO()
  }, [])

  const cargarCapitulos = async (isoId) => {
    if (listaCapitulos[isoId]) return
    const { data, error } = await supabase.from('capitulos').select('*').eq('iso_id', isoId)
    if (!error) setListaCapitulos(prev => ({ ...prev, [isoId]: data }))
  }

  const cargarNumerales = async (capituloId) => {
    if (listaNumerales[capituloId]) return
    const { data, error } = await supabase.from('numerales').select('*').eq('capitulo_id', capituloId)
    if (!error) setListaNumerales(prev => ({ ...prev, [capituloId]: data }))
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

  const agregarFortaleza = () => {
    setFortalezas(prev => [
      ...prev,
      { iso: '', capitulo: '', numeral: '', descripcion: '', razon: '' }
    ])
  }

  const eliminarFortaleza = (index) => {
    setFortalezas((prev) => prev.filter((_, i) => i !== index))
  }

  const agregarOportunidad = () => {
    setOportunidades((prev) => [
      ...prev,
      { iso: '', capitulo: '', numeral: '', descripcion: '', para_que: '' }
    ])
  }

  const eliminarOportunidad = (index) => {
    setOportunidades((prev) => prev.filter((_, i) => i !== index))
  }

  const handleOportunidadChange = (index, field, value) => {
    const nuevas = [...oportunidades]
    nuevas[index][field] = value
    setOportunidades(nuevas)
  }

  const agregarNoConformidad = () => {
    setNoConformidades(prev => [
      ...prev,
      { iso: '', capitulo: '', numeral: '', descripcion: '', evidencia: ''}
    ])
  }

  const eliminarNoConformidad = (index) => {
    setNoConformidades(prev => prev.filter((_, i) => i !== index))
  }

  const handleNoConformidadChange = (index, field, value) => {
    const nuevas = [...noConformidades]
    nuevas[index][field] = value
    setNoConformidades(nuevas)
  }


  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!usuarioId) {
      console.error("🛑 Usuario no autenticado o sin ID válido")
      alert("No se pudo guardar el informe. Usuario no válido.")
      return
    }

    const { data: informe, error } = await supabase.from('informes_auditoria').insert({
      ...form,
      usuario_id: usuarioId,
      dependencia: usuario.dependencia || 'No registrada',
      programa: usuario.programa || 'No especificado',
      auditores_acompanantes: form.auditores_acompanantes.split(',').map(s => s.trim())
    }).select().single()

    if (error) {
      console.error("🛑 Error al guardar informe:", error)
      alert("Ocurrió un error al guardar el informe")
      return
    }

    const informeId = informe.id

    for (const f of fortalezas) {
      const { error: errFort } = await supabase.from('fortalezas').insert({
        informe_id: informeId,
        iso_id: f.iso ? parseInt(f.iso) : null,
        capitulo_id: f.capitulo ? parseInt(f.capitulo) : null,
        numeral_id: f.numeral ? parseInt(f.numeral) : null,
        descripcion: f.descripcion,
        razon: f.razon
      })
      if (errFort) console.error(`❌ Error al insertar fortaleza [${fortalezas.indexOf(f)}]:`, errFort)
    }

    for (const o of oportunidades) {
      const { error: errOp } = await supabase.from('oportunidades_mejora').insert({
        informe_id: informeId,
        iso_id: o.iso ? parseInt(o.iso) : null,
        capitulo_id: o.capitulo ? parseInt(o.capitulo) : null,
        numeral_id: o.numeral ? parseInt(o.numeral) : null,
        descripcion: o.descripcion,
        para_que: o.para_que
      })
      if (errOp) console.error("🛑 Error al insertar oportunidad de mejora:", errOp)
    }

    for (const nc of noConformidades) {
      const { error: errNc } = await supabase.from('no_conformidades').insert({
        informe_id: informeId,
        iso_id: nc.iso ? parseInt(nc.iso) : null,
        capitulo_id: nc.capitulo ? parseInt(nc.capitulo) : null,
        numeral_id: nc.numeral ? parseInt(nc.numeral) : null,
        descripcion: nc.descripcion,
        evidencia: nc.evidencia
      })

      if (errNc) console.error("🛑 Error al insertar no conformidad:", errNc)
    }


    alert("✅ Informe y hallazgos guardados correctamente")

    setForm({ fecha_auditoria: '', proceso: '', asistencia_tipo: 'Digital', auditores_acompanantes: '', objetivo: '', criterios: '' })
    setFortalezas([])
    setNoConformidades([])
    setOportunidades([])

  }

  return (
    <div className="bg-white p-8 rounded-xl shadow-lg max-w-4xl mx-auto animate-fade-in">
      <h2 className="text-2xl font-bold mb-6 text-blue-500">Nuevo Informe de Auditoría</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="date" name="fecha_auditoria" value={form.fecha_auditoria} onChange={handleChange} required className={styles.inputEstilo} />
        <input type="text" name="proceso" placeholder="Proceso" value={form.proceso} onChange={handleChange} required className={styles.inputEstilo} />
        <select name="asistencia_tipo" value={form.asistencia_tipo} onChange={handleChange} className={styles.inputEstilo}>
          <option value="Digital">Digital</option>
          <option value="Físico">Físico</option>
        </select>
        <input type="text" name="auditores_acompanantes" placeholder="Auditores acompañantes (coma separados)" value={form.auditores_acompanantes} onChange={handleChange} className={styles.inputEstilo} />
        <textarea name="objetivo" placeholder="Objetivo de la auditoría" value={form.objetivo} onChange={handleChange} className={styles.inputEstilo} rows={3}></textarea>
        <textarea name="criterios" placeholder="Criterios de la auditoría" value={form.criterios} onChange={handleChange} className={styles.inputEstilo} rows={3}></textarea>

        {fortalezas.map((f, i) => (
          <div key={i} className={`${styles.subformulario} ${styles.fortalezaBg}`}>
            <button type="button" onClick={() => eliminarFortaleza(i)} className={styles.eliminarBoton}>✖</button>

            <select
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
              {listaIso.map((iso) => (
                <option key={iso.id} value={iso.id}>{iso.iso}</option>
              ))}
            </select>

            <select
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
              <option value="">Seleccionar capítulo</option>
              {(listaCapitulos[f.iso] || []).map((cap) => (
                <option key={cap.id} value={cap.id}>{cap.capitulo}</option>
              ))}
            </select>

            <select
              value={f.numeral}
              onChange={(e) => handleFortalezaChange(i, 'numeral', parseInt(e.target.value))}
              disabled={!f.capitulo}
              className={styles.inputCampo}
            >
              <option value="">Seleccionar numeral</option>
              {(listaNumerales[f.capitulo] || []).map((num) => (
                <option key={num.id} value={num.id}>{num.numeral}</option>
              ))}
            </select>

            <input type="text" placeholder="Descripción" value={f.descripcion} onChange={(e) => handleFortalezaChange(i, 'descripcion', e.target.value)} className={styles.inputCampo} />
            <input type="text" placeholder="Razón" value={f.razon} onChange={(e) => handleFortalezaChange(i, 'razon', e.target.value)} className={styles.inputCampo} />
          </div>
        ))}

        {oportunidades.map((o, i) => (
          <div key={i} className={`${styles.subformulario} ${styles.oportunidadBg}`}>
            <button type="button" onClick={() => eliminarOportunidad(i)} className={styles.eliminarBoton}>✖</button>

            {/* ISO */}
            <select
              value={o.iso || ''}
              onChange={async (e) => {
                const isoId = parseInt(e.target.value)
                handleOportunidadChange(i, 'iso', isoId)
                handleOportunidadChange(i, 'capitulo', '')
                handleOportunidadChange(i, 'numeral', '')
                await cargarCapitulos(isoId)
              }}
              className={styles.inputCampo}
            >
              <option value="">Selecciona ISO</option>
              {listaIso.map((iso) => (
                <option key={iso.id} value={iso.id}>ISO {iso.iso}</option>
              ))}
            </select>

            {/* Capítulo */}
            <select
              value={o.capitulo || ''}
              onChange={async (e) => {
                const capId = parseInt(e.target.value)
                handleOportunidadChange(i, 'capitulo', capId)
                handleOportunidadChange(i, 'numeral', '')
                await cargarNumerales(capId)
              }}
              disabled={!o.iso}
              className={styles.inputCampo}
            >
              <option value="">Selecciona Capítulo</option>
              {(listaCapitulos[o.iso] || []).map((c) => (
                <option key={c.id} value={c.id}>Capítulo {c.capitulo}</option>
              ))}
            </select>

            {/* Numeral */}
            <select
              value={o.numeral || ''}
              onChange={(e) => handleOportunidadChange(i, 'numeral', parseInt(e.target.value))}
              disabled={!o.capitulo}
              className={styles.inputCampo}
            >
              <option value="">Selecciona Numeral</option>
              {(listaNumerales[o.capitulo] || []).map((num) => (
                <option key={num.id} value={num.id}>{num.numeral}</option>
              ))}
            </select>

            <input type="text" placeholder="Descripción" value={o.descripcion} onChange={(e) => handleOportunidadChange(i, 'descripcion', e.target.value)} className={styles.inputCampo} />
            <input type="text" placeholder="¿Para qué?" value={o.para_que} onChange={(e) => handleOportunidadChange(i, 'para_que', e.target.value)} className={styles.inputCampo} />
          </div>
        ))}

        {/* No Conformidades */}
        {noConformidades.map((n, i) => (
          <div key={i} className={`${styles.subformulario} ${styles.noConformidadBg}`}>
            <button type="button" onClick={() => eliminarNoConformidad(i)} className={styles.eliminarBoton}>✖</button>

            <select
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
              <option value="">Selecciona ISO</option>
              {listaIso.map((iso) => (
                <option key={iso.id} value={iso.id}>ISO {iso.iso}</option>
              ))}
            </select>

            <select
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
              <option value="">Selecciona Capítulo</option>
              {(listaCapitulos[n.iso] || []).map((cap) => (
                <option key={cap.id} value={cap.id}>{cap.capitulo}</option>
              ))}
            </select>

            <select
              value={n.numeral}
              onChange={(e) => handleNoConformidadChange(i, 'numeral', parseInt(e.target.value))}
              disabled={!n.capitulo}
              className={styles.inputCampo}
            >
              <option value="">Selecciona Numeral</option>
              {(listaNumerales[n.capitulo] || []).map((num) => (
                <option key={num.id} value={num.id}>{num.numeral}</option>
              ))}
            </select>

            <input type="text" placeholder="Descripción" value={n.descripcion} onChange={(e) => handleNoConformidadChange(i, 'descripcion', e.target.value)} className={styles.inputCampo} />
            <input type="text" placeholder="Evidencia" value={n.evidencia} onChange={(e) => handleNoConformidadChange(i, 'evidencia', e.target.value)} className={styles.inputCampo} />
          </div>
        ))}


        <div className={styles.botones}>
          <button type="button" onClick={agregarFortaleza} className={`${styles.botonHallazgo} ${styles.verde}`}>➕ Fortaleza</button>
          <button type="button" onClick={agregarOportunidad} className={`${styles.botonHallazgo} ${styles.azul}`}>➕ Oportunidad de mejora</button>
          <button type="button" onClick={agregarNoConformidad} className={`${styles.botonHallazgo} ${styles.rojo}`}>➕ No Conformidad</button>

        </div>

        <button type="submit" className={styles.botonGuardar}>Guardar informe</button>
      </form>
    </div>
  )
}
