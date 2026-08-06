/**
 * Constantes del formato «Programa de Auditorías Internas»
 * (PE-GS-2.2.1-FOR-7, v11).
 *
 * Los textos largos vienen tal cual del Excel institucional y se usan como
 * valores por defecto al crear un programa: son los mismos año tras año y
 * reescribirlos a mano es donde se cuelan las erratas. Todos son editables.
 */
import { PROCESOS_CRONOGRAMA } from '@/lib/catalogos/procesos'

export const CODIGO_FORMATO = 'PE-GS-2.2.1-FOR-7'
export const VERSION_FORMATO = '11'

export const TITULO_FORMATO =
  'Direccionamiento Estratégico\nGestión de la Calidad\nPrograma de Auditorías Internas'

export const MESES = [
  'ENERO',
  'FEBRERO',
  'MARZO',
  'ABRIL',
  'MAYO',
  'JUNIO',
  'JULIO',
  'AGOSTO',
  'SEPTIEMBRE',
  'OCTUBRE',
  'NOVIEMBRE',
  'DICIEMBRE',
]

export const OBJETIVO_POR_DEFECTO = `*Verificar la conformidad del sistema de gestión de calidad frente a los requisitos de la NTC ISO9001:2015 identificando fortalezas, oportunidades de mejora y capacidades institucionales que favorezcan su sostenibilidad y evolución frente a retos futuros de la Universidad

* Evaluar el cumplimiento y la efectividad de las acciones establecidas en los planes de mejoramiento institucionales, verificando el cierre oportuno de los compromisos adquiridos y su contribución al fortalecimiento, sostenibilidad y mejora continua del Sistema de Gestión de Calidad.

* Evaluar el grado de integración de la gestión ambiental en los procesos institucionales mediante la identificación de controles operacionales, mecanismos de articulación entre la academia y la administración y capacidades institucionales para la implementación del Sistema de Gestión Ambiental.`

export const ALCANCE_POR_DEFECTO =
  'La auditoría se realizará en la sede Popayán, se enfocará en la revisión y aplicación de los requisitos de la NTC ISO9001:2015 así como el avance y cierre de los planes de mejora en los procesos institucionales.'

/**
 * En el Excel los criterios están repartidos en dos celdas por pura
 * maquetación —dos columnas de la misma lista—. Aquí van en un solo campo; la
 * exportación los vuelve a partir en dos al escribir la hoja.
 */
export const CRITERIOS_POR_DEFECTO = ` - Proyecto Educativo Institucional (PEI).
 - Plan de Desarrollo Institucional vigente.
 - Políticas institucionales aplicables.
 - NTC ISO 9001:2015
 - NTC ISO 14001:2015
 - Caracterizaciones de Procesos
 - Documentación del Sistema Integrado de Gestión de Calidad
 - Documentación del Sistema de Gestión Ambiental
 - Lineamientos de acreditación
 - Proyecto Educativo de Programa
 - Resultado de Auditorias previas (Internas - ICONTEC)
 - Mapa de Riesgos
 - Planes de mejoramiento
 - Perfil de auditor (Docente - Administrativo)
 - Identificación de fortalezas institucionales.
 - Buenas prácticas de gestión.
 - Capacidades organizacionales relacionadas con liderazgo, gestión del conocimiento, gestión del cambio y mejora continua.
 - Elementos que puedan servir como línea base para la futura transición a la nueva versión de la norma ISO 9001.`

export const METODOLOGIA_POR_DEFECTO = `La auditoría se realizará mediante:

Entrevista
Revisión documental
Observación directa
Muestreo de registros
Trazabilidad de procesos
Verificación de eficacia de acciones`

export const RECURSO_HUMANO_POR_DEFECTO = `Auditores
Gestores de Calidad
Líderes de procesos
Auditados`

export const RECURSO_FINANCIERO_POR_DEFECTO =
  'Gastos de Personal aprobados por la dirección Universitaria'

export const RECURSO_TECNOLOGICO_POR_DEFECTO = 'Software en Plataforma Desarrollada'

