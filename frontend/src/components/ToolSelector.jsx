export default function ToolSelector({ items, value, onChange, onScanClick }) {
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <select className="input-field flex-1" value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">Seleccionar herramienta...</option>
          {items.map((i) => (
            <option key={i.id} value={i.id}>
              {i.nombre} — Stock: {i.cantidad} ({i.ubicacion}/{i.estante})
            </option>
          ))}
        </select>
        {onScanClick && (
          <button type="button" onClick={onScanClick} className="btn-secondary shrink-0" title="Escanear código">
            📷
          </button>
        )}
      </div>
    </div>
  );
}
