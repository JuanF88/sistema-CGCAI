'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { BellRing, ClipboardCheck, Download, LayoutGrid, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Cargando } from '@/components/ui/loader'
import { PageHeader } from '@/components/ui/page-header'
import { InfoCard } from '@/components/ui/info-card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PAGE_SHELL, SECTION_CARD } from '@/components/ui/tokens'
import { useAnioInicial } from '@/hooks/useAnioInicial'
import { cn } from '@/lib/utils'
import { toast } from 'react-toastify'
import { avisarPendientes } from '@/features/alertas/api/alertas-api'
import { ModalAvisoPendientes } from './ModalAvisoPendientes'
import ModalEjecucion from './ModalEjecucion'
import { exportarMallaControl } from '@/features/auditorias/lib/exportar-malla'
import { PLAZOS } from '@/lib/catalogos/plazos'
import { llegoTarde } from './timeline/etapas'
import {
  avisoDeFallidos,
  buscarDocumento,
  leerBuckets,
} from '@/features/auditorias/lib/indice-archivos'
import {
  parseYMD,
  addBusinessDays,
  startOfDay,
  fmt,
  buildPlanPath,
  buildAsistenciaPath,
  buildEvaluacionPath,
  buildActaPath,
  buildActaCompromisoPath,
  buildValidationPath,
  BUCKETS
} from '@/features/auditorias/hooks/useAuditTimeline'

/**
 * Los documentos de la malla, en el orden del ciclo de la auditoría.
 *
 * De aquí salen las dos cosas que se comparan de un vistazo —las tarjetas de
 * arriba y las columnas de la tabla—, para que la tercera tarjeta corresponda
 * siempre con la tercera columna. Antes eran dos listas sueltas en distinto
 * orden y no había forma de leerlas juntas.
 */
const DOCUMENTOS_MALLA = [
  // Primera y aparte: no es un documento del expediente sino la pregunta de la
  // que dependen las demás —si la auditoría se hizo—, y se marca a mano. Va a
  // la izquierda de todo y con una celda más estrecha y sin porcentaje, para
  // que se lea como lo que es: un control, no una entrega.
  { key: 'ejecutada',  columna: 'Ejecutada',   tarjeta: 'Ejecutadas',         tono: 'rose',   plazo: null, manual: true },
  { key: 'actaComp',   columna: 'Carta Comp.', tarjeta: 'Cartas compromiso',  tono: 'pink',   plazo: 'actaCompromiso' },
  { key: 'plan',       columna: 'Plan',        tarjeta: 'Planes',             tono: 'purple', plazo: 'plan' },
  { key: 'asistencia', columna: 'Asistencia',  tarjeta: 'Asistencias',        tono: 'green',  plazo: 'asistencia' },
  { key: 'evaluacion', columna: 'Evaluación',  tarjeta: 'Evaluaciones',       tono: 'orange', plazo: 'evaluacion' },
  { key: 'acta',       columna: 'Acta',        tarjeta: 'Actas',              tono: 'cyan',   plazo: 'acta' },
  // El informe «completo» no es un archivo: es tener los campos y los
  // hallazgos. No hay documento que reclamar, así que no se puede avisar.
  { key: 'informeOk',  columna: 'Informe',     tarjeta: 'Informes completos', tono: 'teal',   plazo: null },
  { key: 'validado',   columna: 'Validado',    tarjeta: 'Validados',          tono: 'indigo', plazo: 'validacion' },
]

/** De la columna de la malla a la clave del proceso en las alertas. */
const ALERTA_POR_COLUMNA = Object.fromEntries(
  DOCUMENTOS_MALLA.filter((d) => d.plazo).map((d) => [d.key, PLAZOS[d.plazo].alerta])
)

const COLUMNAS = DOCUMENTOS_MALLA.map(({ key, columna, manual }) => ({
  key,
  title: columna,
  manual: Boolean(manual),
}))

/**
 * La rejilla de la malla: dependencia, avance, la columna de control y los
 * siete documentos.
 *
 * Se escribe una sola vez porque la usan la cabecera y cada fila, y si las dos
 * no dicen exactamente lo mismo las columnas dejan de cuadrar. Tiene que estar
 * literal en el código para que Tailwind la vea: la hoja de estilos se genera
 * leyendo el fuente como texto, así que una plantilla construida con
 * `repeat(${n})` no existiría.
 */
