import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../../api/client';
import { useAuth } from '../../../auth/AuthProvider';
import FilterableSelect from '../../../components/FilterableSelect';
import ProveedorAutocomplete from '../../../components/ProveedorAutocomplete';
import { fieldLabel } from '../../../utils/fieldLabels';
import { todayIsoDate } from '../../../utils/remitoStorage';

const UNIDADES = ['u.', 'kg', 'm', 'caja', 'par', 'set', 'rollo', 'litro'];

const emptyLinea = () => ({
  key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  itemId: '',
  codigo: '',
  descripcion: '',
  cantidad: 1,
  unidad: 'u.',
});

const IVA_OPTIONS = [
  '',
  'Responsable Inscripto',
  'Monotributo',
  'Exento',
  'Consumidor Final',
];

export default function RecepcionCargaPage() {
  const { sede, user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    proveedorId: null,
    proveedor: '',
    razonSocial: '',
    cuit: '',
    domicilio: '',
    localidad: '',
    iva: '',
    documento: '',
    fecha: todayIsoDate(),
    notas: '',
  });
  const [lineas, setLineas] = useState([emptyLinea()]);

  useEffect(() => {
    api
      .adminItems()
      .then((d) => setItems((d.items || []).filter((i) => i.activo !== false)))
      .catch(() =>
        api
          .inventario(sede ? { sede } : {})
          .then((d) => {
            const map = new Map();
            for (const row of d.inventario || d.items || []) {
              const id = row.itemId || row.id;
              if (!id || map.has(id)) continue;
              map.set(id, {
                id,
                nombre: row.nombre || row.nombreHerramienta || '',
                codigoFabricante: row.codigoFabricante || row.codigo || '',
                marca: row.marca,
                modelo: row.modelo,
                tipo: row.tipo,
              });
            }
            setItems([...map.values()]);
          })
          .catch((e) => setError(e.message))
      );
  }, [sede]);

  const itemOptions = useMemo(
    () =>
      items.map((i) => {
        const codigo = i.codigoFabricante || i.codigo || '';
        const nombre = i.nombre || '';
        return {
          value: i.id,
          label: codigo ? `${codigo} — ${nombre}` : nombre || i.id,
          searchText: `${codigo} ${nombre} ${i.marca || ''} ${i.modelo || ''} ${i.tipo || ''} ${i.id}`,
          codigo,
          nombre,
        };
      }),
    [items]
  );

  const setLinea = (key, patch) => {
    setLineas((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  const onPickItem = (key, itemId) => {
    const opt = itemOptions.find((o) => o.value === itemId);
    setLinea(key, {
      itemId,
      codigo: opt?.codigo || '',
      descripcion: opt?.nombre || '',
    });
  };

  const onSelectProveedor = (p) => {
    setForm((f) => ({
      ...f,
      proveedorId: p.id,
      proveedor: p.nombre || '',
      razonSocial: p.razonSocial || p.nombre || '',
      cuit: p.cuit || '',
      domicilio: p.domicilio || '',
      localidad: p.localidad || '',
      iva: p.iva || '',
    }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setMsg('');
    if (!form.documento.trim()) {
      setError('Indicá el nro. de remito (documento).');
      return;
    }
    if (!form.proveedor.trim()) {
      setError('Indicá el proveedor (buscar o cargar manual).');
      return;
    }
    const payloadLineas = lineas
      .filter((l) => l.itemId || l.codigo)
      .map((l) => ({
        itemId: l.itemId || null,
        codigo: (l.codigo || '').trim().toUpperCase(),
        cantidad: Number(l.cantidad) || 0,
        unidad: l.unidad || 'u.',
        descripcion: l.descripcion || '',
      }))
      .filter((l) => l.cantidad > 0);
    if (!payloadLineas.length) {
      setError('Agregá al menos una línea con ítem y cantidad.');
      return;
    }
    setSaving(true);
    try {
      const result = await api.crearRecepcionProyecto({
        tipo: 'remito',
        sede,
        operador: user?.name || user?.email,
        documento: form.documento.trim(),
        fecha: form.fecha,
        notas: form.notas,
        proveedorId: form.proveedorId || null,
        proveedor: form.proveedor.trim(),
        razonSocial: form.razonSocial || form.proveedor,
        cuit: form.cuit,
        domicilio: form.domicilio,
        localidad: form.localidad,
        iva: form.iva,
        proveedorCuit: form.cuit,
        proveedorDomicilio: form.domicilio,
        proveedorLocalidad: form.localidad,
        proveedorIva: form.iva,
        lineas: payloadLineas,
      });
      const id = result.recepcion?.id || result.id;
      setMsg('Remito cargado. Quedó pendiente de ingreso físico.');
      if (id) {
        navigate(`/proyectos/recepciones/ingreso/${id}`);
      } else {
        navigate('/proyectos/recepciones/ingreso');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="section-title">Carga de remito</h2>
          <p className="text-sm text-muted">
            Paso 1 · Registro documental. No mueve stock; deja el remito pendiente de ingreso.
          </p>
        </div>
        <Link to="/proyectos/recepciones" className="btn-secondary text-sm">
          Volver al hub
        </Link>
      </div>

      {error && <div className="alert-error">{error}</div>}
      {msg && <p className="text-sm text-emerald-700 dark:text-emerald-300">{msg}</p>}

      <form className="card space-y-4" onSubmit={submit}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="text-label">{fieldLabel('proveedor')}</label>
            <ProveedorAutocomplete
              value={form.proveedor}
              onChange={({ proveedor, proveedorId }) =>
                setForm((f) => ({ ...f, proveedor, proveedorId }))
              }
              onSelect={onSelectProveedor}
            />
            <p className="mt-1 text-xs text-muted">
              Si no está en la lista, completá los datos manualmente: al grabar se crea en agenda.
            </p>
          </div>
          <div>
            <label className="text-label">{fieldLabel('razonSocial')}</label>
            <input
              className="input-field"
              value={form.razonSocial}
              onChange={(e) => setForm({ ...form, razonSocial: e.target.value })}
            />
          </div>
          <div>
            <label className="text-label">{fieldLabel('cuit')}</label>
            <input
              className="input-field"
              value={form.cuit}
              onChange={(e) => setForm({ ...form, cuit: e.target.value })}
            />
          </div>
          <div>
            <label className="text-label">{fieldLabel('domicilio')}</label>
            <input
              className="input-field"
              value={form.domicilio}
              onChange={(e) => setForm({ ...form, domicilio: e.target.value })}
            />
          </div>
          <div>
            <label className="text-label">{fieldLabel('localidad')}</label>
            <input
              className="input-field"
              value={form.localidad}
              onChange={(e) => setForm({ ...form, localidad: e.target.value })}
            />
          </div>
          <div>
            <label className="text-label">{fieldLabel('iva')}</label>
            <select
              className="input-field"
              value={form.iva}
              onChange={(e) => setForm({ ...form, iva: e.target.value })}
            >
              {IVA_OPTIONS.map((o) => (
                <option key={o || 'empty'} value={o}>
                  {o || '—'}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-label">{fieldLabel('documento')} (nro. remito)</label>
            <input
              className="input-field"
              required
              value={form.documento}
              onChange={(e) => setForm({ ...form, documento: e.target.value })}
            />
          </div>
          <div>
            <label className="text-label">{fieldLabel('fecha')}</label>
            <input
              type="date"
              className="input-field"
              value={form.fecha}
              onChange={(e) => setForm({ ...form, fecha: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-label">{fieldLabel('notas')}</label>
            <input
              className="input-field"
              value={form.notas}
              onChange={(e) => setForm({ ...form, notas: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold text-content">Líneas</h3>
            <button
              type="button"
              className="btn-secondary text-sm"
              onClick={() => setLineas((prev) => [...prev, emptyLinea()])}
            >
              Agregar línea
            </button>
          </div>

          {lineas.map((l, idx) => (
            <div
              key={l.key}
              className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-12"
            >
              <div className="sm:col-span-5">
                <label className="text-label">Ítem</label>
                <FilterableSelect
                  options={itemOptions}
                  value={l.itemId}
                  onChange={(v) => onPickItem(l.key, v)}
                  placeholder="Código — nombre…"
                  emptyMessage="Sin coincidencias"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-label">{fieldLabel('cantidad')}</label>
                <input
                  type="number"
                  min="0.01"
                  step="any"
                  className="input-field"
                  value={l.cantidad}
                  onChange={(e) => setLinea(l.key, { cantidad: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-label">{fieldLabel('unidad')}</label>
                <select
                  className="input-field"
                  value={l.unidad}
                  onChange={(e) => setLinea(l.key, { unidad: e.target.value })}
                >
                  {UNIDADES.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end sm:col-span-3">
                <button
                  type="button"
                  className="btn-secondary w-full text-sm"
                  disabled={lineas.length <= 1}
                  onClick={() => setLineas((prev) => prev.filter((x) => x.key !== l.key))}
                >
                  Quitar {idx + 1}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Guardando…' : 'Grabar remito'}
          </button>
          <Link to="/proyectos/recepciones" className="btn-secondary">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
