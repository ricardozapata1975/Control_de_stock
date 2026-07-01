import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import ClienteAutocomplete from '../components/ClienteAutocomplete';
import RemitoDocument from '../components/RemitoDocument';
import RemitoRecibir from '../components/RemitoRecibir';
import SearchFilters from '../components/SearchFilters';
import UbicacionSelector from '../components/UbicacionSelector';
import { formatUbicacionLabel } from '../utils/contenedor';
import { ALMACEN_DEFAULT, buildCedeLabel, getAlmacenNombreFromCatalog } from '../utils/ubicacion';
import { todayIsoDate } from '../utils/remitoStorage';

const EMPTY_FORM = {
  numero: '',
  fecha: todayIsoDate(),
  destinatario: '',
  clienteId: null,
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
  cedeOrigen: '',
  cedeDestino: '',
};

function defaultCantidad(item) {
  const stock = Number(item.cantidad) || 0;
  if (stock <= 0) return 1;
  return 1;
}

function cartEntryFromItem(item) {
  return {
    stockId: item.stockId || item.id,
    itemId: item.itemId,
    contenedorId: item.contenedorId,
    almacen: item.almacen || ALMACEN_DEFAULT,
    armario: item.armario,
    estante: item.estante,
    contenedor: item.contenedor,
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

function itemDescripcionRemito(linea) {
  const tipo = linea.tipo?.trim();
  const base = tipo ? `${linea.nombre} — ${tipo}` : linea.nombre;
  const marca = [linea.marca, linea.modelo].filter(Boolean).join(' ');
  return marca ? `${base} (${marca})` : base;
}

export default function RemitoSalida() {
  const [vista, setVista] = useState('emitir');
  const [tipoRemito, setTipoRemito] = useState('venta');
  const [inventario, setInventario] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ q: '', almacen: '', armario: '', tipo: '' });
  const [catalogo, setCatalogo] = useState({ almacenes: [], armariosPorAlmacen: {} });
  const [tipos, setTipos] = useState([]);
  const [cart, setCart] = useState(() => new Map());
  const [showPreview, setShowPreview] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [empresas, setEmpresas] = useState([]);
  const [empresaId, setEmpresaId] = useState('');
  const [confirmado, setConfirmado] = useState(false);
  const [remitoId, setRemitoId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [almacenOrigen, setAlmacenOrigen] = useState(ALMACEN_DEFAULT);
  const [almacenDestino, setAlmacenDestino] = useState('');
  const [destArmario, setDestArmario] = useState('A01');
  const [destEstante, setDestEstante] = useState('E01');
  const [destContenedor, setDestContenedor] = useState('');

  const empresaSeleccionada = useMemo(
    () => empresas.find((e) => e.id === empresaId) || null,
    [empresas, empresaId]
  );

  useEffect(() => {
    setLoading(true);
    api
      .inventario(filters)
      .then((data) => setInventario(data.items || []))
      .finally(() => setLoading(false));
  }, [filters.q, filters.almacen, filters.armario, filters.tipo]);

  useEffect(() => {
    Promise.all([api.catalogoUbicacion(), api.tipos(), api.empresasEmisoras()])
      .then(([cat, tiposData, empresasData]) => {
        setCatalogo({
          almacenes: cat.almacenes || [],
          armariosPorAlmacen: cat.armariosPorAlmacen || {},
        });
        setTipos(tiposData.tipos || []);
        const list = empresasData.empresas || [];
        setEmpresas(list);
        if (list.length && !empresaId) {
          setEmpresaId(list[0].id);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!empresaId || confirmado) return;
    api
      .proximoNumeroRemito(empresaId)
      .then((data) => {
        setForm((f) => ({ ...f, numero: String(data.numero || 1) }));
      })
      .catch(() => {});
  }, [empresaId, confirmado]);

  const filteredItems = inventario;
  const cartList = useMemo(() => [...cart.values()], [cart]);
  const cartCount = cartList.length;

  const almacenesOrigenCart = useMemo(
    () => [...new Set(cartList.map((l) => l.almacen).filter(Boolean))],
    [cartList]
  );

  useEffect(() => {
    if (!cartCount) return;
    if (almacenesOrigenCart.length === 1) {
      setAlmacenOrigen(almacenesOrigenCart[0]);
    }
  }, [cartCount, almacenesOrigenCart]);

  const almacenesDestino = useMemo(
    () => (catalogo.almacenes || []).filter((a) => a.codigo !== almacenOrigen),
    [catalogo.almacenes, almacenOrigen]
  );

  useEffect(() => {
    if (tipoRemito !== 'transferencia') return;
    if (!almacenDestino && almacenesDestino.length) {
      setAlmacenDestino(almacenesDestino[0].codigo);
    }
  }, [tipoRemito, almacenDestino, almacenesDestino]);

  const isInCart = useCallback((stockId) => cart.has(stockId), [cart]);

  const toggleItem = (item) => {
    const stockId = item.stockId || item.id;
    setCart((prev) => {
      const next = new Map(prev);
      if (next.has(stockId)) next.delete(stockId);
      else next.set(stockId, cartEntryFromItem(item));
      return next;
    });
    setConfirmado(false);
    setRemitoId(null);
  };

  const updateCartCantidad = (stockId, value) => {
    const n = parseInt(value, 10);
    if (!Number.isFinite(n) || n < 1) return;
    setCart((prev) => {
      const entry = prev.get(stockId);
      if (!entry) return prev;
      const max = entry.cantidadDisponible;
      const cantidad = max > 0 ? Math.min(n, max) : n;
      const next = new Map(prev);
      next.set(stockId, { ...entry, cantidad });
      return next;
    });
    setConfirmado(false);
    setRemitoId(null);
  };

  const removeFromCart = (stockId) => {
    setCart((prev) => {
      const next = new Map(prev);
      next.delete(stockId);
      return next;
    });
    setConfirmado(false);
    setRemitoId(null);
  };

  const clearCart = () => {
    setCart(new Map());
    setConfirmado(false);
    setRemitoId(null);
  };

  const selectVisible = () => {
    setCart((prev) => {
      const next = new Map(prev);
      filteredItems.forEach((item) => {
        const stockId = item.stockId || item.id;
        if (!next.has(stockId)) next.set(stockId, cartEntryFromItem(item));
      });
      return next;
    });
    setConfirmado(false);
    setRemitoId(null);
  };

  const openPreview = () => {
    setForm((f) => ({
      ...f,
      fecha: f.fecha || todayIsoDate(),
    }));
    setError('');
    setShowPreview(true);
  };

  const patchForm = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setConfirmado(false);
    setRemitoId(null);
  };

  useEffect(() => {
    if (tipoRemito !== 'transferencia' || !almacenDestino) return;
    const nombreAlm = getAlmacenNombreFromCatalog(catalogo, almacenDestino);
    const cedeDestino = buildCedeLabel(catalogo, {
      almacen: almacenDestino,
      armario: destArmario,
      estante: destEstante,
      contenedor: destContenedor,
    });
    setForm((f) => ({
      ...f,
      destinatario: nombreAlm || almacenDestino,
      domicilio: `Almacén ${almacenDestino}`,
      iva: 'Transferencia interna',
      cedeDestino,
    }));
  }, [tipoRemito, almacenDestino, destArmario, destEstante, destContenedor, catalogo]);

  useEffect(() => {
    if (tipoRemito !== 'transferencia' || !cartCount) return;
    const primera = cartList[0];
    if (!primera) return;
    const cedeOrigen = buildCedeLabel(catalogo, {
      almacen: primera.almacen || almacenOrigen,
      armario: primera.armario,
      estante: primera.estante,
      contenedor: primera.contenedor,
    }) || primera.ubicacion || getAlmacenNombreFromCatalog(catalogo, almacenOrigen);
    setForm((f) => ({ ...f, cedeOrigen }));
  }, [tipoRemito, cartCount, cartList, almacenOrigen, catalogo]);

  const handleClienteSelect = (cliente) => {
    patchForm({
      clienteId: cliente.id,
      destinatario: cliente.nombre,
      iva: cliente.iva || '',
      domicilio: cliente.domicilio || '',
      localidad: cliente.localidad || '',
      vRef: cliente.vRef || '',
      cuit: cliente.cuit || '',
    });
  };

  const handleConfirmar = async () => {
    setError('');
    if (!cartCount) {
      setError('Agregá al menos un ítem al remito.');
      return;
    }
    if (!form.destinatario?.trim()) {
      setError('Completá el destinatario (Señor/es).');
      return;
    }
    if (!empresaId) {
      setError('Seleccioná una empresa emisora.');
      return;
    }

    if (tipoRemito === 'transferencia') {
      if (!almacenOrigen?.trim() || !almacenDestino?.trim()) {
        setError('Completá almacén origen y destino.');
        return;
      }
      if (almacenOrigen === almacenDestino) {
        setError('El almacén destino debe ser distinto del origen.');
        return;
      }
      if (!destArmario || !destEstante) {
        setError('Completá armario y estante destino.');
        return;
      }
      if (almacenesOrigenCart.length > 1) {
        setError('Todos los ítems deben ser del mismo almacén origen.');
        return;
      }
    }

    for (const linea of cartList) {
      if (linea.cantidad > linea.cantidadDisponible) {
        setError(
          `Stock insuficiente para "${linea.nombre}". Disponible: ${linea.cantidadDisponible}`
        );
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        tipo: tipoRemito,
        numero: parseInt(form.numero, 10),
        fecha: form.fecha,
        empresaEmisoraId: empresaId,
        cliente: {
          id: form.clienteId || undefined,
          nombre: form.destinatario.trim(),
          iva: form.iva,
          domicilio: form.domicilio,
          localidad: form.localidad,
          v_ref: form.vRef,
          cuit: form.cuit,
        },
        cantBultos: form.bultos,
        transportista: form.transportista,
        transportistaCuit: form.cuitTransportista,
        transportistaDomicilio: form.domicilioTransportista,
        aclaracion: form.aclaracion,
        dni: form.dni,
        items: cartList.map((l) => ({
          stockId: l.stockId,
          itemId: l.itemId,
          contenedorId: l.contenedorId,
          cantidad: l.cantidad,
          descripcion: itemDescripcionRemito(l),
        })),
        ...(tipoRemito === 'transferencia'
          ? {
              almacenOrigen,
              almacenDestino,
              ubicacionDestino: {
                almacen: almacenDestino,
                armario: destArmario,
                estante: destEstante,
                contenedor: destContenedor || null,
                cede: form.cedeDestino || null,
              },
            }
          : {}),
      };

      const result = await api.crearRemito(payload);
      setConfirmado(true);
      setRemitoId(result.remito_id || result.remitoId);
    } catch (err) {
      setError(err.message || 'Error al confirmar el remito');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleNuevoRemito = async () => {
    setShowPreview(false);
    setConfirmado(false);
    setRemitoId(null);
    clearCart();
    setForm({ ...EMPTY_FORM, fecha: todayIsoDate() });
    if (empresaId) {
      try {
        const data = await api.proximoNumeroRemito(empresaId);
        setForm((f) => ({ ...f, numero: String(data.numero || 1), fecha: todayIsoDate() }));
      } catch {
        /* ignore */
      }
    }
    setLoading(true);
    api
      .inventario(filters)
      .then((data) => setInventario(data.items || []))
      .finally(() => setLoading(false));
  };

  const handleEmpresaChange = (id) => {
    setEmpresaId(id);
    setConfirmado(false);
    setRemitoId(null);
  };

  return (
    <div className="pb-28">
      <div className="mb-4 flex flex-wrap gap-2 print:hidden">
        <button
          type="button"
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${
            vista === 'emitir' ? 'bg-accent text-white' : 'bg-surface-muted text-content-muted'
          }`}
          onClick={() => setVista('emitir')}
        >
          Emitir remito
        </button>
        <button
          type="button"
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${
            vista === 'recibir' ? 'bg-accent text-white' : 'bg-surface-muted text-content-muted'
          }`}
          onClick={() => setVista('recibir')}
        >
          Recibir transferencias
        </button>
      </div>

      {vista === 'recibir' && <RemitoRecibir />}

      {vista === 'emitir' && (
      <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h2 className="page-title">Remito de salida</h2>
          <p className="text-muted">
            Seleccioná ítems, confirmá el remito para descontar stock y luego imprimí.
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

      <div className="card mb-4 print:hidden">
        <label className="text-label">Tipo de remito</label>
        <div className="mt-1 flex flex-wrap gap-2">
          {[
            { id: 'venta', label: 'Venta' },
            { id: 'transferencia', label: 'Transferencia' },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                tipoRemito === opt.id
                  ? 'bg-accent text-white'
                  : 'border border-border bg-surface-muted text-content'
              }`}
              disabled={confirmado}
              onClick={() => {
                setTipoRemito(opt.id);
                setConfirmado(false);
                setRemitoId(null);
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {tipoRemito === 'transferencia' && (
          <p className="mt-2 text-xs text-muted">
            Transferencia interna: el stock sale del almacén origen y queda en tránsito hasta la
            recepción en destino.
          </p>
        )}
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
              <p className="text-sm text-muted">Confirmá para descontar stock antes de imprimir.</p>
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
        <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950 print:hidden">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-surface-elevated px-4 py-3">
            <h3 className="section-title">Vista previa del remito</h3>
            <div className="flex flex-wrap gap-2">
              {confirmado ? (
                <button type="button" className="btn-secondary text-sm" onClick={handleNuevoRemito}>
                  Nuevo remito
                </button>
              ) : (
                <button type="button" className="btn-secondary text-sm" onClick={() => setShowPreview(false)}>
                  Cerrar
                </button>
              )}
              {!confirmado && (
                <button
                  type="button"
                  className="btn-primary text-sm"
                  disabled={!cartCount || submitting}
                  onClick={handleConfirmar}
                >
                  {submitting ? 'Confirmando...' : 'Confirmar remito'}
                </button>
              )}
              {confirmado && (
                <button type="button" className="btn-primary text-sm" onClick={handlePrint}>
                  Imprimir
                </button>
              )}
            </div>
          </div>

          {error && (
            <div className="shrink-0 border-b border-red-300 bg-red-50 px-4 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
              {error}
            </div>
          )}
          {confirmado && (
            <div className="shrink-0 border-b border-emerald-300 bg-emerald-50 px-4 py-2 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
              Remito N° {form.numero} confirmado.
              {tipoRemito === 'transferencia'
                ? ' Stock en tránsito — pendiente de recepción en destino.'
                : ' Stock descontado.'}
              {remitoId ? ` ID: ${remitoId.slice(0, 8)}…` : ''}
            </div>
          )}

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto scroll-pt-4 p-4 pt-[10mm] lg:flex-row">
            <div className="card shrink-0 space-y-3 lg:w-96 lg:overflow-y-auto">
              <h4 className="font-bold text-content">Datos del remito</h4>

              <div>
                <label className="text-label">Empresa emisora</label>
                <select
                  className="input-field text-base"
                  value={empresaId}
                  disabled={confirmado}
                  onChange={(e) => handleEmpresaChange(e.target.value)}
                >
                  {empresas.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-label">N° remito</label>
                  <input
                    className="input-field text-base"
                    value={form.numero}
                    disabled={confirmado}
                    onChange={(e) => patchForm({ numero: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-label">Fecha</label>
                  <input
                    type="date"
                    className="input-field text-base"
                    value={form.fecha}
                    disabled={confirmado}
                    onChange={(e) => patchForm({ fecha: e.target.value })}
                  />
                </div>
              </div>

              {tipoRemito === 'transferencia' ? (
                <>
                  <hr className="border-border" />
                  <h4 className="font-bold text-content">Transferencia entre almacenes</h4>
                  <div>
                    <label className="text-label">Almacén origen</label>
                    <select
                      className="input-field text-base"
                      value={almacenOrigen}
                      disabled={confirmado}
                      onChange={(e) => setAlmacenOrigen(e.target.value)}
                    >
                      {(catalogo.almacenes || []).map((a) => (
                        <option key={a.codigo} value={a.codigo}>
                          {a.codigo} — {a.nombre || a.codigo}
                        </option>
                      ))}
                    </select>
                    {almacenesOrigenCart.length > 1 && (
                      <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                        Hay ítems de distintos almacenes en el carrito.
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="text-label">Almacén destino</label>
                    <select
                      className="input-field text-base"
                      value={almacenDestino}
                      disabled={confirmado}
                      onChange={(e) => setAlmacenDestino(e.target.value)}
                    >
                      {almacenesDestino.map((a) => (
                        <option key={a.codigo} value={a.codigo}>
                          {a.codigo} — {a.nombre || a.codigo}
                        </option>
                      ))}
                    </select>
                  </div>
                  <UbicacionSelector
                    catalogo={catalogo}
                    almacen={almacenDestino || ALMACEN_DEFAULT}
                    armario={destArmario}
                    estante={destEstante}
                    contenedor={destContenedor}
                    almacenDisabled
                    compact
                    labelPrefix="destino"
                    onAlmacenChange={setAlmacenDestino}
                    onArmarioChange={setDestArmario}
                    onEstanteChange={setDestEstante}
                    onContenedorChange={setDestContenedor}
                  />
                  <div>
                    <label className="text-label">Cede origen</label>
                    <input
                      className="input-field text-base"
                      value={form.cedeOrigen}
                      disabled={confirmado}
                      placeholder="Ej. Oficina Ballester — Armario Herramientas — E01"
                      onChange={(e) => patchForm({ cedeOrigen: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-label">Cede destino</label>
                    <input
                      className="input-field text-base"
                      value={form.cedeDestino}
                      disabled={confirmado}
                      placeholder="Ej. Oficina Santa Fe — contenedor obrador C05"
                      onChange={(e) => patchForm({ cedeDestino: e.target.value })}
                    />
                    <p className="mt-1 text-xs text-muted">
                      Sede o ubicación física (oficina, depósito, contenedor, etc.). Se completa al elegir almacén y ubicación.
                    </p>
                  </div>
                  <div>
                    <label className="text-label">Destinatario (Señor/es)</label>
                    <input
                      className="input-field text-base"
                      value={form.destinatario}
                      disabled={confirmado}
                      onChange={(e) => patchForm({ destinatario: e.target.value })}
                    />
                  </div>
                </>
              ) : (
              <>
              <div>
                <label className="text-label">Señor(es)</label>
                <ClienteAutocomplete
                  value={form.destinatario}
                  onChange={patchForm}
                  onSelect={handleClienteSelect}
                  disabled={confirmado}
                />
              </div>
              <div>
                <label className="text-label">IVA</label>
                <input
                  className="input-field text-base"
                  value={form.iva}
                  disabled={confirmado}
                  onChange={(e) => patchForm({ iva: e.target.value })}
                />
              </div>
              <div>
                <label className="text-label">Domicilio</label>
                <input
                  className="input-field text-base"
                  value={form.domicilio}
                  disabled={confirmado}
                  onChange={(e) => patchForm({ domicilio: e.target.value })}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-label">Localidad</label>
                  <input
                    className="input-field text-base"
                    value={form.localidad}
                    disabled={confirmado}
                    onChange={(e) => patchForm({ localidad: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-label">V. Ref.</label>
                  <input
                    className="input-field text-base"
                    value={form.vRef}
                    disabled={confirmado}
                    onChange={(e) => patchForm({ vRef: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="text-label">C.U.I.T.</label>
                <input
                  className="input-field text-base"
                  value={form.cuit}
                  disabled={confirmado}
                  onChange={(e) => patchForm({ cuit: e.target.value })}
                />
              </div>
              </>
              )}

              <hr className="border-border" />
              <h4 className="font-bold text-content">Transporte</h4>
              <div>
                <label className="text-label">Cant. de bultos</label>
                <input
                  className="input-field text-base"
                  value={form.bultos}
                  disabled={confirmado}
                  onChange={(e) => patchForm({ bultos: e.target.value })}
                />
              </div>
              <div>
                <label className="text-label">Transportista / Razón social</label>
                <input
                  className="input-field text-base"
                  value={form.transportista}
                  disabled={confirmado}
                  onChange={(e) => patchForm({ transportista: e.target.value })}
                />
              </div>
              <div>
                <label className="text-label">C.U.I.T. transportista</label>
                <input
                  className="input-field text-base"
                  value={form.cuitTransportista}
                  disabled={confirmado}
                  onChange={(e) => patchForm({ cuitTransportista: e.target.value })}
                />
              </div>
              <div>
                <label className="text-label">Domicilio transportista</label>
                <input
                  className="input-field text-base"
                  value={form.domicilioTransportista}
                  disabled={confirmado}
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
                  disabled={confirmado}
                  onChange={(e) => patchForm({ aclaracion: e.target.value })}
                />
              </div>
              <div>
                <label className="text-label">D.N.I.</label>
                <input
                  className="input-field text-base"
                  value={form.dni}
                  disabled={confirmado}
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
                      max={linea.cantidadDisponible || undefined}
                      className="w-16 rounded border border-border bg-surface-input px-2 py-1 text-center"
                      value={linea.cantidad}
                      disabled={confirmado}
                      onChange={(e) => updateCartCantidad(linea.stockId, e.target.value)}
                    />
                    <span className="min-w-0 flex-1 truncate" title={linea.nombre}>
                      {linea.nombre}
                      <span className="block text-xs text-muted">Máx: {linea.cantidadDisponible}</span>
                    </span>
                    {!confirmado && (
                      <button
                        type="button"
                        className="text-xs font-semibold text-red-600 hover:underline dark:text-red-400"
                        onClick={() => removeFromCart(linea.stockId)}
                      >
                        Quitar
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <div className="remito-preview-panel flex min-h-0 flex-1 flex-col items-center overflow-y-auto overscroll-contain rounded-xl bg-slate-200 px-4 pb-6 pt-[10mm] shadow-inner dark:bg-slate-800">
              <div className="remito-preview-sheet w-full max-w-[210mm] shrink-0">
                <RemitoDocument
                  form={form}
                  lineas={cartList}
                  empresa={empresaSeleccionada}
                  esTransferencia={tipoRemito === 'transferencia'}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="hidden print:block">
        <RemitoDocument
          form={form}
          lineas={cartList}
          empresa={empresaSeleccionada}
          esTransferencia={tipoRemito === 'transferencia'}
        />
      </div>

      <style>{`
        @media screen {
          .remito-preview-panel .remito-doc {
            padding-top: 0;
          }
        }
        @media print {
          @page {
            size: A4;
            margin: 0;
          }
          header, nav, aside, .print\\:hidden { display: none !important; }
          main { max-width: 100% !important; padding: 0 !important; }
          body {
            margin: 0 !important;
            background: white !important;
            color: black !important;
          }
          .remito-doc {
            box-shadow: none !important;
            max-width: 210mm !important;
            width: 100% !important;
            margin-left: auto !important;
            margin-right: auto !important;
            padding-top: 10mm !important;
            padding-left: 15mm !important;
            padding-right: 15mm !important;
            padding-bottom: 15mm !important;
            box-sizing: border-box !important;
          }
        }
      `}</style>
      </>
      )}
    </div>
  );
}
