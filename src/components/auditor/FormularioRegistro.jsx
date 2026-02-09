'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'react-toastify'
import { supabase } from '@/lib/supabaseClient'
import styles from './formulario.module.css'
import { useRef } from 'react'

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
  const [errores, setErrores] = useState({})

  const fortalezaRef = useRef(null)
  const oportunidadRef = useRef(null)
  const noConformidadRef = useRef(null)

  const router = useRouter()


  const [ayudaOpen, setAyudaOpen] = useState(false)
  const [ayudaImagen, setAyudaImagen] = useState('')

  useEffect(() => {
    const cargarISO = async () => {
      const { data } = await supabase.from('iso').select('*')
      if (data) setListaIso(data)
    }
    cargarISO()
  }, [router])

  useEffect(() => { ajustarTextareas() }, [fortalezas])
  useEffect(() => { ajustarTextareas() }, [oportunidades])
  useEffect(() => { ajustarTextareas() }, [noConformidades])

  const ajustarTextareas = () => {
    const textareas = document.querySelectorAll(`.${styles.textareaAuto}`)
    textareas.forEach(textarea => {
      textarea.style.height = 'auto'
      textarea.style.height = `${textarea.scrollHeight}px`
      textarea.addEventListener('input', () => {
        textarea.style.height = 'auto'
        textarea.style.height = `${textarea.scrollHeight}px`
      })
    })
  }


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

// Campos que NO deben ir en mayúsculas (incluimos campos de texto para que funcione el corrector ortográfico)
const EXCLUDE_UPPERCASE = new Set([
 'auditores_acompanantes',
 'asistencia_tipo',
'fecha_auditoria',
'fecha_seguimiento',
'objetivo',
'criterios',
'conclusiones',
'recomendaciones'
])

const handleChange = (e) => {
  const { name, value } = e.target
  const shouldUppercase = typeof value === 'string' && !EXCLUDE_UPPERCASE.has(name)

  setForm(prev => ({
    ...prev,
    [name]: shouldUppercase ? value.toUpperCase() : value
  }))
}

// Convierte a mayúsculas cuando el usuario sale del campo (preserva corrector ortográfico mientras escribe)
const handleBlur = (e) => {
  const { name, value } = e.target
  if (typeof value === 'string' && value.trim()) {
    setForm(prev => ({
      ...prev,
      [name]: value.toUpperCase()
    }))
  }
}



const toUC = (v) => (typeof v === 'string' ? v.toUpperCase() : v)

const handleFortalezaChange = (index, field, value) => {
  setFortalezas(prev => {
    const copy = [...prev]
    // No convertir a mayúsculas los campos de texto para que funcione el corrector ortográfico
    const shouldConvert = !['descripcion', 'razon'].includes(field)
    copy[index] = { ...copy[index], [field]: shouldConvert ? toUC(value) : value }
    return copy
  })
}

const handleFortalezaBlur = (index, field, value) => {
  if (typeof value === 'string' && value.trim()) {
    setFortalezas(prev => {
      const copy = [...prev]
      copy[index] = { ...copy[index], [field]: value.toUpperCase() }
      return copy
    })
  }
}

const handleOportunidadChange = (index, field, value) => {
  setOportunidades(prev => {
    const copy = [...prev]
    // No convertir a mayúsculas los campos de texto para que funcione el corrector ortográfico
    const shouldConvert = !['descripcion', 'para_que'].includes(field)
    copy[index] = { ...copy[index], [field]: shouldConvert ? toUC(value) : value }
    return copy
  })
}

const handleOportunidadBlur = (index, field, value) => {
  if (typeof value === 'string' && value.trim()) {
    setOportunidades(prev => {
      const copy = [...prev]
      copy[index] = { ...copy[index], [field]: value.toUpperCase() }
      return copy
    })
  }
}

const handleNoConformidadChange = (index, field, value) => {
  setNoConformidades(prev => {
    const copy = [...prev]
    // No convertir a mayúsculas los campos de texto para que funcione el corrector ortográfico
    const shouldConvert = !['descripcion', 'evidencia'].includes(field)
    copy[index] = { ...copy[index], [field]: shouldConvert ? toUC(value) : value }
    return copy
  })
}

