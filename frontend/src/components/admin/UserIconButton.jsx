export default function UserIconButton({
  title,
  onClick,
  disabled = false,
  variant = 'default',
  children,
}) {
  const variants = {
    default: 'border-border text-content-muted hover:bg-surface-hover',
    sky: 'border-sky-700/60 text-sky-300 hover:bg-sky-950/50',
    amber: 'border-amber-700/60 text-amber-300 hover:bg-amber-950/50',
    danger: 'border-red-700/60 text-red-300 hover:bg-red-950/50',
  };

  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded border transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${variants[variant] || variants.default}`}
    >
      {children}
    </button>
  );
}
