/** Miniatura de ítem: foto o iniciales (listado e inventario). */
export default function ItemThumb({ item, size = 'md', className = '' }) {
  const sizeClass = size === 'lg' ? 'h-14 w-14 text-xs' : 'h-11 w-11 text-[10px]';
  const initials = String(item?.nombre || '?')
    .trim()
    .slice(0, 2)
    .toUpperCase();

  if (item?.imagenUrl) {
    return (
      <img
        src={item.imagenUrl}
        alt=""
        className={`${sizeClass} shrink-0 rounded-md object-cover bg-slate-900 ring-1 ring-border ${className}`}
        loading="lazy"
      />
    );
  }

  return (
    <div
      className={`flex ${sizeClass} shrink-0 items-center justify-center rounded-md bg-surface-muted font-bold uppercase text-subtle ring-1 ring-border ${className}`}
      aria-hidden
    >
      {initials}
    </div>
  );
}
