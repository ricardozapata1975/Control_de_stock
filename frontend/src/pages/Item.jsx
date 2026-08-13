import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { formatUbicacionLabel } from '../utils/contenedor';
import ScanResultPanel from '../components/ScanResultPanel';
import { QR_TYPES } from '../utils/qrPayload';
import { fieldLabel } from '../utils/fieldLabels';

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
        <p className="font-mono text-sm text-accent">item_id: {itemId}</p>
        {item.codigoFabricante && (
          <p className="font-mono text-sm text-muted">
            {fieldLabel('codigoFabricante')}: {item.codigoFabricante}
          </p>
        )}
        {item.tipo && <p className="text-muted mt-1">{item.tipo}</p>}
        <p className="mt-2 text-lg font-bold text-content">
          {fieldLabel('cantidad')}: {total}
        </p>
        {(item.familia || item.subfamilia || item.tema || item.precioLista != null) && (
          <div className="mt-3 rounded-lg border border-edge bg-surface-2 p-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Catálogo</p>
            {[item.tema, item.familia, item.subfamilia].filter(Boolean).length > 0 && (
              <p className="mt-1">
                {[item.tema, item.familia, item.subfamilia].filter(Boolean).join(' · ')}
              </p>
            )}
            {item.precioLista != null && (
              <p className="mt-1">
                {fieldLabel('precioLista')}: {item.precioLista} {item.moneda || ''}
                {item.catalogoVigencia ? ` · ${fieldLabel('catalogoVigencia')} ${item.catalogoVigencia}` : ''}
              </p>
            )}
            {(item.unidad || item.packing || item.pesoKg != null) && (
              <p className="mt-1 text-muted">
                {[
                  item.unidad && `${fieldLabel('unidad')} ${item.unidad}`,
                  item.packing && `${fieldLabel('packing')} ${item.packing}`,
                  item.pesoKg != null && `${item.pesoKg} kg`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            )}
            {item.catalogoFuente && (
              <p className="mt-1 text-xs text-muted">
                {fieldLabel('catalogoFuente')}: {item.catalogoFuente}
              </p>
            )}
          </div>
        )}
      </div>

      <ScanResultPanel parsed={parsed} items={rows} onScanAgain={() => navigate('/escanear')} />

      <div className="card mt-4">
        <h3 className="section-title mb-3">{fieldLabel('ubicaciones')}</h3>
        <ul className="space-y-2">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex cursor-pointer items-center justify-between rounded-lg border border-border p-3 hover:bg-surface-hover"
              onClick={() => navigate(`/contenedor/${encodeURIComponent(r.contenedorCodigo)}`)}
            >
              <span className="text-content">{formatUbicacionLabel(r)}</span>
              <span className="font-bold text-accent">{r.cantidad} u.</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
