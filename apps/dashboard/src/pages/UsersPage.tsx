import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { CheckCircle2, LockKeyhole, Plus, UserRound } from 'lucide-react';
import type { AdminPermissionId, AdminPermissionsResponse, AdminSessionResponse, AdminUserSummary, Role } from '@afrows/shared';
import { createAdminUser, deleteAdminUser, fetchAdminPermissions, fetchAdminUsers, updateAdminUser, updateAdminUserPassword } from '../api/admin';
import { DashboardTabs, DataTable, PanelHeadingContent, PanelState, StatusBadge } from '../components/primitives';
import type { DashboardTabItem, DataTableColumn, Tone, UsersTab } from '../dashboard-types';
import type { DashboardFormatters } from '../formatters';
import type { DashboardStrings } from '../i18n';
import { canManageAdminUsers, managedAdminRoles } from '../session-access';
import { mutedTextClass, panelClass } from '../ui-classes';

export function UsersPage({
  format,
  session,
  sessionToken,
  t,
}: {
  format: DashboardFormatters;
  session: AdminSessionResponse;
  sessionToken: string;
  t: DashboardStrings;
}) {
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<Role>('admin');
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
  const [passwordDrafts, setPasswordDrafts] = useState<Record<string, string>>({});
  const [permissionPolicy, setPermissionPolicy] = useState<AdminPermissionsResponse | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [activeUsersTab, setActiveUsersTab] = useState<UsersTab>('adminUsers');
  const canManageUsers = canManageAdminUsers(session);

  const loadUsers = useMemo(() => async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetchAdminUsers(sessionToken, signal);
      setUsers(response.users);
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
      setError(t.userManagement.errors.load);
    } finally {
      setIsLoading(false);
    }
  }, [sessionToken, t]);

  useEffect(() => {
    const controller = new AbortController();
    void loadUsers(controller.signal);

    return () => controller.abort();
  }, [loadUsers]);

  const loadPermissions = useMemo(() => async (signal?: AbortSignal) => {
    setPermissionError(null);

    try {
      const response = await fetchAdminPermissions(sessionToken, signal);
      setPermissionPolicy(response);
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
      setPermissionError(t.rbac.errors.load);
    }
  }, [sessionToken, t]);

  useEffect(() => {
    const controller = new AbortController();
    void loadPermissions(controller.signal);

    return () => controller.abort();
  }, [loadPermissions]);

  const resetCreateForm = () => {
    setNewUsername('');
    setNewPassword('');
    setNewRole('admin');
  };

  const closeCreateForm = () => {
    setIsCreateFormOpen(false);
    resetCreateForm();
  };

  const handleCreateUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    try {
      const createdUser = await createAdminUser(sessionToken, {
        username: newUsername,
        password: newPassword,
        role: newRole,
        status: 'active',
      });
      setUsers((current) => [createdUser, ...current.filter((item) => item.id !== createdUser.id)]);
      closeCreateForm();
    } catch {
      setError(t.userManagement.errors.save);
    }
  };

  const handleToggleStatus = async (user: AdminUserSummary) => {
    setError(null);

    try {
      const updatedUser = await updateAdminUser(sessionToken, user.id, {
        status: user.status === 'active' ? 'disabled' : 'active',
      });
      setUsers((current) => current.map((item) => item.id === updatedUser.id ? updatedUser : item));
    } catch {
      setError(t.userManagement.errors.save);
    }
  };

  const handleDeleteUser = async (user: AdminUserSummary) => {
    setError(null);

    try {
      await deleteAdminUser(sessionToken, user.id);
      setUsers((current) => current.filter((item) => item.id !== user.id));
    } catch {
      setError(t.userManagement.errors.save);
    }
  };

  const handleChangePassword = async (user: AdminUserSummary) => {
    const password = passwordDrafts[user.id]?.trim();
    if (!password) return;
    setError(null);

    try {
      const updatedUser = await updateAdminUserPassword(sessionToken, user.id, { password });
      setUsers((current) => current.map((item) => item.id === updatedUser.id ? updatedUser : item));
      setPasswordDrafts((current) => ({ ...current, [user.id]: '' }));
    } catch {
      setError(t.userManagement.errors.save);
    }
  };
  const userTabs: Array<DashboardTabItem<UsersTab>> = [
    { id: 'adminUsers', label: t.tabs.adminUsers, meta: isLoading ? t.dataStatus.loading : format.integer(users.length) },
    { id: 'permissions', label: t.tabs.permissions, meta: permissionPolicy ? format.integer(permissionPolicy.permissions.length) : t.dataStatus.loading },
  ];
  const userTableColumns: Array<DataTableColumn<AdminUserSummary>> = [
    {
      key: 'username',
      header: t.userManagement.username,
      render: (user) => (
        <>
          <strong className="block text-afro-ink">{user.username}</strong>
          <span className="text-[12px] text-afro-muted">{format.time(new Date(user.updatedAt), false)}</span>
        </>
      ),
    },
    { key: 'role', header: t.userManagement.role, render: (user) => user.role },
    {
      key: 'status',
      header: t.userManagement.status,
      render: (user) => (
        <StatusBadge tone={user.status === 'active' ? 'good' : 'warning'}>
          {t.userManagement[user.status]}
        </StatusBadge>
      ),
    },
    { key: 'source', header: t.userManagement.source, render: (user) => t.userManagement[user.source] },
    {
      key: 'protection',
      header: t.userManagement.protection,
      render: (user) => (
        <StatusBadge tone={user.isSuperAdmin ? 'critical' : user.canDelete ? 'neutral' : 'warning'}>
          {user.isSuperAdmin ? t.userManagement.protected : user.canDelete ? t.userManagement.managed : t.userManagement.protected}
        </StatusBadge>
      ),
    },
    {
      key: 'actions',
      header: t.tables.actions,
      render: (user) => (
        <div className="flex min-w-[260px] flex-wrap justify-end gap-1.5">
          <button
            className="min-h-8 rounded-md border border-afro-line bg-white px-2 text-[12px] font-bold text-afro-ink disabled:cursor-not-allowed disabled:opacity-45"
            disabled={!canManageUsers || !user.canDisable}
            onClick={() => void handleToggleStatus(user)}
            type="button"
          >
            {user.status === 'active' ? t.actions.disable : t.actions.enable}
          </button>
          <button
            className="min-h-8 rounded-md border border-[#f0b7b7] bg-white px-2 text-[12px] font-bold text-[#b91c1c] disabled:cursor-not-allowed disabled:opacity-45"
            disabled={!canManageUsers || !user.canDelete}
            onClick={() => void handleDeleteUser(user)}
            type="button"
          >
            {t.actions.delete}
          </button>
          <input
            className="min-h-8 w-28 rounded-md border border-afro-line bg-white px-2 text-[12px] font-bold outline-none ring-afro-teal/20 focus:border-afro-teal focus:ring-2 disabled:opacity-45"
            disabled={!canManageUsers || !user.canChangePassword}
            onChange={(event) => setPasswordDrafts((current) => ({ ...current, [user.id]: event.target.value }))}
            placeholder={t.userManagement.newPassword}
            type="password"
            value={passwordDrafts[user.id] ?? ''}
          />
          <button
            className="min-h-8 rounded-md border border-afro-line bg-white px-2 text-[12px] font-bold text-afro-blue disabled:cursor-not-allowed disabled:opacity-45"
            disabled={!canManageUsers || !user.canChangePassword || !passwordDrafts[user.id]}
            onClick={() => void handleChangePassword(user)}
            type="button"
          >
            {t.actions.savePassword}
          </button>
        </div>
      ),
      alignRight: true,
    },
  ];

  return (
    <section className="mt-0 grid gap-3">
      <DashboardTabs activeTab={activeUsersTab} ariaLabel={t.tabs.usersSections} onChange={setActiveUsersTab} tabs={userTabs} />
      {activeUsersTab === 'adminUsers' && isCreateFormOpen ? (
        <section className={panelClass}>
          <div className="flex min-h-9 items-center justify-between gap-3 border-b border-afro-line pb-2">
            <PanelHeadingContent title={t.panels.createUser} meta={t.panels.protectedAccess} />
            <button
              className="inline-flex min-h-9 items-center justify-center rounded-md border border-afro-line bg-white px-3 text-[13px] font-bold text-afro-ink hover:border-afro-blue hover:text-afro-blue"
              onClick={closeCreateForm}
              type="button"
            >
              {t.actions.cancel}
            </button>
          </div>
          <form className="mt-2 grid gap-2 xl:grid-cols-[minmax(170px,1fr)_minmax(170px,1fr)_minmax(150px,0.7fr)_auto] xl:items-end" onSubmit={handleCreateUser}>
            <label className="grid gap-1.5">
              <span className={mutedTextClass}>{t.userManagement.username}</span>
              <input
                autoFocus
                className="min-h-10 rounded-md border border-afro-line bg-white px-3 text-sm font-bold outline-none ring-afro-teal/20 focus:border-afro-teal focus:ring-4 disabled:opacity-45"
                disabled={!canManageUsers}
                onChange={(event) => setNewUsername(event.target.value)}
                required
                type="text"
                value={newUsername}
              />
            </label>
            <label className="grid gap-1.5">
              <span className={mutedTextClass}>{t.userManagement.password}</span>
              <input
                className="min-h-10 rounded-md border border-afro-line bg-white px-3 text-sm font-bold outline-none ring-afro-teal/20 focus:border-afro-teal focus:ring-4 disabled:opacity-45"
                disabled={!canManageUsers}
                minLength={8}
                onChange={(event) => setNewPassword(event.target.value)}
                required
                type="password"
                value={newPassword}
              />
            </label>
            <label className="grid gap-1.5">
              <span className={mutedTextClass}>{t.userManagement.role}</span>
              <select
                className="min-h-10 rounded-md border border-afro-line bg-white px-3 text-sm font-bold outline-none ring-afro-teal/20 focus:border-afro-teal focus:ring-4 disabled:opacity-45"
                disabled={!canManageUsers}
                onChange={(event) => setNewRole(event.target.value as Role)}
                value={newRole}
              >
                {managedAdminRoles.map((role) => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </label>
            <button
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-afro-sidebar px-4 text-sm font-bold text-white hover:bg-[#1f3138] disabled:cursor-not-allowed disabled:opacity-45"
              disabled={!canManageUsers}
              type="submit"
            >
              <UserRound size={16} />
              {t.actions.create}
            </button>
          </form>
        </section>
      ) : null}

      {activeUsersTab === 'adminUsers' ? (
      <section className={panelClass}>
        <div className="flex min-h-9 flex-col gap-2 border-b border-afro-line pb-2 sm:flex-row sm:items-center sm:justify-between">
          <PanelHeadingContent
            title={t.panels.adminUsers}
            meta={isLoading ? t.dataStatus.loading : t.userManagement.usersLoaded(format.integer(users.length))}
          />
          <button
            className="inline-flex min-h-9 w-fit items-center justify-center gap-2 rounded-md bg-afro-sidebar px-3 text-[13px] font-bold text-white hover:bg-[#1f3138] disabled:cursor-not-allowed disabled:opacity-45"
            disabled={!canManageUsers}
            onClick={() => setIsCreateFormOpen((current) => !current)}
            type="button"
          >
            <Plus size={15} />
            {t.actions.addUser}
          </button>
        </div>
        <div className="mt-2 grid gap-2">
          {error ? <PanelState detail={error} kind="error" title={t.panelStates.errorTitle} /> : null}
          {isLoading && users.length === 0 ? <PanelState detail={t.panelStates.loadingDetail} kind="loading" title={t.panelStates.loadingTitle} /> : null}
          {!isLoading && users.length === 0 && !error ? (
            <PanelState detail={t.panelStates.emptyDetail} kind="empty" title={t.operationalData.noUsers} />
          ) : null}
          {users.length > 0 ? <DataTable columns={userTableColumns} minWidth="880px" rowKey={(user) => user.id} rows={users} /> : null}
        </div>
      </section>
      ) : null}
      {activeUsersTab === 'permissions' ? <RolePermissionsPanel format={format} policy={permissionPolicy} error={permissionError} t={t} /> : null}
    </section>
  );
}

function RolePermissionsPanel({
  error,
  format,
  policy,
  t,
}: {
  error: string | null;
  format: DashboardFormatters;
  policy: AdminPermissionsResponse | null;
  t: DashboardStrings;
}) {
  const permissionCount = policy ? format.integer(policy.permissions.length) : t.dataStatus.loading;
  const currentRole = policy?.currentRole ?? t.dataStatus.loading;
  const currentAccess = policy?.currentHasFullAccess ? t.rbac.fullAccess : format.integer(policy?.currentPermissions.length ?? 0);
  const permissionColumns: Array<DataTableColumn<AdminPermissionsResponse['permissions'][number]>> = policy ? [
    {
      key: 'permission',
      header: t.rbac.permission,
      render: (permission) => (
        <>
          <strong className="block text-afro-ink">{permissionLabel(permission.id, t)}</strong>
          <span className="text-[12px] text-afro-muted">{permission.id}</span>
        </>
      ),
    },
    {
      key: 'category',
      header: t.rbac.category,
      render: (permission) => t.rbac.categories[permission.category],
    },
    {
      key: 'risk',
      header: t.rbac.risk,
      render: (permission) => <StatusBadge tone={permissionRiskTone(permission.risk)}>{t.rbac.risks[permission.risk]}</StatusBadge>,
    },
    ...policy.roles.map((role): DataTableColumn<AdminPermissionsResponse['permissions'][number]> => ({
      align: 'center',
      key: `role:${role.role}`,
      header: role.role,
      render: (permission) => {
        const allowed = role.inheritsAll || role.permissions.includes(permission.id);

        return (
          <span
            className={`inline-grid size-7 place-items-center rounded-md border ${allowed ? 'border-[#bbdec8] bg-[#eefbf2] text-[#166534]' : 'border-afro-line bg-[#f8fafb] text-afro-muted'}`}
            title={allowed ? t.rbac.allowed : t.rbac.blocked}
          >
            {allowed ? <CheckCircle2 size={15} /> : <LockKeyhole size={15} />}
          </span>
        );
      },
    })),
  ] : [];

  return (
    <section className={panelClass}>
      <div className="flex min-h-9 flex-col gap-2 border-b border-afro-line pb-2 sm:flex-row sm:items-center sm:justify-between">
        <PanelHeadingContent title={t.panels.rolePermissions} meta={t.rbac.permissionsLoaded(permissionCount)} />
        <StatusBadge tone={policy?.deniedByDefault ? 'good' : 'warning'}>{t.rbac.deniedByDefault}</StatusBadge>
      </div>
      <div className="mt-2 grid gap-2 md:grid-cols-3">
        <div className="rounded-md border border-afro-line bg-white px-3 py-2">
          <span className={mutedTextClass}>{t.rbac.currentRole}</span>
          <strong className="mt-1 block text-sm text-afro-ink">{currentRole}</strong>
        </div>
        <div className="rounded-md border border-afro-line bg-white px-3 py-2">
          <span className={mutedTextClass}>{t.rbac.currentPermissions}</span>
          <strong className="mt-1 block text-sm text-afro-ink">{currentAccess}</strong>
        </div>
        <div className="rounded-md border border-afro-line bg-white px-3 py-2">
          <span className={mutedTextClass}>{t.rbac.policy}</span>
          <strong className="mt-1 block text-sm text-afro-ink">{t.rbac.roleGuarded}</strong>
        </div>
      </div>
      <div className="mt-2 grid gap-2">
        {error ? <PanelState detail={error} kind="error" title={t.panelStates.errorTitle} /> : null}
        {!policy && !error ? <PanelState detail={t.panelStates.loadingDetail} kind="loading" title={t.panelStates.loadingTitle} /> : null}
        {policy ? <DataTable columns={permissionColumns} minWidth="980px" rowKey={(permission) => permission.id} rows={policy.permissions} /> : null}
      </div>
    </section>
  );
}

function permissionLabel(permissionId: AdminPermissionId, t: DashboardStrings): string {
  return t.rbac.permissions[permissionId] ?? permissionId;
}

function permissionRiskTone(risk: AdminPermissionsResponse['permissions'][number]['risk']): Tone {
  if (risk === 'critical') return 'critical';
  if (risk === 'high') return 'warning';
  if (risk === 'medium') return 'neutral';

  return 'good';
}
