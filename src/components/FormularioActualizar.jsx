'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import styles from './CSS/formulario.module.css'
import ModalEditar from './ModalEditar'

export default function FormularioActualizar({ usuario }) {
  const [informes, setInformes] = useState([])
  const [informeSeleccionado, setInformeSeleccionado] = useState(null)
  const [fortalezas, setFortalezas] = useState([])
  const [oportunidades, setOportunidades] = useState([])
  const [noConformidades, setNoConformidades] = useState([])

  const [listaIso, setListaIso] = useState([])
  const [listaCapitulos, setListaCapitulos] = useState({})
  const [listaNumerales, setListaNumerales] = useState({})

  const usuarioId = usuario?.usuario_id

  useEffect(() => {
    const fetchData = async () => {
      const { data: isos } = await supabase.from('iso').select('*')
      setListaIso(isos || [])

      const { data: caps } = await supabase.from('capitulos').select('*')
      const agrupadosCapitulos = caps.reduce((acc, c) => {
        if (!acc[c.iso_id]) acc[c.iso_id] = []
        acc[c.iso_id].push(c)
        return acc
      }, {})
      setListaCapitulos(agrupadosCapitulos)

      const { data: nums } = await supabase.from('numerales').select('*')
      const agrupadosNumerales = nums.reduce((acc, n) => {
        if (!acc[n.capitulo_id]) acc[n.capitulo_id] = []
        acc[n.capitulo_id].push(n)
        return acc
      }, {})
      setListaNumerales(agrupadosNumerales)
    }
    fetchData()
  }, [])

  useEffect(() => {
    const fetchInformes = async () => {
      if (!usuarioId) return
      const { data, error } = await supabase
        .from('informes_auditoria')
        .select('*')
        .eq('usuario_id', usuarioId)
        .order('fecha_auditoria', { ascending: false })

      if (!error) setInformes(data)
    }
    fetchInformes()
  }, [usuarioId])

  const seleccionarParaEditar = async (inf) => {
    setInformeSeleccionado(inf)
    const [f, o, n] = await Promise.all([
      supabase.from('fortalezas').select('*').eq('informe_id', inf.id),
      supabase.from('oportunidades_mejora').select('*').eq('informe_id', inf.id),
      supabase.from('no_conformidades').select('*').eq('informe_id', inf.id)
    ])
    setFortalezas(f.data || [])
    setOportunidades(o.data || [])
    setNoConformidades(n.data || [])
  }

  const transformarFortaleza = (f) => ({
    informe_id: informeSeleccionado.id,
    iso_id: f.iso ? parseInt(f.iso) : null,
    capitulo_id: f.capitulo ? parseInt(f.capitulo) : null,
    numeral_id: f.numeral ? parseInt(f.numeral) : null,
    descripcion: f.descripcion || '',
    razon: f.razon || ''
  })

  const transformarOportunidad = (o) => ({
    informe_id: informeSeleccionado.id,
    iso_id: o.iso ? parseInt(o.iso) : null,
    capitulo_id: o.capitulo ? parseInt(o.capitulo) : null,
    numeral_id: o.numeral ? parseInt(o.numeral) : null,
    descripcion: o.descripcion || '',
    para_que: o.para_que || ''
  })

  const transformarNoConformidad = (n) => ({
    informe_id: informeSeleccionado.id,
    iso_id: n.iso ? parseInt(n.iso) : null,
    capitulo_id: n.capitulo ? parseInt(n.capitulo) : null,
    numeral_id: n.numeral ? parseInt(n.numeral) : null,
    descripcion: n.descripcion || '',
    tipo: n.tipo || '',
    evidencia: n.evidencia || '',
    norma: n.norma || ''
  })

  const handleActualizar = async (e) => {
    e.preventDefault()
    await supabase.from('informes_auditoria')
      .update(informeSeleccionado)
      .eq('id', informeSeleccionado.id)

    await supabase.from('fortalezas').delete().eq('informe_id', informeSeleccionado.id)
    await supabase.from('oportunidades_mejora').delete().eq('informe_id', informeSeleccionado.id)
    await supabase.from('no_conformidades').delete().eq('informe_id', informeSeleccionado.id)

    for (const f of fortalezas)
      await supabase.from('fortalezas').insert(transformarFortaleza(f))

    for (const o of oportunidades)
      await supabase.from('oportunidades_mejora').insert(transformarOportunidad(o))

    for (const n of noConformidades)
      await supabase.from('no_conformidades').insert(transformarNoConformidad(n))

    alert("✅ Informe actualizado correctamente")
    setInformeSeleccionado(null)
  }

  const renderSelectDinamico = (i, lista, campo, valor, onChange, campoTexto) => (
    <select
      value={valor || ''}
      onChange={(e) => onChange(i, campo, parseInt(e.target.value))}
      className={styles.inputCampo}
    >
      <option value="">Seleccionar</option>
      {lista.map(op => (
        <option key={op.id} value={op.id}>{op[campoTexto]}</option>
      ))}
    </select>
  )

  const renderSubformularios = (lista, setLista, tipo) => lista.map((item, i) => (
    <div key={i} className={styles.subformulario}>
      <button onClick={() => setLista(prev => prev.filter((_, j) => j !== i))} className={styles.eliminarBoton}>✖</button>
      {renderSelectDinamico(i, listaIso, 'iso', item.iso, (i, f, v) => handleChangeItem(setLista, i, f, v), 'iso')}
      {renderSelectDinamico(i, listaCapitulos[item.iso] || [], 'capitulo', item.capitulo, (i, f, v) => handleChangeItem(setLista, i, f, v), 'capitulo')}
      {renderSelectDinamico(i, listaNumerales[item.capitulo] || [], 'numeral', item.numeral, (i, f, v) => handleChangeItem(setLista, i, f, v), 'numeral')}

      <input type="text" value={item.descripcion || ''} onChange={(e) => handleChangeItem(setLista, i, 'descripcion', e.target.value)} placeholder="Descripción" className={styles.inputCampo} />
      {tipo === 'fortaleza' && (
        <input type="text" value={item.razon || ''} onChange={(e) => handleChangeItem(setLista, i, 'razon', e.target.value)} placeholder="Razón" className={styles.inputCampo} />
      )}
      {tipo === 'oportunidad' && (
        <input type="text" value={item.para_que || ''} onChange={(e) => handleChangeItem(setLista, i, 'para_que', e.target.value)} placeholder="¿Para qué?" className={styles.inputCampo} />
      )}
      {tipo === 'no_conformidad' && (
        <>
          <input type="text" value={item.tipo || ''} onChange={(e) => handleChangeItem(setLista, i, 'tipo', e.target.value)} placeholder="Tipo" className={styles.inputCampo} />
          <input type="text" value={item.evidencia || ''} onChange={(e) => handleChangeItem(setLista, i, 'evidencia', e.target.value)} placeholder="Evidencia" className={styles.inputCampo} />
          <input type="text" value={item.norma || ''} onChange={(e) => handleChangeItem(setLista, i, 'norma', e.target.value)} placeholder="Norma" className={styles.inputCampo} />
        </>
      )}
    </div>
  ))

  const handleChangeItem = (setter, index, field, value) => {
    setter(prev => {
      const copia = [...prev]
      copia[index] = { ...copia[index], [field]: value }
      return copia
    })
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-4 text-blue-700">Informes registrados</h2>

      <ul className="space-y-4">
        {informes.map((inf) => (
          <li key={inf.id} className="p-4 border rounded shadow-sm bg-white flex justify-between items-center">
            <div>
              <p><strong>Fecha:</strong> {inf.fecha_auditoria}</p>
              <p><strong>Proceso:</strong> {inf.proceso}</p>
            </div>
            <button onClick={() => seleccionarParaEditar(inf)} className="bg-yellow-500 px-4 py-1 rounded hover:bg-yellow-600">Editar</button>
          </li>
        ))}
      </ul>

      <ModalEditar visible={!!informeSeleccionado} onClose={() => setInformeSeleccionado(null)}>
        {informeSeleccionado && (
          <form onSubmit={handleActualizar} className="space-y-4">
            <h3 className="text-xl font-bold text-blue-600">Editar Informe</h3>
            <input type="date" value={informeSeleccionado.fecha_auditoria} onChange={(e) => setInformeSeleccionado({ ...informeSeleccionado, fecha_auditoria: e.target.value })} className={styles.inputEstilo} />
            <input type="text" value={informeSeleccionado.proceso} onChange={(e) => setInformeSeleccionado({ ...informeSeleccionado, proceso: e.target.value })} className={styles.inputEstilo} />
            <textarea value={informeSeleccionado.objetivo || ''} onChange={(e) => setInformeSeleccionado({ ...informeSeleccionado, objetivo: e.target.value })} placeholder="Objetivo" className={styles.inputEstilo} rows={3} />
            <textarea value={informeSeleccionado.criterios || ''} onChange={(e) => setInformeSeleccionado({ ...informeSeleccionado, criterios: e.target.value })} placeholder="Criterios" className={styles.inputEstilo} rows={3} />

            <h4 className="text-lg font-semibold mt-6 text-green-600">Fortalezas</h4>
            {renderSubformularios(fortalezas, setFortalezas, 'fortaleza')}
            <button type="button" onClick={() => setFortalezas(prev => [...prev, {}])} className={`${styles.botonHallazgo} ${styles.verde}`}>➕ Fortaleza</button>

            <h4 className="text-lg font-semibold mt-6 text-blue-600">Oportunidades de Mejora</h4>
            {renderSubformularios(oportunidades, setOportunidades, 'oportunidad')}
            <button type="button" onClick={() => setOportunidades(prev => [...prev, {}])} className={`${styles.botonHallazgo} ${styles.azul}`}>➕ Oportunidad</button>

            <h4 className="text-lg font-semibold mt-6 text-red-600">No Conformidades</h4>
            {renderSubformularios(noConformidades, setNoConformidades, 'no_conformidad')}
            <button type="button" onClick={() => setNoConformidades(prev => [...prev, {}])} className={`${styles.botonHallazgo} ${styles.rojo}`}>➕ No Conformidad</button>

            <button type="submit" className={styles.botonGuardar}>Guardar cambios</button>
          </form>
        )}
      </ModalEditar>
    </div>
  )
}
