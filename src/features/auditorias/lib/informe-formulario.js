/**
 * El puente entre una fila de `informes_auditoria` y el formulario.
 *
 * Vive aparte del componente porque aquí hubo una pérdida de datos y conviene
 * poder probarlo suelto.
 *
 * El formulario se abre con la copia del informe que trae la lista de la vista
 * padre, y esa copia se queda vieja en cuanto el guardado automático escribe:
 * las listas solo se recargan al pulsar «Guardar informe». Al cerrar y reabrir
 * el informe, la pantalla se rellenaba con los valores de antes y el siguiente
 * guardado los escribía encima de los buenos.
 *
 * Con el tipo de asistencia se veía a simple vista: se elegía «Físico», se
 * guardaba solo, y al reabrir el selector decía «Selecciona el tipo» otra vez
 * —la copia vieja lo tenía en `null`, y de `null` sale cadena vacía—; el
 * guardado siguiente dejaba la columna en `null` de verdad. El registro de
 * actividad del 19 de octubre de 2026 tiene nueve idas y venidas
 * «Físico» → `null` → «Físico» de dos auditores distintos.
 *
 * Por eso el formulario confirma contra la base lo que pintó, y por eso la
 * confirmación respeta lo que el auditor haya escrito mientras llegaba.
 */
import { asistenciaCanonica } from '@/features/auditorias/lib/asistencia'

/**
 * El formulario vacío, para un informe que todavía no existe.
 *
 * `asistencia_tipo` arranca en «Digital» porque es el caso corriente, y aquí
 * sí es una elección por defecto legítima: no hay nada guardado que contradecir.
 */
export const FORM_INICIAL = {
  fecha_auditoria: '',
  asistencia_tipo: 'Digital',
  auditores_acompanantes: '',
  objetivo: '',
  criterios: '',
  conclusiones: '',
  fecha_seguimiento: '',
  recomendaciones: '',
}

/** Las columnas de `informes_auditoria` que el formulario escribe. */
export const COLUMNAS_DEL_FORMULARIO = Object.keys(FORM_INICIAL)

/**
 * Una fila del informe, como la espera el formulario.
 *
 * Todo campo sin valor queda en cadena vacía, que es lo que los controles
 * necesitan: un `null` en un `<textarea>` lo deja sin controlar.
 */
export function aFormulario(informe) {
  const fila = informe ?? {}
  return {
    fecha_auditoria: fila.fecha_auditoria || '',
    // Casado con su opción: en la base hay un `FÍSICO` en mayúsculas que el
    // selector no sabía enseñar. Ver `lib/asistencia.js`.
    asistencia_tipo: asistenciaCanonica(fila.asistencia_tipo),
    auditores_acompanantes: (fila.auditores_acompanantes || []).join(', '),
    objetivo: fila.objetivo || '',
    criterios: fila.criterios || '',
    conclusiones: fila.conclusiones || '',
    fecha_seguimiento: fila.fecha_seguimiento || '',
    recomendaciones: fila.recomendaciones || '',
  }
}

/**
 * Lo confirmado contra la base, sin pisar lo que el auditor ya tocó.
 *
 * La consulta de confirmación tarda unos milisegundos y el formulario ya está
 * en pantalla, así que puede haber escrito algo en ese hueco. Campo a campo:
 * si lo tocó, manda lo que hay en pantalla; si no, manda la base.
 *
 * @param {Record<string, string>} enPantalla
 * @param {Record<string, string>} confirmado  Ya pasado por `aFormulario`
 * @param {Set<string>} tocados                Nombres de campo que tocó el auditor
 */
export function mezclarConfirmado(enPantalla, confirmado, tocados) {
  return Object.fromEntries(
    COLUMNAS_DEL_FORMULARIO.map((campo) => [
      campo,
      tocados.has(campo) ? enPantalla[campo] : confirmado[campo],
    ])
  )
}
