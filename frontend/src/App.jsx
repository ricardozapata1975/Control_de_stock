import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import { SyncProvider } from './context/SyncContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Egreso from './pages/Egreso';
import Ingreso from './pages/Ingreso';
import Historial from './pages/Historial';
import EscanearQR from './pages/EscanearQR';
import Contenedor from './pages/Contenedor';
import ImprimirQR from './pages/ImprimirQR';
import RemitoSalida from './pages/RemitoSalida';
import Item from './pages/Item';
import AdminStock from './pages/AdminStock';
import ImportarCSV from './pages/ImportarCSV';
import AdminUsers from './pages/AdminUsers';
import ConsultaSucursales from './pages/ConsultaSucursales';
import Agenda from './pages/Agenda';
import {
  ProyectosLayout,
  ProyectosDashboard,
  ProyectosLista,
  ProyectoDetail,
  PedidosMasivos,
  ReservasPage,
  FaltantesPage,
  PrioridadesPage,
  ProyectosPlaceholder,
} from './modules/proyectos';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';

function PrivateRoute({ children }) {
  const { isLoggedIn, ready } = useAuth();
  if (!ready) return null;
  if (isLoggedIn) return children;
  return <Navigate to="/login" replace />;
}

function AdminRoute({ children }) {
  const { isLoggedIn, isAdmin, ready } = useAuth();
  if (!ready) return null;
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <SyncProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/olvide-contrasena" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route
              path="/"
              element={
                <PrivateRoute>
                  <Layout />
                </PrivateRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="egreso" element={<Egreso />} />
              <Route path="ingreso" element={<Ingreso />} />
              <Route path="historial" element={<Historial />} />
              <Route path="consulta-sucursales" element={<ConsultaSucursales />} />
              <Route path="agenda" element={<Agenda />} />
              <Route path="proyectos" element={<ProyectosLayout />}>
                <Route index element={<ProyectosDashboard />} />
                <Route path="lista" element={<ProyectosLista />} />
                <Route path="tableros" element={<ProyectosLista />} />
                <Route path="materiales" element={<ProyectosLista />} />
                <Route path="pedidos" element={<PedidosMasivos />} />
                <Route path="reservas" element={<ReservasPage />} />
                <Route path="reservados" element={<ReservasPage />} />
                <Route path="faltantes" element={<FaltantesPage />} />
                <Route path="prioridades" element={<PrioridadesPage />} />
                <Route
                  path="recepciones"
                  element={
                    <ProyectosPlaceholder
                      title="Recepciones"
                      description="Ingreso por remito, OC o carga manual con sugerencias de asignación."
                    />
                  }
                />
                <Route
                  path="transito"
                  element={
                    <ProyectosPlaceholder
                      title="Materiales en tránsito"
                      description="Estado EN TRÁNSITO entre depósitos hasta confirmación de recepción."
                    />
                  }
                />
                <Route
                  path="disponibles"
                  element={
                    <ProyectosPlaceholder
                      title="Materiales disponibles"
                      description="Vista de stock neto (físico − reservas activas) por depósito."
                    />
                  }
                />
                <Route
                  path="devoluciones"
                  element={
                    <ProyectosPlaceholder
                      title="Devoluciones"
                      description="Devolución real a proyecto con trazabilidad (no solo ajuste)."
                    />
                  }
                />
                <Route
                  path="auditorias"
                  element={
                    <ProyectosPlaceholder
                      title="Auditorías"
                      description="Conteo físico vs sistema por depósito/ubicación con escaneo QR."
                    />
                  }
                />
                <Route
                  path="herramientas"
                  element={
                    <ProyectosPlaceholder
                      title="Herramientas"
                      description="Asignación a operarios/cajas con historial de eventos."
                    />
                  }
                />
                <Route
                  path="transferencias"
                  element={
                    <ProyectosPlaceholder
                      title="Transferencias entre depósitos"
                      description="Multidepósito con stock en tránsito."
                    />
                  }
                />
                <Route
                  path="reportes"
                  element={
                    <ProyectosPlaceholder
                      title="Reportes"
                      description="Consumos, reservas, faltantes, costos y tiempos por proyecto."
                    />
                  }
                />
                <Route
                  path="configuracion"
                  element={
                    <ProyectosPlaceholder
                      title="Configuración"
                      description="Roles del módulo (Admin, Supervisor, Depósito, Pañolero, Taller, Compras, Consulta)."
                    />
                  }
                />
                <Route path=":id" element={<ProyectoDetail />} />
              </Route>
              <Route path="escanear" element={<EscanearQR />} />
              <Route path="imprimir-qr" element={<ImprimirQR />} />
              <Route path="remito" element={<RemitoSalida />} />
              <Route path="contenedor/:codigo" element={<Contenedor />} />
              <Route path="item/:itemId" element={<Item />} />
              <Route
                path="admin"
                element={
                  <AdminRoute>
                    <AdminStock />
                  </AdminRoute>
                }
              />
              <Route
                path="admin/importar"
                element={
                  <AdminRoute>
                    <ImportarCSV />
                  </AdminRoute>
                }
              />
              <Route
                path="admin/usuarios"
                element={
                  <AdminRoute>
                    <AdminUsers />
                  </AdminRoute>
                }
              />
              <Route path="admin/base-datos" element={<Navigate to="/admin/usuarios" replace />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </SyncProvider>
    </AuthProvider>
  );
}
