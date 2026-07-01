import { useEffect } from 'react';
import { ESTANTES, getArmariosForAlmacen, buildCodigoPreview } from '../utils/ubicacion';

export default function UbicacionSelector({
  catalogo,
  almacen,
  armario,
  estante,
  contenedor,
  onAlmacenChange,
  onArmarioChange,
  onEstanteChange,
  onContenedorChange,
  almacenDisabled = false,
  compact = false,
  labelPrefix = '',
}) {
  const almacenes = catalogo.almacenes?.length ? catalogo.almacenes : [{ codigo: 'ALM01', nombre: 'Oficina principal' }];
  const armariosList = getArmariosForAlmacen(catalogo, almacen);
  const preview = buildCodigoPreview(almacen, armario, estante, contenedor);

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
        <p className="font-mono text-sm font-bold text-accent">{preview}</p>
      )}
      <div className={`grid gap-2 ${compact ? 'grid-cols-2 sm:grid-cols-4' : 'sm:grid-cols-2'}`}>
        <div>
          <label className="text-label">{lbl('Almacén')}</label>
          <select
            className="input-field text-base"
            value={almacen}
            disabled={almacenDisabled}
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
