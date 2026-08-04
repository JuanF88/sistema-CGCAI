'use client'

/**
 * Modo «Consolidado general» del Dashboard de Auditores.
 * Vive aparte de `VistaDashboardAuditores` para que el orquestador solo se
 * ocupe del estado y la carga de datos.
 */
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

import { ExportableChartCard } from '@/components/ui/chart-card'
import { StatCard } from '@/components/ui/stat-card'
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { TABLE_CONTAINER, TABLE_TOOLBAR } from '@/components/ui/tokens'

const formatNote = (value) => (typeof value === 'number' ? value.toFixed(2) : '—')

export default function DashboardConsolidadoGeneral({
  resumen,
  chartAuditorias,
  chartPromedios,
  chartEquipo,
}) {
  return (
    <>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon="📅" tone="indigo" label="Año" value={resumen.anio} />
        <StatCard icon="📊" tone="blue" label="Auditorías" value={resumen.totalAuditorias} />
        <StatCard icon="👥" tone="purple" label="Auditores" value={resumen.auditoresEvaluados} />
        <StatCard
          icon="⭐"
          tone="green"
          label="Promedio general"
          value={formatNote(resumen.promedioGeneral)}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <ExportableChartCard
          title="Auditorías por auditor (ordenado por cantidad)"
          downloadName="auditorias-por-auditor"
        >
          {(Tip) => (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartAuditorias}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="auditor" hide />
                <YAxis width={35} allowDecimals={false} />
                <Tooltip content={<Tip />} />
                <Bar dataKey="auditorias" fill="#6387d6" radius={[6, 6, 0, 0]}>
                  <LabelList dataKey="auditorias" position="top" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ExportableChartCard>

        <ExportableChartCard title="Promedio por auditor" downloadName="promedio-por-auditor">
          {(Tip) => (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartPromedios}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="auditor" hide />
                <YAxis width={35} domain={[0, 5]} />
                <Tooltip content={<Tip formatter={formatNote} />} />
                <Bar dataKey="promedio" fill="rgb(110, 191, 206)" radius={[6, 6, 0, 0]}>
                  <LabelList dataKey="promedio" position="top" formatter={formatNote} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ExportableChartCard>

        <ExportableChartCard
          title="Promedio del equipo por criterio"
          downloadName="promedio-equipo-por-criterio"
        >
          {(Tip) => (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartEquipo} margin={{ top: 20, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="criterio" />
                <YAxis width={35} domain={[0, 5]} />
                <Tooltip content={<Tip formatter={formatNote} />} />
                <Bar dataKey="promedio" fill="#b2a9ff" radius={[6, 6, 0, 0]}>
                  <LabelList dataKey="promedio" position="top" formatter={formatNote} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ExportableChartCard>
      </section>

      <section className={TABLE_CONTAINER}>
        <div className={TABLE_TOOLBAR}>
          <h3 className="text-sm font-semibold">Consolidado por auditor</h3>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-12">#</TableHead>
              <TableHead>Auditor</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="text-right">Auditorías</TableHead>
              <TableHead className="text-right">Promedio final</TableHead>
              <TableHead className="text-right">Mejor nota</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {resumen.rankingAuditores.length === 0 ? (
              <TableEmpty colSpan={6}>
                No hay evaluaciones registradas para el año seleccionado.
              </TableEmpty>
            ) : (
              resumen.rankingAuditores.map((item, index) => (
                <TableRow key={item.auditor_id}>
                  <TableCell className="tabular-nums text-muted-foreground">{index + 1}</TableCell>
                  <TableCell className="font-medium">{item.nombre}</TableCell>
                  <TableCell className="text-muted-foreground">{item.email}</TableCell>
                  <TableCell className="text-right tabular-nums">{item.total}</TableCell>
                  <TableCell className="text-right font-bold tabular-nums text-primary">
                    {formatNote(item.promedioFinal)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNote(item.mejorNota)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </section>
    </>
  )
}
