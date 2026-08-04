'use client'

/**
 * PANTALLA DE REFERENCIA del sistema de diseño (junto con
 * `VistaAdministrarDependencias`). Primitivos de `@/components/ui`, tokens de
 * clase compartidos y capa `api/`. Sin CSS modules.
 */
import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, BellRing, CheckCircle2, Play, RefreshCw, Save } from 'lucide-react'
import { toast } from 'react-toastify'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { HeaderStat, PageHeader } from '@/components/ui/page-header'
import {
  PAGE_SHELL,
  PAGE_SUBTITLE,
  SECTION_CARD,
  STATUS_BADGE_TONES,
  TABLE_CONTAINER,
  TABLE_TOOLBAR,
} from '@/components/ui/tokens'
import { cn } from '@/lib/utils'

import {
  ejecutarAlertas,
  guardarConfiguracionAlertas,
  obtenerConfiguracionAlertas,
  previsualizarAlertas,
} from '@/features/alertas/api/alertas-api'

const DEFAULT_MESSAGE = 'Sin ejecuciones recientes.'

/** Tono de badge por estado de una alerta en el resumen o la vista previa. */
const TONO_POR_ESTADO = {
  sera_enviado: 'info',
  enviado: 'success',
  omitida: 'neutral',
  fallida: 'danger',
}

const MOTIVOS = {
  ya_enviada_recientemente: 'Alerta ya enviada recientemente',
  auditor_sin_correo: 'Auditor no tiene correo registrado',
  error_envio: 'Error al enviar el correo',
  error_registro_bd: 'Error al registrar en BD',
  sera_enviado: 'Se enviará en esta ejecución',
  enviado: 'Correo enviado correctamente',
}

const formatReason = (reason) => MOTIVOS[reason] || reason

function normalizeConfig(config) {
  return {
    proceso_key: config.proceso_key,
    proceso_label: config.proceso_label,
    bucket: config.bucket || '',
    due_offset_business_days: config.due_offset_business_days ?? 0,
    activo: Boolean(config.activo),
    alerta_5_dias: Boolean(config.alerta_5_dias),
    alerta_1_dia: Boolean(config.alerta_1_dia),
    alerta_vencido: Boolean(config.alerta_vencido),
    dias_repeticion_vencido: config.dias_repeticion_vencido ?? 10,
  }
}

/** Checkbox de tabla: se repite en 4 columnas, así que es constante local. */
const CHECKBOX_CLASS =
  'h-4 w-4 cursor-pointer rounded border-input accent-[hsl(var(--primary))] disabled:opacity-50'

function CeldaCheck({ checked, onChange, label }) {
  return (
    <TableCell className="text-center">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className={CHECKBOX_CLASS}
        aria-label={label}
      />
    </TableCell>
  )
}

/** Tarjeta de detalle usada tanto en la vista previa como en el resumen. */
function TarjetaDetalle({ item }) {
  return (
    <article className="rounded-lg border border-border bg-card p-3 text-sm shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <Badge variant="outline" className={cn(STATUS_BADGE_TONES[TONO_POR_ESTADO[item.status] ?? 'neutral'])}>
          {item.status}
        </Badge>
        <span className="font-semibold">Auditoría #{item.auditId}</span>
      </div>

      <dl className="grid gap-1 text-xs text-muted-foreground">
        <div className="flex gap-1">
          <dt className="font-medium text-foreground">Proceso:</dt>
          <dd>{item.processLabel}</dd>
        </div>
        <div className="flex gap-1">
          <dt className="font-medium text-foreground">Dependencia:</dt>
          <dd>{item.dependencyName}</dd>
        </div>
        {item.email && (
          <div className="flex gap-1">
            <dt className="font-medium text-foreground">Correo:</dt>
            <dd className="break-all">{item.email}</dd>
          </div>
        )}
        {item.alertType && (
          <div className="flex gap-1">
            <dt className="font-medium text-foreground">Tipo:</dt>
            <dd>{item.alertType}</dd>
          </div>
        )}
        {item.daysLeft !== undefined && (
          <div className="flex gap-1">
            <dt className="font-medium text-foreground">Días:</dt>
            <dd className="tabular-nums">{item.daysLeft}</dd>
          </div>
        )}
        {item.reason && (
          <div className="flex gap-1">
            <dt className="font-medium text-foreground">Motivo:</dt>
            <dd>{formatReason(item.reason)}</dd>
          </div>
        )}
      </dl>
    </article>
  )
}

