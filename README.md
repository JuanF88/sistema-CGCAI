# Sistema CGCAI — Auditorías Internas

Sistema de gestión de auditorías internas del Centro de Gestión de la Calidad y
Acreditación Institucional. Next.js 16 (App Router) + Supabase, desplegado en Vercel.

## Arranque

```bash
npm install
npm run dev          # http://localhost:3000
```

Necesitas un `.env.local` con las variables de la sección siguiente.

| Comando | Qué hace |
|---|---|
| `npm run dev` | servidor de desarrollo (Turbopack) |
| `npm run build` | build de producción |
| `npm run start` | sirve el build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run migrate:files` | renombra archivos históricos en Storage |

## Variables de entorno

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...        # secreta, solo servidor

# Correo (SMTP, compatible con Gmail + App Password)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=tu_correo@gmail.com
SMTP_PASS=tu_app_password
SMTP_FROM="CGCAI <tu_correo@gmail.com>"
APP_LOGIN_URL=https://sistema-cgcai.vercel.app/
APP_ASSET_BASE_URL=https://sistema-cgcai.vercel.app   # opcional, logos del correo

# Cron de alertas (define al menos una)
CRON_SECRET=...
ALERTAS_CRON_SECRET=...
```

## Estructura

```
src/app/        rutas (páginas delgadas) y Route Handlers
src/features/   un módulo por dominio, cada uno con api/ types/ dto/ components/
src/components/ layout/ (shell por rol + navigation.js) y ui/ (primitivos shadcn)
src/lib/        config/, supabase/, api/, auth/, dto/, excel/, notifications/
src/proxy.js    protección de rutas por rol
sql/            migraciones y políticas RLS
docs/           documentación
scripts/        utilidades de mantenimiento
```

Detalle completo en **[`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md)**.

### Reglas que no se negocian

- Los componentes **nunca llaman `fetch` directamente**: usan
  `features/<dominio>/api/`.
- Las rutas de API validan la entrada con **Zod** (`features/<dominio>/dto/`) y van
  envueltas en `withRoute` + `requireRole`.
- Nadie lee `process.env` directamente: pasa por `lib/config/`.
- En código nuevo **no se escribe CSS suelto**: Tailwind + primitivos de
  `components/ui` + tokens de `components/ui/tokens.js`.
- Los ítems de menú se agregan en `components/layout/navigation.js`, no en el shell.

## Roles

| Rol | Ruta | Puede |
|---|---|---|
| `admin` | `/admin` | todo: auditorías, usuarios, hallazgos, evaluaciones, alertas, estadísticas |
| `auditor` | `/auditor` | sus auditorías, informes, su dashboard, caja de herramientas |
| `visualizador` | `/visualizador` | solo lectura de malla, auditorías, hallazgos y estadísticas |

El acceso lo aplica `src/proxy.js` en el servidor. Las rutas de API lo verifican
otra vez con `requireRole()` de `src/lib/api/guard.js`.

## Notificaciones por correo

Módulo SMTP en `src/lib/notifications/`. Se usa al crear un usuario
(credenciales), al asignar una auditoría y en las alertas de vencimiento.
Si SMTP no está configurado la operación no falla: la API devuelve el estado en
el campo `notification`.

## Cron de alertas

`vercel.json` ejecuta `/api/alertas/ejecutar` todos los días a las `0 14 * * *`
UTC (9:00 a. m. en Colombia). El endpoint acepta el secreto por
`Authorization: Bearer <secreto>` o `x-cron-secret`, y como alternativa una
sesión de admin (así se dispara a mano desde el panel de alertas).

```bash
curl -X POST "https://TU_DOMINIO/api/alertas/ejecutar" \
  -H "Authorization: Bearer TU_SECRETO"
```

## Importar encuestas de evaluación

La importación (`Evaluación de Auditores → Importar encuestas`) acepta **solo
`.xlsx`**. El formato antiguo `.xls` no está soportado: si aparece uno, hay que
abrirlo en Excel y volver a guardarlo como `.xlsx`. La exportación de Google Forms
ya genera `.xlsx`.

## Notas de seguridad

- `usuarios.password` sigue guardándose en texto plano por el login legacy.
  La API ya no la expone. Procedimiento de retirada en
  **[`docs/MIGRACION-PASSWORDS.md`](docs/MIGRACION-PASSWORDS.md)**.
- Advisories transitivos que quedan abiertos y por qué, en los pendientes de
  `docs/ARQUITECTURA.md`.
