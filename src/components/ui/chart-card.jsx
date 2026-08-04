'use client'

import { useRef } from 'react'
import { Download } from 'lucide-react'
import html2canvas from 'html2canvas'

import { Button } from '@/components/ui/button'
import { SECTION_CARD } from '@/components/ui/tokens'
import { cn } from '@/lib/utils'

/**
 * Tooltip del sistema para las gráficas de Recharts.
 *
 * Recharts inyecta `active`, `payload` y `label` al elemento que se le pasa en
 * `<Tooltip content={...} />`.
 */
export function ChartTooltip({ active, payload, label, formatter }) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      {label !== undefined && label !== '' && (
        <p className="mb-1 font-semibold text-popover-foreground">{label}</p>
      )}

      {payload.map((entry, i) => (
        <p key={`${entry.dataKey}-${i}`} className="flex items-center gap-1.5 text-muted-foreground">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ background: entry.color || entry.fill }}
          />
          <span className="capitalize">{entry.name}:</span>
          <span className="font-semibold tabular-nums text-foreground">
            {formatter ? formatter(entry.value) : entry.value}
          </span>
        </p>
      ))}

      {/* Campos de contexto que algunas series adjuntan al dato. */}
      {payload[0]?.payload?.dependencia && (
        <p className="mt-1 border-t border-border pt-1 text-[0.7rem] text-muted-foreground">
          {payload[0].payload.dependencia}
        </p>
      )}
    </div>
  )
}

/**
 * Tarjeta de gráfica con botón para descargarla en PNG.
 *
 * El hijo es una función que recibe el componente de tooltip a usar:
 *
 *   <ExportableChartCard title="…" downloadName="…">
 *     {(Tip) => (
 *       <ResponsiveContainer …>
 *         <BarChart …><Tooltip content={<Tip />} /></BarChart>
 *       </ResponsiveContainer>
 *     )}
 *   </ExportableChartCard>
 */
export function ExportableChartCard({ title, downloadName, className, height = 260, children }) {
  const captureRef = useRef(null)

  const downloadPng = async () => {
    if (!captureRef.current) return

    try {
      const canvas = await html2canvas(captureRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
        useCORS: true,
      })

      const link = document.createElement('a')
      link.download = `${downloadName}_${new Date().toISOString().split('T')[0]}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch (error) {
      console.error('Error al descargar gráfica:', error)
    }
  }

  return (
    <article className={cn(SECTION_CARD, 'flex flex-col p-4', className)}>
      <header className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold leading-tight">{title}</h3>
        <Button variant="outline" size="sm" onClick={downloadPng} title="Descargar gráfica en PNG">
          <Download />
          PNG
        </Button>
      </header>

      <div ref={captureRef} className="w-full bg-card" style={{ height }}>
        {children(ChartTooltip)}
      </div>
    </article>
  )
}
