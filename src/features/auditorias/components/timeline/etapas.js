/**
 * Presentación de las etapas de una auditoría.
 *
 * El *contenido* de las etapas (cuáles hay, qué acciones ofrecen) lo decide
 * cada panel; lo que vive aquí es cómo se ven: color del punto, realce de la
 * tarjeta y etiqueta de plazo.
 */

/** Color del punto de la línea según el estado de la etapa. */
export const PUNTO_POR_ESTADO = {
  done: 'bg-emerald-500 ring-emerald-500/20',
  'current-overdue': 'bg-red-500 ring-red-500/25 animate-pulse',
  'current-soon': 'bg-amber-500 ring-amber-500/25 animate-pulse',
  current: 'bg-primary ring-primary/25 animate-pulse',
  past: 'bg-slate-300 ring-transparent dark:bg-slate-600',
  overdue: 'bg-red-400 ring-transparent',
  soon: 'bg-amber-400 ring-transparent',
  upcoming: 'bg-muted-foreground/40 ring-transparent',
}

/** Realce de la tarjeta según el estado. */
export const TARJETA_POR_ESTADO = {
  'current-overdue': 'border-red-300 bg-red-50/60 dark:border-red-900 dark:bg-red-950/25',
  'current-soon': 'border-amber-300 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/25',
  current: 'border-primary/40 bg-primary/5',
  done: 'border-emerald-200 bg-emerald-50/40 dark:border-emerald-900 dark:bg-emerald-950/20',
}

export const LEYENDA_ETAPAS = [
  { label: 'Actual', clase: 'bg-primary' },
  { label: 'Próxima (≤3 d)', clase: 'bg-amber-400' },
  { label: 'Vencida', clase: 'bg-red-500' },
  { label: 'Completada', clase: 'bg-emerald-500' },
]

/** El mismo día sin horas: los plazos se cuentan por días completos. */
const soloDia = (fecha) => {
  const f = fecha instanceof Date ? fecha : new Date(fecha)
  return Number.isNaN(f.getTime()) ? null : new Date(f.getFullYear(), f.getMonth(), f.getDate())
}

/**
 * ¿Se entregó después del plazo?
 *
 * Se compara por día natural y no por instante: subir a las seis de la tarde
 * del último día es entregar a tiempo, y comparando horas exactas cualquier
 * entrega hecha el mismo día del vencimiento habría salido tardía.
 */
export function llegoTarde(subidoAt, limite) {
  const subido = subidoAt ? soloDia(subidoAt) : null
  const tope = limite ? soloDia(limite) : null
  return Boolean(subido && tope && subido > tope)
}

/**
 * Etiqueta de plazo de una etapa.
 *
 * `formato: 'largo'` es el texto del panel del auditor («Quedan 3 días»);
 * `'corto'` el del administrador, que muestra muchas etapas seguidas.
 */
export function badgeFor(daysLeft, completada = false, formato = 'largo', tardio = false) {
  if (completada) {
    // Hecho, pero fuera de plazo. Sin esta distinción el retraso desaparecía
    // del expediente en cuanto se subía el archivo, y es justo el dato que
    // hace falta para evaluar al auditor y para saber por qué el proceso fue
    // como fue. «Vencido» tampoco valía: eso es lo que sigue sin entregarse.
    if (tardio) return { label: 'Envío tardío', tone: 'warning' }
    return { label: 'Completado', tone: 'success' }
  }

  const largo = formato === 'largo'
  if (daysLeft < 0) {
    const n = Math.abs(daysLeft)
    return { label: largo ? `Vencido hace ${n} días` : `Vencido ${n} d`, tone: 'danger' }
  }
  if (daysLeft === 0) return { label: 'Hoy', tone: 'warning' }
  if (daysLeft <= 3) {
    return { label: largo ? `Quedan ${daysLeft} días` : `En ${daysLeft} d`, tone: 'warning' }
  }
  return { label: largo ? `Quedan ${daysLeft} días` : `Faltan ${daysLeft} d`, tone: 'neutral' }
}

/**
 * Marca cada etapa con su estado a partir de si está hecha y de los días que
 * faltan. La primera pendiente es la «actual».
 */
export function decorarEtapas(etapas) {
  const primeraPendiente = etapas.findIndex((e) => !e.explicitDone)

  const decoradas = etapas.map((etapa, i) => {
    const done = Boolean(etapa.explicitDone)
    // `subidoAt` lo pone cada panel con la fecha del archivo en Storage; sin
    // ella la etapa se da por entregada a tiempo, que es lo que se hacía antes.
    const tardio = done && llegoTarde(etapa.subidoAt, etapa.when)
    const overdue = !done && etapa.days < 0
    const soon = !done && etapa.days >= 0 && etapa.days <= 3

    let status = 'upcoming'
    if (done) status = 'done'
    else if (i === primeraPendiente) {
      status = overdue ? 'current-overdue' : soon ? 'current-soon' : 'current'
    } else if (primeraPendiente !== -1 && i < primeraPendiente) status = 'past'
    else if (soon) status = 'soon'
    else if (overdue) status = 'overdue'

    return { ...etapa, done, tardio, overdue, soon, status }
  })

  return {
    etapas: decoradas,
    progressPct: decoradas.length
      ? Math.round((decoradas.filter((e) => e.done).length / decoradas.length) * 100)
      : 0,
    etapaActual: decoradas.find((e) => e.status.startsWith('current')) || null,
    todoHecho: primeraPendiente === -1,
  }
}
