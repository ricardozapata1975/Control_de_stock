import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import QrLabel from '../components/QrLabel';
import SearchFilters from '../components/SearchFilters';
import { getArmarioNombre } from '../utils/ubicacion';
import { QR_TYPES } from '../utils/qrPayload';

const TABS = [
  { id: QR_TYPES.ITEM, label: 'Artículo' },
  { id: QR_TYPES.CONTENEDOR, label: 'Contenedor' },
  { id: QR_TYPES.ESTANTE, label: 'Estante' },
  { id: QR_TYPES.ARMARIO, label: 'Armario' },
];

function itemLinea(item) {
  const tipo = item.tipo?.trim();
  return tipo ? `${item.nombre} - ${tipo}` : item.nombre;
}

export default function ImprimirQR() {
  const [tab, setTab] = useState(QR_TYPES.ITEM);
  const [inventario, setInventario] = useState([]);
  const [contenedores, setContenedores] = useState([]);
  const [catalogo, setCatalogo] = useState({ armarios: [], estantes: [] });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [filters, setFilters] = useState({ q: '', armario: '', tipo: '' });

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.inventario(filters),
      api.contenedores().catch(() => ({ contenedores: [] })),
      api.catalogoUbicacion().catch(() => ({ armarios: [], estantes: [] })),
    ])
      .then(([inv, cnt, cat]) => {
        setInventario(inv.items || []);
        setContenedores(cnt.contenedores || []);
        setCatalogo({
          armarios: cat.armarios || [],
          estantes: cat.estantes || [],
        });
      })
      .finally(() => setLoading(false));
  }, [filters.q, filters.armario, filters.tipo]);

  useEffect(() => {
    setSelected(new Set());
  }, [tab]);

  const armarios = useMemo(
    () => [...new Set(inventario.map((i) => i.armario).filter(Boolean))].sort(),
    [inventario]
  );
  const tipos = useMemo(
    () => [...new Set(inventario.map((i) => i.tipo).filter(Boolean))].sort(),
    [inventario]
  );

  const articulos = useMemo(() => {
    const map = new Map();
    inventario.forEach((i) => {
      if (!i.itemId) return;
      if (!map.has(i.itemId)) map.set(i.itemId, i);
    });
    return [...map.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [inventario]);

  const listaContenedores = useMemo(() => {
    const map = new Map();
    contenedores.forEach((c) => {
      if (c.codigo) map.set(c.codigo, c);
    });
    inventario.forEach((i) => {
      const cod = i.contenedorCodigo;
      if (cod && !map.has(cod)) {
        map.set(cod, {
          codigo: cod,
          armario: i.armario,
          estante: i.estante,
          contenedor: i.contenedor,
        });
      }
    });
    return [...map.values()].sort((a, b) => String(a.codigo).localeCompare(String(b.codigo)));
  }, [contenedores, inventario]);

  const listaEstantes = useMemo(() => {
    const map = new Map();
    const arms =
      catalogo.armarios?.length > 0
        ? catalogo.armarios
        : armarios.map((codigo) => ({ codigo, nombre: getArmarioNombre(codigo) }));
    const ests =
      catalogo.estantes?.length > 0
        ? catalogo.estantes
        : Array.from({ length: 9 }, (_, i) => ({
            codigo: `E${String(i + 1).padStart(2, '0')}`,
          }));
    arms.forEach((a) => {
      const ac = a.codigo || a;
      ests.forEach((e) => {
        const ec = e.codigo || e;
        const codigo = `${ac}-${ec}`;
        map.set(codigo, { codigo, armario: ac, estante: ec, nombre: `${a.nombre || getArmarioNombre(ac)} / ${ec}` });
      });
    });
    inventario.forEach((i) => {
      if (i.armario && i.estante) {
        const codigo = `${i.armario}-${i.estante}`;
        if (!map.has(codigo)) {
          map.set(codigo, {
            codigo,
            armario: i.armario,
            estante: i.estante,
            nombre: formatEstanteNombre(i.armario, i.estante),
          });
        }
      }
    });
    return [...map.values()].sort((a, b) => a.codigo.localeCompare(b.codigo));
  }, [catalogo, armarios, inventario]);

  const listaArmarios = useMemo(() => {
    const map = new Map();
    const arms =
      catalogo.armarios?.length > 0
        ? catalogo.armarios
        : armarios.map((codigo) => ({ codigo, nombre: getArmarioNombre(codigo) }));
    arms.forEach((a) => {
      const codigo = a.codigo || a;
      map.set(codigo, { codigo, nombre: a.nombre || getArmarioNombre(codigo) });
    });
    inventario.forEach((i) => {
      if (i.armario && !map.has(i.armario)) {
        map.set(i.armario, { codigo: i.armario, nombre: getArmarioNombre(i.armario) });
      }
    });
    return [...map.values()].sort((a, b) => a.codigo.localeCompare(b.codigo));
  }, [catalogo, armarios, inventario]);

  function formatEstanteNombre(armario, estante) {
    return `${getArmarioNombre(armario)} / ${estante}`;
  }

  const entries = useMemo(() => {
    switch (tab) {
      case QR_TYPES.ITEM:
        return articulos.map((i) => ({
          key: `item:${i.itemId}`,
          type: QR_TYPES.ITEM,
          itemId: i.itemId,
          codigo: i.itemId,
          titulo: i.itemId,
          subtitulo: itemLinea(i),
        }));
      case QR_TYPES.CONTENEDOR:
        return listaContenedores.map((c) => ({
          key: `cnt:${c.codigo}`,
          type: QR_TYPES.CONTENEDOR,
          codigo: c.codigo,
          titulo: c.codigo,
          subtitulo: c.nombre || c.codigo,
        }));
      case QR_TYPES.ESTANTE:
        return listaEstantes.map((e) => ({
          key: `est:${e.codigo}`,
          type: QR_TYPES.ESTANTE,
          codigo: e.codigo,
          titulo: e.codigo,
          subtitulo: e.nombre || e.codigo,
        }));
      case QR_TYPES.ARMARIO:
        return listaArmarios.map((a) => ({
          key: `arm:${a.codigo}`,
          type: QR_TYPES.ARMARIO,
          codigo: a.codigo,
          titulo: a.codigo,
          subtitulo: a.nombre || getArmarioNombre(a.codigo),
        }));
      default:
        return [];
    }
  }, [tab, articulos, listaContenedores, listaEstantes, listaArmarios]);

  const filteredEntries = useMemo(() => {
    if (tab !== QR_TYPES.ITEM) return entries;
    const q = filters.q.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (e) =>
        e.itemId?.toLowerCase().includes(q) ||
        e.subtitulo?.toLowerCase().includes(q) ||
        e.titulo?.toLowerCase().includes(q)
    );
  }, [entries, tab, filters.q]);

  const toggle = (key) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(filteredEntries.map((e) => e.key)));
  const clearAll = () => setSelected(new Set());
  const toPrint = filteredEntries.filter((e) => selected.has(e.key));

  const tabHint = {
    [QR_TYPES.ITEM]: 'QR con item_id para identificar cada herramienta.',
    [QR_TYPES.CONTENEDOR]: 'Códigos A01-E03-C05, A01-E03-B12, A01-E03-H01 o A01-E03-SC.',
    [QR_TYPES.ESTANTE]: 'Códigos A01-E03 (estante sin contenedor).',
    [QR_TYPES.ARMARIO]: 'Códigos A00, A01… (zona / armario).',
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h2 className="page-title">Etiquetas QR</h2>
          <p className="text-muted">{tabHint[tab]}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-secondary text-sm"
            onClick={selectAll}
            disabled={!filteredEntries.length}
          >
            Todos
          </button>
          <button type="button" className="btn-secondary text-sm" onClick={clearAll}>
            Ninguno
          </button>
          <button
            type="button"
            className="btn-primary text-sm"
            disabled={!toPrint.length}
            onClick={() => window.print()}
          >
            Imprimir ({toPrint.length})
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2 print:hidden">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`rounded-lg px-4 py-2 text-sm font-bold uppercase tracking-wide ${
              tab === t.id
                ? 'bg-accent text-accent-foreground'
                : 'border border-border text-content-muted hover:bg-surface-hover hover:text-content'
            }`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === QR_TYPES.ITEM && (
        <div className="print:hidden">
          <SearchFilters
            filters={filters}
            onChange={(f) => setFilters((prev) => ({ ...prev, ...f }))}
            armarios={armarios}
            tipos={tipos}
          />
        </div>
      )}

      {loading && <p className="text-muted print:hidden">Cargando...</p>}

      {!loading && !filteredEntries.length && (
        <p className="text-muted print:hidden">Sin elementos para este tipo.</p>
      )}

      <div className="card mb-6 grid gap-2 print:hidden sm:grid-cols-2 lg:grid-cols-3">
        {filteredEntries.map((entry) => (
          <label
            key={entry.key}
            className="flex cursor-pointer items-center gap-2 rounded-lg border border-border p-3 text-content hover:bg-surface-hover"
          >
            <input
              type="checkbox"
              checked={selected.has(entry.key)}
              onChange={() => toggle(entry.key)}
              className="h-5 w-5 accent-accent"
            />
            <span className="min-w-0">
              <span className="block font-mono font-bold text-accent">{entry.titulo}</span>
              <span className="block truncate text-sm text-content-muted">{entry.subtitulo}</span>
            </span>
          </label>
        ))}
      </div>

      {!toPrint.length && !loading && filteredEntries.length > 0 ? (
        <p className="text-muted print:hidden">Seleccioná al menos una etiqueta.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 print:grid-cols-3">
          {toPrint.map((entry) => (
            <QrLabel
              key={entry.key}
              type={entry.type}
              codigo={entry.codigo}
              itemId={entry.itemId}
              titulo={entry.titulo}
              subtitulo={entry.subtitulo}
            />
          ))}
        </div>
      )}

      <style>{`
        @media print {
          header, nav, .print\\:hidden { display: none !important; }
          main { max-width: 100% !important; padding: 0 !important; }
          body { background: white !important; }
        }
      `}</style>
    </div>
  );
}
