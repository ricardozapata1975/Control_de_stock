# Inventario Taller — App móvil (Expo)

React Native + Expo con modo oscuro, botones grandes, escáner QR, sincronización offline.

## Pantallas

| Pantalla | Ruta | Descripción |
|----------|------|-------------|
| Login | `/login` | Acceso demo o Microsoft |
| Inicio | `/(app)/home` | Menú principal |
| Escáner QR | `/(app)/scan` | Cámara + vibración al leer |
| Contenedor | `/(app)/contenedor/[id]` | Inventario + retirar/devolver |
| Egreso | `/(app)/egreso` | Retiro de herramientas |
| Ingreso | `/(app)/ingreso` | Devoluciones pendientes |

## Offline

- Acciones `egreso` / `ingreso` se guardan en cola local si no hay red o falla el servidor.
- Reintento automático al reconectar, cada 30 s y con backoff exponencial.
- Banner superior muestra estado y permite forzar sincronización.

## Configuración

```powershell
cd mobile
npm install
```

Crear `.env` (copiar de `.env.example`):

```env
# IP de tu PC en la red Wi‑Fi (no uses localhost en dispositivo físico)
EXPO_PUBLIC_API_URL=http://192.168.1.100:3001
```

Backend en la misma máquina:

```powershell
cd ..\backend
npm run dev
```

Asegurate que `DEMO_MODE=true` en `backend/.env` para probar sin Azure.

## Ejecutar

```powershell
npm start
```

- `a` → Android emulator  
- Escaneá el QR con **Expo Go** en el teléfono (misma red Wi‑Fi)

## Códigos QR demo

- `A01-E1-C1` — Taller A, E1, C1  
- `A01-E2-C3` — Taller A, E2, C3  
- `DEP01-E1-C2` — Depósito, E1, C2

## UX industrial

- Botones mín. 64px de alto  
- Tema oscuro fijo (`userInterfaceStyle: dark`)  
- Vibración fuerte al escanear (`expo-haptics`)