const handleNoConformidadBlur = (index, field, value) => {
  if (typeof value === 'string' && value.trim()) {
    setNoConformidades(prev => {
      const copy = [...prev]
      copy[index] = { ...copy[index], [field]: value.toUpperCase() }
      return copy
    })
  }
}



  const validarFormulario = () => {
    const nuevosErrores = {}

    if (!form.fecha_auditoria) nuevosErrores.fecha_auditoria = 'La fecha de auditoría es obligatoria.'
    if (!form.asistencia_tipo) nuevosErrores.asistencia_tipo = 'El tipo de asistencia es obligatorio.'
    if (!form.objetivo.trim()) nuevosErrores.objetivo = 'El objetivo es obligatorio.'
    if (!form.criterios.trim()) nuevosErrores.criterios = 'Los criterios son obligatorios.'
    if (!form.conclusiones.trim()) nuevosErrores.conclusiones = 'Las conclusiones son obligatorias.'
    if (!form.fecha_seguimiento) nuevosErrores.fecha_seguimiento = 'La fecha de seguimiento es obligatoria.'
    if (!form.recomendaciones.trim()) nuevosErrores.recomendaciones = 'Las recomendaciones son obligatorias.'

    setErrores(nuevosErrores)
    return Object.keys(nuevosErrores).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (loading) return

    if (!validarFormulario()) {
      toast.error('Por favor completa todos los campos obligatorios.')
      return
    }
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
    <div className={styles.fondo}>
      <h2 className={styles.tituloEstilo}>
        {auditoria ? (
          <>
            Llenar Informe de <strong>Auditoría</strong>
          </>
        ) : (
          <>
            Nuevo Informe de <strong>Auditoría</strong>
          </>
        )}
      </h2>

      {auditoria && (
        <div className={styles.tarjetaAuditoria}>
          <div className={styles.badgeAuditoria}>🧾 Auditoría #{auditoria.id}</div>
          <div className={styles.tarjetaContenido}>
            <div className={styles.tarjetaIzquierda}>
              🏢 {auditoria.dependencias?.nombre || 'Dependencia no encontrada'}
            </div>

            {/* Validación de la fecha */}
            {(() => {
              if (!auditoria.fecha_auditoria) return null;
              const year = new Date(auditoria.fecha_auditoria).getFullYear();
              return year !== 1969 ? (
                <div className={styles.tarjetaDerecha}>📅 {year}</div>
              ) : null;
            })()}
          </div>
        </div>
      )}


      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Campos del informe */}

        <div className={styles.contenedorFechas}>
          <div className={styles.tarjetaCampo}>
            <label className={styles.etiqueta} htmlFor="fecha_auditoria">📅 Fecha de la auditoría</label>
            <input
              type="date"
              id="fecha_auditoria"
              name="fecha_auditoria"
              value={form.fecha_auditoria}
              onChange={handleChange}
              className={styles.inputEstilo}
            />
            {errores.fecha_auditoria && <p className={styles.errorTexto}>{errores.fecha_auditoria}</p>}
          </div>

          <div className={styles.tarjetaCampo}>
            <label className={styles.etiqueta} htmlFor="fecha_seguimiento">🗓️ Fecha de seguimiento</label>
            <input
              type="date"
              id="fecha_seguimiento"
              name="fecha_seguimiento"
              value={form.fecha_seguimiento}
              onChange={handleChange}
              className={styles.inputEstilo}
            />
            <label className={styles.etiqueta} style={{fontSize: '0.85rem', fontStyle: 'italic'}}>
              En atención a la resolución 290 de 2019 de la Universidad del Cauca.
            </label>
            {errores.fecha_seguimiento && <p className={styles.errorTexto}>{errores.fecha_seguimiento}</p>}
          </div>
        </div>


        <div className={styles.contenedorFechas}>
          <div className={styles.tarjetaCampo}>
            <label className={styles.etiqueta} htmlFor="asistencia_tipo">📍 Asistencia</label>
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
            {errores.asistencia_tipo && <p className={styles.errorTexto}>{errores.asistencia_tipo}</p>}
          </div>
          <div className={styles.tarjetaCampo}>
            <label className={styles.etiqueta} htmlFor="auditores_acompanantes">👥 Auditores acompañantes (separados por ,)</label>
            <input
              type="text"
              id="auditores_acompanantes"
              name="auditores_acompanantes"
              value={form.auditores_acompanantes}
              onChange={handleChange}
              className={styles.inputEstilo}
            />
            {errores.auditores_acompanantes && <p className={styles.errorTexto}>{errores.auditores_acompanantes}</p>}
          </div>
        </div>

        <div className={styles.tarjetaCampo}>
          <label className={styles.etiqueta} htmlFor="objetivo">📋 Objetivo de la auditoría <span style={{fontSize: '0.75rem', opacity: 0.7}}>✓ Corrector ortográfico activo</span></label>
          <textarea
            id="objetivo"
            name="objetivo"
            value={form.objetivo}
            onChange={handleChange}
            onBlur={handleBlur}
            className={`${styles.inputEstilo} ${styles.textareaAuto}`}
            rows={1}
            spellCheck="true"
            lang="es-ES"
            autoComplete="off"
          />
          {errores.objetivo && <p className={styles.errorTexto}>{errores.objetivo}</p>}
        </div>

        <div className={styles.tarjetaCampo}>
          <label className={styles.etiqueta} htmlFor="criterios">📊 Criterios de la auditoría <span style={{fontSize: '0.75rem', opacity: 0.7}}>✓ Corrector ortográfico activo</span></label>
          <textarea
            id="criterios"
            name="criterios"
            value={form.criterios}
            onChange={handleChange}
            onBlur={handleBlur}
            className={`${styles.inputEstilo} ${styles.textareaAuto}`}
            rows={1}
            spellCheck="true"
            lang="es-ES"
            autoComplete="off"
          />
          {errores.criterios && <p className={styles.errorTexto}>{errores.criterios}</p>}
        </div>

        <div className={styles.tarjetaCampo}>
          <label className={styles.etiqueta} htmlFor="conclusiones">✅ Conclusiones <span style={{fontSize: '0.75rem', opacity: 0.7}}>✓ Corrector ortográfico activo</span></label>
          
          {/* Botón de ayuda */}
          <button
            type="button"
            onClick={() => {
              setAyudaImagen('ayudas/AyudaFortalezas.png')
              setAyudaOpen(true)
            }}
            className={`${styles.botonAyuda} ml-10 border-blue-400 text-blue-600`}
            title="Ver ayuda"
          >
            ?
          </button>

          <textarea
            id="conclusiones"
            name="conclusiones"
            value={form.conclusiones}
            onChange={handleChange}
            onBlur={handleBlur}
            className={`${styles.inputEstilo} ${styles.textareaAuto}`}
            rows={1}
            spellCheck="true"
            lang="es-ES"
            autoComplete="off"
          />
          {errores.conclusiones && <p className={styles.errorTexto}>{errores.conclusiones}</p>}
        </div>

        <div className={styles.tarjetaCampo}>
          <label className={styles.etiqueta} htmlFor="recomendaciones">💡 Recomendaciones <span style={{fontSize: '0.75rem', opacity: 0.7}}>✓ Corrector ortográfico activo</span></label>
          
          {/* Botón de ayuda */}
          <button
            type="button"
            onClick={() => {
              setAyudaImagen('ayudas/AyudaFortalezas.png')
              setAyudaOpen(true)
            }}
            className={`${styles.botonAyuda} ml-10 border-blue-400 text-blue-600`}
            title="Ver ayuda"
          >
            ?
          </button>

          <textarea
            id="recomendaciones"
            name="recomendaciones"
            value={form.recomendaciones}
            onChange={handleChange}
            onBlur={handleBlur}
            className={`${styles.inputEstilo} ${styles.textareaAuto}`}
            rows={1}
            spellCheck="true"
            lang="es-ES"
            autoComplete="off"
          />
          {errores.recomendaciones && <p className={styles.errorTexto}>{errores.recomendaciones}</p>}
        </div>



        {/* Subformulario de fortalezas */}
        {fortalezas.map((f, i) => (
          <div
            key={i}
            ref={i === fortalezas.length - 1 ? fortalezaRef : null}
            className={`${styles.subformulario} ${styles.fortalezaBg} relative`}
          >
            {/* Título de Fortaleza */}
            <div className={styles.subtituloFormulario}>💪 Fortaleza #{i + 1}</div>
            <div className={styles.descripcion}>Describir las fortalezas (buenas prácticas identificadas), para ser replicadas en la institución (citar si las hay)</div>
            {/* Botón de eliminar */}
            <button
              type="button"
              onClick={() => setFortalezas(prev => prev.filter((_, j) => j !== i))}
              className={styles.botonEliminar}
              title="Eliminar fortaleza"
            >
              ✖
            </button>

            {/* Botón de ayuda */}
            <button
              type="button"
              onClick={() => {
                setAyudaImagen('ayudas/AyudaFortalezas.png') // cambia la ruta a tu imagen
                setAyudaOpen(true)
              }}
              className={`${styles.botonAyuda} ml-10 border-blue-400 text-blue-600`}
              title="Ver ayuda"
            >
              ?
            </button>

            {/* ISO, Capítulo y Numeral en una sola fila */}
            <div className={styles.grupoFila}>
              <div className={styles.campoAgrupado}>
                <label className={styles.etiqueta} htmlFor={`iso-${i}`}>📜 ISO</label>
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
              </div>

              <div className={styles.campoAgrupado}>
                <label className={styles.etiqueta} htmlFor={`capitulo-${i}`}>📖 Capítulo</label>
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
              </div>

              <div className={styles.campoAgrupado}>
                <label className={styles.etiqueta} htmlFor={`numeral-${i}`}>🔢 Numeral</label>
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
              </div>
            </div>

            {/* Descripción */}
            <label className={styles.etiqueta} htmlFor={`descripcion-${i}`}>📝 Descripción</label>
            <textarea
              id={`descripcion-${i}`}
              value={f.descripcion}
              onChange={(e) => handleFortalezaChange(i, 'descripcion', e.target.value)}
              onBlur={(e) => handleFortalezaBlur(i, 'descripcion', e.target.value)}
              className={`${styles.textareaAdaptable} ${styles.textareaAuto}`}
              rows={1}
              spellCheck="true"
              lang="es-ES"
              autoComplete="off"
            />

            {/* Razón */}
            <label className={styles.etiqueta} htmlFor={`razon-${i}`}>🔍 Razón</label>

            <textarea
              id={`razon-${i}`}
              value={f.razon}
              onChange={(e) => handleFortalezaChange(i, 'razon', e.target.value)}
              onBlur={(e) => handleFortalezaBlur(i, 'razon', e.target.value)}
              className={`${styles.textareaAdaptable} ${styles.textareaAuto}`}
              rows={1}
              spellCheck="true"
              lang="es-ES"
              autoComplete="off"
            />
          </div>
        ))}

        {/* Subformulario de Oportunidades */}
        {oportunidades.map((o, i) => (
          <div
            key={i}
            ref={i === oportunidades.length - 1 ? oportunidadRef : null}
            className={`${styles.subformulario} ${styles.oportunidadBg} relative`}
          >
            {/* Título de Oportunidad */}
            <div className={styles.subtituloFormulario}>📈 Oportunidad #{i + 1}</div>
            <div className={styles.descripcion}>Describir los requisitos susceptibles de mejora priorizados, que sean posibles de ejecutar, con respecto a los criterios de auditoría y la lista de chequeo (tenga en cuenta que el número no exceda de 4)</div>

            {/* Botón para eliminar */}
            <button
              type="button"
              onClick={() => setOportunidades(prev => prev.filter((_, j) => j !== i))}
              className={styles.botonEliminar}
              title="Eliminar oportunidad"
            >
              ✖
            </button>

            {/* Botón de ayuda */}
            <button
              type="button"
              onClick={() => {
                setAyudaImagen('ayudas/AyudaOportunidad.png') // cambia la ruta a tu imagen
                setAyudaOpen(true)
              }}
              className={`${styles.botonAyuda} ml-10 border-blue-400 text-blue-600`}
              title="Ver ayuda"
            >
              ?
            </button>


            {/* ISO, Capítulo y Numeral en una sola fila */}
            <div className={styles.grupoFila}>
              <div className={styles.campoAgrupado}>
                <label className={styles.etiqueta} htmlFor={`oportunidad-iso-${i}`}>📜 ISO</label>
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
              </div>

              <div className={styles.campoAgrupado}>
                <label className={styles.etiqueta} htmlFor={`oportunidad-capitulo-${i}`}>📖 Capítulo</label>
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
              </div>

              <div className={styles.campoAgrupado}>
                <label className={styles.etiqueta} htmlFor={`oportunidad-numeral-${i}`}>🔢 Numeral</label>
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
              </div>
            </div>

            {/* Descripción */}
            <label className={styles.etiqueta} htmlFor={`oportunidad-descripcion-${i}`}>📝 Descripción</label>
            <textarea
              id={`oportunidad-descripcion-${i}`}
              value={o.descripcion}
              onChange={(e) => handleOportunidadChange(i, 'descripcion', e.target.value)}
              onBlur={(e) => handleOportunidadBlur(i, 'descripcion', e.target.value)}
              className={`${styles.textareaAdaptable} ${styles.textareaAuto}`}
              rows={2}
              spellCheck="true"
              lang="es-ES"
              autoComplete="off"
            />

            {/* ¿Para qué? */}
            <label className={styles.etiqueta} htmlFor={`oportunidad-para-que-${i}`}>❓ ¿Para qué?</label>
            <textarea
              id={`oportunidad-para-que-${i}`}
              value={o.para_que}
              onChange={(e) => handleOportunidadChange(i, 'para_que', e.target.value)}
              onBlur={(e) => handleOportunidadBlur(i, 'para_que', e.target.value)}
              className={`${styles.textareaAdaptable} ${styles.textareaAuto}`}
              rows={2}
              spellCheck="true"
              lang="es-ES"
              autoComplete="off"
            />
          </div>
        ))}
        {noConformidades.map((n, i) => (
          <div
            key={i}
            ref={i === noConformidades.length - 1 ? noConformidadRef : null}
            className={`${styles.subformulario} ${styles.noConformidadBg} relative`}
          >
            {/* Título de No Conformidad */}
            <div className={styles.subtituloFormulario}>🚫 No Conformidad #{i + 1}</div>
            <div className={styles.descripcion}>Incumplimiento de requisitos (No Conformidades) que demandan Acciones Correctivas</div>

            {/* Botón para eliminar */}
            <button
              type="button"
              onClick={() => setNoConformidades(prev => prev.filter((_, j) => j !== i))}
              className={styles.botonEliminar}
              title="Eliminar no conformidad"
            >
              ✖
            </button>

            {/* Botón de ayuda */}
            <button
              type="button"
              onClick={() => {
                setAyudaImagen('ayudas/AyudaNoConformidad.png') // cambia la ruta a tu imagen
                setAyudaOpen(true)
              }}
              className={`${styles.botonAyuda} ml-10 border-blue-400 text-blue-600`}
              title="Ver ayuda"
            >
              ?
            </button>


            {/* ISO, Capítulo y Numeral en una sola fila */}
            <div className={styles.grupoFila}>
              <div className={styles.campoAgrupado}>
                <label className={styles.etiqueta} htmlFor={`noConformidad-iso-${i}`}>📜 ISO</label>
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
              </div>

              <div className={styles.campoAgrupado}>
                <label className={styles.etiqueta} htmlFor={`noConformidad-capitulo-${i}`}>📖 Capítulo</label>
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
              </div>

              <div className={styles.campoAgrupado}>
                <label className={styles.etiqueta} htmlFor={`noConformidad-numeral-${i}`}>🔢 Numeral</label>
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
              </div>
            </div>

            {/* Descripción */}
            <label className={styles.etiqueta} htmlFor={`noConformidad-descripcion-${i}`}>📝 Descripción</label>
            <textarea
              id={`noConformidad-descripcion-${i}`}
              value={n.descripcion}
              onChange={(e) => handleNoConformidadChange(i, 'descripcion', e.target.value)}
              onBlur={(e) => handleNoConformidadBlur(i, 'descripcion', e.target.value)}
              className={`${styles.textareaAdaptable} ${styles.textareaAuto}`}
              rows={2}
              spellCheck="true"
              lang="es-ES"
              autoComplete="off"
            />

            {/* Evidencia */}
            <label className={styles.etiqueta} htmlFor={`noConformidad-evidencia-${i}`}>🔎 Evidencia</label>
            <textarea
              id={`noConformidad-evidencia-${i}`}
              value={n.evidencia}
              onChange={(e) => handleNoConformidadChange(i, 'evidencia', e.target.value)}
              onBlur={(e) => handleNoConformidadBlur(i, 'evidencia', e.target.value)}
              className={`${styles.textareaAdaptable} ${styles.textareaAuto}`}
              rows={2}
              spellCheck="true"
              lang="es-ES"
              autoComplete="off"
            />
          </div>
        ))}




        <div className={styles.botonesHallazgoGrupo}>
          <button
            type="button"
            onClick={() => {
              setFortalezas([...fortalezas, { iso: '', capitulo: '', numeral: '', descripcion: '', razon: '' }])
              setTimeout(() => {
                if (fortalezaRef.current) {
                  const offsetTop = fortalezaRef.current.getBoundingClientRect().top + window.pageYOffset
                  window.scrollTo({ top: offsetTop - 200, behavior: 'smooth' })
                }
              }, 100)
            }}
            className={`${styles.botonHallazgo} ${styles.verde}`}
          >
            <span className={styles.botonIcono}>+</span>
            Fortalezas
          </button>

          <button
            type="button"
            onClick={() => {
              setOportunidades([...oportunidades, { iso: '', capitulo: '', numeral: '', descripcion: '', para_que: '' }])
              setTimeout(() => {
                if (oportunidadRef.current) {
                  const offsetTop = oportunidadRef.current.getBoundingClientRect().top + window.pageYOffset
                  window.scrollTo({ top: offsetTop - 200, behavior: 'smooth' })
                }
              }, 100)
            }}
            className={`${styles.botonHallazgo} ${styles.azul}`}
          >
            <span className={styles.botonIcono}>+</span>
            Oportunidades de Mejora
          </button>


          <button
            type="button"
            onClick={() => {
              setNoConformidades([...noConformidades, { iso: '', capitulo: '', numeral: '', descripcion: '', evidencia: '' }])
              setTimeout(() => {
                if (noConformidadRef.current) {
                  const offsetTop = noConformidadRef.current.getBoundingClientRect().top + window.pageYOffset
                  window.scrollTo({ top: offsetTop - 200, behavior: 'smooth' })
                }
              }, 100)
            }}
            className={`${styles.botonHallazgo} ${styles.rojo}`}
          >
            <span className={styles.botonIcono}> + </span>
            No Conformidades
          </button>

        </div>

        <button
          type="submit"
          className={styles.botonGuardar}
          disabled={loading}
        >
          {loading ? 'Guardando...' : (auditoria ? 'Actualizar informe' : 'Guardar informe')}
        </button>

      </form>

      {
        ayudaOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-lg p-4 max-w-3xl relative">
              {/* Botón cerrar */}
              <button
                onClick={() => setAyudaOpen(false)}
                className="absolute top-2 right-2 text-red-600 font-bold text-xl"
                title="Cerrar"
              >
                ✖
              </button>

              {/* Imagen de ayuda */}
              <img
                src={ayudaImagen}
                alt="Ayuda para llenar no conformidad"
                className="max-h-[80vh] object-contain"
              />
            </div>
          </div>
        )
      }

    </div>

  )
}
