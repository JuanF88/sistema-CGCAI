/**
 * El tipo de asistencia de una auditoría: digital o físico.
 *
 * Existe este archivo por un fallo concreto. El selector del informe conocía
 * solo `Digital` y `Físico`, y en la base hay un informe —el #253— guardado
 * como `FÍSICO`, en mayúsculas, de cuando el formulario convertía los textos
 * al salir del campo. Radix no encuentra la opción que corresponde a ese
 * valor, así que no puede pintar su etiqueta y enseña el texto de relleno:
 * «Selecciona el tipo», como si nadie hubiera elegido nada. El dato estaba
 * bien; lo que fallaba era la pantalla.
 *
 * La lección es la misma que con `tipo_estudio`, que escondía a cuatro
 * usuarios guardados como «profesional especializado»: una lista cerrada de
 * opciones y una columna de texto libre acaban separándose, y cuando se
 * separan el valor desaparece de la vista sin avisar. Aquí se casa el valor
 * guardado con su opción ignorando tildes y mayúsculas, y lo que no se
 * reconozca se enseña tal cual en vez de perderse.
 */

export const ASISTENCIA_TIPOS = [
  { value: 'Digital', label: 'Digital' },
  { value: 'Físico', label: 'Físico' },
]

/** Sin tildes, sin mayúsculas y sin espacios de sobra, solo para comparar. */
const clave = (valor) =>
  String(valor ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .trim()

/**
 * El valor guardado, casado con la opción que le corresponde.
 *
 * Devuelve `''` cuando no hay nada guardado: ahí el texto de relleno es la
 * respuesta correcta —nadie ha elegido— y no se inventa un valor. Antes se
 * devolvía `'Digital'` por defecto, de modo que un informe sin tipo decía
 * «Digital» y, si el auditor guardaba, escribía «Digital» en la base sin que
 * nadie lo hubiera escogido.
 *
 * Un valor que no case con ninguna opción se devuelve **sin tocar**, para que
 * la pantalla pueda enseñarlo en vez de dejar el campo en blanco.
 */
export function asistenciaCanonica(valor) {
  if (!valor) return ''
  const buscada = clave(valor)
  return ASISTENCIA_TIPOS.find((t) => clave(t.value) === buscada)?.value ?? valor
}

/** ¿Es un valor que el selector sabe enseñar por sí mismo? */
export const esAsistenciaConocida = (valor) =>
  ASISTENCIA_TIPOS.some((t) => t.value === valor)

/** Cómo se escribe para leerlo, ya normalizado. */
export const etiquetaAsistencia = (valor) => {
  const canonico = asistenciaCanonica(valor)
  if (!canonico) return ''
  return ASISTENCIA_TIPOS.find((t) => t.value === canonico)?.label ?? canonico
}
