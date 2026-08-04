# Arquitectura — Sistema CGCAI

Next.js 16 (App Router) + Supabase (Postgres, Auth y Storage), desplegado en Vercel.

Los patrones siguen los de **SoluGRH** (`Contexto/GUIA_BACKEND.md`, `GUIA_FRONTEND.md`,
`GUIA_ESTILOS.md`) adaptados a Next: capas por dominio, DTOs con Zod, jerarquía de
errores, y estilos con Tailwind + shadcn sobre un tema de variables CSS.

---

## 1. Estructura de carpetas

```
src/
├─ app/                     # SOLO rutas. Las páginas son delgadas.
│  ├─ page.js               # login (Server Component)
│  ├─ admin/  auditor/  visualizador/
│  └─ api/                  # Route Handlers (hacen de "controller")
│
├─ features/                # un módulo por dominio de negocio
│  └─ <dominio>/
│     ├─ api/               # llamadas HTTP tipadas  ← lo consume la UI
│     ├─ types/             # formas de los datos (JSDoc)
│     ├─ dto/               # esquemas Zod de entrada ← lo usa la ruta
│     ├─ components/        # pantallas y piezas del dominio
│     ├─ hooks/  services/  utils/
│
├─ components/
│  ├─ layout/               # el shell de cada rol + navigation.js
│  └─ ui/                   # primitivos shadcn + tokens de clase
│
├─ lib/                     # infraestructura, sin JSX
│  ├─ config/    env.public.js · env.server.js
│  ├─ supabase/  client.js · server.js · admin.js
│  ├─ api/       guard.js · handler.js · errors.js · response.js · http.js
│  ├─ auth/      roles.js · session.js · logout.js
│  ├─ dto/       common.js
│  ├─ excel/     readSheet.js
│  ├─ alertas/   auditAlertService.js
│  └─ notifications/
│
└─ proxy.js                 # protección de rutas por rol (antes middleware.js)
```

**Idioma:** aquí el código va en **español**, a diferencia de SoluGRH. Las columnas de
Supabase son españolas (`usuario_id`, `fecha_auditoria`, `dependencia_id`) y no se
pueden renombrar sin migrar la BD; poner el código en inglés produciría justo los
identificadores mixtos que la guía prohíbe (`auditId` junto a `fecha_auditoria`).

---

## 2. El viaje de una petición

```
componente
   ↓  llama a features/<dominio>/api/<x>-api.js   (nunca `fetch` directo)
lib/api/http.js         fetchJson → normaliza el error a ApiError
   ↓
app/api/<x>/route.js    withRoute()  ← traduce cualquier throw a JSON
   ↓  requireRole()     valida sesión + rol           (lib/api/guard.js)
   ↓  <x>Schema.parse() valida el body con Zod        (features/<x>/dto/)
   ↓  guard.supabase | guard.admin  → Supabase
   ↑  ok() / created() / json()                       (lib/api/response.js)
```

Ejemplo completo (`src/app/api/dependencias/route.js`):

```js
export const POST = withRoute(async (request) => {
  const guard = await requireRole(ROLES.ADMIN)
  if (!guard.ok) return guard.response

  const dto = crearDependenciaSchema.parse(await request.json())

  const { data, error } = await guard.supabase
    .from('dependencias').insert(dto).select(CAMPOS).single()

  if (error) throw fromPostgresError(error)
  return created(data)
})
```

### Errores

Todo cuelga de `DomainError` (`lib/api/errors.js`) y la respuesta tiene siempre
la misma forma:

```json
{ "code": "VALIDATION_ERROR", "message": "Datos inválidos.",
  "details": { "fields": [{ "path": "email", "message": "Correo inválido." }] },
  "error": "Datos inválidos." }
```

| Clase | Status | Código |
|---|---|---|
| `ValidationError` | 400 | `VALIDATION_ERROR` |
| `AuthError.unauthorized()` | 401 | `UNAUTHORIZED` |
| `AuthError.forbidden()` | 403 | `FORBIDDEN` |
| `NotFoundError` | 404 | `NOT_FOUND` |
| `ConflictError` | 409 | `CONFLICT` |

