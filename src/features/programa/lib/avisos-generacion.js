import 'server-only'

/**
 * Aviso a los auditores de las auditorías que genera un programa.
 *
 * Crear una auditoría a mano (`POST /api/informes`) manda un correo al auditor
 * asignado; generarlas desde el programa no mandaba ninguno, así que quien
 * recibía diez auditorías de golpe no se enteraba hasta entrar al sistema.
 *
 * ── Por qué hay un interruptor ──
 * Un clic aquí puede disparar cuarenta correos a cuarenta personas reales. Eso
 * no se prueba en producción a ver qué pasa. Por defecto el envío está
 * **apagado**: se resuelve todo —quién, a qué dirección, con qué datos— y se
 * devuelve la lista sin mandar nada, para poder revisarla. Encender
 * `NOTIFICAR_GENERACION_AUDITORIAS=true` es lo único que hace falta después.
 *
 * En modo simulado no se toca el servidor de correo: no es que se envíe y se
 * descarte, es que no se llama.
 */
import { sendAuditAssignmentEmail } from '@/lib/notifications'
import { isEmailConfigured } from '@/lib/notifications/emailClient'

/** ¿Se manda de verdad, o solo se resuelve a quién se mandaría? */
const envioActivo = () =>
  String(process.env.NOTIFICAR_GENERACION_AUDITORIAS ?? '').toLowerCase() === 'true'

/**
 * Los destinatarios de un lote de auditorías recién creadas.
 *
 * Una entrada por auditoría, no por auditor: si a alguien le tocan tres
 * dependencias recibe tres avisos, que es lo mismo que pasa creándolas a mano
 * y lo que hace que cada correo hable de una auditoría concreta.
 *
 * Se descartan sin ruido los auditores inactivos o sin correo: no es un fallo
 * de la generación, es que a esa persona no se le puede escribir.
 */
export function destinatariosDeLote(filas, usuariosPorId, dependenciasPorId) {
  const destinatarios = []
  const sinCorreo = []

  for (const fila of filas) {
    const auditor = usuariosPorId.get(fila.usuario_id)
    const dependencia = dependenciasPorId.get(fila.dependencia_id)

    if (!auditor?.email || String(auditor.estado ?? '').toLowerCase() !== 'activo') {
      sinCorreo.push(dependencia?.nombre ?? `dependencia ${fila.dependencia_id}`)
      continue
    }

    destinatarios.push({
      email: auditor.email,
      nombre: auditor.nombre ?? '',
      apellido: auditor.apellido ?? '',
      dependencia: dependencia?.nombre ?? 'Dependencia asignada',
      fechaAuditoria: fila.fecha_auditoria,
    })
  }

  return { destinatarios, sinCorreo }
}

/**
 * Avisa —o hace como que avisa— a los auditores del lote.
 *
 * Nunca lanza: las auditorías ya están creadas y un fallo del correo no puede
 * deshacerlas ni convertir la operación en un error. Lo que salga mal se
 * cuenta en el resultado y se ve en el diálogo.
 *
 * Los correos van de uno en uno a propósito: son pocos, el transporte es un
 * pool con tres conexiones y un lote en paralelo es la forma más rápida de que
 * un proveedor lo tome por envío masivo.
 *
 * @returns {Promise<{modo: 'enviado'|'simulado'|'sin-configurar',
 *                    total: number, enviados: number, fallidos: number,
 *                    sinCorreo: string[], destinatarios: string[]}>}
 */
export async function avisarAsignaciones({ destinatarios, sinCorreo }) {
  const base = {
    total: destinatarios.length,
    enviados: 0,
    fallidos: 0,
    sinCorreo,
    destinatarios: destinatarios.map((d) => d.email),
  }

  if (!destinatarios.length) return { ...base, modo: envioActivo() ? 'enviado' : 'simulado' }

  if (!envioActivo()) {
    console.info(
      `[programa] simulación de avisos: ${destinatarios.length} correos NO enviados. ` +
        'Pon NOTIFICAR_GENERACION_AUDITORIAS=true para enviarlos de verdad.'
    )
    return { ...base, modo: 'simulado' }
  }

  if (!isEmailConfigured()) {
    console.warn('[programa] envío activado pero el SMTP no está configurado; no se manda nada.')
    return { ...base, modo: 'sin-configurar' }
  }

  for (const destinatario of destinatarios) {
    try {
      const resultado = await sendAuditAssignmentEmail(destinatario)
      if (resultado?.ok) base.enviados++
      else base.fallidos++
    } catch (error) {
      console.warn('[programa] aviso no enviado:', error?.message ?? error)
      base.fallidos++
    }
  }

  return { ...base, modo: 'enviado' }
}
