import { useEffect, useMemo, useState } from 'react';
import { api } from '../../../api/client';
import { useAuth } from '../../../auth/AuthProvider';
import FilterableSelect from '../../../components/FilterableSelect';
import { formatUbicacionLabel } from '../../../utils/ubicacion';

/**
 * Mueve stock del inventario general (u otro ALM de la sede) al depósito Herramientas / Pañol.
 */
export default function RecibirPanolPage() {
  const { sede } = useAuth();
  const [panol, setPanol] = useState(null);
  const [inventario, setInventario] = useState([]);
  const [stockId, setStockId] = useState('');
  const [cantidad, setCantidad] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [p, inv] = await Promise.all([
        api.herramientasPanol(sede ? { sede } : {}),
        api.inventario(sede ? { sede } : {}),
      ]);
      setPanol(p.panol);
      const alm = p.panol?.almacen;
      setInventario(
        (inv.items || []).filter(
          (i) => i.cantidad > 0 && String(i.almacen || '').toUpperCase() !== String(alm || '').toUpperCase()
        )
      );
      setError('');
    } catch (e) {
      setError(e.message || 'Error al cargar');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sede]);

  const options = useMemo(
    () =>
      inventario.map((i) => ({
        value: i.id || i.stockId,
        label: `${i.nombre} — ${i.cantidad} u. · ${i.almacen || ''} ${i.contenedorCodigo || ''}`,
        searchText: `${i.nombre} ${i.marca} ${i.modelo} ${i.tipo} ${i.almacen} ${i.contenedorCodigo}`,
      })),
    [inventario]
  );

  const selected = inventario.find((i) => (i.id || i.stockId) === stockId);
  const maxQty = selected?.cantidad ?? 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!stockId) {
      setError('Seleccioná un ítem del inventario');
      return;
    }
    setBusy(true);
    try {
      await api.herramientasMoverAlPanol({
        stockId,
        cantidad: Number(cantidad),
        sede,
      });
      setSuccess(`Movido al Pañol (${panol?.almacen || 'Herramientas'})`);
      setStockId('');
      setCantidad(1);
      await load();
    } catch (err) {
      setError(err.message || 'No se pudo mover');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Recibir en Pañol</h2>
        <p className="text-sm text-muted">
          Pasá herramientas de uso compartido (u otras ubicaciones de la sede) al depósito{' '}
          <span className="font-mono">{panol?.almacen || 'Herramientas'}</span>. No es un
          préstamo: quedan disponibles para prestar.
        </p>
      </div>

      {error && <p className="rounded-md bg-red-900/40 px-3 py-2 text-sm text-red-100">{error}</p>}
      {success && (
        <p className="rounded-md bg-emerald-900/40 px-3 py-2 text-sm text-emerald-100">{success}</p>
      )}

      {loading ? (
        <p className="text-sm text-muted">Cargando…</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-border bg-surface p-4">
          <label className="block text-sm">
            Desde inventario
            <FilterableSelect
              className="mt-1"
              options={options}
              value={stockId}
              onChange={setStockId}
              placeholder="Buscar herramienta…"
            />
          </label>
          {selected && (
            <p className="text-xs text-muted">
              Origen: {formatUbicacionLabel(selected) || selected.contenedorCodigo}
            </p>
          )}
          <label className="block text-sm">
            Cantidad
            <input
              type="number"
              min={1}
              max={maxQty || 1}
              className="input mt-1"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
            />
          </label>
          <button type="submit" className="btn-primary w-full" disabled={busy || !stockId}>
            {busy ? 'Moviendo…' : 'Pasar al Pañol'}
          </button>
        </form>
      )}
    </div>
  );
}
