# Email — recuperación de contraseña e invitaciones

El flujo **Olvidé mi contraseña** envía un enlace a `users.email`.

Desde **Admin → Usuarios**, el botón **Enviar invitación** manda un correo de bienvenida con los pasos del primer ingreso (usuario sin contraseña). Requiere que el usuario tenga correo y esté activo.

## Variables en Render / `backend/.env`

| Variable | Descripción |
|----------|-------------|
| `EMAIL_PROVIDER` | `console` (dev), `smtp` o `resend` |
| `EMAIL_FROM` | Remitente, ej. `Inventario Px Control <noreply@pxcontrol.com>` |
| `FRONTEND_URL` | Base del enlace, ej. `https://control-de-stock-smoky.vercel.app` |

### Opción A — Resend (recomendado)

```env
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_...
EMAIL_FROM=Inventario Px Control <onboarding@resend.dev>
```

### Opción B — SMTP (Office 365 / Gmail)

```env
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=administracion@pxcontrol.com
SMTP_PASS=...
EMAIL_FROM=Inventario Px Control <administracion@pxcontrol.com>
```

### Desarrollo local

```env
EMAIL_PROVIDER=console
```

El enlace de reset se imprime en la consola del backend.

### Invitación de bienvenida (primer ingreso)

Con `EMAIL_PROVIDER=console`, al enviar una invitación desde Admin → Usuarios verás en la consola del backend:

```
[Email/console] Welcome email
  To: usuario@empresa.com
  Usuario: jperez
  Login: http://localhost:5173/login
```

El correo incluye la URL de login (`FRONTEND_URL/login`), el nombre de usuario y los pasos para crear la contraseña.

## Supabase — parche SQL

Si la tabla `users` ya existe, ejecutá en **SQL Editor**:

`supabase/patch-users-email-reset.sql`

Agrega columnas `email`, `reset_token`, `reset_token_expires`.

## Importar usuarios Microsoft 365

1. admin.cloud.microsoft → Usuarios → Exportar usuarios (CSV)
2. Admin → **Usuarios** → Importar desde Microsoft 365 Admin
3. Vista previa → Importar

Los usuarios se crean como **operario**, sin contraseña (primer ingreso). El correo del CSV se guarda para recuperación.
