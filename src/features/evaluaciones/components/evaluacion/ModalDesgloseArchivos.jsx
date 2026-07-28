'use client'

/**
 * Desglose de la nota de archivos de un auditor.
 *
 * Muestra documento a documento la fecha límite, la de entrega y los puntos, y
 * permite corregir la fecha de entrega a mano: los puntos se recalculan en el
 * momento y las fechas editadas se preservan en los recálculos posteriores.
 */
import { AlertCircle, Save } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EMPTY_STATE, STATUS_BADGE_TONES, TABLE_SCROLL } from '@/components/ui/tokens'
import { colorNota } from '@/features/evaluaciones/lib/rubrica'
import {
  PUNTOS_A_TIEMPO,
  PUNTOS_TARDE,
  archivosDe,
  calcularEstado,
  calcularPuntos,
} from '@/features/evaluaciones/lib/archivos'

/** Tono del badge según los puntos obtenidos. */
const tonoPorPuntos = (puntos) =>
  puntos === PUNTOS_A_TIEMPO ? 'success' : puntos === PUNTOS_TARDE ? 'warning' : 'danger'

const colorPorPuntos = (puntos) =>
  puntos === PUNTOS_A_TIEMPO
    ? 'text-emerald-600'
    : puntos === PUNTOS_TARDE
      ? 'text-amber-600'
      : 'text-destructive'

/** Tabla de archivos de un informe. */
function TablaArchivos({ informe, informeIdx, editados, onFecha }) {
  return (
    <div className={TABLE_SCROLL}>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Documento</TableHead>
            <TableHead className="w-32">Fecha límite</TableHead>
            <TableHead className="w-44">Fecha entrega</TableHead>
            <TableHead className="w-40">Estado</TableHead>
            <TableHead className="w-20 text-center">Puntos</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {archivosDe(informe).map((archivo, archIdx) => {
            const editado = editados[`${informeIdx}-${archIdx}`]
            const fechaCarga = editado?.fechaCarga || archivo.fechaCarga?.split('T')[0]
            const fechaLimite = archivo.fechaLimite?.split('T')[0]
            const manual = archivo.editado_manualmente === true

            const puntos = editado ? calcularPuntos(fechaCarga, fechaLimite) : archivo.puntos
            const estado = editado ? calcularEstado(fechaCarga, fechaLimite) : archivo.estado

            return (
              <TableRow
                key={archIdx}
                className={cn(manual && !editado && 'bg-emerald-50/50 dark:bg-emerald-950/20')}
              >
                <TableCell className="font-medium">
                  {archivo.nombre}
                  {manual && !editado && (
                    <span className="ml-2 text-xs font-medium text-emerald-600">🔒 Manual</span>
                  )}
                </TableCell>

                <TableCell className="text-xs text-muted-foreground">
                  {archivo.fechaLimiteFormateada || '-'}
                </TableCell>

                <TableCell>
                  {archivo.existe || editado ? (
                    <Input
                      type="date"
                      value={fechaCarga || ''}
                      onChange={(e) => onFecha(informeIdx, archIdx, e.target.value)}
                      title={
                        manual
                          ? 'Fecha editada manualmente (preservada en recálculos)'
                          : 'Cambiar la fecha de entrega'
                      }
                      className={cn(
                        'h-8 font-mono text-xs',
                        editado && 'border-primary bg-primary/5',
                        manual && !editado && 'border-emerald-500'
                      )}
                    />
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        onFecha(informeIdx, archIdx, new Date().toISOString().split('T')[0])
                      }
                    >
                      + Agregar fecha
                    </Button>
                  )}
                </TableCell>

                <TableCell>
                  <span
                    className={cn(
                      'rounded-full border px-2.5 py-0.5 text-xs font-semibold',
                      STATUS_BADGE_TONES[tonoPorPuntos(puntos)]
                    )}
                  >
                    {estado || 'No disponible'}
                    {editado && ' ✏️'}
                    {manual && !editado && ' 🔒'}
                  </span>
                </TableCell>

                <TableCell className="text-center">
                  <span className={cn('font-bold tabular-nums', colorPorPuntos(puntos))}>
                    {puntos !== undefined ? `${puntos}/${PUNTOS_A_TIEMPO}` : '-'}
                  </span>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

export function ModalDesgloseArchivos({
  evaluacion,
  open,
  onOpenChange,
  editados,
  onFecha,
  onDescartar,
  onGuardar,
  guardando,
}) {
  if (!evaluacion) return null

  const detalle = evaluacion.detalle_archivos
  const informes = detalle?.informes || []
  const cambiosPendientes = Object.keys(editados).length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>📂 Desglose de evaluación de archivos</DialogTitle>
          <DialogDescription>
            {evaluacion.auditor_nombre} {evaluacion.auditor_apellido} ·{' '}
            {evaluacion.auditor_dependencia_nombre}
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto pr-1">
          <p className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/25 dark:text-emerald-200">
            <strong>ℹ️ Fechas preservadas:</strong> las marcadas con 🔒 se editaron manualmente y se
            conservan al recalcular. Las demás se recalculan según el almacenamiento.
          </p>

          {informes.length > 0 ? (
            <>
              {informes.map((informe, idx) => (
                <div key={idx} className="rounded-xl border border-border">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
                    <h3 className="text-sm font-semibold">Informe #{informe.informe_id}</h3>
                    <span className="text-xs text-muted-foreground">
                      Auditoría: {informe.fecha_auditoria}
                    </span>
                  </div>

                  <TablaArchivos
                    informe={informe}
                    informeIdx={idx}
                    editados={editados}
                    onFecha={onFecha}
                  />
                </div>
              ))}

              <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/40 p-4 text-sm">
                {[
                  ['Total archivos esperados', detalle.total_esperados || 0],
                  ['Archivos entregados', detalle.total_cargados || 0],
                  ['Puntos totales', detalle.total_puntos || 0],
                ].map(([label, valor]) => (
                  <div key={label} className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">{label}:</span>
                    <span className="font-semibold tabular-nums">{valor}</span>
                  </div>
                ))}

                <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
                  <span className="font-bold">Nota final de archivos:</span>
                  <span
                    className={cn(
                      'text-2xl font-extrabold tabular-nums',
                      colorNota(evaluacion.nota_archivos)
                    )}
                  >
                    {evaluacion.nota_archivos?.toFixed(2) || '0.00'}
                  </span>
                </div>
              </div>

              <p className="flex items-start gap-2 text-xs text-muted-foreground">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {detalle.metodo_calculo ||
                  'La nota se calcula como el promedio de puntos obtenidos en todos los archivos.'}
              </p>
            </>
          ) : (
            <p className={EMPTY_STATE}>
              No hay información de archivos disponible. Usa «Recalcular archivos» para generar el
              desglose.
            </p>
          )}
        </div>

        {cambiosPendientes > 0 && (
          <DialogFooter className="border-t border-border pt-4 sm:justify-between">
            <p className="text-sm">
              <strong className="text-primary">✏️ {cambiosPendientes} cambio(s) pendiente(s)</strong>
              <br />
              <span className="text-xs text-muted-foreground">
                Las fechas se actualizarán y los puntos se recalcularán automáticamente.
              </span>
            </p>

            <div className="flex gap-2">
              <Button variant="outline" onClick={onDescartar} disabled={guardando}>
                Descartar
              </Button>
              <Button onClick={onGuardar} disabled={guardando}>
                <Save />
                {guardando ? 'Guardando…' : 'Guardar cambios'}
              </Button>
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
