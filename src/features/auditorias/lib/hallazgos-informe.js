/**
 * Leer y sincronizar los hallazgos de un informe.
 *
 * Estaba dentro de `FormularioRegistro`, y ahí no se podía probar: la pérdida
 * de hallazgos del informe #352 (tres guardados seguidos que borraron y no
 * insertaron nada) no se vio venir porque la rutina vivía dentro de un efecto
 * de React. Aquí se puede ejecutar sola.
 *
 * Tres reglas que no son evidentes y que son el motivo de este archivo:
 *
 *  1. **Se sincroniza fila por fila, no se reescribe la lista.** Antes cada
 *     guardado borraba todos los hallazgos y los volvía a insertar. Eso cambia
 *     los `id` y reinicia los `created_at` en cada guardado —se vio en #352:
 *     las mismas cuatro fortalezas pasaron de los ids 2497-2500 a los
 *     2517-2520 en una hora—, y con guardado automático sería una reescritura
 *     completa cada pocos segundos. Aquí se inserta lo nuevo, se actualiza lo
 *     que ya existe y se borra solo lo que el auditor quitó.
 *
 *  2. **Un error de lectura no es una lista vacía.** Si la consulta falla y se
 *     devuelve `[]`, el formulario se pinta vacío, el auditor no distingue eso
 *     de «no hay hallazgos» y el siguiente guardado escribe ese vacío en la
 *     base. Por eso `leerHallazgos` informa del fallo en vez de tragárselo.
 *
 *  3. **Cada tarjeta lleva un `uid` propio del navegador.** Hace falta para
 *     poder devolverle al formulario el `id` que le asignó la base sin
 *     depender de la posición en la lista: entre que se lanza el guardado y
 *     que responde, el auditor puede haber añadido o quitado tarjetas, y
 *     emparejar por índice insertaría duplicados.
 */

/**
 * Una tarjeta que se añadió y no se llegó a tocar.
 *
 * Con que tenga algo —una palabra o una norma seleccionada— se guarda tal
 * cual, a medio escribir si así está. Las del todo vacías se descartan: son
 * tarjetas abiertas por error, y una fila en blanco acabaría figurando como
 * hallazgo real en el Plan de Mejoramiento.
 */
export const enBlanco = (tipo, hallazgo) =>
  !hallazgo.iso &&
  !hallazgo.capitulo &&
  !hallazgo.numeral &&
  tipo.campos.every((c) => !String(hallazgo[c.name] || '').trim())

const idONulo = (v) => (v === '' || v === undefined ? null : v)

/** La fila de la tabla que corresponde a una tarjeta. */
export const filaDe = (tipo, h, informeId) => ({
  informe_id: informeId,
  iso_id: idONulo(h.iso),
  capitulo_id: idONulo(h.capitulo),
  numeral_id: idONulo(h.numeral),
  ...Object.fromEntries(tipo.campos.map((c) => [c.name, h[c.name] || null])),
})

/** Las filas que van a la tabla de un tipo, ya sin las tarjetas en blanco. */
export function filasDeTipo(tipo, lista, informeId) {
  return (lista ?? []).filter((h) => !enBlanco(tipo, h)).map((h) => filaDe(tipo, h, informeId))
}

/** Identificador de navegador para una tarjeta, estable mientras esté en pantalla. */
let contadorUid = 0
export const nuevoUid = () =>
  globalThis.crypto?.randomUUID?.() ?? `uid-${Date.now()}-${++contadorUid}`

/** La forma que espera el formulario, a partir de una fila de la base. */
const aTarjeta = (tipo, fila) => ({
  uid: nuevoUid(),
  id: fila.id,
  iso: fila.iso_id ?? '',
  capitulo: fila.capitulo_id ?? '',
  numeral: fila.numeral_id ?? '',
  ...Object.fromEntries(tipo.campos.map((c) => [c.name, fila[c.name] ?? ''])),
})

/**
 * Los hallazgos guardados de un informe, por tipo.
 *
 * `error` no es decorativo: mientras valga algo, el formulario no debe
 * guardar, porque lo que tiene en pantalla no es lo que hay en la base.
 *
 * Se ordenan por `id` porque sin orden explícito PostgREST las devuelve como
 * estén en disco: la lista le cambiaba de orden al auditor entre un guardado y
 * el siguiente.
 *
 * @returns {Promise<{hallazgos: Record<string, Array>, error: string|null}>}
 */
