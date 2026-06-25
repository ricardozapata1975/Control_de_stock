import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import QrLabel from '../components/QrLabel';
import SearchFilters from '../components/SearchFilters';
import {
  ALMACEN_DEFAULT,
  ESTANTES,
  buildUbicacionCodigo,
  getAlmacenNombre,
  getArmarioNombre,
  getArmariosForAlmacen,
} from '../utils/ubicacion';
import { QR_TYPES } from '../utils/qrPayload';

const TABS = [
  { id: QR_TYPES.ALMACEN, label: 'Almacén' },
  { id: QR_TYPES.ARMARIO, label: 'Armario' },
  { id: QR_TYPES.ESTANTE, label: 'Estante' },
  { id: QR_TYPES.CONTENEDOR, label: 'Contenedor' },
  { id: QR_TYPES.ITEM, label: 'Artículo' },
];

const LOCATION_TABS = new Set([
  QR_TYPES.ALMACEN,
  QR_TYPES.ARMARIO,
  QR_TYPES.ESTANTE,
  QR_TYPES.CONTENEDOR,
]);

function itemLinea(item) {
  const tipo = item.tipo?.trim();
  return tipo ? `${item.nombre} - ${tipo}` : item.nombre;
}

export default function ImprimirQR() {
  const [tab, setTab] = useState(QR_TYPES.ALMACEN);
  const [inventario, setInventario] = useState([]);
  const [contenedores, setContenedores] = useState([]);
  const [catalogo, setCatalogo] = useState({
    almacenes: [],
    armariosPorAlmacen: {},
    estantes: [],
  });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [filters, setFilters] = useState({ q: '', almacen: '', armario: '', tipo: '' });
  const [tipos, setTipos] = useState([]);

  useEffect(() => {
    setLoading(true);
    const itemFilters = tab === QR_TYPES.ITEM ? filters : {};
    Promise.all([
      api.inventario(itemFilters),
      api.contenedores().catch(() => ({ contenedores: [] })),
      api.catalogoUbicacion().catch(() => ({
        almacenes: [],
        armariosPorAlmacen: {},
        estantes: [],
      })),
      api.tipos().catch(() => ({ tipos: [] })),
    ])
      .then(([inv, cnt, cat, tiposData]) => {
        setInventario(inv.items || []);
        setContenedores(cnt.contenedores || []);
        setCatalogo({
          almacenes: cat.almacenes || [],
          armariosPorAlmacen: cat.armariosPorAlmacen || {},
          estantes: cat.estantes?.length ? cat.estantes : ESTANTES,
        });
        setTipos(tiposData.tipos || []);
      })
      .finally(() => setLoading(false));
  }, [tab, filters.q, filters.almacen, filters.armario, filters.tipo]);

  useEffect(() => {
    setSelected(new Set());
  }, [tab, filters.almacen, filters.armario]);

  const almacenes = useMemo(
    () =>
      catalogo.almacenes?.length
        ? catalogo.almacenes
        : [{ codigo: ALMACEN_DEFAULT, nombre: getAlmacenNombre(ALMACEN_DEFAULT) }],
    [catalogo.almacenes]
  );

  const selectedAlmacen = filters.almacen || '';
  const selectedArmario = filters.armario || '';

  const armariosVisibles = useMemo(() => {
    const almacenesTarget = selectedAlmacen
      ? [selectedAlmacen]
      : almacenes.map((a) => a.codigo);

    return almacenesTarget.flatMap((alm) =>
      getArmariosForAlmacen(catalogo, alm).map((a) => ({
        ...a,
        almacen: alm,
      }))
    );
  }, [almacenes, catalogo, selectedAlmacen]);

  const estantesVisibles = useMemo(
    () => (catalogo.estantes?.length ? catalogo.estantes : ESTANTES),
    [catalogo.estantes]
  );

  const articulos = useMemo(() => {
    const map = new Map();
    inventario.forEach((i) => {
      if (!i.itemId) return;
      if (!map.has(i.itemId)) map.set(i.itemId, i);
    });
    return [...map.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [inventario]);

  const listaAlmacenes = useMemo(
    () =>
      almacenes
        .map((a) => ({
          codigo: a.codigo,
          nombre: a.nombre || getAlmacenNombre(a.codigo),
        }))
        .sort((a, b) => a.codigo.localeCompare(b.codigo)),
    [almacenes]
  );

  const listaArmarios = useMemo(() => {
    const map = new Map();
    armariosVisibles.forEach((a) => {
      const codigo = buildUbicacionCodigo(a.almacen, a.codigo);
      map.set(`${a.almacen}:${a.codigo}`, {
        codigo,
        almacen: a.almacen,
        armario: a.codigo,
        nombre: a.nombre || getArmarioNombre(a.codigo, a.almacen, catalogo.armariosPorAlmacen),
      });
    });
    inventario.forEach((i) => {
      if (!i.armario) return;
      const alm = i.almacen || ALMACEN_DEFAULT;
      if (selectedAlmacen && alm !== selectedAlmacen) return;
      if (selectedArmario && i.armario !== selectedArmario) return;
      const codigo = buildUbicacionCodigo(alm, i.armario);
      const key = `${alm}:${i.armario}`;
      if (!map.has(key)) {
        map.set(key, {
          codigo,
          almacen: alm,
          armario: i.armario,
          nombre: getArmarioNombre(i.armario, alm, catalogo.armariosPorAlmacen),
        });
      }
    });
    return [...map.values()].sort((a, b) => a.codigo.localeCompare(b.codigo));
  }, [armariosVisibles, inventario, selectedAlmacen, selectedArmario, catalogo.armariosPorAlmacen]);

  const listaEstantes = useMemo(() => {
    const map = new Map();
    armariosVisibles.forEach((a) => {
      if (selectedArmario && a.codigo !== selectedArmario) return;
      estantesVisibles.forEach((e) => {
        const ec = e.codigo || e;
        const codigo = buildUbicacionCodigo(a.almacen, a.codigo, ec);
        map.set(codigo, {
          codigo,
          almacen: a.almacen,
          armario: a.codigo,
          estante: ec,
          nombre: `${a.nombre || getArmarioNombre(a.codigo, a.almacen, catalogo.armariosPorAlmacen)} / ${e.nombre || ec}`,
        });
      });
    });
    inventario.forEach((i) => {
      if (!i.armario || !i.estante) return;
      const alm = i.almacen || ALMACEN_DEFAULT;
      if (selectedAlmacen && alm !== selectedAlmacen) return;
      if (selectedArmario && i.armario !== selectedArmario) return;
      const codigo = buildUbicacionCodigo(alm, i.armario, i.estante);
      if (!map.has(codigo)) {
        map.set(codigo, {
          codigo,
          almacen: alm,
          armario: i.armario,
          estante: i.estante,
          nombre: `${getArmarioNombre(i.armario, alm, catalogo.armariosPorAlmacen)} / ${i.estante}`,
        });
      }
    });
    return [...map.values()].sort((a, b) => a.codigo.localeCompare(b.codigo));
  }, [
    armariosVisibles,
    estantesVisibles,
    inventario,
    selectedAlmacen,
    selectedArmario,
    catalogo.armariosPorAlmacen,
  ]);

  const listaContenedores = useMemo(() => {
    const map = new Map();
    const matchesFilters = (alm, arm) => {
      if (selectedAlmacen && alm !== selectedAlmacen) return false;
      if (selectedArmario && arm !== selectedArmario) return false;
      return true;
    };

    contenedores.forEach((c) => {
      if (!c.codigo) return;
      const alm = c.almacen || ALMACEN_DEFAULT;
      if (!matchesFilters(alm, c.armario)) return;
      map.set(c.codigo, {
        codigo: c.codigo,
        almacen: alm,
        armario: c.armario,
        estante: c.estante,
        contenedor: c.contenedor,
        nombre: c.ubicacion || c.codigo,
      });
    });
    inventario.forEach((i) => {
      const cod = i.contenedorCodigo;
      if (!cod) return;
      const alm = i.almacen || ALMACEN_DEFAULT;
      if (!matchesFilters(alm, i.armario)) return;
      if (!map.has(cod)) {
        map.set(cod, {
          codigo: cod,
          almacen: alm,
          armario: i.armario,
          estante: i.estante,
          contenedor: i.contenedor,
          nombre: cod,
        });
      }
    });
    return [...map.values()].sort((a, b) => String(a.codigo).localeCompare(String(b.codigo)));
  }, [contenedores, inventario, selectedAlmacen, selectedArmario]);

  const entries = useMemo(() => {
    switch (tab) {
      case QR_TYPES.ALMACEN:
        return listaAlmacenes.map((a) => ({
          key: `alm:${a.codigo}`,
          type: QR_TYPES.ALMACEN,
          codigo: a.codigo,
          titulo: a.codigo,
          subtitulo: a.nombre,
        }));
      case QR_TYPES.ARMARIO:
        return listaArmarios.map((a) => ({
          key: `arm:${a.almacen}:${a.armario}`,
          type: QR_TYPES.ARMARIO,
          codigo: a.codigo,
          titulo: a.codigo,
          subtitulo: a.nombre,
        }));
      case QR_TYPES.ESTANTE:
        return listaEstantes.map((e) => ({
          key: `est:${e.codigo}`,
          type: QR_TYPES.ESTANTE,
          codigo: e.codigo,
          titulo: e.codigo,
          subtitulo: e.nombre || e.codigo,
        }));
      case QR_TYPES.CONTENEDOR:
        return listaContenedores.map((c) => ({
          key: `cnt:${c.codigo}`,
          type: QR_TYPES.CONTENEDOR,
          codigo: c.codigo,
          titulo: c.codigo,
          subtitulo: c.nombre || c.codigo,
        }));
      case QR_TYPES.ITEM:
        return articulos.map((i) => ({
          key: `item:${i.itemId}`,
          type: QR_TYPES.ITEM,
          itemId: i.itemId,
          codigo: i.itemId,
          titulo: i.itemId,
          subtitulo: itemLinea(i),
        }));
      default:
        return [];
    }
  }, [tab, listaAlmacenes, listaArmarios, listaEstantes, listaContenedores, articulos]);

  const filteredEntries = useMemo(() => {
    if (tab === QR_TYPES.ITEM) {
      const q = filters.q.trim().toLowerCase();
      if (!q) return entries;
      return entries.filter(
        (e) =>
          e.itemId?.toLowerCase().includes(q) ||
          e.subtitulo?.toLowerCase().includes(q) ||
          e.titulo?.toLowerCase().includes(q)
      );
    }
    if (tab === QR_TYPES.ALMACEN && selectedAlmacen) {
      return entries.filter((e) => e.codigo === selectedAlmacen);
    }
    return entries;
  }, [entries, tab, filters.q, selectedAlmacen]);

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
    [QR_TYPES.ALMACEN]: 'Códigos ALM01, ALM02… (almacén completo).',
    [QR_TYPES.ARMARIO]: 'Códigos ALM02-A00, A01… (armario / estantería).',
    [QR_TYPES.ESTANTE]: 'Códigos ALM02-A00-E01 (estante sin contenedor).',
    [QR_TYPES.CONTENEDOR]: 'Códigos ALM02-A00-E01-C05, …-B12, …-H01 o …-SC.',
    [QR_TYPES.ITEM]: 'QR con item_id para identificar cada herramienta.',
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

      <div className="print:hidden">
        <SearchFilters
          filters={filters}
          onChange={(f) => setFilters((prev) => ({ ...prev, ...f }))}
          almacenes={almacenes}
          armariosPorAlmacen={catalogo.armariosPorAlmacen}
          tipos={tipos}
          variant={LOCATION_TABS.has(tab) ? 'ubicacion' : 'full'}
        />
      </div>

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
