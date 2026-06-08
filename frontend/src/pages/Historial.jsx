import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { formatFechaDmy } from '../utils/fecha';

export default function Historial() {
  const [movimientos, setMovimientos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [persona, setPersona] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (persona) params.persona = persona;
      if (desde) params.desde = desde;
      if (hasta) params.hasta = hasta;
      const data = await api.movimientos(params);
      setMovimientos(data.movimientos);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <h2 className="page-title mb-4">Historial de movimientos</h2>

      <div className="card mb-4 grid gap-3 sm:grid-cols-4">
        <input
          className="input-field"
          placeholder="Filtrar por persona..."
          value={persona}
          onChange={(e) => setPersona(e.target.value)}
        />
        <input type="date" className="input-field" value={desde} onChange={(e) => setDesde(e.target.value)} />
        <input type="date" className="input-field" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        <button type="button" className="btn-primary" onClick={load} disabled={loading}>
          Buscar
        </button>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="table-head">
            <tr>
              <th className="px-3 py-3">Herramienta</th>
              <th className="px-3 py-3">Persona</th>
              <th className="px-3 py-3">Cant.</th>
              <th className="px-3 py-3">Egreso</th>
              <th className="px-3 py-3">Ingreso</th>
              <th className="px-3 py-3">Estado</th>
            </tr>
          </thead>
          <tbody>
            {movimientos.map((m) => (
              <tr key={m.id} className="table-row">
                <td className="px-3 py-3 font-medium text-white">{m.nombreHerramienta}</td>
                <td className="px-3 py-3 text-slate-200">{m.nombrePersonal || m.usuario}</td>
                <td className="px-3 py-3">{m.cantidad}</td>
                <td className="px-3 py-3 table-cell-muted">{formatFechaDmy(m.fechaEgreso)}</td>
                <td className="px-3 py-3 table-cell-muted">{formatFechaDmy(m.fechaIngreso)}</td>
                <td className="px-3 py-3">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${
                      m.pendiente
                        ? 'bg-amber-800 text-amber-100'
                        : 'bg-emerald-800 text-emerald-100'
                    }`}
                  >
                    {m.pendiente ? 'Pendiente' : 'Completado'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!movimientos.length && !loading && (
          <p className="p-6 text-center text-muted">Sin movimientos</p>
        )}
      </div>
    </div>
  );
}