/**
 * Riesgos, controles y oportunidades.
 *
 * El Excel trae exactamente dos de cada uno —el de calidad y el ambiental—
 * porque la cuadrícula solo tiene dos filas. Aquí son listas abiertas: se
 * añaden los que hagan falta y la exportación crea tantas filas como el más
 * largo de los tres.
 */
export const RIESGOS_POR_DEFECTO = [
  'Obtención insuficiente de evidencia objetiva y representativa que limite la evaluación de la conformidad, eficacia y capacidad de mejora del Sistema de Gestión de Calidad.',
  'Identificación insuficiente o inconsistente de los controles operacionales asociados a los aspectos ambientales significativos de los procesos institucionales, limitando la implementación y seguimiento del Sistema de Gestión Ambiental.',
]

export const CONTROLES_POR_DEFECTO = [
  'Definir una muestra de auditoría basada en criterios de priorización institucional, estandarizar los instrumentos de auditoría, capacitar a los auditores y realizar seguimiento al cumplimiento y calidad de las auditorías ejecutadas.',
  'Aplicación de una lista de chequeo estandarizada que permita identificar de manera homogénea los aspectos ambientales, controles operacionales existentes, necesidades documentales y oportunidades de mejora en todos los procesos auditados.',
]

export const OPORTUNIDADES_POR_DEFECTO = [
  'Generar información institucional sobre el estado de implementación, apropiación y fortalecimiento del Sistema de Gestión de Calidad que facilite la planificación de la transición hacia la futura versión de la norma ISO 9001 y la gestión de cambios institucionales.',
  'Generar una línea base institucional sobre el nivel de integración ambiental de los procesos, que sirva como insumo para fortalecer el requisito 8 Operación, formalizar mecanismos de articulación entre la academia y la administración e incorporar la gestión ambiental en el próximo ciclo de planificación institucional.',
]

export const NOMENCLATURA_POR_DEFECTO =
  'AL: Auditor Líder - AA: Auditor Acompañante (Responsabilidades Anexo 1 del PE-GS-2.2.1-PR-5 Procedimiento Auditoría Interna V11)'

/** Cabecera vacía de un programa nuevo, ya con los textos del formato. */
export const PROGRAMA_INICIAL = {
  anio: new Date().getFullYear(),
  nombre: '',
  estado: 'borrador',
  objetivo: OBJETIVO_POR_DEFECTO,
  alcance: ALCANCE_POR_DEFECTO,
  criterios: CRITERIOS_POR_DEFECTO,
  metodologia: METODOLOGIA_POR_DEFECTO,
  recurso_humano: RECURSO_HUMANO_POR_DEFECTO,
  recurso_financiero: RECURSO_FINANCIERO_POR_DEFECTO,
  recurso_tecnologico: RECURSO_TECNOLOGICO_POR_DEFECTO,
  riesgos: RIESGOS_POR_DEFECTO,
  controles: CONTROLES_POR_DEFECTO,
  oportunidades: OPORTUNIDADES_POR_DEFECTO,
  mes_inicio: 'SEPTIEMBRE',
  mes_fin: 'SEPTIEMBRE',
  nomenclatura: NOMENCLATURA_POR_DEFECTO,
  observaciones: '',
  elaborado_por: '',
  elaborado_cargo: '',
  revisado_por: '',
  revisado_cargo: '',
  aprobado_por: '',
  aprobado_cargo: 'Rector',
  fecha_aprobacion: '',
}

/** Semanas que se dibujan por cada mes del rango. */
export const SEMANAS_POR_MES = 4

