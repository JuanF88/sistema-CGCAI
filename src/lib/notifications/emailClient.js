import nodemailer from 'nodemailer'

let cachedTransporter = null

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
    }
  } catch (error) {
    return {
      ok: false,
      skipped: false,
      reason: 'send_failed',
      message: error?.message || 'No se pudo enviar el correo.',
    }
  }
}
