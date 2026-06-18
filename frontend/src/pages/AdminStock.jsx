import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { ARMARIOS, ESTANTES, buildCodigoPreview } from '../utils/ubicacion';
import { CONTENEDOR_HELP } from '../utils/contenedorCodigo';

const TIPOS = ['Herramienta', 'Medición', 'Eléctrica', 'Neumática', 'Consumible', 'Otro'];

function pickPrincipalUbicacion(ubicaciones = []) {
  if (!ubicaciones.length) return null;
  return [...ubicaciones].sort((a, b) => (b.cantidad || 0) - (a.cantidad || 0))[0];
}

function applyUbicacionToForm(ubi, setters) {
  if (!ubi) return;
  const { setArmario, setEstante, setContenedor } = setters;
  if (ubi.armario) setArmario(ubi.armario);
  if (ubi.estante) setEstante(ubi.estante);
  setContenedor(ubi.contenedor || '');
}

export default function AdminStock() {
  const [items, setItems] = useState([]);
  const [tab, setTab] = useState('alta');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [modo, setModo] = useState('nuevo');
  const [itemId, setItemId] = useState('');
  const [ubicacionStockId, setUbicacionStockId] = useState('');
  const [nombre, setNombre] = useState('');
  const [marca, setMarca] = useState('');
  const [modelo, setModelo] = useState('');
  const [tipo, setTipo] = useState('Herramienta');
  const [detalle, setDetalle] = useState('');
  const [armario, setArmario] = useState('A01');
  const [estante, setEstante] = useState('E01');
  const [contenedor, setContenedor] = useState('');
  const [cantidad, setCantidad] = useState(1);
  const [calibracion, setCalibracion] = useState('');
  const [comentario, setComentario] = useState('');
  const [fechaRelevamiento, setFechaRelevamiento] = useState('');

  const [editItemId, setEditItemId] = useState('');
  const [editStockId, setEditStockId] = useState('');
  const [editNombre, setEditNombre] = useState('');
  const [editMarca, setEditMarca] = useState('');
  const [editModelo, setEditModelo] = useState('');
  const [editTipo, setEditTipo] = useState('Herramienta');
  const [editDetalle, setEditDetalle] = useState('');
  const [editArmario, setEditArmario] = useState('A01');
  const [editEstante, setEditEstante] = useState('E01');
  const [editContenedor, setEditContenedor] = useState('');
  const [editCantidad, setEditCantidad] = useState(0);

  const [bajaItemId, setBajaItemId] = useState('');

  const codigoPreview = buildCodigoPreview(armario, estante, contenedor);
  const editCodigoPreview = buildCodigoPreview(editArmario, editEstante, editContenedor);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const iData = await api.adminItems();
      setItems((iData.items || []).filter((i) => i.activo));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const selectedItem = useMemo(
    () => items.find((i) => i.id === itemId),
    [items, itemId]
  );

  const ubicacionesItem = selectedItem?.ubicaciones?.filter((u) => u.cantidad > 0) || [];

  useEffect(() => {
    if (modo !== 'existente' || !itemId) return;
    const item = items.find((i) => i.id === itemId);
    const ubi = pickPrincipalUbicacion(item?.ubicaciones?.filter((u) => u.cantidad > 0));
    if (ubi?.stockId) setUbicacionStockId(ubi.stockId);
    applyUbicacionToForm(ubi, { setArmario, setEstante, setContenedor });
  }, [itemId, modo, items]);

  const editItem = useMemo(() => items.find((i) => i.id === editItemId), [items, editItemId]);
  const editUbicaciones = editItem?.ubicaciones || [];

  useEffect(() => {
    if (!editItemId) return;
    const item = items.find((i) => i.id === editItemId);
    if (!item) return;
    setEditNombre(item.nombre || '');
    setEditMarca(item.marca || '');
    setEditModelo(item.modelo || '');
    setEditTipo(item.tipo || 'Herramienta');
    setEditDetalle(item.detalle || '');
    const ubi = pickPrincipalUbicacion(item.ubicaciones);
    if (ubi?.stockId) setEditStockId(ubi.stockId);
    if (ubi) {
      applyUbicacionToForm(ubi, {
        setArmario: setEditArmario,
        setEstante: setEditEstante,
        setContenedor: setEditContenedor,
      });
      setEditCantidad(ubi.cantidad ?? 0);
    }
  }, [editItemId, items]);

  useEffect(() => {
    if (!editStockId) return;
    const ubi = editUbicaciones.find((u) => u.stockId === editStockId);
    if (!ubi) return;
    applyUbicacionToForm(ubi, {
      setArmario: setEditArmario,
      setEstante: setEditEstante,
      setContenedor: setEditContenedor,
    });
    setEditCantidad(ubi.cantidad ?? 0);
  }, [editStockId, editUbicaciones]);

  const onUbicacionExistenteChange = (stockId) => {
    setUbicacionStockId(stockId);
    const ubi = ubicacionesItem.find((u) => u.stockId === stockId);
    applyUbicacionToForm(ubi, { setArmario, setEstante, setContenedor });
  };

  const resetAltaForm = () => {
    setModo('nuevo');
    setItemId('');
    setUbicacionStockId('');
    setNombre('');
    setMarca('');
    setModelo('');
    setTipo('Herramienta');
    setDetalle('');
    setArmario('A01');
    setEstante('E01');
    setContenedor('');
    setCantidad(1);
    setCalibracion('');
    setComentario('');
    setFechaRelevamiento('');
  };

  const resetEditForm = () => {
    setEditItemId('');
    setEditStockId('');
    setEditNombre('');
    setEditMarca('');
    setEditModelo('');
    setEditTipo('Herramienta');
    setEditDetalle('');
    setEditArmario('A01');
    setEditEstante('E01');
    setEditContenedor('');
    setEditCantidad(0);
  };

  const submitAlta = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const result = await api.adminAltaStock({
        modo,
        itemId: modo === 'existente' ? itemId : undefined,
        nombre,
        marca,
        modelo,
        tipo,
        detalle,
        armario,
        estante,
        contenedor: contenedor.trim() || null,
        cantidad: Number(cantidad),
        calibracion,
        comentario,
        fecha_relevamiento: fechaRelevamiento || undefined,
      });
      setSuccess(
        `Stock +${result.cantidadAgregada} u. en ${result.codigoUbicacion || codigoPreview}`
      );
      resetAltaForm();
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const submitEditar = async (e) => {
    e.preventDefault();
    if (!editItemId || !editStockId) return;
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      await api.adminUpdateItem(editItemId, {
        nombre: editNombre,
        marca: editMarca,
        modelo: editModelo,
        tipo: editTipo,
        detalle: editDetalle,
        stockId: editStockId,
        cantidad: Number(editCantidad),
        armario: editArmario,
        estante: editEstante,
        contenedor: editContenedor.trim() || null,
      });
      setSuccess(`Ítem "${editNombre}" actualizado.`);
      resetEditForm();
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const submitBaja = async (e) => {
    e.preventDefault();
    if (!bajaItemId) return;
    const item = items.find((i) => i.id === bajaItemId);
    if (!window.confirm(`¿Dar de baja "${item?.nombre}"? Dejará de aparecer en el inventario.`)) return;

    setError('');
    setSuccess('');
    setLoading(true);
    try {
      await api.adminBajaItem(bajaItemId);
      setSuccess(`Ítem "${item?.nombre}" dado de baja.`);
      setBajaItemId('');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const itemsActivos = items.filter((i) => i.activo);

  const ubicacionFields = (prefix, values, setters) => (
    <div className="rounded-lg border border-border bg-surface-muted p-4 space-y-3">
      <h3 className="section-title text-base">Ubicación física</h3>
      <div>
        <label className="text-label">Armario *</label>
        <select
          className="input-field"
          value={values.armario}
          onChange={(e) => setters.setArmario(e.target.value)}
          required
        >
          {Object.entries(ARMARIOS).map(([codigo, nom]) => (
            <option key={codigo} value={codigo}>
              {codigo} — {nom}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-label">Estante * (E01–E09)</label>
        <select
          className="input-field"
          value={values.estante}
          onChange={(e) => setters.setEstante(e.target.value)}
          required
        >
          {ESTANTES.map((est) => (
            <option key={est.codigo} value={est.codigo}>
              {est.codigo} — {est.nombre}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-label">Contenedor (opcional)</label>
        <input
          className="input-field"
          placeholder="Ej: C05, B12, H01 o SC"
          value={values.contenedor}
          onChange={(e) => setters.setContenedor(e.target.value)}
        />
        <p className="mt-1 text-xs text-subtle">
          {CONTENEDOR_HELP}. Vacío = suelto en estante; SC = sin contenedor (código explícito).
        </p>
      </div>
      {values.preview && (
        <p className="font-mono text-sm text-accent">
          Código: <strong>{values.preview}</strong>
        </p>
      )}
    </div>
  );

  return (
    <div>
      <h2 className="page-title mb-2">Administración de stock</h2>
      <p className="mb-4 text-muted">
        Ubicación: armario + estante (obligatorio). Contenedor {CONTENEDOR_HELP} (opcional).
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          className={tab === 'alta' ? 'btn-primary py-2 text-base' : 'btn-secondary py-2 text-base'}
          onClick={() => setTab('alta')}
        >
          Ingresar al stock
        </button>
        <button
          type="button"
          className={tab === 'baja' ? 'btn-danger py-2 text-base' : 'btn-secondary py-2 text-base'}
          onClick={() => setTab('baja')}
        >
          Dar de baja
        </button>
      </div>

      {error && <div className="alert-error mb-4">{error}</div>}
      {success && <div className="alert-success mb-4">{success}</div>}

      {tab === 'alta' && (
        <form onSubmit={modo === 'editar' ? submitEditar : submitAlta} className="card max-w-xl space-y-4">
          <div className="flex flex-wrap gap-1 rounded-lg border border-border p-1">
            <button
              type="button"
              className={`min-w-0 flex-1 rounded-md py-2 text-sm font-bold ${
                modo === 'nuevo' ? 'bg-accent text-white' : 'text-muted'
              }`}
              onClick={() => setModo('nuevo')}
            >
              Ítem nuevo
            </button>
            <button
              type="button"
              className={`min-w-0 flex-1 rounded-md py-2 text-sm font-bold ${
                modo === 'existente' ? 'bg-accent text-white' : 'text-muted'
              }`}
              onClick={() => setModo('existente')}
            >
              Sumar a existente
            </button>
            <button
              type="button"
              className={`min-w-0 flex-1 rounded-md py-2 text-sm font-bold ${
                modo === 'editar' ? 'bg-accent text-white' : 'text-muted'
              }`}
              onClick={() => setModo('editar')}
            >
              Editar existente
            </button>
          </div>

          {modo === 'existente' ? (
            <>
              <div>
                <label className="text-label">Ítem existente</label>
                <select
                  className="input-field"
                  value={itemId}
                  onChange={(e) => setItemId(e.target.value)}
                  required
                >
                  <option value="">Seleccionar...</option>
                  {itemsActivos.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.nombre} — stock total {i.totalStock} u.
                    </option>
                  ))}
                </select>
              </div>
              {ubicacionesItem.length > 1 && (
                <div>
                  <label className="text-label">Ubicación con stock</label>
                  <select
                    className="input-field"
                    value={ubicacionStockId}
                    onChange={(e) => onUbicacionExistenteChange(e.target.value)}
                  >
                    {ubicacionesItem.map((u) => (
                      <option key={u.stockId} value={u.stockId}>
                        {u.contenedorCodigo || u.ubicacionLabel} — {u.cantidad} u.
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-subtle">
                    Podés sumar en otra ubicación editando armario/estante/contenedor abajo.
                  </p>
                </div>
              )}
              {itemId && ubicacionesItem.length === 1 && (
                <p className="text-sm text-subtle">
                  Ubicación actual:{' '}
                  <span className="font-mono text-accent">{ubicacionesItem[0].contenedorCodigo}</span>
                </p>
              )}
            </>
          ) : modo === 'editar' ? (
            <>
              <div>
                <label className="text-label">Ítem a editar *</label>
                <select
                  className="input-field"
                  value={editItemId}
                  onChange={(e) => setEditItemId(e.target.value)}
                  required
                >
                  <option value="">Seleccionar...</option>
                  {itemsActivos.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.nombre} — {i.totalStock} u.
                    </option>
                  ))}
                </select>
              </div>
              {editUbicaciones.length > 1 && (
                <div>
                  <label className="text-label">Ubicación de stock</label>
                  <select
                    className="input-field"
                    value={editStockId}
                    onChange={(e) => setEditStockId(e.target.value)}
                    required
                  >
                    {editUbicaciones.map((u) => (
                      <option key={u.stockId} value={u.stockId}>
                        {u.contenedorCodigo || u.ubicacionLabel} — {u.cantidad} u.
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {editItemId && (
                <>
                  <div>
                    <label className="text-label">Nombre *</label>
                    <input
                      className="input-field"
                      value={editNombre}
                      onChange={(e) => setEditNombre(e.target.value)}
                      required
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="text-label">Marca</label>
                      <input
                        className="input-field"
                        value={editMarca}
                        onChange={(e) => setEditMarca(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-label">Modelo</label>
                      <input
                        className="input-field"
                        value={editModelo}
                        onChange={(e) => setEditModelo(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-label">Tipo</label>
                    <select
                      className="input-field"
                      value={editTipo}
                      onChange={(e) => setEditTipo(e.target.value)}
                    >
                      {TIPOS.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-label">Detalle</label>
                    <input
                      className="input-field"
                      value={editDetalle}
                      onChange={(e) => setEditDetalle(e.target.value)}
                    />
                  </div>
                  {ubicacionFields(
                    'edit',
                    { armario: editArmario, estante: editEstante, contenedor: editContenedor, preview: editCodigoPreview },
                    { setArmario: setEditArmario, setEstante: setEditEstante, setContenedor: setEditContenedor }
                  )}
                  <div>
                    <label className="text-label">Cantidad en stock *</label>
                    <input
                      type="number"
                      min={0}
                      className="input-field"
                      value={editCantidad}
                      onChange={(e) => setEditCantidad(e.target.value)}
                      required
                    />
                    <p className="mt-1 text-xs text-subtle">0 elimina el stock en esa ubicación.</p>
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <div>
                <label className="text-label">Nombre *</label>
                <input
                  className="input-field"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-label">Marca</label>
                  <input className="input-field" value={marca} onChange={(e) => setMarca(e.target.value)} />
                </div>
                <div>
                  <label className="text-label">Modelo</label>
                  <input className="input-field" value={modelo} onChange={(e) => setModelo(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="text-label">Tipo</label>
                <select className="input-field" value={tipo} onChange={(e) => setTipo(e.target.value)}>
                  {TIPOS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-label">Detalle</label>
                <input className="input-field" value={detalle} onChange={(e) => setDetalle(e.target.value)} />
              </div>
              <div>
                <label className="text-label">Calibración</label>
                <input
                  className="input-field"
                  placeholder="No aplica / Sí - vigente..."
                  value={calibracion}
                  onChange={(e) => setCalibracion(e.target.value)}
                />
              </div>
              <div>
                <label className="text-label">Comentario</label>
                <input
                  className="input-field"
                  placeholder="Color, forma..."
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                />
              </div>
              <div>
                <label className="text-label">Fecha relevamiento</label>
                <input
                  type="date"
                  className="input-field"
                  value={fechaRelevamiento}
                  onChange={(e) => setFechaRelevamiento(e.target.value)}
                />
              </div>
            </>
          )}

          {modo !== 'editar' &&
            ubicacionFields(
              'alta',
              { armario, estante, contenedor, preview: codigoPreview },
              { setArmario, setEstante, setContenedor }
            )}

          {modo !== 'editar' && (
            <div>
              <label className="text-label">Cantidad a ingresar *</label>
              <input
                type="number"
                min={1}
                className="input-field"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                required
              />
            </div>
          )}

          <button
            type="submit"
            className="btn-primary w-full"
            disabled={
              loading ||
              (modo === 'editar' && (!editItemId || !editStockId))
            }
          >
            {loading
              ? 'GUARDANDO...'
              : modo === 'editar'
                ? 'GUARDAR CAMBIOS'
                : 'INGRESAR AL STOCK'}
          </button>
        </form>
      )}

      {tab === 'baja' && (
        <form onSubmit={submitBaja} className="card max-w-xl space-y-4">
          <p className="text-sm text-muted">
            La baja oculta el ítem del inventario. No se permite si hay egresos pendientes.
          </p>
          <div>
            <label className="text-label">Ítem a dar de baja *</label>
            <select
              className="input-field"
              value={bajaItemId}
              onChange={(e) => setBajaItemId(e.target.value)}
              required
            >
              <option value="">Seleccionar...</option>
              {itemsActivos.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.nombre} ({i.tipo}) — {i.totalStock} u.
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn-danger w-full" disabled={loading || !bajaItemId}>
            {loading ? 'PROCESANDO...' : 'DAR DE BAJA'}
          </button>
        </form>
      )}

      <div className="card mt-6">
        <h3 className="section-title mb-3">Ítems registrados</h3>
        {loading && !items.length ? (
          <p className="text-muted">Cargando...</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {items.map((i) => (
              <li key={i.id} className="flex flex-wrap justify-between gap-2 border-b border-border py-2">
                <span className="font-medium text-content">{i.nombre}</span>
                <span className="text-muted">
                  {i.totalStock} u. ·{' '}
                  {i.ubicaciones?.map((u) => u.contenedorCodigo || u.ubicacionLabel).join(', ') || '—'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
