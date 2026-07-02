import { useEffect } from 'react';
import {
  ESTANTES,
  SEDE_DEFAULT,
  buildCodigoCompletoPreview,
  getAlmacenesForSede,
  getArmariosForAlmacen,
  getSedesFromCatalog,
} from '../utils/ubicacion';

export default function UbicacionSelector({
  catalogo,
  sede,
  almacen,
  armario,
  estante,
  contenedor,
  onSedeChange,
  onAlmacenChange,
  onArmarioChange,
  onEstanteChange,
  onContenedorChange,
  almacenDisabled = false,
  sedeDisabled = false,
  showSede = true,
  compact = false,
  labelPrefix = '',
}) {
  const sedes = getSedesFromCatalog(catalogo);
  const sedeActual = sede || SEDE_DEFAULT;
  const almacenes = getAlmacenesForSede(catalogo, sedeActual);
  const armariosList = getArmariosForAlmacen(catalogo, almacen);
  const preview = buildCodigoCompletoPreview(sedeActual, almacen, armario, estante, contenedor);

  useEffect(() => {
    if (!almacenes.length) return;
    if (!almacen || !almacenes.some((a) => a.codigo === almacen)) {
      onAlmacenChange(almacenes[0].codigo);
    }
  }, [sedeActual, almacenes, almacen, onAlmacenChange]);

  useEffect(() => {
    if (!armariosList.length) return;
    if (!armario || !armariosList.some((a) => a.codigo === armario)) {
      onArmarioChange(armariosList[0].codigo);
    }
  }, [almacen, armariosList, armario, onArmarioChange]);

  const lbl = (text) => (labelPrefix ? `${labelPrefix} ${text}` : text);

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      {preview && (
        <p className="break-all font-mono text-sm font-bold text-accent">{preview}</p>
      )}
      <div className={`grid gap-2 ${compact ? 'grid-cols-2 sm:grid-cols-5' : 'sm:grid-cols-2'}`}>
        {showSede && (
          <div className={compact ? '' : 'sm:col-span-2'}>
            <label className="text-label">{lbl('Sede')}</label>
            <select
              className="input-field text-base"
              value={sedeActual}
              disabled={sedeDisabled}
              onChange={(e) => onSedeChange?.(e.target.value)}
            >
              {sedes.map((s) => (
                <option key={s.codigo} value={s.codigo}>
                  {s.codigo} — {s.nombre || s.codigo}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="text-label">{lbl('Almacén')}</label>
          <select
            className="input-field text-base"
            value={almacen}
            disabled={almacenDisabled || !almacenes.length}
            onChange={(e) => onAlmacenChange(e.target.value)}
          >
            {almacenes.map((a) => (
              <option key={a.codigo} value={a.codigo}>
                {a.codigo} — {a.nombre || a.codigo}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-label">{lbl('Armario')}</label>
          <select
            className="input-field text-base"
            value={armario}
            disabled={!armariosList.length}
            onChange={(e) => onArmarioChange(e.target.value)}
          >
            {armariosList.length ? (
              armariosList.map((a) => (
                <option key={a.codigo} value={a.codigo}>
                  {a.codigo} — {a.nombre}
                </option>
              ))
            ) : (
              <option value="">Sin armarios</option>
            )}
          </select>
        </div>
        <div>
          <label className="text-label">{lbl('Estante')}</label>
          <select
            className="input-field text-base"
            value={estante}
            onChange={(e) => onEstanteChange(e.target.value)}
          >
            {ESTANTES.map((e) => (
              <option key={e.codigo} value={e.codigo}>
                {e.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-label">{lbl('Contenedor')}</label>
          <input
            className="input-field text-base"
            placeholder="Opcional (C01, B02…)"
            value={contenedor}
            onChange={(e) => onContenedorChange(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
