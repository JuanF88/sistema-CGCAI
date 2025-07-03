import { createReport } from 'docx-templates'

export async function generarInformeAuditoriaDocx(
  auditoria,
  fortalezas = [],
  oportunidades = [],
  noConformidades = [],
  usuario
) {
  const response = await fetch('/plantillas/Informe-General-Auditoria-PLANTILLA-CORREGIDA.docx') // Usa aquí la plantilla actual
  const templateArrayBuffer = await response.arrayBuffer()

  const datos = {
    fecha: auditoria.fecha_auditoria || '',
    dependencia: auditoria.dependencias?.nombre || 'N/A',
    tipo_proceso: auditoria.asistencia_tipo || 'N/A',
    auditor: usuario?.nombre || 'N/A',
    responsable: usuario?.nombre || 'N/A',
    auditor_acompanante: (auditoria.auditores_acompanantes || []).join(', '),
    objetivo: auditoria.objetivo || '',
    criterios: auditoria.criterios || '',
    conclusiones: auditoria.conclusiones || '',
    recomendaciones: auditoria.recomendaciones || '',
    nombre: (usuario?.nombre || '') + ' ' + (usuario?.apellido || ''),

    fortalezas: fortalezas.map(f => ({
      iso_id: f.iso?.iso || '',
      capitulo: f.capitulo?.capitulo || '',
      numeral: f.numeral?.numeral || '',
      descripcion: f.descripcion || '',
      razon: f.razon || ''
    })),

    oportunidades: oportunidades.map(o => ({
      iso_id: o.iso?.iso || '',
      capitulo: o.capitulo?.capitulo || '',
      numeral: o.numeral?.numeral || '',
      descripcion: o.descripcion || '',
      para_que: o.para_que || ''
    })),

    noConformidades: noConformidades.map(nc => ({
      iso_id: nc.iso?.iso || '',
      capitulo: nc.capitulo?.capitulo || '',
      numeral: nc.numeral?.numeral || '',
      descripcion: nc.descripcion || '',
      evidencia: nc.evidencia || ''
    }))


  }


  const buffer = await createReport({
    template: templateArrayBuffer,
    data: datos,
    cmdDelimiter: ['+++', '+++'],
    processLineBreaks: true, // opcional pero recomendable para saltos de línea
    noSandbox: true // si estás en navegador, esto puede ser necesario
  })

  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  })

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `Informe_Auditoria_${auditoria.id}.docx`
  a.click()
}
