import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../../api/client';
import { useAuth } from '../../../auth/AuthProvider';
import { useStore } from '../../../store/useStore';
import { useSync } from '../../../context/SyncContext';
import FilterableSelect from '../../../components/FilterableSelect';
import RemitoEgresoLotePrintModal from '../../../components/RemitoEgresoLotePrintModal';
import { buildQrPayload, QR_TYPES } from '../../../utils/qrPayload';

function newClientLoteId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `lote-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function PrestarPage() {
  const { user, isAdmin } = useAuth();
  const [searchParams] = useSearchParams();
  const { registrarEgreso, registrarEgresoContenedor, loading, error, clearError } = useStore();
  const { executeOrQueue } = useSync();
  const { sede } = useAuth();

  const [modo, setModo] = useState('unidad'); // unidad | caja
  const [items, setItems] = useState([]);
  const [panol, setPanol] = useState(null);
  const [stockId, setStockId] = useState('');
  const [contenedorId, setContenedorId] = useState('');
  const [cantidad, setCantidad] = useState(1);
  const [usuarioEgreso, setUsuarioEgreso] = useState(user?.name || '');
  const [activeUsers, setActiveUsers] = useState([]);
  const [success, setSuccess] = useState('');
  const [formError, setFormError] = useState('');
  const [printLote, setPrintLote] = useState(null);
  const [showPrint, setShowPrint] = useState(false);

  const load = async () => {
    const data = await api.herramientasStock(sede ? { sede } : {});
    setItems((data.items || []).filter((i) => i.cantidad > 0));
    setPanol(data.panol || null);
  };

  useEffect(() => {
    load().catch((e) => setFormError(e.message));
  }, [sede]);

  useEffect(() => {
    setUsuarioEgreso(user?.name || '');
  }, [user?.name]);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    api
      .adminUsers()
      .then((data) => {
        if (!cancelled) setActiveUsers((data.users || []).filter((u) => u.isActive !== false));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  useEffect(() => {
    const fromStock = searchParams.get('stockId');
    if (fromStock && items.some((i) => (i.id || i.stockId) === fromStock)) {
      setStockId(fromStock);
      setModo('unidad');
    }
  }, [searchParams, items]);

  const usuarioOptions = useMemo(() => {
    const names = new Set();
    const opts = [];
    const add = (name) => {
      const n = String(name || '').trim();
      if (!n || names.has(n)) return;
      names.add(n);
      opts.push({ value: n, label: n, searchText: n });
    };
    add(user?.name);
    activeUsers.forEach((u) => add(u.name || u.displayName));
    return opts.sort((a, b) => a.label.localeCompare(b.label, 'es'));
  }, [activeUsers, user?.name]);

  const usuario = isAdmin ? usuarioEgreso : user?.name || '';

  const stockOptions = useMemo(
    () =>
      items.map((i) => ({
        value: i.id || i.stockId,
        label: `${i.nombre} — ${i.cantidad} u. (${i.contenedorCodigo || ''})`,
        searchText: `${i.nombre} ${i.marca} ${i.modelo} ${i.tipo} ${i.contenedorCodigo} ${i.itemId}`,
      })),
    [items]
  );

  const cajasOptions = useMemo(() => {
    const byCont = new Map();
    for (const i of items) {
      if (!i.contenedorId) continue;
      const prev = byCont.get(i.contenedorId) || {
        id: i.contenedorId,
        codigo: i.contenedorCodigo,
        lineas: 0,
        unidades: 0,
      };
      prev.lineas += 1;
      prev.unidades += Number(i.cantidad) || 0;
      byCont.set(i.contenedorId, prev);
    }
    return [...byCont.values()].map((c) => ({
      value: c.id,
      label: `${c.codigo || c.id} — ${c.lineas} ítems / ${c.unidades} u.`,
      searchText: `${c.codigo} ${c.id}`,
    }));
  }, [items]);

  const selected = items.find((i) => (i.id || i.stockId) === stockId);
  const maxQty = selected?.cantidad ?? 0;

  const handleUnidad = async (e) => {
    e.preventDefault();
    setFormError('');
    clearError?.();
    if (!selected?.itemId || !selected?.contenedorId) {
      setFormError('Seleccioná una herramienta del Pañol');
      return;
    }
    if (!usuario.trim()) {
      setFormError('Indicá el operario que recibe');
      return;
    }
    setSuccess('');
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
      setSuccess(result.offline ? 'Préstamo guardado offline' : 'Herramienta prestada');
      setStockId('');
      setCantidad(1);
      load();
    }
  };

  const handleCaja = async (e) => {
    e.preventDefault();
    setFormError('');
    clearError?.();
    if (!contenedorId) {
      setFormError('Seleccioná una caja / contenedor del Pañol');
      return;
    }
    if (!usuario.trim()) {
      setFormError('Indicá el operario que recibe');
      return;
    }
    setSuccess('');
    const egresoLoteId = newClientLoteId();
    const lineas = items
      .filter((i) => i.contenedorId === contenedorId)
      .map((i) => ({
        itemId: i.itemId,
        nombre: i.nombre,
        marca: i.marca,
        modelo: i.modelo,
        tipo: i.tipo,
        cantidad: Number(i.cantidad),
      }));
    const result = await registrarEgresoContenedor(
      {
        contenedorId,
        usuario: usuario.trim(),
        egresoLoteId,
      },
      executeOrQueue
    );
    if (result?.ok) {
      const loteId = result.data?.egresoLoteId || egresoLoteId;
      setPrintLote({
        egresoLoteId: loteId,
        id: loteId,
        usuario: usuario.trim(),
        fecha: new Date().toISOString(),
        lineas: result.data?.lineas || lineas,
        qrPayload: buildQrPayload({ type: QR_TYPES.DEVOLUCION, loteId }),
      });
      setShowPrint(true);
      setSuccess('Caja prestada — imprimí el remito interno');
      setContenedorId('');
      load();
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Prestar herramienta</h2>
        <p className="text-sm text-muted">
          Egreso desde el Pañol{panol ? ` (${panol.almacen})` : ''}. Genera pendiente de
          devolución e historial.
        </p>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          className={modo === 'unidad' ? 'btn-primary' : 'btn-secondary'}
          onClick={() => setModo('unidad')}
        >
          Individual / compartida
        </button>
        <button
          type="button"
          className={modo === 'caja' ? 'btn-primary' : 'btn-secondary'}
          onClick={() => setModo('caja')}
        >
          Caja completa
        </button>
      </div>

      {(formError || error) && (
        <p className="rounded-md bg-red-900/40 px-3 py-2 text-sm text-red-100">
          {formError || error}
        </p>
      )}
      {success && (
        <p className="rounded-md bg-emerald-900/40 px-3 py-2 text-sm text-emerald-100">{success}</p>
      )}

      {modo === 'unidad' ? (
        <form onSubmit={handleUnidad} className="space-y-3 rounded-lg border border-border bg-surface p-4">
          <label className="block text-sm">
            Herramienta
            <FilterableSelect
              className="mt-1"
              options={stockOptions}
              value={stockId}
              onChange={setStockId}
              placeholder="Buscar en Pañol…"
            />
          </label>
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
          <label className="block text-sm">
            Operario
            {isAdmin ? (
              <FilterableSelect
                className="mt-1"
                options={usuarioOptions}
                value={usuarioEgreso}
                onChange={setUsuarioEgreso}
                placeholder="Quién recibe…"
              />
            ) : (
              <input className="input mt-1" value={usuario} readOnly />
            )}
          </label>
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            Prestar
          </button>
        </form>
      ) : (
        <form onSubmit={handleCaja} className="space-y-3 rounded-lg border border-border bg-surface p-4">
          <p className="text-sm text-muted">
            Retira todo el contenido del contenedor y genera remito interno + QR de devolución.
          </p>
          <label className="block text-sm">
            Caja / contenedor
            <FilterableSelect
              className="mt-1"
              options={cajasOptions}
              value={contenedorId}
              onChange={setContenedorId}
              placeholder="Elegir caja…"
            />
          </label>
          <label className="block text-sm">
            Operario
            {isAdmin ? (
              <FilterableSelect
                className="mt-1"
                options={usuarioOptions}
                value={usuarioEgreso}
                onChange={setUsuarioEgreso}
                placeholder="Quién recibe…"
              />
            ) : (
              <input className="input mt-1" value={usuario} readOnly />
            )}
          </label>
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            Prestar caja completa
          </button>
        </form>
      )}

      <p className="text-sm text-muted">
        ¿Sin stock?{' '}
        <Link to="/herramientas/recibir" className="text-accent underline">
          Recibir en Pañol
        </Link>
      </p>

      {showPrint && printLote && (
        <RemitoEgresoLotePrintModal lote={printLote} onClose={() => setShowPrint(false)} />
      )}
    </div>
  );
}
