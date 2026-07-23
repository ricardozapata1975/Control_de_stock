import { ALMACENES, ARMARIOS, getArmarioNombre, getArmariosForAlmacen } from '../utils/ubicacion';

export default function SearchFilters({
  filters,
  onChange,
  onClear,
  showClear = false,
  almacenes,
  armariosPorAlmacen,
  tipos,
  variant = 'full',
}) {
  const ubicacionOnly = variant === 'ubicacion';
  const almacenList =
    almacenes?.length > 0
      ? almacenes
      : Object.entries(ALMACENES).map(([codigo, info]) => ({
          codigo,
          nombre: info.nombre,
          tipo: info.tipo,
        }));

  const selectedAlmacen = filters.almacen || '';
  const armarioList = selectedAlmacen
    ? getArmariosForAlmacen({ armariosPorAlmacen }, selectedAlmacen)
    : Object.entries(ARMARIOS).map(([codigo, nombre]) => ({ codigo, nombre }));

  const handleAlmacenChange = (almacen) => {
    onChange({ almacen, armario: '' });
  };

  return (
    <div className="mb-4 min-w-0 max-w-full space-y-2">
      {showClear && onClear && (
        <div className="flex justify-end">
          <button type="button" className="text-sm font-semibold text-accent underline hover:text-content" onClick={onClear}>
            Limpiar filtros
          </button>
        </div>
      )}
      <div
        className={`card grid min-w-0 max-w-full gap-3 overflow-hidden ${
          ubicacionOnly ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-4'
        }`}
      >
      {!ubicacionOnly && (
        <div className="min-w-0">
          <label className="text-label">Buscar</label>
          <input
            className="input-field max-w-full"
            placeholder="Nombre, tipo, comentario, calibración..."
            value={filters.q}
            onChange={(e) => onChange({ q: e.target.value })}
          />
        </div>
      )}
      <div className="min-w-0">
        <label className="text-label">Almacén</label>
        <select
          className="input-field max-w-full"
          value={filters.almacen || ''}
          onChange={(e) => handleAlmacenChange(e.target.value)}
        >
          <option value="">Todos</option>
          {almacenList.map((a) => (
            <option key={a.codigo} value={a.codigo}>
              {a.codigo} — {a.nombre || a.codigo}
            </option>
          ))}
        </select>
      </div>
      <div className="min-w-0">
        <label className="text-label">Armario / estantería</label>
        <select
          className="input-field max-w-full"
          value={filters.armario}
          onChange={(e) => onChange({ armario: e.target.value })}
          disabled={!selectedAlmacen}
        >
          <option value="">{selectedAlmacen ? 'Todos' : 'Elegí almacén primero'}</option>
          {armarioList.map((a) => (
            <option key={a.codigo} value={a.codigo}>
              {a.codigo} — {a.nombre || getArmarioNombre(a.codigo, selectedAlmacen, armariosPorAlmacen)}
            </option>
          ))}
        </select>
      </div>
      {!ubicacionOnly && (
        <div className="min-w-0">
          <label className="text-label">Tipo</label>
          <select
            className="input-field max-w-full"
            value={filters.tipo}
            onChange={(e) => onChange({ tipo: e.target.value })}
          >
            <option value="">Todos</option>
            {(tipos || []).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      )}
      </div>
    </div>
  );
}
