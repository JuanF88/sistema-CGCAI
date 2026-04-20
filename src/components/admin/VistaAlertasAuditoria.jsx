'use client'

import { useEffect, useMemo, useState } from 'react'
import { Play, RefreshCw, Save, CheckCircle2, AlertTriangle } from 'lucide-react'
import { toast } from 'react-toastify'
import styles from './CSS/VistaAlertasAuditoria.module.css'

const DEFAULT_MESSAGE = 'Sin ejecuciones recientes.'

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
      const res = await fetch('/api/alertas/config')
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data?.error || 'No se pudo cargar la configuración de alertas.')
      }

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
  const enabledAlerts = useMemo(() => {
    return configs.reduce((acc, item) => {
      if (item.alerta_5_dias) acc += 1
      if (item.alerta_1_dia) acc += 1
      if (item.alerta_vencido) acc += 1
      return acc
    }, 0)
  }, [configs])

  const updateConfig = (procesoKey, field, value) => {
    setConfigs((prev) => prev.map((item) => (item.proceso_key === procesoKey ? { ...item, [field]: value } : item)))
  }

  const saveConfigs = async () => {
    setSaving(true)
    setError(null)
    setMessage('Guardando configuración...')

    try {
      const res = await fetch('/api/alertas/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configs }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || 'No se pudo guardar la configuración.')
      }

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
      const res = await fetch('/api/alertas/ejecutar', { method: 'POST' })
      const data = await res.json()

      if (!res.ok) {
        const errorMsg = data?.error || 'No se pudo ejecutar el barrido de alertas.'
        const details = data?.details ? `\n\nDetalles: ${data.details}` : ''
        throw new Error(errorMsg + details)
      }

      setSummary(data?.summary || null)
      setMessage('Barrido de alertas ejecutado correctamente.')
      setPreview(null)

      const summaryData = data?.summary || {}
      const sentCount = summaryData.enviadas || 0
      const skippedCount = summaryData.omitidas || 0
      const failedCount = summaryData.fallidas || 0

      if (sentCount > 0 && failedCount === 0) {
        toast.success(`Alertas enviadas correctamente: ${sentCount}`)
      } else if (sentCount > 0 && failedCount > 0) {
        toast.warning(`Envío parcial: ${sentCount} enviadas, ${failedCount} fallidas${skippedCount ? `, ${skippedCount} omitidas` : ''}`)
      } else if (failedCount > 0) {
        toast.error(`No se pudo enviar ninguna alerta. Fallidas: ${failedCount}`)
      } else {
        toast.info(`No había alertas para enviar${skippedCount ? `. Omitidas: ${skippedCount}` : ''}`)
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
      const res = await fetch('/api/alertas/preview', { method: 'POST' })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data?.error || 'No se pudo generar la vista previa.')
      }

      setPreview(data)
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
    <div className={styles.page}>
      <div className={styles.modernHeader}>
        <div className={styles.headerContent}>
          <div className={styles.headerLeft}>
            <div className={styles.headerIcon}>🔔</div>
            <div>
              <h1 className={styles.headerTitle}>Alertas de Auditoría Interna</h1>
              <p className={styles.headerSubtitle}>
                Activa o desactiva notificaciones por proceso y ejecuta un barrido manual para validar el comportamiento.
              </p>
            </div>
          </div>

          <div className={styles.headerRight}>
            <div className={styles.headerStats}>
              <div className={styles.statChip}>
                <span>Procesos activos</span>
                <strong>{activeCount}</strong>
              </div>
              <div className={styles.statChip}>
                <span>Alertas habilitadas</span>
                <strong>{enabledAlerts}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.toolbar}>
        <button className={styles.secondaryBtn} onClick={loadConfigs} disabled={loading}>
          <RefreshCw size={16} /> Recargar
        </button>
        <button className={styles.primaryBtn} onClick={saveConfigs} disabled={saving || loading}>
          <Save size={16} /> {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
        <button className={styles.alertBtn} onClick={previewAlerts} disabled={previewLoading || loading} title="Se mostará una vista previa de los correos a enviar">
          <Play size={16} /> {previewLoading ? 'Generando vista previa...' : 'Ejecutar alertas ahora'}
        </button>
      </div>

      <div className={styles.feedbackRow}>
        {message && <div className={styles.infoBox}><CheckCircle2 size={16} /> {message}</div>}
        {error && <div className={styles.errorBox}><AlertTriangle size={16} /> {error}</div>}
      </div>

      {loading ? (
        <div className={styles.loadingBox}>Cargando configuración de alertas...</div>
      ) : (
        <div className={styles.tableContainer}>
          <table className={styles.configTable}>
            <thead>
              <tr>
                <th>Proceso</th>
                <th>Bucket</th>
                <th>Vence (días)</th>
                <th>Activo</th>
                <th>Alerta 5d</th>
                <th>Alerta 1d</th>
                <th>Alerta Vencido</th>
                <th>Repetición</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {configs.map((config) => (
                <tr key={config.proceso_key}>
                  <td className={styles.procesName}>
                    <strong>{config.proceso_label}</strong>
                  </td>
                  <td className={styles.monospace}>{config.bucket || '-'}</td>
                  <td className={styles.center}>{config.due_offset_business_days}</td>
                  <td className={styles.center}>
                    <label className={styles.switch}>
                      <input
                        type="checkbox"
                        checked={config.activo}
                        onChange={(event) => updateConfig(config.proceso_key, 'activo', event.target.checked)}
                      />
                      <span />
                    </label>
                  </td>
                  <td className={styles.center}>
                    <input
                      type="checkbox"
                      checked={config.alerta_5_dias}
                      onChange={(event) => updateConfig(config.proceso_key, 'alerta_5_dias', event.target.checked)}
                      className={styles.checkbox}
                    />
                  </td>
                  <td className={styles.center}>
                    <input
                      type="checkbox"
                      checked={config.alerta_1_dia}
                      onChange={(event) => updateConfig(config.proceso_key, 'alerta_1_dia', event.target.checked)}
                      className={styles.checkbox}
                    />
                  </td>
                  <td className={styles.center}>
                    <input
                      type="checkbox"
                      checked={config.alerta_vencido}
                      onChange={(event) => updateConfig(config.proceso_key, 'alerta_vencido', event.target.checked)}
                      className={styles.checkbox}
                    />
                  </td>
                  <td className={styles.center}>
                    <span className={styles.badge}>{config.dias_repeticion_vencido}d</span>
                  </td>
                  <td className={styles.center}>
                    <span className={config.activo ? styles.statusActive : styles.statusInactive}>
                      {config.activo ? 'Monitoreado' : 'Suspendido'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {preview && (
        <div className={styles.modalOverlay} onClick={cancelPreview}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Confirmar ejecución de alertas</h2>
              <button 
                className={styles.modalClose} 
                onClick={cancelPreview}
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.previewStats}>
                <div className={styles.statCard}>
                  <span className={styles.statValue}>{preview.stats?.sera_enviado || 0}</span>
                  <span className={styles.statLabel}>Se enviarán</span>
                </div>
                <div className={styles.statCard}>
                  <span className={styles.statValue}>{preview.stats?.omitida || 0}</span>
                  <span className={styles.statLabel}>Omitidas</span>
                </div>
                <div className={styles.statCard}>
                  <span className={styles.statValue}>{preview.stats?.fallida || 0}</span>
                  <span className={styles.statLabel}>Fallidas</span>
                </div>
              </div>

              <div className={styles.previewList}>
                <h3>Detalles de alertas</h3>
                <div className={styles.previewItems}>
                  {preview.preview && preview.preview.map((item, index) => (
                    <div 
                      key={`preview-${item.auditId}-${index}`} 
                      className={`${styles.previewItem} ${styles[`preview${item.status}`]}`}
                    >
                      <div className={styles.previewItemHeader}>
                        <span className={styles.previewBadge}>{item.status}</span>
                        <strong>Auditoría #{item.auditId}</strong>
                      </div>
                      <div className={styles.previewItemInfo}>
                        <p><span>Proceso:</span> {item.processLabel}</p>
                        <p><span>Dependencia:</span> {item.dependencyName}</p>
                        <p><span>Correo:</span> {item.email}</p>
                        <p><span>Tipo:</span> {item.alertType}</p>
                        <p><span>Días:</span> {item.daysLeft}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button 
                className={styles.cancelBtn}
                onClick={cancelPreview}
                disabled={running}
              >
                Cancelar
              </button>
              <button 
                className={styles.confirmBtn}
                onClick={runAlerts}
                disabled={running}
              >
                {running ? 'Enviando alertas...' : 'Confirmar y enviar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <section className={styles.summaryCard}>
        <div className={styles.summaryHeader}>
          <div>
            <h3>Resumen de la última ejecución</h3>
            <p>{summary ? `Revisadas: ${summary.revisadas} · Configuradas: ${summary.configuradas} · Generadas: ${summary.generadas} · Enviadas: ${summary.enviadas} · Omitidas: ${summary.omitidas} · Fallidas: ${summary.fallidas}` : 'Todavía no has ejecutado un barrido de alertas.'}</p>
          </div>
          {summary && summary.detalle?.length > 0 && (
            <button 
              className={styles.expandBtn}
              onClick={() => setExpandedDetails(!expandedDetails)}
            >
              {expandedDetails ? '▼ Ocultar detalles' : '▶ Ver detalles'}
            </button>
          )}
        </div>

        {expandedDetails && summary?.detalle?.length > 0 && (
          <div className={styles.detailsGrid}>
            {summary.detalle.map((item, index) => (
              <div key={`${item.auditId}-${index}`} className={`${styles.detailItem} ${styles[`status${item.status}`]}`}>
                <div className={styles.detailHeader}>
                  <span className={styles.statusBadge}>{item.status}</span>
                  <strong>Auditoría #{item.auditId}</strong>
                </div>
                <div className={styles.detailInfo}>
                  <p><span>Proceso:</span> {item.processLabel}</p>
                  <p><span>Dependencia:</span> {item.dependencyName}</p>
                  {item.email && <p><span>Correo:</span> {item.email}</p>}
                  {item.alertType && <p><span>Tipo de alerta:</span> {item.alertType}</p>}
                  {item.daysLeft !== undefined && <p><span>Días restantes:</span> {item.daysLeft}</p>}
                  {item.reason && <p><span>Motivo:</span> {formatReason(item.reason)}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function formatReason(reason) {
  const reasons = {
    'ya_enviada_recientemente': 'Alerta ya enviada recientemente',
    'auditor_sin_correo': 'Auditor no tiene correo registrado',
    'error_envio': 'Error al enviar el correo',
    'error_registro_bd': 'Error al registrar en BD',
    'enviado': 'Correo enviado correctamente',
  }
  return reasons[reason] || reason
}
