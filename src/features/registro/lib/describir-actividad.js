/**
 * Cada asiento del registro, en una frase que se entienda.
 *
 * La base guarda lo estructurado —`tipo`, `accion`, `entidad`, `campos`— y la
 * frase se arma aquí, no en SQL. Así se puede reescribir el texto sin una
 * migración, y se puede probar: el acierto de una vista de auditoría se juega
 * entero en que «modificar / informes_auditoria / [conclusiones]» se lea como
 * «cambió las conclusiones del informe #352».
 */

/** Cómo se nombra cada tabla y cada bucket, con su artículo. */
const ENTIDADES = {
  // Tablas
  informes_auditoria: { singular: 'el informe de auditoría', grupo: 'Informes' },
  fortalezas: { singular: 'una fortaleza', grupo: 'Hallazgos' },
  oportunidades_mejora: { singular: 'una oportunidad de mejora', grupo: 'Hallazgos' },
  no_conformidades: { singular: 'una no conformidad', grupo: 'Hallazgos' },
  usuarios: { singular: 'un usuario', grupo: 'Administración' },
  dependencias: { singular: 'una dependencia', grupo: 'Administración' },
  programas_auditoria: { singular: 'el programa de auditoría', grupo: 'Programa' },
  programa_auditoria_cronograma: { singular: 'el cronograma del programa', grupo: 'Programa' },
  programa_auditoria_cronograma_dependencias: {
    singular: 'una dependencia del cronograma',
    grupo: 'Programa',
  },
  programa_auditoria_distribucion: { singular: 'la distribución del programa', grupo: 'Programa' },
  planes_auditoria_informe: { singular: 'el envío del plan de auditoría', grupo: 'Documentos' },
  plan_auditoria: { singular: 'el plan de auditoría de la dependencia', grupo: 'Documentos' },
  validaciones_auditoria: { singular: 'la validación del informe', grupo: 'Documentos' },
  evaluaciones_auditores: { singular: 'la evaluación de un auditor', grupo: 'Evaluación' },
  evaluaciones_pesos: { singular: 'los pesos de la evaluación', grupo: 'Evaluación' },
  rubricas_evaluacion: { singular: 'una rúbrica de evaluación', grupo: 'Evaluación' },
  encuestas_auditores: { singular: 'una encuesta de auditor', grupo: 'Evaluación' },
  notas_etapa_auditoria: { singular: 'una nota de etapa', grupo: 'Informes' },
  alertas_historial: { singular: 'una alerta enviada', grupo: 'Alertas' },
  alertas_procesos_config: { singular: 'la configuración de alertas', grupo: 'Alertas' },

  // Buckets de Storage
  actas: { singular: 'un acta de reunión', grupo: 'Documentos' },
  actascompromiso: { singular: 'una carta de compromiso', grupo: 'Documentos' },
  planes: { singular: 'un plan de auditoría', grupo: 'Documentos' },
  asistencias: { singular: 'un listado de asistencia', grupo: 'Documentos' },
  evaluaciones: { singular: 'una evaluación', grupo: 'Documentos' },
  validaciones: { singular: 'un informe validado', grupo: 'Documentos' },
  planesdemejora: { singular: 'un plan de mejoramiento', grupo: 'Documentos' },
  encuestas: { singular: 'una encuesta', grupo: 'Documentos' },

  sesion: { singular: 'el sistema', grupo: 'Accesos' },
}

/** El verbo, ya conjugado en pasado. */
const VERBOS = {
  crear: 'creó',
  modificar: 'modificó',
  eliminar: 'eliminó',
  subir: 'subió',
  reemplazar: 'reemplazó',
}

/**
 * Los asientos de sesión se escriben enteros, no como «verbo + el sistema».
 *
 * Armarlos por piezas daba «entró a el sistema». Y los de cuenta —alta, baja,
 * cambio— los hace casi siempre el panel de administración con service-role,
 * así que la frase tiene que leerse bien con «El sistema» como sujeto y
 * también con una persona: «creó una cuenta de usuario» sirve para los dos,
 * «se registró en el sistema» no.
 */
const FRASES_SESION = {
  entrar: 'entró al sistema',
  salir: 'salió del sistema',
  user_signedup: 'creó una cuenta de usuario',
  user_deleted: 'eliminó una cuenta de usuario',
  user_modified: 'modificó una cuenta de usuario',
  user_invited: 'invitó a un usuario nuevo',
  user_recovery_requested: 'pidió recuperar su contraseña',
  user_updated_password: 'cambió su contraseña',
}

/** Nombres de columna como los llama la gente, no como los llama la tabla. */
const CAMPOS = {
  objetivo: 'Objetivo',
  criterios: 'Criterios',
  conclusiones: 'Conclusiones',
  recomendaciones: 'Recomendaciones',
  descripcion: 'Descripción',
  razon: 'Razón',
  para_que: '¿Para qué?',
  evidencia: 'Evidencia',
  fecha_auditoria: 'Fecha de auditoría',
  fecha_seguimiento: 'Fecha de seguimiento',
  asistencia_tipo: 'Tipo de asistencia',
  auditores_acompanantes: 'Auditores acompañantes',
  validado: 'Validado',
  ejecutada: 'Ejecutada',
  ejecutada_at: 'Fecha de ejecución',
  iso_id: 'Norma',
  capitulo_id: 'Capítulo',
  numeral_id: 'Numeral',
  usuario_id: 'Auditor',
  dependencia_id: 'Dependencia',
  programa_auditoria_id: 'Programa',
  rol: 'Rol',
  estado: 'Estado',
  tipo_personal: 'Tipo de personal',
  tipo_estudio: 'Tipo de estudio',
  nombre: 'Nombre',
  apellido: 'Apellido',
  email: 'Correo',
  celular: 'Celular',
  estudios: 'Estudios',
  nota_final: 'Nota final',
  observaciones: 'Observaciones',
}

