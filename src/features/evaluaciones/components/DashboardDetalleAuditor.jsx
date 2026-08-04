'use client'

/**
 * Modo «Por auditor» del Dashboard de Auditores: perfil, KPIs, gráficas y el
 * detalle de cada auditoría.
 */
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { Badge } from '@/components/ui/badge'
import { ExportableChartCard } from '@/components/ui/chart-card'
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
  SECTION_CARD,
  STATUS_BADGE_TONES,
  TABLE_CONTAINER,
  TABLE_TOOLBAR,
} from '@/components/ui/tokens'
import { cn } from '@/lib/utils'

const formatNote = (value) => (typeof value === 'number' ? value.toFixed(2) : '—')

/** KPI compacto de la barra de perfil. */
function KpiInline({ label, value }) {
  return (
    <div className="rounded-lg bg-muted/60 px-3 py-2 text-center">
      <p className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="text-lg font-extrabold tabular-nums">{value}</p>
    </div>
  )
}

export default function DashboardDetalleAuditor({
  dashboard,
  metricas,
  auditorias,
  avatarSrc,
  onAvatarError,
  chartAuditoriasPorAnio,
  chartNotasPorAnio,
  chartNotasPorAuditoria,
}) {
  const { auditor } = dashboard

  return (
    <>
      {/* Perfil + KPIs */}
      <section className={cn(SECTION_CARD, 'flex flex-col gap-4 p-4 lg:flex-row lg:items-center')}>
        <img
          src={avatarSrc}
          alt={`Avatar de ${auditor.nombre}`}
          onError={onAvatarError}
          className="mx-auto h-28 w-28 shrink-0 rounded-full border-2 border-primary/20 object-cover lg:mx-0"
        />

        <div className="min-w-0 flex-1 text-center lg:text-left">
          <h2 className="text-xl font-semibold">
            {auditor.nombre} {auditor.apellido}
          </h2>
          <div className="mt-1 flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm text-muted-foreground lg:justify-start">
            <span>{auditor.email}</span>
            <span>{auditor.celular || 'Sin celular'}</span>
            <span>{auditor.dependencia_nombre || 'Sin dependencia'}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:w-auto">
          <KpiInline label="Auditorías" value={metricas.total} />
          <KpiInline label="Promedio" value={formatNote(metricas.promedioFinal)} />
          <KpiInline label="Mejor" value={formatNote(metricas.mejorNota)} />
          <KpiInline label="Años" value={dashboard.metricas?.anios_con_auditorias ?? 0} />
        </div>
      </section>

      {/* Gráficas */}
      <section className="grid gap-4 xl:grid-cols-3">
        <ExportableChartCard title="Auditorías por año" downloadName="auditorias-por-anio">
          {(Tip) => (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartAuditoriasPorAnio}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="anio" height={30} />
                <YAxis width={35} allowDecimals={false} />
                <Tooltip content={<Tip />} />
                <Bar dataKey="auditorias" fill="#6387d6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ExportableChartCard>

        <ExportableChartCard title="Notas por año" downloadName="notas-por-anio">
          {(Tip) => (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartNotasPorAnio}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="anio" height={30} />
                <YAxis width={35} domain={[0, 5]} />
                <Tooltip content={<Tip formatter={formatNote} />} />
                <Line type="monotone" dataKey="final" stroke="#2563eb" strokeWidth={2}>
                  <LabelList dataKey="final" position="top" formatter={formatNote} />
                </Line>
                <Line type="monotone" dataKey="archivos" stroke="#0f766e" strokeWidth={1.5} />
                <Line type="monotone" dataKey="encuesta" stroke="#d97706" strokeWidth={1.5} />
                <Line type="monotone" dataKey="rubrica" stroke="#7c3aed" strokeWidth={1.5} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ExportableChartCard>

        <ExportableChartCard title="Evolución por auditoría" downloadName="evolucion-por-auditoria">
          {(Tip) => (
            <ResponsiveContainer width="100%" height="100%">
              {/* El eje X identifica la auditoría (`informe`), no la nota. */}
              <BarChart data={chartNotasPorAuditoria}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="informe" height={30} />
                <YAxis width={35} domain={[0, 5]} />
                <Tooltip content={<Tip formatter={formatNote} />} />
                <Bar dataKey="nota_final" fill="#aa6cc7" radius={[6, 6, 0, 0]}>
                  <LabelList dataKey="nota_final" position="top" formatter={formatNote} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ExportableChartCard>
      </section>

      {/* Detalle */}
      <section className={TABLE_CONTAINER}>
        <div className={TABLE_TOOLBAR}>
          <h3 className="text-sm font-semibold">Detalle por auditoría</h3>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-28">ID informe</TableHead>
              <TableHead>Dependencia</TableHead>
              <TableHead className="w-32">Fecha</TableHead>
              <TableHead className="w-28">Periodo</TableHead>
              <TableHead className="text-right">Archivos</TableHead>
              <TableHead className="text-right">Encuesta</TableHead>
              <TableHead className="text-right">Rúbrica</TableHead>
              <TableHead className="text-right">Final</TableHead>
              <TableHead className="w-36">Estado</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {auditorias.length === 0 ? (
              <TableEmpty colSpan={9}>No hay auditorías para el filtro seleccionado.</TableEmpty>
            ) : (
              auditorias.map((auditoria) => {
                const completa =
                  auditoria.estado_evaluacion === 'completa' ||
                  auditoria.estado_evaluacion === 'publicada'

                return (
                  <TableRow key={auditoria.informe_id}>
                    {/* Antes esta celda mostraba la nota final por error. */}
                    <TableCell className="tabular-nums text-muted-foreground">
                      #{auditoria.informe_id}
                    </TableCell>
                    <TableCell className="font-medium">{auditoria.dependencia_nombre}</TableCell>
                    <TableCell>{auditoria.fecha_auditoria || '—'}</TableCell>
                    <TableCell>{auditoria.periodo || '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNote(auditoria.nota_archivos)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNote(auditoria.nota_encuesta)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNote(auditoria.nota_rubrica)}
                    </TableCell>
                    <TableCell className="text-right font-bold tabular-nums text-primary">
                      {formatNote(auditoria.nota_final)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(STATUS_BADGE_TONES[completa ? 'success' : 'neutral'])}
                      >
                        {auditoria.estado_evaluacion || 'sin_evaluacion'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </section>
    </>
  )
}