`error` es un **alias en desuso**: existe solo porque parte del front todavía lee
`data.error`. Al escribir código nuevo usa `message`.

`details` es el canal para que el front reaccione distinto según el caso sin
parsear el mensaje.

---

## 3. Los tres clientes de Supabase

Antes había **28 llamadas sueltas a `createClient`**. Ahora hay tres:

| Módulo | Clave | Respeta RLS | Dónde |
|---|---|---|---|
| `lib/supabase/client.js` | anon | ✅ | componentes `'use client'` |
| `lib/supabase/server.js` | anon + cookies | ✅ | Server Components y rutas |
| `lib/supabase/admin.js` | **service-role** | ❌ | solo servidor, vía `supabaseAdmin()` |

`server.js` y `admin.js` importan `server-only`: si alguno acaba en un bundle de
cliente, el build falla.

---

## 4. Entorno

Ningún módulo lee `process.env` directamente.

- `lib/config/env.public.js` → las `NEXT_PUBLIC_*`, validadas con Zod. Se puede
  importar desde cualquier sitio.
- `lib/config/env.server.js` → todo lo demás, con `getServerEnv()`. La validación
  es perezosa a propósito: un `throw` al importar rompería `next build`.

Única excepción documentada: `src/proxy.js` lee `process.env` directamente para no
arrastrar el módulo `server-only` al runtime edge.

---

## 5. Autenticación y autorización

Tres capas, ninguna confía en el navegador:

1. **`src/proxy.js`** — refresca la sesión y corta el acceso a `/admin`,
   `/auditor`, `/visualizador`, `/gestor`. Sin sesión → `/`; rol equivocado → su
   propio panel. `/api/*` no se bloquea aquí, para que responda JSON y no un redirect.
2. **`lib/auth/session.js`** — `requirePageRole([...])` en el Server Component de
   la ruta; devuelve el usuario ya verificado, que baja por props.
3. **`lib/api/guard.js`** — `requireRole([...])` en cada Route Handler.
   `requireCronOrRole()` acepta además el secreto del cron de Vercel.

`lib/auth/roles.js` es la única fuente de verdad. **Usa las agrupaciones**, no
arrays sueltos:

```js
AUDITORIA_READ_ROLES   // admin, auditor, visualizador
AUDITORIA_WRITE_ROLES  // admin, auditor
EVALUACION_READ_ROLES  // admin, visualizador
ADMIN_ONLY_ROLES       // admin
```

---

## 6. Estilos

**No se escribe CSS suelto en código nuevo.** Todo son clases de Tailwind sobre un
tema de variables CSS, materializadas en primitivos shadcn con `cva` y combinadas
con `cn()`.

- **Tema** en `src/app/globals.css`: colores semánticos en HSL bajo `:root` y
  `.dark` (`background`, `foreground`, `primary`, `muted`, `destructive`,
  `success`, `warning`, `border`, `input`, `ring`, `--radius`). `--primary` es el
  azul institucional `#6387d6`.
  El modo oscuro es **opt-in con la clase `.dark`**, no por preferencia del SO.
- **Primitivos** en `src/components/ui/`: `Button`, `Input`, `Textarea`, `Label`,
  `Badge`, `Card`, `Dialog`, `Select`, `Table`. Se regeneran con el CLI de shadcn
  (`components.json` ya está configurado), no se editan a mano salvo necesidad.
- **Piezas propias del diseño CGCAI**, también en `components/ui/`:
  - `PageHeader` / `HeaderStat` — el header con gradiente institucional, que es
    la seña de identidad del diseño. El gradiente sale de `--header-from` /
    `--header-to`, así que el modo oscuro lo ajusta solo. **Toda pantalla nueva
    debe abrir con `PageHeader`.**
  - `StatCard` — tarjeta de KPI con borde de color e icono sobre chip degradado
    (`tone`: blue, purple, green, cyan, orange, pink, indigo, gray).
  - `SearchInput` — buscador con lupa y botón de limpiar.
  - `ViewToggle` — selector de vistas en píldoras; variante `onHeader` para
    cuando va sobre el gradiente.
  - `DataTablePagination` + `usePagination` — paginación estándar de listas.
