import { useEffect, useState } from 'react';
import { api } from '../../../api/client';
import { useAuth } from '../../../auth/AuthProvider';

export default function AuditoriasPage() {
  const { sede, user } = useAuth();
  const [list, setList] = useState([]);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ almacen: '', armario: '', estante: '', contenedorCodigo: '', notas: '' });
  const [scan, setScan] = useState({ codigo: '', cantidadFisica: 1 });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    api
      .proyectosAuditorias(sede ? { sede } : {})
      .then((d) => {
        setList(d.auditorias || []);
        setError('');
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sede]);

  const open = async (id) => {
    const data = await api.proyectoAuditoria(id);
    setDetail(data);
  };

  const crear = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data = await api.crearAuditoriaProyecto({
        ...form,
        sede,
        operador: user?.name,
      });
      setShowNew(false);
      setDetail(data);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const agregarLinea = async (e) => {
    e.preventDefault();
    if (!detail?.auditoria?.id) return;
    setSaving(true);
    try {
      await api.agregarLineaAuditoriaProyecto(detail.auditoria.id, {
        codigo: scan.codigo,
        cantidadFisica: Number(scan.cantidadFisica),
      });
      setScan({ codigo: '', cantidadFisica: 1 });
      await open(detail.auditoria.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const cerrar = async () => {
    if (!detail?.auditoria?.id) return;
    setSaving(true);
    try {
      const data = await api.cerrarAuditoriaProyecto(detail.auditoria.id);
      setDetail(data);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="section-title">Auditorías de stock</h2>
          <p className="text-sm text-muted">
            Contá físico vs sistema por ubicación. Escaneá código/QR o cargá manualmente.
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setShowNew(true)}>
          Nueva auditoría
        </button>
      </div>

      {error && <div className="alert-error">{error}</div>}
      {loading && <p className="text-muted">Cargando…</p>}

      <ul className="space-y-2">
        {list.map((a) => (
          <li key={a.id}>
            <button
              type="button"
              className="card w-full text-left hover:border-accent"
              onClick={() => open(a.id)}
            >
              <div className="flex justify-between gap-2 text-sm">
                <div>
                  <p className="font-semibold">
                    {[a.almacen, a.armario, a.estante, a.contenedorCodigo].filter(Boolean).join(' / ') ||
                      'Sin ubicación'}
                  </p>
                  <p className="text-muted">
                    {a.operador || '—'} · {a.lineasCount || 0} líneas
                  </p>
                </div>
                <p className="font-semibold text-accent">{a.estado}</p>
              </div>
            </button>
          </li>
        ))}
        {!loading && !list.length && <p className="text-muted">Sin auditorías.</p>}
      </ul>

      {detail && (
        <div className="card space-y-4 border-accent/40">
          <div className="flex flex-wrap justify-between gap-2">
            <div>
              <h3 className="section-title">Detalle auditoría</h3>
              <p className="text-sm text-muted">
                {detail.auditoria.estado}
                {detail.auditoria.resumen
                  ? ` · ${detail.auditoria.resumen.total} líneas · falt ${detail.auditoria.resumen.faltantes} · sobr ${detail.auditoria.resumen.sobrantes}`
                  : ''}
              </p>
            </div>
            <div className="flex gap-2">
              {detail.auditoria.estado === 'abierta' && (
                <button type="button" className="btn-primary text-sm" disabled={saving} onClick={cerrar}>
                  Cerrar e informar
                </button>
              )}
              <button type="button" className="btn-secondary text-sm" onClick={() => setDetail(null)}>
                Cerrar panel
              </button>
            </div>
          </div>

          {detail.auditoria.estado === 'abierta' && (
            <form className="flex flex-wrap gap-2" onSubmit={agregarLinea}>
              <input
                className="input-field flex-1"
                placeholder="Código / QR / nombre"
                value={scan.codigo}
                onChange={(e) => setScan({ ...scan, codigo: e.target.value })}
                required
              />
              <input
                type="number"
                min={0}
                className="input-field w-24"
                value={scan.cantidadFisica}
                onChange={(e) => setScan({ ...scan, cantidadFisica: e.target.value })}
                required
              />
              <button type="submit" className="btn-primary" disabled={saving}>
                Contar
              </button>
            </form>
          )}

          <ul className="max-h-64 space-y-1 overflow-y-auto text-sm">
            {(detail.lineas || []).map((l) => (
              <li key={l.id} className="flex justify-between border-b border-border py-1">
                <span>
                  <span className="font-mono">{l.codigo}</span> {l.nombre}
                </span>
                <span
                  className={
                    Number(l.diferencia) === 0
                      ? 'text-emerald-600'
                      : Number(l.diferencia) < 0
                        ? 'text-red-500'
                        : 'text-amber-600'
                  }
                >
                  sis {l.cantidadSistema} / fís {l.cantidadFisica} (Δ {l.diferencia})
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {showNew && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <form className="card w-full max-w-md space-y-3" onSubmit={crear}>
            <h3 className="section-title">Nueva auditoría</h3>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-label">Almacén</label>
                <input
                  className="input-field"
                  value={form.almacen}
                  onChange={(e) => setForm({ ...form, almacen: e.target.value })}
                  placeholder="ALM01"
                />
              </div>
              <div>
                <label className="text-label">Armario</label>
                <input
                  className="input-field"
                  value={form.armario}
                  onChange={(e) => setForm({ ...form, armario: e.target.value })}
                  placeholder="A01"
                />
              </div>
              <div>
                <label className="text-label">Estante</label>
                <input
                  className="input-field"
                  value={form.estante}
                  onChange={(e) => setForm({ ...form, estante: e.target.value })}
                  placeholder="E01"
                />
              </div>
              <div>
                <label className="text-label">Contenedor</label>
                <input
                  className="input-field"
                  value={form.contenedorCodigo}
                  onChange={(e) => setForm({ ...form, contenedorCodigo: e.target.value })}
                  placeholder="H01"
                />
              </div>
            </div>
            <div>
              <label className="text-label">Notas</label>
              <input
                className="input-field"
                value={form.notas}
                onChange={(e) => setForm({ ...form, notas: e.target.value })}
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn-primary flex-1" disabled={saving}>
                Iniciar
              </button>
              <button type="button" className="btn-secondary flex-1" onClick={() => setShowNew(false)}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
