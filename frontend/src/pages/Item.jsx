import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { formatUbicacionLabel } from '../utils/contenedor';
import ScanResultPanel from '../components/ScanResultPanel';
import { QR_TYPES } from '../utils/qrPayload';

export default function Item() {
  const { itemId } = useParams();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.inventario();
      const match = (data.items || []).filter((i) => i.itemId === itemId);
      if (!match.length) throw new Error('Artículo no encontrado en inventario');
      setRows(match);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <p className="text-muted">Cargando...</p>;
  if (error) {
    return (
      <div className="card text-center">
        <p className="text-red-200">{error}</p>
        <button type="button" className="btn-primary mt-4" onClick={() => navigate('/escanear')}>
          Escanear otro
        </button>
      </div>
    );
  }

  const item = rows[0];
  const total = rows.reduce((s, r) => s + r.cantidad, 0);
  const parsed = { type: QR_TYPES.ITEM, itemId };

  return (
    <div>
      <button type="button" className="btn-secondary mb-4 text-base" onClick={() => navigate('/escanear')}>
        ← Escanear otro
      </button>
      <div className="card mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-sky-400">Artículo</p>
        <h2 className="page-title mb-1">{item.nombre}</h2>
        <p className="font-mono text-sm text-amber-300">item_id: {itemId}</p>
        {item.tipo && <p className="text-muted mt-1">{item.tipo}</p>}
        <p className="mt-2 text-lg font-bold text-slate-100">Stock total: {total}</p>
      </div>

      <ScanResultPanel parsed={parsed} items={rows} onScanAgain={() => navigate('/escanear')} />

      <div className="card mt-4">
        <h3 className="section-title mb-3">Ubicaciones</h3>
        <ul className="space-y-2">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-600 p-3 hover:bg-slate-800"
              onClick={() => navigate(`/contenedor/${encodeURIComponent(r.contenedorCodigo)}`)}
            >
              <span className="text-slate-100">{formatUbicacionLabel(r)}</span>
              <span className="font-bold text-amber-300">{r.cantidad} u.</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
