/**
 * GET /api/ia/uso
 *
 * Lo que ha consumido la revisión con IA: revisiones, tokens, medias y quién
 * la usa. Alimenta la pestaña «Uso IA» de Estadísticas.
 *
 * Solo administración. El auditor no ve su consumo ni el de nadie: el tope
 * existe para controlar el gasto del sistema, no para que cada uno administre
 * una cuota mientras escribe su informe.
 *
 * Se agrega aquí y no en SQL porque la tabla es pequeña por diseño —como mucho
 * diez filas por auditoría— y así el panel entero sale de una sola consulta en
 * vez de cinco vistas materializadas que habría que mantener.
 */
import { requireRole } from '@/lib/api/guard'
import { withRoute } from '@/lib/api/handler'
import { fromPostgresError } from '@/lib/api/errors'
import { json } from '@/lib/api/response'
import { ROLES } from '@/lib/auth/roles'
import {
  gastoFacturado,
  inicioDelPresupuesto,
  porcentajeDelPresupuesto,
  presupuestoUsd,
} from '@/lib/ia/facturacion'
import { LIMITE_REVISIONES_IA } from '@/lib/ia/registro'

/**
 * Techo de filas que se traen.
 *
 * A diez revisiones por auditoría son mil auditorías: más que cualquier año
 * real. Si algún día se pasa, el panel avisa en vez de mentir con una media
 * calculada sobre un trozo.
 */
const MAXIMO_FILAS = 10_000

const SELECT = `
  id, informe_id, usuario_id, estado, codigo_error, modelo, veredictos,
  tokens_entrada, tokens_salida, duracion_ms, consume_cupo, created_at,
  informe:informe_id ( id, fecha_auditoria, dependencias:dependencia_id ( nombre ) ),
  usuario:usuario_id ( nombre, apellido )
`

/** «2026-08-06T…» → «2026-08-06», sin pasar por Date ni por husos horarios. */
const dia = (iso) => String(iso ?? '').slice(0, 10)

const nombreDe = (usuario) =>
  [usuario?.nombre, usuario?.apellido].filter(Boolean).join(' ').trim() || 'Sin identificar'

/** Suma sobre un mapa: `acumular(mapa, clave, () => ({...}))` y devuelve la entrada. */
function acumular(mapa, clave, inicial) {
  if (!mapa.has(clave)) mapa.set(clave, inicial())
  return mapa.get(clave)
}

const media = (total, veces) => (veces ? Math.round(total / veces) : 0)

/**
 * Cierra un acumulador de tokens: los suma y calcula qué parte del total
 * representa.
 *
 * Se manda la parte y no el coste en dólares a propósito: el panel habla de
 * consumo del presupuesto, no de dinero fila a fila. Y la parte sale de los
 * tokens, así que existe aunque no haya precios configurados.
 */
const cerrar = (fila, tokensTotal) => {
  const tokens = fila.entrada + fila.salida
  return {
    ...fila,
    tokens,
    partePct: tokensTotal ? Math.round((tokens / tokensTotal) * 1000) / 10 : 0,
  }
}