- **`AppShell`** (`components/layout/`) es el marco autenticado: panel lateral
  con el banner institucional + contenido. Antes había tres copias casi
  idénticas (admin, auditor, visualizador); ahora cada panel solo le pasa su
  menú y su contenido. **El padding de página lo pone `AppShell`**, por eso
  `PAGE_SHELL` no lleva padding.
- **`cn()`** (`@/lib/utils`) = clsx + tailwind-merge. Por eso pasar `className` a
  un primitivo funciona: tu clase vence a la base cuando compiten.
- **Tokens** en `src/components/ui/tokens.js`: `PAGE_SHELL`, `PAGE_TITLE`,
  `TABLE_CONTAINER`, `STATUS_BADGE_TONES`, `FILTER_PILL_*`…

### La escalera

1. Clase Tailwind inline → para lo puntual y único.
2. Constante local al archivo → si el mismo estilo se repite en esa pantalla.
3. Token compartido o componente → si se repite entre pantallas.

Nunca copiar el mismo string de clases en dos lugares lejanos.

### Modo claro / oscuro

Botón flotante abajo a la derecha (`components/ui/theme-toggle.jsx`), montado una
vez en el layout raíz. Alterna la clase `.dark` en `<html>` y guarda la elección
en `localStorage` (`cgcai:theme`). Un script inline en el `<head>` la aplica antes
del primer pintado para que no haya parpadeo.

El valor por defecto es **claro**, no la preferencia del sistema.

### Estado de la migración

**No queda ningún CSS module.** Todo el CSS del proyecto vive en
`src/app/globals.css` (256 líneas: tokens de tema, utilidades de marca y
animaciones); el resto es Tailwind + primitivos de `components/ui/`.

Pantallas de referencia según el patrón que necesites:

### Formularios

Los primitivos de formulario siguen el patrón de SoluGRH: grupos de campos en
paneles tintados con un rótulo pequeño en versalitas, y los formularios largos
en un panel lateral en vez de un diálogo centrado.

| Primitivo | Para qué |
|---|---|
| `FormSection` | Panel del grupo de campos. `tone="required"` (borde continuo, azul) / `"optional"` (discontinuo, gris) y los tonos de estado |
| `Field` + `FieldGrid` | Etiqueta + control + ayuda/error, en rejilla de 3 columnas. El error pinta el control en rojo desde el contenedor |
| `Drawer` | Panel lateral sobre `vaul`: `DrawerHeader` fijo, `DrawerBody` desplazable, `DrawerFooter` fijo |
| `FormDrawer` | Los dos anteriores ya montados: cabecera, cuerpo y pie con Cancelar/Guardar |
| `StickyBar` | Barra de acciones pegada al fondo, para formularios a página completa |

`FormularioRegistro` los usa todos y acepta `embebido` para no repetir cabecera
cuando ya vive dentro de un drawer.

### Pantallas de referencia

| Patrón | Mirar |
|---|---|
| El marco de la app | `AppShell` + los 3 paneles |
| Pantalla completa fuera del shell | `LoginForm` |
| Listado + CRUD sencillo | `VistaAdministrarDependencias` |
| Listado + formulario largo por secciones | `VistaAdministrarUsuarios` |
| Formulario con bloques repetidos por configuración | `FormularioRegistro` |
| Línea de tiempo con etapas y estados | `AuditoriasTimeline` |
| Maestro-detalle con filtros y varios modales | `VistaTimeline` |
| Panel de gráficas con pestañas | `VistaEstadisticas` |
| Matriz editable + exportación a Excel | `VistaEvaluacionAuditores` |
| Heatmap / malla de control | `VistaInformesAdmin` |
| Listado con paginación y exportación | `VistaPlanMejoraAdmin` |
| KPIs + gráficas exportables a PNG | `MiDashboardAuditor` |

