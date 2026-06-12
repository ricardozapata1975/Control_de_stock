export default function PaginationBar({
  page,
  totalPages,
  onPrev,
  onNext,
  prevDisabled,
  nextDisabled,
}) {
  const isPrevDisabled = prevDisabled ?? page <= 1;
  const isNextDisabled = nextDisabled ?? (page >= totalPages || totalPages === 0);

  return (
    <nav
      className="flex items-center justify-center gap-3 py-2"
      aria-label="Paginación del inventario"
    >
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
    </nav>
  );
}
