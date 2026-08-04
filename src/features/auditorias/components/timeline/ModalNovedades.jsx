'use client'

/** Novedades de una auditoría: listado y alta de una nueva. */
import { Paperclip, Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

/**
 * @param {Object} props
 * @param {Object} props.auditoria
 * @param {ReturnType<import('../../hooks/useNovedades').useNovedades>} props.novedades
 * @param {boolean} props.soloLectura
 * @param {(url: string) => void} props.onAbrirUrl
 */
export function ModalNovedades({ auditoria, novedades, soloLectura, onAbrirUrl }) {
  if (!auditoria) return null

  return (
    <Dialog open={novedades.abierto} onOpenChange={(o) => (o ? null : novedades.cerrar())}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Novedades — auditoría #{auditoria.id}</DialogTitle>
          <DialogDescription>Haz clic en una novedad para abrirla.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          {novedades.cargando ? (
            <span className="text-sm text-muted-foreground">Cargando novedades…</span>
          ) : novedades.novedades.length === 0 ? (
            <span className="text-sm text-muted-foreground">Sin novedades registradas.</span>
          ) : (
            novedades.novedades.map((nv) => (
              <Button
                key={nv.path}
                variant="outline"
                size="sm"
                title={nv.name}
                onClick={() => nv.url && onAbrirUrl(nv.url)}
              >
                <Sparkles />
                {nv.displayLabel}
              </Button>
            ))
          )}
        </div>

        {!soloLectura && (
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border p-6 text-center transition-colors hover:border-primary hover:bg-accent">
            <input
              type="file"
              accept="application/pdf"
              className="sr-only"
              onChange={(e) => {
                if (!novedades.seleccionar(e.target.files?.[0] || null)) e.target.value = null
              }}
            />
            {novedades.archivo ? (
              <p className="text-sm font-medium">✅ {novedades.archivo.name}</p>
            ) : (
              <>
                <Paperclip className="h-6 w-6 text-muted-foreground" />
                <p className="text-sm">
                  Haz clic para seleccionar el PDF de la novedad
                  <br />
                  <span className="text-xs text-muted-foreground">
                    Solo PDF (máx. {novedades.maxMB} MB)
                  </span>
                </p>
              </>
            )}
          </label>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={novedades.cerrar}>
            Cerrar
          </Button>
          {!soloLectura && (
            <Button
              onClick={() => novedades.subir(auditoria)}
              disabled={!novedades.archivo || novedades.subiendo}
            >
              {novedades.subiendo ? 'Subiendo…' : 'Registrar novedad'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
