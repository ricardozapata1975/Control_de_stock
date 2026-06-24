import { useEffect, useState } from 'react';
import FocusedPage from '../components/FocusedPage';
import { api, getDocsUrl } from '../api/client';

export default function AdminDatabase() {
  const [tables, setTables] = useState([]);
  const [table, setTable] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editRow, setEditRow] = useState(null);
  const [form, setForm] = useState({});

  const dbEditorUrl = getDocsUrl('/admin/db');

  useEffect(() => {
    api
      .adminDbSchema()
      .then((d) => {
        setTables(d.tables || []);
        if (d.tables?.length) setTable(d.tables[0].name);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!table) return;
    setLoading(true);
    api
      .adminDbTable(table)
      .then((d) => setRows(d.rows || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [table]);

  const cols =
    table === 'catalogo'
      ? [
          'almacenes',
          'nextAlmacenNum',
          'estanteMin',
          'estanteMax',
          'contenedorReglas',
          'contenedorEspecial',
        ]
      : rows[0]
        ? Object.keys(rows[0])
        : [];

  const openEdit = (row) => {
    setEditRow(row?.id ?? 'new');
    const base = row || {};
    const next = {};
    cols.forEach((c) => {
      const v = base[c];
      next[c] = typeof v === 'object' ? JSON.stringify(v, null, 2) : (v ?? '');
    });
    setForm(next);
  };

  const save = async () => {
    const payload = { ...form };
    if (payload.almacenes && typeof payload.almacenes === 'string') {
      try {
        payload.almacenes = JSON.parse(payload.almacenes);
      } catch {
        /* keep */
      }
    }
    ['estanteMin', 'estanteMax', 'nextAlmacenNum'].forEach((k) => {
      if (payload[k] !== undefined && payload[k] !== '') payload[k] = Number(payload[k]);
    });
    try {
      if (table === 'catalogo') {
        await api.adminDbUpdate(table, 'config', payload);
      } else if (editRow && editRow !== 'new') {
        await api.adminDbUpdate(table, editRow, payload);
      } else {
        await api.adminDbCreate(table, payload);
      }
      setEditRow(null);
      const d = await api.adminDbTable(table);
      setRows(d.rows || []);
    } catch (e) {
      setError(e.message);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('¿Eliminar registro?')) return;
    try {
      await api.adminDbDelete(table, id);
      const d = await api.adminDbTable(table);
      setRows(d.rows || []);
    } catch (e) {
      setError(e.message);
    }
  };

  const meta = tables.find((t) => t.name === table);
  const readOnly = meta?.readOnly;

  return (
    <FocusedPage maxWidth="max-w-5xl" align="start">
      <div className="space-y-4">
      <h2 className="page-title">Base de datos</h2>
      <p className="text-muted text-sm">
        Editá catálogo (almacenes con armarios anidados), contenedores, ítems y stock. También podés usar el editor
        completo en el backend:{' '}
        <a href={dbEditorUrl} className="text-amber-400 underline" target="_blank" rel="noreferrer">
          {dbEditorUrl}
        </a>
        {' · '}
        <a href={getDocsUrl()} className="text-amber-400 underline" target="_blank" rel="noreferrer">
          Docs
        </a>
      </p>

      {error && <div className="alert-error">{error}</div>}

      <div className="card flex flex-wrap gap-3">
        <div className="min-w-[200px] flex-1">
          <label className="text-label">Tabla</label>
          <select className="input-field" value={table} onChange={(e) => setTable(e.target.value)}>
            {tables.map((t) => (
              <option key={t.name} value={t.name}>
                {t.label || t.name}
              </option>
            ))}
          </select>
        </div>
        {!readOnly && (
          <button type="button" className="btn-primary self-end" onClick={() => openEdit(null)}>
            Nueva fila
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-muted">Cargando…</p>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="table-head">
              <tr>
                {cols.map((c) => (
                  <th key={c} className="px-3 py-2">
                    {c}
                  </th>
                ))}
                {!readOnly && <th className="px-3 py-2">Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.id || i} className="table-row">
                  {cols.map((c) => (
                    <td key={c} className="max-w-[200px] truncate px-3 py-2 table-cell-muted">
                      {typeof row[c] === 'object' ? JSON.stringify(row[c]) : String(row[c] ?? '')}
                    </td>
                  ))}
                  {!readOnly && (
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="rounded border border-slate-500 px-2 py-1 text-xs"
                          onClick={() => openEdit(row)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="rounded border border-red-700 px-2 py-1 text-xs text-red-200"
                          onClick={() => remove(row.id)}
                        >
                          Borrar
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editRow !== null && (
        <div className="card space-y-3">
          <h3 className="section-title">{editRow === 'new' ? 'Nueva fila' : 'Editar fila'}</h3>
          {cols.map((c) => (
            <div key={c}>
              <label className="text-label">{c}</label>
              {String(form[c] || '').includes('\n') || c === 'almacenes' || c === 'contenedorReglas' ? (
                <textarea
                  className="input-field font-mono text-sm"
                  rows={4}
                  value={form[c] ?? ''}
                  onChange={(e) => setForm({ ...form, [c]: e.target.value })}
                />
              ) : (
                <input
                  className="input-field"
                  value={form[c] ?? ''}
                  onChange={(e) => setForm({ ...form, [c]: e.target.value })}
                />
              )}
            </div>
          ))}
          <div className="flex gap-2">
            <button type="button" className="btn-primary" onClick={save}>
              Guardar
            </button>
            <button type="button" className="btn-secondary" onClick={() => setEditRow(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
      </div>
    </FocusedPage>
  );
}
