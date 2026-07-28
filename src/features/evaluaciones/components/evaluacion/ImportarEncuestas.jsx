'use client'

/** Carga del Excel de respuestas de Google Forms y resultado de la importación. */
import { Download, FileText, Info, Upload, X } from 'lucide-react'
import { toast } from 'react-toastify'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { SECTION_CARD } from '@/components/ui/tokens'

import { InfoBox } from './InfoBox'

const PLANTILLA = '/plantillas/Evaluación Auditores (respuestas).xlsx'

/** Cuántos errores se listan antes de resumir el resto. */
const MAX_ERRORES_VISIBLES = 20

function descargarPlantilla() {
  const link = document.createElement('a')
  link.href = PLANTILLA
  link.download = 'Evaluación Auditores (respuestas).xlsx'
  document.body.appendChild(link)
  link.click()
  link.remove()

  toast.success('Plantilla descargada. Completa los datos y vuelve a importar')
}

/** Resultado de la última importación. */
function Progreso({ progreso }) {
  const { detalles } = progreso

  return (
    <div
      className={cn(
        'rounded-xl border p-4 text-sm',
        progreso.error
          ? 'border-destructive/30 bg-destructive/10 text-destructive'
          : 'border-emerald-200 bg-emerald-50/60 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/25 dark:text-emerald-200'
      )}
    >
      <p className="font-medium">{progreso.mensaje}</p>

      {detalles && (
        <div className="mt-2 flex flex-col gap-1 text-foreground">
          <p>✓ Total procesado: {detalles.importados}</p>
          {detalles.nuevos > 0 && <p>➕ Nuevas: {detalles.nuevos}</p>}
          {detalles.actualizados > 0 && <p>🔄 Actualizadas: {detalles.actualizados}</p>}

          {detalles.errores?.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer font-semibold text-destructive">
                ⚠ {detalles.errores.length} errores — ver detalles
              </summary>
              <div className="mt-2 max-h-64 overflow-auto rounded-lg border border-border bg-card p-3 text-xs">
                {detalles.errores.slice(0, MAX_ERRORES_VISIBLES).map((err, idx) => (
                  <p key={idx} className="border-b border-border py-1 last:border-0">
                    {err}
                  </p>
                ))}
                {detalles.errores.length > MAX_ERRORES_VISIBLES && (
                  <p className="mt-2 italic">
                    … y {detalles.errores.length - MAX_ERRORES_VISIBLES} errores más
                  </p>
                )}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  )
}

export function ImportarEncuestas({ archivo, onArchivo, onImportar, progreso, loading }) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">Importar encuestas de evaluación</h2>
        <p className="text-sm text-muted-foreground">
          Carga el Excel exportado desde Google Forms con las respuestas de evaluación
        </p>
      </div>

      <div className={cn(SECTION_CARD, 'flex flex-col gap-5 p-5 sm:p-6')}>
        <InfoBox icon={Info} title="Instrucciones">
          <ol className="ml-4 list-decimal space-y-1">
            <li>Exporta las respuestas del Google Forms en formato Excel (.xlsx).</li>
            <li>Asegúrate de que el archivo contenga todas las columnas requeridas.</li>
            <li>Selecciona el archivo y haz clic en «Importar».</li>
            <li>El sistema procesará y vinculará automáticamente con los auditores.</li>
          </ol>
        </InfoBox>

        <form onSubmit={onImportar} className="flex flex-col gap-4">
          <label className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border p-8 text-center transition-colors hover:border-primary hover:bg-accent">
            <Upload className="h-10 w-10 text-primary" />
            <p className="text-sm font-medium">
              {archivo ? `✅ ${archivo.name}` : 'Selecciona un archivo Excel (.xlsx)'}
            </p>
            <input
              type="file"
              accept=".xlsx"
              onChange={(e) => onArchivo(e.target.files[0])}
              className="sr-only"
            />
          </label>

          <div className="flex flex-wrap justify-end gap-2">
            {archivo && (
              <Button type="button" variant="ghost" onClick={() => onArchivo(null)}>
                <X />
                Limpiar
              </Button>
            )}
            <Button type="submit" disabled={!archivo || loading}>
              <Upload />
              {loading ? 'Procesando…' : 'Importar encuestas'}
            </Button>
          </div>
        </form>

        {progreso && <Progreso progreso={progreso} />}

        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4 text-sm text-muted-foreground">
          <FileText className="h-4 w-4" />
          <span>¿No tienes el formato?</span>
          <Button type="button" variant="outline" size="sm" onClick={descargarPlantilla}>
            <Download />
            Descargar plantilla de ejemplo
          </Button>
        </div>
      </div>
    </section>
  )
}
