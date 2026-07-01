import { normalizeRole } from '../../utils/role';
import UserIconButton from './UserIconButton';

const ROLE_LABELS = {
  admin: 'Administrador',
  operario: 'Operario',
};

function passwordLabel(user) {
  if (!user.hasPassword) return 'Pendiente';
  if (user.mustChangePassword) return 'Cambiar';
  return 'OK';
}

function displayName(user) {
  return user.name || user.displayName || '';
}

function UserActions({
  user,
  currentUserId,
  canInvite,
  sendingWelcomeId,
  bulkSending,
  deletingUserId,
  onSendWelcome,
  onToggleActive,
  onResetPassword,
  onDelete,
}) {
  const inviteDisabled =
    !canInvite || sendingWelcomeId === user.id || bulkSending || !user.email;
  const deleteDisabled = deletingUserId === user.id || user.id === currentUserId;
  const deleteTitle =
    user.id === currentUserId ? 'No podés eliminar tu propia cuenta' : 'Eliminar';

  return (
    <div className="flex items-center gap-1">
      {user.email && (
        <UserIconButton
          title="Enviar invitación"
          variant="sky"
          onClick={() => onSendWelcome(user)}
          disabled={inviteDisabled}
        >
          {sendingWelcomeId === user.id ? (
            <span className="text-[10px] font-bold">…</span>
          ) : (
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          )}
        </UserIconButton>
      )}
      <UserIconButton
        title={user.isActive ? 'Desactivar' : 'Activar'}
        onClick={() => onToggleActive(user)}
      >
        {user.isActive ? (
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
        ) : (
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
      </UserIconButton>
      <UserIconButton title="Resetear clave" variant="amber" onClick={() => onResetPassword(user)}>
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
        </svg>
      </UserIconButton>
      <UserIconButton
        title={deleteTitle}
        variant="danger"
        onClick={() => onDelete(user)}
        disabled={deleteDisabled}
      >
        {deletingUserId === user.id ? (
          <span className="text-[10px] font-bold">…</span>
        ) : (
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        )}
      </UserIconButton>
    </div>
  );
}

function StatusBadge({ isActive }) {
  return (
    <span
      className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold leading-none ${
        isActive ? 'bg-emerald-800 text-emerald-100' : 'bg-red-900 text-red-100'
      }`}
    >
      {isActive ? 'Activo' : 'Inact.'}
    </span>
  );
}

function RoleSelect({ user, onUpdateRole }) {
  return (
    <select
      className="select-field-compact max-w-full"
      value={normalizeRole(user.role)}
      onChange={(e) => onUpdateRole(user, e.target.value, e.target)}
      aria-label={`Cambiar rol de ${user.username}`}
      title={ROLE_LABELS[normalizeRole(user.role)]}
    >
      <option value="operario">Oper.</option>
      <option value="admin">Admin</option>
    </select>
  );
}

function CheckboxCell({ user, canInvite, selected, bulkSending, onToggleSelect }) {
  if (!canInvite) {
    return <span className="inline-block h-4 w-4" aria-hidden="true" />;
  }
  return (
    <input
      type="checkbox"
      checked={selected}
      onChange={() => onToggleSelect(user.id)}
      disabled={bulkSending}
      className="h-4 w-4 accent-accent disabled:cursor-not-allowed disabled:opacity-50"
      aria-label={`Seleccionar ${user.username} para invitación`}
    />
  );
}

export function UserRowTable({
  user,
  canInvite,
  selected,
  bulkSending,
  currentUserId,
  sendingWelcomeId,
  deletingUserId,
  onToggleSelect,
  onSendWelcome,
  onToggleActive,
  onResetPassword,
  onDelete,
  onUpdateRole,
}) {
  const name = displayName(user);
  const lastLogin = user.lastLoginAt
    ? new Date(user.lastLoginAt).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
    : null;
  const userTitle = [user.username, name, lastLogin ? `Último ingreso: ${lastLogin}` : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <tr className="table-row text-xs">
      <td className="w-8 px-1.5 py-1.5 text-center">
        <CheckboxCell
          user={user}
          canInvite={canInvite}
          selected={selected}
          bulkSending={bulkSending}
          onToggleSelect={onToggleSelect}
        />
      </td>
      <td className="max-w-[7rem] px-2 py-1.5" title={userTitle}>
        <div className="truncate font-mono text-accent">{user.username}</div>
        {name ? <div className="truncate text-[10px] text-subtle">{name}</div> : null}
      </td>
      <td className="max-w-[8rem] truncate px-2 py-1.5 text-subtle" title={user.email || undefined}>
        {user.email || '—'}
      </td>
      <td className="w-[4.5rem] px-1.5 py-1.5">
        <RoleSelect user={user} onUpdateRole={onUpdateRole} />
      </td>
      <td className="w-14 px-1.5 py-1.5">
        <StatusBadge isActive={user.isActive} />
      </td>
      <td
        className="hidden w-16 px-1.5 py-1.5 text-subtle sm:table-cell"
        title={passwordLabel(user)}
      >
        <span className="truncate">{passwordLabel(user)}</span>
      </td>
      <td className="px-1.5 py-1.5">
        <UserActions
          user={user}
          currentUserId={currentUserId}
          canInvite={canInvite}
          sendingWelcomeId={sendingWelcomeId}
          bulkSending={bulkSending}
          deletingUserId={deletingUserId}
          onSendWelcome={onSendWelcome}
          onToggleActive={onToggleActive}
          onResetPassword={onResetPassword}
          onDelete={onDelete}
        />
      </td>
    </tr>
  );
}

export function UserRowCard({
  user,
  canInvite,
  selected,
  bulkSending,
  currentUserId,
  sendingWelcomeId,
  deletingUserId,
  onToggleSelect,
  onSendWelcome,
  onToggleActive,
  onResetPassword,
  onDelete,
  onUpdateRole,
}) {
  const name = displayName(user);

  return (
    <article className="rounded-lg border border-border bg-surface-muted/30 p-3 text-sm">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-accent" title={user.username}>
            {user.username}
          </p>
          {name ? (
            <p className="truncate text-xs text-subtle" title={name}>
              {name}
            </p>
          ) : null}
          <p className="truncate text-xs text-subtle" title={user.email || undefined}>
            {user.email || 'Sin correo'}
          </p>
        </div>
        {canInvite ? (
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(user.id)}
            disabled={bulkSending}
            className="mt-0.5 h-4 w-4 shrink-0 accent-accent"
            aria-label={`Seleccionar ${user.username}`}
          />
        ) : null}
      </div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <RoleSelect user={user} onUpdateRole={onUpdateRole} />
        <StatusBadge isActive={user.isActive} />
        <span className="text-[10px] text-subtle" title="Estado de contraseña">
          Clave: {passwordLabel(user)}
        </span>
      </div>
      <UserActions
        user={user}
        currentUserId={currentUserId}
        canInvite={canInvite}
        sendingWelcomeId={sendingWelcomeId}
        bulkSending={bulkSending}
        deletingUserId={deletingUserId}
        onSendWelcome={onSendWelcome}
        onToggleActive={onToggleActive}
        onResetPassword={onResetPassword}
        onDelete={onDelete}
      />
    </article>
  );
}
