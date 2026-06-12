import { useSync } from '../context/SyncContext';

export default function OfflineStatus() {
  const { isOnline, pendingCount, syncing, syncNow } = useSync();

  if (isOnline && pendingCount === 0) return null;

  return (
    <button
      type="button"
      onClick={syncNow}
      disabled={syncing || !isOnline}
      className={`w-full min-h-[44px] px-4 py-2 text-center text-sm font-bold ${
        !isOnline ? 'bg-accent text-accent-foreground' : 'bg-surface-muted text-accent'
      }`}
    >
      {syncing
        ? '⟳ Sincronizando...'
        : !isOnline
          ? 'Sin conexión - trabajando offline'
          : `${pendingCount} pendiente(s) · Tocá para sincronizar`}
    </button>
  );
}
