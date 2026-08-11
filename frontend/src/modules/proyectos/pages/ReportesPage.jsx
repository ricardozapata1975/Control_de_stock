import { useEffect, useMemo, useState } from 'react';
import { api } from '../../../api/client';
import { useAuth } from '../../../auth/AuthProvider';
import { exportReportesProyectosExcel } from '../utils/exportReportes';

function ReportesPrintDocument({ data, meta }) {
  const r = data?.resumen || {};
  const porTipo = Object.entries(data?.porTipo || {});
  const recientes = data?.recientes || [];

  return (
    <div className="reporte-proyectos-doc bg-white p-6 text-black">
      <h1 className="text-xl font-bold">Reporte de Proyectos</h1>
      <p className="mt-1 text-sm text-zinc-700">
        Sede: {meta.sede || 'Todas'} · Proyecto: {meta.proyectoNombre || 'Todos'}
        <br />
        Desde: {meta.desde || '—'} · Hasta: {meta.hasta || '—'}
        <br />
        Generado: {new Date().toLocaleString('es-AR')}
      </p>

      <h2 className="mt-6 text-base font-semibold">Indicadores</h2>
      <table className="mt-2 w-full border-collapse text-sm">
        <tbody>
          {[
            ['Proyectos activos', r.proyectosActivos],
            ['Reservas activas', r.reservasActivas],
            ['Faltantes', r.faltantesPendientes],
            ['Devoluciones', r.devoluciones],
            ['Herramientas prestadas', r.herramientasPrestadas],
            ['Movimientos (filtro)', r.movimientos],
          ].map(([label, val]) => (
            <tr key={label} className="border-b border-zinc-300">
              <td className="py-1 pr-4">{label}</td>
              <td className="py-1 text-right font-semibold">{val ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="mt-6 text-base font-semibold">Cantidades por tipo de movimiento</h2>
      {porTipo.length ? (
        <table className="mt-2 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-400 text-left">
              <th className="py-1">Tipo</th>
              <th className="py-1 text-right">Cantidad</th>
            </tr>
          </thead>
          <tbody>
            {porTipo.map(([tipo, cant]) => (
              <tr key={tipo} className="border-b border-zinc-200">
                <td className="py-1">{tipo}</td>
                <td className="py-1 text-right font-semibold">{cant}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="mt-2 text-sm text-zinc-600">Sin movimientos en el período.</p>
      )}

      <h2 className="mt-6 text-base font-semibold">Movimientos recientes</h2>
      {recientes.length ? (
        <table className="mt-2 w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-zinc-400 text-left">
              <th className="py-1 pr-2">Fecha</th>
              <th className="py-1 pr-2">Tipo</th>
              <th className="py-1 pr-2 text-right">Cant.</th>
              <th className="py-1 pr-2">Estado</th>
              <th className="py-1 pr-2">Usuario</th>
              <th className="py-1">Notas</th>
            </tr>
          </thead>
          <tbody>
            {recientes.map((m) => (
              <tr key={m.id} className="border-b border-zinc-200 align-top">
                <td className="py-1 pr-2 whitespace-nowrap">
                  {m.createdAt ? new Date(m.createdAt).toLocaleString('es-AR') : '—'}
                </td>
                <td className="py-1 pr-2">{m.tipo}</td>
                <td className="py-1 pr-2 text-right">{m.cantidad ?? '—'}</td>
                <td className="py-1 pr-2">{m.estadoMaterial || '—'}</td>
                <td className="py-1 pr-2">{m.usuario || '—'}</td>
                <td className="py-1">{m.notas || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="mt-2 text-sm text-zinc-600">Sin movimientos.</p>
      )}
    </div>
  );
}

export default function ReportesPage() {
  const { sede } = useAuth();
  const [proyectos, setProyectos] = useState([]);
  const [proyectoId, setProyectoId] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPdf, setShowPdf] = useState(false);
  const [exportMsg, setExportMsg] = useState('');

  useEffect(() => {
    api.proyectos(sede ? { sede } : {}).then((d) => setProyectos(d.proyectos || []));
  }, [sede]);

  const proyectoNombre = useMemo(() => {
    if (!proyectoId) return '';
    return proyectos.find((p) => p.id === proyectoId)?.nombre || proyectoId;
  }, [proyectoId, proyectos]);

  const exportMeta = useMemo(
    () => ({
      sede: sede || '',
      proyectoNombre: proyectoNombre || '',
      desde,
      hasta,
    }),
    [sede, proyectoNombre, desde, hasta]
  );

  const load = () => {
    setLoading(true);
    setError('');
    setExportMsg('');
    const params = {
      ...(sede ? { sede } : {}),
      ...(proyectoId ? { proyectoId } : {}),
      ...(desde ? { desde } : {}),
      ...(hasta ? { hasta } : {}),
    };
    api
      .proyectosReportes(params)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sede]);

  const handleExcel = () => {
    setExportMsg('');
    try {
      exportReportesProyectosExcel(data, exportMeta);
      setExportMsg('Excel descargado.');
    } catch (e) {
      setError(e.message || 'No se pudo exportar Excel');
    }
  };

  const handlePdf = () => {
    if (!data) {
      setError('No hay datos para exportar. Actualizá el reporte primero.');
      return;
    }
    setShowPdf(true);
  };

  const r = data?.resumen || {};

  return (
    <div className="space-y-4">
      <h2 className="section-title">Reportes</h2>
      <p className="text-sm text-muted">
        Indicadores del módulo Proyectos (consumos/reservas/faltantes/devoluciones/movimientos).
      </p>

      <div className="card grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <label className="text-label">Proyecto</label>
          <select
            className="input-field"
            value={proyectoId}
            onChange={(e) => setProyectoId(e.target.value)}
          >
            <option value="">Todos</option>
            {proyectos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-label">Desde</label>
          <input type="date" className="input-field" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </div>
        <div>
          <label className="text-label">Hasta</label>
          <input type="date" className="input-field" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </div>
        <div className="flex items-end">
          <button type="button" className="btn-primary w-full" onClick={load} disabled={loading}>
            {loading ? 'Cargando…' : 'Actualizar'}
          </button>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <button
            type="button"
            className="btn-secondary flex-1"
            onClick={handleExcel}
            disabled={!data || loading}
            title="Descarga .xlsx con los filtros activos"
          >
            Excel
          </button>
          <button
            type="button"
            className="btn-secondary flex-1"
            onClick={handlePdf}
            disabled={!data || loading}
            title="Abrir vista para imprimir o guardar PDF"
          >
            PDF
          </button>
        </div>
      </div>

      {error && <div className="alert-error">{error}</div>}
      {exportMsg && <div className="alert-success">{exportMsg}</div>}

      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ['Proyectos activos', r.proyectosActivos],
              ['Reservas activas', r.reservasActivas],
              ['Faltantes', r.faltantesPendientes],
              ['Devoluciones', r.devoluciones],
              ['Herramientas prestadas', r.herramientasPrestadas],
              ['Movimientos (filtro)', r.movimientos],
            ].map(([label, val]) => (
              <div key={label} className="card">
                <p className="text-xs uppercase text-muted">{label}</p>
                <p className="text-2xl font-bold text-accent">{val ?? 0}</p>
              </div>
            ))}
          </div>

          <div className="card">
            <h3 className="section-title mb-2">Cantidades por tipo de movimiento</h3>
            <ul className="space-y-1 text-sm">
              {Object.entries(data.porTipo || {}).map(([tipo, cant]) => (
                <li key={tipo} className="flex justify-between border-b border-border py-1">
                  <span>{tipo}</span>
                  <strong>{cant}</strong>
                </li>
              ))}
              {!Object.keys(data.porTipo || {}).length && (
                <p className="text-muted">Sin movimientos en el período.</p>
              )}
            </ul>
          </div>

          <div className="card">
            <h3 className="section-title mb-2">Movimientos recientes</h3>
            <ul className="max-h-64 space-y-1 overflow-y-auto text-sm">
              {(data.recientes || []).map((m) => (
                <li key={m.id} className="border-b border-border py-1">
                  <strong>{m.tipo}</strong> · {m.cantidad ?? '—'} · {m.estadoMaterial || '—'} ·{' '}
                  {m.usuario || '—'}
                  <span className="block text-xs text-muted">
                    {m.createdAt && new Date(m.createdAt).toLocaleString('es-AR')}
                    {m.notas ? ` · ${m.notas}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {showPdf && data && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-zinc-950 print:static print:bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3 print:hidden">
            <div>
              <h3 className="text-lg font-bold text-content">Exportar PDF</h3>
              <p className="text-sm text-muted">
                Usá Imprimir y elegí «Guardar como PDF». Respeta proyecto y fechas del filtro.
              </p>
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn-primary" onClick={() => window.print()}>
                Imprimir / PDF
              </button>
              <button type="button" className="btn-secondary" onClick={() => setShowPdf(false)}>
                Cerrar
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 print:p-0">
            <ReportesPrintDocument data={data} meta={exportMeta} />
          </div>
          <style>{`
            @media print {
              body * { visibility: hidden !important; }
              .reporte-proyectos-doc, .reporte-proyectos-doc * { visibility: visible !important; }
              .reporte-proyectos-doc {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
              }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}