const REJILLA = 'grid grid-cols-[minmax(220px,1.6fr)_140px_72px_repeat(7,minmax(96px,1fr))]'

/**
 * Las ocho métricas de la cabecera.
 *
 * `sinPorcentaje` es solo para el total: es el denominador de las otras siete,
 * así que un «16/16 · 100 %» no diría nada.
 */
const TARJETAS = [
  { key: 'total', label: 'Total auditorías', tono: 'blue', sinPorcentaje: true },
  ...DOCUMENTOS_MALLA.map(({ key, tarjeta, tono }) => ({ key, label: tarjeta, tono })),
]

/** Los seis buckets que hay que leer para pintar la matriz. */
const BUCKETS_DOCUMENTO = {
  planes: BUCKETS.PLANES,
  asistencias: BUCKETS.ASISTENCIAS,
  evaluaciones: BUCKETS.EVALUACIONES,
  actas: BUCKETS.ACTAS,
  actascompromiso: BUCKETS.ACTAS_COMPROMISO,
  validaciones: BUCKETS.VALIDACIONES,
}

// `soloLectura` se acepta por coherencia con las demás vistas del panel del
// visualizador, pero esta pantalla ya es de solo lectura: no ofrece ninguna
// acción de escritura.
export default function AuditoriasMallaControl() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [auditorias, setAuditorias] = useState([])
  const [selectedYear, setSelectedYear] = useState('') // '' = todos
  /** Celda sobre la que se está avisando: documento, dependencia y auditorías. */
  const [aviso, setAviso] = useState(null)
  /** Celda de «Ejecutada» abierta: dependencia e ids de sus auditorías. */
  const [ejecucion, setEjecucion] = useState(null)
  /** La columna `ejecutada` no está en la base todavía. */
  const [sinColumnaEjecucion, setSinColumnaEjecucion] = useState(false)
  const [exportando, setExportando] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const { data, error } = await supabase
        .from('informes_auditoria')
        .select(`
          id, fecha_auditoria, dependencia_id, validado,
          objetivo, criterios, conclusiones, recomendaciones,
          dependencias:dependencias ( nombre ),
          usuarios:usuario_id ( nombre, apellido ),
          fortalezas ( id ),
          oportunidades_mejora ( id ),
          no_conformidades ( id ),
          plan_informe:planes_auditoria_informe ( archivo_path, enviado_at )
        `)
        .order('fecha_auditoria', { ascending: true })

      if (error) throw error
      const rows = data || []

      // Una sola lectura por bucket para toda la pantalla. Antes se listaba el
      // bucket entero para saber si un documento existía, y **otra vez** para
      // leer su fecha: hasta 468 listados encadenados en cada carga. Y cualquier
      // fallo devolvía «no existe», que aquí se convierte en un vencimiento
      // inventado. Ver `lib/indice-archivos`.
      const { indice, fallidos } = await leerBuckets(Object.values(BUCKETS_DOCUMENTO))
      if (fallidos.length) toast.warning(avisoDeFallidos(fallidos))

      // `ejecutada` se pregunta aparte y con tolerancia. Pedirla dentro del
      // `select` de arriba tiraría la pantalla completa mientras no se haya
      // ejecutado `sql/ejecucion-auditorias.sql`; así solo se pierde esa
      // columna, y la propia pantalla dice por qué.
      const ejecucionPorId = new Map()
      const consultaEjecucion = await supabase
        .from('informes_auditoria')
        .select('id, ejecutada, ejecutada_at')

      if (consultaEjecucion.error) {
        // 42703 = la columna no existe.
        if (consultaEjecucion.error.code !== '42703') throw consultaEjecucion.error
        setSinColumnaEjecucion(true)
      } else {
        setSinColumnaEjecucion(false)
        for (const fila of consultaEjecucion.data ?? []) ejecucionPorId.set(fila.id, fila)
      }

      const merged = rows.map((a) => {
        const fa = parseYMD(a.fecha_auditoria)

        // Los plazos salen de `PLAZOS` y se cuentan en días hábiles, igual que
        // en las dos líneas de trabajo y en la nota de archivos. Esta pantalla
        // llevaba su propia tabla en días naturales y se había desalineado del
        // resto: daba el acta por vencida el mismo día de la auditoría y la
        // carta de compromiso quince días *después*, cuando se entrega cinco
        // días hábiles *antes*.
        const due = fa ? {
          plan:        addBusinessDays(fa, PLAZOS.plan.dias),
          asistencia:  addBusinessDays(fa, PLAZOS.asistencia.dias),
          evaluacion:  addBusinessDays(fa, PLAZOS.evaluacion.dias),
          acta:        addBusinessDays(fa, PLAZOS.acta.dias),
          actaComp:    addBusinessDays(fa, PLAZOS.actaCompromiso.dias),
          // La auditoría se ejecuta el día que está programada: ese es su
          // propio plazo, sin desplazamiento.
          ejecutada:   fa,
          informeOk:   addBusinessDays(fa, PLAZOS.validacion.dias),
          validado:    addBusinessDays(fa, PLAZOS.validacion.dias),
        } : {}

        // Existencia y fecha de entrega salen de la misma lectura.
        const plan       = buscarDocumento(indice, BUCKETS.PLANES,           buildPlanPath(a))
        const asis       = buscarDocumento(indice, BUCKETS.ASISTENCIAS,      buildAsistenciaPath(a))
        const evalu      = buscarDocumento(indice, BUCKETS.EVALUACIONES,     buildEvaluacionPath(a))
        const actaDoc    = buscarDocumento(indice, BUCKETS.ACTAS,            buildActaPath(a))
        const actaCompDoc= buscarDocumento(indice, BUCKETS.ACTAS_COMPROMISO, buildActaCompromisoPath(a))
        const validacion = buscarDocumento(indice, BUCKETS.VALIDACIONES,     buildValidationPath(a))

        const hasPlan = plan.existe
        const hasAsis = asis.existe
        const hasEval = evalu.existe
        const hasActa = actaDoc.existe
        const hasActaComp = actaCompDoc.existe
        const hasValid = validacion.existe


        // Campos e hallazgos completos = "informeOk"
        const isFilled = Boolean(a.objetivo?.trim()) && Boolean(a.criterios?.trim()) &&
                         Boolean(a.conclusiones?.trim()) && Boolean(a.recomendaciones?.trim())
        const hallCount = (a.fortalezas?.length || 0) + (a.oportunidades_mejora?.length || 0) + (a.no_conformidades?.length || 0)
        const informeOk = isFilled && hallCount > 0
        const validadoOk = hasValid || a.validado === true

        // Fechas de entrega (cuando existan)
        const planSentAt   = a?.plan_informe?.[0]?.enviado_at || plan.subido_at
        const asistenciaAt = asis.subido_at
        const evaluacionAt = evalu.subido_at
        const actaAt       = actaDoc.subido_at
        const actaCompAt   = actaCompDoc.subido_at
        const validadoAt   = validacion.subido_at

        /** Una etapa con su plazo y, si se entregó, si llegó fuera de él. */
        const etapa = (delivered, limite, fecha) => {
          const deliveredAt = fecha ? new Date(fecha) : null
          return {
            delivered,
            due: limite,
            deliveredAt,
            // Mismo criterio que la línea de trabajo: se compara por día
            // natural, así que entregar el propio día del plazo es a tiempo.
            late: delivered && llegoTarde(deliveredAt, limite),
          }
        }

        const ejec = ejecucionPorId.get(a.id)
        const ejecutada = ejec?.ejecutada === true
        const ejecutadaAt = ejec?.ejecutada_at ?? null

        const _stages = {
          plan:       etapa(hasPlan,     due.plan,       planSentAt),
          // `late: false` a mano: la marca se pone cuando alguien confirma que
          // la auditoría se hizo, casi siempre días después de la fecha. Con
          // el criterio normal todas saldrían «fuera de plazo» y la columna
          // viviría en ámbar sin querer decir nada.
          ejecutada:  { delivered: ejecutada, due: due.ejecutada, deliveredAt: ejecutadaAt ? new Date(ejecutadaAt) : null, late: false },
          asistencia: etapa(hasAsis,     due.asistencia, asistenciaAt),
          evaluacion: etapa(hasEval,     due.evaluacion, evaluacionAt),
          acta:       etapa(hasActa,     due.acta,       actaAt),
          actaComp:   etapa(hasActaComp, due.actaComp,   actaCompAt),
          // El informe no es un archivo: se da por hecho cuando los campos y
          // los hallazgos están, y de eso no queda fecha.
          informeOk:  etapa(informeOk,   due.informeOk,  null),
          validado:   etapa(validadoOk,  due.validado,   validadoAt),
        }

        // Puntuaciones
        const docScore = [hasPlan, hasAsis, hasEval, hasActa, hasActaComp, validadoOk].reduce((n, b) => n + (b ? 1 : 0), 0)
        const infoScore = docScore + (informeOk ? 1 : 0)

        return {
          ...a,
          ejecutada,
          ejecutada_at: ejecutadaAt,
          _flags: { plan: hasPlan, ejecutada, asistencia: hasAsis, evaluacion: hasEval, acta: hasActa, actaComp: hasActaComp, informeOk, validado: validadoOk },
          _stages,
          _scores: { docScore, infoScore }
        }
      })

      setAuditorias(merged)
    } catch (e) {
      console.error(e)
      setError(e.message || 'Error cargando datos')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const years = useMemo(() => {
    const s = new Set()
    auditorias.forEach(a => { const d = parseYMD(a.fecha_auditoria); if (d) s.add(d.getFullYear()) })
    return Array.from(s).sort((a, b) => a - b)
  }, [auditorias])

  useAnioInicial(years, (anio) => setSelectedYear(String(anio)), { sinDatos: '' })

  const filtered = useMemo(() => {
    if (!selectedYear) return auditorias
    return auditorias.filter(a => {
      const d = parseYMD(a.fecha_auditoria)
      return d && String(d.getFullYear()) === String(selectedYear)
    })
  }, [auditorias, selectedYear])

  /* ===== agregación por dependencia + orden por completitud promedio ===== */
  const matrix = useMemo(() => {
    const today = startOfDay(new Date())
    const m = new Map()

    // Recolecta items por dependencia
    for (const a of filtered) {
      const depId = a.dependencia_id ?? 'SIN_DEP'
      const depName = a?.dependencias?.nombre || 'Sin dependencia'
      if (!m.has(depId)) {
        m.set(depId, { depId, depName, items: [] })
      }
      m.get(depId).items.push(a)
    }

    // Agrega métricas agregadas + % avance + tooltips
    const cols = DOCUMENTOS_MALLA.map((d) => d.key)
    const list = Array.from(m.values()).map(row => {
      const total = row.items.length
      const agg = {}
      let sumDone = 0

      for (const key of cols) {
        let done = 0, overdue = 0, pending = 0, tardios = 0
        let nextDue = null, lastDelivered = null
        // Qué auditorías concretas lo tienen pendiente, para poder avisar a
        // sus auditores desde la propia celda.
        const pendientes = []

        for (const a of row.items) {
          const st = a._stages?.[key]
          if (!st) continue
          if (st.delivered) {
            done++
            if (st.late) tardios++
            if (st.deliveredAt && (!lastDelivered || st.deliveredAt > lastDelivered)) {
              lastDelivered = st.deliveredAt
            }
          } else {
            pending++
            pendientes.push(a.id)
            if (st.due) {
              if (st.due < today) overdue++
              if (st.due >= today && (!nextDue || st.due < nextDue)) nextDue = st.due
            }
          }
        }

        sumDone += done
        agg[key] = { done, total, overdue, pending, tardios, pendientes, nextDue, lastDelivered }
      }

      const completion = total ? (sumDone / (total * cols.length)) : 0
      return { depId: row.depId, depName: row.depName, total, completion, _agg: agg }
    })

    // Orden por menor completitud (para identificar rápidamente lo que falta)
    return list.sort((a, b) => (a.completion - b.completion) || a.depName.localeCompare(b.depName))
  }, [filtered])

  /* ===== KPIs globales ===== */
  // Se cuentan recorriendo `DOCUMENTOS_MALLA` y no con una lista escrita a
  // mano: así una columna nueva aparece en su tarjeta sola, y no puede pasar
  // que la tarjeta exista y se quede a cero porque nadie la sumó.
  const kpis = useMemo(() => {
    const t = { total: filtered.length }
    for (const { key } of DOCUMENTOS_MALLA) t[key] = 0

    for (const a of filtered) {
      for (const { key } of DOCUMENTOS_MALLA) {
        if (a._flags?.[key]) t[key]++
      }
    }

    const pct = (n) => (t.total ? Math.round((n / t.total) * 100) : 0)
    return { ...t, pct }
  }, [filtered])

  /**
   * Las auditorías de la celda abierta, sacadas del estado y no copiadas.
   *
   * Si el modal se quedara con los objetos de cuando se abrió, al marcar una
   * seguiría mostrando el valor viejo: la lista tiene que mirar al mismo sitio
   * que pinta la malla.
   */
  const destinoEjecucion = useMemo(() => {
    if (!ejecucion) return null
    const ids = new Set(ejecucion.ids)
    return {
      dependencia: ejecucion.dependencia,
      auditorias: filtered.filter((a) => ids.has(a.id)),
    }
  }, [ejecucion, filtered])

  /**
   * Marca o desmarca una auditoría como ejecutada.
   *
   * Se pide la fila de vuelta: bajo RLS un `update` que no encuentra fila que
   * pueda tocar **no da error**, devuelve cero filas, y sin comprobarlo el
   * fallo sería invisible —la celda cambiaría y la base no—.
   *
   * Al guardar se parchea el estado en lugar de recargar: una recarga volvería
   * a listar los seis buckets para un booleano.
   */
  const marcarEjecutada = async (auditoria, ejecutada) => {
    const cuando = ejecutada ? new Date().toISOString() : null

    const { data, error } = await supabase
      .from('informes_auditoria')
      .update({ ejecutada, ejecutada_at: cuando })
      .eq('id', auditoria.id)
      .select('id')

    if (error) {
      toast.error(`No se pudo guardar: ${error.message}`)
      return
    }

    if (!data?.length) {
      toast.error(
        `No se pudo marcar la auditoría #${auditoria.id}: la base no aceptó el cambio.`
      )
      return
    }

    setAuditorias((prev) =>
      prev.map((a) =>
        a.id === auditoria.id
          ? {
              ...a,
              ejecutada,
              ejecutada_at: cuando,
              _flags: { ...a._flags, ejecutada },
              _stages: {
                ...a._stages,
                ejecutada: {
                  ...a._stages?.ejecutada,
                  delivered: ejecutada,
                  deliveredAt: cuando ? new Date(cuando) : null,
                },
              },
            }
          : a
      )
    )
  }

  const exportar = async () => {
    setExportando(true)
    try {
      await exportarMallaControl({
        documentos: DOCUMENTOS_MALLA,
        matriz: matrix,
        auditorias: filtered,
        anio: selectedYear,
      })
    } finally {
      setExportando(false)
    }
  }

  return (
    <div className={PAGE_SHELL}>
      <PageHeader
        title="Centro de Control de Auditorías"
        subtitle="Monitoreo en tiempo real del estado de todas las auditorías"
        actions={
          <div className="flex items-center gap-2">
            <Select
              value={selectedYear || 'todos'}
              onValueChange={(v) => setSelectedYear(v === 'todos' ? '' : v)}
            >
              <SelectTrigger className="w-44 border-white/25 bg-white/15 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los años</SelectItem>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              onClick={exportar}
              disabled={loading || exportando || !filtered.length}
              title="Descargar la malla en Excel: avance por dependencia y fechas de cada auditoría"
              className="bg-white/15 text-white shadow-none backdrop-blur-sm hover:bg-white/25"
            >
              <Download />
              {exportando ? 'Generando…' : 'Excel'}
            </Button>

            <Button
              size="icon"
              onClick={loadData}
              title="Recargar datos"
              className="bg-white/15 text-white shadow-none backdrop-blur-sm hover:bg-white/25"
            >
              <RefreshCw className={loading ? 'animate-spin' : undefined} />
              <span className="sr-only">Recargar datos</span>
            </Button>
          </div>
        }
      />

      {/* KPIs.
          Van en el mismo orden que las columnas de la malla —salen los dos de
          `DOCUMENTOS_MALLA`—, así la tercera tarjeta es la tercera columna.

          La escalera de columnas llega a ocho solo en 2xl (1536 px). Antes
          saltaba a ocho en xl (1280): en un portátil de 1366 eso dejaba 127 px
          por tarjeta y las etiquetas largas se salían. */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 2xl:grid-cols-9">
        {TARJETAS.map(({ key, label, tono, sinPorcentaje }) => (
          <InfoCard
            key={key}

            label={label}
            tone={tono}
            value={kpis[key]}
            total={sinPorcentaje ? undefined : kpis.total}
            percent={sinPorcentaje ? undefined : kpis.pct(kpis[key])}
            hint={sinPorcentaje ? 'En el periodo seleccionado' : undefined}
          />
        ))}
      </section>

      {/* Malla de control por dependencia */}
      <section className={cn(SECTION_CARD, 'overflow-hidden')}>
        <header className="border-b border-border p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <LayoutGrid className="h-4 w-4 text-primary" aria-hidden="true" />
            Malla de control por dependencia
          </h3>

        </header>

        {loading && (
          <Cargando mensaje="Cargando datos…" />
        )}

        {error && (
          <div className="m-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <strong>Error al cargar los datos</strong>
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && matrix.length === 0 && (
          <p className="p-8 text-center text-sm text-muted-foreground">
            No hay resultados para el filtro seleccionado.
          </p>
        )}

        {!loading && !error && matrix.length > 0 && (
          <div className="overflow-x-auto">
            <div className="min-w-[1200px]">
              {/* Cabecera.
                  La celda fija llevaba `bg-muted/60`, translúcido: al
                  desplazar, las columnas de debajo se veían a través del
                  nombre de la dependencia. Va opaca, con `bg-muted` sobre el
                  fondo de la tarjeta, y con borde derecho para que se lea como
                  una columna anclada y no como un solape. */}
              <div className={cn(REJILLA, 'border-b border-border bg-muted/60')}>
                <div className="sticky left-0 z-20 border-r border-border bg-muted px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Dependencia
                </div>
                <div className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Avance
                </div>
                {COLUMNAS.map((col) => (
                  <div
                    key={col.key}
                    className={cn(
                      'py-2.5 text-center font-semibold uppercase tracking-wide text-muted-foreground',
                      col.manual ? 'px-1 text-[0.65rem]' : 'px-2 text-xs'
                    )}
                  >
                    {col.title}
                  </div>
                ))}
              </div>

              {/* Filas */}
              {matrix.map((row) => {
                const pct = Math.round(row.completion * 100)

                return (
                  <div
                    key={row.depId}
                    className={cn(
                      REJILLA,
                      'border-b border-border transition-colors last:border-0 hover:bg-muted/40'
                    )}
                  >
                    {/* `group-hover` no vale aquí: al fijar la columna hay que
                        repintar su fondo, y `hover:bg-muted/40` de la fila no
                        la alcanza porque este fondo es opaco y va encima. */}
                    <div className="sticky left-0 z-10 flex flex-col justify-center border-r border-border bg-card px-3 py-2.5">
                      <span className="text-sm font-medium leading-tight">{row.depName}</span>
                      <span className="text-xs text-muted-foreground">
                        {row.total} {row.total === 1 ? 'auditoría' : 'auditorías'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 px-3 py-2.5">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn('h-full rounded-full transition-[width] duration-500', progressColorClass(pct))}
                          style={{ width: `${pct}%` }}
                          aria-label={`Avance ${pct}%`}
                        />
                      </div>
                      <span className="text-xs font-semibold tabular-nums">{pct}%</span>
                    </div>

                    {COLUMNAS.map((col) => {
                      const ag = row._agg[col.key] || {
                        done: 0,
                        total: row.total,
                        overdue: 0,
                        pending: 0,
                        pendientes: [],
                        nextDue: null,
                        lastDelivered: null,
                      }
                      const localPct = ag.total ? Math.round((ag.done / ag.total) * 100) : 0
                      const tip = buildTooltip(col.title, ag, col.manual)

                      // El reloj marca la entrega que llegó fuera de plazo; el
                      // visto, la que llegó a tiempo.
                      let dateInfo = ''
                      if (ag.lastDelivered) dateInfo = `${ag.tardios ? '⏱' : '✓'} ${fmt(ag.lastDelivered)}`
                      else if (ag.nextDue) dateInfo = `⏰ ${fmt(ag.nextDue)}`

                      // La campana solo aparece donde hay algo que reclamar y
                      // existe un documento que reclamar.
                      const puedeAvisar = Boolean(
                        ALERTA_POR_COLUMNA[col.key] && ag.pendientes?.length
                      )

                      // «Ejecutada» no se reclama, se marca; y se puede
                      // desmarcar, así que la celda es pulsable aunque esté
                      // completa. Sin la columna en la base no hay nada que
                      // guardar y no se ofrece.
                      const puedeMarcar = col.key === 'ejecutada' && !sinColumnaEjecucion

                      return (
                        <div
                          key={col.key}
                          title={tip}
                          aria-label={tip}
                          className={cn(
                            'group relative m-1 flex flex-col items-center justify-center rounded-lg text-center',
                            col.manual
                              ? ['px-0.5 py-1.5', claseControl(ag)]
                              : ['px-1 py-2', heatClass(localPct, ag.tardios)]
                          )}
                        >
                          <span
                            className={cn(
                              'font-bold tabular-nums',
                              col.manual ? 'text-xs' : 'text-sm'
                            )}
                          >
                            {ag.done}/{ag.total}
                          </span>

                          {/* La columna de control no lleva porcentaje ni
                              fecha: con 72 px no caben, y las dos cosas están
                              en el tooltip. Es parte de que se vea más
                              pequeña que las de documentos. */}
                          {!col.manual && (
                            <>
                              <span className="text-[0.7rem] font-semibold tabular-nums opacity-80">
                                {localPct}%
                              </span>
                              {dateInfo && (
                                <span className="mt-0.5 text-[0.65rem] opacity-75">{dateInfo}</span>
                              )}
                            </>
                          )}

                          {/* La campana tapa la celda entera, no una esquina:
                              así se ve desde lejos cuál se puede reclamar y no
                              hay que acertarle a un icono de catorce píxeles. */}
                          {puedeAvisar && (
                            <button
                              type="button"
                              onClick={() =>
                                setAviso({
                                  proceso_key: ALERTA_POR_COLUMNA[col.key],
                                  label: col.title,
                                  dependencia: row.depName,
                                  informe_ids: ag.pendientes,
                                })
                              }
                              title={`Avisar de ${col.title.toLowerCase()} pendiente (${ag.pendientes.length})`}
                              aria-label={`Avisar de ${col.title.toLowerCase()} pendiente en ${row.depName}: ${ag.pendientes.length} auditoría(s)`}
                              className={cn(
                                'absolute inset-0 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg',
                                // El velo deja intuir el número que hay debajo
                                // y mantiene legible el texto de la celda.
                                'bg-background/85 opacity-0 transition-opacity',
                                'hover:bg-background focus-visible:opacity-100 group-hover:opacity-100'
                              )}
                            >
                              <BellRing className="h-4 w-4" aria-hidden="true" />
                              <span
                                className="text-[0.65rem] font-semibold leading-none"
                                aria-hidden="true"
                              >
                                Avisar{ag.pendientes.length > 1 ? ` (${ag.pendientes.length})` : ''}
                              </span>
                            </button>
                          )}

                          {puedeMarcar && (
                            <button
                              type="button"
                              onClick={() =>
                                setEjecucion({
                                  dependencia: row.depName,
                                  ids: filtered
                                    .filter((a) => (a.dependencia_id ?? 'SIN_DEP') === row.depId)
                                    .map((a) => a.id),
                                })
                              }
                              title={`Marcar qué auditorías de ${row.depName} se ejecutaron (${ag.done} de ${ag.total})`}
                              aria-label={`Marcar auditorías ejecutadas en ${row.depName}: ${ag.done} de ${ag.total}`}
                              className={cn(
                                'absolute inset-0 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg',
                                'bg-background/85 opacity-0 transition-opacity',
                                'hover:bg-background focus-visible:opacity-100 group-hover:opacity-100'
                              )}
                            >
                              <ClipboardCheck className="h-3.5 w-3.5" aria-hidden="true" />
                              <span
                                className="text-[0.6rem] font-semibold leading-none"
                                aria-hidden="true"
                              >
                                Marcar
                              </span>
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {!loading && !error && matrix.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border px-4 py-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-amber-200" aria-hidden="true" />
              Entregado fuera de plazo
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-emerald-100" aria-hidden="true" />
              Completo y a tiempo
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-slate-50 ring-1 ring-inset ring-border" aria-hidden="true" />
              Sin entregar
            </span>
            <span>✓ entrega a tiempo · ⏱ entrega tardía · ⏰ próximo vencimiento</span>
            <span className="flex items-center gap-1.5">
              <span
                className="h-3 w-3 rounded border border-dashed border-emerald-400 bg-emerald-50"
                aria-hidden="true"
              />
              «Ejecutada»: control manual, pasa el ratón por la celda para marcarla
            </span>
          </div>
        )}
      </section>

      {sinColumnaEjecucion && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
          La columna «Ejecutada» todavía no existe en la base, así que sale en cero y no se puede
          marcar. Ejecuta <code className="font-mono">sql/ejecucion-auditorias.sql</code> y recarga.
        </p>
      )}

      <ModalEjecucion
        destino={destinoEjecucion}
        onClose={() => setEjecucion(null)}
        onMarcar={marcarEjecutada}
      />

      <ModalAvisoPendientes
        open={Boolean(aviso)}
        onOpenChange={(abierto) => (abierto ? null : setAviso(null))}
        destino={aviso}
        onPrevisualizar={({ proceso_key, informe_ids }) =>
          avisarPendientes({ proceso_key, informe_ids })
        }
        onEnviar={async ({ proceso_key, informe_ids }) => {
          try {
            const res = await avisarPendientes({ proceso_key, informe_ids, enviar: true })

            if (res.enviados) {
              toast.success(`${res.enviados} aviso(s) enviado(s).`)
            } else {
              toast.info('No se envió ningún aviso.')
            }
            if (res.fallidos?.length) {
              toast.warning(`${res.fallidos.length} no se pudieron enviar.`)
            }

            // Se recarga para que la celda refleje el aviso ya mandado.
            await loadData()
            return true
          } catch (err) {
            toast.error(`No se pudo avisar: ${err.message}`)
            return false
          }
        }}
      />
    </div>
  )
}

/* ===== Subcomponentes UI ===== */

/**
 * Color de fondo de una celda del heatmap.
 *
 * Una entrega fuera de plazo manda sobre el porcentaje: es lo que hay que ver
 * de un vistazo y, pintada de verde por estar completa, se perdía entre las
 * demás. El mismo ámbar que usa «Envío tardío» en la línea de trabajo.
 */
/**
 * Color de la celda de «Ejecutada».
 *
 * No usa el degradado del heatmap a propósito: no es una entrega que avance
 * poco a poco, es un sí, un no o un «a medias» cuando la dependencia tiene
 * varias auditorías. El borde discontinuo es la pista de que es lo único de la
 * malla que se escribe a mano.
 */
function claseControl({ done, total }) {
  const base = 'border border-dashed'
  if (!total) return `${base} border-border bg-background text-muted-foreground`
  if (done === total) return `${base} border-emerald-400 bg-emerald-50 text-emerald-800`
  if (done > 0) return `${base} border-amber-400 bg-amber-50 text-amber-800`
  return `${base} border-border bg-background text-muted-foreground`
}

function heatClass(pct, tardios = 0) {
  if (tardios > 0) return 'bg-amber-200 text-amber-900'
  if (pct >= 90) return 'bg-emerald-100 text-emerald-900'
  if (pct >= 70) return 'bg-green-200 text-green-900'
  if (pct >= 50) return 'bg-blue-200 text-blue-900'
  if (pct >= 25) return 'bg-blue-100 text-blue-900'
  if (pct > 0) return 'bg-sky-50 text-sky-900'
  return 'bg-slate-50 text-slate-500'
}

/** Color de la barra de avance de una dependencia. */
function progressColorClass(pct) {
  if (pct >= 90) return 'bg-gradient-to-r from-emerald-500 to-emerald-600'
  if (pct >= 70) return 'bg-gradient-to-r from-[#667eea] to-[#764ba2]'
  if (pct >= 50) return 'bg-gradient-to-r from-amber-500 to-amber-600'
  if (pct >= 25) return 'bg-gradient-to-r from-orange-400 to-orange-500'
  return 'bg-gradient-to-r from-red-500 to-red-600'
}

function buildTooltip(title, ag, manual = false) {
  const parts = []
  parts.push(`${title}: ${ag.done}/${ag.total}`)
  if (typeof ag.pending === 'number') parts.push(`${manual ? 'Sin marcar' : 'Pendientes'}: ${ag.pending}`)
  if (typeof ag.overdue === 'number') parts.push(`Vencidos: ${ag.overdue}`)
  if (ag.tardios) parts.push(`Fuera de plazo: ${ag.tardios}`)
  if (ag.nextDue) parts.push(`${manual ? 'Próxima auditoría' : 'Próximo límite'}: ${fmt(ag.nextDue)}`)
  // «Última» solo cuando la celda resume más de una auditoría; con una sola,
  // decir «última» hacía dudar de si había otra entrega escondida.
  if (ag.lastDelivered) {
    const etiqueta = manual
      ? ag.total > 1 ? 'Última marca' : 'Marcada'
      : ag.total > 1 ? 'Última entrega' : 'Entregado'
    parts.push(`${etiqueta}: ${fmt(ag.lastDelivered)}`)
  }
  return parts.join(' · ')
}
