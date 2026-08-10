import { useMemo } from 'react';
import { ALMACENES, ARMARIOS, ESTANTES, getArmarioNombre, getArmariosForAlmacen } from '../utils/ubicacion';

export default function SearchFilters({
  filters,
  onChange,
  onClear,
  showClear = false,
  almacenes,
  armariosPorAlmacen,
  contenedores,
  tipos,
  estantes,
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
  const selectedArmario = filters.armario || '';
  const selectedEstante = filters.estante || '';
  const armarioList = selectedAlmacen
    ? getArmariosForAlmacen({ armariosPorAlmacen }, selectedAlmacen)
    : Object.entries(ARMARIOS).map(([codigo, nombre]) => ({ codigo, nombre }));

  const estanteList = useMemo(() => {
    const catalog = Array.isArray(estantes) && estantes.length ? estantes : ESTANTES;
    const list = Array.isArray(contenedores) ? contenedores : [];
    const fromCont = new Set();
    for (const c of list) {
      if (selectedAlmacen && c.almacen && c.almacen !== selectedAlmacen) continue;
      if (selectedArmario && c.armario && c.armario !== selectedArmario) continue;
      const code = String(c.estante || '').trim().toUpperCase();
      if (code) fromCont.add(code);
    }
    if (fromCont.size) {
      return [...fromCont]
        .sort((a, b) => a.localeCompare(b, 'es', { numeric: true }))
        .map((codigo) => {
          const found = catalog.find((e) => e.codigo === codigo);
          return { codigo, nombre: found?.nombre || codigo };
        });
    }
    return catalog;
  }, [contenedores, estantes, selectedAlmacen, selectedArmario]);

  const contenedorOptions = useMemo(() => {
    const list = Array.isArray(contenedores) ? contenedores : [];
    const codes = new Set();
    for (const c of list) {
      if (selectedAlmacen && c.almacen && c.almacen !== selectedAlmacen) continue;
      if (selectedArmario && c.armario && c.armario !== selectedArmario) continue;
      if (selectedEstante && c.estante && c.estante !== selectedEstante) continue;
      const code = String(c.contenedor || '').trim().toUpperCase();
      if (code) codes.add(code);
    }
    return [...codes].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
  }, [contenedores, selectedAlmacen, selectedArmario, selectedEstante]);

  const handleAlmacenChange = (almacen) => {
    onChange({ almacen, armario: '', estante: '', contenedor: '' });
  };

  const handleArmarioChange = (armario) => {
    onChange({ armario, estante: '', contenedor: '' });
  };

  const handleEstanteChange = (estante) => {
    onChange({ estante, contenedor: '' });
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
          ubicacionOnly ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6'
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
          onChange={(e) => handleArmarioChange(e.target.value)}
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
          <label className="text-label">Estante</label>
          <select
            className="input-field max-w-full"
            value={filters.estante || ''}
            onChange={(e) => handleEstanteChange(e.target.value)}
            disabled={!selectedAlmacen}
          >
            <option value="">{selectedAlmacen ? 'Todos' : 'Elegí almacén primero'}</option>
            {estanteList.map((e) => (
              <option key={e.codigo} value={e.codigo}>
                {e.codigo}
                {e.nombre && e.nombre !== e.codigo ? ` — ${e.nombre}` : ''}
              </option>
            ))}
          </select>
        </div>
      )}
      {!ubicacionOnly && (
        <div className="min-w-0">
          <label className="text-label">Contenedor</label>
          <select
            className="input-field max-w-full"
            value={filters.contenedor || ''}
            onChange={(e) => onChange({ contenedor: e.target.value })}
            disabled={!selectedAlmacen}
          >
            <option value="">
              {selectedAlmacen
                ? contenedorOptions.length
                  ? 'Todos'
                  : 'Sin contenedores en esta ubicación'
                : 'Elegí almacén primero'}
            </option>
            {contenedorOptions.map((code) => (
              <option key={code} value={code}>
                {code === 'SC' ? 'SC — Sin contenedor' : code}
              </option>
            ))}
          </select>
        </div>
      )}
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
      {!ubicacionOnly && (
        <div className="min-w-0">
          <label className="text-label">Familia</label>
          <input
            className="input-field max-w-full"
            placeholder="Ej. Interruptor…"
            value={filters.familia || ''}
            onChange={(e) => onChange({ familia: e.target.value })}
          />
        </div>
      )}
      {!ubicacionOnly && (
        <div className="min-w-0">
          <label className="text-label">Tema</label>
          <input
            className="input-field max-w-full"
            placeholder="Catálogo / tema…"
            value={filters.tema || ''}
            onChange={(e) => onChange({ tema: e.target.value })}
          />
        </div>
      )}
      </div>
    </div>
  );
}
