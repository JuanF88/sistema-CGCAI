/**
 * La hoja «Distribución», deducida del cronograma.
 *
 * Antes se llenaba a mano en su propia pestaña, repitiendo lo que ya estaba en
 * el cronograma: el proceso, la dependencia auditada y sus auditores. Todo lo
 * demás sale del catálogo (correo y estudios del auditor, gestor de calidad de
 * la dependencia), así que teclearlo solo servía para que discrepara.
 *
 * Una fila por **auditor y dependencia**. Desde que el cronograma admite un
 * solo auditor líder por dependencia son la misma cosa, pero el bucle se queda:
 * los programas guardados antes pueden traer dos nombres y cada uno tiene que
 * ocupar su fila, que es como lo pide el formato. Una dependencia sin auditor
 * asignado también sale: es justo la que hay que ver para saber que falta.
 *
 * Lo que el sistema no sabe —coordinador, alterno, facultad, decanatura y
 * decano— se deja vacío. No hay ningún vínculo en la base entre una dependencia
 * y su coordinador o su decano; inventarlo sería peor que dejar el hueco.
 *
 * El auditor acompañante del cronograma **no** genera fila: es texto libre, no
 * una persona del catálogo, así que no hay correo ni estudios que traer y la
 * fila saldría con el nombre y nada más. Sí sale en la hoja del programa, junto
 * a los auditores y con la marca «AA:» de la nomenclatura.
 *
 * La columna CONTRASEÑA del Excel original no se reproduce: ver
 * `docs/MIGRACION-PASSWORDS.md`.
 */
import { DISTRIBUCION_VACIA } from './formato'

/** «Ana Pérez, Luis Gómez» → ['Ana Pérez', 'Luis Gómez']. */
const partirAuditores = (texto) =>
  String(texto ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)

/**
 * @param {Array} cronograma  Secciones con sus dependencias
 * @param {Object} catalogo
 * @param {(nombre: string) => Object} catalogo.derivarDeDependencia
 * @param {(nombre: string) => Object|undefined} catalogo.personaPorNombre
 */
export function distribucionDesdeCronograma(cronograma, { derivarDeDependencia, personaPorNombre }) {
  const filas = []

  for (const seccion of cronograma ?? []) {
    for (const dep of seccion.dependencias ?? []) {
      const auditado = String(dep.auditado ?? '').trim()
      if (!auditado) continue

      const deLaDependencia = derivarDeDependencia(auditado)

      // Sin auditores, una sola fila con la casilla en blanco.
      const auditores = partirAuditores(dep.auditores)
      const nombres = auditores.length ? auditores : ['']

      for (const nombreAuditor of nombres) {
        const persona = nombreAuditor ? personaPorNombre(nombreAuditor) : undefined

        filas.push({
          ...DISTRIBUCION_VACIA,

          // Del cronograma: el proceso institucional y la dependencia auditada.
          proceso: seccion.proceso ?? '',
          organismo: deLaDependencia.organismo ?? auditado,
          gestion: deLaDependencia.gestion ?? '',

          // Del catálogo de usuarios.
          auditor_nombre: nombreAuditor,
          auditor_correo: persona?.email ?? '',
          auditor_estudios: persona?.estudios ?? '',
          responsable_nombre: nombreAuditor,
          responsable_titulo: persona?.tipo_estudio ?? '',

          gestor_nombre: deLaDependencia.gestor_nombre ?? '',
          gestor_correo: deLaDependencia.gestor_correo ?? '',
        })
      }
    }
  }

  return filas
}