/** El color con el que se lee de un vistazo. Eliminar siempre destaca. */
const TONOS = {
  crear: 'emerald',
  subir: 'sky',
  reemplazar: 'amber',
  modificar: 'amber',
  eliminar: 'rose',
  entrar: 'slate',
  salir: 'slate',
  // Las altas y bajas de cuentas se miran con otros ojos que un acceso
  // normal, así que no se quedan en el gris de las sesiones.
  user_signedup: 'emerald',
  user_deleted: 'rose',
  user_modified: 'amber',
  user_invited: 'sky',
  user_updated_password: 'amber',
  user_recovery_requested: 'amber',
}

export const etiquetaEntidad = (entidad) =>
  ENTIDADES[entidad]?.singular ?? `«${entidad}»`

export const grupoEntidad = (entidad) => ENTIDADES[entidad]?.grupo ?? 'Otros'

export const etiquetaCampo = (campo) =>
  CAMPOS[campo] ?? String(campo ?? '').replace(/_/g, ' ')

/** Los grupos que existen, para armar el filtro sin escribirlos dos veces. */
export const GRUPOS = [...new Set(Object.values(ENTIDADES).map((e) => e.grupo))].sort()

/** Las entidades de un grupo, para que el filtro pase la lista al servidor. */
export const entidadesDelGrupo = (grupo) =>
  Object.entries(ENTIDADES)
    .filter(([, e]) => e.grupo === grupo)
    .map(([clave]) => clave)

/** Quién lo hizo, con el nombre congelado del asiento. */
export function describirActor(fila) {
  if (fila?.actor_nombre) return fila.actor_nombre

  const email = fila?.contexto?.email

  // `service_role` no es una persona: es la clave de servidor con la que el
  // panel de administración da de alta y de baja las cuentas. Supabase Auth lo
  // anota como «actor», y enseñarlo tal cual en la columna «Quién» invita a
  // buscar a un usuario que no existe.
  if (email && email !== 'service_role') return email
  if (email === 'service_role' || fila?.origen === 'servidor') return 'El sistema'

  return 'Desconocido'
}

/** «3 campos» no dice nada; «Conclusiones y Recomendaciones» sí. */
export function describirCampos(campos, maximo = 3) {
  const lista = (campos ?? []).map(etiquetaCampo)
  if (!lista.length) return ''
  if (lista.length === 1) return lista[0]

  const visibles = lista.slice(0, maximo)
  const resto = lista.length - visibles.length

  if (resto > 0) return `${visibles.join(', ')} y ${resto} más`
  return `${visibles.slice(0, -1).join(', ')} y ${visibles.at(-1)}`
}

/**
 * La frase completa de un asiento.
 *
 * @returns {{actor: string, frase: string, detalle: string, tono: string, grupo: string}}
 */
export function describirActividad(fila) {
  const actor = describirActor(fila)
  const verbo = VERBOS[fila?.accion] ?? String(fila?.accion ?? 'tocó')
  const entidad = etiquetaEntidad(fila?.entidad)
  const tono = TONOS[fila?.accion] ?? 'slate'
  const grupo = fila?.tipo === 'sesion' ? 'Accesos' : grupoEntidad(fila?.entidad)

  if (fila?.tipo === 'sesion') {
    const frase = FRASES_SESION[fila?.accion] ?? `hizo «${fila?.accion}» en el sistema`
    return { actor, frase, detalle: fila?.ip ?? '', tono, grupo }
  }

  if (fila?.tipo === 'archivo') {
    const nombre = fila?.datos_despues?.nombre ?? fila?.registro_id ?? ''
    return {
      actor,
      frase: `${verbo} ${entidad}`,
      detalle: nombre,
      tono,
      grupo,
    }
  }

  // Cambios en tablas. El «#352» sale del contexto cuando el registro
  // pertenece a un informe, que es la pregunta que se hace siempre: ¿de qué
  // auditoría era este hallazgo?
  const deInforme = fila?.contexto?.informe_id
    ? ` del informe #${fila.contexto.informe_id}`
    : ''

  const propio =
    fila?.entidad === 'informes_auditoria' && fila?.registro_id ? ` #${fila.registro_id}` : ''

  const campos =
    fila?.accion === 'modificar' ? describirCampos(fila?.campos) : ''

  return {
    actor,
    frase: campos
      ? `cambió ${campos} en ${entidad}${propio || deInforme}`
      : `${verbo} ${entidad}${propio || deInforme}`,
    detalle: resumenValores(fila),
    tono,
    grupo,
  }
}

/** Para un campo suelto, el antes y el después, recortados. */
function resumenValores(fila) {
  if (fila?.accion !== 'modificar') return ''
  if ((fila?.campos ?? []).length !== 1) return ''

  const campo = fila.campos[0]
  const antes = recortar(fila?.datos_antes?.[campo])
  const despues = recortar(fila?.datos_despues?.[campo])
  if (!antes && !despues) return ''

  return `${antes || '(vacío)'} → ${despues || '(vacío)'}`
}

const LARGO_MAXIMO = 60

/** Un valor cualquiera, en una línea y sin desbordar la tabla. */
export function recortar(valor, maximo = LARGO_MAXIMO) {
  if (valor === null || valor === undefined) return ''
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No'

  const texto =
    typeof valor === 'object' ? JSON.stringify(valor) : String(valor).replace(/\s+/g, ' ').trim()

  if (texto.length <= maximo) return texto
  return `${texto.slice(0, maximo - 1)}…`
}