export async function leerHallazgos(db, tipos, informeId) {
  const respuestas = await Promise.all(
    tipos.map((t) => db.from(t.tabla).select('*').eq('informe_id', informeId).order('id'))
  )

  const hallazgos = {}
  const fallos = []

  tipos.forEach((tipo, i) => {
    const { data, error } = respuestas[i]
    if (error) fallos.push(`${tipo.plural ?? tipo.tabla}: ${error.message}`)
    hallazgos[tipo.key] = (data ?? []).map((fila) => aTarjeta(tipo, fila))
  })

  return { hallazgos, error: fallos.length ? fallos.join(' · ') : null }
}

/** Lo que había en la base, por tipo, para saber qué sobra al terminar. */
async function idsEnBase(db, tipos, informeId) {
  const respuestas = await Promise.all(
    tipos.map((t) => db.from(t.tabla).select('id').eq('informe_id', informeId))
  )

  return tipos.map((tipo, i) => {
    const { data, error } = respuestas[i]
    if (error) {
      throw new Error(
        `No se pudieron leer los hallazgos actuales (${tipo.plural ?? tipo.tabla}): ` +
          `${error.message}. No se guardó nada.`
      )
    }
    return new Set((data ?? []).map((f) => f.id))
  })
}

/**
 * Deja la base con exactamente los hallazgos que trae `hallazgos`.
 *
 * El orden de las operaciones es a propósito: primero lo que crea y actualiza,
 * y solo al final lo que borra. Si algo falla a mitad, lo que ya estaba
 * guardado sigue estándolo; nunca se queda el informe sin hallazgos por un
 * fallo de escritura, que es exactamente lo que pasó con #352.
 *
 * Una tarjeta con `id` que ya no está en la base —otra sesión la borró— se
 * vuelve a insertar en vez de perderse: el `update` no habría casado con nada
 * y la fila se habría quedado solo en la pantalla del auditor.
 *
 * Devuelve el recuento por tipo y el `id` que le tocó a cada `uid`. El
 * recuento no es un adorno: el aviso de «guardado correctamente» salía igual
 * cuando no se insertaba nada, y es el motivo por el que una pérdida de
 * hallazgos podía pasar por un guardado normal.
 *
 * @returns {Promise<{escritos: Record<string, number>, ids: Record<string, number>}>}
 * @throws {Error} si alguna lectura o escritura falla
 */
export async function sincronizarHallazgos(db, tipos, informeId, hallazgos) {
  const previos = await idsEnBase(db, tipos, informeId)

  const escritos = Object.fromEntries(tipos.map((t) => [t.key, 0]))
  /** `uid` → `id` asignado, para que el formulario deje de verlas como nuevas. */
  const ids = {}
  const sobran = []

  for (const [i, tipo] of tipos.entries()) {
    const enBase = previos[i]
    const vivas = new Set()

    // Las tarjetas vacías no se guardan, y si tenían fila se quedan fuera de
    // `vivas`: el barrido del final las borra.
    const tarjetas = (hallazgos[tipo.key] ?? []).filter((t) => !enBlanco(tipo, t))
    const nuevas = []

    for (const tarjeta of tarjetas) {
      const fila = filaDe(tipo, tarjeta, informeId)

      if (tarjeta.id && enBase.has(tarjeta.id)) {
        // Sin `.select()`: el `id` ya se conoce, así que no hace falta que la
        // base lo devuelva. Pedirlo obligaba a que PostgREST pudiera leer la
        // fila recién escrita —`Prefer: return=representation`—, y eso depende
        // de la política de lectura, no de la de escritura: un guardado
        // correcto podía quedarse en «no se pudo guardar» solo porque la
        // respuesta volvía vacía. Que la fila exista ya lo garantiza `enBase`,
        // leído unas líneas más arriba.
        const { error } = await db.from(tipo.tabla).update(fila).eq('id', tarjeta.id)
        if (error) throw fallo(tipo, 'actualizar', error)

        vivas.add(tarjeta.id)
        if (tarjeta.uid) ids[tarjeta.uid] = tarjeta.id
      } else {
        nuevas.push({ tarjeta, fila })
      }

      escritos[tipo.key]++
    }

    // Las nuevas van en una sola inserción, no una por tarjeta: menos viajes,
    // y sobre todo una sola respuesta de la que sacar los `id`.
    if (nuevas.length) {
      const asignados = await insertarYRecuperarIds(
        db,
        tipo,
        informeId,
        nuevas.map((n) => n.fila),
        enBase
      )

      nuevas.forEach(({ tarjeta }, n) => {
        const id = asignados[n]
        if (id === undefined) return
        vivas.add(id)
        if (tarjeta.uid) ids[tarjeta.uid] = id
      })
    }

    const aBorrar = [...enBase].filter((id) => !vivas.has(id))
    if (aBorrar.length) sobran.push({ tipo, aBorrar })
  }

  // El borrado va al final y por `id`, nunca por `informe_id`: así solo cae lo
  // que el auditor quitó de la lista, y un fallo aquí deja filas de sobra —que
  // se ven y se pueden borrar— en vez de filas de menos.
  for (const { tipo, aBorrar } of sobran) {
    const { error } = await db.from(tipo.tabla).delete().in('id', aBorrar)
    if (error) {
      throw new Error(
        `Se guardaron los hallazgos, pero no se pudieron retirar los que quitaste ` +
          `(${tipo.plural ?? tipo.tabla}: ${error.message}). Puede que aparezcan repetidos.`
      )
    }
  }

  return { escritos, ids }
}

