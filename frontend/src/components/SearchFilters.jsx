import { ALMACEN_DEFAULT, ALMACENES, ARMARIOS } from '../utils/ubicacion';

export default function SearchFilters({ filters, onChange, almacenes, armarios, tipos }) {
  const almacenList =
    almacenes?.length > 0
      ? almacenes
      : Object.entries(ALMACENES).map(([codigo, info]) => ({
          codigo,
          nombre: info.nombre,
          tipo: info.tipo,
        }));

  return (
    <div className="card mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <label className="text-label">Buscar</label>
        <input
          className="input-field"
          placeholder="Nombre, tipo, comentario, calibración..."
          value={filters.q}
          onChange={(e) => onChange({ q: e.target.value })}
        />
      </div>
      <div>
        <label className="text-label">Almacén</label>
        <select
          className="input-field"
          value={filters.almacen || ''}
          onChange={(e) => onChange({ almacen: e.target.value })}
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
        <label className="text-label">Armario</label>
        <select
          className="input-field"
          value={filters.armario}
          onChange={(e) => onChange({ armario: e.target.value })}
        >
          <option value="">Todos</option>
          {(armarios || Object.keys(ARMARIOS)).map((code) => (
            <option key={code} value={code}>
              {code} — {ARMARIOS[code] || code}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-label">Tipo</label>
        <select
          className="input-field"
          value={filters.tipo}
          onChange={(e) => onChange({ tipo: e.target.value })}
        >
          <option value="">Todos</option>
          {tipos.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
