# Inventario Taller — React + Express + Supabase

Gestión profesional de inventario de herramientas con PostgreSQL (Supabase), API REST, QR por contenedor y soporte offline-first.

## Estructura

```
inventario-herramientas/
├── supabase/
│   ├── schema.sql      # Tablas + funciones transaccionales
│   └── seed.sql        # Datos demo
├── backend/            # Node.js + Express + Supabase
├── frontend/           # React + Vite + Tailwind + Zustand
└── mobile/             # Expo (opcional)
```

## Requisitos

- Node.js 18+
- Proyecto en [Supabase](https://supabase.com)

---

## 1. Configurar Supabase

1. Crear proyecto en Supabase.
2. **SQL Editor** → ejecutar `supabase/schema.sql`.
3. Ejecutar `supabase/seed.sql` (datos demo).
4. **Settings → API** → copiar:
   - Project URL → `SUPABASE_URL`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (solo backend, nunca en frontend)

---

## 2. Variables de entorno

**backend/.env** (copiar de `backend/.env.example`):

| Variable | Descripción |
|----------|-------------|
| `SUPABASE_URL` | URL del proyecto |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave service role |
| `PORT` | Puerto API (default 3001) |
| `LOW_STOCK_THRESHOLD` | Umbral stock bajo |
| `FRONTEND_URL` | Origen CORS (http://localhost:5173) |

**frontend/.env**:

| Variable | Descripción |
|----------|-------------|
| `VITE_API_URL` | http://localhost:3001 |

---

## 3. Ejecutar

```powershell
cd D:\inventario-herramientas\backend
npm install
npm run dev
```

```powershell
cd D:\inventario-herramientas\frontend
npm install
npm run dev
```

Abrir http://localhost:5173 → ingresar nombre de usuario.

---

## Modelo de datos

| Tabla | Descripción |
|-------|-------------|
| `contenedores` | Ubicación física + `codigo` QR (A01-E1-C1) |
| `items` | Herramientas (nombre, marca, tipo…) |
| `stock` | Cantidad por item + contenedor (≥ 0) |
| `movimientos` | egreso / ingreso, usuario, sync offline |

Operaciones atómicas vía funciones SQL: `registrar_egreso`, `registrar_ingreso`.

---

## API REST

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/inventario` | Stock con filtros `q`, `ubicacion`, `tipo` |
| GET | `/contenedor/:codigo` | Inventario del contenedor |
| GET | `/movimientos` | Historial (`usuario`, `desde`, `hasta`, `pendiente`) |
| POST | `/egreso` | Retiro `{ itemId, contenedorId, cantidad, usuario }` |
| POST | `/ingreso` | Devolución `{ movimientoId, usuario }` |
| POST | `/sync` | Lote offline `[{ tipo, data, clientId, timestamp }]` |

Prefijo `/api` también disponible (`/api/inventario`, etc.).

---

## Offline

- **Frontend:** IndexedDB + `navigator.onLine`
- **Backend:** `POST /sync` con idempotencia por `offline_id`
- Banner: *"Sin conexión - trabajando offline"*

---

## QR

- Códigos en tabla `contenedores.codigo`
- Pantalla **Etiquetas** para imprimir QR
- **Escanear QR** con html5-qrcode → `/contenedor/:codigo`

---

## Reglas de negocio

- Stock nunca negativo (CHECK + validación en transacción)
- Cada egreso/ingreso genera fila en `movimientos`
- Devolución vinculada al egreso vía `egreso_movimiento_id`
