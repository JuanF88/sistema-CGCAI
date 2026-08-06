'use client'

/**
 * Uso de la revisión con IA.
 *
 * Es la contabilidad de un servicio que se paga por token: cuánto se usa,
 * cuánto cuesta en tokens, quién lo usa y qué auditorías van a agotar su cupo.
 *
 * Solo administración. El auditor no ve nada de esto —ni su consumo, ni lo que
 * le queda—: el tope existe para controlar el gasto, no para que cada uno
 * administre una cuota mientras escribe.
 */
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { InfoCard } from '@/components/ui/info-card'
import { ExportableChartCard } from '@/components/ui/chart-card'
import { Skeleton, SkeletonTabla, SkeletonTarjetas } from '@/components/ui/loader'
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EMPTY_STATE, SECTION_CARD, TABLE_CONTAINER, TABLE_TOOLBAR } from '@/components/ui/tokens'
import { cn } from '@/lib/utils'

import { obtenerUsoIA } from '@/features/estadisticas/api/uso-ia-api'

/* Los mismos colores del resto de gráficas del panel. */
const BRAND = '#6387d6'
const GRID_COLOR = 'hsl(var(--border))'
const AXIS_COLOR = 'hsl(var(--muted-foreground))'

/** Cuántas filas se listan por tabla; el resto se resume en el pie. */
const TOPE_FILAS = 15

const numero = (n) => new Intl.NumberFormat('es-CO').format(n ?? 0)

/** 1.842 → «1,8 k»: en una tarjeta el número exacto de tokens no dice más. */
const miles = (n) => (n >= 10_000 ? `${Math.round(n / 1000)} k` : numero(n))

const segundos = (ms) => (ms ? `${(ms / 1000).toFixed(1)} s` : '—')

/**
 * Porcentajes, con los decimales que hagan falta y no más.
 *
 * El panel no enseña dinero en ningún sitio, así que el porcentaje es la única
 * cifra que hay: si se redondea, desaparece. Una revisión son 0,036 % de cinco
 * dólares —a un decimal, «0 %»— y el panel parecía roto justo después de
 * registrar una revisión de verdad.
 *
 * Por debajo de 0,01 % se dice «< 0,01 %» en vez de un cero que no es cierto.
 */
const pct = (n) => {
  if (n === null || n === undefined) return '—'
  if (n > 0 && n < 0.01) return '< 0,01 %'

  const decimales = n >= 10 ? 0 : n >= 1 ? 1 : 2
  return `${new Intl.NumberFormat('es-CO', { maximumFractionDigits: decimales }).format(n)} %`
}

/** «2026-08-06» → «6 ago», que es como se leen los ejes. */
const diaCorto = (fecha) => {
  const [, mes, dia] = String(fecha ?? '').split('-')
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  return mes ? `${Number(dia)} ${meses[Number(mes) - 1] ?? ''}` : fecha
}

const fechaHora = (iso) => {
  if (!iso) return '—'
  const [fecha, resto] = String(iso).split('T')
  return `${diaCorto(fecha)} · ${String(resto ?? '').slice(0, 5)}`
}