/** El índice de un mes en `MESES`, sin importar tildes ni mayúsculas. */
const indiceDeMes = (mes) => {
  const limpio = String(mes ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toUpperCase()

  return MESES.findIndex(
    (m) => m.normalize('NFD').replace(/\p{Diacritic}/gu, '') === limpio
  )
}

/**
 * Los meses del programa, de `mes_inicio` a `mes_fin` y ambos incluidos.
 *
 * El programa puede abarcar varios meses —«de septiembre a octubre»—, y de ahí
 * salen las semanas del cronograma. Sin mes de inicio no hay rango: el
 * cronograma se dibuja sin la cuadrícula.
 *
 * Un `mes_fin` anterior al de inicio se ignora y queda solo el primero: el
 * programa vive dentro de un año, así que un rango que dé la vuelta al
 * calendario no es un rango sino una errata. El formulario tampoco lo ofrece.
 */
export function mesesDelPrograma(programa) {
  const desde = indiceDeMes(programa?.mes_inicio)
  if (desde < 0) return []

  const hasta = indiceDeMes(programa?.mes_fin)
  if (hasta < desde) return [MESES[desde]]

  return MESES.slice(desde, hasta + 1)
}

/**
 * Las semanas del programa, numeradas de corrido sobre todo el rango.
 *
 * Con un solo mes son la 1 a la 4, que es lo que guardaban los programas de
 * antes; con dos meses, la 5 es la primera del segundo mes. La numeración es
 * corrida y no «octubre-1» para que lo guardado («1,3») siga significando lo
 * mismo y no haya que convertir nada.
 *
 * @returns {{id: string, mes: string, numero: number}[]}
 */
export function semanasDelPrograma(programa) {
  return mesesDelPrograma(programa).flatMap((mes, iMes) =>
    Array.from({ length: SEMANAS_POR_MES }, (_, i) => ({
      id: String(iMes * SEMANAS_POR_MES + i + 1),
      mes,
      numero: i + 1,
    }))
  )
}

/** «SEPTIEMBRE» o «SEPTIEMBRE - OCTUBRE», para las pantallas. */
export function rangoDeMeses(programa) {
  const meses = mesesDelPrograma(programa)
  if (!meses.length) return ''
  return meses.length === 1 ? meses[0] : `${meses[0]} - ${meses[meses.length - 1]}`
}

/** «1,3» → Set{'1','3'}. */
export const semanasDe = (texto) =>
  new Set(
    String(texto ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  )

/**
 * Sección vacía del cronograma: un proceso del mapa institucional.
 *
 * El formato agrupa el cronograma por proceso: los requisitos ISO y las semanas
 * se combinan verticalmente en todo el bloque —son los mismos para el proceso
 * entero— y lo que cambia fila a fila es la dependencia auditada y sus
 * auditores.
 */
export const seccionCronograma = (proceso) => ({
  proceso_clave: proceso.value,
  proceso: proceso.label,
  requisitos_9001: '',
  requisitos_14001: '',
  semanas: '',
  dependencias: [],
})

/**
 * El cronograma arranca con las seis secciones del mapa de procesos.
 *
 * Siempre están las seis: no se añaden ni se quitan, porque son el mapa de
 * procesos de la Universidad y no una lista que se improvise por programa.
 * Función y no constante para no compartir los arrays entre dos aperturas.
 */
export const cronogramaInicial = () => PROCESOS_CRONOGRAMA.map(seccionCronograma)

/**
 * Una dependencia auditada dentro de una sección.
 *
 * `auditor_acompanante` es texto libre y opcional: acompaña a una auditoría
 * concreta, no al proceso entero, y muchas veces es alguien que no está en el
 * catálogo de usuarios. En el formato es la «AA» de la nomenclatura.
 */
export const DEPENDENCIA_CRONOGRAMA_VACIA = {
  auditado: '',
  auditores: '',
  auditor_acompanante: '',
}

/** Cuántas dependencias hay en total, que es lo que da contenido al cronograma. */
export const totalDependenciasCronograma = (cronograma) =>
  (cronograma ?? []).reduce((n, s) => n + (s.dependencias?.length ?? 0), 0)

/** Fila vacía de la distribución. */
export const DISTRIBUCION_VACIA = {
  responsable_titulo: '',
  responsable_nombre: '',
  organismo: '',
  gestion: '',
  facultad: '',
  proceso: '',
  auditor_nombre: '',
  auditor_correo: '',
  auditor_estudios: '',
  coordinador_nombre: '',
  coordinador_correo: '',
  coordinador_alterno: '',
  coordinador_nivel: '',
  gestor_nombre: '',
  gestor_correo: '',
  decanatura_nombre: '',
  decanatura_correo: '',
  decano_titulo: '',
  decano_nombre: '',
}
