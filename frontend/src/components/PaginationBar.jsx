const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export default function PaginationBar({
  page,
  totalPages,
  onPrev,
  onNext,
  prevDisabled,
  nextDisabled,
  pageSize,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  onPageSizeChange,
  totalItems,
}) {
  const isPrevDisabled = prevDisabled ?? page <= 1;
  const isNextDisabled = nextDisabled ?? (page >= totalPages || totalPages === 0);
  const showPageSize = pageSize != null && onPageSizeChange;

  return (
    <nav
      className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 py-2"
      aria-label="Paginación del inventario"
    >
      {showPageSize && (
        <label className="flex min-h-[44px] items-center gap-2 text-sm font-medium text-content-muted">
          <span className="whitespace-nowrap">Mostrar:</span>
          <select
            className="input-field min-h-[44px] w-auto min-w-[4.5rem] py-2 text-base"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            aria-label="Cantidad de filas por página"
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-border bg-surface-muted px-3 text-lg font-semibold text-content transition hover:bg-surface-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          onClick={onPrev}
          disabled={isPrevDisabled}
          aria-label="Página anterior"
        >
          &lt;
        </button>
        <span className="min-w-[5.5rem] text-center text-sm font-medium text-content-muted">
          {page} de {Math.max(totalPages, 1)}
          {totalItems != null && (
            <span className="mt-0.5 block text-xs text-subtle">
              {totalItems} ítem{totalItems !== 1 ? 's' : ''}
            </span>
          )}
        </span>
        <button
          type="button"
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-border bg-surface-muted px-3 text-lg font-semibold text-content transition hover:bg-surface-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          onClick={onNext}
          disabled={isNextDisabled}
          aria-label="Página siguiente"
        >
          &gt;
        </button>
      </div>
    </nav>
  );
}
