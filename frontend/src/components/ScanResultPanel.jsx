import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QR_TYPES, qrTypeLabel } from '../utils/qrPayload';
import {
  buildInventarioScanUrl,
  getUbicacionScanLabel,
} from '../utils/scanMatch';
import ScanItemActionModal from './ScanItemActionModal';
import ScanLocationList from './ScanLocationList';

function buildEgresoUrl(parsed, items) {
  const p = new URLSearchParams();
  if (parsed.type === QR_TYPES.ITEM && parsed.itemId) {
    p.set('itemId', parsed.itemId);
    if (items?.length === 1) p.set('stockId', items[0].id);
    return `/egreso?${p.toString()}`;
  }
  return '/egreso';
}

function buildIngresoUrl(parsed) {
  const p = new URLSearchParams();
  if (parsed.type === QR_TYPES.ITEM && parsed.itemId) {
    p.set('itemId', parsed.itemId);
    return `/ingreso?${p.toString()}`;
  }
  return '/ingreso';
}

function buildEgresoUrlForItem(item) {
  const p = new URLSearchParams({ stockId: item.id });
  return `/egreso?${p.toString()}`;
}

function buildIngresoUrlForItem(item) {
  const p = new URLSearchParams({
    itemId: item.itemId,
    contenedorId: item.contenedorId,
  });
  return `/ingreso?${p.toString()}`;
}

export default function ScanResultPanel({ parsed, contenedor, items = [], onScanAgain }) {
  const navigate = useNavigate();
  const [selectedItem, setSelectedItem] = useState(null);

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

      {isUbicacion && (
        <ScanLocationList
          parsed={parsed}
          items={items}
          selectable
          onSelectItem={setSelectedItem}
        />
      )}

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

      {isUbicacion && (
        <p className="text-center text-xs text-subtle">
          Sin elegir herramienta, egreso e ingreso abren el formulario vacío.
        </p>
      )}

      <button type="button" className="text-sm text-slate-300 underline hover:text-white" onClick={onScanAgain}>
        Escanear otro código
      </button>

      {selectedItem && (
        <ScanItemActionModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onEgreso={() => {
            setSelectedItem(null);
            navigate(buildEgresoUrlForItem(selectedItem));
          }}
          onIngreso={() => {
            setSelectedItem(null);
            navigate(buildIngresoUrlForItem(selectedItem));
          }}
        />
      )}
    </div>
  );
}
