import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { ARMARIOS, ESTANTES, buildCodigoPreview } from '../utils/ubicacion';
import { CONTENEDOR_HELP } from '../utils/contenedorCodigo';

const TIPOS = ['Herramienta', 'Medición', 'Eléctrica', 'Neumática', 'Consumible', 'Otro'];

export default function AdminStock() {
  const [items, setItems] = useState([]);
  const [tab, setTab] = useState('alta');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [modo, setModo] = useState('nuevo');
  const [itemId, setItemId] = useState('');
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

  const [bajaItemId, setBajaItemId] = useState('');

  const codigoPreview = buildCodigoPreview(armario, estante, contenedor);

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

  const resetAltaForm = () => {
    setModo('nuevo');
    setItemId('');
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

  return (
    <div>
      <h2 className="page-title mb-2">Administración de stock</h2>
      <p className="mb-4 text-muted">
        Ubicación: armario + estante (obligatorio). Contenedor {CONTENEDOR_HELP} (opcional).
      </p>

      <div className="mb-4 flex gap-2">
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
        <form onSubmit={submitAlta} className="card max-w-xl space-y-4">
          <div className="flex gap-2 rounded-lg border border-slate-600 p-1">
            <button
              type="button"
              className={`flex-1 rounded-md py-2 text-sm font-bold ${
                modo === 'nuevo' ? 'bg-slate-700 text-white' : 'text-slate-300'
              }`}
              onClick={() => setModo('nuevo')}
            >
              Ítem nuevo
            </button>
            <button
              type="button"
              className={`flex-1 rounded-md py-2 text-sm font-bold ${
                modo === 'existente' ? 'bg-slate-700 text-white' : 'text-slate-300'
              }`}
              onClick={() => setModo('existente')}
            >
              Sumar a existente
            </button>
          </div>

          {modo === 'existente' ? (
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

          <div className="rounded-lg border border-slate-600 bg-slate-800/50 p-4 space-y-3">
            <h3 className="section-title text-base">Ubicación física</h3>

            <div>
              <label className="text-label">Armario *</label>
              <select
                className="input-field"
                value={armario}
                onChange={(e) => setArmario(e.target.value)}
                required
              >
                {Object.entries(ARMARIOS).map(([codigo, nombre]) => (
                  <option key={codigo} value={codigo}>
                    {codigo} — {nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-label">Estante * (E01–E09)</label>
              <select
                className="input-field"
                value={estante}
                onChange={(e) => setEstante(e.target.value)}
                required
              >
                {ESTANTES.map((e) => (
                  <option key={e.codigo} value={e.codigo}>
                    {e.codigo} — {e.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-label">Contenedor (opcional)</label>
              <input
                className="input-field"
                placeholder="Ej: C05, B12, H01 o SC"
                value={contenedor}
                onChange={(e) => setContenedor(e.target.value)}
              />
              <p className="mt-1 text-xs text-subtle">
                {CONTENEDOR_HELP}. Vacío = suelto en estante; SC = sin contenedor (código explícito).
              </p>
            </div>

            {codigoPreview && (
              <p className="font-mono text-sm text-amber-300">
                Código: <strong>{codigoPreview}</strong>
              </p>
            )}
          </div>

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

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'GUARDANDO...' : 'INGRESAR AL STOCK'}
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
              <li key={i.id} className="flex flex-wrap justify-between gap-2 border-b border-slate-700 py-2">
                <span className="font-medium text-white">{i.nombre}</span>
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
