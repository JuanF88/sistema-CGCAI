# Retirada de `usuarios.password`

## Situación actual

El sistema guarda la contraseña **en texto plano** en `usuarios.password`, además
de tenerla correctamente en Supabase Auth. Es el resto de la migración desde el
login antiguo.

Qué se hizo en la fase de refactor:

- ✅ `GET /api/usuarios` ya **no** devuelve la columna `password`.
- ✅ `POST /api/auth/login` ya no la incluye en la respuesta.
- ✅ El formulario de edición de usuarios ya no precarga la contraseña; se deja
  vacío y solo se envía si el admin escribe una nueva.
- ✅ `PUT /api/usuarios` ahora sincroniza el cambio de contraseña también con
  Supabase Auth (antes solo escribía la columna).
- ⏸️ El **camino de login legacy sigue activo** a propósito, para no dejar fuera
  a nadie que aún no tenga `auth_user_id`.

Dónde queda todavía la columna:

| Archivo | Uso |
|---|---|
| `src/app/api/auth/login/route.js` | fallback legacy (`.eq('password', password)`) |
| `src/app/api/usuarios/route.js` | la escribe al crear/actualizar |
| `src/app/api/usuarios/send-credentials/route.js` | la lee para enviarla por correo |

---

## Cómo retirarla

### Paso 1 — comprobar que ya no queda nadie sin migrar

```sql
SELECT count(*) AS sin_migrar
FROM usuarios
WHERE auth_user_id IS NULL
  AND estado = 'activo';
```

Si devuelve algo distinto de `0`, esos usuarios solo pueden entrar por el camino
legacy. Migralos primero con `POST /api/auth/migrate` (requiere sesión de admin).

### Paso 2 — confirmar que nadie usa ya el fallback

Añade una traza temporal en el PASO 2 de `src/app/api/auth/login/route.js`:

```js
console.warn('[login-legacy] usado por', email)
```

Despliega y deja pasar un ciclo completo (idealmente un mes, para cubrir a quien
entra poco). Si no aparece en los logs de Vercel, el camino está muerto.

### Paso 3 — quitar el código

1. En `src/app/api/auth/login/route.js`: borrar los PASOS 2, 3 y 4 y devolver
   401 directamente si `signInWithPassword` falla.
2. En `src/app/api/usuarios/route.js`: quitar `password` del `insert` y de la
   lista de campos actualizables. La contraseña pasa a gestionarse **solo** con
   `supabaseAdmin.auth.admin.createUser` / `updateUserById`.
3. `src/app/api/usuarios/send-credentials/route.js`: ya no puede reenviar la
   contraseña existente. Sustituirlo por un enlace de recuperación:

   ```js
   const { data } = await guard.admin.auth.admin.generateLink({
     type: 'recovery',
     email: userData.email,
   })
   ```

### Paso 4 — soltar la columna

```sql
ALTER TABLE usuarios DROP COLUMN password;
```

Ojo: hay una restricción `usuarios_email_password_key` que se menciona en el
manejo de errores de `/api/usuarios`. Se va con la columna, así que también hay
que quitar ese caso del `catch`.
