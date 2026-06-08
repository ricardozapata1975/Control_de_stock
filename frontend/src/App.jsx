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
import Item from './pages/Item';
import AdminStock from './pages/AdminStock';
import ImportarCSV from './pages/ImportarCSV';
import AdminDatabase from './pages/AdminDatabase';

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
              <Route path="escanear" element={<EscanearQR />} />
              <Route path="imprimir-qr" element={<ImprimirQR />} />
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
                path="admin/base-datos"
                element={
                  <AdminRoute>
                    <AdminDatabase />
                  </AdminRoute>
                }
              />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </SyncProvider>
    </AuthProvider>
  );
}
