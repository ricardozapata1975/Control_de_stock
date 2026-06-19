# Email — recuperación de contraseña e invitaciones

El flujo **Olvidé mi contraseña** envía un enlace a `users.email`.

Desde **Admin → Usuarios**, el botón **Enviar invitación** manda un correo de bienvenida con los pasos del primer ingreso (usuario sin contraseña). Requiere que el usuario tenga correo y esté activo.

## Variables en Render / `backend/.env`

| Variable | Descripción |
|----------|-------------|
| `EMAIL_PROVIDER` | `console` (dev), `smtp` o `resend` |
| `EMAIL_FROM` | Remitente. Producción (dominio verificado): `Inventario Px Control <noreply@pxcontrol.com>`. Pruebas sin dominio: `Inventario Px Control <onboarding@resend.dev>` |
| `FRONTEND_URL` | Base del enlace, ej. `https://control-de-stock-smoky.vercel.app` |

### Opción A — Resend (recomendado en Render)

SMTP desde Render hacia Office 365 suele colgarse o fallar. **Usá Resend con API HTTP** (`EMAIL_PROVIDER=resend`):

```env
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_...
EMAIL_FROM=Inventario Px Control <noreply@pxcontrol.com>
```

Verificá en `https://control-de-stock-back.onrender.com/api/health` que aparezca `"provider":"resend"` y `"from"` con `noreply@pxcontrol.com`.

> **Importante:** con `onboarding@resend.dev` (solo para pruebas sin dominio verificado) solo podés enviar al **mismo correo con el que creaste la cuenta Resend**. Para invitar a cualquier usuario, usá un dominio verificado en Resend (ej. `pxcontrol.com`) y `EMAIL_FROM` con ese dominio.

### Producción: dominio verificado (pxcontrol.com)

El dominio `pxcontrol.com` ya está verificado en Resend. En Render → Environment:

```env
EMAIL_FROM=Inventario Px Control <noreply@pxcontrol.com>
```

Redeploy del backend y volvé a enviar las invitaciones.

### Verificar otro dominio (opcional)

Para enviar desde otro dominio (ej. `systelec.com`):

1. Entrá a [resend.com/domains](https://resend.com/domains) → **Add Domain**
2. Agregá el dominio (ej. `systelec.com`)
3. En el DNS del dominio (donde gestionan el dominio), agregá los registros **SPF**, **DKIM** y **DMARC** que muestra Resend
4. Esperá a que el dominio quede **Verified** (puede tardar unos minutos)
5. En Render → Environment, actualizá `EMAIL_FROM` con un correo de ese dominio verificado, por ejemplo:
   ```env
   EMAIL_FROM=Inventario Px Control <noreply@systelec.com>
   ```
6. Redeploy del backend y volvé a enviar las invitaciones

Hasta verificar un dominio, solo funcionarán las pruebas con `onboarding@resend.dev` al correo de la cuenta Resend.

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
