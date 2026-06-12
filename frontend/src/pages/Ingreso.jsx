import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { useSync } from '../context/SyncContext';
import { useAuth } from '../auth/AuthProvider';
import { api } from '../api/client';
import FilterableSelect from '../components/FilterableSelect';
import { filterPendientesByScan, parsedFromCodigoParam } from '../utils/scanMatch';
import { QR_TYPES } from '../utils/qrPayload';

export default function Ingreso() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const { loading, error, registrarIngreso, clearError, fetchInventario, inventario } = useStore();
  const { executeOrQueue } = useSync();
  const [pendientes, setPendientes] = useState([]);
  const [movimientoId, setMovimientoId] = useState('');
  const [success, setSuccess] = useState(false);
  const [offlineSaved, setOfflineSaved] = useState(false);

  const load = async () => {
    const data = await api.pendientes();
    setPendientes(data.movimientos || []);
  };

  useEffect(() => {
    load();
    fetchInventario();
  }, []);

  const scopedPendientes = useMemo(() => {
    const itemId = searchParams.get('itemId');
    const codigo = searchParams.get('codigo');
    if (!itemId && !codigo) return pendientes;
    const parsed = itemId
      ? { type: QR_TYPES.ITEM, itemId }
      : parsedFromCodigoParam(codigo, searchParams.get('tipoUbicacion') || '');
    return filterPendientesByScan(pendientes, parsed, inventario);
  }, [pendientes, inventario, searchParams]);

  useEffect(() => {
    const pre = searchParams.get('movimientoId');
    if (pre && pendientes.some((m) => m.id === pre)) {
      setMovimientoId(pre);
      return;
    }
    const itemId = searchParams.get('itemId');
    const contenedorId = searchParams.get('contenedorId');
    if (itemId && contenedorId) {
      const match = pendientes.find(
        (m) => m.itemId === itemId && m.contenedorId === contenedorId
      );
      if (match) setMovimientoId(match.id);
      return;
    }
    if (itemId && !searchParams.get('codigo')) {
      const matches = pendientes.filter((m) => m.itemId === itemId);
      if (matches.length === 1) setMovimientoId(matches[0].id);
    }
  }, [searchParams, pendientes]);

  const options = useMemo(
    () =>
      scopedPendientes.map((m) => ({
        value: m.id,
        label: `${m.nombreHerramienta} — ${m.usuario} (${m.cantidad} u.) ${m.fecha?.slice?.(0, 10) || ''}`,
        searchText: `${m.nombreHerramienta} ${m.usuario} ${m.contenedorCodigo} ${m.itemId} ${m.marca} ${m.tipo}`,
      })),
    [scopedPendientes]
  );

  const selected = pendientes.find((m) => m.id === movimientoId);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await registrarIngreso(
      { movimientoId, usuario: user?.name || 'Sistema' },
      executeOrQueue
    );
    if (result?.ok) {
      setSuccess(true);
      setOfflineSaved(!!result.offline);
      setMovimientoId('');
      load();
      fetchInventario();
    }
  };

  const preselected =
    searchParams.get('movimientoId') ||
    (searchParams.get('itemId') && searchParams.get('contenedorId'));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-2">
        <h2 className="page-title">REGISTRAR INGRESO</h2>
        <Link to="/escanear" className="btn-secondary shrink-0 py-2 text-base">
          📷 QR
        </Link>
      </div>

      {preselected && movimientoId && (
        <p className="alert-warning mb-4 text-sm">Egreso pendiente precargado desde el escaneo QR.</p>
      )}
      {preselected && !movimientoId && searchParams.get('itemId') && (
        <p className="alert-warning mb-4 text-sm">
          No hay devolución pendiente para la herramienta seleccionada.
        </p>
      )}

      {error && (
        <div className="alert-error mb-4">
          {error}
          <button type="button" className="ml-2 underline" onClick={clearError}>
            Cerrar
          </button>
        </div>
      )}
      {success && (
        <div className="alert-success mb-4">
          {offlineSaved ? 'Guardado offline.' : 'Devolución registrada.'}
        </div>
      )}

      <form onSubmit={handleSubmit} className="card max-w-lg space-y-5">
        <div>
          <label className="text-label">Egreso pendiente</label>
          <p className="mb-2 text-xs text-subtle">
            Escribí para filtrar por herramienta, usuario o ubicación.
          </p>
          <FilterableSelect
            options={options}
            value={movimientoId}
            onChange={setMovimientoId}
            placeholder="Buscar egreso pendiente…"
            emptyMessage="Ningún egreso pendiente coincide"
            disabled={!options.length}
          />
          {!pendientes.length && (
            <p className="mt-2 text-muted">No hay devoluciones pendientes.</p>
          )}
          {pendientes.length > 0 && !options.length && (
            <p className="mt-2 text-muted">Ningún egreso pendiente coincide con el QR escaneado.</p>
          )}
        </div>
        {selected && (
          <div className="rounded-lg border border-border bg-surface-muted p-3 text-sm text-content">
            {selected.contenedorCodigo} · {selected.armarioNombre || selected.ubicacion} / {selected.estante}
            {selected.contenedor ? ` / ${selected.contenedor}` : ''}
          </div>
        )}
        <button type="submit" className="btn-primary w-full" disabled={loading || !movimientoId}>
          {loading ? 'PROCESANDO...' : 'CONFIRMAR DEVOLUCIÓN'}
        </button>
      </form>
    </div>
  );
}
