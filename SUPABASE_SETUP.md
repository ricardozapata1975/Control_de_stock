# Base de datos estable (Supabase) — Render Free

En **Render plan Free** no hay disco persistente. Cualquier archivo en el servidor (JSON o SQLite) **se borra en cada deploy**.

La solución es **Supabase** (PostgreSQL gratis en la nube). Los datos viven fuera de Render y no se pierden al hacer `git push`.

## 1. Crear proyecto en Supabase

1. [supabase.com](https://supabase.com) → nuevo proyecto (plan Free).
2. **Project Settings → API**:
   - **Project URL** → `SUPABASE_URL`
   - **service_role** (secret) → `SUPABASE_SERVICE_ROLE_KEY`

## 2. Ejecutar SQL (en orden)

En **SQL Editor** del proyecto:

1. `supabase/schema.sql`
2. `supabase/schema-admin.sql`
3. `supabase/schema-ubicacion.sql`
4. `supabase/schema-items-campos.sql`
5. `supabase/schema-users.sql`

## 3. Migrar inventario actual

En tu PC (`backend/.env`):

```env
DEMO_MODE=false
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

```powershell
cd backend
npm install
npm run db:migrate-supabase
```

Carga `demo-db.seed.json` (181 ítems, contenedores, stock, movimientos) en Supabase.

## 4. Configurar Render

Servicio **control-de-stock-back** → **Environment**:

| Variable | Valor |
|----------|--------|
| `DEMO_MODE` | `false` |
| `SUPABASE_URL` | URL del proyecto |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role |
| `JWT_SECRET` | clave larga aleatoria |
| `ADMIN_USERNAME` | `admin` |
| `ADMIN_PASSWORD` | tu contraseña |
| `FRONTEND_URL` | `https://control-de-stock-smoky.vercel.app` |
| `CORS_ORIGINS` | `https://control-de-stock-smoky.vercel.app` |

**Manual Deploy** después de guardar.

## 5. Verificar

- `GET /api/health` → `"db": "supabase"`
- Login, inventario, egresos e ingresos con datos persistentes.

## Desarrollo local (SQLite)

Con `DEMO_MODE=true` se usa `backend/data/inventario.sqlite` (no se sube a Git).

```powershell
cd backend
npm run db:import-seed
npm run dev
```

Plantilla de datos: `backend/data/demo-db.seed.json` (sí está en Git).
