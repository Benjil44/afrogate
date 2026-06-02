import { useEffect, useState, type FormEvent } from 'react';
import { Cpu, HardDrive, MemoryStick, Server, ShieldCheck } from 'lucide-react';
import type { AdminServerDetail, AdminServerInterfaceSummary, AdminSessionResponse, AdminTunnelSummary, ServerAccessMethod, ServerBootstrapState, ServerCredentialKind } from '@afrogate/shared';
import { fetchAdminServer, fetchAdminServerInterfaces, fetchAdminTunnels, storeAdminServerCredential, updateAdminServer } from '../api/admin';
import { DataStateEmpty, DataStateNotice, DetailRow, EmptyState, PanelHeading, StatusBadge, UsageBar } from '../components/primitives';
import type { DataState, ServerEditTab, ServerRowData } from '../dashboard-types';
import type { DashboardFormatters } from '../formatters';
import type { DashboardStrings } from '../i18n';
import { mapAdminServerToServerRow } from '../mappers';
import { formatWireGuardHandshake, formatWireGuardPeerSummary, inventoryStatusLabel, inventoryStatusTone, isServerAccessMethod, isServerBootstrapState, isServerCredentialKind, summarizeRouteProbes, summarizeWireGuardInterfaces, wireGuardStatusLabel, wireGuardTone } from '../server-helpers';
import { getScoreClass, serverAccessReady } from '../tone';
import { fieldInputClass, fieldLabelClass, mutedTextClass, panelClass, primaryButtonClass } from '../ui-classes';

export function ServersPage({
  dataState,
  format,
  onServerUpdated,
  servers,
  session,
  sessionToken,
  t,
}: {
  dataState: DataState;
  format: DashboardFormatters;
  onServerUpdated: (server: AdminServerDetail) => void;
  servers: ServerRowData[];
  session: AdminSessionResponse;
  sessionToken: string;
  t: DashboardStrings;
}) {
  const [selectedServerId, setSelectedServerId] = useState<string | null>(() => servers[0]?.id ?? null);

  useEffect(() => {
    if (servers.length === 0) {
      setSelectedServerId(null);
      return;
    }

    if (!selectedServerId || !servers.some((server) => server.id === selectedServerId)) {
      setSelectedServerId(servers[0].id);
    }
  }, [selectedServerId, servers]);

  const selectedServerIndex = Math.max(0, servers.findIndex((server) => server.id === selectedServerId));
  const selectedServer = servers[selectedServerIndex] ?? null;

  return (
    <section className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
      <section className={panelClass}>
        <PanelHeading title={t.panels.serverInventory} icon={Server} meta={t.panels.managedNodes(format.integer(servers.length))} />
        <div className="mt-2 grid gap-2.5">
          {servers.length > 0 && dataState !== 'live' ? <DataStateNotice state={dataState} t={t} /> : null}
          {servers.length === 0 ? <DataStateEmpty emptyMessage={t.operationalData.noServers} state={dataState} t={t} /> : null}
          {servers.map((server, index) => (
            <ServerManagementCard
              format={format}
              index={index}
              isSelected={server.id === selectedServerId}
              key={server.id}
              onEdit={() => setSelectedServerId(server.id)}
              server={server}
              t={t}
            />
          ))}
        </div>
      </section>

      <ServerEditPanel
        format={format}
        onServerUpdated={onServerUpdated}
        server={selectedServer}
        serverIndex={selectedServerIndex}
        session={session}
        sessionToken={sessionToken}
        t={t}
      />
    </section>
  );
}

function getServerInterfaces(index: number): string[] {
  return index === 0
    ? ['ether1 / Mobinnet / wg1', 'ether2 / Irancell / wireguard2']
    : index === 1
      ? ['ether5 / Irancell / wireguard3']
      : ['core uplink / Germany / gateway'];
}

