import { NextResponse } from 'next/server'
import { readFirstSheetAsObjects } from '@/lib/excel/readSheet'
import { requireRole } from '@/lib/api/guard'
import { ROLES } from '@/lib/auth/roles'

// POST /api/evaluaciones-auditores/importar-encuestas
// Importa encuestas desde archivo Excel exportado de Google Forms
export async function POST(request) {
  const guard = await requireRole(ROLES.ADMIN)
  if (!guard.ok) return guard.response

  const supabaseAdmin = guard.admin

  try {
    const formData = await request.formData()
    const file = formData.get('archivo')
    const anio = parseInt(formData.get('anio'))
    const semestre = formData.get('semestre')

    if (!file) {
      return NextResponse.json({ error: 'No se envió archivo' }, { status: 400 })
    }

    if (!anio || !semestre) {
      return NextResponse.json({ error: 'Año y semestre son obligatorios' }, { status: 400 })
    }

    const periodo = `${anio}-${semestre}`

    // Solo .xlsx: ExcelJS no lee el formato antiguo .xls (BIFF).
    if (/\.xls$/i.test(file.name || '')) {
      return NextResponse.json(
        {
          error:
            'El formato .xls no está soportado. Abre el archivo en Excel y guárdalo como .xlsx.',
        },
        { status: 400 }
      )
    }

    // Leer el archivo Excel
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    let rows
    try {
      rows = await readFirstSheetAsObjects(buffer)
    } catch (excelError) {
      return NextResponse.json(
        {
          error: 'Error al procesar archivo Excel',
          detalles: excelError.message,
        },
        { status: 400 }
      )
    }

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'El archivo está vacío' }, { status: 400 })
    }

    // DEBUG: Mostrar nombres de columnas del Excel
    console.log('📊 COLUMNAS DETECTADAS EN EL EXCEL:')
    const primeraFila = rows[0]
    const columnasExcel = Object.keys(primeraFila)
    columnasExcel.forEach((col, idx) => {
      console.log(`  ${idx + 1}. "${col}"`)
    })
    console.log('---')

    // Obtener todos los auditores para matching
    const { data: auditores } = await supabaseAdmin
      .from('usuarios')
      .select('auth_user_id, nombre, apellido')
      .eq('rol', 'auditor')

    // Obtener todas las dependencias para matching
    const { data: dependencias } = await supabaseAdmin
      .from('dependencias')
      .select('id, nombre')

    const resultados = {
      importados: 0,
      actualizados: 0,
      nuevos: 0,
      errores: [],
      detalles: []
    }

    // Función para normalizar texto (quitar tildes, mayúsculas, espacios extras)
    const normalizarTexto = (texto) => {
      if (!texto) return ''
      return texto
        .toString()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Quitar tildes
        .replace(/\s+/g, ' ') // Múltiples espacios a uno
        .trim()
    }

    // Respuestas textuales del formulario → escala 1-5 (0 = no aplica).
    //
    // El formulario usa «Deficiente», que no estaba en la lista. Como antes
    // toda respuesta desconocida valía 0, un «Deficiente» contaba como «No
    // aplica»: la encuesta se rechazaba por tener pocas respuestas o, peor, se
    // importaba sin esa nota baja. Ahora lo desconocido devuelve `null` y se
    // informa como error de la fila.
    const RESPUESTAS = {
      'excelente': 5,
      'bueno': 4,
      'aceptable': 3,
      'deficiente': 2,
      'malo': 2,
      'muy deficiente': 1,
      'muy malo': 1,
      'no aplica': 0,
      'n/a': 0,
      'na': 0
    }

    // Para la coincidencia parcial («Bueno (4)», «Muy malo.»): primero las
    // claves largas, para que «muy deficiente» no se quede en «deficiente», y
    // sin las de menos de cuatro letras («na» está dentro de «buena»).
    const CLAVES_PARCIALES = Object.keys(RESPUESTAS)
      .filter((clave) => clave.length >= 4)
      .sort((a, b) => b.length - a.length)

    const convertirRespuestaANumero = (respuesta) => {
      const texto = normalizarTexto(respuesta)
      if (!texto) return 0

      if (RESPUESTAS[texto] !== undefined) return RESPUESTAS[texto]

      const clave = CLAVES_PARCIALES.find((c) => texto.includes(c))
      if (clave) return RESPUESTAS[clave]

      // Número directo
      const num = Number(texto)
      if (Number.isInteger(num) && num >= 0 && num <= 5) return num

      return null
    }

    // Función de matching fuzzy mejorado
    const encontrarAuditor = (nombreBuscado, listaAuditores) => {
      const nombreNormalizado = normalizarTexto(nombreBuscado)
      
      // Buscar coincidencia exacta normalizada
      let auditor = listaAuditores.find(a => {
        const nombreCompleto = normalizarTexto(`${a.nombre} ${a.apellido}`)
        return nombreCompleto === nombreNormalizado
      })
      
      if (auditor) return auditor
      
      // Buscar por coincidencia parcial
      auditor = listaAuditores.find(a => {
        const nombreCompleto = normalizarTexto(`${a.nombre} ${a.apellido}`)
        const apellidoNombre = normalizarTexto(`${a.apellido} ${a.nombre}`)
        
        return nombreCompleto.includes(nombreNormalizado) || 
               nombreNormalizado.includes(nombreCompleto) ||
               apellidoNombre.includes(nombreNormalizado) ||
               nombreNormalizado.includes(apellidoNombre)
      })
      
      if (auditor) return auditor
      
      // Buscar por similitud de palabras
      const palabrasBuscadas = nombreNormalizado.split(' ').filter(p => p.length > 2)
      return listaAuditores.find(a => {
        const nombreCompleto = normalizarTexto(`${a.nombre} ${a.apellido}`)
        const palabrasAuditor = nombreCompleto.split(' ')
        
        // Si coinciden al menos 2 palabras significativas
        const coincidencias = palabrasBuscadas.filter(pb => 
          palabrasAuditor.some(pa => pa.includes(pb) || pb.includes(pa))
        )
        
        return coincidencias.length >= Math.min(2, palabrasBuscadas.length)
      })
    }

    // Función de matching para dependencias
    const encontrarDependencia = (nombreBuscado, listaDependencias) => {
      if (!nombreBuscado || !listaDependencias) return null
      
      const nombreNormalizado = normalizarTexto(nombreBuscado)
      
      // Buscar coincidencia exacta normalizada
      let dependencia = listaDependencias.find(d => {
        const nombreDep = normalizarTexto(d.nombre)
        return nombreDep === nombreNormalizado
      })
      
      if (dependencia) return dependencia
      
      // Buscar por coincidencia parcial (contiene o está contenido)
      dependencia = listaDependencias.find(d => {
        const nombreDep = normalizarTexto(d.nombre)
        return nombreDep.includes(nombreNormalizado) || 
               nombreNormalizado.includes(nombreDep)
      })
      
      if (dependencia) return dependencia
      
      // Buscar por palabras clave (si coinciden al menos 2 palabras)
      const palabrasBuscadas = nombreNormalizado.split(' ').filter(p => p.length > 3)
      if (palabrasBuscadas.length === 0) return null
      
      return listaDependencias.find(d => {
        const nombreDep = normalizarTexto(d.nombre)
        const palabrasDep = nombreDep.split(' ')
        
        const coincidencias = palabrasBuscadas.filter(pb => 
          palabrasDep.some(pd => pd.includes(pb) || pb.includes(pd))
        )
        
        return coincidencias.length >= Math.min(2, palabrasBuscadas.length)
      })
    }

    // Parecido entre la dependencia que escribe el evaluado y la de una
    // evaluación. El formulario es texto libre: llegan tildes de menos
    // («Area»), versiones cortas («Turismo» por «TURISMO PREGRADO») y erratas
    // («Salud Untegral»). 0 = no se parecen; cuanto más alto, más seguro.
    const PALABRAS_VACIAS = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y', 'en'])
    const palabrasDe = (texto) =>
      normalizarTexto(texto)
        .replace(/[^a-z0-9ñ ]/g, ' ')
        .split(' ')
        .filter((p) => p.length > 2 && !PALABRAS_VACIAS.has(p))

    const parecidoDependencia = (a, b) => {
      const na = normalizarTexto(a)
      const nb = normalizarTexto(b)
      if (!na || !nb) return 0
      if (na === nb) return 4
      if (na.includes(nb) || nb.includes(na)) return 3

      // Palabras en común: dos como mínimo y al menos el 60 % de las del
      // nombre más corto. Una sola («gestión») no basta.
      const pa = new Set(palabrasDe(a))
      const pb = new Set(palabrasDe(b))
      const comunes = [...pa].filter((p) => pb.has(p)).length
      const proporcion = comunes / Math.min(pa.size, pb.size)
      return comunes >= 2 && proporcion >= 0.6 ? 1 + proporcion : 0
    }

    /** La evaluación (de las del auditor en el periodo) que mejor encaja, o null. */
    const evaluacionDeDependencia = (dependencia, evaluaciones) => {
      let mejor = null
      let puntaje = 0
      for (const ev of evaluaciones ?? []) {
        const p = parecidoDependencia(dependencia, ev.dependencia_auditada)
        if (p > puntaje) {
          mejor = ev
          puntaje = p
        }
      }
      return mejor
    }

    // Mapeo de columnas según estructura real del Excel
    // Columnas clave:
    // - "Marca temporal"
    // - "Auditor/a a evaluar" (nombre del auditor, puede no estar normalizado)
    // - "Nombre y Apellido" (evaluador)
    // - "Cargo" (del evaluador)
    // - Preguntas 1-10
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      
      try {
        // Extraer datos con nombres de columnas reales
        const auditorNombre = (row['Auditor/a a evaluar'] || row['Auditora a evaluar'] || row['Auditor a evaluar'])?.toString().trim()
        const evaluadorNombre = (row['Nombre y Apellido'] || row['Nombre del evaluador'])?.toString().trim()
        const evaluadorCargo = (row['Cargo'] || row['Cargo del evaluador'])?.toString().trim()
        
        // Marca temporal: puede venir como número serial de Excel o texto
        const marcaTemporalRaw = row['Marca temporal']
        let fechaRespuesta = null
        let anioEncuesta = anio // Default del formulario
        let semestreEncuesta = semestre // Default del formulario
        let periodoEncuesta = periodo // Default del formulario
        
        if (marcaTemporalRaw) {
          try {
            let fecha = null

            // ExcelJS devuelve las celdas con formato de fecha ya como Date.
            // (SheetJS las entregaba como número serial y había que convertirlas
            // a mano, camino que se conserva abajo por si el Excel trae el valor
            // como número crudo.)
            if (marcaTemporalRaw instanceof Date) {
              fecha = marcaTemporalRaw

            // Verificar si es un número serial de Excel
            } else if (typeof marcaTemporalRaw === 'number' || !isNaN(parseFloat(marcaTemporalRaw))) {
              // Convertir número serial de Excel a fecha
              // Excel cuenta días desde 1900-01-01 (con bug: considera 1900 bisiesto)
              const serialNumber = parseFloat(marcaTemporalRaw)
              const excelEpoch = new Date(1900, 0, 1) // 1 de enero de 1900
              const daysOffset = serialNumber - 2 // -2 por el bug de Excel (considera 1900 bisiesto)
              const millisecondsPerDay = 24 * 60 * 60 * 1000
              
              fecha = new Date(excelEpoch.getTime() + daysOffset * millisecondsPerDay)
              console.log(`DEBUG Fila ${i + 2}: Serial Excel ${serialNumber} → ${fecha.toISOString()}`)
              
            } else {
              // Es texto en formato "11/5/2025 9:17:09"
              const marcaStr = marcaTemporalRaw.toString().trim()
              const [fechaParte, horaParte] = marcaStr.split(' ')
              const [mes, dia, anioStr] = fechaParte.split('/')
              
              if (anioStr && mes && dia) {
                let horaFormateada = '00:00:00'
                if (horaParte) {
                  const partesHora = horaParte.split(':')
                  const horas = partesHora[0]?.padStart(2, '0') || '00'
                  const minutos = partesHora[1]?.padStart(2, '0') || '00'
                  const segundos = partesHora[2]?.padStart(2, '0') || '00'
                  horaFormateada = `${horas}:${minutos}:${segundos}`
                }
                
                const mesFormateado = mes.padStart(2, '0')
                const diaFormateado = dia.padStart(2, '0')
                const fechaISO = `${anioStr}-${mesFormateado}-${diaFormateado}T${horaFormateada}`
                fecha = new Date(fechaISO)
              }
            }
            
            if (fecha && !isNaN(fecha.getTime())) {
              // Al segundo: el formulario no guarda milisegundos, pero leer el
              // Excel puede dejar restos (08:40:28.352). Con ellos, la misma
              // respuesta parecía otra y se insertaba repetida.
              fecha = new Date(Math.round(fecha.getTime() / 1000) * 1000)
              fechaRespuesta = fecha.toISOString()
              
              // Calcular año y semestre desde la fecha de respuesta
              anioEncuesta = fecha.getFullYear()
              const mesNum = fecha.getMonth() + 1 // 1-12
              semestreEncuesta = mesNum <= 6 ? 'S1' : 'S2'
              periodoEncuesta = `${anioEncuesta}-${semestreEncuesta}`
              
              console.log(`✓ Fila ${i + 2}: ${periodoEncuesta}`)
            } else {
              console.log(`⚠ Fecha inválida en fila ${i + 2}`)
            }
          } catch (err) {
            console.log(`⚠ Error parseando fecha en fila ${i + 2}:`, err.message)
          }
        } else {
          console.log(`⚠ Marca temporal vacía en fila ${i + 2}`)
        }

        // Dependencia que recibe la auditoría (columna específica)
        const dependenciaAuditadaNombre = row['Dependencia que recibe la auditoría']?.toString().trim() || ''
        
        // Buscar dependencia con matching fuzzy
        const dependenciaEncontrada = encontrarDependencia(dependenciaAuditadaNombre, dependencias)
        
        if (dependenciaAuditadaNombre && !dependenciaEncontrada) {
          console.log(`⚠ Dependencia no encontrada en BD: "${dependenciaAuditadaNombre}"`)
        }

        if (!auditorNombre) {
          resultados.errores.push(`Fila ${i + 2}: Falta nombre del auditor (columna vacía)`)
          continue
        }

        // Buscar auditor con matching fuzzy mejorado
        const auditor = encontrarAuditor(auditorNombre, auditores)

        // Si no se encuentra el auditor, permitir importar con auditor_id = null (auditorías antiguas)
        if (!auditor) {
          console.log(`⚠ Auditor no encontrado en BD: "${auditorNombre}" - Se guardará solo el nombre`)
        }

        // Extraer respuestas a las 10 preguntas
        // Buscar columnas que contengan texto específico (orden de prioridad)
        const noReconocidas = []
        const obtenerRespuesta = (posiblesNombres) => {
          for (const nombre of posiblesNombres) {
            const valor = row[nombre]
            if (valor !== undefined && valor !== null && valor !== '') {
              const numero = convertirRespuestaANumero(valor)
              if (numero === null) {
                noReconocidas.push(`P${nombre.split('.')[0]}: «${valor}»`)
                return 0
              }
              return numero
            }
          }
          return 0
        }

        // Mapeo basado en las columnas reales del Excel
        const pregunta_1 = obtenerRespuesta(['1. Se notificó el plan de auditoría, se socializó en la reunión de apertura indicando objetivo, alcance, criterios, orden, secuencia y además, de ser necesario se concertó el manejo de cambios en la ejecución del plan'])
        const pregunta_2 = obtenerRespuesta(['2. Se maneja lenguaje claro, formula preguntas de fácil comprensión y responde las inquietudes presentadas'])
        const pregunta_3 = obtenerRespuesta(['3. Solicita evidencia objetiva y pertinente para la verificación de requisitos'])
        const pregunta_4 = obtenerRespuesta(['4. Explica con argumentos de la norma los hallazgos de la auditoría'])
        const pregunta_5 = obtenerRespuesta(['5. El/la auditor/a aportó al mejoramiento del proceso, retroalimentando fortalezas y oportunidades de mejora y motivando sobre aspectos para la formulación de acciones de mejora'])
        const pregunta_6 = obtenerRespuesta(['6. Hay claridad en la explicación de los hallazgos (Fortalezas, Oportunidades de Mejora, No Conformidades) que fueron resultado de la auditoría y se sustenta con propiedad y seguridad.'])
        const pregunta_7 = obtenerRespuesta(['7. Tuvo un manejo adecuado de situaciones divergentes o conflictivas'])
        const pregunta_8 = obtenerRespuesta(['8. Se logró una concertación de los hallazgos encontrados en la reunión de cierre '])
        const pregunta_9 = obtenerRespuesta(['9. El auditor propició un ambiente de cordialidad, respeto, empatía y actitud de mejora'])
        const pregunta_10 = obtenerRespuesta(['10. Se evidenció una adecuada coordinación por parte del equipo de auditores durante la visita'])

        if (noReconocidas.length > 0) {
          resultados.errores.push(
            `Fila ${i + 2}: respuestas que no se reconocen (${noReconocidas.join(', ')}). Válidas: Excelente, Bueno, Aceptable, Deficiente, Muy deficiente, No aplica.`
          )
          continue
        }

        // Validar que todas las respuestas estén en rango 0-5 (0 = no aplica)
        const preguntas = [pregunta_1, pregunta_2, pregunta_3, pregunta_4, pregunta_5, 
                           pregunta_6, pregunta_7, pregunta_8, pregunta_9, pregunta_10]
        const invalidas = preguntas.filter(p => p < 0 || p > 5)
        
        if (invalidas.length > 0) {
          resultados.errores.push(`Fila ${i + 2}: Respuestas fuera de rango (0-5): ${invalidas.join(', ')}`)
          continue
        }

        // Respuestas con calificación (lo demás es «No aplica» o vacío).
        //
        // Desde 2026 «No aplica» no cuenta en la nota (ver
        // `sql/encuestas-no-aplica.sql`), así que basta con una pregunta
        // calificada. Hasta 2025 la nota dividía siempre entre 10 y cada «No
        // aplica» restaba; por eso se exigían 7 y así se queda para esos años.
        const respuestasValidas = preguntas.filter(p => p > 0)
        const minimoRespuestas = anioEncuesta >= 2026 ? 1 : 7
        if (respuestasValidas.length < minimoRespuestas) {
          resultados.errores.push(
            minimoRespuestas === 1
              ? `Fila ${i + 2}: todas las preguntas están en «No aplica» o vacías; no hay nada que calificar`
              : `Fila ${i + 2}: Solo ${respuestasValidas.length} respuestas válidas (mínimo 7 requeridas)`
          )
          continue
        }

        // UPSERT: Buscar si ya existe esta encuesta (evitar duplicados)
        // Criterio de unicidad: auditor_nombre + fecha_respuesta + evaluador_nombre
        //
        // La hora se compara con un segundo de margen, no exacta: las encuestas
        // cargadas antes guardaban milisegundos y, comparando exacto, el cargue
        // siguiente no las reconocía y las duplicaba. Tampoco `maybeSingle()`:
        // con dos filas daba error, se tomaba como «no existe» y se insertaba
        // una tercera.
        let encuesta = null
        let esActualizacion = false

        if (fechaRespuesta && auditorNombre && evaluadorNombre) {
          const instante = new Date(fechaRespuesta).getTime()
          const { data: coincidencias, error: buscarError } = await supabaseAdmin
            .from('encuestas_auditores')
            .select('*')
            .eq('auditor_nombre', auditorNombre)
            .eq('evaluador_nombre', evaluadorNombre)
            .gte('fecha_respuesta', new Date(instante - 1000).toISOString())
            .lte('fecha_respuesta', new Date(instante + 1000).toISOString())
            .order('created_at', { ascending: true })

          if (buscarError) {
            resultados.errores.push(`Fila ${i + 2}: no se pudo comprobar si ya estaba cargada - ${buscarError.message}`)
            continue
          }

          if (coincidencias?.length > 1) {
            resultados.errores.push(
              `Fila ${i + 2}: la encuesta está ${coincidencias.length} veces en la base; se actualizó la primera. Conviene borrar las copias.`
            )
          }

          const existente = coincidencias?.[0]

          if (existente) {
            // YA EXISTE: Actualizar respuestas
            const { data: actualizada, error: updateError } = await supabaseAdmin
              .from('encuestas_auditores')
              .update({
                auditor_id: auditor ? auditor.auth_user_id : existente.auditor_id,
                evaluador_cargo: evaluadorCargo || existente.evaluador_cargo,
                dependencia_auditada: dependenciaAuditadaNombre || existente.dependencia_auditada,
                dependencia_id: dependenciaEncontrada ? dependenciaEncontrada.dependencia_id : existente.dependencia_id,
                periodo: periodoEncuesta,
                anio: anioEncuesta,
                semestre: semestreEncuesta,
                pregunta_1,
                pregunta_2,
                pregunta_3,
                pregunta_4,
                pregunta_5,
                pregunta_6,
                pregunta_7,
                pregunta_8,
                pregunta_9,
                pregunta_10,
                updated_at: new Date().toISOString()
              })
              .eq('id', existente.id)
              .select()
              .single()

            if (updateError) {
              resultados.errores.push(`Fila ${i + 2}: Error al actualizar - ${updateError.message}`)
              continue
            }
            
            encuesta = actualizada
            esActualizacion = true
            console.log(`🔄 Actualizada encuesta existente (ID: ${existente.id})`)
          }
        }

        // NO EXISTE: Insertar nueva encuesta
        if (!encuesta) {
          const { data: nueva, error: insertError } = await supabaseAdmin
            .from('encuestas_auditores')
            .insert({
              auditor_id: auditor ? auditor.auth_user_id : null,
              auditor_nombre: auditorNombre,
              evaluador_nombre: evaluadorNombre,
              evaluador_cargo: evaluadorCargo,
              dependencia_auditada: dependenciaAuditadaNombre,
              dependencia_id: dependenciaEncontrada ? dependenciaEncontrada.dependencia_id : null,
              fecha_respuesta: fechaRespuesta,
              periodo: periodoEncuesta,
              anio: anioEncuesta,
              semestre: semestreEncuesta,
              pregunta_1,
              pregunta_2,
              pregunta_3,
              pregunta_4,
              pregunta_5,
              pregunta_6,
              pregunta_7,
              pregunta_8,
              pregunta_9,
              pregunta_10
            })
            .select()
            .single()

          if (insertError) {
            resultados.errores.push(`Fila ${i + 2}: ${insertError.message}`)
            continue
          }
          
          encuesta = nueva
          console.log(`➕ Nueva encuesta creada (ID: ${nueva.id})`)
        }

        // Solo actualizar evaluación si el auditor existe en la BD
        if (auditor && dependenciaAuditadaNombre) {
          // Evaluación del auditor en ese periodo a la que corresponde la
          // dependencia que escribió el evaluado (texto libre del formulario).
          const { data: todasEvaluaciones } = await supabaseAdmin
            .from('evaluaciones_auditores')
            .select('id, dependencia_auditada')
            .eq('auditor_id', auditor.auth_user_id)
            .eq('periodo', periodoEncuesta)

          const evaluacion = evaluacionDeDependencia(dependenciaAuditadaNombre, todasEvaluaciones)

          if (!evaluacion) {
            console.log(`⚠ No se encontró evaluación para auditor ${auditorNombre}, periodo ${periodoEncuesta}, dependencia "${dependenciaAuditadaNombre}"`)
          }

          // Si encontramos la evaluación, calcular promedio y actualizar
          if (evaluacion) {
            const { data: todasEncuestas } = await supabaseAdmin
              .from('encuestas_auditores')
              .select('id, nota_calculada, dependencia_auditada')
              .eq('auditor_id', auditor.auth_user_id)
              .eq('periodo', periodoEncuesta)

            // Cuentan las encuestas que, con la misma regla, caen en ESTA
            // evaluación. Antes el promedio usaba otra comparación más laxa
            // que la de arriba, y una encuesta podía sumar en una evaluación
            // y no en otra según cuál se recalculara.
            const encuestasFiltradas = (todasEncuestas || []).filter(
              (enc) =>
                enc.nota_calculada !== null &&
                evaluacionDeDependencia(enc.dependencia_auditada, todasEvaluaciones)?.id === evaluacion.id
            )

            let notaPromedioEncuestas = null
            if (encuestasFiltradas && encuestasFiltradas.length > 0) {
              const suma = encuestasFiltradas.reduce((sum, e) => sum + Number(e.nota_calculada), 0)
              notaPromedioEncuestas = suma / encuestasFiltradas.length
            }

            if (notaPromedioEncuestas !== null) {
              // Actualizar evaluación existente con el promedio recalculado
              const { error: updateError } = await supabaseAdmin
                .from('evaluaciones_auditores')
                .update({ 
                  nota_encuesta: notaPromedioEncuestas,
                  num_encuestas_recibidas: encuestasFiltradas.length,
                  updated_at: new Date().toISOString()
                })
                .eq('id', evaluacion.id)

              if (updateError) {
                console.error(`✗ Error actualizando evaluación ${evaluacion.id}:`, updateError)
              } else {
                console.log(`✓ Evaluación ${evaluacion.id} actualizada: nota_encuesta = ${notaPromedioEncuestas.toFixed(2)}, num_encuestas = ${encuestasFiltradas.length}`)
              }

              // Recalcular nota final
              await supabaseAdmin.rpc('calcular_nota_final', { evaluacion_id: evaluacion.id })
            }
          }
        } // Cierre del if (auditor && dependenciaAuditadaNombre)

        resultados.importados++
        if (esActualizacion) {
          resultados.actualizados++
        } else {
          resultados.nuevos++
        }
        
        resultados.detalles.push({
          fila: i + 2,
          auditor: auditorNombre,
          nota: encuesta.nota_calculada,
          accion: esActualizacion ? 'actualizado' : 'nuevo'
        })

      } catch (rowError) {
        resultados.errores.push(`Fila ${i + 2}: ${rowError.message}`)
      }
    }

    return NextResponse.json({
      success: true,
      ...resultados
    })

  } catch (err) {
    console.error('Error en importar encuestas:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
