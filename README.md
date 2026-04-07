This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Modulo de Mensajeria por Correo

El proyecto incluye un modulo de notificaciones por correo basado en SMTP (compatible con Gmail + App Password).

### Variables de entorno

Agrega estas variables en tu archivo `.env.local`:

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=tu_correo@gmail.com
SMTP_PASS=tu_app_password_de_gmail
SMTP_FROM="CGCAI <tu_correo@gmail.com>"
APP_LOGIN_URL=https://sistema-cgcai.vercel.app/
# Opcional: base publica para assets en correo (logo)
APP_ASSET_BASE_URL=https://sistema-cgcai.vercel.app
```

### Flujo actual

- Al crear un usuario desde `POST /api/usuarios`, se intenta enviar automaticamente el correo con credenciales.
- Si SMTP no esta configurado o falla el envio, el usuario igual se crea y la API retorna el estado de notificacion en el campo `notification`.

### Ubicacion del modulo

- `src/lib/notifications/emailClient.js`
- `src/lib/notifications/templates.js`
- `src/lib/notifications/index.js`