const fallo = (tipo, verbo, error) =>
  new Error(
    `No se pudo ${verbo} un hallazgo de ${tipo.plural ?? tipo.tabla} (${error.message}). ` +
      `Lo que ya estaba guardado sigue en su sitio.`
  )

/**
 * Inserta las filas nuevas y devuelve el `id` de cada una, en el mismo orden.
 *
 * Lo normal es que PostgREST los devuelva en la propia respuesta. Pero esa
 * respuesta es `Prefer: return=representation`, o sea una LECTURA de lo que se
 * acaba de escribir, y puede volver vacía aunque la inserción haya ido bien.
 * Si eso pasara y se tratara como un fallo, la fila ya estaría en la base sin
 * `id` en la pantalla, y el autoguardado siguiente la insertaría otra vez: un
 * hallazgo duplicado por cada vez que el auditor dejara de teclear.
 *
 * De ahí el respaldo: se vuelven a leer los `id` de la tabla y se toman los
 * que no estaban antes. Son `bigserial`, así que ordenados de menor a mayor
 * corresponden al orden en que se enviaron.
 */
async function insertarYRecuperarIds(db, tipo, informeId, filas, enBase) {
  const { data, error } = await db.from(tipo.tabla).insert(filas).select('id')

  if (data?.length === filas.length) return data.map((f) => f.id)

  // Sin representación utilizable hay que averiguar si la inserción entró.
  const { data: actuales, error: errorRelectura } = await db
    .from(tipo.tabla)
    .select('id')
    .eq('informe_id', informeId)

  if (errorRelectura) throw fallo(tipo, 'guardar', error ?? errorRelectura)

  const aparecidos = (actuales ?? [])
    .map((f) => f.id)
    .filter((id) => !enBase.has(id))
    .sort((a, b) => a - b)

  // Nada nuevo en la tabla: la inserción falló de verdad.
  if (!aparecidos.length) throw fallo(tipo, 'guardar', error ?? { message: 'no se insertó nada' })

  return aparecidos
}

/**
 * «4 fortalezas · 2 oportunidades de mejora», para el aviso del guardado.
 *
 * Los tipos sin ninguna fila se nombran igual, con un cero delante. Decir «sin
 * fortalezas» cuando el auditor acaba de escribir cuatro es la única forma de
 * que se dé cuenta en el momento, en vez de descubrirlo dos días después.
 */
export function resumenEscrito(tipos, escritos) {
  const partes = tipos.map((t) => `${escritos?.[t.key] ?? 0} ${(t.plural ?? t.tabla).toLowerCase()}`)
  return partes.join(' · ')
}
