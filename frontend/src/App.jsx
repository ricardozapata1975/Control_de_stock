import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
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
import AdminLocaciones from './pages/AdminLocaciones';
import AdminEditorStock from './pages/AdminEditorStock';
import ImportarCSV from './pages/ImportarCSV';
import AdminUsers from './pages/AdminUsers';
import AdminRoles from './pages/AdminRoles';
import ConsultaSucursales from './pages/ConsultaSucursales';
import Agenda from './pages/Agenda';
import Proveedores from './pages/Proveedores';
import {
  ProyectosLayout,
  ProyectosDashboard,
  ProyectosLista,
  TablerosPage,
  MaterialesPage,
  ProyectoDetail,
  PedidosMasivos,
  ReservasPage,
  FaltantesPage,
  PrioridadesPage,
  RecepcionesPage,
  RecepcionCargaPage,
  RecepcionIngresoPage,
  RecepcionAduanaPage,
  DevolucionesPage,
  AuditoriasPage,
  HerramientasPage,
  ReportesPage,
  ConfiguracionPage,
  DisponiblesPage,
  ProduccionPage,
  TransitoPage,
  TransferenciasPage,
  PendientesCierrePage,
} from './modules/proyectos';
import {
  HerramientasLayout,
  HerramientasDashboard,
  PanolStockPage,
  PrestarPage,
  DevolverPage,
  HistorialPanolPage,
  RecibirPanolPage,
} from './modules/herramientas';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import { hasPermission, permissionForPath } from './utils/permissions';

function PrivateRoute({ children }) {
  const { isLoggedIn, ready } = useAuth();
  if (!ready) return null;
  if (isLoggedIn) return children;
  return <Navigate to="/login" replace />;
}

function PermissionRoute({ permission, children }) {
  const { isLoggedIn, ready, user } = useAuth();
  if (!ready) return null;
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  if (permission && !hasPermission(user, permission)) {
    return <Navigate to="/" replace />;
  }
  return children;
}

/** Protege Outlet del Layout según permiso de la ruta */
function PathPermissionGuard({ children }) {
  const location = useLocation();
  const { user, ready } = useAuth();
  if (!ready) return null;
  const perm = permissionForPath(location.pathname);
  if (perm && !hasPermission(user, perm)) {
    return <Navigate to="/" replace />;
  }
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
                  <PathPermissionGuard>
                    <Layout />
                  </PathPermissionGuard>
                </PrivateRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="egreso" element={<Egreso />} />
              <Route path="ingreso" element={<Ingreso />} />
              <Route path="historial" element={<Historial />} />
              <Route path="consulta-sucursales" element={<ConsultaSucursales />} />
              <Route path="agenda" element={<Agenda />} />
              <Route
                path="agenda/proveedores"
                element={
                  <PermissionRoute permission="agenda.proveedores">
                    <Proveedores />
                  </PermissionRoute>
                }
              />
              <Route path="proyectos" element={<ProyectosLayout />}>
                <Route index element={<ProyectosDashboard />} />
                <Route path="lista" element={<ProyectosLista />} />
                <Route path="tableros" element={<TablerosPage />} />
                <Route path="materiales" element={<MaterialesPage />} />
                <Route path="pedidos" element={<PedidosMasivos />} />
                <Route path="reservas" element={<ReservasPage />} />
                <Route path="reservados" element={<Navigate to="/proyectos/reservas" replace />} />
                <Route path="faltantes" element={<FaltantesPage />} />
                <Route path="prioridades" element={<PrioridadesPage />} />
                <Route path="recepciones" element={<RecepcionesPage />} />
                <Route path="recepciones/carga" element={<RecepcionCargaPage />} />
                <Route path="recepciones/ingreso" element={<RecepcionIngresoPage />} />
                <Route path="recepciones/ingreso/:id" element={<RecepcionIngresoPage />} />
                <Route path="recepciones/aduana" element={<RecepcionAduanaPage />} />
                <Route path="devoluciones" element={<DevolucionesPage />} />
                <Route path="auditorias" element={<AuditoriasPage />} />
                <Route path="herramientas" element={<HerramientasPage />} />
                <Route path="reportes" element={<ReportesPage />} />
                <Route path="configuracion" element={<ConfiguracionPage />} />
                <Route path="transito" element={<TransitoPage />} />
                <Route path="disponibles" element={<DisponiblesPage />} />
                <Route path="produccion" element={<ProduccionPage />} />
                <Route path="transferencias" element={<TransferenciasPage />} />
                <Route path="pendientes-cierre" element={<PendientesCierrePage />} />
                <Route path=":id" element={<ProyectoDetail />} />
              </Route>
              <Route
                path="herramientas"
                element={
                  <PermissionRoute permission="herramientas.ver">
                    <HerramientasLayout />
                  </PermissionRoute>
                }
              >
                <Route index element={<HerramientasDashboard />} />
                <Route path="stock" element={<PanolStockPage />} />
                <Route
                  path="recibir"
                  element={
                    <PermissionRoute permission="herramientas.recibir">
                      <RecibirPanolPage />
                    </PermissionRoute>
                  }
                />
                <Route
                  path="prestar"
                  element={
                    <PermissionRoute permission="herramientas.prestar">
                      <PrestarPage />
                    </PermissionRoute>
                  }
                />
                <Route
                  path="devolver"
                  element={
                    <PermissionRoute permission="herramientas.devolver">
                      <DevolverPage />
                    </PermissionRoute>
                  }
                />
                <Route path="historial" element={<HistorialPanolPage />} />
              </Route>
              <Route path="escanear" element={<EscanearQR />} />
              <Route path="imprimir-qr" element={<ImprimirQR />} />
              <Route path="remito" element={<RemitoSalida />} />
              <Route path="contenedor/:codigo" element={<Contenedor />} />
              <Route path="item/:itemId" element={<Item />} />
              <Route path="admin" element={<Navigate to="/admin/roles" replace />} />
              <Route
                path="admin/locaciones"
                element={
                  <PermissionRoute permission="agenda.locaciones">
                    <AdminLocaciones />
                  </PermissionRoute>
                }
              />
              <Route
                path="admin/editor-stock"
                element={
                  <PermissionRoute permission="inventario.editor_stock">
                    <AdminEditorStock />
                  </PermissionRoute>
                }
              />
              <Route
                path="admin/importar"
                element={
                  <PermissionRoute permission="inventario.importar">
                    <ImportarCSV />
                  </PermissionRoute>
                }
              />
              <Route
                path="admin/usuarios"
                element={
                  <PermissionRoute permission="agenda.usuarios">
                    <AdminUsers />
                  </PermissionRoute>
                }
              />
              <Route
                path="admin/roles"
                element={
                  <PermissionRoute permission="admin.roles">
                    <AdminRoles />
                  </PermissionRoute>
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
