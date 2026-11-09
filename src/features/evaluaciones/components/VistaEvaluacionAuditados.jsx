'use client'

/**
 * Evaluación de auditados: el auditor valora el proceso que auditó.
 *
 * Una evaluación por auditoría. La misma pantalla sirve a los dos paneles:
 *
 * - el auditor ve solo sus auditorías y diligencia la de cada una;
 * - administración (`todas`) ve las de todos, con el auditor de cada una, y
 *   puede abrir y corregir cualquiera.
 *
 * El auditor ve una tarjeta por auditoría, con filtros por estado. La de
 * administración se presenta como el Dashboard de Auditores: tarjetas de
 * resumen, gráficas y una tabla con la nota de cada pregunta, donde el estado
 * va en su propia columna.
 *
 * No se puede evaluar hasta que el informe está diligenciado: la cabecera de
 * la evaluación sale de él (fecha, dependencia), y valorar cómo se portó el
 * proceso antes de haber cerrado el informe es valorar a medias. La fila dice
 * entonces qué campos del informe faltan, en vez de un botón apagado sin
 * explicación.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ClipboardList, Download, Lock, PencilLine, RefreshCw } from 'lucide-react'
import { toast } from 'react-toastify'
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { supabase } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { anioDe, formatearDia } from '@/lib/fechas'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ExportableChartCard } from '@/components/ui/chart-card'
import { Field, FieldGrid } from '@/components/ui/field'
import { FormDrawer } from '@/components/ui/form-drawer'
import { FormSection } from '@/components/ui/form-section'
import { InfoCard } from '@/components/ui/info-card'
import { Input, Textarea } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Cargando } from '@/components/ui/loader'
import { HeaderStat, PageHeader } from '@/components/ui/page-header'
import { SearchInput } from '@/components/ui/search-input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  EMPTY_STATE,
  FILTER_PILL_ACTIVE,
  FILTER_PILL_BASE,
  FILTER_PILL_INACTIVE,
  FILTER_PILLS_CONTAINER,
  PAGE_SHELL,
  SECTION_CARD,
  STATUS_BADGE_TONES,
  TABLE_CONTAINER,
  TABLE_TOOLBAR,
} from '@/components/ui/tokens'

import {
  ASPECTOS,
  COLUMNAS_EVALUACION,
  ESCALA,
  GUIA_OBSERVACIONES,
  INTRODUCCION,
  OBJETIVO,
  aFila,
  aFormulario,
  distribucionDeValoraciones,
  estadoEvaluacion,
  etiquetaDeNota,
  faltantesDelInforme,
  procesoDelPrograma,
  promedioEvaluacion,
  promedioGeneral,
  promedioPorAspecto,
  validarEvaluacion,
} from '@/features/evaluaciones/lib/evaluacion-auditados'
import { exportarConsolidadoAuditados } from '@/features/evaluaciones/lib/exportar-excel'

/** Orden de la tabla: primero lo que hay que hacer. */
const ESTADOS = {
  pendiente: { etiqueta: 'Por diligenciar', tono: 'warning', orden: 0 },
  bloqueada: { etiqueta: 'Informe sin diligenciar', tono: 'neutral', orden: 1 },
  diligenciada: { etiqueta: 'Diligenciada', tono: 'success', orden: 2 },
}

/** PostgREST responde así cuando la tabla todavía no existe en la base. */
const esTablaInexistente = (error) =>
  error?.code === '42P01' ||
  error?.code === 'PGRST205' ||
  /evaluaciones_auditados/.test(error?.message ?? '')

const nombreDe = (usuario) =>
  [usuario?.nombre, usuario?.apellido].filter(Boolean).join(' ').trim()

const formatoNota = (valor) => (typeof valor === 'number' ? valor.toFixed(1) : '—')

/**
 * @param {Object} props
 * @param {Object} props.usuario
 * @param {boolean} [props.todas]  Administración: todas las auditorías
 */
