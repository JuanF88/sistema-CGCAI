function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function getAssetBaseUrl() {
  const raw = process.env.APP_ASSET_BASE_URL || process.env.APP_LOGIN_URL || ''
  return String(raw).trim().replace(/\/$/, '')
}

function getUniversityLogoUrl() {
  const base = getAssetBaseUrl()
  if (!base) return ''
  return `${base}/logo-universidad.png`
}

function renderKeyValueBlock(text = '') {
  const lines = String(text)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const pairs = lines
    .map((line) => {
      const idx = line.indexOf(':')
      if (idx <= 0) return null
      const key = line.slice(0, idx).trim()
      const value = line.slice(idx + 1).trim()
      if (!key || !value) return null
      return { key, value }
    })
    .filter(Boolean)

  if (!pairs.length) return ''

  const rows = pairs
    .map(({ key, value }) => `
      <tr>
        <td style="padding: 8px 10px; border-bottom: 1px solid #dbeafe; color: #1e3a8a; font-weight: 700; width: 36%; vertical-align: top;">${escapeHtml(key)}</td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #dbeafe; color: #0f172a; vertical-align: top;">${escapeHtml(value)}</td>
      </tr>
    `)
    .join('')

  return `
    <div style="margin: 0 0 14px; border: 1px solid #bfdbfe; border-radius: 12px; overflow: hidden; background: #eff6ff;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; table-layout: fixed;">
        <tbody>${rows}</tbody>
      </table>
    </div>
  `
}

function textToHtml(text = '', processKeyValue = false) {
  const raw = String(text)
  const keyValueCard = processKeyValue ? renderKeyValueBlock(raw) : ''
  const paragraphs = raw
    .split('\n\n')
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p style="margin: 0 0 12px; line-height: 1.65; color: #334155; white-space: normal; word-break: break-word; overflow: visible; text-overflow: clip;">${escapeHtml(block).replace(/\n/g, '<br/>')}</p>`)
    .join('')

  return `${keyValueCard}${paragraphs}`
}

function wrapProfessionalTemplate({ title, subtitle, intro, bodyHtml, footer }) {
  const logoUrl = getUniversityLogoUrl()
  return `
  <div style="margin:0; padding:24px; background:#f1f5f9; font-family: 'Segoe UI', Arial, sans-serif;">
    <div style="max-width: 680px; margin: 0 auto; background: #ffffff; border: 1px solid #dbeafe; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);">
      <div style="background: linear-gradient(135deg, #1d4ed8 0%, #1e3a8a 100%); padding: 24px; color: #ffffff; position: relative;">
        ${logoUrl ? `<div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; opacity: 0.08; background: url('${escapeHtml(logoUrl)}') center/contain no-repeat; pointer-events: none;"></div>` : ''}
        <div style="position: relative; z-index: 1;">
          <div style="font-size: 12px; letter-spacing: 0.08em; opacity: 0.9; text-transform: uppercase; font-weight: 700; margin-bottom: 12px;">Sistema CGCAI</div>
          <h1 style="margin: 0 0 8px; font-size: 24px; line-height: 1.2; font-weight: 700;">${escapeHtml(title)}</h1>
          <p style="margin: 0; font-size: 13px; opacity: 0.9;">${escapeHtml(subtitle)}</p>
        </div>
      </div>

      <div style="padding: 24px;">
        ${intro ? `<p style="margin: 0 0 16px; color: #0f172a; font-size: 15px; line-height: 1.6;"><strong>${escapeHtml(intro)}</strong></p>` : ''}
        ${bodyHtml}
      </div>

      <div style="border-top: 1px solid #e2e8f0; padding: 14px 24px; background: #f8fafc; font-size: 12px; color: #64748b; line-height: 1.6; white-space: normal; word-break: break-word;">
        ${escapeHtml(footer || 'Este es un mensaje oficial del Sistema CGCAI. Por favor no respondas a este correo.')}
      </div>
    </div>
  </div>`
}

export function buildCredentialsTemplate({ nombre, apellido, email, password, loginUrl }) {
  const nombreCompleto = `${nombre || ''} ${apellido || ''}`.trim() || 'Usuario'
  const acceso = loginUrl || process.env.APP_LOGIN_URL || 'https://sistema-cgcai.vercel.app/'

  const subject = 'Credenciales de acceso - Sistema CGCAI'

  const credentialsCard = `
    <p style="margin:0 0 14px; line-height:1.6; color:#334155; font-size:15px;">Este es un mensaje oficial del Sistema CGCAI. A continuación encontrarás tus credenciales de acceso para ingresar al aplicativo:</p>
    <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:12px; padding:16px; margin: 0 0 16px;">
      <p style="margin:0 0 8px; color:#0f172a;"><strong style="color:#1d4ed8;">Usuario:</strong> <br/><span style="font-family: monospace; background: #f0f9ff; padding: 4px 8px; border-radius: 4px;">${escapeHtml(email)}</span></p>
      <p style="margin:0; color:#0f172a;"><strong style="color:#1d4ed8;">Contraseña temporal:</strong> <br/><span style="font-family: monospace; background: #f0f9ff; padding: 4px 8px; border-radius: 4px;">${escapeHtml(password)}</span></p>
    </div>
    <div style="text-align: center; margin: 0 0 16px;">
      <a href="${escapeHtml(acceso)}" style="display:inline-block; background:linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%); color:#ffffff; text-decoration:none; padding:12px 24px; border-radius:8px; font-weight:700; font-size:15px; box-shadow: 0 4px 12px rgba(29, 78, 216, 0.3);">Ingresar al Sistema</a>
    </div>
    <p style="margin:0; font-size:13px; color:#64748b; line-height:1.5;">Si tienes problemas para acceder o necesitas ayuda, no dudes en contactar al equipo de soporte del Sistema CGCAI.</p>
  `

  const html = wrapProfessionalTemplate({
    title: 'Credenciales de acceso',
    subtitle: 'Notificación para ingresar al Sistema CGCAI',
    intro: `Hola ${escapeHtml(nombreCompleto)},`,
    bodyHtml: credentialsCard,
  })

  return { subject, html }
}

export function buildProfessionalTemplateFromText({ subject, text, intro, nombreCompleto, processKeyValue = false }) {
  const introText = intro || (nombreCompleto ? `Hola ${escapeHtml(nombreCompleto)},` : '')
  return wrapProfessionalTemplate({
    title: subject || 'Notificación CGCAI',
    subtitle: 'Mensaje desde el Sistema CGCAI',
    intro: introText,
    bodyHtml: textToHtml(text, processKeyValue),
  })
}
