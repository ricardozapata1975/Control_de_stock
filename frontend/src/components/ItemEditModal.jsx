import { useEffect, useState } from 'react';

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
          <h3 className="section-title">Editar herramienta</h3>
          <button type="button" onClick={onClose} className="text-2xl text-slate-200 hover:text-white">
            ×
          </button>
        </div>
        <p className="mb-4 font-mono text-sm text-amber-300">{item.contenedorCodigo}</p>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-label">Nombre *</label>
            <input className="input-field" value={form.nombre} onChange={set('nombre')} required />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-label">Marca</label>
              <input className="input-field" value={form.marca} onChange={set('marca')} />
            </div>
            <div>
              <label className="text-label">Modelo</label>
              <input className="input-field" value={form.modelo} onChange={set('modelo')} />
            </div>
          </div>
          <div>
            <label className="text-label">Tipo</label>
            <select className="input-field" value={form.tipo} onChange={set('tipo')}>
              <option value="">—</option>
              {opciones.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-label">Detalle</label>
            <input className="input-field" value={form.detalle} onChange={set('detalle')} />
          </div>
          <div>
            <label className="text-label">Calibración</label>
            <input
              className="input-field"
              placeholder="Ej: No aplica / Sí - vence 2026-05 / Pendiente"
              value={form.calibracion}
              onChange={set('calibracion')}
            />
          </div>
          <div>
            <label className="text-label">Comentario</label>
            <input
              className="input-field"
              placeholder="Color, forma u otro dato distintivo"
              value={form.comentario}
              onChange={set('comentario')}
            />
          </div>
          <div>
            <label className="text-label">Código barras / QR (fabricante)</label>
            <input
              className="input-field font-mono"
              placeholder="Código original del fabricante"
              value={form.codigoFabricante}
              onChange={set('codigoFabricante')}
              autoComplete="off"
              spellCheck={false}
            />
            <p className="mt-1 text-xs text-subtle">
              Podés editarlo o borrarlo. También se carga con la cámara desde el detalle del ítem.
            </p>
          </div>
          <div>
            <label className="text-label">Fecha relevamiento</label>
            <input
              type="date"
              className="input-field"
              value={form.fechaRelevamiento}
              onChange={set('fechaRelevamiento')}
            />
          </div>

          <div className="border-t border-border pt-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-subtle">
              Catálogo (Siemens / Sivacon)
            </p>
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-label">Tema</label>
                  <input className="input-field" value={form.tema} onChange={set('tema')} />
                </div>
                <div>
                  <label className="text-label">Familia</label>
                  <input className="input-field" value={form.familia} onChange={set('familia')} />
                </div>
              </div>
              <div>
                <label className="text-label">Subfamilia</label>
                <input className="input-field" value={form.subfamilia} onChange={set('subfamilia')} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-label">Unidad</label>
                  <input className="input-field" value={form.unidad} onChange={set('unidad')} />
                </div>
                <div>
                  <label className="text-label">Packing / MOQ</label>
                  <input className="input-field" value={form.packing} onChange={set('packing')} />
                </div>
                <div>
                  <label className="text-label">Precio lista</label>
                  <input className="input-field" value={form.precioLista} onChange={set('precioLista')} />
                </div>
                <div>
                  <label className="text-label">Moneda</label>
                  <input
                    className="input-field"
                    placeholder="EUR / USD"
                    value={form.moneda}
                    onChange={set('moneda')}
                  />
                </div>
                <div>
                  <label className="text-label">Peso (kg)</label>
                  <input className="input-field" value={form.pesoKg} onChange={set('pesoKg')} />
                </div>
                <div>
                  <label className="text-label">Vigencia</label>
                  <input
                    className="input-field"
                    value={form.catalogoVigencia}
                    onChange={set('catalogoVigencia')}
                  />
                </div>
              </div>
              <div>
                <label className="text-label">Fuente catálogo</label>
                <input
                  className="input-field"
                  placeholder="sivacon_s8 / siemens_ar"
                  value={form.catalogoFuente}
                  onChange={set('catalogoFuente')}
                />
              </div>
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