`/design-preview` (solo en `npm run dev`, en producción da 404) es un escaparate
con el header, las tarjetas KPI, la tabla, los badges, las variantes de botón y
los primitivos de formulario, para revisar el sistema de diseño de un vistazo en
claro y en oscuro.

> Antes vivía en `src/app/__preview/` y **nunca fue accesible**: Next excluye del
> enrutado todo segmento que empiece por `_` (carpetas privadas), así que daba
> 404 también en desarrollo.

---

## 7. Variables de entorno

| Variable | Uso |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | clave pública |
| `SUPABASE_SERVICE_ROLE_KEY` | **secreta** — service-role, solo servidor |
| `SMTP_HOST` `SMTP_PORT` `SMTP_SECURE` `SMTP_USER` `SMTP_PASS` `SMTP_FROM` | correo |
| `APP_LOGIN_URL` `APP_ASSET_BASE_URL` | enlaces y logos en los correos |
| `CRON_SECRET` / `ALERTAS_CRON_SECRET` | autoriza el cron de alertas |

---

## 8. Recetas

- **Una llamada al backend**: tipos en `features/<x>/types/`, función en
  `features/<x>/api/<x>-api.js` usando `@/lib/api/http`, y consumirla desde la
  pantalla. Nunca `fetch` en el componente.
- **Un endpoint**: esquema Zod en `features/<x>/dto/`, handler en
  `app/api/<x>/route.js` envuelto en `withRoute` + `requireRole`.
- **Un ítem de menú**: `src/components/layout/navigation.js`, no en el shell.
- **Un permiso nuevo**: agrupación en `lib/auth/roles.js`, no un array suelto.
- **Un primitivo**: `npx shadcn@latest add <componente>`.

---

## 9. Verificación

No hay tests automáticos. "Verificar" es:

```bash
npm run lint       # eslint . — todo el repo, no solo src/
npm run typecheck  # tsc --noEmit
npm run build
npm run dev        # y probarlo
```

Los tres primeros los ejecuta también GitHub Actions en cada push a `main` y en
cada pull request (`.github/workflows/ci.yml`). El build de CI no necesita
credenciales: usa valores de relleno para las variables `NEXT_PUBLIC_*`.

---

## 10. Pendientes conocidos

1. **`usuarios.password` en texto plano** — ver `docs/MIGRACION-PASSWORDS.md`. Es
   la deuda de seguridad que queda; el procedimiento está escrito pero **no
   ejecutado**.
2. **Sin tests.** Hay CI (`.github/workflows/ci.yml`: lint + typecheck + build),
   pero ninguna prueba automática que valide comportamiento.
3. **Formularios con `useState`** — SoluGRH usa react-hook-form + zod. Aquí los
   esquemas Zod ya existen en `features/<x>/dto/`; falta conectarlos al formulario.
4. **`tailwind.config.js` sigue en formato v3.** Tailwind v4 lo lee (verificado:
   quitarlo cambia el CSS generado), pero lo idiomático es mover sus
   `animation`/`keyframes` al bloque `@theme` de `globals.css`.
5. **Flujo de rúbrica por auditor sin conectar** — `seleccionarAuditor`,
   `actualizarCalificacion`, `calcularNotaRubrica`, `guardarEvaluacionRubrica` y
   `cancelarEvaluacion` en `VistaEvaluacionAuditores` están escritos y con su
   estado, pero no los llama nadie: hoy se evalúa desde la matriz. Se conservan a
   propósito.
6. **Filtro «Comparar con» sin efecto** — en `VistaEstadisticas` el desplegable
   existe pero ningún cálculo lo lee; el «Análisis de variación» compara siempre
   los dos últimos años disponibles.
7. **Advisories sin arreglo hacia delante.** `npm audit` propone «arreglarlos»
   *bajando* de versión (next→9.3.3, exceljs→3.4.0, @vercel/analytics→1.1.4):
   son downgrades, no parches. Vienen de `postcss`/`sharp` dentro de `next` y de
   la cadena `archiver/glob/minimatch` dentro de `exceljs`. El paso de CI que
   los revisa es informativo (`continue-on-error`).
