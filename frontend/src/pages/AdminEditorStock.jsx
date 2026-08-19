import { useEffect, useMemo, useState } from 'react';
import FilterableSelect from '../components/FilterableSelect';
import FocusedPage from '../components/FocusedPage';
import StockBulkImport from '../components/StockBulkImport';
import CatalogEnrichImport from '../components/CatalogEnrichImport';
import { useAuth } from '../auth/AuthProvider';
import { api } from '../api/client';
import {
  ALMACEN_DEFAULT,
  ESTANTES,
  buildCodigoPreview,
  getArmariosForAlmacen,
  pickDefaultArmario,
} from '../utils/ubicacion';
import { CONTENEDOR_HELP } from '../utils/contenedorCodigo';
import { fieldLabel } from '../utils/fieldLabels';

const DEFAULT_TIPO = 'Herramienta';

function pickPrincipalUbicacion(ubicaciones = []) {
  if (!ubicaciones.length) return null;
  return [...ubicaciones].sort((a, b) => (b.cantidad || 0) - (a.cantidad || 0))[0];
}

function applyUbicacionToForm(ubi, setters) {
  if (!ubi) return;
  const { setAlmacen, setArmario, setEstante, setContenedor } = setters;
  if (ubi.almacen) setAlmacen(ubi.almacen);
  if (ubi.armario) setArmario(ubi.armario);
  if (ubi.estante) setEstante(ubi.estante);
  setContenedor(ubi.contenedor || '');
}