export default function VistaAlertasAuditoria() {
  const [configs, setConfigs] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [running, setRunning] = useState(false)
  const [message, setMessage] = useState(DEFAULT_MESSAGE)
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState(null)
  const [expandedDetails, setExpandedDetails] = useState(false)
  const [preview, setPreview] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  const loadConfigs = async () => {
    setLoading(true)
    setError(null)

    try {
      const data = await obtenerConfiguracionAlertas()
      setConfigs((data?.configs || []).map(normalizeConfig))
      setMessage(DEFAULT_MESSAGE)
    } catch (err) {
      setError(err?.message || 'No se pudo cargar la configuración de alertas.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadConfigs()
  }, [])

  const activeCount = useMemo(() => configs.filter((item) => item.activo).length, [configs])

  const enabledAlerts = useMemo(
    () =>
      configs.reduce((acc, item) => {
        if (item.alerta_5_dias) acc += 1
        if (item.alerta_1_dia) acc += 1
        if (item.alerta_vencido) acc += 1
        return acc
      }, 0),
    [configs]
  )

  const updateConfig = (procesoKey, field, value) => {
    setConfigs((prev) =>
      prev.map((item) => (item.proceso_key === procesoKey ? { ...item, [field]: value } : item))
    )
  }

  const saveConfigs = async () => {
    setSaving(true)
    setError(null)
    setMessage('Guardando configuración...')

    try {
      const data = await guardarConfiguracionAlertas(configs)
      setConfigs((data?.configs || []).map(normalizeConfig))
      setMessage('Configuración guardada correctamente.')
      toast.success('Configuración guardada correctamente.')
    } catch (err) {
      const errorMessage = err?.message || 'No se pudo guardar la configuración.'
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  const runAlerts = async () => {
    setRunning(true)
    setError(null)
    setMessage('Ejecutando barrido de alertas...')

    try {
      const data = await ejecutarAlertas()

      setSummary(data?.summary || null)
      setMessage('Barrido de alertas ejecutado correctamente.')
      setPreview(null)

      const { enviadas = 0, omitidas = 0, fallidas = 0 } = data?.summary || {}

      if (enviadas > 0 && fallidas === 0) {
        toast.success(`Alertas enviadas correctamente: ${enviadas}`)
      } else if (enviadas > 0 && fallidas > 0) {
        toast.warning(
          `Envío parcial: ${enviadas} enviadas, ${fallidas} fallidas${omitidas ? `, ${omitidas} omitidas` : ''}`
        )
      } else if (fallidas > 0) {
        toast.error(`No se pudo enviar ninguna alerta. Fallidas: ${fallidas}`)
      } else {
        toast.info(`No había alertas para enviar${omitidas ? `. Omitidas: ${omitidas}` : ''}`)
      }
    } catch (err) {
      const errorMessage = err?.message || 'No se pudo ejecutar el barrido de alertas.'
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setRunning(false)
    }
  }

  const previewAlerts = async () => {
    setPreviewLoading(true)
    setError(null)

    try {
      setPreview(await previsualizarAlertas())
      toast.info('Vista previa generada. Revisa y confirma el envío.')
    } catch (err) {
      const errorMessage = err?.message || 'No se pudo generar la vista previa.'
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setPreviewLoading(false)
    }
  }

  const cancelPreview = () => {
    setPreview(null)
    setError(null)
  }

  return (
    <div className={PAGE_SHELL}>
      <PageHeader
        icon={<BellRing />}
        title="Alertas de Auditoría Interna"
        subtitle="Activa o desactiva notificaciones por proceso y ejecuta un barrido manual para validar el comportamiento."
        stats={
          <>
            <HeaderStat label="Procesos activos" value={activeCount} />
            <HeaderStat label="Alertas habilitadas" value={enabledAlerts} />
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={loadConfigs} disabled={loading}>
          <RefreshCw className={loading ? 'animate-spin' : undefined} />
          Recargar
        </Button>
        <Button onClick={saveConfigs} disabled={saving || loading}>
          <Save />
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </Button>
        <Button
          variant="success"
          onClick={previewAlerts}
          disabled={previewLoading || loading}
          title="Se mostrará una vista previa de los correos a enviar"
        >
          <Play />
          {previewLoading ? 'Generando vista previa…' : 'Ejecutar alertas ahora'}
        </Button>
      </div>

      {(message || error) && (
        <div className="flex flex-col gap-2">
          {message && (
            <p className="flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {message}
            </p>
          )}
          {error && (
            <p className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </p>
          )}
        </div>
      )}

      <section className={TABLE_CONTAINER}>
        <div className={TABLE_TOOLBAR}>
          <h2 className="text-sm font-semibold">Configuración por proceso</h2>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Proceso</TableHead>
              <TableHead>Bucket</TableHead>
              <TableHead className="text-center">Vence (días)</TableHead>
              <TableHead className="text-center">Activo</TableHead>
              <TableHead className="text-center">Alerta 5d</TableHead>
              <TableHead className="text-center">Alerta 1d</TableHead>
              <TableHead className="text-center">Vencido</TableHead>
              <TableHead className="text-center">Repetición</TableHead>
              <TableHead className="text-center">Estado</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {loading && <TableEmpty colSpan={9}>Cargando configuración de alertas…</TableEmpty>}

            {!loading && configs.length === 0 && (
              <TableEmpty colSpan={9}>No hay procesos configurados.</TableEmpty>
            )}

            {!loading &&
              configs.map((config) => (
                <TableRow key={config.proceso_key}>
                  <TableCell className="font-medium">{config.proceso_label}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {config.bucket || '—'}
                  </TableCell>
                  <TableCell className="text-center tabular-nums">
                    {config.due_offset_business_days}
                  </TableCell>

                  <CeldaCheck
                    checked={config.activo}
                    onChange={(v) => updateConfig(config.proceso_key, 'activo', v)}
                    label={`Activar ${config.proceso_label}`}
                  />
                  <CeldaCheck
                    checked={config.alerta_5_dias}
                    onChange={(v) => updateConfig(config.proceso_key, 'alerta_5_dias', v)}
                    label={`Alerta 5 días de ${config.proceso_label}`}
                  />
                  <CeldaCheck
                    checked={config.alerta_1_dia}
                    onChange={(v) => updateConfig(config.proceso_key, 'alerta_1_dia', v)}
                    label={`Alerta 1 día de ${config.proceso_label}`}
                  />
                  <CeldaCheck
                    checked={config.alerta_vencido}
                    onChange={(v) => updateConfig(config.proceso_key, 'alerta_vencido', v)}
                    label={`Alerta de vencido de ${config.proceso_label}`}
                  />

                  <TableCell className="text-center">
                    <Badge variant="secondary">{config.dias_repeticion_vencido}d</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant="outline"
                      className={cn(STATUS_BADGE_TONES[config.activo ? 'success' : 'neutral'])}
                    >
                      {config.activo ? 'Monitoreado' : 'Suspendido'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </section>

      {/* Resumen de la última ejecución */}
      <section className={cn(SECTION_CARD, 'p-5')}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold">Resumen de la última ejecución</h3>
            <p className={PAGE_SUBTITLE}>
              {summary
                ? `Revisadas: ${summary.revisadas} · Configuradas: ${summary.configuradas} · Generadas: ${summary.generadas} · Enviadas: ${summary.enviadas} · Omitidas: ${summary.omitidas} · Fallidas: ${summary.fallidas}`
                : 'Todavía no has ejecutado un barrido de alertas.'}
            </p>
          </div>

          {summary?.detalle?.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setExpandedDetails((v) => !v)}>
              {expandedDetails ? 'Ocultar detalles' : 'Ver detalles'}
            </Button>
          )}
        </div>

        {expandedDetails && summary?.detalle?.length > 0 && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {summary.detalle.map((item, index) => (
              <TarjetaDetalle key={`${item.auditId}-${index}`} item={item} />
            ))}
          </div>
        )}
      </section>

      {/* Vista previa antes de enviar */}
      <Dialog open={Boolean(preview)} onOpenChange={(open) => (open ? null : cancelPreview())}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Confirmar ejecución de alertas</DialogTitle>
            <DialogDescription>
              Esto enviará correos reales a los auditores. Revisa el detalle antes de confirmar.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-3 gap-3">
            {[
              { valor: preview?.stats?.sera_enviado || 0, label: 'Se enviarán', tono: 'info' },
              { valor: preview?.stats?.omitida || 0, label: 'Omitidas', tono: 'neutral' },
              { valor: preview?.stats?.fallida || 0, label: 'Fallidas', tono: 'danger' },
            ].map((stat) => (
              <div
                key={stat.label}
                className={cn('rounded-lg border p-3 text-center', STATUS_BADGE_TONES[stat.tono])}
              >
                <p className="text-2xl font-semibold tabular-nums">{stat.valor}</p>
                <p className="text-xs font-medium">{stat.label}</p>
              </div>
            ))}
          </div>

          <div className="max-h-72 overflow-y-auto">
            <div className="grid gap-3 sm:grid-cols-2">
              {(preview?.preview ?? []).map((item, index) => (
                <TarjetaDetalle key={`preview-${item.auditId}-${index}`} item={item} />
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={cancelPreview} disabled={running}>
              Cancelar
            </Button>
            <Button onClick={runAlerts} disabled={running}>
              {running ? 'Enviando alertas…' : 'Confirmar y enviar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
