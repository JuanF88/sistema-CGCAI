import nodemailer from 'nodemailer'

let cachedTransporter = null
const RETRY_DELAYS_MS = [350, 900]
const TRANSIENT_ERROR_CODES = new Set(['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'ESOCKET', 'ECONNREFUSED'])

const requiredEnvVars = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM']

export function getEmailConfig() {
  const rawPass = process.env.SMTP_PASS || ''
  return {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
    user: process.env.SMTP_USER,
    pass: rawPass.replace(/\s+/g, ''),
    from: process.env.SMTP_FROM,
  }
}

export function isEmailConfigured() {
  return requiredEnvVars.every((key) => Boolean(process.env[key]))
}

function buildTransporter() {
  const config = getEmailConfig()

  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
    pool: true,
    maxConnections: 3,
    maxMessages: 100,
  })
}

export function getTransporter() {
  if (!cachedTransporter) {
    cachedTransporter = buildTransporter()
  }
  return cachedTransporter
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isTransientSmtpError(error) {
  const code = String(error?.code || '').toUpperCase()
  if (TRANSIENT_ERROR_CODES.has(code)) return true

  const message = String(error?.message || '').toLowerCase()
  return message.includes('econnreset') || message.includes('socket hang up') || message.includes('timeout')
}

export async function sendEmail({ to, subject, html, text }) {
  if (!isEmailConfigured()) {
    return {
      ok: false,
      skipped: true,
      reason: 'email_not_configured',
      message: 'SMTP no configurado en variables de entorno.',
    }
  }

  const transporter = getTransporter()
  const { from } = getEmailConfig()

  const maxAttempts = RETRY_DELAYS_MS.length + 1

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const info = await transporter.sendMail({
        from,
        to,
        subject,
        html,
        text,
      })

      return {
        ok: true,
        skipped: false,
        messageId: info.messageId,
        attempts: attempt,
      }
    } catch (error) {
      const isRetryable = isTransientSmtpError(error)
      const shouldRetry = isRetryable && attempt < maxAttempts

      console.warn('[Email] Error enviando correo', {
        to,
        attempt,
        maxAttempts,
        code: error?.code,
        message: error?.message,
        retrying: shouldRetry,
      })

      if (!shouldRetry) {
        return {
          ok: false,
          skipped: false,
          reason: isRetryable ? 'send_failed_transient' : 'send_failed',
          message: error?.message || 'No se pudo enviar el correo.',
          attempts: attempt,
        }
      }

      await sleep(RETRY_DELAYS_MS[attempt - 1])
    }
  }

  return {
    ok: false,
    skipped: false,
    reason: 'send_failed',
    message: 'No se pudo enviar el correo.',
  }
}
