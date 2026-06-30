import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import RemitoDocument from '../components/RemitoDocument';
import SearchFilters from '../components/SearchFilters';
import { formatUbicacionLabel } from '../utils/contenedor';
import {
  getEmpresaNombre,
  getNextRemitoNumber,
  setEmpresaNombre,
  setRemitoNumber,
  todayIsoDate,
} from '../utils/remitoStorage';

const EMPTY_FORM = {
  numero: '',
  fecha: todayIsoDate(),
  destinatario: '',
  iva: '',
  domicilio: '',
  localidad: '',
  vRef: '',
  cuit: '',
  bultos: '',
  transportista: '',
  cuitTransportista: '',
  domicilioTransportista: '',
  aclaracion: '',
  dni: '',
};

function defaultCantidad(item) {
  const stock = Number(item.cantidad) || 0;
  if (stock <= 0) return 1;
  return stock;
}

function cartEntryFromItem(item) {
  return {
    stockId: item.stockId || item.id,
    itemId: item.itemId,
    nombre: item.nombre,
    tipo: item.tipo,
    detalle: item.detalle,
    marca: item.marca,
    modelo: item.modelo,
    ubicacion: formatUbicacionLabel(item),
    cantidadDisponible: Number(item.cantidad) || 0,
    cantidad: defaultCantidad(item),
  };
}

function itemLinea(item) {
  const tipo = item.tipo?.trim();
  const base = tipo ? `${item.nombre} — ${tipo}` : item.nombre;
  const marca = [item.marca, item.modelo].filter(Boolean).join(' ');
  return marca ? `${base} (${marca})` : base;
}

