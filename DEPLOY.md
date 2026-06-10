# Despliegue: Vercel (frontend) + Render (backend)

## URLs de producción

| Servicio | URL |
|----------|-----|
| Frontend | https://control-de-stock-smoky.vercel.app |
| Backend  | https://control-de-stock-back.onrender.com |

---

## 1. Render (backend)

En [Render Dashboard](https://dashboard.render.com) → tu servicio **control-de-stock-back** → **Environment**:

| Variable | Valor |
|----------|--------|
| `NODE_ENV` | `production` |
| `DEMO_MODE` | `true` (o `false` si usás Supabase) |
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

> **Persistencia demo:** `demo-db.json` **no está en Git** (solo `demo-db.seed.json` como plantilla inicial). En Render hay un disco persistente en `backend/data` para que egresos, stock y cambios en la web **no se borren** al hacer push. Si el servicio ya existía, en Dashboard → **Disks** agregá un disco montado en `/opt/render/project/src/data` (1 GB).
>
> Para producción con muchos usuarios, conviene Supabase (`DEMO_MODE=false` + `SUPABASE_*`).

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
