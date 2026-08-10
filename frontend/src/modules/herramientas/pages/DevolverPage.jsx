import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../../api/client';
import { useAuth } from '../../../auth/AuthProvider';
import { useStore } from '../../../store/useStore';
import { useSync } from '../../../context/SyncContext';
import FilterableSelect from '../../../components/FilterableSelect';

export default function DevolverPage() {
  const { user, sede } = useAuth();
  const { registrarIngreso, loading, error, clearError } = useStore();
  const { executeOrQueue } = useSync();
  const [searchParams] = useSearchParams();
  const [pendientes, setPendientes] = useState([]);
  const [movimientoId, setMovimientoId] = useState('');
  const [success, setSuccess] = useState('');
  const [formError, setFormError] = useState('');

  const load = async () => {
    const data = await api.herramientasPendientes(sede ? { sede } : {});
    setPendientes(data.movimientos || []);
  };

  useEffect(() => {
    load().catch((e) => setFormError(e.message));
  }, [sede]);

  useEffect(() => {
    const pre = searchParams.get('movimientoId');
    if (pre && pendientes.some((m) => m.id === pre)) setMovimientoId(pre);
  }, [searchParams, pendientes]);

  const options = useMemo(
    () =>
      pendientes.map((m) => ({
        value: m.id,
        label: `${m.nombreHerramienta} — ${m.usuario} (${m.cantidad} u.) ${m.fecha?.slice?.(0, 10) || ''}`,
        searchText: `${m.nombreHerramienta} ${m.usuario} ${m.contenedorCodigo} ${m.itemId}`,
      })),
    [pendientes]
  );

  const selected = pendientes.find((m) => m.id === movimientoId);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    clearError?.();
    if (!movimientoId) {
      setFormError('Seleccioná un préstamo pendiente');
      return;
    }
    setSuccess('');
    const result = await registrarIngreso(
      { movimientoId, usuario: user?.name || 'Sistema' },
      executeOrQueue
    );
    if (result?.ok) {
      setSuccess(result.offline ? 'Devolución guardada offline' : 'Herramienta devuelta al Pañol');
      setMovimientoId('');
      load();
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Devolver al Pañol</h2>
        <p className="text-sm text-muted">
          Solo préstamos originados en el depósito Herramientas de esta sede. También podés
          escanear el QR del remito de caja en{' '}
          <Link to="/escanear" className="text-accent underline">
            QR
          </Link>
          .
        </p>
      </div>

      {(formError || error) && (
        <p className="rounded-md bg-red-900/40 px-3 py-2 text-sm text-red-100">
          {formError || error}
        </p>
      )}
      {success && (
        <p className="rounded-md bg-emerald-900/40 px-3 py-2 text-sm text-emerald-100">{success}</p>
      )}

      <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-border bg-surface p-4">
        <label className="block text-sm">
          Pendiente
          <FilterableSelect
            className="mt-1"
            options={options}
            value={movimientoId}
            onChange={setMovimientoId}
            placeholder="Buscar préstamo…"
          />
        </label>
        {selected && (
          <div className="rounded-md bg-bg px-3 py-2 text-sm text-muted">
            {selected.nombreHerramienta} · {selected.cantidad} u. · {selected.usuario}
            {selected.egresoLoteId ? (
              <div className="mt-1 font-mono text-xs">Lote: {selected.egresoLoteId}</div>
            ) : null}
          </div>
        )}
        <button type="submit" className="btn-primary w-full" disabled={loading || !movimientoId}>
          Registrar devolución
        </button>
      </form>

      {!pendientes.length && !formError && (
        <p className="text-sm text-muted">No hay préstamos pendientes del Pañol.</p>
      )}
    </div>
  );
}
