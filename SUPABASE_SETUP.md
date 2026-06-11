# Conectar Supabase — proyecto **herramientas**



**Project ref:** `lxkkguclaumcjxksjywh`  

**URL:** `https://lxkkguclaumcjxksjywh.supabase.co`



> **Nota:** La publishable key (`sb_publishable_...`) es para el frontend. El backend necesita la **secret / service_role** (`sb_secret_...` o `eyJ...`).



---



## Paso 1 — Crear o reparar tablas



### Verificar qué falta (desde tu PC, sin abrir el dashboard)



```powershell
cd D:\inventario-herramientas\backend
npm run db:check-schema
```



Si ves `FAIL` en `users`, `armario` o `activo`, el esquema está incompleto y hay que aplicar el parche.



### Opción A — SQL Editor (recomendado si no tenés la contraseña de la base)



1. Abrí en el navegador (no depende de Cursor/MCP):

   **https://supabase.com/dashboard/project/lxkkguclaumcjxksjywh/sql/new**

2. En el repo, abrí `supabase/patch-partial-schema.sql`, seleccioná **todo** el contenido (Ctrl+A) y copiá (Ctrl+C).

3. Pegá en el editor SQL de Supabase.

4. Clic **Run** (o Ctrl+Enter) → debe decir **Success**.

5. Volvé a verificar:

   ```powershell
   npm run db:check-schema
   ```

   Debe mostrar solo líneas `OK`.



**Si el proyecto no tiene tablas** (falla `contenedores table`), ejecutá primero `supabase/full-setup.sql` en el mismo SQL Editor, luego el parche si hace falta.



### Opción B — Script automático (requiere contraseña de Database)



1. Supabase → **Project Settings** → **Database** → **Connection string** → **URI**

2. Copiá la URI y agregala en `backend/.env` (no commitear):

   ```env
   DATABASE_URL=postgresql://postgres:TU_PASSWORD@db.lxkkguclaumcjxksjywh.supabase.co:5432/postgres
   ```

   > Es la **contraseña de la base de datos**, no la API secret (`SUPABASE_SERVICE_ROLE_KEY`).

3. Ejecutá:

   ```powershell
   npm run db:apply-patch
   npm run db:check-schema
   ```



---



## Paso 2 — Copiar credenciales API



**Project Settings** (engranaje) → **API**:



| Variable | Dónde copiarla |

|----------|----------------|

| `SUPABASE_URL` | Project URL → `https://lxkkguclaumcjxksjywh.supabase.co` |

| `SUPABASE_SERVICE_ROLE_KEY` | **service_role** o **secret** (no la publishable/anon) |



---



## Paso 3 — Configurar `backend/.env` (tu PC)



```env

DEMO_MODE=false

SUPABASE_URL=https://lxkkguclaumcjxksjywh.supabase.co

SUPABASE_SERVICE_ROLE_KEY=sb_secret_... o eyJ...



ADMIN_USERNAME=admin

ADMIN_PASSWORD=admin123

JWT_SECRET=una-clave-larga-aleatoria

```



---



## Paso 4 — Migrar inventario



Solo después de que `npm run db:check-schema` muestre todo **OK**:



```powershell

cd D:\inventario-herramientas\backend

npm install

npm run db:migrate-supabase

```



Carga contenedores, ítems, stock, movimientos y crea el usuario **admin**.



Si falla con *"Falta la tabla users"* o *"column armario does not exist"*, volvé al **Paso 1**.



---



## Paso 5 — Configurar Render (producción)



En **control-de-stock-back** → **Environment**:



| Variable | Valor |

|----------|--------|

| `DEMO_MODE` | `false` |

| `SUPABASE_URL` | `https://lxkkguclaumcjxksjywh.supabase.co` |

| `SUPABASE_SERVICE_ROLE_KEY` | (misma secret/service_role) |

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



---



## CLI opcional (Supabase CLI)



```powershell

# Instalar: https://supabase.com/docs/guides/cli

supabase login

supabase init

supabase link --project-ref lxkkguclaumcjxksjywh

```



El SQL del repo se aplica manualmente en el **SQL Editor** (más simple que la CLI para este proyecto).