export default function VistaEvaluacionAuditados({ usuario, todas = false }) {
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [informes, setInformes] = useState([])
  /** Evaluaciones guardadas, por `informe_id`. */
  const [evaluaciones, setEvaluaciones] = useState(() => new Map())
  /** Proceso del programa sugerido para cada auditoría, por id. */
  const [procesos, setProcesos] = useState(() => new Map())

  const [anio, setAnio] = useState('todos')
  const [busqueda, setBusqueda] = useState('')
  const [abiertoId, setAbiertoId] = useState(null)

  /* ── Carga ── */

  const cargar = useCallback(async () => {
    if (!todas && !usuario?.usuario_id) {
      setError('Sesión no disponible. Vuelve a iniciar sesión.')
      setCargando(false)
      return
    }

    setCargando(true)
    setError(null)

    try {
      let consulta = supabase
        .from('informes_auditoria')
        .select(
          `
            id, fecha_auditoria, objetivo, criterios, conclusiones, recomendaciones,
            usuario_id, programa_auditoria_id,
            dependencias ( nombre )
            ${todas ? ', usuarios:usuario_id ( nombre, apellido )' : ''}
          `
        )
        .order('fecha_auditoria', { ascending: false, nullsFirst: false })

      if (!todas) consulta = consulta.eq('usuario_id', usuario.usuario_id)

      // Sin filtro por informe: RLS ya limita al auditor a las suyas, y al
      // administrador pedirlas por id le obligaría a mandar cientos en la URL.
      const [resInformes, resEvaluaciones] = await Promise.all([
        consulta,
        supabase.from('evaluaciones_auditados').select(COLUMNAS_EVALUACION),
      ])

      if (resInformes.error) throw resInformes.error
      if (resEvaluaciones.error) {
        if (esTablaInexistente(resEvaluaciones.error)) {
          throw new Error(
            'La tabla de evaluaciones de auditados no existe o está desactualizada. Hay que ejecutar sql/evaluacion-auditados.sql en Supabase.'
          )
        }
        throw resEvaluaciones.error
      }

      const filas = resInformes.data ?? []
      setInformes(filas)
      setEvaluaciones(new Map((resEvaluaciones.data ?? []).map((e) => [e.informe_id, e])))

      // El proceso sale solo de la dependencia y no es requisito: si el
      // cronograma no se puede leer, queda en blanco y la pantalla sigue. Del
      // programa más reciente al más antiguo, para que las auditorías creadas
      // a mano tomen el proceso vigente.
      const { data: cronograma, error: errorCronograma } = await supabase
        .from('programa_auditoria_cronograma')
        .select('programa_id, proceso, dependencias:programa_auditoria_cronograma_dependencias ( auditado )')
        .order('programa_id', { ascending: false })

      if (errorCronograma) {
        console.warn('No se pudo leer el cronograma para deducir el proceso:', errorCronograma)
      } else {
        setProcesos(new Map(filas.map((f) => [f.id, procesoDelPrograma(f, cronograma ?? [])])))
      }
    } catch (e) {
      console.error(e)
      setError(e.message || 'No se pudieron cargar las auditorías.')
    } finally {
      setCargando(false)
    }
  }, [todas, usuario?.usuario_id])

  useEffect(() => {
    cargar()
  }, [cargar])

  /* ── Derivados ── */

  const anios = useMemo(
    () =>
      [...new Set(informes.map((i) => anioDe(i.fecha_auditoria)).filter(Boolean))].sort(
        (a, b) => b - a
      ),
    [informes]
  )

  /**
   * Las filas del año elegido. Las tarjetas y las gráficas salen de aquí; la
   * búsqueda solo filtra la tabla, para que escribir un nombre no cambie los
   * totales de arriba.
   */
  const delAnio = useMemo(
    () =>
      informes
        .filter((i) => anio === 'todos' || anioDe(i.fecha_auditoria) === Number(anio))
        .map((informe) => {
          const evaluacion = evaluaciones.get(informe.id) ?? null
          return { informe, evaluacion, estado: estadoEvaluacion(informe, evaluacion) }
        }),
    [informes, evaluaciones, anio]
  )

  const resumen = useMemo(() => {
    const hechas = delAnio.map((f) => f.evaluacion).filter(Boolean)
    const pendientes = delAnio.filter((f) => f.estado === 'pendiente').length

    return {
      total: delAnio.length,
      diligenciadas: hechas.length,
      pendientes,
      promedio: promedioGeneral(hechas),
      porAspecto: promedioPorAspecto(hechas),
      distribucion: distribucionDeValoraciones(hechas),
    }
  }, [delAnio])

  const filasTabla = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()

    return delAnio
      .filter(({ informe }) =>
        !texto
          ? true
          : [`#${informe.id}`, informe.dependencias?.nombre, nombreDe(informe.usuarios)]
              .filter(Boolean)
              .some((s) => s.toLowerCase().includes(texto))
      )
      .sort((a, b) => ESTADOS[a.estado].orden - ESTADOS[b.estado].orden)
  }, [delAnio, busqueda])

  const abierto = delAnio.find(({ informe }) => informe.id === abiertoId) ?? null

  /** ID, dependencia, fecha, las preguntas, promedio, estado y acción. */
  const columnas = (todas ? 1 : 0) + 3 + ASPECTOS.length + 3

  /** Lo del año elegido, sin la búsqueda: el consolidado es del año entero. */
  const descargarConsolidado = () =>
    exportarConsolidadoAuditados({
      filas: delAnio.map(({ informe, evaluacion, estado }) => ({
        informe,
        evaluacion,
        proceso: evaluacion?.proceso_auditado || procesos.get(informe.id) || '',
        auditor: nombreDe(informe.usuarios),
        estado: ESTADOS[estado].etiqueta,
      })),
    })

  /* ── Render ── */

  return (
    <div className={PAGE_SHELL}>
      {!todas ? (
        // El auditor no tiene selector de año, así que `delAnio` son todas.
        <ListaDelAuditor
          filas={delAnio}
          cargando={cargando}
          error={error}
          onRecargar={cargar}
          onAbrir={setAbiertoId}
        />
      ) : (
        <>
          <PageHeader
            eyebrow="Encuesta por auditoría"
            title="Evaluación de Auditados"
            subtitle="Valoración que cada auditor hace del proceso que auditó, pregunta por pregunta."
          />

          <div className={cn(SECTION_CARD, 'flex flex-wrap items-end gap-3 p-4')}>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Buscar</Label>
              <SearchInput
                value={busqueda}
                onChange={setBusqueda}
                placeholder={todas ? 'Dependencia, auditor o #…' : 'Dependencia o #…'}
                className="sm:w-64"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="eval-auditados-anio" className="text-xs text-muted-foreground">
                Año
              </Label>
              <Select value={anio} onValueChange={setAnio} disabled={!anios.length}>
                <SelectTrigger id="eval-auditados-anio" className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los años</SelectItem>
                  {anios.map((a) => (
                    <SelectItem key={a} value={String(a)}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              variant="outline"
              onClick={descargarConsolidado}
              disabled={cargando || !delAnio.length}
              title={
                anio === 'todos'
                  ? 'Descarga un Excel con una hoja por cada año'
                  : `Descarga el Excel del año ${anio}`
              }
              className="ml-auto"
            >
              <Download />
              {anio === 'todos' ? 'Descargar consolidado' : `Descargar consolidado ${anio}`}
            </Button>

            <Button
              variant="outline"
              size="icon"
              onClick={cargar}
              disabled={cargando}
              title="Recargar"
            >
              <RefreshCw className={cn(cargando && 'animate-spin')} />
            </Button>
          </div>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          )}

          {cargando ? (
            <div className="rounded-lg border border-border bg-card">
              <Cargando mensaje="Cargando evaluaciones…" />
            </div>
          ) : (
            !error && (
              <>
                <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <InfoCard tone="blue" label="Auditorías" value={resumen.total} />
                  <InfoCard
                    tone="green"
                    label="Diligenciadas"
                    value={resumen.diligenciadas}
                    total={resumen.total}
                    percent={resumen.total ? (resumen.diligenciadas / resumen.total) * 100 : 0}
                  />
                  <InfoCard tone="purple" label="Por diligenciar" value={resumen.pendientes} />
                  <InfoCard
                    tone="teal"
                    label="Promedio general"
                    value={formatoNota(resumen.promedio)}
                    hint={resumen.promedio != null ? etiquetaDeNota(resumen.promedio) : 'Sin evaluaciones'}
                  />
                </section>

                <section className="grid gap-4 xl:grid-cols-2">
                  <ExportableChartCard
                    title="Promedio por pregunta"
                    downloadName="evaluacion-auditados-por-pregunta"
                  >
                    {(Tip) => (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={resumen.porAspecto} margin={{ top: 20, right: 8, bottom: 0, left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="pregunta" />
                          <YAxis width={35} domain={[0, 5]} />
                          <Tooltip content={<Tip formatter={formatoNota} />} />
                          <Bar dataKey="promedio" fill="#6387d6" radius={[6, 6, 0, 0]}>
                            <LabelList dataKey="promedio" position="top" formatter={formatoNota} />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </ExportableChartCard>

                  <ExportableChartCard
                    title="Cuántas veces se marcó cada valoración"
                    downloadName="evaluacion-auditados-valoraciones"
                  >
                    {(Tip) => (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={resumen.distribucion} margin={{ top: 20, right: 8, bottom: 0, left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="valoracion" />
                          <YAxis width={35} allowDecimals={false} />
                          <Tooltip content={<Tip />} />
                          <Bar dataKey="veces" fill="#b2a9ff" radius={[6, 6, 0, 0]}>
                            <LabelList dataKey="veces" position="top" />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </ExportableChartCard>
                </section>

                <section className={TABLE_CONTAINER}>
                  <div className={TABLE_TOOLBAR}>
                    <h3 className="text-sm font-semibold">Detalle por auditoría</h3>
                    <p className="text-xs text-muted-foreground">
                      Valoración de 1 (deficiente) a 5 (excelente). Pasa el cursor por P1…P
                      {ASPECTOS.length} para ver la pregunta.
                    </p>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-20">ID</TableHead>
                        <TableHead className="min-w-48">Dependencia</TableHead>
                        {todas && <TableHead className="min-w-40">Auditor</TableHead>}
                        <TableHead className="w-28">Fecha</TableHead>
                        {ASPECTOS.map((aspecto, i) => (
                          <TableHead
                            key={aspecto.clave}
                            title={aspecto.titulo}
                            className="w-12 cursor-help text-center"
                          >
                            P{i + 1}
                          </TableHead>
                        ))}
                        <TableHead className="text-right">Promedio</TableHead>
                        <TableHead className="w-40">Estado</TableHead>
                        <TableHead className="w-44" />
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {filasTabla.length === 0 ? (
                        <TableEmpty colSpan={columnas}>
                          {delAnio.length === 0
                            ? todas
                              ? 'No hay auditorías para el año seleccionado.'
                              : 'No tienes auditorías asignadas para el año seleccionado.'
                            : 'Ninguna auditoría coincide con la búsqueda.'}
                        </TableEmpty>
                      ) : (
                        filasTabla.map((fila) => (
                          <FilaAuditoria
                            key={fila.informe.id}
                            {...fila}
                            mostrarAuditor={todas}
                            onAbrir={() => setAbiertoId(fila.informe.id)}
                          />
                        ))
                      )}
                    </TableBody>
                  </Table>

                  {/* La pregunta completa de cada columna, para quien no use ratón. */}
                  <ol className="grid gap-x-6 gap-y-1 border-t border-border px-4 py-3 text-xs text-muted-foreground sm:grid-cols-2">
                    {ASPECTOS.map((aspecto, i) => (
                      <li key={aspecto.clave}>
                        <span className="font-semibold text-foreground">P{i + 1}</span> ·{' '}
                        {aspecto.titulo}
                      </li>
                    ))}
                  </ol>
                </section>
              </>
            )
          )}
        </>
      )}

      {abierto && abierto.estado !== 'bloqueada' && (
        <FormularioEvaluacion
          // Una instancia por auditoría: el formulario se rellena al montar.
          key={abierto.informe.id}
          informe={abierto.informe}
          evaluacion={abierto.evaluacion}
          procesoSugerido={procesos.get(abierto.informe.id) ?? ''}
          mostrarAuditor={todas}
          onCerrar={() => setAbiertoId(null)}
          onGuardada={(guardada) => {
            setEvaluaciones((prev) => new Map(prev).set(guardada.informe_id, guardada))
            setAbiertoId(null)
          }}
        />
      )}
    </div>
  )
}

/* ── Vista del auditor: una tarjeta por auditoría ── */

const FILTROS = [
  { clave: 'todas', etiqueta: 'Todas' },
  { clave: 'pendiente', etiqueta: 'Por diligenciar' },
  { clave: 'diligenciada', etiqueta: 'Diligenciadas' },
  { clave: 'bloqueada', etiqueta: 'Informe sin diligenciar' },
]

/**
 * Lo que ve el auditor: sus auditorías como tarjetas, con lo que tiene que
 * hacer en cada una. El tablero con las notas por pregunta es de
 * administración; al auditor le basta con saber qué le falta.
 */
function ListaDelAuditor({ filas, cargando, error, onRecargar, onAbrir }) {
  const [filtro, setFiltro] = useState('todas')
  const [busqueda, setBusqueda] = useState('')

  const cuenta = useMemo(() => {
    const c = { todas: filas.length, pendiente: 0, diligenciada: 0, bloqueada: 0 }
    filas.forEach(({ estado }) => c[estado]++)
    return c
  }, [filas])

  const visibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()

    return filas.filter(({ informe, estado }) => {
      if (filtro !== 'todas' && estado !== filtro) return false
      if (!texto) return true

      return [`#${informe.id}`, informe.dependencias?.nombre]
        .filter(Boolean)
        .some((s) => s.toLowerCase().includes(texto))
    })
  }, [filas, filtro, busqueda])

  return (
    <>
      <PageHeader
        eyebrow="Encuesta por auditoría"
        title="Evaluación de Auditados"
        subtitle="Valora cómo se preparó y participó el proceso en cada auditoría que tienes asignada. Se habilita cuando el informe de la auditoría está diligenciado."
        stats={
          <>
            <HeaderStat label="Por diligenciar" value={cuenta.pendiente} />
            <HeaderStat label="Diligenciadas" value={cuenta.diligenciada} />
          </>
        }
      />

      <div className={cn(SECTION_CARD, 'flex flex-col gap-4 p-4')}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className={FILTER_PILLS_CONTAINER}>
            {FILTROS.map((f) => (
              <button
                key={f.clave}
                type="button"
                onClick={() => setFiltro(f.clave)}
                className={cn(
                  FILTER_PILL_BASE,
                  filtro === f.clave ? FILTER_PILL_ACTIVE : FILTER_PILL_INACTIVE
                )}
              >
                {f.etiqueta}
                <span className="tabular-nums opacity-80">{cuenta[f.clave]}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <SearchInput value={busqueda} onChange={setBusqueda} placeholder="Dependencia o #…" />
            <Button
              variant="outline"
              size="icon"
              onClick={onRecargar}
              disabled={cargando}
              title="Recargar"
            >
              <RefreshCw className={cn(cargando && 'animate-spin')} />
            </Button>
          </div>
        </div>

        {cargando ? (
          <Cargando mensaje="Cargando auditorías…" />
        ) : error ? (
          <p className={cn(EMPTY_STATE, 'text-destructive')}>{error}</p>
        ) : visibles.length === 0 ? (
          <p className={EMPTY_STATE}>
            {filas.length === 0
              ? 'No tienes auditorías asignadas.'
              : 'Ninguna auditoría coincide con el filtro.'}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {visibles.map((fila) => (
              <TarjetaAuditoria
                key={fila.informe.id}
                {...fila}
                onAbrir={() => onAbrir(fila.informe.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </>
  )
}

function TarjetaAuditoria({ informe, evaluacion, estado, onAbrir }) {
  const tono = ESTADOS[estado]
  const promedio = promedioEvaluacion(evaluacion)
  const faltan = estado === 'bloqueada' ? faltantesDelInforme(informe) : []

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold">
            {informe.dependencias?.nombre || 'Sin dependencia'}
            <span className="ml-2 font-normal text-muted-foreground">#{informe.id}</span>
          </p>
          <span
            className={cn(
              'rounded-full border px-2.5 py-0.5 text-xs font-semibold',
              STATUS_BADGE_TONES[tono.tono]
            )}
          >
            {tono.etiqueta}
          </span>
        </div>

        <p className="text-sm text-muted-foreground">
          {formatearDia(informe.fecha_auditoria) ?? 'Sin fecha'}
          {promedio != null && ` · Promedio ${promedio} (${etiquetaDeNota(promedio)})`}
        </p>

        {estado === 'bloqueada' && (
          <p className="flex items-start gap-1.5 text-sm text-amber-700 dark:text-amber-400">
            <Lock className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Primero debes diligenciar el informe de auditoría. Falta:{' '}
              <strong className="font-semibold">{faltan.join(', ')}</strong>.
            </span>
          </p>
        )}
      </div>

      {estado !== 'bloqueada' && (
        <Button
          variant={estado === 'pendiente' ? 'default' : 'outline'}
          onClick={onAbrir}
          className="shrink-0"
        >
          {estado === 'pendiente' ? <ClipboardList /> : <PencilLine />}
          {estado === 'pendiente' ? 'Diligenciar' : 'Ver o editar'}
        </Button>
      )}
    </li>
  )
}

/* ── Vista de administración: una fila por auditoría ── */

function FilaAuditoria({ informe, evaluacion, estado, mostrarAuditor, onAbrir }) {
  const tono = ESTADOS[estado]
  const promedio = promedioEvaluacion(evaluacion)
  const faltan = estado === 'bloqueada' ? faltantesDelInforme(informe) : []

  return (
    <TableRow>
      <TableCell className="tabular-nums text-muted-foreground">#{informe.id}</TableCell>
      <TableCell className="font-medium">
        {informe.dependencias?.nombre || 'Sin dependencia'}
      </TableCell>
      {mostrarAuditor && (
        <TableCell className="text-muted-foreground">
          {nombreDe(informe.usuarios) || 'Sin auditor'}
        </TableCell>
      )}
      <TableCell className="whitespace-nowrap">
        {formatearDia(informe.fecha_auditoria) ?? '—'}
      </TableCell>

      {ASPECTOS.map((aspecto) => {
        const valor = evaluacion?.[aspecto.clave]

        return (
          <TableCell
            key={aspecto.clave}
            title={
              valor != null
                ? `${aspecto.titulo}: ${ESCALA.find((e) => e.valor === valor)?.etiqueta ?? valor}`
                : aspecto.titulo
            }
            className={cn(
              'text-center font-semibold tabular-nums',
              valor == null && 'text-muted-foreground/60',
              valor != null && valor <= 2 && 'text-red-600 dark:text-red-400'
            )}
          >
            {valor ?? '—'}
          </TableCell>
        )
      })}

      <TableCell className="text-right font-bold tabular-nums text-primary">
        {formatoNota(promedio)}
      </TableCell>

      <TableCell>
        <Badge variant="outline" className={cn('whitespace-nowrap', STATUS_BADGE_TONES[tono.tono])}>
          {tono.etiqueta}
        </Badge>
      </TableCell>

      <TableCell>
        {estado === 'bloqueada' ? (
          <p
            className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400"
            title={`Falta en el informe: ${faltan.join(', ')}`}
          >
            <Lock className="mt-px h-3.5 w-3.5 shrink-0" />
            <span>
              Primero debes diligenciar el informe de auditoría. Falta:{' '}
              <strong className="font-semibold">{faltan.join(', ')}</strong>.
            </span>
          </p>
        ) : (
          <Button
            size="sm"
            variant={estado === 'pendiente' ? 'default' : 'outline'}
            onClick={onAbrir}
          >
            {estado === 'pendiente' ? <ClipboardList /> : <PencilLine />}
            {estado === 'pendiente' ? 'Diligenciar' : 'Ver o editar'}
          </Button>
        )}
      </TableCell>
    </TableRow>
  )
}

/* ── El formulario ── */

function FormularioEvaluacion({
  informe,
  evaluacion,
  procesoSugerido,
  mostrarAuditor,
  onCerrar,
  onGuardada,
}) {
  const [form, setForm] = useState(() => aFormulario(evaluacion, procesoSugerido))
  const [errores, setErrores] = useState({})
  const [guardando, setGuardando] = useState(false)

  const cambiar = (campo, valor) => {
    setForm((prev) => ({ ...prev, [campo]: valor }))
    // El error se va en cuanto se corrige, sin esperar al siguiente envío.
    setErrores((prev) => {
      if (!prev[campo]) return prev
      const resto = { ...prev }
      delete resto[campo]
      return resto
    })
  }

  const guardar = async (e) => {
    e.preventDefault()

    const encontrados = validarEvaluacion(form)
    setErrores(encontrados)
    if (Object.keys(encontrados).length) {
      toast.error('Faltan campos por diligenciar.')
      return
    }

    setGuardando(true)
    try {
      // `.select()` para confirmar contra la base: si RLS deja fuera la fila,
      // el guardado no puede darse por bueno en silencio.
      const { data, error } = await supabase
        .from('evaluaciones_auditados')
        .upsert(aFila(form, informe.id), { onConflict: 'informe_id' })
        .select(COLUMNAS_EVALUACION)
        .maybeSingle()

      if (error) throw error
      if (!data) {
        throw new Error('La base no aceptó la evaluación: puede que tu usuario no tenga permiso.')
      }

      toast.success('Evaluación guardada.')
      onGuardada(data)
    } catch (err) {
      console.error(err)
      toast.error(`No se pudo guardar la evaluación: ${err.message}`)
    } finally {
      setGuardando(false)
    }
  }

  const respondidas = ASPECTOS.filter((a) => form[a.clave] != null).length
  const promedio = promedioEvaluacion(form)

  return (
    <FormDrawer
      open
      onOpenChange={(abierto) => !abierto && onCerrar()}
      title="Evaluación de auditados"
      description={`${informe.dependencias?.nombre || 'Sin dependencia'} · Auditoría #${informe.id}`}
      onSubmit={guardar}
      submitting={guardando}
      submitLabel={evaluacion ? 'Guardar cambios' : 'Guardar evaluación'}
      footerInfo={
        <span className="tabular-nums">
          {respondidas} de {ASPECTOS.length} aspectos
          {respondidas === ASPECTOS.length && promedio != null && ` · promedio ${promedio}`}
        </span>
      }
    >
      <p className="text-sm text-muted-foreground">{INTRODUCCION}</p>

      <FormSection title="Datos de la auditoría">
        <FieldGrid columns={2}>
          <Field label="Fecha" help="Del informe de auditoría.">
            <Input value={formatearDia(informe.fecha_auditoria) ?? ''} readOnly disabled />
          </Field>
          <Field label="Dependencia" help="Del informe de auditoría.">
            <Input value={informe.dependencias?.nombre ?? ''} readOnly disabled />
          </Field>
          <Field
            label="Líder del proceso auditado"
            htmlFor="lider_proceso"
            required
            error={errores.lider_proceso}
          >
            <Input
              id="lider_proceso"
              value={form.lider_proceso}
              onChange={(e) => cambiar('lider_proceso', e.target.value)}
              placeholder="Nombre de quien lidera el proceso"
            />
          </Field>
          {/* No se pide: sale de la dependencia. Sin programa que lo diga, no se muestra. */}
          {form.proceso_auditado && (
            <Field label="Proceso auditado" help="Según la dependencia auditada.">
              <Input value={form.proceso_auditado} readOnly disabled />
            </Field>
          )}
          {mostrarAuditor && (
            <Field label="Auditor" wide>
              <Input value={nombreDe(informe.usuarios)} readOnly disabled />
            </Field>
          )}
        </FieldGrid>
      </FormSection>

      <FormSection
        title="Valoración"
        description="Marca la valoración que corresponda para cada una de las preguntas, según tu criterio (escala de 1 a 5)."
      >
        <p className="text-xs text-muted-foreground">
          <strong className="font-semibold">Objetivo:</strong> {OBJETIVO}
        </p>

        <ol className="flex flex-col gap-3">
          {ASPECTOS.map((aspecto, i) => (
            <PreguntaEscala
              key={aspecto.clave}
              numero={i + 1}
              aspecto={aspecto}
              valor={form[aspecto.clave]}
              error={errores[aspecto.clave]}
              onChange={(v) => cambiar(aspecto.clave, v)}
            />
          ))}
        </ol>
      </FormSection>

      <FormSection title="Observaciones" description={GUIA_OBSERVACIONES} tone="optional">
        <Textarea
          value={form.observaciones}
          onChange={(e) => cambiar('observaciones', e.target.value)}
          rows={4}
          aria-label="Observaciones"
        />
      </FormSection>
    </FormDrawer>
  )
}

/** Un aspecto con sus cinco valoraciones, como botones de opción. */
function PreguntaEscala({ numero, aspecto, valor, error, onChange }) {
  const nombre = `aspecto-${aspecto.clave}`

  return (
    <li
      className={cn(
        'rounded-xl border bg-card p-3',
        error ? 'border-destructive' : 'border-border'
      )}
    >
      <fieldset>
        <legend className="text-sm font-semibold">
          {numero}. {aspecto.titulo}
        </legend>
        <p className="mt-1 text-xs text-muted-foreground">{aspecto.descripcion}</p>

        <div className="mt-3 grid grid-cols-5 gap-1.5">
          {ESCALA.map((opcion) => {
            const elegida = valor === opcion.valor

            return (
              <label
                key={opcion.valor}
                className={cn(
                  'flex cursor-pointer flex-col items-center gap-0.5 rounded-lg border px-1 py-2 text-center transition-colors',
                  'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
                  elegida
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border hover:bg-accent'
                )}
              >
                <input
                  type="radio"
                  name={nombre}
                  value={opcion.valor}
                  checked={elegida}
                  onChange={() => onChange(opcion.valor)}
                  className="sr-only"
                />
                <span className="text-base font-bold tabular-nums">{opcion.valor}</span>
                <span className="text-[0.68rem] font-medium leading-tight sm:text-xs">
                  {opcion.etiqueta}
                </span>
              </label>
            )
          })}
        </div>

        {error && <p className="mt-1.5 text-xs text-destructive">{error}</p>}
      </fieldset>
    </li>
  )
}
