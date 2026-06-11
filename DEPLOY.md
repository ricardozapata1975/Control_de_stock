# Despliegue: Vercel (frontend) + Render (backend)

## URLs de producción

| Servicio | URL |
|----------|-----|
| Frontend | https://control-de-stock-smoky.vercel.app |
| Backend  | https://control-de-stock-back.onrender.com |

---

## 1. Render (backend)

En [Render Dashboard](https://dashboard.render.com) → tu servicio **control-de-stock-back** → **Environment**:

### Producción con Supabase (recomendado en Render)

Render Free no tiene disco persistente: usá **Supabase** y **no** dejes `DEMO_MODE=true`. Pasos completos (tablas, claves, verificación): [SUPABASE_SETUP.md](./SUPABASE_SETUP.md).

| Variable | Valor |
|----------|--------|
| `NODE_ENV` | `production` |
| `DEMO_MODE` | `false` |
| `SUPABASE_URL` | URL del proyecto (ej. `https://<ref>.supabase.co`) |
| `SUPABASE_SERVICE_ROLE_KEY` | clave **service_role** / secret del backend (no la publishable del frontend) |
| `FRONTEND_URL` | `https://control-de-stock-smoky.vercel.app` |
| `CORS_ORIGINS` | `https://control-de-stock-smoky.vercel.app` |
| `JWT_SECRET` | una clave larga aleatoria (no usar la de ejemplo) |
| `ADMIN_USERNAME` | tu usuario admin |
| `ADMIN_PASSWORD` | contraseña segura |
| `PORT` | lo asigna Render automáticamente |

**Settings del servicio:**

- **Root Directory:** `backend`
- **Build Command:** `npm install`
- **Start Command:** `npm start`
- **Health Check Path:** `/api/health`

Probar: https://control-de-stock-back.onrender.com/api/health → debe responder `{"status":"ok",...}`

> **Solo desarrollo local:** `DEMO_MODE=true` usa SQLite (`inventario.sqlite`), no JSON. No uses ese modo en Render.

---

## 2. Vercel (frontend)

En [Vercel Dashboard](https://vercel.com) → proyecto → **Settings** → **Environment Variables**:

| Variable | Valor | Entornos |
|----------|--------|----------|
| `VITE_API_URL` | `https://control-de-stock-back.onrender.com` | Production, Preview, Development |

**Settings del proyecto:**

- **Root Directory:** `frontend`
- **Framework Preset:** Vite
- **Build Command:** `npm run build`
- **Output Directory:** `dist`

Después de guardar variables → **Deployments** → **Redeploy** (obligatorio: Vite embebe `VITE_*` en el build).

Probar: abrir https://control-de-stock-smoky.vercel.app → login operario o admin.

---

## 3. Verificar conexión

1. Abrí el frontend en el celular o PC.
2. Iniciá sesión como operario (nombre cualquiera) o admin.
3. Si falla, abrí DevTools (F12) → pestaña **Network** y buscá errores CORS o `Failed to fetch`.
4. El backend en Render (plan free) puede tardar ~30 s en despertar tras inactividad.

---

## 4. Actualizar el sitio tras cambios en Git

```powershell
cd D:\inventario-herramientas
git add .
git commit -m "Descripción del cambio"
git push origin main
```

- **Vercel** redeploya automáticamente al detectar push en `main`.
- **Render** redeploya automáticamente si está conectado al mismo repo.

---

## 5. Cámara QR en producción

Vercel sirve HTTPS → la cámara QR funciona en el celular sin configuración extra.
