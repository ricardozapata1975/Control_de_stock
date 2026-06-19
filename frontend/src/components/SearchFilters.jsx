import { ALMACENES, ARMARIOS, getArmarioNombre, getArmariosForAlmacen } from '../utils/ubicacion';

export default function SearchFilters({
  filters,
  onChange,
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
    <div
      className={`card mb-4 grid gap-3 ${
        ubicacionOnly ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-4'
      }`}
    >
      {!ubicacionOnly && (
        <div>
          <label className="text-label">Buscar</label>
          <input
            className="input-field"
            placeholder="Nombre, tipo, comentario, calibración..."
            value={filters.q}
            onChange={(e) => onChange({ q: e.target.value })}
          />
        </div>
      )}
      <div>
        <label className="text-label">Almacén</label>
        <select
          className="input-field"
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
      <div>
        <label className="text-label">Armario / estantería</label>
        <select
          className="input-field"
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
        <div>
          <label className="text-label">Tipo</label>
          <select
            className="input-field"
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
  );
}
