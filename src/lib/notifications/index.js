import { sendEmail } from './emailClient'
import { buildCredentialsTemplate } from './templates'

export async function sendCredentialsEmail({ nombre, apellido, email, password, loginUrl }) {
  const { subject, html } = buildCredentialsTemplate({
    nombre,
    apellido,
    email,
    password,
    loginUrl,
  })

  return sendEmail({
    to: email,
    subject,
    html,
  })
}

export async function sendAlertEmail({ to, subject, html, text }) {
  return sendEmail({ to, subject, html, text })
}