export default function AdminEditorStock() {
  const { sede: sessionSede, sedeNombre: sessionSedeNombre } = useAuth();
  const [items, setItems] = useState([]);
  const [section, setSection] = useState('individual');
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
  const [tipo, setTipo] = useState(DEFAULT_TIPO);
  const [detalle, setDetalle] = useState('');
  const [catalogo, setCatalogo] = useState({ almacenes: [], armariosPorAlmacen: {} });
  const [tipos, setTipos] = useState([DEFAULT_TIPO]);
  const [almacen, setAlmacen] = useState(ALMACEN_DEFAULT);
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
  const [editTipo, setEditTipo] = useState(DEFAULT_TIPO);
  const [editDetalle, setEditDetalle] = useState('');
  const [editCodigoFab, setEditCodigoFab] = useState('');
  const [editUnidad, setEditUnidad] = useState('');
  const [editPacking, setEditPacking] = useState('');
  const [editPrecioLista, setEditPrecioLista] = useState('');
  const [editMoneda, setEditMoneda] = useState('');
  const [editPesoKg, setEditPesoKg] = useState('');
  const [editFamilia, setEditFamilia] = useState('');
  const [editSubfamilia, setEditSubfamilia] = useState('');
  const [editTema, setEditTema] = useState('');
  const [editCatalogoFuente, setEditCatalogoFuente] = useState('');
  const [editCatalogoVigencia, setEditCatalogoVigencia] = useState('');
  const [editAlmacen, setEditAlmacen] = useState(ALMACEN_DEFAULT);
  const [editArmario, setEditArmario] = useState('A01');
  const [editEstante, setEditEstante] = useState('E01');
  const [editContenedor, setEditContenedor] = useState('');
  const [editCantidad, setEditCantidad] = useState(0);

  const [bajaItemId, setBajaItemId] = useState('');

  const codigoPreview = buildCodigoPreview(almacen, armario, estante, contenedor);
  const editCodigoPreview = buildCodigoPreview(editAlmacen, editArmario, editEstante, editContenedor);

  const almacenes = catalogo.almacenes?.length
    ? catalogo.almacenes
    : [{ codigo: ALMACEN_DEFAULT, nombre: 'Oficina principal', tipo: 'Oficina' }];

  const armariosForAlmacen = (alm) => getArmariosForAlmacen(catalogo, alm);
  const armariosCatalogo = armariosForAlmacen(almacen);
  const editArmariosCatalogo = armariosForAlmacen(editAlmacen);

  const syncAlmacenDefaults = (list) => {
    if (!list?.length) return;
    const first = list[0].codigo;
    const codes = new Set(list.map((a) => a.codigo));
    setAlmacen((prev) => (codes.has(prev) ? prev : first));
    setEditAlmacen((prev) => (codes.has(prev) ? prev : first));
  };

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [iData, cat, tiposData] = await Promise.all([
        api.adminItems(),
        api.catalogoUbicacion(sessionSede ? { sede: sessionSede } : {}),
        api.tipos(),
      ]);
      const nextCat = {
        almacenes: cat.almacenes || [],
        armariosPorAlmacen: cat.armariosPorAlmacen || {},
      };
      const allowedAlms = new Set(nextCat.almacenes.map((a) => a.codigo));
      setItems(
        (iData.items || [])
          .filter((i) => i.activo)
          .map((item) => {
            if (!sessionSede) return item;
            const ubicaciones = (item.ubicaciones || []).filter((u) => {
              if (u.almacen && allowedAlms.size) return allowedAlms.has(u.almacen);
              return u.sede === sessionSede;
            });
            const totalStock = ubicaciones.reduce((sum, u) => sum + (u.cantidad || 0), 0);
            return { ...item, ubicaciones, totalStock };
          })
      );
      setCatalogo(nextCat);
      syncAlmacenDefaults(nextCat.almacenes);
      setTipos(tiposData.tipos?.length ? tiposData.tipos : [DEFAULT_TIPO]);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // Recargar al cambiar sucursal de sesión
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionSede]);

  useEffect(() => {
    const list = armariosForAlmacen(almacen);
    if (!list.length) {
      if (armario) setArmario('');
      return;
    }
    if (!list.some((a) => a.codigo === armario)) {
      setArmario(pickDefaultArmario(list));
    }
  }, [almacen, catalogo.armariosPorAlmacen]);

  useEffect(() => {
    const list = armariosForAlmacen(editAlmacen);
    if (!list.length) {
      if (editArmario) setEditArmario('');
      return;
    }
    if (!list.some((a) => a.codigo === editArmario)) {
      setEditArmario(pickDefaultArmario(list));
    }
  }, [editAlmacen, catalogo.armariosPorAlmacen]);

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
    applyUbicacionToForm(ubi, { setAlmacen, setArmario, setEstante, setContenedor });
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
    setEditTipo(item.tipo || DEFAULT_TIPO);
    setEditDetalle(item.detalle || '');
    setEditCodigoFab(item.codigoFabricante || '');
    setEditUnidad(item.unidad || '');
    setEditPacking(item.packing || '');
    setEditPrecioLista(item.precioLista != null ? String(item.precioLista) : '');
    setEditMoneda(item.moneda || '');
    setEditPesoKg(item.pesoKg != null ? String(item.pesoKg) : '');
    setEditFamilia(item.familia || '');
    setEditSubfamilia(item.subfamilia || '');
    setEditTema(item.tema || '');
    setEditCatalogoFuente(item.catalogoFuente || '');
    setEditCatalogoVigencia(item.catalogoVigencia || '');
    const ubi = pickPrincipalUbicacion(item.ubicaciones);
    if (ubi?.stockId) {
      setEditStockId(ubi.stockId);
      applyUbicacionToForm(ubi, {
        setAlmacen: setEditAlmacen,
        setArmario: setEditArmario,
        setEstante: setEditEstante,
        setContenedor: setEditContenedor,
      });
      setEditCantidad(ubi.cantidad ?? 0);
    } else {
      setEditStockId('');
      setEditCantidad(0);
    }
  }, [editItemId, items]);

  useEffect(() => {
    if (!editStockId) return;
    const ubi = editUbicaciones.find((u) => u.stockId === editStockId);
    if (!ubi) return;
    applyUbicacionToForm(ubi, {
      setAlmacen: setEditAlmacen,
      setArmario: setEditArmario,
      setEstante: setEditEstante,
      setContenedor: setEditContenedor,
    });
    setEditCantidad(ubi.cantidad ?? 0);
  }, [editStockId, editUbicaciones]);

  const onUbicacionExistenteChange = (stockId) => {
    setUbicacionStockId(stockId);
    const ubi = ubicacionesItem.find((u) => u.stockId === stockId);
    applyUbicacionToForm(ubi, { setAlmacen, setArmario, setEstante, setContenedor });
  };

  const resetAltaForm = () => {
    setModo('nuevo');
    setItemId('');
    setUbicacionStockId('');
    setNombre('');
    setMarca('');
    setModelo('');
    setTipo(DEFAULT_TIPO);
    setDetalle('');
    setAlmacen(ALMACEN_DEFAULT);
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
    setEditTipo(DEFAULT_TIPO);
    setEditDetalle('');
    setEditAlmacen(ALMACEN_DEFAULT);
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
        sede: sessionSede || undefined,
        almacen,
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
    if (!editItemId) return;
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const qty = Number(editCantidad);
      const payload = {
        nombre: editNombre,
        marca: editMarca,
        modelo: editModelo,
        tipo: editTipo,
        detalle: editDetalle,
        codigoFabricante: editCodigoFab,
        unidad: editUnidad,
        packing: editPacking,
        precioLista: editPrecioLista === '' ? null : editPrecioLista,
        moneda: editMoneda,
        pesoKg: editPesoKg === '' ? null : editPesoKg,
        familia: editFamilia,
        subfamilia: editSubfamilia,
        tema: editTema,
        catalogoFuente: editCatalogoFuente,
        catalogoVigencia: editCatalogoVigencia,
      };
      if (editStockId || qty > 0) {
        payload.stockId = editStockId || undefined;
        payload.cantidad = qty;
        payload.sede = sessionSede || undefined;
        payload.almacen = editAlmacen;
        payload.armario = editArmario;
        payload.estante = editEstante;
        payload.contenedor = editContenedor.trim() || null;
      }
      await api.adminUpdateItem(editItemId, payload);
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

  const handleImported = async (data) => {
    setError('');
    await load();
    setSuccess(`Importadas ${data.ok} de ${data.filas} filas (modo: ${data.modo}).`);
  };

  const itemsActivos = items.filter((i) => i.activo);

  const itemOptions = useMemo(
    () =>
      itemsActivos.map((i) => ({
        value: i.id,
        label: `${i.nombre} — stock total ${i.totalStock} u.`,
        searchText: `${i.nombre} ${i.marca || ''} ${i.modelo || ''} ${i.tipo || ''} ${i.codigoFabricante || ''}`,
      })),
    [itemsActivos]
  );

  const editItemOptions = useMemo(
    () =>
      itemsActivos.map((i) => ({
        value: i.id,
        label: `${i.nombre} — ${i.totalStock} u.`,
        searchText: `${i.nombre} ${i.marca || ''} ${i.modelo || ''} ${i.tipo || ''} ${i.codigoFabricante || ''}`,
      })),
    [itemsActivos]
  );

  const ubicacionCascade = {
    onAlmacenChange: (setters) => (e) => {
      setters.setAlmacen(e.target.value);
      setters.setArmario('');
      setters.setEstante('E01');
      setters.setContenedor('');
    },
    onArmarioChange: (setters) => (e) => {
      setters.setArmario(e.target.value);
      setters.setEstante('E01');
      setters.setContenedor('');
    },
    onEstanteChange: (setters) => (e) => {
      setters.setEstante(e.target.value);
      setters.setContenedor('');
    },
  };

  const ubicacionFields = (values, setters, armariosList, { compact = false } = {}) => {
    const armarioSelect = (
      <select
        className="input-field"
        value={values.armario}
        onChange={ubicacionCascade.onArmarioChange(setters)}
        required
        disabled={!armariosList.length}
      >
        {armariosList.length ? (
          armariosList.map((a) => (
            <option key={a.codigo} value={a.codigo}>
              {compact ? a.codigo : `${a.codigo} — ${a.nombre}${a.tipo && a.tipo !== 'armario' ? ` (${a.tipo})` : ''}`}
            </option>
          ))
        ) : (
          <option value="">{compact ? '—' : 'Sin armarios — creá uno en Locaciones'}</option>
        )}
      </select>
    );

    if (compact) {
      return (
        <div className="rounded-lg border-2 border-accent/40 bg-surface-muted p-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="section-title text-base">Ubicación física</h3>
            {values.preview && (
              <p className="font-mono text-sm font-bold text-accent">{values.preview}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div>
              <label className="text-label text-xs">{fieldLabel('almacen', { required: true })}</label>
              <select
                className="input-field py-2 text-sm"
                value={values.almacen}
                onChange={ubicacionCascade.onAlmacenChange(setters)}
                required
              >
                {almacenes.map((a) => (
                  <option key={a.codigo} value={a.codigo}>
                    {a.codigo}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-label text-xs">{fieldLabel('armario', { required: true })}</label>
              <div className="[&_.input-field]:py-2 [&_.input-field]:text-sm">{armarioSelect}</div>
            </div>
            <div>
              <label className="text-label text-xs">{fieldLabel('estante', { required: true })}</label>
              <select
                className="input-field py-2 text-sm"
                value={values.estante}
                onChange={ubicacionCascade.onEstanteChange(setters)}
                required
              >
                {ESTANTES.map((est) => (
                  <option key={est.codigo} value={est.codigo}>
                    {est.codigo}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-label text-xs">{fieldLabel('contenedor')}</label>
              <input
                className="input-field py-2 text-sm font-mono"
                placeholder="C01"
                value={values.contenedor}
                onChange={(e) => setters.setContenedor(e.target.value)}
              />
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="rounded-lg border border-border bg-surface-muted p-4 space-y-3">
        <h3 className="section-title text-base">Ubicación física</h3>
        <div>
          <label className="text-label">{fieldLabel('almacen', { required: true })}</label>
          <select
            className="input-field"
            value={values.almacen}
            onChange={ubicacionCascade.onAlmacenChange(setters)}
            required
          >
            {almacenes.map((a) => (
              <option key={a.codigo} value={a.codigo}>
                {a.codigo} — {a.nombre} ({a.tipo})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-label">{fieldLabel('armario', { required: true })}</label>
          {armarioSelect}
        </div>
        <div>
          <label className="text-label">{fieldLabel('estante', { required: true })}</label>
          <select
            className="input-field"
            value={values.estante}
            onChange={ubicacionCascade.onEstanteChange(setters)}
            required
          >
            {ESTANTES.map((est) => (
              <option key={est.codigo} value={est.codigo}>
                {est.codigo} — {est.nombre}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-subtle">E01–E09</p>
        </div>
        <div>
          <label className="text-label">{fieldLabel('contenedor')}</label>
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
  };

  return (
    <FocusedPage maxWidth="max-w-5xl">
      <h2 className="page-title mb-2">Editor de Stock</h2>
      <p className="mb-2 text-muted">
        Alta, edición, baja e importación masiva de ítems y cantidades. La estructura física (sedes,
        almacenes, armarios) se gestiona en <strong>Locaciones</strong>.
      </p>
      <p className="mb-4 rounded-lg border border-accent/40 bg-surface-muted px-3 py-2 text-sm text-content">
        Trabajando en sucursal:{' '}
        <strong className="text-accent">{sessionSedeNombre || sessionSede || '—'}</strong>
        . Los ítems nuevos se asocian a esta sucursal.
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          className={section === 'individual' ? 'btn-primary py-2 text-base' : 'btn-secondary py-2 text-base'}
          onClick={() => setSection('individual')}
        >
          Individual
        </button>
        <button
          type="button"
          className={section === 'masiva' ? 'btn-primary py-2 text-base' : 'btn-secondary py-2 text-base'}
          onClick={() => setSection('masiva')}
        >
          Carga masiva
        </button>
        <button
          type="button"
          className={section === 'catalogo' ? 'btn-primary py-2 text-base' : 'btn-secondary py-2 text-base'}
          onClick={() => setSection('catalogo')}
        >
          Catálogo Siemens/Sivacon
        </button>
      </div>

      {error && <div className="alert-error mb-4">{error}</div>}
      {success && <div className="alert-success mb-4">{success}</div>}

      {section === 'masiva' && <StockBulkImport onImported={handleImported} />}
      {section === 'catalogo' && (
        <CatalogEnrichImport
          items={items}
          onApplied={(data) => {
            setSuccess(`Catálogo aplicado: ${data.actualizados} ítems actualizados.`);
            load();
          }}
        />
      )}

      {section === 'individual' && (
        <>
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

          {tab === 'alta' && (
            <form onSubmit={modo === 'editar' ? submitEditar : submitAlta} className="card mx-auto max-w-xl space-y-4">
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
                    <label className="text-label">{fieldLabel('nombre')}</label>
                    <p className="mb-2 text-xs text-subtle">Escribí letras para acotar la lista.</p>
                    <FilterableSelect
                      options={itemOptions}
                      value={itemId}
                      onChange={setItemId}
                      placeholder="Buscar por nombre..."
                      emptyMessage="Ningún ítem coincide"
                      disabled={!itemOptions.length}
                    />
                  </div>
                  {ubicacionesItem.length > 1 && (
                    <div>
                      <label className="text-label">{fieldLabel('ubicacion')}</label>
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
                    <label className="text-label">{fieldLabel('nombre', { required: true })}</label>
                    <p className="mb-2 text-xs text-subtle">Escribí letras para acotar la lista.</p>
                    <FilterableSelect
                      options={editItemOptions}
                      value={editItemId}
                      onChange={setEditItemId}
                      placeholder="Buscar por nombre..."
                      emptyMessage="Ningún ítem coincide"
                      disabled={!editItemOptions.length}
                    />
                  </div>
                  {editUbicaciones.length > 1 && (
                    <div>
                      <label className="text-label">{fieldLabel('ubicacion')}</label>
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
                      {ubicacionFields(
                        {
                          almacen: editAlmacen,
                          armario: editArmario,
                          estante: editEstante,
                          contenedor: editContenedor,
                          preview: editCodigoPreview,
                        },
                        {
                          setAlmacen: setEditAlmacen,
                          setArmario: setEditArmario,
                          setEstante: setEditEstante,
                          setContenedor: setEditContenedor,
                        },
                        editArmariosCatalogo,
                        { compact: true }
                      )}
                      <div>
                        <label className="text-label">{fieldLabel('cantidad', { required: true })}</label>
                        <input
                          type="number"
                          min={0}
                          className="input-field"
                          value={editCantidad}
                          onChange={(e) => setEditCantidad(e.target.value)}
                          required
                        />
                        <p className="mt-1 text-xs text-subtle">
                          {editStockId
                            ? '0 elimina el stock en esa ubicación.'
                            : 'Sin stock aún (p. ej. alta por pedido masivo). Dejá 0 para guardar solo los datos, o poné cantidad para crear la ubicación.'}
                        </p>
                      </div>
                      <div className="border-t border-border pt-3 space-y-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-subtle">Datos del ítem</p>
                        <div>
                          <label className="text-label">{fieldLabel('nombre', { required: true })}</label>
                          <input
                            className="input-field"
                            value={editNombre}
                            onChange={(e) => setEditNombre(e.target.value)}
                            required
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-label text-xs text-subtle">{fieldLabel('marca')}</label>
                            <input
                              className="input-field py-2 text-sm"
                              value={editMarca}
                              onChange={(e) => setEditMarca(e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="text-label text-xs text-subtle">{fieldLabel('modelo')}</label>
                            <input
                              className="input-field py-2 text-sm"
                              value={editModelo}
                              onChange={(e) => setEditModelo(e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className="text-label text-xs text-subtle">{fieldLabel('tipo')}</label>
                            <select
                              className="input-field py-2 text-sm"
                              value={editTipo}
                              onChange={(e) => setEditTipo(e.target.value)}
                            >
                              {tipos.map((t) => (
                                <option key={t} value={t}>
                                  {t}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-label text-xs text-subtle">{fieldLabel('detalle')}</label>
                            <input
                              className="input-field py-2 text-sm"
                              value={editDetalle}
                              onChange={(e) => setEditDetalle(e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="border-t border-border pt-3 space-y-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-subtle">
                            Catálogo
                          </p>
                          <div>
                            <label className="text-label text-xs text-subtle">
                              {fieldLabel('codigoFabricante')}
                            </label>
                            <input
                              className="input-field py-2 font-mono text-sm"
                              value={editCodigoFab}
                              onChange={(e) => setEditCodigoFab(e.target.value)}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-label text-xs text-subtle">{fieldLabel('tema')}</label>
                              <input
                                className="input-field py-2 text-sm"
                                value={editTema}
                                onChange={(e) => setEditTema(e.target.value)}
                              />
                            </div>
                            <div>
                              <label className="text-label text-xs text-subtle">{fieldLabel('familia')}</label>
                              <input
                                className="input-field py-2 text-sm"
                                value={editFamilia}
                                onChange={(e) => setEditFamilia(e.target.value)}
                              />
                            </div>
                            <div className="col-span-2">
                              <label className="text-label text-xs text-subtle">{fieldLabel('subfamilia')}</label>
                              <input
                                className="input-field py-2 text-sm"
                                value={editSubfamilia}
                                onChange={(e) => setEditSubfamilia(e.target.value)}
                              />
                            </div>
                            <div>
                              <label className="text-label text-xs text-subtle">{fieldLabel('unidad')}</label>
                              <input
                                className="input-field py-2 text-sm"
                                value={editUnidad}
                                onChange={(e) => setEditUnidad(e.target.value)}
                              />
                            </div>
                            <div>
                              <label className="text-label text-xs text-subtle">{fieldLabel('packing')}</label>
                              <input
                                className="input-field py-2 text-sm"
                                value={editPacking}
                                onChange={(e) => setEditPacking(e.target.value)}
                              />
                            </div>
                            <div>
                              <label className="text-label text-xs text-subtle">{fieldLabel('precioLista')}</label>
                              <input
                                className="input-field py-2 text-sm"
                                value={editPrecioLista}
                                onChange={(e) => setEditPrecioLista(e.target.value)}
                              />
                            </div>
                            <div>
                              <label className="text-label text-xs text-subtle">{fieldLabel('moneda')}</label>
                              <input
                                className="input-field py-2 text-sm"
                                placeholder="EUR / USD"
                                value={editMoneda}
                                onChange={(e) => setEditMoneda(e.target.value)}
                              />
                            </div>
                            <div>
                              <label className="text-label text-xs text-subtle">{fieldLabel('pesoKg')}</label>
                              <input
                                className="input-field py-2 text-sm"
                                value={editPesoKg}
                                onChange={(e) => setEditPesoKg(e.target.value)}
                              />
                            </div>
                            <div>
                              <label className="text-label text-xs text-subtle">
                                {fieldLabel('catalogoVigencia')}
                              </label>
                              <input
                                className="input-field py-2 text-sm"
                                value={editCatalogoVigencia}
                                onChange={(e) => setEditCatalogoVigencia(e.target.value)}
                              />
                            </div>
                            <div className="col-span-2">
                              <label className="text-label text-xs text-subtle">
                                {fieldLabel('catalogoFuente')}
                              </label>
                              <input
                                className="input-field py-2 text-sm"
                                placeholder="sivacon_s8 / siemens_ar"
                                value={editCatalogoFuente}
                                onChange={(e) => setEditCatalogoFuente(e.target.value)}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <>
                  <div>
                    <label className="text-label">{fieldLabel('nombre', { required: true })}</label>
                    <input
                      className="input-field"
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      required
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="text-label">{fieldLabel('marca')}</label>
                      <input className="input-field" value={marca} onChange={(e) => setMarca(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-label">{fieldLabel('modelo')}</label>
                      <input className="input-field" value={modelo} onChange={(e) => setModelo(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <label className="text-label">{fieldLabel('tipo')}</label>
                    <select className="input-field" value={tipo} onChange={(e) => setTipo(e.target.value)}>
                      {tipos.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-label">{fieldLabel('detalle')}</label>
                    <input className="input-field" value={detalle} onChange={(e) => setDetalle(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-label">{fieldLabel('calibracion')}</label>
                    <input
                      className="input-field"
                      placeholder="No aplica / Sí - vigente..."
                      value={calibracion}
                      onChange={(e) => setCalibracion(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-label">{fieldLabel('comentario')}</label>
                    <input
                      className="input-field"
                      placeholder="Color, forma..."
                      value={comentario}
                      onChange={(e) => setComentario(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-label">{fieldLabel('fechaRelevamiento')}</label>
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
                  { almacen, armario, estante, contenedor, preview: codigoPreview },
                  { setAlmacen, setArmario, setEstante, setContenedor },
                  armariosCatalogo
                )}

              {modo !== 'editar' && (
                <div>
                  <label className="text-label">{fieldLabel('cantidad', { required: true })}</label>
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
                disabled={loading || (modo === 'existente' && !itemId) || (modo === 'editar' && !editItemId)}
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
            <form onSubmit={submitBaja} className="card mx-auto max-w-xl space-y-4">
              <p className="text-sm text-muted">
                La baja oculta el ítem del inventario. No se permite si hay egresos pendientes.
              </p>
              <div>
                <label className="text-label">{fieldLabel('nombre', { required: true })}</label>
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
        </>
      )}
    </FocusedPage>
  );
}
