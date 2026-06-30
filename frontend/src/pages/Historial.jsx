import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { formatFechaDmy } from '../utils/fecha';

const ESTADO_CONFIG = {
  completado: {
    label: 'Completado',
    className: 'bg-emerald-800 text-emerald-100',
    clickable: false,
  },
  pendiente_devolucion: {
    label: 'Pendiente devolución',
    className: 'bg-amber-800 text-amber-100',
    clickable: false,
  },
  consumido: {
    label: 'Consumido',
    className: 'bg-slate-700 text-slate-100',
    clickable: false,
  },
  vendido: {
    label: 'Vendido',
    className: 'bg-violet-800 text-violet-100 cursor-pointer hover:bg-violet-700',
    clickable: true,
  },
};

function EstadoBadge({ movimiento, onVendidoClick }) {
  const cfg = ESTADO_CONFIG[movimiento.estadoHistorial] || ESTADO_CONFIG.pendiente_devolucion;

  if (cfg.clickable && movimiento.remitoId) {
    return (
      <button
        type="button"
        className={`rounded-full px-2 py-1 text-xs font-semibold ${cfg.className}`}
        onClick={() => onVendidoClick(movimiento.remitoId)}
      >
        {cfg.label}
      </button>
    );
  }

  return (
    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

function RemitoDetalleModal({ remitoId, onClose }) {
  const [remito, setRemito] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!remitoId) return;
    setLoading(true);
    setError('');
    api
      .getRemito(remitoId)
      .then((data) => setRemito(data.remito))
      .catch((err) => setError(err.message || 'No se pudo cargar el remito'))
      .finally(() => setLoading(false));
  }, [remitoId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="card max-h-[85vh] w-full max-w-lg overflow-y-auto">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="section-title">Detalle del remito</h3>
          <button type="button" className="btn-secondary text-sm" onClick={onClose}>
            Cerrar
          </button>
        </div>

        {loading && <p className="text-muted">Cargando...</p>}
        {error && <p className="text-red-600 dark:text-red-400">{error}</p>}

        {remito && !loading && (
          <div className="space-y-3 text-sm">
            <div className="grid gap-1 sm:grid-cols-2">
              <p>
                <span className="font-semibold text-content">N° remito:</span>{' '}
                {remito.numero}
              </p>
              <p>
                <span className="font-semibold text-content">Fecha:</span>{' '}
                {formatFechaDmy(remito.fecha)}
              </p>
            </div>

            {remito.cliente && (
              <div className="rounded-lg border border-border p-3">
                <p className="font-semibold text-content">Cliente</p>
                <p>{remito.cliente.nombre}</p>
                {remito.cliente.cuit && <p className="text-muted">CUIT: {remito.cliente.cuit}</p>}
                {remito.cliente.domicilio && <p className="text-muted">{remito.cliente.domicilio}</p>}
                {remito.cliente.localidad && <p className="text-muted">{remito.cliente.localidad}</p>}
              </div>
            )}

            {remito.empresa && (
              <p className="text-muted">
                Emisor: {remito.empresa.nombre}
              </p>
            )}

            <div>
              <p className="mb-2 font-semibold text-content">Ítems</p>
              <ul className="divide-y divide-border rounded-lg border border-border">
                {(remito.items || []).map((item) => (
                  <li key={item.id || `${item.itemId}-${item.cantidad}`} className="flex justify-between px-3 py-2">
                    <span>{item.descripcion || item.nombre || 'Ítem'}</span>
                    <span className="font-semibold">× {item.cantidad}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Historial() {
  const [movimientos, setMovimientos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [persona, setPersona] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [remitoModalId, setRemitoModalId] = useState(null);

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
                <td className="px-3 py-3 font-medium text-content">{m.nombreHerramienta}</td>
                <td className="px-3 py-3 text-content-muted">{m.nombrePersonal || m.usuario}</td>
                <td className="px-3 py-3">{m.cantidad}</td>
                <td className="px-3 py-3 table-cell-muted">{formatFechaDmy(m.fechaEgreso)}</td>
                <td className="px-3 py-3 table-cell-muted">{formatFechaDmy(m.fechaIngreso)}</td>
                <td className="px-3 py-3">
                  <EstadoBadge movimiento={m} onVendidoClick={setRemitoModalId} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!movimientos.length && !loading && (
          <p className="p-6 text-center text-muted">Sin movimientos</p>
        )}
      </div>

      {remitoModalId && (
        <RemitoDetalleModal remitoId={remitoModalId} onClose={() => setRemitoModalId(null)} />
      )}
    </div>
  );
}
