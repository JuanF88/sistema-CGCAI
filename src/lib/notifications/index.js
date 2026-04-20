import { sendEmail } from './emailClient'
import { buildAuditAssignmentTemplate, buildAuditDeadlineAlertTemplate, buildCredentialsTemplate } from './templates'

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

export async function sendAuditAssignmentEmail({
  nombre,
  apellido,
  email,
  dependencia,
  fechaAuditoria,
  fechaSeguimiento,
  loginUrl,
}) {
  const { subject, html } = buildAuditAssignmentTemplate({
    nombre,
    apellido,
    dependencia,
    fechaAuditoria,
    fechaSeguimiento,
    loginUrl,
  })

  return sendEmail({
    to: email,
    subject,
    html,
  })
}

export async function sendAuditDeadlineAlertEmail({
  email,
  nombre,
  apellido,
  processLabel,
  alertTitle,
  summary,
  detail,
  ctaLabel,
  dependencyName,
  auditId,
  dueDateText,
  loginUrl,
}) {
  const { subject, html } = buildAuditDeadlineAlertTemplate({
    processLabel,
    alertTitle,
    summary,
    detail,
    ctaLabel,
    dependencyName,
    auditId,
    dueDateText,
    loginUrl,
    nombre,
    apellido,
  })

  return sendEmail({
    to: email,
    subject,
    html,
  })
}
