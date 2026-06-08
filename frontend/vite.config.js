import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

const API_URL = import.meta.env.VITE_API_URL;

fetch(`${API_URL}/api/productos`)

// Backend en la misma PC (Vite hace proxy → otros dispositivos no necesitan tocar el puerto 3001)
const API_TARGET = process.env.VITE_PROXY_TARGET || 'http://127.0.0.1:3001';

export default defineConfig({
  plugins: [react(), basicSsl()],
  server: {
    host: true, // 0.0.0.0 — accesible desde la red local (https://192.168.x.x:5173)
    port: 5173,
    https: true, // cámara QR en celular exige contexto seguro (HTTPS)
    strictPort: false,
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
      '/inventario': { target: API_TARGET, changeOrigin: true },
      '/movimientos': { target: API_TARGET, changeOrigin: true },
      '/egreso': { target: API_TARGET, changeOrigin: true },
      '/ingreso': { target: API_TARGET, changeOrigin: true },
      '/contenedor': { target: API_TARGET, changeOrigin: true },
      '/sync': { target: API_TARGET, changeOrigin: true },
      '/api/auth': { target: API_TARGET, changeOrigin: true },
      '/api/admin': { target: API_TARGET, changeOrigin: true },
      '/api/ubicacion': { target: API_TARGET, changeOrigin: true },
      '/docs': { target: API_TARGET, changeOrigin: true },
      '/admin': { target: API_TARGET, changeOrigin: true },
    },
  },
});