export default function RemitoSalida() {
  const [inventario, setInventario] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ q: '', almacen: '', armario: '', tipo: '' });
  const [catalogo, setCatalogo] = useState({ almacenes: [], armariosPorAlmacen: {} });
  const [tipos, setTipos] = useState([]);
  const [cart, setCart] = useState(() => new Map());
  const [showPreview, setShowPreview] = useState(false);
  const [form, setForm] = useState(() => ({
    ...EMPTY_FORM,
    numero: String(getNextRemitoNumber()),
    fecha: todayIsoDate(),
  }));
  const [empresaNombre, setEmpresaNombreState] = useState(getEmpresaNombre);

  useEffect(() => {
    setLoading(true);
    api
      .inventario(filters)
      .then((data) => setInventario(data.items || []))
      .finally(() => setLoading(false));
  }, [filters.q, filters.almacen, filters.armario, filters.tipo]);

  useEffect(() => {
    Promise.all([api.catalogoUbicacion(), api.tipos()])
      .then(([cat, tiposData]) => {
        setCatalogo({
          almacenes: cat.almacenes || [],
          armariosPorAlmacen: cat.armariosPorAlmacen || {},
        });
        setTipos(tiposData.tipos || []);
      })
      .catch(() => {});
  }, []);

  const filteredItems = inventario;

  const cartList = useMemo(() => [...cart.values()], [cart]);
  const cartCount = cartList.length;

  const isInCart = useCallback((stockId) => cart.has(stockId), [cart]);

  const toggleItem = (item) => {
    const stockId = item.stockId || item.id;
    setCart((prev) => {
      const next = new Map(prev);
      if (next.has(stockId)) next.delete(stockId);
      else next.set(stockId, cartEntryFromItem(item));
      return next;
    });
  };

  const updateCartCantidad = (stockId, value) => {
    const n = parseInt(value, 10);
    if (!Number.isFinite(n) || n < 1) return;
    setCart((prev) => {
      const entry = prev.get(stockId);
      if (!entry) return prev;
      const next = new Map(prev);
      next.set(stockId, { ...entry, cantidad: n });
      return next;
    });
  };

  const removeFromCart = (stockId) => {
    setCart((prev) => {
      const next = new Map(prev);
      next.delete(stockId);
      return next;
    });
  };

  const clearCart = () => setCart(new Map());

  const selectVisible = () => {
    setCart((prev) => {
      const next = new Map(prev);
      filteredItems.forEach((item) => {
        const stockId = item.stockId || item.id;
        if (!next.has(stockId)) next.set(stockId, cartEntryFromItem(item));
      });
      return next;
    });
  };

  const openPreview = () => {
    setForm((f) => ({
      ...f,
      numero: f.numero || String(getNextRemitoNumber()),
      fecha: f.fecha || todayIsoDate(),
    }));
    setShowPreview(true);
  };

  const handlePrint = () => {
    const num = parseInt(form.numero, 10);
    if (Number.isFinite(num) && num > 0) {
      setRemitoNumber(num + 1);
    }
    setEmpresaNombre(empresaNombre);
    window.print();
    if (Number.isFinite(num) && num > 0) {
      setForm((f) => ({ ...f, numero: String(num + 1) }));
    }
  };

  const patchForm = (patch) => setForm((f) => ({ ...f, ...patch }));

  return (
    <div className="pb-28">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h2 className="page-title">Remito de salida</h2>
          <p className="text-muted">
            Seleccioná ítems del inventario. La selección se mantiene al cambiar filtros.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-secondary text-sm"
            onClick={selectVisible}
            disabled={!filteredItems.length}
          >
            Agregar visibles
          </button>
          <button
            type="button"
            className="btn-secondary text-sm"
            onClick={clearCart}
            disabled={!cartCount}
          >
            Vaciar carrito
          </button>
        </div>
      </div>

      <div className="print:hidden">
        <SearchFilters
          filters={filters}
          onChange={(f) => setFilters((prev) => ({ ...prev, ...f }))}
          almacenes={catalogo.almacenes}
          armariosPorAlmacen={catalogo.armariosPorAlmacen}
          tipos={tipos}
        />
      </div>

      {loading && <p className="text-muted print:hidden">Cargando inventario...</p>}

      {!loading && !filteredItems.length && (
        <p className="text-muted print:hidden">Sin resultados para estos filtros.</p>
      )}

      <div className="card mb-6 grid gap-2 print:hidden sm:grid-cols-2 lg:grid-cols-3">
        {filteredItems.map((item) => {
          const stockId = item.stockId || item.id;
          const checked = isInCart(stockId);
          return (
            <label
              key={stockId}
              className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 transition hover:bg-surface-hover ${
                checked ? 'border-accent bg-accent/10' : 'border-border text-content'
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggleItem(item)}
                className="mt-1 h-5 w-5 shrink-0 accent-accent"
              />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-content">{itemLinea(item)}</span>
                <span className="block truncate text-xs text-content-muted">
                  {formatUbicacionLabel(item)}
                </span>
                <span className="mt-1 inline-block rounded bg-surface-muted px-2 py-0.5 text-xs font-bold">
                  Stock: {item.cantidad}
                </span>
              </span>
            </label>
          );
        })}
      </div>

      {cartCount > 0 && (
        <aside className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-surface-elevated p-4 shadow-lg print:hidden lg:left-72">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-bold text-content">
                {cartCount} {cartCount === 1 ? 'ítem' : 'ítems'} en el remito
              </p>
              <p className="text-sm text-muted">Podés seguir buscando y agregando más ítems.</p>
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn-secondary text-sm" onClick={() => setShowPreview(true)}>
                Ver carrito
              </button>
              <button type="button" className="btn-primary text-sm" onClick={openPreview}>
                Generar remito
              </button>
            </div>
          </div>
        </aside>
      )}

      {showPreview && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/70 print:hidden">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-surface-elevated px-4 py-3">
            <h3 className="section-title">Vista previa del remito</h3>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-secondary text-sm" onClick={() => setShowPreview(false)}>
                Cerrar
              </button>
              <button
                type="button"
                className="btn-primary text-sm"
                disabled={!cartCount}
                onClick={handlePrint}
              >
                Imprimir
              </button>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 lg:flex-row">
            <div className="card shrink-0 space-y-3 lg:w-96 lg:overflow-y-auto">
              <h4 className="font-bold text-content">Datos del remito</h4>

              <div>
                <label className="text-label">Empresa emisora</label>
                <input
                  className="input-field text-base"
                  value={empresaNombre}
                  onChange={(e) => setEmpresaNombreState(e.target.value)}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-label">N° remito</label>
                  <input
                    className="input-field text-base"
                    value={form.numero}
                    onChange={(e) => patchForm({ numero: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-label">Fecha</label>
                  <input
                    type="date"
                    className="input-field text-base"
                    value={form.fecha}
                    onChange={(e) => patchForm({ fecha: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="text-label">Señor(es)</label>
                <input
                  className="input-field text-base"
                  value={form.destinatario}
                  onChange={(e) => patchForm({ destinatario: e.target.value })}
                />
              </div>
              <div>
                <label className="text-label">IVA</label>
                <input
                  className="input-field text-base"
                  value={form.iva}
                  onChange={(e) => patchForm({ iva: e.target.value })}
                />
              </div>
              <div>
                <label className="text-label">Domicilio</label>
                <input
                  className="input-field text-base"
                  value={form.domicilio}
                  onChange={(e) => patchForm({ domicilio: e.target.value })}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-label">Localidad</label>
                  <input
                    className="input-field text-base"
                    value={form.localidad}
                    onChange={(e) => patchForm({ localidad: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-label">V. Ref.</label>
                  <input
                    className="input-field text-base"
                    value={form.vRef}
                    onChange={(e) => patchForm({ vRef: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="text-label">C.U.I.T.</label>
                <input
                  className="input-field text-base"
                  value={form.cuit}
                  onChange={(e) => patchForm({ cuit: e.target.value })}
                />
              </div>

              <hr className="border-border" />
              <h4 className="font-bold text-content">Transporte</h4>
              <div>
                <label className="text-label">Cant. de bultos</label>
                <input
                  className="input-field text-base"
                  value={form.bultos}
                  onChange={(e) => patchForm({ bultos: e.target.value })}
                />
              </div>
              <div>
                <label className="text-label">Transportista / Razón social</label>
                <input
                  className="input-field text-base"
                  value={form.transportista}
                  onChange={(e) => patchForm({ transportista: e.target.value })}
                />
              </div>
              <div>
                <label className="text-label">C.U.I.T. transportista</label>
                <input
                  className="input-field text-base"
                  value={form.cuitTransportista}
                  onChange={(e) => patchForm({ cuitTransportista: e.target.value })}
                />
              </div>
              <div>
                <label className="text-label">Domicilio transportista</label>
                <input
                  className="input-field text-base"
                  value={form.domicilioTransportista}
                  onChange={(e) => patchForm({ domicilioTransportista: e.target.value })}
                />
              </div>

              <hr className="border-border" />
              <h4 className="font-bold text-content">Recepción</h4>
              <div>
                <label className="text-label">Aclaración</label>
                <input
                  className="input-field text-base"
                  value={form.aclaracion}
                  onChange={(e) => patchForm({ aclaracion: e.target.value })}
                />
              </div>
              <div>
                <label className="text-label">D.N.I.</label>
                <input
                  className="input-field text-base"
                  value={form.dni}
                  onChange={(e) => patchForm({ dni: e.target.value })}
                />
              </div>

              <hr className="border-border" />
              <h4 className="font-bold text-content">Ítems ({cartCount})</h4>
              <ul className="max-h-48 space-y-2 overflow-y-auto text-sm">
                {cartList.map((linea) => (
                  <li
                    key={linea.stockId}
                    className="flex items-center gap-2 rounded border border-border p-2"
                  >
                    <input
                      type="number"
                      min={1}
                      className="w-16 rounded border border-border bg-surface-input px-2 py-1 text-center"
                      value={linea.cantidad}
                      onChange={(e) => updateCartCantidad(linea.stockId, e.target.value)}
                    />
                    <span className="min-w-0 flex-1 truncate" title={linea.nombre}>
                      {linea.nombre}
                    </span>
                    <button
                      type="button"
                      className="text-xs font-semibold text-red-600 hover:underline dark:text-red-400"
                      onClick={() => removeFromCart(linea.stockId)}
                    >
                      Quitar
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto rounded-xl bg-white p-4 shadow-inner">
              <RemitoDocument form={form} lineas={cartList} empresaNombre={empresaNombre} />
            </div>
          </div>
        </div>
      )}

      <div className="hidden print:block">
        <RemitoDocument form={form} lineas={cartList} empresaNombre={empresaNombre} />
      </div>

      <style>{`
        @media print {
          header, nav, aside, .print\\:hidden { display: none !important; }
          main { max-width: 100% !important; padding: 0 !important; }
          body { background: white !important; color: black !important; }
          .remito-doc { box-shadow: none !important; }
        }
      `}</style>
    </div>
  );
}
