import { siemensCatalogUrl } from '../utils/siemensCatalog';

/**
 * Muestra un código de artículo. Si coincide con MLFB Siemens, es un enlace al SiePortal.
 */
export default function CodigoCatalogoLink({ codigo, className = '', fallback = '—' }) {
  const raw = String(codigo || '').trim();
  if (!raw) return fallback;

  const url = siemensCatalogUrl(raw);
  const cls = ['font-mono', className].filter(Boolean).join(' ');
  if (!url) return <span className={cls}>{raw}</span>;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`${cls} text-accent underline decoration-accent/50 underline-offset-2 hover:decoration-accent`}
      title="Ficha técnica Siemens (SiePortal)"
    >
      {raw}
    </a>
  );
}
