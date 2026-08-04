'use client'

/** Ficha completa de una auditoría: campos del informe y enlaces a sus documentos. */
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

/** Un dato con su etiqueta; `ancho` ocupa las dos columnas. */
function Item({ label, children, ancho }) {
  return (
    <div className={cn('flex flex-col gap-0.5', ancho && 'sm:col-span-2')}>
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-sm">{children}</span>
    </div>
  )
}

export function ModalDetalleAuditoria({ auditoria, open, onOpenChange, onAbrirUrl }) {
  if (!auditoria) return null

  const documentos = [
    ['Carta de compromiso', auditoria.acta_compromiso?.url],
    ['Plan', auditoria.plan?.url],
    ['Informe validado', auditoria.validated?.url],
    ['Asistencia', auditoria.asistencia?.url],
    ['Evaluación', auditoria.evaluacion?.url],
    ['Acta', auditoria.acta?.url],
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Detalle de la auditoría #{auditoria.id}</DialogTitle>
          <DialogDescription>
            💪 {auditoria.fCount ?? 0} fortalezas · 📈 {auditoria.omCount ?? 0} oportunidades · 🚫{' '}
            {auditoria.ncCount ?? 0} no conformidades
          </DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[60vh] gap-4 overflow-y-auto sm:grid-cols-2">
          <Item label="Dependencia">{auditoria.dependencias?.nombre || 'N/A'}</Item>
          <Item label="Auditor">
            {`${auditoria.usuarios?.nombre || ''} ${auditoria.usuarios?.apellido || ''}`.trim() ||
              'N/A'}
          </Item>
          <Item label="Fecha de auditoría">{auditoria.fecha_auditoria || 'N/A'}</Item>
          <Item label="Asistencia">{auditoria.asistencia_tipo || 'N/A'}</Item>

          <Item label="Objetivo" ancho>
            {auditoria.objetivo || '—'}
          </Item>
          <Item label="Criterios" ancho>
            {auditoria.criterios || '—'}
          </Item>
          <Item label="Conclusiones" ancho>
            {auditoria.conclusiones || '—'}
          </Item>
          <Item label="Recomendaciones" ancho>
            {auditoria.recomendaciones || '—'}
          </Item>

          {documentos.map(([label, url]) => (
            <Item key={label} label={label}>
              {url ? (
                <button
                  type="button"
                  onClick={() => onAbrirUrl(url)}
                  className="cursor-pointer font-medium text-primary underline-offset-4 hover:underline"
                >
                  Abrir
                </button>
              ) : (
                '—'
              )}
            </Item>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