function ServerManagementCard({
  format,
  index,
  isSelected,
  onEdit,
  server,
  t,
}: {
  format: DashboardFormatters;
  index: number;
  isSelected: boolean;
  onEdit: () => void;
  server: ServerRowData;
  t: DashboardStrings;
}) {
  const interfaces = getServerInterfaces(index);
  const selectedClass = isSelected ? 'border-afro-blue ring-2 ring-afro-blue/15' : 'border-afro-line';

  return (
    <article className={`rounded-md border p-2.5 ${selectedClass}`}>
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <strong className="min-w-0 truncate text-base">{format.label(server.name)}</strong>
          <span className={`${mutedTextClass} shrink-0`}>{format.label(server.meta)}</span>
        </div>
        <button
          className="min-h-8 rounded-md border border-afro-line bg-white px-2.5 text-[13px] font-bold text-afro-ink hover:border-afro-blue hover:text-afro-blue"
          onClick={onEdit}
          type="button"
        >
          {t.actions.edit}
        </button>
      </div>

      <div className="mt-2.5 grid gap-2 sm:grid-cols-3">
        <UsageBar format={format} icon={Cpu} label={t.resources.cpu} value={server.cpu} />
        <UsageBar format={format} icon={MemoryStick} label={t.resources.ram} value={server.ram} />
        <UsageBar format={format} icon={HardDrive} label={t.resources.diskFree} value={server.diskFree} invert />
      </div>

      <div className="mt-2.5 grid gap-2 sm:grid-cols-[1fr_auto]">
        <div className="grid gap-1.5">
          {interfaces.map((item) => (
            <span className="rounded-md bg-[#eef3f5] px-2 py-1 text-[12px] text-afro-muted" key={item}>
              {format.label(item)}
            </span>
          ))}
        </div>
        <div className="text-left sm:text-right">
          <span className={mutedTextClass}>{t.resources.health}</span>
          <b className={`block text-[20px] ${getScoreClass(server.score)}`}>{format.integer(server.score)}</b>
        </div>
      </div>
    </article>
  );
}

