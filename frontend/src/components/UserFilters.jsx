const PRESET_DOMAINS = ['@systelec.com', '@pxcontrol.com'];

function normalizeDomain(value) {
  const v = String(value || '').trim().toLowerCase();
  if (!v) return '';
  return v.startsWith('@') ? v : `@${v}`;
}

export default function UserFilters({ filters, onChange, domains = [] }) {
  const chipDomains = [...new Set([...PRESET_DOMAINS, ...domains.map(normalizeDomain).filter(Boolean)])];

  const setDomain = (domain) => {
    const next = normalizeDomain(domain);
    onChange({ domain: filters.domain === next ? '' : next });
  };

  return (
    <div className="card mb-4 space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="text-label">Buscar</label>
          <input
            className="input-field"
            placeholder="Nombre, usuario, correo..."
            value={filters.q}
            onChange={(e) => onChange({ q: e.target.value })}
          />
        </div>
        <div>
          <label className="text-label">Estado</label>
          <select
            className="input-field"
            value={filters.status}
            onChange={(e) => onChange({ status: e.target.value })}
          >
            <option value="all">Todos</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
          </select>
        </div>
        <div>
          <label className="text-label">Dominio de correo</label>
          <input
            className="input-field"
            placeholder="@empresa.com"
            value={filters.domain}
            onChange={(e) => onChange({ domain: e.target.value })}
          />
        </div>
      </div>
      {chipDomains.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-content-muted">Filtro rápido:</span>
          {chipDomains.map((domain) => {
            const active = normalizeDomain(filters.domain) === domain;
            return (
              <button
                key={domain}
                type="button"
                className={`min-h-[36px] rounded-full border px-3 py-1 text-xs font-semibold transition active:scale-[0.98] ${
                  active
                    ? 'border-accent bg-accent/15 text-accent'
                    : 'border-border bg-surface-muted/60 text-content-muted hover:bg-surface-hover'
                }`}
                onClick={() => setDomain(domain)}
              >
                {domain}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
