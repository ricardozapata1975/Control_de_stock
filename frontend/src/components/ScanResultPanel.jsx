import { useNavigate } from 'react-router-dom';
import { QR_TYPES, qrTypeLabel } from '../utils/qrPayload';
import {
  buildInventarioScanUrl,
  getUbicacionScanLabel,
} from '../utils/scanMatch';
import ScanLocationList from './ScanLocationList';

function buildEgresoUrl(parsed, items) {
  const p = new URLSearchParams();
  if (parsed.type === QR_TYPES.ITEM && parsed.itemId) {
    p.set('itemId', parsed.itemId);
    if (items?.length === 1) p.set('stockId', items[0].id);
  } else if (parsed.codigo) {
    p.set('codigo', parsed.codigo);
    if (parsed.type) p.set('tipoUbicacion', parsed.type);
  }
  return `/egreso?${p.toString()}`;
}

function buildIngresoUrl(parsed) {
  const p = new URLSearchParams();
  if (parsed.type === QR_TYPES.ITEM && parsed.itemId) p.set('itemId', parsed.itemId);
  else if (parsed.codigo) {
    p.set('codigo', parsed.codigo);
    if (parsed.type) p.set('tipoUbicacion', parsed.type);
  }
  return `/ingreso?${p.toString()}`;
}

export default function ScanResultPanel({ parsed, contenedor, items = [], onScanAgain }) {
  const navigate = useNavigate();
  const isItem = parsed.type === QR_TYPES.ITEM;
  const isUbicacion =
    parsed.type === QR_TYPES.ARMARIO ||
    parsed.type === QR_TYPES.ESTANTE ||
    parsed.type === QR_TYPES.CONTENEDOR;

  const title = isItem
    ? items[0]?.nombre || parsed.itemId
    : parsed.codigo || contenedor?.codigo;

  const ubicacionLabel = isUbicacion ? getUbicacionScanLabel(parsed, contenedor) : null;

  return (
    <div className="card mt-6 space-y-4 border-amber-700/50">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-sky-400">
          {qrTypeLabel(parsed.type)} escaneado
        </p>
        <h3 className="font-mono text-xl font-bold text-amber-300">{title}</h3>
        {ubicacionLabel && <p className="mt-1 text-muted">{ubicacionLabel}</p>}
        {isItem && (
          <p className="font-mono text-sm text-subtle">item_id: {parsed.itemId}</p>
        )}
        {isUbicacion && (
          <p className="mt-2 text-sm text-slate-200">
            {items.length} herramienta{items.length !== 1 ? 's' : ''} en esta ubicación
          </p>
        )}
      </div>

      {isUbicacion && <ScanLocationList parsed={parsed} items={items} />}

      {isItem && items.length > 0 && (
        <ScanLocationList parsed={parsed} items={items} />
      )}

      {isUbicacion && items.length > 0 && (
        <button
          type="button"
          className="btn-secondary w-full border-sky-700 text-sky-100"
          onClick={() => navigate(buildInventarioScanUrl(parsed))}
        >
          Ver inventario filtrado
        </button>
      )}

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

      <button type="button" className="text-sm text-slate-300 underline hover:text-white" onClick={onScanAgain}>
        Escanear otro código
      </button>
    </div>
  );
}
