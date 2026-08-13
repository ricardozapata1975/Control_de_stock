import { useEffect, useState } from 'react';
import { fieldLabel } from '../utils/fieldLabels';

function Field({ field, required, children, hint }) {
  return (
    <div>
      <label className="text-label">{fieldLabel(field, { required })}</label>
      {children}
      {hint ? <p className="mt-1 text-xs text-subtle">{hint}</p> : null}
    </div>
  );
}

export default function ItemEditModal({ item, tipos = [], onClose, onSave, saving }) {
  const [form, setForm] = useState({
    nombre: '',
    marca: '',
    modelo: '',
    tipo: '',
    detalle: '',
    calibracion: '',
    comentario: '',
    fechaRelevamiento: '',
    codigoFabricante: '',
    unidad: '',
    packing: '',
    precioLista: '',
    moneda: '',
    pesoKg: '',
    familia: '',
    subfamilia: '',
    tema: '',
    catalogoFuente: '',
    catalogoVigencia: '',
  });

  useEffect(() => {
    if (!item) return;
    setForm({
      nombre: item.nombre || '',
      marca: item.marca || '',
      modelo: item.modelo || '',
      tipo: item.tipo || '',
      detalle: item.detalle || '',
      calibracion: item.calibracion || '',
      comentario: item.comentario || '',
      fechaRelevamiento: item.fechaRelevamiento || '',
      codigoFabricante: item.codigoFabricante || '',
      unidad: item.unidad || '',
      packing: item.packing || '',
      precioLista: item.precioLista != null ? String(item.precioLista) : '',
      moneda: item.moneda || '',
      pesoKg: item.pesoKg != null ? String(item.pesoKg) : '',
      familia: item.familia || '',
      subfamilia: item.subfamilia || '',
      tema: item.tema || '',
      catalogoFuente: item.catalogoFuente || '',
      catalogoVigencia: item.catalogoVigencia || '',
    });
  }, [item]);

  if (!item) return null;

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const opciones = [...tipos];
  if (form.tipo && !opciones.includes(form.tipo)) opciones.push(form.tipo);

  const submit = (e) => {
    e.preventDefault();
    onSave({
      ...form,
      precioLista: form.precioLista === '' ? null : form.precioLista,
      pesoKg: form.pesoKg === '' ? null : form.pesoKg,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <div className="card max-h-[90vh] w-full max-w-lg overflow-y-auto">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="section-title">Editar</h3>
          <button type="button" onClick={onClose} className="text-2xl text-slate-200 hover:text-white">
            ×
          </button>
        </div>
        <p className="mb-4 font-mono text-sm text-amber-300">{item.contenedorCodigo}</p>

        <form onSubmit={submit} className="space-y-3">
          <Field field="nombre" required>
            <input className="input-field" value={form.nombre} onChange={set('nombre')} required />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field field="marca">
              <input className="input-field" value={form.marca} onChange={set('marca')} />
            </Field>
            <Field field="modelo">
              <input className="input-field" value={form.modelo} onChange={set('modelo')} />
            </Field>
          </div>
          <Field field="tipo">
            <select className="input-field" value={form.tipo} onChange={set('tipo')}>
              <option value="">—</option>
              {opciones.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field field="detalle">
            <input className="input-field" value={form.detalle} onChange={set('detalle')} />
          </Field>
          <Field field="calibracion">
            <input
              className="input-field"
              placeholder="Ej: No aplica / Si - vence 2026-05 / Pendiente"
              value={form.calibracion}
              onChange={set('calibracion')}
            />
          </Field>
          <Field field="comentario">
            <input
              className="input-field"
              placeholder="Color, forma u otro dato distintivo"
              value={form.comentario}
              onChange={set('comentario')}
            />
          </Field>
          <Field
            field="codigoFabricante"
            hint="Podés editarlo o borrarlo. También se carga con la cámara desde el detalle."
          >
            <input
              className="input-field font-mono"
              placeholder="Código original del fabricante"
              value={form.codigoFabricante}
              onChange={set('codigoFabricante')}
              autoComplete="off"
              spellCheck={false}
            />
          </Field>
          <Field field="fechaRelevamiento">
            <input
              type="date"
              className="input-field"
              value={form.fechaRelevamiento}
              onChange={set('fechaRelevamiento')}
            />
          </Field>

          <div className="border-t border-border pt-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-subtle">Catálogo</p>
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field field="tema">
                  <input className="input-field" value={form.tema} onChange={set('tema')} />
                </Field>
                <Field field="familia">
                  <input className="input-field" value={form.familia} onChange={set('familia')} />
                </Field>
              </div>
              <Field field="subfamilia">
                <input className="input-field" value={form.subfamilia} onChange={set('subfamilia')} />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field field="unidad">
                  <input className="input-field" value={form.unidad} onChange={set('unidad')} />
                </Field>
                <Field field="packing">
                  <input className="input-field" value={form.packing} onChange={set('packing')} />
                </Field>
                <Field field="precioLista">
                  <input className="input-field" value={form.precioLista} onChange={set('precioLista')} />
                </Field>
                <Field field="moneda">
                  <input
                    className="input-field"
                    placeholder="EUR / USD"
                    value={form.moneda}
                    onChange={set('moneda')}
                  />
                </Field>
                <Field field="pesoKg">
                  <input className="input-field" value={form.pesoKg} onChange={set('pesoKg')} />
                </Field>
                <Field field="catalogoVigencia">
                  <input
                    className="input-field"
                    value={form.catalogoVigencia}
                    onChange={set('catalogoVigencia')}
                  />
                </Field>
              </div>
              <Field field="catalogoFuente">
                <input
                  className="input-field"
                  placeholder="sivacon_s8 / siemens_ar"
                  value={form.catalogoFuente}
                  onChange={set('catalogoFuente')}
                />
              </Field>
            </div>
          </div>

          <button type="submit" className="btn-primary w-full" disabled={saving}>
            {saving ? 'GUARDANDO...' : 'GUARDAR'}
          </button>
          <button type="button" className="btn-secondary w-full" onClick={onClose}>
            Cancelar
          </button>
        </form>
      </div>
    </div>
  );
}