export const GET = withRoute(async () => {
  const guard = await requireRole(ROLES.ADMIN)
  if (!guard.ok) return guard.response

  const { data, error } = await guard.admin
    .from('ia_revisiones')
    .select(SELECT)
    .order('created_at', { ascending: false })
    .limit(MAXIMO_FILAS)

  if (error) throw fromPostgresError(error)

  const filas = data ?? []

  const resumen = {
    revisiones: filas.length,
    ok: 0,
    errores: 0,
    bloqueadas: 0,
    tokensEntrada: 0,
    tokensSalida: 0,
    duracionTotal: 0,
    conDuracion: 0,
    // Llamadas que gastaron tokens: las buenas y las que fallaron después de
    // que el modelo respondiera. Es el divisor de la media.
    conTokens: 0,
  }

  const veredictos = { alineado: 0, parcial: 0, desalineado: 0 }
  const porAuditoria = new Map()
  const porUsuario = new Map()
  const porDia = new Map()
  const porError = new Map()

  for (const fila of filas) {
    const tokens = (fila.tokens_entrada ?? 0) + (fila.tokens_salida ?? 0)

    if (fila.estado === 'ok') resumen.ok++
    else if (fila.estado === 'bloqueada') resumen.bloqueadas++
    else resumen.errores++

    resumen.tokensEntrada += fila.tokens_entrada ?? 0
    resumen.tokensSalida += fila.tokens_salida ?? 0
    if (tokens > 0) resumen.conTokens++

    if (fila.duracion_ms) {
      resumen.duracionTotal += fila.duracion_ms
      resumen.conDuracion++
    }

    for (const v of fila.veredictos ?? []) {
      if (v?.veredicto in veredictos) veredictos[v.veredicto]++
    }

    if (fila.estado === 'error' && fila.codigo_error) {
      const e = acumular(porError, fila.codigo_error, () => ({
        codigo: fila.codigo_error,
        veces: 0,
      }))
      e.veces++
    }

    const auditoria = acumular(porAuditoria, fila.informe_id, () => ({
      informeId: fila.informe_id,
      dependencia: fila.informe?.dependencias?.nombre ?? 'Sin dependencia',
      fechaAuditoria: fila.informe?.fecha_auditoria ?? null,
      usos: 0,
      consumidas: 0,
      bloqueadas: 0,
      entrada: 0,
      salida: 0,
      // Las filas vienen de la más reciente a la más antigua, así que la
      // primera de cada auditoría es su última revisión.
      ultima: fila.created_at,
    }))
    auditoria.usos++
    if (fila.consume_cupo) auditoria.consumidas++
    if (fila.estado === 'bloqueada') auditoria.bloqueadas++
    auditoria.entrada += fila.tokens_entrada ?? 0
    auditoria.salida += fila.tokens_salida ?? 0

    const usuario = acumular(porUsuario, fila.usuario_id ?? 0, () => ({
      usuario: nombreDe(fila.usuario),
      usos: 0,
      entrada: 0,
      salida: 0,
      auditorias: new Set(),
    }))
    usuario.usos++
    usuario.entrada += fila.tokens_entrada ?? 0
    usuario.salida += fila.tokens_salida ?? 0
    usuario.auditorias.add(fila.informe_id)

    const jornada = acumular(porDia, dia(fila.created_at), () => ({
      fecha: dia(fila.created_at),
      revisiones: 0,
      tokens: 0,
    }))
    jornada.revisiones++
    jornada.tokens += tokens
  }

  const tokensTotal = resumen.tokensEntrada + resumen.tokensSalida
  const auditorias = [...porAuditoria.values()]

  // La factura se pide del periodo del presupuesto, no del primer día con uso
  // registrado: la tabla de revisiones es nueva y el rango habría empezado hoy,
  // dejando fuera todo lo que la cuenta llevara gastado.
  const facturacion = await gastoFacturado({
    desde: inicioDelPresupuesto(),
    hasta: new Date().toISOString().slice(0, 10),
  })

  const gastoReal = facturacion.disponible ? facturacion.totalUsd : null

  return json({
    limite: LIMITE_REVISIONES_IA,
    // El panel avisa si se llegó al techo: las medias serían de un trozo.
    truncado: filas.length >= MAXIMO_FILAS,

    resumen: {
      ...resumen,
      tokensTotal,
      auditorias: auditorias.length,
      usuarios: porUsuario.size,
      agotadas: auditorias.filter((a) => a.consumidas >= LIMITE_REVISIONES_IA).length,
      // Solo sobre las que gastaron: las bloqueadas no llegan al modelo y
      // hundirían la media sin que nadie hubiera dejado de gastar.
      mediaTokens: media(tokensTotal, resumen.conTokens),
      mediaDuracionMs: media(resumen.duracionTotal, resumen.conDuracion),
      mediaPorAuditoria: auditorias.length
        ? Math.round((resumen.revisiones / auditorias.length) * 10) / 10
        : 0,
    },

    /**
     * El presupuesto, en porcentaje y nunca en dinero.
     *
     * `usadoPct` es **lo que OpenAI factura de toda la cuenta**, que es la
     * cifra con la que se decide. La estimación de este sistema ya no compite
     * con ella: se sigue calculando, pero solo para repartir el uso entre
     * auditorías y auditores, y en el presupuesto no aparece.
     *
     * Si OpenAI no contesta, `usadoPct` es `null` y el panel lo dice. No se
     * sustituye por la estimación: enseñar un número propio bajo el rótulo de
     * la factura es peor que reconocer que falta el dato.
     *
     * Los importes en dólares se quedan en el servidor: al panel solo llega el
     * porcentaje y el presupuesto, que es la referencia para leerlo.
     */
    presupuesto: {
      limiteUsd: presupuestoUsd(),
      usadoPct: porcentajeDelPresupuesto(gastoReal),
      facturacion: {
        disponible: facturacion.disponible,
        motivo: facturacion.motivo ?? null,
        desde: facturacion.desde ?? null,
        hasta: facturacion.hasta ?? null,
        dias: facturacion.porDia?.length ?? 0,
        // De la caché de cinco minutos; si además viene «viejo», la última
        // consulta falló y esto es lo anterior que sí funcionó.
        deCache: Boolean(facturacion.deCache),
        viejo: Boolean(facturacion.viejo),
        // El periodo pedido no cabía en las peticiones que permite la API.
        truncado: Boolean(facturacion.truncado),
      },
    },

    veredictos,
    errores: [...porError.values()].sort((a, b) => b.veces - a.veces),

    porDia: [...porDia.values()].sort((a, b) => a.fecha.localeCompare(b.fecha)),

    porAuditoria: auditorias
      .map((a) =>
        cerrar({ ...a, restantes: Math.max(0, LIMITE_REVISIONES_IA - a.consumidas) }, tokensTotal)
      )
      .sort((a, b) => b.usos - a.usos),

    porUsuario: [...porUsuario.values()]
      .map(({ auditorias: suyas, ...resto }) =>
        cerrar({ ...resto, auditorias: suyas.size }, tokensTotal)
      )
      .sort((a, b) => b.usos - a.usos),
  })
})