function ServerEditPanel({
  format,
  onServerUpdated,
  server,
  serverIndex,
  session,
  sessionToken,
  t,
}: {
  format: DashboardFormatters;
  onServerUpdated: (server: AdminServerDetail) => void;
  server: ServerRowData | null;
  serverIndex: number;
  session: AdminSessionResponse;
  sessionToken: string;
  t: DashboardStrings;
}) {
  const [activeTab, setActiveTab] = useState<ServerEditTab>('overview');
  const [serverDetail, setServerDetail] = useState<AdminServerDetail | null>(null);
  const [inventoryInterfaces, setInventoryInterfaces] = useState<AdminServerInterfaceSummary[]>([]);
  const [inventoryTunnels, setInventoryTunnels] = useState<AdminTunnelSummary[]>([]);
  const [detailDataState, setDetailDataState] = useState<DataState>('loading');

  useEffect(() => {
    let isActive = true;
    const controller = new AbortController();

    setServerDetail(null);
    setInventoryInterfaces([]);
    setInventoryTunnels([]);

    if (!server) {
      setDetailDataState('fallback');
      return () => {
        isActive = false;
        controller.abort();
      };
    }

    if (server.source !== 'admin') {
      setDetailDataState('fallback');
      return () => {
        isActive = false;
        controller.abort();
      };
    }

    setDetailDataState('loading');

    Promise.all([
      fetchAdminServer(sessionToken, server.id, controller.signal),
      fetchAdminServerInterfaces(sessionToken, server.id, controller.signal).catch(() => ({ interfaces: [] })),
      fetchAdminTunnels(sessionToken, server.id, undefined, 100, controller.signal).catch(() => ({ tunnels: [] })),
    ])
      .then(([detail, interfaceResponse, tunnelResponse]) => {
        if (!isActive) return;

        setServerDetail(detail);
        setInventoryInterfaces(interfaceResponse.interfaces);
        setInventoryTunnels(tunnelResponse.tunnels);
        setDetailDataState('live');
        onServerUpdated(detail);
      })
      .catch((error) => {
        if (!isActive || (error instanceof DOMException && error.name === 'AbortError')) return;

        setDetailDataState('fallback');
      });

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [server?.id, server?.source, sessionToken]);

  if (!server) {
    return (
      <section className={panelClass}>
        <PanelHeading title={t.panels.serverDetail} icon={ShieldCheck} meta={t.serverEdit.noServer} />
        <div className="mt-2">
          <EmptyState message={t.serverEdit.noServer} />
        </div>
      </section>
    );
  }

  const detailedServer = serverDetail ? mapAdminServerToServerRow(serverDetail) : null;
  const activeServer = detailedServer ?? server;
  const interfaces = getServerInterfaces(serverIndex);
  const tabs: Array<{ id: ServerEditTab; label: string }> = [
    { id: 'overview', label: t.serverEdit.tabs.overview },
    { id: 'access', label: t.serverEdit.tabs.access },
    { id: 'monitoring', label: t.serverEdit.tabs.monitoring },
    { id: 'interfaces', label: t.serverEdit.tabs.interfaces },
    { id: 'audit', label: t.serverEdit.tabs.audit },
  ];

  return (
    <section className={panelClass}>
      <PanelHeading
        title={t.panels.serverDetail}
        icon={ShieldCheck}
        meta={detailDataState === 'loading' ? t.dataStatus.loading : format.label(activeServer.name)}
      />
      {detailDataState !== 'live' ? (
        <div className="mt-2">
          <DataStateNotice state={detailDataState} t={t} />
        </div>
      ) : null}
      <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-5">
        {tabs.map((tab) => {
          const activeClass = activeTab === tab.id
            ? 'border-afro-blue bg-[#edf4ff] text-afro-blue'
            : 'border-afro-line bg-white text-afro-muted hover:border-afro-blue hover:text-afro-blue';

          return (
            <button
              className={`min-h-9 rounded-md border px-2 text-[12px] font-bold ${activeClass}`}
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              type="button"
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="mt-2">
        {activeTab === 'overview' ? (
          <ServerOverviewTab
            detailDataState={detailDataState}
            format={format}
            inventoryInterfaces={inventoryInterfaces}
            inventoryTunnels={inventoryTunnels}
            server={activeServer}
            serverDetail={serverDetail}
            t={t}
          />
        ) : null}
        {activeTab === 'access' ? (
          <ServerAccessTab
            onServerUpdated={onServerUpdated}
            server={activeServer}
            session={session}
            sessionToken={sessionToken}
            t={t}
          />
        ) : null}
        {activeTab === 'monitoring' ? <ServerMonitoringTab format={format} server={activeServer} t={t} /> : null}
        {activeTab === 'interfaces' ? (
          <ServerInterfacesTab
            detailDataState={detailDataState}
            format={format}
            interfaces={interfaces}
            inventoryInterfaces={inventoryInterfaces}
            inventoryTunnels={inventoryTunnels}
            server={activeServer}
            t={t}
          />
        ) : null}
        {activeTab === 'audit' ? <ServerAuditTab detailDataState={detailDataState} format={format} server={activeServer} t={t} /> : null}
      </div>
    </section>
  );
}

function ServerOverviewTab({
  detailDataState,
  format,
  inventoryInterfaces,
  inventoryTunnels,
  server,
  serverDetail,
  t,
}: {
  detailDataState: DataState;
  format: DashboardFormatters;
  inventoryInterfaces: AdminServerInterfaceSummary[];
  inventoryTunnels: AdminTunnelSummary[];
  server: ServerRowData;
  serverDetail: AdminServerDetail | null;
  t: DashboardStrings;
}) {
  const outboundsCount = serverDetail?.outbounds.length ?? server.outboundCount ?? 0;
  const openAlertCount = server.openAlertCount ?? 0;
  const inventorySummary = t.serverEdit.values.interfaceTunnelSummary(
    format.integer(inventoryInterfaces.length),
    format.integer(inventoryTunnels.length),
  );
  const accessReady = serverAccessReady(server);

  return (
    <div className="grid gap-2">
      <DetailRow label={t.serverEdit.labels.country}>{format.label(server.meta)}</DetailRow>
      <DetailRow label={t.serverEdit.labels.externalId}>{server.externalId ?? server.id}</DetailRow>
      <DetailRow label={t.serverEdit.labels.status}>
        <StatusBadge tone={server.score >= 70 ? 'good' : server.score >= 50 ? 'warning' : 'critical'}>
          {server.score >= 70 ? t.status.healthy : server.score >= 50 ? t.status.warning : t.status.critical}
        </StatusBadge>
      </DetailRow>
      <DetailRow label={t.serverEdit.labels.role}>
        {server.role ? format.label(server.role) : server.name.toLowerCase().includes('core') ? t.serverEdit.values.gatewayNode : t.serverEdit.values.edgeNode}
      </DetailRow>
      <DetailRow label={t.serverEdit.labels.routeGroup}>{t.serverEdit.values.routeGroupMain}</DetailRow>
      <DetailRow label={t.serverEdit.labels.lastSeen}>
        {server.observedAt ? format.time(new Date(server.observedAt), false) : t.serverEdit.values.localSample}
      </DetailRow>
      <DetailRow label={t.serverEdit.labels.healthScore}>{format.integer(server.score)}</DetailRow>
      <DetailRow label={t.serverEdit.labels.outbounds}>{format.integer(outboundsCount)}</DetailRow>
      <DetailRow label={t.serverEdit.labels.openAlerts}>{format.integer(openAlertCount)}</DetailRow>
      <DetailRow label={t.serverEdit.labels.inventory}>{inventorySummary}</DetailRow>
      <DetailRow label={t.serverEdit.labels.accessReadiness}>
        <StatusBadge tone={accessReady ? 'good' : 'warning'}>
          {accessReady ? t.settings.accessReady : t.settings.accessPending}
        </StatusBadge>
      </DetailRow>
      <DetailRow label={t.serverEdit.labels.tags}>{server.tags?.length ? server.tags.map(format.label).join(', ') : t.serverEdit.values.none}</DetailRow>
      <DetailRow label={t.serverEdit.labels.detailSource}>
        {detailDataState === 'live' ? t.serverEdit.values.apiDetail : detailDataState === 'loading' ? t.dataStatus.loading : t.serverEdit.values.fallbackDetail}
      </DetailRow>
    </div>
  );
}

function ServerAccessTab({
  onServerUpdated,
  server,
  session,
  sessionToken,
  t,
}: {
  onServerUpdated: (server: AdminServerDetail) => void;
  server: ServerRowData;
  session: AdminSessionResponse;
  sessionToken: string;
  t: DashboardStrings;
}) {
  const profile = server.accessProfile;
  const canManageAccess = server.source === 'admin' && ['superadmin', 'owner', 'admin'].includes(session.actor.role);
  const [address, setAddress] = useState(profile?.address ?? server.externalId ?? server.name);
  const [sshPort, setSshPort] = useState(String(profile?.sshPort ?? 22));
  const [username, setUsername] = useState(profile?.username ?? 'afrogate');
  const [accessMethod, setAccessMethod] = useState<ServerAccessMethod>(
    isServerAccessMethod(profile?.accessMethod) ? profile.accessMethod : 'ssh_key',
  );
  const [bootstrapState, setBootstrapState] = useState<ServerBootstrapState>(
    isServerBootstrapState(profile?.bootstrapState) ? profile.bootstrapState : 'not_started',
  );
  const [notes, setNotes] = useState(profile?.notes ?? '');
  const [credentialName, setCredentialName] = useState(profile?.credentialName ?? `${server.name} SSH`);
  const [credentialKind, setCredentialKind] = useState<ServerCredentialKind>(
    isServerCredentialKind(profile?.credentialKind) ? profile.credentialKind : 'ssh_private_key',
  );
  const [credentialSecret, setCredentialSecret] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isStoringCredential, setIsStoringCredential] = useState(false);
  const [accessMessage, setAccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setAddress(profile?.address ?? server.externalId ?? server.name);
    setSshPort(String(profile?.sshPort ?? 22));
    setUsername(profile?.username ?? 'afrogate');
    setAccessMethod(isServerAccessMethod(profile?.accessMethod) ? profile.accessMethod : 'ssh_key');
    setBootstrapState(isServerBootstrapState(profile?.bootstrapState) ? profile.bootstrapState : 'not_started');
    setNotes(profile?.notes ?? '');
    setCredentialName(profile?.credentialName ?? `${server.name} SSH`);
    setCredentialKind(isServerCredentialKind(profile?.credentialKind) ? profile.credentialKind : 'ssh_private_key');
    setCredentialSecret('');
    setAccessMessage(null);
  }, [
    profile?.accessMethod,
    profile?.address,
    profile?.bootstrapState,
    profile?.credentialKind,
    profile?.credentialName,
    profile?.notes,
    profile?.sshPort,
    profile?.username,
    server.externalId,
    server.id,
    server.name,
  ]);

  const accessMethodOptions: Array<[ServerAccessMethod, string]> = [
    ['ssh_key', t.accessRows.sshKey],
    ['temporary_root_password', t.accessRows.temporaryRootPassword],
    ['temporary_root_key', t.accessRows.temporaryRootKey],
    ['existing_admin_key', t.accessRows.existingAdminKey],
  ];
  const bootstrapStateOptions: Array<[ServerBootstrapState, string]> = [
    ['not_started', t.serverEdit.values.pending],
    ['pending', t.accessRows.bootstrapPending],
    ['installed', t.accessRows.bootstrapInstalled],
    ['failed', t.accessRows.bootstrapFailed],
    ['revoked', t.accessRows.bootstrapRevoked],
  ];
  const credentialKindOptions: Array<[ServerCredentialKind, string]> = [
    ['ssh_private_key', t.accessRows.sshPrivateKey],
    ['ssh_password', t.accessRows.sshPassword],
    ['api_token', t.accessRows.apiToken],
  ];

  const handleSaveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const port = Number(sshPort);

    if (!address.trim() || !username.trim() || !Number.isInteger(port) || port < 1 || port > 65535) {
      setAccessMessage(t.accessRows.profileSaveFailed);
      return;
    }

    setIsSavingProfile(true);
    setAccessMessage(null);

    try {
      const updated = await updateAdminServer(sessionToken, server.id, {
        accessProfile: {
          address: address.trim(),
          accessMethod,
          bootstrapState,
          notes: notes.trim() || null,
          sshPort: port,
          username: username.trim(),
        },
      });
      onServerUpdated(updated);
      setAccessMessage(t.accessRows.profileSaved);
    } catch {
      setAccessMessage(t.accessRows.profileSaveFailed);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleStoreCredential = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!profile?.id) {
      setAccessMessage(t.accessRows.profileRequired);
      return;
    }
    if (!credentialName.trim() || !credentialSecret.trim()) {
      setAccessMessage(t.accessRows.credentialStoreFailed);
      return;
    }

    setIsStoringCredential(true);
    setAccessMessage(null);

    try {
      const response = await storeAdminServerCredential(sessionToken, server.id, {
        kind: credentialKind,
        name: credentialName.trim(),
        secret: credentialSecret,
      });
      onServerUpdated(response.server);
      setCredentialSecret('');
      setAccessMessage(t.accessRows.credentialStored);
    } catch {
      setAccessMessage(t.accessRows.credentialStoreFailed);
    } finally {
      setIsStoringCredential(false);
    }
  };

  return (
    <div className="grid gap-3">
      <DetailRow label={t.accessRows.defaultUser}>{profile?.username ?? 'afrogate'}</DetailRow>
      <DetailRow label={t.accessRows.accessMethod}>{profile?.accessMethod ?? t.accessRows.sshKey}</DetailRow>
      <DetailRow label={t.serverEdit.labels.sshPort}>{profile?.sshPort ?? 22}</DetailRow>
      <DetailRow label={t.accessRows.rootPassword}>{t.accessRows.bootstrapOnly}</DetailRow>
      <DetailRow label={t.accessRows.credentialView}>{profile?.hasCredentialRef ? t.accessRows.hidden : t.serverEdit.values.notRun}</DetailRow>
      <DetailRow label={t.accessRows.credentialStatus}>
        <StatusBadge tone={profile?.hasActiveCredential ? 'good' : profile?.hasCredentialRef ? 'warning' : 'neutral'}>
          {profile?.hasActiveCredential
            ? t.accessRows.activeCredential
            : profile?.hasCredentialRef
              ? t.accessRows.inactiveCredential
              : t.serverEdit.values.notRun}
        </StatusBadge>
      </DetailRow>
      <DetailRow label={t.serverEdit.labels.bootstrapState}>
        <StatusBadge tone={profile?.bootstrapState === 'installed' ? 'good' : 'warning'}>
          {profile?.bootstrapState ?? t.serverEdit.values.pending}
        </StatusBadge>
      </DetailRow>
      <DetailRow label={t.serverEdit.labels.connectionTest}>{profile?.lastTestStatus ?? t.serverEdit.values.notRun}</DetailRow>
      <DetailRow label={t.serverEdit.labels.secretPolicy}>{t.serverEdit.values.secretsHidden}</DetailRow>

      <form className="grid gap-2 rounded-md border border-afro-line bg-[#f8fafb] p-2.5" onSubmit={handleSaveProfile}>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className={fieldLabelClass}>
            {t.accessRows.address}
            <input
              className={fieldInputClass}
              disabled={!canManageAccess || isSavingProfile}
              onChange={(event) => setAddress(event.target.value)}
              required
              value={address}
            />
          </label>
          <label className={fieldLabelClass}>
            {t.serverEdit.labels.sshPort}
            <input
              className={fieldInputClass}
              disabled={!canManageAccess || isSavingProfile}
              inputMode="numeric"
              max={65535}
              min={1}
              onChange={(event) => setSshPort(event.target.value)}
              required
              type="number"
              value={sshPort}
            />
          </label>
          <label className={fieldLabelClass}>
            {t.accessRows.defaultUser}
            <input
              className={fieldInputClass}
              disabled={!canManageAccess || isSavingProfile}
              onChange={(event) => setUsername(event.target.value)}
              required
              value={username}
            />
          </label>
          <label className={fieldLabelClass}>
            {t.accessRows.accessMethod}
            <select
              className={fieldInputClass}
              disabled={!canManageAccess || isSavingProfile}
              onChange={(event) => setAccessMethod(event.target.value as ServerAccessMethod)}
              value={accessMethod}
            >
              {accessMethodOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className={fieldLabelClass}>
            {t.serverEdit.labels.bootstrapState}
            <select
              className={fieldInputClass}
              disabled={!canManageAccess || isSavingProfile}
              onChange={(event) => setBootstrapState(event.target.value as ServerBootstrapState)}
              value={bootstrapState}
            >
              {bootstrapStateOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className={fieldLabelClass}>
            {t.accessRows.notes}
            <input
              className={fieldInputClass}
              disabled={!canManageAccess || isSavingProfile}
              onChange={(event) => setNotes(event.target.value)}
              value={notes}
            />
          </label>
        </div>
        <button className={primaryButtonClass} disabled={!canManageAccess || isSavingProfile} type="submit">
          {isSavingProfile ? t.accessRows.saving : t.accessRows.saveAccessProfile}
        </button>
      </form>

      <form className="grid gap-2 rounded-md border border-afro-line bg-white p-2.5" onSubmit={handleStoreCredential}>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className={fieldLabelClass}>
            {t.accessRows.credentialName}
            <input
              className={fieldInputClass}
              disabled={!canManageAccess || isStoringCredential}
              onChange={(event) => setCredentialName(event.target.value)}
              required
              value={credentialName}
            />
          </label>
          <label className={fieldLabelClass}>
            {t.accessRows.credentialKind}
            <select
              className={fieldInputClass}
              disabled={!canManageAccess || isStoringCredential}
              onChange={(event) => setCredentialKind(event.target.value as ServerCredentialKind)}
              value={credentialKind}
            >
              {credentialKindOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        </div>
        <label className={fieldLabelClass}>
          {t.accessRows.credentialSecret}
          <textarea
            className={`${fieldInputClass} min-h-24 resize-y py-2`}
            disabled={!canManageAccess || isStoringCredential || !profile?.id}
            onChange={(event) => setCredentialSecret(event.target.value)}
            required
            value={credentialSecret}
          />
        </label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className={`${mutedTextClass} text-[12px]`}>{profile?.id ? t.accessRows.writeOnlyCredential : t.accessRows.profileRequired}</span>
          <button
            className={primaryButtonClass}
            disabled={!canManageAccess || isStoringCredential || !profile?.id || !credentialSecret.trim()}
            type="submit"
          >
            {isStoringCredential ? t.accessRows.storingCredential : t.accessRows.storeCredential}
          </button>
        </div>
      </form>

      {accessMessage ? <p className={`${mutedTextClass} text-[12px]`}>{accessMessage}</p> : null}
    </div>
  );
}

function ServerMonitoringTab({ format, server, t }: { format: DashboardFormatters; server: ServerRowData; t: DashboardStrings }) {
  const wireGuardSummary = summarizeWireGuardInterfaces(server.wireGuardInterfaces, format, t);
  const wireGuardRows = server.wireGuardInterfaces.slice(0, 3);
  const routeProbeSummary = summarizeRouteProbes(server.routeProbes, format, t);

  return (
    <div className="grid gap-2">
      <div className="grid gap-2 sm:grid-cols-3">
        <UsageBar format={format} icon={Cpu} label={t.resources.cpu} value={server.cpu} />
        <UsageBar format={format} icon={MemoryStick} label={t.resources.ram} value={server.ram} />
        <UsageBar format={format} icon={HardDrive} label={t.resources.diskFree} value={server.diskFree} invert />
      </div>
      <DetailRow label={t.serverEdit.labels.metricsInterval}>{format.durationSeconds(10)}</DetailRow>
      <DetailRow label={t.serverEdit.labels.networkRate}>
        {format.bytesPerSecond(server.inboundBps)} / {format.bytesPerSecond(server.outboundBps)}
      </DetailRow>
      <DetailRow label={t.serverEdit.labels.routeQuality}>
        {format.latency(server.pingMs)} / {format.latency(server.jitterMs)} / {format.packetLoss(server.packetLossPercent)}
      </DetailRow>
      <DetailRow label={t.serverEdit.labels.tunnelHealth}>
        <StatusBadge tone={wireGuardSummary.tone}>{wireGuardSummary.label}</StatusBadge>
      </DetailRow>
      {wireGuardRows.map((item) => (
        <DetailRow key={item.name} label={`${t.serverEdit.labels.wireGuardInterface} ${item.name}`}>
          <span className="inline-flex items-center gap-1.5">
            <StatusBadge tone={wireGuardTone(item)}>{wireGuardStatusLabel(item.status, t)}</StatusBadge>
            <span>{formatWireGuardPeerSummary(item, format, t)}</span>
          </span>
        </DetailRow>
      ))}
      <DetailRow label={t.serverEdit.labels.protocolProbes}>
        <StatusBadge tone={routeProbeSummary.tone}>{routeProbeSummary.label}</StatusBadge>
      </DetailRow>
    </div>
  );
}

function ServerInterfacesTab({
  detailDataState,
  format,
  interfaces,
  inventoryInterfaces,
  inventoryTunnels,
  server,
  t,
}: {
  detailDataState: DataState;
  format: DashboardFormatters;
  interfaces: string[];
  inventoryInterfaces: AdminServerInterfaceSummary[];
  inventoryTunnels: AdminTunnelSummary[];
  server: ServerRowData;
  t: DashboardStrings;
}) {
  const metricRows = server.networkInterfaces.length > 0
    ? server.networkInterfaces.map((item) => ({
        name: item.name,
        value: `${format.bytesPerSecond(item.rxBps ?? null)} / ${format.bytesPerSecond(item.txBps ?? null)}`,
      }))
    : interfaces.map((item) => ({ name: format.label(item), value: t.serverEdit.values.localSample }));
  const wireGuardRows = server.wireGuardInterfaces.map((item) => ({
    name: item.name,
    status: wireGuardStatusLabel(item.status, t),
    tone: wireGuardTone(item),
    peerSummary: formatWireGuardPeerSummary(item, format, t),
    rate: `${format.bytesPerSecond(item.rxBps ?? null)} / ${format.bytesPerSecond(item.txBps ?? null)}`,
    handshake: formatWireGuardHandshake(item, format, t),
  }));

  return (
    <div className="grid gap-2">
      {inventoryInterfaces.length > 0 ? (
        <>
          <DetailRow label={t.serverEdit.labels.inventoryInterfaces}>
            {t.panels.visible(format.integer(inventoryInterfaces.length))}
          </DetailRow>
          {inventoryInterfaces.map((item) => (
            <DetailRow key={`inventory-interface-${item.id}`} label={format.label(item.name)}>
              <span className="inline-flex min-w-0 items-center justify-end gap-1.5">
                <StatusBadge tone={inventoryStatusTone(item.status)}>{inventoryStatusLabel(item.status, t)}</StatusBadge>
                <span className="truncate">
                  {[item.operator, item.kind, item.linkedTunnelName].filter(Boolean).map(String).map(format.label).join(' / ') || t.serverEdit.values.none}
                </span>
              </span>
            </DetailRow>
          ))}
        </>
      ) : null}
      {inventoryTunnels.length > 0 ? (
        <>
          <DetailRow label={t.serverEdit.labels.inventoryTunnels}>
            {t.panels.links(format.integer(inventoryTunnels.length))}
          </DetailRow>
          {inventoryTunnels.map((item) => (
            <DetailRow key={`inventory-tunnel-${item.id}`} label={format.label(item.name)}>
              <span className="inline-flex min-w-0 items-center justify-end gap-1.5">
                <StatusBadge tone={inventoryStatusTone(item.status)}>{inventoryStatusLabel(item.status, t)}</StatusBadge>
                <span className="truncate">
                  {[item.type, item.localInterfaceName ?? item.interfaceName, item.routeGroup].filter(Boolean).map(String).map(format.label).join(' / ')}
                </span>
              </span>
            </DetailRow>
          ))}
        </>
      ) : null}
      {detailDataState === 'live' && inventoryInterfaces.length === 0 ? (
        <DetailRow label={t.serverEdit.labels.inventoryInterfaces}>{t.serverEdit.values.noInventoryInterfaces}</DetailRow>
      ) : null}
      {detailDataState === 'live' && inventoryTunnels.length === 0 ? (
        <DetailRow label={t.serverEdit.labels.inventoryTunnels}>{t.serverEdit.values.noInventoryTunnels}</DetailRow>
      ) : null}
      {metricRows.map((item) => (
        <DetailRow key={item.name} label={item.name}>{item.value}</DetailRow>
      ))}
      {wireGuardRows.map((item) => (
        <DetailRow key={`wg-${item.name}`} label={`${t.serverEdit.labels.wireGuardInterface} ${item.name}`}>
          <span className="inline-flex items-center gap-1.5">
            <StatusBadge tone={item.tone}>{item.status}</StatusBadge>
            <span>{item.peerSummary}</span>
          </span>
        </DetailRow>
      ))}
      {wireGuardRows.map((item) => (
        <DetailRow key={`wg-rate-${item.name}`} label={`${item.name} ${t.serverEdit.labels.networkRate}`}>
          {item.rate}
        </DetailRow>
      ))}
      {wireGuardRows.map((item) => (
        <DetailRow key={`wg-handshake-${item.name}`} label={`${item.name} ${t.serverEdit.labels.latestHandshake}`}>
          {item.handshake}
        </DetailRow>
      ))}
      {wireGuardRows.length === 0 ? (
        <DetailRow label={t.serverEdit.labels.wireGuardInterfaces}>{t.serverEdit.values.noWireGuardTelemetry}</DetailRow>
      ) : null}
      <DetailRow label={t.serverEdit.labels.interfaceMap}>{interfaces.map((item) => format.label(item)).join(' / ')}</DetailRow>
    </div>
  );
}


function ServerAuditTab({
  detailDataState,
  format,
  server,
  t,
}: {
  detailDataState: DataState;
  format: DashboardFormatters;
  server: ServerRowData;
  t: DashboardStrings;
}) {
  return (
    <div className="grid gap-2">
      <DetailRow label={t.serverEdit.labels.detailSource}>
        {detailDataState === 'live' ? t.serverEdit.values.apiDetail : detailDataState === 'loading' ? t.dataStatus.loading : t.serverEdit.values.fallbackDetail}
      </DetailRow>
      <DetailRow label={t.accessRows.auditMode}>
        <StatusBadge tone="warning">{t.accessRows.required}</StatusBadge>
      </DetailRow>
      <DetailRow label={t.serverEdit.labels.lastChange}>
        {server.observedAt ? format.time(new Date(server.observedAt), false) : t.serverEdit.values.localSample}
      </DetailRow>
      <DetailRow label={t.serverEdit.labels.auditTrail}>{t.serverEdit.values.readOnlyMvp}</DetailRow>
      <DetailRow label={t.serverEdit.labels.agentFirst}>{t.serverEdit.values.agentFirst}</DetailRow>
      <DetailRow label={t.serverEdit.labels.secretPolicy}>{t.serverEdit.values.secretsHidden}</DetailRow>
    </div>
  );
}
