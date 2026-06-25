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
    });
  }, [item]);

  if (!item) return null;

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const opciones = [...tipos];
  if (form.tipo && !opciones.includes(form.tipo)) opciones.push(form.tipo);

  const submit = (e) => {
    e.preventDefault();
    onSave(form);
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
            <label className="text-label">Fecha relevamiento</label>
            <input
              type="date"
              className="input-field"
              value={form.fechaRelevamiento}
              onChange={set('fechaRelevamiento')}
            />
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
