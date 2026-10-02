'use client'

/**
 * Qué va a salir en el formato del Plan de Mejoramiento, antes de generarlo.
 *
 * El botón descargaba el archivo de golpe, y el formato no es una plantilla en
 * blanco: se rellena con los hallazgos de **esa** auditoría. Desde una tabla
 * de treinta filas no queda claro con cuál se va a generar, y el error no se
 * nota hasta que alguien abre el Excel y ve la dependencia equivocada.
 *
 * Así que primero se dice qué lleva y de dónde sale, y después se genera.
 */
import { Download, FileSpreadsheet } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatearDia } from '@/lib/fechas'

/** «3 oportunidades de mejora», con el singular bien puesto. */
const cuenta = (n, singular, plural) => `${n} ${n === 1 ? singular : plural}`

export default function ModalGenerarPlanMejora({ auditoria, onClose, onConfirmar, generando }) {
  const om = auditoria?.oportunidades_mejora?.length || 0
  const nc = auditoria?.no_conformidades?.length || 0

  const datos = auditoria
    ? [
        ['Dependencia', auditoria.dependencias?.nombre || 'Sin dependencia'],
        [
          'Auditoría',
          `#${auditoria.id}${
            auditoria.fecha_auditoria ? ` · ${formatearDia(auditoria.fecha_auditoria)}` : ''
          }`,
        ],
        ['Oportunidades de mejora', cuenta(om, 'registrada', 'registradas')],
        ['No conformidades', cuenta(nc, 'registrada', 'registradas')],
      ]
    : []

  return (
    <Dialog open={Boolean(auditoria)} onOpenChange={(abierto) => (abierto ? null : onClose())}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Generar el formato del Plan de Mejoramiento</DialogTitle>
          <DialogDescription>
            Se va a generar con los datos de esta auditoría, tal como están registrados ahora.
          </DialogDescription>
        </DialogHeader>

        <dl className="divide-y divide-border rounded-xl border border-border bg-muted/40 text-sm">
          {datos.map(([etiqueta, valor]) => (
            <div key={etiqueta} className="flex items-baseline justify-between gap-4 px-4 py-2.5">
              <dt className="text-muted-foreground">{etiqueta}</dt>
              <dd className="text-right font-medium">{valor}</dd>
            </div>
          ))}
        </dl>

        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <FileSpreadsheet className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            Se descarga un Excel con un renglón por hallazgo. La dependencia auditada escribe las
            acciones, los responsables y las fechas, y cuando lo devuelva se guarda aquí mismo con{' '}
            <strong className="font-medium text-foreground">Subir validado</strong>.
          </span>
        </p>

        {om + nc === 0 && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
            Esta auditoría no tiene hallazgos registrados: el formato saldría vacío.
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={generando}>
            Cancelar
          </Button>
          <Button onClick={onConfirmar} disabled={generando}>
            <Download />
            {generando ? 'Generando…' : 'Generar formato'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