export default function VistaUsoIA() {
  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(true)

  const cargar = async () => {
    try {
      setCargando(true)
      setDatos(await obtenerUsoIA())
    } catch (error) {
      toast.error(error.message)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar()
  }, [])

  /** La gráfica es de días, y los días sin uso no existen en los datos. */
  const serie = useMemo(
    () => (datos?.porDia ?? []).map((d) => ({ ...d, etiqueta: diaCorto(d.fecha) })),
    [datos]
  )

  // Esqueleto y no un aro girando: esta pantalla siempre tiene la misma forma
  // —presupuesto, seis tarjetas, gráfica y dos tablas— y dibujarla vacía evita
  // que al llegar los datos salte todo de sitio. Además la consulta pasa por
  // OpenAI, así que son varios segundos mirando algo.
  if (cargando) {
    return (
      <div className="space-y-5" aria-busy="true">
        <Skeleton className="h-32 w-full rounded-xl" />
        <SkeletonTarjetas tarjetas={6} />
        <Skeleton className="h-[21rem] w-full rounded-xl" />
        <SkeletonTabla filas={4} columnas={6} />
        <SkeletonTabla filas={3} columnas={4} />
      </div>
    )
  }

  if (!datos) {
    return (
      <div className={cn(EMPTY_STATE, 'min-h-[40vh]')}>
        No se pudo cargar el uso de la IA.
        <Button variant="outline" size="sm" className="mt-3" onClick={cargar}>
          <RefreshCw />
          Reintentar
        </Button>
      </div>
    )
  }

  const { resumen, veredictos, limite, presupuesto } = datos

  // Una sola cifra: lo que OpenAI factura de toda la cuenta, que es con lo que
  // se decide. La estimación de este sistema no se enseña aquí —competía con
  // la factura y confundía—; sigue viva, pero repartiendo el uso en las tablas.
  const usadoPct = presupuesto.usadoPct
  const disponiblePct = usadoPct === null ? null : Math.max(0, 100 - usadoPct)

  const { facturacion } = presupuesto

  /**
   * De dónde sale la cifra. Se dice siempre: es de la cuenta entera, no solo
   * de este sistema, y puede venir de la caché de cinco minutos.
   */
  const leyendaFuente = !facturacion.disponible
    ? 'No se pudo consultar el gasto en OpenAI.'
    : [
        'Gasto facturado por OpenAI para toda la cuenta',
        '.',
        facturacion.truncado ? ' El periodo real es más corto: la API limita cuánto se puede consultar de una vez.' : '',
        facturacion.viejo ? ' La última consulta falló; esto es lo anterior que sí funcionó.' : '',
      ].join('')
  const sinUso = resumen.revisiones === 0

  const revisiones = resumen.ok + resumen.errores
  const veredictosTotal = veredictos.alineado + veredictos.parcial + veredictos.desalineado

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Tope de <span className="font-semibold text-foreground">{limite}</span> revisiones por
          auditoría. Solo se descuenta lo que el modelo llegó a responder.
        </p>

        <Button variant="outline" size="sm" onClick={cargar}>
          <RefreshCw />
          Actualizar
        </Button>
      </div>

      {datos.truncado && (
        <p className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-2.5 text-sm text-foreground">
          Hay más registros de los que caben en una consulta: las cifras son de los más recientes.
        </p>
      )}

      {/* Presupuesto.
          En porcentaje y no en dinero: lo que se quiere saber de un vistazo es
          cuánto margen queda, y «1,3 %» lo dice mejor que «US$ 0,067».
          La barra lleva dos tramos porque son dos cosas distintas: lo que ha
          puesto este sistema y lo que gasta la cuenta por fuera de él. */}
      <section className={cn(SECTION_CARD, 'p-4 sm:p-5')}>
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">Presupuesto de IA</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">{leyendaFuente}</p>
          </div>

          {usadoPct !== null && (
            <p className="flex items-baseline gap-1.5">
              <span
                className={cn(
                  'text-[2rem] font-extrabold leading-none tabular-nums',
                  usadoPct >= 80 ? 'text-destructive' : 'text-foreground'
                )}
              >
                {pct(usadoPct)}
              </span>
              <span className="text-xs font-semibold text-muted-foreground">
                consumido · quedan {pct(disponiblePct)}
              </span>
            </p>
          )}
        </div>

        {usadoPct === null ? (
          <p className="mt-3 text-sm text-muted-foreground">{facturacion.motivo}</p>
        ) : (
          <>
            {/* `minWidth` para que un consumo diminuto se vea como una marca:
                una revisión es el 0,036 % de cinco dólares. */}
            <div
              className="mt-4 h-3 w-full overflow-hidden rounded-full bg-muted"
              role="img"
              aria-label={`${pct(usadoPct)} del presupuesto consumido`}
            >
              <div
                className={cn(
                  'h-full rounded-full transition-[width] duration-500',
                  usadoPct >= 80 ? 'bg-destructive' : 'bg-primary'
                )}
                style={{ width: `${usadoPct}%`, minWidth: usadoPct > 0 ? '4px' : 0 }}
              />
            </div>

            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
              <li>
                Consumido{' '}
                <span className="font-semibold tabular-nums text-foreground">{pct(usadoPct)}</span>
              </li>
              <li>
                Disponible{' '}
                <span className="font-semibold tabular-nums text-foreground">
                  {pct(disponiblePct)}
                </span>
              </li>
              <li>
                Presupuesto{' '}
                <span className="font-semibold tabular-nums text-foreground">
                  US$ {presupuesto.limiteUsd}
                </span>
              </li>
              {facturacion.dias > 0 && (
                <li className="ml-auto">
                  {facturacion.dias} día{facturacion.dias === 1 ? '' : 's'} con gasto
                </li>
              )}
            </ul>
          </>
        )}
      </section>

      {sinUso ? (
        <div className={cn(EMPTY_STATE, 'min-h-[24vh] flex-col gap-1')}>
          <p>Todavía nadie ha usado la revisión con IA en este sistema.</p>
          <p className="text-xs">
            El desglose por auditoría y por auditor aparece con la primera revisión. Lo de
            arriba viene de OpenAI y no depende de eso.
          </p>
        </div>
      ) : (
        <>
          {/* Consumo */}
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 2xl:grid-cols-6">
            <InfoCard
              tone="blue"
              label="Revisiones"
              value={numero(resumen.ok)}
              hint={`${numero(revisiones)} llamadas al modelo`}
            />
            <InfoCard
              tone="purple"
              label="Auditorías con IA"
              value={numero(resumen.auditorias)}
              hint={`${resumen.mediaPorAuditoria} de media por auditoría`}
            />
            <InfoCard
              tone="teal"
              label="Tokens gastados"
              value={miles(resumen.tokensTotal)}
              hint={`${miles(resumen.tokensEntrada)} entrada · ${miles(resumen.tokensSalida)} salida`}
            />
            <InfoCard
              tone="cyan"
              label="Tokens por revisión"
              value={numero(resumen.mediaTokens)}
              hint={`${segundos(resumen.mediaDuracionMs)} de media`}
            />
            <InfoCard
              tone="amber"
              label="Auditorías al tope"
              value={numero(resumen.agotadas)}
              total={resumen.auditorias}
              percent={
                resumen.auditorias
                  ? Math.round((resumen.agotadas / resumen.auditorias) * 100)
                  : 0
              }
            />
            <InfoCard
              tone="rose"
              label="Bloqueadas"
              value={numero(resumen.bloqueadas)}
              hint={`${numero(resumen.errores)} con error`}
            />
          </section>

          {/* Uso en el tiempo */}
          {/* Los días sin uso no aparecen: la tabla solo tiene lo que pasó, y
              rellenar el calendario a base de ceros alargaría el eje sin
              añadir nada. */}
          <ExportableChartCard title="Revisiones por día" downloadName="uso-ia-por-dia" height={280}>
            {(Tip) => (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={serie} margin={{ top: 8, right: 8, left: -12, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                  <XAxis dataKey="etiqueta" tick={{ fontSize: 11, fill: AXIS_COLOR }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: AXIS_COLOR }} />
                  <Tooltip content={<Tip />} cursor={{ fill: 'hsl(var(--muted))' }} />
                  <Bar dataKey="revisiones" name="Revisiones" fill={BRAND} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ExportableChartCard>

          {/* Para qué sirve: en qué acaban las revisiones que sí se hicieron */}
          {veredictosTotal > 0 && (
            <section className={cn(SECTION_CARD, 'p-4')}>
              <h3 className="text-sm font-semibold">Veredictos emitidos</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Un veredicto por campo revisado, no por revisión: una llamada puede juzgar el
                objetivo y las conclusiones a la vez.
              </p>

              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <InfoCard
                  tone="green"
                  label="Alineado"
                  value={numero(veredictos.alineado)}
                  total={veredictosTotal}
                  percent={Math.round((veredictos.alineado / veredictosTotal) * 100)}
                />
                <InfoCard
                  tone="amber"
                  label="Parcial"
                  value={numero(veredictos.parcial)}
                  total={veredictosTotal}
                  percent={Math.round((veredictos.parcial / veredictosTotal) * 100)}
                />
                <InfoCard
                  tone="rose"
                  label="Desalineado"
                  value={numero(veredictos.desalineado)}
                  total={veredictosTotal}
                  percent={Math.round((veredictos.desalineado / veredictosTotal) * 100)}
                />
              </div>
            </section>
          )}

          {/* Consumo por auditoría: lo que hace falta para saber a quién se le acaba */}
          <section className={TABLE_CONTAINER}>
            <div className={TABLE_TOOLBAR}>
              <h3 className="text-sm font-semibold">Consumo por auditoría</h3>
              <span className="text-xs text-muted-foreground">
                {numero(datos.porAuditoria.length)} auditorías
              </span>
            </div>

            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-24">Auditoría</TableHead>
                  <TableHead>Dependencia</TableHead>
                  <TableHead className="w-28 text-right">Usadas</TableHead>
                  <TableHead className="w-28 text-right">Restantes</TableHead>
                  <TableHead className="w-28 text-right">Tokens</TableHead>
                  <TableHead className="w-28 text-right">% del uso</TableHead>
                  <TableHead className="w-36 text-right">Última</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {datos.porAuditoria.slice(0, TOPE_FILAS).map((a) => (
                  <TableRow key={a.informeId}>
                    <TableCell className="tabular-nums text-muted-foreground">
                      #{a.informeId}
                    </TableCell>
                    <TableCell className="font-medium">{a.dependencia}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {a.consumidas}
                      <span className="text-muted-foreground">/{limite}</span>
                    </TableCell>
                    <TableCell
                      className={cn(
                        'text-right font-semibold tabular-nums',
                        a.restantes === 0 && 'text-destructive'
                      )}
                    >
                      {a.restantes}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {numero(a.tokens)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {pct(a.partePct)}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {fechaHora(a.ultima)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {datos.porAuditoria.length > TOPE_FILAS && (
              <p className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
                Se muestran las {TOPE_FILAS} auditorías que más han usado la IA, de{' '}
                {numero(datos.porAuditoria.length)}.
              </p>
            )}
          </section>

          {/* Quién la usa */}
          <section className={TABLE_CONTAINER}>
            <div className={TABLE_TOOLBAR}>
              <h3 className="text-sm font-semibold">Uso por auditor</h3>
              <span className="text-xs text-muted-foreground">
                {numero(datos.porUsuario.length)} personas
              </span>
            </div>

            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Auditor</TableHead>
                  <TableHead className="w-32 text-right">Revisiones</TableHead>
                  <TableHead className="w-32 text-right">Auditorías</TableHead>
                  <TableHead className="w-32 text-right">Tokens</TableHead>
                  <TableHead className="w-28 text-right">% del uso</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {datos.porUsuario.length === 0 && (
                  <TableEmpty colSpan={5}>Sin registros.</TableEmpty>
                )}

                {/* Por posición y no por nombre: dos personas pueden llamarse
                    igual, y los usuarios borrados caen todos en «Sin identificar». */}
                {datos.porUsuario.slice(0, TOPE_FILAS).map((u, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{u.usuario}</TableCell>
                    <TableCell className="text-right tabular-nums">{numero(u.usos)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {numero(u.auditorias)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {numero(u.tokens)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {pct(u.partePct)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>

          {/* Averías, solo si las hubo */}
          {datos.errores.length > 0 && (
            <section className={cn(SECTION_CARD, 'p-4')}>
              <h3 className="text-sm font-semibold">Llamadas con error</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Solo descuentan cupo las que el modelo llegó a responder: una clave mal puesta o el
                servicio caído no le cuestan revisiones a nadie.
              </p>

              <ul className="mt-3 flex flex-wrap gap-2">
                {datos.errores.map((e) => (
                  <li
                    key={e.codigo}
                    className="rounded-full bg-muted px-3 py-1 text-xs font-medium tabular-nums"
                  >
                    {e.codigo} · {numero(e.veces)}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  )
}
