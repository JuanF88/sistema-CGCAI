'use client'

/** Resumen consolidado del periodo: una fila por evaluación con sus cuatro notas. */
import { Download, Eye, FileText } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { TABLE_CONTAINER, TABLE_SCROLL } from '@/components/ui/tokens'
import { colorNota } from '@/features/evaluaciones/lib/rubrica'

import { InfoBox } from './InfoBox'
import { Spinner } from '@/components/ui/loader'

/** Celda de nota: número coloreado o guion. */
function Nota({ valor }) {
  if (valor === null || valor === undefined) return <span className="text-muted-foreground">-</span>
  return (
    <span className={cn('font-semibold tabular-nums', colorNota(valor))}>{valor.toFixed(2)}</span>
  )
}

/** El aro pequeño y su texto, para la fila de una tabla que está cargando. */
function FilaCargando({ texto }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Spinner size="sm" />
      {texto}
    </span>
  )
}

export function TablaResumenEvaluaciones({
  evaluaciones,
  loading,
  periodo,
  onExportar,
  onVerArchivos,
}) {
  const vacio = !loading && evaluaciones.length === 0

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Resumen general de evaluaciones</h2>
          <p className="text-sm text-muted-foreground">Vista consolidada del periodo {periodo}</p>
        </div>

        {!vacio && !loading && (
          <Button variant="outline" onClick={onExportar}>
            <Download />
            Descargar Excel
          </Button>
        )}
      </div>

      <InfoBox icon={FileText} title="Notas de archivos">
        <p>
          Evalúan la entrega oportuna de: carta de compromiso, plan, asistencia, evaluación, acta y
          validación. <strong>Plazos:</strong> carta de compromiso y plan (5 días hábiles antes),
          asistencia y evaluación (el día hábil siguiente), acta y validación (10 días hábiles
          después).{' '}
          <strong>Puntuación:</strong> 5 puntos a tiempo, 1 punto tarde. La nota es el promedio de
          todos los archivos.
        </p>
        <p>💡 Haz clic en la nota de archivos para ver el desglose completo de entregas.</p>
        <p className="font-medium text-amber-600">
          ⚠️ Si acabas de actualizar los plazos, usa «Recalcular archivos» para refrescar todas las
          notas.
        </p>
      </InfoBox>

      <div className={cn(TABLE_CONTAINER, TABLE_SCROLL)}>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-28">ID Informe</TableHead>
              <TableHead>Auditor</TableHead>
              <TableHead>Dependencia</TableHead>
              <TableHead className="w-32">Fecha auditoría</TableHead>
              <TableHead className="w-28 text-center">Encuesta</TableHead>
              <TableHead className="w-32 text-center">Archivos</TableHead>
              <TableHead className="w-28 text-center">Rúbrica</TableHead>
              <TableHead className="w-28 text-center">Nota final</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {loading && <TableEmpty colSpan={8}>
              <FilaCargando texto="Cargando evaluaciones…" />
            </TableEmpty>}

            {vacio && (
              <TableEmpty colSpan={8}>
                No hay evaluaciones registradas para este periodo. Comienza importando las encuestas
                desde Google Forms.
              </TableEmpty>
            )}

            {!loading &&
              evaluaciones.map((ev) => (
                <TableRow key={ev.id}>
                  <TableCell className="font-mono text-xs text-primary">
                    {ev.informe_auditoria_id || '-'}
                  </TableCell>
                  <TableCell className="font-medium">
                    {ev.auditor_nombre} {ev.auditor_apellido}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {ev.auditor_dependencia_nombre || '-'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {ev.fecha_auditoria || '-'}
                  </TableCell>
                  <TableCell className="text-center">
                    <Nota valor={ev.nota_encuesta} />
                  </TableCell>
                  <TableCell className="text-center">
                    {ev.nota_archivos !== null ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onVerArchivos(ev)}
                        title="Ver desglose de archivos"
                        className={cn('font-semibold tabular-nums', colorNota(ev.nota_archivos))}
                      >
                        {ev.nota_archivos.toFixed(2)}
                        <Eye />
                      </Button>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Nota valor={ev.nota_rubrica} />
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-base font-extrabold tabular-nums">
                      {ev.nota_final?.toFixed(2) ?? '-'}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}
