import { NextResponse } from 'next/server'
import { getAuthenticatedClient } from '@/lib/authHelper'
import { sendCredentialsEmail, sendAlertEmail } from '@/lib/notifications'
import { buildProfessionalTemplateFromText } from '@/lib/notifications/templates'

export async function POST(request) {
  const { usuario, error } = await getAuthenticatedClient()

  if (error) {
    return NextResponse.json({ error }, { status: 401 })
  }

  if (usuario?.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { to, subject, email, password, nombre, apellido, nombreCompleto, text } = body || {}

    if (!to || !subject) {
      return NextResponse.json({ error: 'to y subject son obligatorios.' }, { status: 400 })
    }

    // Si tenemos email y password, usamos buildCredentialsTemplate
    if (email && password) {
      const result = await sendCredentialsEmail({
        nombre: nombre || '',
        apellido: apellido || '',
        email,
        password,
      })

      if (result.ok) {
        return NextResponse.json({ ok: true, notification: result })
      }

      return NextResponse.json({ ok: false, notification: result }, { status: 400 })
    }

    // Si tenemos texto, usamos buildProfessionalTemplateFromText
    if (!text) {
      return NextResponse.json({
        error: 'Debes proporcionar email/password o text.',
        status: 400,
      })
    }

    const html = buildProfessionalTemplateFromText({
      subject,
      text,
      nombreCompleto,
      processKeyValue: false,
    })

    // Solo enviar HTML para evitar duplicación de contenido
    const result = await sendAlertEmail({ to, subject, html })

    if (result.ok) {
      return NextResponse.json({ ok: true, notification: result })
    }

    return NextResponse.json({ ok: false, notification: result }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ error: err?.message || 'Error interno del servidor.' }, { status: 500 })
  }
}
