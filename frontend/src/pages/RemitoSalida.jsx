import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import ClienteAutocomplete from '../components/ClienteAutocomplete';
import RemitoDocument from '../components/RemitoDocument';
import RemitoRecibir from '../components/RemitoRecibir';
import RemitoScanLoader from '../components/RemitoScanLoader';
import SearchFilters from '../components/SearchFilters';
import ItemThumb from '../components/ItemThumb';
import { formatUbicacionLabel } from '../utils/contenedor';
import {
  ALMACEN_DEFAULT,
  getSedeNombreFromCatalog,
  getSedesFromCatalog,
  resolveAduanaUbicacion,
  SEDE_DEFAULT,
} from '../utils/ubicacion';
import { todayIsoDate } from '../utils/remitoStorage';
import { fieldLabel } from '../utils/fieldLabels';

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
    sede: item.sede || SEDE_DEFAULT,
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
  const { sede: sessionSede, sedeNombre } = useAuth();
  const [vista, setVista] = useState('emitir');
  const [tipoRemito, setTipoRemito] = useState('venta');
  const [inventario, setInventario] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    q: '',
    almacen: '',
    armario: '',
    contenedor: '',
    tipo: '',
    sede: '',
  });
  const [catalogo, setCatalogo] = useState({ almacenes: [], armariosPorAlmacen: {}, sedes: [], aduanasPorSede: {} });
  const [contenedoresCatalogo, setContenedoresCatalogo] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [cart, setCart] = useState(() => new Map());
  const [showPreview, setShowPreview] = useState(false);
  const [mobilePreviewTab, setMobilePreviewTab] = useState('remito');
  const [form, setForm] = useState(EMPTY_FORM);
  const [empresas, setEmpresas] = useState([]);
  const [empresaId, setEmpresaId] = useState('');
  const [empresaDestinoId, setEmpresaDestinoId] = useState('');
  const [confirmado, setConfirmado] = useState(false);
  const [remitoId, setRemitoId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [addMode, setAddMode] = useState('lista'); // lista | camara | laser
  const [scanLoader, setScanLoader] = useState(null); // null | 'camara' | 'laser'
  const [almacenOrigen, setAlmacenOrigen] = useState(ALMACEN_DEFAULT);
  const [sedeOrigen, setSedeOrigen] = useState(SEDE_DEFAULT);
  const [almacenDestino, setAlmacenDestino] = useState('');
  const [sedeDestino, setSedeDestino] = useState(SEDE_DEFAULT);
  const [destArmario, setDestArmario] = useState('A01');
  const [destEstante, setDestEstante] = useState('E01');
  const [destContenedor, setDestContenedor] = useState('');

  const empresaSeleccionada = useMemo(
    () => empresas.find((e) => e.id === empresaId) || null,
    [empresas, empresaId]
  );

  const empresaDestino = useMemo(
    () => empresas.find((e) => e.id === empresaDestinoId) || null,
    [empresas, empresaDestinoId]
  );

  const sedesCatalogo = useMemo(() => getSedesFromCatalog(catalogo), [catalogo]);

  const sedeOrigenNombre = useMemo(
    () =>
      sedeNombre ||
      getSedeNombreFromCatalog(catalogo, sessionSede || sedeOrigen) ||
      sessionSede ||
      sedeOrigen ||
      '',
    [sedeNombre, catalogo, sessionSede, sedeOrigen]
  );

  useEffect(() => {
    if (sessionSede) {
      setFilters((prev) => ({ ...prev, sede: sessionSede }));
      setSedeOrigen(sessionSede);
      setSedeDestino(sessionSede);
    }
  }, [sessionSede]);

  useEffect(() => {
    setLoading(true);
    api
      .inventario(filters)
      .then((data) => setInventario(data.items || []))
      .finally(() => setLoading(false));
  }, [filters.q, filters.almacen, filters.armario, filters.contenedor, filters.tipo, filters.sede]);

  useEffect(() => {
    Promise.all([
      api.catalogoUbicacion(sessionSede ? { sede: sessionSede } : {}),
      api.tipos(),
      api.empresasEmisoras(),
      api.contenedores().catch(() => ({ contenedores: [] })),
    ])
      .then(([cat, tiposData, empresasData, cnt]) => {
        setCatalogo({
          almacenes: cat.almacenes || [],
          armariosPorAlmacen: cat.armariosPorAlmacen || {},
          sedes: cat.sedes || [],
          aduanasPorSede: cat.aduanasPorSede || {},
        });
        setTipos(tiposData.tipos || []);
        setContenedoresCatalogo(cnt.contenedores || []);
        const list = empresasData.empresas || [];
        setEmpresas(list);
        if (list.length && !empresaId) {
          setEmpresaId(list[0].id);
        }
      })
      .catch(() => {});
  }, [sessionSede]);

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

  useEffect(() => {
    if (tipoRemito !== 'transferencia') return;
    if (sessionSede) setSedeOrigen(sessionSede);
  }, [tipoRemito, sessionSede]);

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

  const addScannedItem = (item, cantidad) => {
    const stockId = item.stockId || item.id;
    setCart((prev) => {
      const next = new Map(prev);
      const existing = next.get(stockId);
      if (existing) {
        const max = existing.cantidadDisponible;
        const sum = existing.cantidad + cantidad;
        next.set(stockId, {
          ...existing,
          cantidad: max > 0 ? Math.min(sum, max) : sum,
        });
      } else {
        const entry = cartEntryFromItem(item);
        const max = entry.cantidadDisponible;
        next.set(stockId, {
          ...entry,
          cantidad: max > 0 ? Math.min(cantidad, max) : cantidad,
        });
      }
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

  const openPreviewModal = (tab = 'remito') => {
    setMobilePreviewTab(tab);
    setShowPreview(true);
  };

  const openPreview = () => {
    setForm((f) => ({
      ...f,
      fecha: f.fecha || todayIsoDate(),
    }));
    setError('');
    openPreviewModal('remito');
  };

  const patchForm = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setConfirmado(false);
    setRemitoId(null);
  };

  useEffect(() => {
    if (tipoRemito !== 'transferencia' || !sedeDestino) return;
    const aduana = resolveAduanaUbicacion(catalogo, sedeDestino);
    if (aduana) {
      setAlmacenDestino(aduana.almacen);
      setDestArmario(aduana.armario);
      setDestEstante(aduana.estante);
      setDestContenedor(aduana.contenedor || '');
    } else {
      setAlmacenDestino('');
      setDestArmario('A00');
      setDestEstante('E01');
      setDestContenedor('C01');
    }
  }, [tipoRemito, sedeDestino, catalogo]);

  useEffect(() => {
    if (tipoRemito !== 'transferencia') return;
    setForm((f) => ({
      ...f,
      cedeOrigen: sedeOrigenNombre,
      iva: 'Transferencia intercompany',
    }));
  }, [tipoRemito, sedeOrigenNombre]);

  useEffect(() => {
    if (tipoRemito !== 'transferencia') return;
    const cedeDestino =
      getSedeNombreFromCatalog(catalogo, sedeDestino) || sedeDestino || '';
    const emp = empresaDestino;
    setForm((f) => ({
      ...f,
      cedeDestino,
      iva: 'Transferencia intercompany',
      destinatario: emp ? emp.razonSocial || emp.nombre || '' : f.destinatario,
      domicilio: emp ? emp.domicilio || '' : f.domicilio,
      localidad: emp ? emp.localidad || '' : f.localidad,
      cuit: emp ? emp.cuit || '' : f.cuit,
    }));
  }, [tipoRemito, sedeDestino, empresaDestino, catalogo]);

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
      if (!sessionSede && !sedeOrigen) {
        setError('No hay sede de origen en la sesión.');
        return;
      }
      if (!sedeDestino?.trim()) {
        setError('Seleccioná la sede destino.');
        return;
      }
      if (!empresaDestinoId) {
        setError('Seleccioná la razón social destino.');
        return;
      }
      if (!almacenDestino?.trim() || !destArmario || !destEstante) {
        setError('La sede destino no tiene aduana (recepción tránsito) configurada.');
        return;
      }
      if (!almacenOrigen?.trim()) {
        setError('No se pudo determinar el almacén origen de los ítems.');
        return;
      }
      if (almacenOrigen === almacenDestino) {
        setError('El stock destino (aduana) no puede ser el mismo almacén de origen.');
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
              empresaDestinoId: empresaDestinoId || undefined,
              ubicacionDestino: {
                sede: sedeDestino,
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
    <div className="w-full min-w-0 max-w-full overflow-x-hidden pb-28">
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
            Sucursal: <strong className="text-content">{sedeNombre || sessionSede || '—'}</strong>
            . Seleccioná ítems desde la lista, la cámara o un lector láser; confirmá el remito para
            descontar stock y luego imprimí.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-secondary text-sm"
            onClick={selectVisible}
            disabled={!filteredItems.length || addMode !== 'lista'}
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
        <label className="text-label">Cómo agregar ítems</label>
        <div className="mt-1 flex flex-wrap gap-2">
          {[
            { id: 'lista', label: 'Desde la lista' },
            { id: 'camara', label: 'Cámara (QR / codebar)' },
            { id: 'laser', label: 'Lector láser' },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                addMode === opt.id
                  ? 'bg-accent text-white'
                  : 'border border-border bg-surface-muted text-content'
              }`}
              disabled={confirmado}
              onClick={() => {
                setAddMode(opt.id);
                if (opt.id === 'camara' || opt.id === 'laser') {
                  setScanLoader(opt.id);
                } else {
                  setScanLoader(null);
                }
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {addMode !== 'lista' && (
          <p className="mt-2 text-xs text-muted">
            En cada lectura vas a indicar la cantidad y podés seguir con «Leer otro ítem» o
            «Finalizar carga».
          </p>
        )}
        {(addMode === 'camara' || addMode === 'laser') && !scanLoader && !confirmado && (
          <button
            type="button"
            className="btn-primary mt-3 min-h-[44px]"
            onClick={() => setScanLoader(addMode)}
          >
            {addMode === 'camara' ? 'Abrir cámara' : 'Activar lector láser'}
          </button>
        )}
      </div>

      <div className="card mb-4 print:hidden">
        <label className="text-label">{fieldLabel('tipo')}</label>
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
            Transferencia entre sedes (intercompany): elegí sede y razón social destino. El stock
            queda en aduana de esa sede hasta la recepción.
          </p>
        )}
      </div>

      {addMode === 'lista' && (
      <div className="print:hidden">
        <SearchFilters
          filters={filters}
          onChange={(f) => setFilters((prev) => ({ ...prev, ...f }))}
          almacenes={catalogo.almacenes}
          armariosPorAlmacen={catalogo.armariosPorAlmacen}
          contenedores={contenedoresCatalogo}
          tipos={tipos}
        />
      </div>
      )}

      {addMode === 'lista' && (
        <>
          {loading && <p className="text-muted print:hidden">Cargando inventario...</p>}

          {!loading && !filteredItems.length && (
            <p className="text-muted print:hidden">Sin resultados para estos filtros.</p>
          )}

          <div className="card mb-6 grid w-full min-w-0 max-w-full gap-2 overflow-hidden print:hidden sm:grid-cols-2 lg:grid-cols-3">
            {filteredItems.map((item) => {
              const stockId = item.stockId || item.id;
              const checked = isInCart(stockId);
              return (
                <label
                  key={stockId}
                  className={`flex min-w-0 max-w-full cursor-pointer items-start gap-2.5 overflow-hidden rounded-lg border p-3 transition hover:bg-surface-hover ${
                    checked ? 'border-accent bg-accent/10' : 'border-border text-content'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleItem(item)}
                    className="mt-1.5 h-5 w-5 shrink-0 accent-accent"
                  />
                  <ItemThumb item={item} />
                  <span className="min-w-0 flex-1 overflow-hidden">
                    <span className="block break-words font-semibold leading-snug text-content">
                      {itemLinea(item)}
                    </span>
                    <span className="mt-0.5 block break-words text-xs text-content-muted">
                      {formatUbicacionLabel(item)}
                    </span>
                    <span className="mt-1 inline-block max-w-full rounded bg-surface-muted px-2 py-0.5 text-xs font-bold">
                      {fieldLabel('cantidad')}: {item.cantidad}
                    </span>
                    {item.codigoFabricante && (
                      <span className="mt-1 block truncate font-mono text-[11px] text-subtle">
                        {fieldLabel('codigoFabricante')}: {item.codigoFabricante}
                      </span>
                    )}
                  </span>
                </label>
              );
            })}
          </div>
        </>
      )}

      {scanLoader && (
        <RemitoScanLoader
          mode={scanLoader}
          onAddItem={addScannedItem}
          onClose={() => setScanLoader(null)}
        />
      )}

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
              <button type="button" className="btn-secondary text-sm" onClick={() => openPreviewModal('datos')}>
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

          <div className="flex shrink-0 gap-2 border-b border-border bg-surface-elevated px-4 py-2 lg:hidden">
            <button
              type="button"
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${
                mobilePreviewTab === 'datos'
                  ? 'bg-accent text-white'
                  : 'bg-surface-muted text-content-muted'
              }`}
              onClick={() => setMobilePreviewTab('datos')}
            >
              Datos del remito
            </button>
            <button
              type="button"
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${
                mobilePreviewTab === 'remito'
                  ? 'bg-accent text-white'
                  : 'bg-surface-muted text-content-muted'
              }`}
              onClick={() => setMobilePreviewTab('remito')}
            >
              Vista previa
            </button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4 lg:flex-row lg:overflow-y-auto lg:pt-[10mm]">
            <div
              className={`card min-h-0 space-y-3 overflow-y-auto lg:block lg:w-96 lg:shrink-0 ${
                mobilePreviewTab === 'remito' ? 'hidden lg:block' : 'flex-1'
              }`}
            >
              <h4 className="font-bold text-content">Datos del remito</h4>

              <div>
                <label className="text-label">{fieldLabel('razonSocial')}</label>
                <select
                  className="input-field text-base"
                  value={empresaId}
                  disabled={confirmado}
                  onChange={(e) => handleEmpresaChange(e.target.value)}
                >
                  {empresas.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.razonSocial || e.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-label">{fieldLabel('numero')}</label>
                  <input
                    className="input-field text-base"
                    value={form.numero}
                    disabled={confirmado}
                    onChange={(e) => patchForm({ numero: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-label">{fieldLabel('fecha')}</label>
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
                  <h4 className="font-bold text-content">Transferencia entre sedes</h4>
                  <p className="text-xs text-muted">
                    Intercompany: el stock llega a la <strong>aduana</strong> (recepción tránsito) de
                    la sede destino. El detalle de almacén/armario no se muestra en el remito.
                  </p>

                  <div>
                    <label className="text-label">{fieldLabel('sede')}</label>
                    <input
                      className="input-field text-base"
                      value={form.cedeOrigen || sedeOrigenNombre}
                      disabled
                      readOnly
                    />
                    <p className="mt-1 text-xs text-muted">
                      Fija según la sede de tu sesión
                      {sessionSede ? ` (${sessionSede})` : ''}.
                    </p>
                  </div>

                  <div>
                    <label className="text-label">{fieldLabel('sede')}</label>
                    <select
                      className="input-field text-base"
                      value={sedeDestino}
                      disabled={confirmado}
                      onChange={(e) => {
                        setSedeDestino(e.target.value);
                        setConfirmado(false);
                        setRemitoId(null);
                      }}
                    >
                      {sedesCatalogo.map((s) => (
                        <option key={s.codigo} value={s.codigo}>
                          {s.codigo} — {s.nombre || s.codigo}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-muted">Sede que recibe la transferencia.</p>
                  </div>

                  <div>
                    <label className="text-label">{fieldLabel('razonSocial')}</label>
                    <select
                      className="input-field text-base"
                      value={empresaDestinoId}
                      disabled={confirmado}
                      onChange={(e) => {
                        setEmpresaDestinoId(e.target.value);
                        setConfirmado(false);
                        setRemitoId(null);
                      }}
                    >
                      <option value="">Elegí razón social…</option>
                      {empresas.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.razonSocial || e.nombre}
                          {e.sedeCodigo ? ` (${e.sedeCodigo})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {(form.domicilio || form.localidad || form.cuit) && (
                    <div className="rounded-lg border border-border bg-surface-muted/40 p-3 text-sm text-muted">
                      {form.domicilio && (
                        <p>
                          {fieldLabel('domicilio')}: {form.domicilio}
                        </p>
                      )}
                      {form.localidad && (
                        <p>
                          {fieldLabel('localidad')}: {form.localidad}
                        </p>
                      )}
                      {form.cuit && (
                        <p>
                          {fieldLabel('cuit')}: {form.cuit}
                        </p>
                      )}
                    </div>
                  )}
                </>
              ) : (
              <>
              <div>
                <label className="text-label">{fieldLabel('nombre')}</label>
                <ClienteAutocomplete
                  value={form.destinatario}
                  onChange={patchForm}
                  onSelect={handleClienteSelect}
                  disabled={confirmado}
                />
              </div>
              <div>
                <label className="text-label">{fieldLabel('iva')}</label>
                <input
                  className="input-field text-base"
                  value={form.iva}
                  disabled={confirmado}
                  onChange={(e) => patchForm({ iva: e.target.value })}
                />
              </div>
              <div>
                <label className="text-label">{fieldLabel('domicilio')}</label>
                <input
                  className="input-field text-base"
                  value={form.domicilio}
                  disabled={confirmado}
                  onChange={(e) => patchForm({ domicilio: e.target.value })}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-label">{fieldLabel('localidad')}</label>
                  <input
                    className="input-field text-base"
                    value={form.localidad}
                    disabled={confirmado}
                    onChange={(e) => patchForm({ localidad: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-label">{fieldLabel('vRef')}</label>
                  <input
                    className="input-field text-base"
                    value={form.vRef}
                    disabled={confirmado}
                    onChange={(e) => patchForm({ vRef: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="text-label">{fieldLabel('cuit')}</label>
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
                <label className="text-label">{fieldLabel('cantBultos')}</label>
                <input
                  className="input-field text-base"
                  value={form.bultos}
                  disabled={confirmado}
                  onChange={(e) => patchForm({ bultos: e.target.value })}
                />
              </div>
              <div>
                <label className="text-label">{fieldLabel('transportista')}</label>
                <input
                  className="input-field text-base"
                  value={form.transportista}
                  disabled={confirmado}
                  onChange={(e) => patchForm({ transportista: e.target.value })}
                />
              </div>
              <div>
                <label className="text-label">{fieldLabel('transportistaCuit')}</label>
                <input
                  className="input-field text-base"
                  value={form.cuitTransportista}
                  disabled={confirmado}
                  onChange={(e) => patchForm({ cuitTransportista: e.target.value })}
                />
              </div>
              <div>
                <label className="text-label">{fieldLabel('transportistaDomicilio')}</label>
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
                <label className="text-label">{fieldLabel('aclaracion')}</label>
                <input
                  className="input-field text-base"
                  value={form.aclaracion}
                  disabled={confirmado}
                  onChange={(e) => patchForm({ aclaracion: e.target.value })}
                />
              </div>
              <div>
                <label className="text-label">{fieldLabel('dni')}</label>
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

            <div
              className={`remito-preview-panel flex min-h-0 flex-col items-center overflow-y-auto overscroll-contain rounded-xl bg-slate-200 px-4 pb-6 pt-[10mm] shadow-inner dark:bg-slate-800 lg:flex-1 ${
                mobilePreviewTab === 'datos' ? 'hidden lg:flex' : 'flex-1'
              }`}
            >
              <div className="remito-preview-sheet w-full max-w-[210mm] shrink-0">
                <RemitoDocument
                  form={form}
                  lineas={cartList}
                  empresa={empresaSeleccionada}
                  esTransferencia={tipoRemito === 'transferencia'}
                  remitoId={remitoId}
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
          remitoId={remitoId}
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
