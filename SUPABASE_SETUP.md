# Conectar Supabase — proyecto **herramientas**

**Project ref:** `lxkkgudlaumcjxksjywh`  
**URL:** `https://lxkkgudlaumcjxksjywh.supabase.co`

Esperá a que el dashboard deje de mostrar **"Coming up..."** y aparezca la URL del proyecto.

---

## Paso 1 — Crear tablas (SQL Editor)

1. Supabase → proyecto **herramientas** → **SQL Editor** → **New query**
2. Abrí el archivo `supabase/full-setup.sql` del repo
3. Copiá **todo** el contenido y pegá en el editor
4. Clic **Run** (debe decir Success)

---

## Paso 2 — Copiar credenciales API

**Project Settings** (engranaje) → **API**:

| Variable | Dónde copiarla |
|----------|----------------|
| `SUPABASE_URL` | Project URL → `https://lxkkgudlaumcjxksjywh.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | **service_role** (secret, no la anon key) |

---

## Paso 3 — Configurar `backend/.env` (tu PC)

```env
DEMO_MODE=false
SUPABASE_URL=https://lxkkgudlaumcjxksjywh.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...tu-clave-service-role...

ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
JWT_SECRET=una-clave-larga-aleatoria
```

---

## Paso 4 — Migrar inventario

```powershell
cd D:\inventario-herramientas\backend
npm install
npm run db:migrate-supabase
```

Carga contenedores, ítems, stock, movimientos y crea el usuario **admin**.

---

## Paso 5 — Configurar Render (producción)

En **control-de-stock-back** → **Environment**:

| Variable | Valor |
|----------|--------|
| `DEMO_MODE` | `false` |
| `SUPABASE_URL` | `https://lxkkgudlaumcjxksjywh.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | (misma service_role) |
| `JWT_SECRET` | clave larga aleatoria |
| `ADMIN_USERNAME` | `admin` |
| `ADMIN_PASSWORD` | tu contraseña |
| `FRONTEND_URL` | `https://control-de-stock-smoky.vercel.app` |
| `CORS_ORIGINS` | `https://control-de-stock-smoky.vercel.app` |

**Manual Deploy** en Render.

---

## Paso 6 — Verificar

- `https://control-de-stock-back.onrender.com/api/health` → `"db": "supabase"`
- Login admin en la web
- Inventario con tus herramientas

Los datos quedan en Supabase y **no se borran** al hacer push a Git.
