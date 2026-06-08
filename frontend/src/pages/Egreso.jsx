import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { useSync } from '../context/SyncContext';
import { useAuth } from '../auth/AuthProvider';
import FilterableSelect from '../components/FilterableSelect';
import { filterInventarioByScan, parsedFromCodigoParam } from '../utils/scanMatch';

const USUARIOS = ['Juan Pérez', 'María López', 'Carlos Ruiz'];

export default function Egreso() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const { inventario, loading, error, fetchInventario, registrarEgreso, clearError } = useStore();
  const { executeOrQueue } = useSync();
  const [stockId, setStockId] = useState('');
  const [cantidad, setCantidad] = useState(1);
  const [usuario, setUsuario] = useState(user?.name || '');
  const [success, setSuccess] = useState(false);
  const [offlineSaved, setOfflineSaved] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    fetchInventario();
    if (user?.name) setUsuario(user.name);
  }, []);

  const disponibles = useMemo(() => inventario.filter((i) => i.cantidad > 0), [inventario]);

  const scopedDisponibles = useMemo(() => {
    const itemId = searchParams.get('itemId');
    const codigo = searchParams.get('codigo');
    if (!itemId && !codigo) return disponibles;
    let list = disponibles;
    if (itemId) list = list.filter((i) => i.itemId === itemId);
    if (codigo) {
      list = filterInventarioByScan(list, parsedFromCodigoParam(codigo));
    }
    return list;
  }, [disponibles, searchParams]);

  useEffect(() => {
    const fromStock = searchParams.get('stockId');
    const fromItem = searchParams.get('itemId');
    if (fromStock && scopedDisponibles.some((i) => i.id === fromStock)) {
      setStockId(fromStock);
      return;
    }
    if (fromItem || searchParams.get('codigo')) {
      const first = scopedDisponibles[0];
      if (first) setStockId(first.id);
    }
  }, [searchParams, scopedDisponibles]);

  const options = useMemo(
    () =>
      scopedDisponibles.map((i) => ({
        value: i.id,
        label: `${i.nombre} — Stock ${i.cantidad} (${i.contenedorCodigo})`,
        searchText: `${i.nombre} ${i.marca} ${i.modelo} ${i.tipo} ${i.contenedorCodigo} ${i.itemId}`,
      })),
    [scopedDisponibles]
  );

  const selected = inventario.find((i) => i.id === stockId);
  const maxQty = selected?.cantidad ?? 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!selected?.itemId || !selected?.contenedorId) {
      setFormError('Datos de herramienta incompletos. Reiniciá el backend: cd backend && npm run dev');
      return;
    }
    if (!usuario.trim()) {
      setFormError('Seleccioná un usuario.');
      return;
    }
    setSuccess(false);
    const result = await registrarEgreso(
      {
        itemId: selected.itemId,
        contenedorId: selected.contenedorId,
        cantidad: Number(cantidad),
        usuario: usuario.trim(),
      },
      executeOrQueue
    );
    if (result?.ok) {
      setSuccess(true);
      setOfflineSaved(!!result.offline);
      setStockId('');
      setCantidad(1);
      fetchInventario();
    }
  };

  const scanHint = searchParams.get('itemId') || searchParams.get('codigo');

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-2">
        <h2 className="text-2xl font-bold text-amber-400">REGISTRAR EGRESO</h2>
        <Link to="/escanear" className="btn-secondary shrink-0 py-2 text-base">
          📷 QR
        </Link>
      </div>

      {scanHint && scopedDisponibles.length > 0 && (
        <p className="alert-warning mb-4 text-sm">
          Filtrado por escaneo QR ({scopedDisponibles.length} opción
          {scopedDisponibles.length !== 1 ? 'es' : ''}).
        </p>
      )}

      {formError && <div className="alert-error mb-4">{formError}</div>}
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
          {offlineSaved ? 'Guardado offline. Se sincronizará al reconectar.' : 'Egreso registrado.'}
        </div>
      )}

      <form onSubmit={handleSubmit} className="card max-w-lg space-y-5">
        <div>
          <label className="text-label">Herramienta</label>
          <p className="mb-2 text-xs text-subtle">
            Escribí letras para acotar la lista (ej: &quot;ca&quot; → nombres que contengan &quot;ca&quot;).
          </p>
          <FilterableSelect
            options={options}
            value={stockId}
            onChange={setStockId}
            placeholder="Buscar por nombre, código, tipo…"
            emptyMessage="Ninguna herramienta coincide"
            disabled={!options.length}
          />
          {!options.length && (
            <p className="mt-2 text-muted">No hay stock disponible con ese filtro.</p>
          )}
        </div>
        <div>
          <label className="text-label">Cantidad</label>
          <input
            type="number"
            min={1}
            max={maxQty || 1}
            className="input-field"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            disabled={!stockId}
          />
          {selected && <p className="mt-1 text-amber-400">Disponible: {maxQty}</p>}
        </div>
        <div>
          <label className="text-label">Usuario</label>
          <select className="input-field" value={usuario} onChange={(e) => setUsuario(e.target.value)} required>
            <option value="">Seleccionar...</option>
            {USUARIOS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
            {user?.name && !USUARIOS.includes(user.name) && (
              <option value={user.name}>
                {user.name}
              </option>
            )}
          </select>
        </div>
        <button
          type="submit"
          className="btn-primary w-full"
          disabled={loading || !stockId || !usuario || Number(cantidad) < 1 || Number(cantidad) > maxQty}
        >
          {loading ? 'PROCESANDO...' : 'RETIRAR'}
        </button>
      </form>
    </div>
  );
}
