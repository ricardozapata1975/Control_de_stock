import { useNavigate } from 'react-router-dom';
import { formatUbicacionLabel } from '../utils/contenedor';
import { QR_TYPES, qrTypeLabel } from '../utils/qrPayload';

function buildEgresoUrl(parsed, items) {
  const p = new URLSearchParams();
  if (parsed.type === QR_TYPES.ITEM && parsed.itemId) {
    p.set('itemId', parsed.itemId);
    if (items?.length === 1) p.set('stockId', items[0].id);
  } else if (parsed.codigo) {
    p.set('codigo', parsed.codigo);
  }
  return `/egreso?${p.toString()}`;
}

function buildIngresoUrl(parsed) {
  const p = new URLSearchParams();
  if (parsed.type === QR_TYPES.ITEM && parsed.itemId) p.set('itemId', parsed.itemId);
  else if (parsed.codigo) p.set('codigo', parsed.codigo);
  return `/ingreso?${p.toString()}`;
}

export default function ScanResultPanel({ parsed, contenedor, items = [], onScanAgain }) {
  const navigate = useNavigate();
  const isItem = parsed.type === QR_TYPES.ITEM;
  const title = isItem
    ? items[0]?.nombre || parsed.itemId
    : contenedor?.codigo || parsed.codigo;

  return (
    <div className="card mt-6 space-y-4 border-amber-700/50">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-sky-400">
          {qrTypeLabel(parsed.type)} escaneado
        </p>
        <h3 className="text-xl font-bold text-white">{title}</h3>
        {isItem && (
          <p className="font-mono text-sm text-amber-300">item_id: {parsed.itemId}</p>
        )}
        {contenedor && (
          <p className="text-muted">{formatUbicacionLabel(contenedor)}</p>
        )}
        {items.length > 0 && (
          <p className="mt-1 text-sm text-subtle">
            {items.length} ítem{items.length !== 1 ? 's' : ''} en esta ubicación
          </p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          className="btn-primary w-full"
          onClick={() => navigate(buildEgresoUrl(parsed, items))}
        >
          Registrar egreso
        </button>
        <button
          type="button"
          className="btn-secondary w-full border-amber-600 text-amber-100"
          onClick={() => navigate(buildIngresoUrl(parsed))}
        >
          Registrar ingreso
        </button>
      </div>

      {!isItem && parsed.codigo && (
        <button
          type="button"
          className="btn-secondary w-full text-base"
          onClick={() => navigate(`/contenedor/${encodeURIComponent(parsed.codigo)}`)}
        >
          Ver herramientas en ubicación
        </button>
      )}

      {isItem && items.length > 1 && (
        <ul className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-slate-600 p-2 text-sm">
          {items.map((i) => (
            <li key={i.id} className="flex justify-between text-slate-200">
              <span>{formatUbicacionLabel(i)}</span>
              <span className="text-amber-300">{i.cantidad} u.</span>
            </li>
          ))}
        </ul>
      )}

      <button type="button" className="text-sm text-slate-300 underline hover:text-white" onClick={onScanAgain}>
        Escanear otro código
      </button>
    </div>
  );
}
