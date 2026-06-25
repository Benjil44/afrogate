import { SettingsInput, SettingsSelect } from '../components/settings-form';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { AlertTriangle, ArrowDownUp, Bot, CheckCircle2, Clock, Gauge, LockKeyhole, Network, Palette, Plus, Route, Settings as SettingsIcon, ShieldCheck } from 'lucide-react';
import type { AdminOutboundSummary, AdminProtocolServerApplyEventDetail, AdminProtocolServerApplyEventSummary, AdminProtocolSetupSummary, AdminRouteAssignmentSummary, AdminRouteDecisionEventDetail, AdminRouteDecisionEventSummary, AdminRouteDecisionPreviewResponse, AdminRouteDecisionSwitchExecutionSummary, AdminRouteQualityAnalyticsResponse, AdminSessionResponse, AdminSettingsResponse, AdminTelegramBotSettingsSummary, AdminTenantBrandSettingsSummary, AdminWireGuardCandidate, LoadBalanceStrategy, ProtocolKind, ProtocolProfile, RouteSelectionMode } from '@afrows/shared';
import { applyRouteDecisionPreview, createAdminProtocolSetup, createAdminSettingsSecret, fetchAdminSettings, fetchAdminTelegramBotSettings, fetchAdminTenantBranding, fetchProtocolServerApplyEvent, fetchProtocolServerApplyEvents, fetchRouteAssignment, fetchRouteDecisionEvent, fetchRouteDecisionEvents, fetchRouteDecisionPreview, fetchRouteQualityAnalytics, provisionAdminProtocolSetup, recordAdminProtocolServerApplyDryRun, recordRouteDecisionPreview, requestAdminProtocolServerApply, testAdminTelegramBotConnection, updateAdminRouteAssignment, updateAdminRouteSettings, updateAdminTelegramBotSettings, updateAdminTenantBranding } from '../api/admin';
import type { DashboardTabItem, DataState, ProtocolSetupDraft, ServerRowData, SettingsTab, TelegramBotSettingsForm, TenantBrandSettingsForm, Tone, WireGuardHealthCandidate, WireGuardSetupDraft } from '../dashboard-types';
import { clamp, normalizeNullableText, type DashboardFormatters } from '../formatters';
import type { DashboardStrings } from '../i18n';
import { formatWireGuardCandidateHandshake, formatWireGuardCandidatePeers, formatWireGuardCandidateRate } from '../route-helpers';
import { parseTelegramChatIds, telegramSecretSourceLabel, telegramTestStatusLabel } from '../route-labels';
import { getWireGuardScoreTone, serverAccessReady } from '../tone';
import { buildSampleWireGuardCandidates, deriveActiveWireGuard, pickWireGuardCandidates } from '../route-candidates';
import { mutedTextClass, panelClass } from '../ui-classes';
import { DashboardTabs, MetricPill, PanelHeading, StatusBadge } from '../components/primitives';
import { ProtocolApplyEventsPanel, ProtocolServerApplyPlanCard } from '../components/protocol-apply';
import { RouteDecisionPreviewPanel, RouteIntelligencePanel } from '../components/route-decision';



export function SettingsPage({
  format,
  managementServers,
  session,
  sessionToken,
  t,
}: {
  format: DashboardFormatters;
  managementServers: ServerRowData[];
  session: AdminSessionResponse;
  sessionToken: string;
  t: DashboardStrings;
}) {
  const [draft, setDraft] = useState<WireGuardSetupDraft>({
    serverName: '',
    interfaceName: 'wg0',
    routeGroup: 'main',
    addressCidr: '',
    listenPort: '51820',
    privateKey: '',
    peerPublicKey: '',
    endpoint: '',
    allowedIps: '0.0.0.0/0, ::/0',
    persistentKeepalive: '25',
    healthTarget: '',
  });
  const [routeMode, setRouteMode] = useState<RouteSelectionMode>('automatic');
  const [loadBalanceStrategy, setLoadBalanceStrategy] = useState<LoadBalanceStrategy>('balanced');
  const [selectedWireGuardId, setSelectedWireGuardId] = useState('wg-primary');
  const [assignmentAutoRouteEnabled, setAssignmentAutoRouteEnabled] = useState(true);
  const [assignmentRouteLocked, setAssignmentRouteLocked] = useState(false);
  const [assignmentCurrentOutboundId, setAssignmentCurrentOutboundId] = useState('');
  const [assignmentLockedOutboundId, setAssignmentLockedOutboundId] = useState('');
  const [assignmentHysteresisScoreDelta, setAssignmentHysteresisScoreDelta] = useState('15');
  const [assignmentCooldownSeconds, setAssignmentCooldownSeconds] = useState('180');
  const [protocolDraft, setProtocolDraft] = useState<ProtocolSetupDraft>({
    name: 'wg-main',
    protocol: 'wireguard',
    profile: 'balanced',
    port: protocolDefaultPorts.wireguard,
    routeGroup: 'main',
    targetServerId: '',
  });
  const [tenantBranding, setTenantBranding] = useState<AdminTenantBrandSettingsSummary | null>(null);
  const [tenantBrandForm, setTenantBrandForm] = useState<TenantBrandSettingsForm>(createEmptyTenantBrandForm);
  const [tenantBrandMessage, setTenantBrandMessage] = useState<string | null>(null);
  const [isTenantBrandSaving, setIsTenantBrandSaving] = useState(false);
  const [telegramBotSettings, setTelegramBotSettings] = useState<AdminTelegramBotSettingsSummary | null>(null);
  const [telegramBotForm, setTelegramBotForm] = useState<TelegramBotSettingsForm>({
    botToken: '',
    webhookSecret: '',
    alertChatId: '',
    allowedAdminChatIds: '',
    alertsEnabled: false,
    commandsEnabled: false,
  });
  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTab>('route');
  const [privateKeyAccepted, setPrivateKeyAccepted] = useState(false);
  const [privateKeySecretRef, setPrivateKeySecretRef] = useState<string | null>(null);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [protocolMessage, setProtocolMessage] = useState<string | null>(null);
  const [provisionMessage, setProvisionMessage] = useState<string | null>(null);
  const [serverApplyMessage, setServerApplyMessage] = useState<string | null>(null);
  const [routeMessage, setRouteMessage] = useState<string | null>(null);
  const [telegramBotMessage, setTelegramBotMessage] = useState<string | null>(null);
  const [settingsDataState, setSettingsDataState] = useState<DataState>('loading');
  const [persistedProtocolSetups, setPersistedProtocolSetups] = useState<AdminProtocolSetupSummary[]>([]);
  const [protocolApplyEvents, setProtocolApplyEvents] = useState<AdminProtocolServerApplyEventSummary[]>([]);
  const [protocolApplyEventsBySetupId, setProtocolApplyEventsBySetupId] = useState<Record<string, AdminProtocolServerApplyEventSummary>>({});
  const [protocolApplyEventDetail, setProtocolApplyEventDetail] = useState<AdminProtocolServerApplyEventDetail | null>(null);
  const [apiWireGuardCandidates, setApiWireGuardCandidates] = useState<AdminWireGuardCandidate[]>([]);
  const [routeQualityAnalytics, setRouteQualityAnalytics] = useState<AdminRouteQualityAnalyticsResponse | null>(null);
  const [routeDecisionPreview, setRouteDecisionPreview] = useState<AdminRouteDecisionPreviewResponse | null>(null);
  const [routeDecisionEvents, setRouteDecisionEvents] = useState<AdminRouteDecisionEventSummary[]>([]);
  const [routeDecisionEventDetail, setRouteDecisionEventDetail] = useState<AdminRouteDecisionEventDetail | null>(null);
  const [routeDecisionSwitchExecution, setRouteDecisionSwitchExecution] = useState<AdminRouteDecisionSwitchExecutionSummary | null>(null);
  const [isSecretSaving, setIsSecretSaving] = useState(false);
  const [isProtocolSaving, setIsProtocolSaving] = useState(false);
  const [provisioningSetupId, setProvisioningSetupId] = useState<string | null>(null);
  const [serverApplyingSetupId, setServerApplyingSetupId] = useState<string | null>(null);
  const [serverLiveApplyingSetupId, setServerLiveApplyingSetupId] = useState<string | null>(null);
  const [isRouteSaving, setIsRouteSaving] = useState(false);
  const [isTelegramBotSaving, setIsTelegramBotSaving] = useState(false);
  const [isTelegramBotTesting, setIsTelegramBotTesting] = useState(false);
  const [isDecisionRecording, setIsDecisionRecording] = useState(false);
  const [isDecisionApplying, setIsDecisionApplying] = useState(false);
  const [isDecisionEventDetailLoading, setIsDecisionEventDetailLoading] = useState(false);
  const [isProtocolApplyEventDetailLoading, setIsProtocolApplyEventDetailLoading] = useState(false);
  const canCreateProtocols = session.actor.role === 'superadmin' || Boolean(session.actor.isSuperAdmin);
  const canManageTelegramBot = canCreateProtocols;
  const canManageTenantBranding = ['superadmin', 'owner', 'admin'].includes(session.actor.role);
  const sampleWireGuardCandidates = useMemo<WireGuardHealthCandidate[]>(
    () => buildSampleWireGuardCandidates(t, draft.endpoint),
    [draft.endpoint, t],
  );
  const wireGuardCandidates = useMemo<WireGuardHealthCandidate[]>(
    () => pickWireGuardCandidates(apiWireGuardCandidates, sampleWireGuardCandidates),
    [apiWireGuardCandidates, sampleWireGuardCandidates],
  );
  const managedWireGuardCandidates = useMemo(
    () => wireGuardCandidates.filter((candidate) => candidate.source === 'outbound'),
    [wireGuardCandidates],
  );
  const applyRouteAssignment = (assignment: AdminRouteAssignmentSummary) => {
    setAssignmentAutoRouteEnabled(assignment.autoRouteEnabled);
    setAssignmentRouteLocked(assignment.routeLocked);
    setAssignmentCurrentOutboundId(assignment.currentOutboundId ?? '');
    setAssignmentLockedOutboundId(assignment.lockedOutboundId ?? assignment.currentOutboundId ?? '');
    setAssignmentHysteresisScoreDelta(String(assignment.hysteresisScoreDelta));
    setAssignmentCooldownSeconds(String(assignment.cooldownSeconds));
    setRouteMode(assignment.autoRouteEnabled ? 'automatic' : 'manual');
    if (assignment.currentOutboundId) setSelectedWireGuardId(assignment.currentOutboundId);
    setProtocolDraft((current) => ({
      ...current,
      profile:
        assignment.speedProfile === 'balanced' ||
        assignment.speedProfile === 'highSpeed' ||
        assignment.speedProfile === 'highSecurity' ||
        assignment.speedProfile === 'gaming'
          ? assignment.speedProfile
          : current.profile,
    }));
  };
  const applyTenantBranding = (settings: AdminTenantBrandSettingsSummary) => {
    setTenantBranding(settings);
    setTenantBrandForm(mapTenantBrandingToForm(settings));
  };
  const applyTelegramBotSettings = (settings: AdminTelegramBotSettingsSummary) => {
    setTelegramBotSettings(settings);
    setTelegramBotForm((current) => ({
      ...current,
      botToken: '',
      webhookSecret: '',
      alertChatId: settings.alertChatId ?? '',
      allowedAdminChatIds: settings.allowedAdminChatIds.join(', '),
      alertsEnabled: settings.alertsEnabled,
      commandsEnabled: settings.commandsEnabled,
    }));
  };

  useEffect(() => {
    let isActive = true;
    const controller = new AbortController();

    setSettingsDataState('loading');
    setRouteQualityAnalytics(null);
    setRouteDecisionPreview(null);
    setRouteDecisionEvents([]);
    setRouteDecisionEventDetail(null);
    setProtocolApplyEvents([]);
    setProtocolApplyEventDetail(null);
    setProtocolApplyEventsBySetupId({});
    setIsDecisionEventDetailLoading(false);
    setIsProtocolApplyEventDetailLoading(false);
    setServerLiveApplyingSetupId(null);
    setTenantBrandMessage(null);
    setTelegramBotMessage(null);

    fetchAdminSettings(sessionToken, 'main', controller.signal)
      .then((data: AdminSettingsResponse) => {
        if (!isActive) return;

        setPersistedProtocolSetups(data.protocolSetups);
        setApiWireGuardCandidates(data.wireGuardCandidates);
        setSettingsDataState('live');

        if (
          data.routeSettings.loadBalanceStrategy === 'balanced' ||
          data.routeSettings.loadBalanceStrategy === 'stability' ||
          data.routeSettings.loadBalanceStrategy === 'throughput'
        ) {
          setLoadBalanceStrategy(data.routeSettings.loadBalanceStrategy);
        }
        if (data.routeSettings.selectedOutboundId) {
          setSelectedWireGuardId(data.routeSettings.selectedOutboundId);
        }
        setProtocolDraft((current) => ({
          ...current,
          routeGroup: data.routeSettings.routeGroup,
          profile:
            data.routeSettings.protocolProfile === 'balanced' ||
            data.routeSettings.protocolProfile === 'highSpeed' ||
            data.routeSettings.protocolProfile === 'highSecurity' ||
            data.routeSettings.protocolProfile === 'gaming'
              ? data.routeSettings.protocolProfile
              : current.profile,
        }));
      })
      .catch((error) => {
        if (!isActive || error instanceof DOMException && error.name === 'AbortError') return;

        setSettingsDataState('fallback');
      });

    fetchRouteAssignment(sessionToken, 'main', 'default', controller.signal)
      .then((data) => {
        if (!isActive) return;

        applyRouteAssignment(data);
      })
      .catch((error) => {
        if (!isActive || error instanceof DOMException && error.name === 'AbortError') return;
      });

    fetchAdminTenantBranding(sessionToken, controller.signal)
      .then((data) => {
        if (!isActive) return;

        applyTenantBranding(data.branding);
      })
      .catch((error) => {
        if (!isActive || error instanceof DOMException && error.name === 'AbortError') return;

        setTenantBranding(null);
      });

    if (canManageTelegramBot) {
      fetchAdminTelegramBotSettings(sessionToken, controller.signal)
        .then((data) => {
          if (!isActive) return;

          applyTelegramBotSettings(data.telegramBot);
        })
        .catch((error) => {
          if (!isActive || error instanceof DOMException && error.name === 'AbortError') return;

          setTelegramBotSettings(null);
        });
    }

    fetchRouteQualityAnalytics(sessionToken, 'main', 168, controller.signal)
      .then((data) => {
        if (!isActive) return;

        setRouteQualityAnalytics(data);
      })
      .catch((error) => {
        if (!isActive || error instanceof DOMException && error.name === 'AbortError') return;

        setRouteQualityAnalytics(null);
      });

    fetchRouteDecisionPreview(sessionToken, 'main', 'default', controller.signal)
      .then((data) => {
        if (!isActive) return;

        setRouteDecisionPreview(data);
      })
      .catch((error) => {
        if (!isActive || error instanceof DOMException && error.name === 'AbortError') return;

        setRouteDecisionPreview(null);
      });

    fetchRouteDecisionEvents(sessionToken, 'main', 'default', 10, controller.signal)
      .then((data) => {
        if (!isActive) return;

        setRouteDecisionEvents(data.events);
      })
      .catch((error) => {
        if (!isActive || error instanceof DOMException && error.name === 'AbortError') return;

        setRouteDecisionEvents([]);
      });

    fetchProtocolServerApplyEvents(sessionToken, undefined, 'main', 10, controller.signal)
      .then((data) => {
        if (!isActive) return;

        setProtocolApplyEvents(data.events);
        setProtocolApplyEventsBySetupId(latestProtocolApplyEventsBySetupId(data.events));
      })
      .catch((error) => {
        if (!isActive || error instanceof DOMException && error.name === 'AbortError') return;

        setProtocolApplyEvents([]);
        setProtocolApplyEventsBySetupId({});
      });

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [sessionToken]);

  const hasSavedPrivateKey = Boolean(privateKeySecretRef);
  const hasPrivateKey = draft.privateKey.trim().length > 0 || privateKeyAccepted || hasSavedPrivateKey;
  const hasTunnelShape = Boolean(
    draft.interfaceName.trim() &&
      draft.routeGroup.trim() &&
      draft.addressCidr.trim() &&
      draft.listenPort.trim() &&
      draft.peerPublicKey.trim() &&
      draft.endpoint.trim() &&
      draft.allowedIps.trim(),
  );
  const hasHealthTarget = draft.healthTarget.trim().length > 0;
  const { best: bestWireGuard, selected: selectedWireGuard, active: activeWireGuard } = deriveActiveWireGuard(wireGuardCandidates, routeMode, selectedWireGuardId);
  const routeModeDescription = routeMode === 'automatic' ? t.settings.autoModeDescription : t.settings.manualModeDescription;
  const loadBalanceOptions: Array<[LoadBalanceStrategy, string]> = [
    ['balanced', t.settings.balancedStrategy],
    ['stability', t.settings.stabilityStrategy],
    ['throughput', t.settings.throughputStrategy],
  ];
  const protocolOptions: Array<[ProtocolKind, string]> = [
    ['wireguard', t.settings.protocolWireGuard],
    ['vless', t.settings.protocolVless],
    ['l2tp', t.settings.protocolL2tp],
    ['ikev2', t.settings.protocolIkev2],
  ];
  const profileOptions: Array<[ProtocolProfile, string]> = [
    ['balanced', t.settings.profileBalanced],
    ['highSpeed', t.settings.profileHighSpeed],
    ['highSecurity', t.settings.profileHighSecurity],
    ['gaming', t.settings.profileGaming],
  ];
  const protocolTargetServers = managementServers.filter((server) => server.source === 'admin');
  const targetServerOptions = protocolTargetServers.map((server) => ({
    value: server.id,
    label: `${format.label(server.name)} / ${serverAccessReady(server) ? t.settings.accessReady : t.settings.accessPending}`,
  }));
  const selectedTargetServer = protocolTargetServers.find((server) => server.id === protocolDraft.targetServerId) ?? null;
  const selectedTargetServerAccessReady = selectedTargetServer ? serverAccessReady(selectedTargetServer) : false;
  const readinessRows: Array<[string, string, Tone]> = [
    [t.settings.systemUser, 'afrows', 'good'],
    [t.settings.protocolCreation, canCreateProtocols ? t.settings.superadminReady : t.settings.superadminOnly, canCreateProtocols ? 'good' : 'warning'],
    [t.settings.protocolProfile, profileOptions.find(([value]) => value === protocolDraft.profile)?.[1] ?? t.settings.profileBalanced, 'neutral'],
    [t.settings.targetServer, selectedTargetServer ? selectedTargetServer.name : t.settings.noTargetServer, selectedTargetServer ? 'neutral' : 'warning'],
    [t.settings.serverAccess, selectedTargetServer ? selectedTargetServerAccessReady ? t.settings.accessReady : t.settings.accessPending : t.settings.pending, selectedTargetServerAccessReady ? 'good' : 'warning'],
    [t.settings.routeMode, routeMode === 'automatic' ? t.settings.automatic : t.settings.manual, routeMode === 'automatic' ? 'good' : 'neutral'],
    [t.settings.activeWireGuard, activeWireGuard.name, getWireGuardScoreTone(activeWireGuard.score)],
    [t.settings.privateKeyStatus, hasSavedPrivateKey ? t.settings.encryptedSecretSaved : hasPrivateKey ? t.settings.acceptedWriteOnly : t.settings.pending, hasPrivateKey ? 'good' : 'warning'],
    [t.settings.tunnelConfig, hasTunnelShape ? t.settings.ready : t.settings.incomplete, hasTunnelShape ? 'good' : 'warning'],
    [t.settings.healthTarget, hasHealthTarget ? t.settings.configured : t.settings.pending, hasHealthTarget ? 'good' : 'neutral'],
    [t.settings.settingsStorage, settingsDataState === 'live' ? t.settings.configured : t.settings.pending, settingsDataState === 'live' ? 'good' : 'warning'],
    [t.settings.secretStorage, hasSavedPrivateKey ? t.settings.encryptedStorageReady : t.settings.encryptedStoragePending, hasSavedPrivateKey ? 'good' : 'neutral'],
  ];
  const telegramBotReadinessRows: Array<[string, string, Tone]> = [
    [
      t.settings.telegramBotToken,
      telegramBotSettings?.hasBotToken ? telegramSecretSourceLabel(telegramBotSettings.botTokenSource, t) : t.settings.pending,
      telegramBotSettings?.hasBotToken ? 'good' : 'warning',
    ],
    [
      t.settings.telegramWebhookSecret,
      telegramBotSettings?.hasWebhookSecret ? telegramSecretSourceLabel(telegramBotSettings.webhookSecretSource, t) : t.settings.pending,
      telegramBotSettings?.hasWebhookSecret ? 'good' : 'warning',
    ],
    [
      t.settings.telegramAlertChatId,
      telegramBotSettings?.alertChatId ? t.settings.configured : t.settings.pending,
      telegramBotSettings?.alertChatId ? 'good' : 'neutral',
    ],
    [
      t.settings.telegramAllowedAdminChatIds,
      t.settings.telegramAllowedChatCount(format.integer(telegramBotSettings?.allowedAdminChatIds.length ?? 0)),
      telegramBotSettings?.allowedAdminChatIds.length ? 'good' : 'neutral',
    ],
    [
      t.settings.telegramBotApiTest,
      telegramTestStatusLabel(telegramBotSettings?.lastTestStatus ?? 'notTested', t),
      telegramBotSettings?.lastTestStatus === 'ok' ? 'good' : telegramBotSettings?.lastTestStatus === 'failed' ? 'warning' : 'neutral',
    ],
    [
      t.settings.outboundProxy,
      telegramBotSettings?.outboundProxyConfigured ? t.settings.configured : t.settings.pending,
      telegramBotSettings?.outboundProxyConfigured ? 'good' : 'neutral',
    ],
  ];
  const tenantBrandingRows: Array<[string, string, Tone]> = [
    [
      t.settings.tenantSlug,
      tenantBranding?.tenantSlug ?? tenantBrandForm.tenantSlug,
      tenantBranding ? 'good' : 'neutral',
    ],
    [
      t.settings.publicBranding,
      tenantBrandForm.publicBrandingEnabled ? t.settings.enabled : t.settings.disabled,
      tenantBrandForm.publicBrandingEnabled ? 'good' : 'neutral',
    ],
    [
      t.settings.supportContact,
      tenantBrandForm.supportEmail || tenantBrandForm.supportTelegram || tenantBrandForm.supportUrl
        ? t.settings.configured
        : t.settings.pending,
      tenantBrandForm.supportEmail || tenantBrandForm.supportTelegram || tenantBrandForm.supportUrl ? 'good' : 'neutral',
    ],
    [
      t.settings.updatedAt,
      tenantBranding?.updatedAt ? format.time(new Date(tenantBranding.updatedAt), false) : t.settings.pending,
      tenantBranding ? 'good' : 'neutral',
    ],
  ];
  const previewRows: Array<[string, string]> = [
    [t.settings.protocolName, protocolDraft.name || '-'],
    [t.settings.protocol, protocolOptions.find(([value]) => value === protocolDraft.protocol)?.[1] ?? '-'],
    [t.settings.protocolProfile, profileOptions.find(([value]) => value === protocolDraft.profile)?.[1] ?? '-'],
    [t.settings.protocolPort, protocolDraft.port || '-'],
    [t.settings.targetServer, selectedTargetServer ? selectedTargetServer.name : t.settings.noTargetServer],
    [t.settings.serverName, draft.serverName || '-'],
    [t.settings.interfaceName, draft.interfaceName || '-'],
    [t.settings.routeGroup, draft.routeGroup || '-'],
    [t.settings.routeMode, routeMode === 'automatic' ? t.settings.automatic : t.settings.manual],
    [t.settings.loadBalanceStrategy, loadBalanceOptions.find(([value]) => value === loadBalanceStrategy)?.[1] ?? t.settings.balancedStrategy],
    [t.settings.activeWireGuard, activeWireGuard.name],
    [t.settings.addressCidr, draft.addressCidr || '-'],
    [t.settings.listenPort, draft.listenPort || '-'],
    [t.settings.peerPublicKey, draft.peerPublicKey ? t.settings.publicKeyPresent : '-'],
    [t.settings.endpoint, draft.endpoint || '-'],
    [t.settings.allowedIps, draft.allowedIps || '-'],
    [t.settings.privateKey, hasPrivateKey ? t.settings.writeOnly : '-'],
  ];

  const updateDraft = (field: keyof WireGuardSetupDraft, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
    if (field === 'privateKey') {
      setPrivateKeyAccepted(false);
      setPrivateKeySecretRef(null);
    }
  };

  const updateProtocolDraft = <K extends keyof ProtocolSetupDraft>(field: K, value: ProtocolSetupDraft[K]) => {
    setProtocolDraft((current) => ({ ...current, [field]: value }));
    setProtocolMessage(null);
  };
  const updateTenantBrandForm = <K extends keyof TenantBrandSettingsForm>(field: K, value: TenantBrandSettingsForm[K]) => {
    setTenantBrandForm((current) => ({ ...current, [field]: value }));
    setTenantBrandMessage(null);
  };
  const updateTelegramBotForm = <K extends keyof TelegramBotSettingsForm>(field: K, value: TelegramBotSettingsForm[K]) => {
    setTelegramBotForm((current) => ({ ...current, [field]: value }));
    setTelegramBotMessage(null);
  };

  const selectProtocol = (protocol: ProtocolKind) => {
    setProtocolDraft((current) => ({
      ...current,
      protocol,
      port: protocolDefaultPorts[protocol],
      name: current.name || `${protocol}-main`,
    }));
    setProtocolMessage(null);
  };

  const savePrivateKeySecret = async (): Promise<string | null> => {
    const privateKey = draft.privateKey.trim();
    if (!privateKey) return privateKeySecretRef;

    setIsSecretSaving(true);

    try {
      const saved = await createAdminSettingsSecret(sessionToken, {
        name: `${protocolDraft.name.trim() || draft.interfaceName.trim() || 'wireguard'} private key`,
        kind: 'wireguardPrivateKey',
        secret: privateKey,
        routeGroup: protocolDraft.routeGroup.trim() || draft.routeGroup.trim() || 'main',
        protocol: 'wireguard',
      });

      setPrivateKeySecretRef(saved.secretRef);
      setPrivateKeyAccepted(true);
      setDraft((current) => ({ ...current, privateKey: '' }));
      return saved.secretRef;
    } catch (error) {
      setValidationMessage(t.settings.secretSaveFailed);
      return null;
    } finally {
      setIsSecretSaving(false);
    }
  };

  const createProtocolDraft = async () => {
    if (!canCreateProtocols) {
      setProtocolMessage(t.settings.superadminRequired);
      return;
    }

    const port = Number(protocolDraft.port);
    if (!protocolDraft.name.trim() || !Number.isInteger(port) || port < 1 || port > 65535 || !protocolDraft.routeGroup.trim()) {
      setProtocolMessage(t.settings.requiredFields);
      return;
    }

    setIsProtocolSaving(true);
    setProtocolMessage(null);

    try {
      const secretRef = protocolDraft.protocol === 'wireguard' ? await savePrivateKeySecret() : privateKeySecretRef;

      if (protocolDraft.protocol === 'wireguard' && !secretRef) {
        setProtocolMessage(t.settings.privateKeyRequired);
        return;
      }

      const created = await createAdminProtocolSetup(sessionToken, {
        name: protocolDraft.name.trim(),
        protocol: protocolDraft.protocol,
        profile: protocolDraft.profile,
        routeGroup: protocolDraft.routeGroup.trim(),
        port,
        config: createProtocolSetupConfig(draft, routeMode, loadBalanceStrategy, activeWireGuard, selectedTargetServer),
        secretRef,
        targetServerId: protocolDraft.targetServerId || null,
      });

      setPersistedProtocolSetups((current) => [created, ...current.filter((item) => item.id !== created.id)]);
      setProtocolMessage(t.settings.protocolDraftSaved);
    } catch (error) {
      setProtocolMessage(t.settings.saveFailed);
    } finally {
      setIsProtocolSaving(false);
    }
  };

  const provisionProtocolDraft = async (setup: AdminProtocolSetupSummary) => {
    if (!canCreateProtocols) {
      setProvisionMessage(t.settings.superadminRequired);
      return;
    }

    setProvisioningSetupId(setup.id);
    setProvisionMessage(null);

    try {
      const provisioned = await provisionAdminProtocolSetup(sessionToken, setup.id);
      setPersistedProtocolSetups((current) =>
        current.map((item) => (item.id === provisioned.protocolSetup.id ? provisioned.protocolSetup : item)),
      );

      const wireGuardCandidate = outboundToWireGuardCandidate(provisioned.outbound);
      if (wireGuardCandidate) {
        setApiWireGuardCandidates((current) => [
          wireGuardCandidate,
          ...current.filter((candidate) => candidate.id !== wireGuardCandidate.id),
        ]);
      }

      setProvisionMessage(t.settings.protocolProvisioned);
    } catch (error) {
      setProvisionMessage(t.settings.provisionFailed);
    } finally {
      setProvisioningSetupId(null);
    }
  };

  const recordProtocolServerApplyDryRun = async (setup: AdminProtocolSetupSummary) => {
    if (!canCreateProtocols) {
      setServerApplyMessage(t.settings.superadminRequired);
      return;
    }

    setServerApplyingSetupId(setup.id);
    setServerApplyMessage(null);

    try {
      const response = await recordAdminProtocolServerApplyDryRun(sessionToken, setup.id, { applyMode: 'dryRun' });

      setPersistedProtocolSetups((current) =>
        current.map((item) => (item.id === response.protocolSetup.id ? response.protocolSetup : item)),
      );
      setProtocolApplyEventsBySetupId((current) => ({
        ...current,
        [setup.id]: response.event,
      }));
      setProtocolApplyEvents((current) => [
        response.event,
        ...current.filter((event) => event.id !== response.event.id),
      ].slice(0, 10));
      setProtocolApplyEventDetail(response.event);
      setServerApplyMessage(t.settings.serverApplyDryRunRecorded);
    } catch (error) {
      setServerApplyMessage(t.settings.serverApplyDryRunFailed);
    } finally {
      setServerApplyingSetupId(null);
    }
  };

  const requestProtocolServerApplyLive = async (setup: AdminProtocolSetupSummary) => {
    if (!canCreateProtocols) {
      setServerApplyMessage(t.settings.superadminRequired);
      return;
    }

    setServerLiveApplyingSetupId(setup.id);
    setServerApplyMessage(null);

    try {
      const response = await requestAdminProtocolServerApply(sessionToken, setup.id, { applyMode: 'live' });

      setPersistedProtocolSetups((current) =>
        current.map((item) => (item.id === response.protocolSetup.id ? response.protocolSetup : item)),
      );
      setProtocolApplyEventsBySetupId((current) => ({
        ...current,
        [setup.id]: response.event,
      }));
      setProtocolApplyEvents((current) => [
        response.event,
        ...current.filter((event) => event.id !== response.event.id),
      ].slice(0, 10));
      setProtocolApplyEventDetail(response.event);
      setServerApplyMessage(
        response.dataPlaneMutationExecuted
          ? t.settings.serverApplyLiveExecuted
          : response.liveApplyAccepted
            ? t.settings.serverApplyLiveAccepted
            : t.settings.serverApplyLiveRequestRecorded,
      );
    } catch (error) {
      setServerApplyMessage(t.settings.serverApplyLiveRequestFailed);
    } finally {
      setServerLiveApplyingSetupId(null);
    }
  };

  const inspectProtocolApplyEvent = async (eventId: string) => {
    setIsProtocolApplyEventDetailLoading(true);
    setServerApplyMessage(null);

    try {
      const response = await fetchProtocolServerApplyEvent(sessionToken, eventId);

      setProtocolApplyEventDetail(response.event);
    } catch (error) {
      setServerApplyMessage(t.settings.protocolApplyEventDetailFailed);
    } finally {
      setIsProtocolApplyEventDetailLoading(false);
    }
  };

  const saveRouteSettings = async () => {
    setIsRouteSaving(true);
    setRouteMessage(null);

    try {
      const routeGroup = protocolDraft.routeGroup.trim() || draft.routeGroup.trim() || 'main';
      const selectedManagedOutboundId = activeWireGuard.source === 'outbound' ? activeWireGuard.id : null;
      const currentOutboundId = assignmentCurrentOutboundId || selectedManagedOutboundId;
      const lockedOutboundId = assignmentRouteLocked ? assignmentLockedOutboundId || currentOutboundId : null;
      const mode: RouteSelectionMode = assignmentAutoRouteEnabled ? 'automatic' : 'manual';
      const hysteresisScoreDelta = clamp(Math.round(Number(assignmentHysteresisScoreDelta) || 15), 1, 100);
      const cooldownSeconds = clamp(Math.round(Number(assignmentCooldownSeconds) || 180), 30, 3600);

      await updateAdminRouteSettings(sessionToken, {
        routeGroup,
        mode,
        selectedOutboundId: mode === 'manual' ? currentOutboundId || null : null,
        loadBalanceStrategy,
        protocolProfile: protocolDraft.profile,
        speedProfile: protocolDraft.profile,
      });
      const savedAssignment = await updateAdminRouteAssignment(sessionToken, {
        routeGroup,
        assignmentKey: 'default',
        assignmentLabel: t.settings.defaultAssignment,
        currentOutboundId: currentOutboundId || null,
        lockedOutboundId: lockedOutboundId || null,
        autoRouteEnabled: assignmentAutoRouteEnabled,
        routeLocked: assignmentRouteLocked,
        protocolProfile: protocolDraft.profile,
        speedProfile: protocolDraft.profile,
        hysteresisScoreDelta,
        cooldownSeconds,
      });
      const preview = await fetchRouteDecisionPreview(sessionToken, routeGroup, 'default');

      applyRouteAssignment(savedAssignment);
      setRouteDecisionPreview(preview);
      setRouteDecisionEventDetail(null);
      setRouteDecisionSwitchExecution(null);
      setRouteMode(mode);
      setRouteMessage(t.settings.routeSettingsSaved);
      setSettingsDataState('live');
    } catch (error) {
      setRouteMessage(t.settings.saveFailed);
    } finally {
      setIsRouteSaving(false);
    }
  };

  const saveTenantBranding = async () => {
    if (!canManageTenantBranding) {
      setTenantBrandMessage(t.settings.adminOnly);
      return;
    }

    setIsTenantBrandSaving(true);
    setTenantBrandMessage(null);

    try {
      const response = await updateAdminTenantBranding(sessionToken, {
        accentColor: tenantBrandForm.accentColor,
        clientAppTitle: tenantBrandForm.clientAppTitle,
        clientSupportMessage: normalizeNullableText(tenantBrandForm.clientSupportMessage),
        dashboardTitle: tenantBrandForm.dashboardTitle,
        displayName: tenantBrandForm.displayName,
        legalName: normalizeNullableText(tenantBrandForm.legalName),
        logoUrl: normalizeNullableText(tenantBrandForm.logoUrl),
        primaryColor: tenantBrandForm.primaryColor,
        publicBrandingEnabled: tenantBrandForm.publicBrandingEnabled,
        supportEmail: normalizeNullableText(tenantBrandForm.supportEmail),
        supportTelegram: normalizeNullableText(tenantBrandForm.supportTelegram),
        supportUrl: normalizeNullableText(tenantBrandForm.supportUrl),
        tenantSlug: tenantBrandForm.tenantSlug,
      });

      applyTenantBranding(response.branding);
      setTenantBrandMessage(t.settings.tenantBrandingSaved);
    } catch (error) {
      setTenantBrandMessage(t.settings.tenantBrandingSaveFailed);
    } finally {
      setIsTenantBrandSaving(false);
    }
  };

  const saveTelegramBotSettings = async (showSuccessMessage = true): Promise<AdminTelegramBotSettingsSummary | null> => {
    if (!canManageTelegramBot) {
      setTelegramBotMessage(t.settings.superadminRequired);
      return null;
    }

    setIsTelegramBotSaving(true);
    if (showSuccessMessage) setTelegramBotMessage(null);

    try {
      const response = await updateAdminTelegramBotSettings(sessionToken, {
        botToken: telegramBotForm.botToken.trim() || undefined,
        webhookSecret: telegramBotForm.webhookSecret.trim() || undefined,
        alertChatId: telegramBotForm.alertChatId.trim() || null,
        allowedAdminChatIds: parseTelegramChatIds(telegramBotForm.allowedAdminChatIds),
        alertsEnabled: telegramBotForm.alertsEnabled,
        commandsEnabled: telegramBotForm.commandsEnabled,
      });

      applyTelegramBotSettings(response.telegramBot);
      if (showSuccessMessage) setTelegramBotMessage(t.settings.telegramBotSaved);
      return response.telegramBot;
    } catch (error) {
      setTelegramBotMessage(t.settings.telegramBotSaveFailed);
      return null;
    } finally {
      setIsTelegramBotSaving(false);
    }
  };

  const testTelegramBotConnection = async () => {
    if (!canManageTelegramBot) {
      setTelegramBotMessage(t.settings.superadminRequired);
      return;
    }

    setIsTelegramBotTesting(true);
    setTelegramBotMessage(null);

    try {
      const saved = await saveTelegramBotSettings(false);
      if (!saved) return;

      const response = await testAdminTelegramBotConnection(sessionToken);
      applyTelegramBotSettings(response.telegramBot);
      setTelegramBotMessage(response.ok ? t.settings.telegramBotTestOk : t.settings.telegramBotTestFailed);
    } catch (error) {
      setTelegramBotMessage(t.settings.telegramBotTestFailed);
    } finally {
      setIsTelegramBotTesting(false);
    }
  };

  const recordDecisionEvent = async () => {
    setIsDecisionRecording(true);
    setRouteMessage(null);

    try {
      const routeGroup = protocolDraft.routeGroup.trim() || draft.routeGroup.trim() || 'main';
      const response = await recordRouteDecisionPreview(sessionToken, {
        routeGroup,
        assignmentKey: 'default',
      });

      setRouteDecisionPreview(response.preview);
      setRouteDecisionEvents((current) => [
        response.event,
        ...current.filter((event) => event.id !== response.event.id),
      ].slice(0, 10));
      setRouteDecisionEventDetail(null);
      setRouteDecisionSwitchExecution(null);
      setRouteMessage(t.settings.routeDecisionRecorded);
    } catch (error) {
      setRouteMessage(t.settings.routeDecisionRecordFailed);
    } finally {
      setIsDecisionRecording(false);
    }
  };

  const inspectDecisionEvent = async (eventId: string) => {
    setIsDecisionEventDetailLoading(true);
    setRouteMessage(null);

    try {
      const response = await fetchRouteDecisionEvent(sessionToken, eventId);

      setRouteDecisionEventDetail(response.event);
      setRouteDecisionSwitchExecution(response.event.switchExecution ?? null);
    } catch (error) {
      setRouteMessage(t.settings.decisionEventDetailFailed);
    } finally {
      setIsDecisionEventDetailLoading(false);
    }
  };

  const applyDecisionAssignment = async () => {
    setIsDecisionApplying(true);
    setRouteMessage(null);

    try {
      const routeGroup = protocolDraft.routeGroup.trim() || draft.routeGroup.trim() || 'main';
      const response = await applyRouteDecisionPreview(sessionToken, {
        routeGroup,
        assignmentKey: 'default',
        applyMode: 'assignmentOnly',
      });

      applyRouteAssignment(response.assignment);
      setRouteDecisionPreview(response.preview);
      setRouteDecisionSwitchExecution(response.switchExecution);
      setRouteDecisionEvents((current) => [
        response.event,
        ...current.filter((event) => event.id !== response.event.id),
      ].slice(0, 10));
      setRouteDecisionEventDetail(null);
      setRouteMessage(response.dataPlaneApplied ? t.settings.routeDecisionApplied : t.settings.routeDecisionAssignmentApplied);
    } catch (error) {
      setRouteMessage(t.settings.routeDecisionApplyFailed);
    } finally {
      setIsDecisionApplying(false);
    }
  };

  const validateWireGuardDraft = async () => {
    setValidationMessage(null);

    if (!draft.privateKey.trim() && !privateKeySecretRef) {
      setValidationMessage(t.settings.privateKeyRequired);
      return;
    }

    if (!hasTunnelShape) {
      setValidationMessage(t.settings.requiredFields);
      return;
    }

    const secretRef = await savePrivateKeySecret();
    if (!secretRef) return;

    setPrivateKeyAccepted(true);
    setValidationMessage(t.settings.draftReady);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void validateWireGuardDraft();
  };

  const clearDraft = () => {
    setDraft({
      serverName: '',
      interfaceName: 'wg0',
      routeGroup: 'main',
      addressCidr: '',
      listenPort: '51820',
      privateKey: '',
      peerPublicKey: '',
      endpoint: '',
      allowedIps: '0.0.0.0/0, ::/0',
      persistentKeepalive: '25',
      healthTarget: '',
    });
    setPrivateKeyAccepted(false);
    setPrivateKeySecretRef(null);
    setValidationMessage(null);
  };

  const settingsTabs: Array<DashboardTabItem<SettingsTab>> = [
    {
      id: 'route',
      label: t.tabs.settingsRoute,
      meta: routeMode === 'automatic' ? t.settings.automatic : t.settings.manual,
    },
    {
      id: 'wireguard',
      label: t.tabs.settingsWireGuard,
      meta: format.integer(wireGuardCandidates.length),
    },
    {
      id: 'protocols',
      label: t.tabs.settingsProtocols,
      meta: format.integer(persistedProtocolSetups.length),
    },
    {
      id: 'branding',
      label: t.tabs.settingsBranding,
      meta: tenantBrandForm.publicBrandingEnabled ? t.settings.enabled : t.settings.disabled,
    },
    {
      id: 'telegram',
      label: t.tabs.settingsTelegram,
      meta: telegramBotSettings?.hasBotToken ? t.settings.configured : t.settings.pending,
    },
  ];
  const settingsHasSideRail = activeSettingsTab === 'route' || activeSettingsTab === 'wireguard' || activeSettingsTab === 'protocols';

  return (
    <section className="mt-3 grid gap-3">
      <DashboardTabs
        activeTab={activeSettingsTab}
        ariaLabel={t.tabs.settingsSections}
        onChange={setActiveSettingsTab}
        tabs={settingsTabs}
      />

      <section className={settingsHasSideRail ? 'grid gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]' : 'grid gap-3'}>
      <section className="grid gap-3">
        <section className={`${panelClass} ${activeSettingsTab === 'route' ? '' : 'hidden'}`}>
          <PanelHeading title={t.panels.routeControl} icon={ArrowDownUp} meta={t.settings.smartRoute} />
          <div className="mt-3 grid gap-3">
            <div className="grid gap-2 sm:grid-cols-2">
              {(['automatic', 'manual'] as RouteSelectionMode[]).map((mode) => {
                const isSelected = routeMode === mode;

                return (
                  <button
                    aria-pressed={isSelected}
                    className={`min-h-10 rounded-md border px-3 text-sm font-bold transition ${isSelected ? 'border-afro-teal bg-[#e7f6ef] text-afro-green' : 'border-afro-line bg-white text-afro-ink hover:border-afro-teal hover:text-afro-teal'}`}
                    key={mode}
                    onClick={() => {
                      setRouteMode(mode);
                      setAssignmentAutoRouteEnabled(mode === 'automatic');
                      if (mode === 'manual' && !assignmentCurrentOutboundId && activeWireGuard.source === 'outbound') {
                        setAssignmentCurrentOutboundId(activeWireGuard.id);
                      }
                    }}
                    type="button"
                  >
                    {mode === 'automatic' ? t.settings.automatic : t.settings.manual}
                  </button>
                );
              })}
            </div>

            <p className="rounded-md border border-afro-line bg-white px-3 py-2 text-[13px] font-bold text-afro-muted">
              {routeModeDescription}
            </p>

            <div className="grid gap-2 rounded-md border border-afro-line bg-white p-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong className="text-[13px]">{t.settings.routeAssignment}</strong>
                <StatusBadge tone={assignmentRouteLocked ? 'warning' : assignmentAutoRouteEnabled ? 'good' : 'neutral'}>
                  {assignmentRouteLocked ? t.routePolicy.routeLock : assignmentAutoRouteEnabled ? t.routePolicy.autoRoute : t.settings.manual}
                </StatusBadge>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <label className="flex min-h-10 items-center justify-between gap-3 rounded-md border border-afro-line px-3 py-2">
                  <span className="text-[13px] font-bold text-afro-muted">{t.settings.autoRouteToggle}</span>
                  <input
                    checked={assignmentAutoRouteEnabled}
                    className="size-4 accent-afro-teal"
                    onChange={(event) => {
                      setAssignmentAutoRouteEnabled(event.target.checked);
                      setRouteMode(event.target.checked ? 'automatic' : 'manual');
                    }}
                    type="checkbox"
                  />
                </label>
                <label className="flex min-h-10 items-center justify-between gap-3 rounded-md border border-afro-line px-3 py-2">
                  <span className="text-[13px] font-bold text-afro-muted">{t.settings.routeLockToggle}</span>
                  <input
                    checked={assignmentRouteLocked}
                    className="size-4 accent-afro-teal"
                    onChange={(event) => {
                      setAssignmentRouteLocked(event.target.checked);
                      if (event.target.checked && !assignmentLockedOutboundId) {
                        setAssignmentLockedOutboundId(assignmentCurrentOutboundId || managedWireGuardCandidates[0]?.id || '');
                      }
                    }}
                    type="checkbox"
                  />
                </label>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <label className="grid gap-1.5">
                  <span className="text-[13px] font-bold text-afro-muted">{t.settings.currentManagedRoute}</span>
                  <select
                    className="min-h-10 rounded-md border border-afro-line bg-white px-3 text-sm font-bold outline-none ring-afro-teal/20 focus:border-afro-teal focus:ring-4"
                    onChange={(event) => {
                      setAssignmentCurrentOutboundId(event.target.value);
                      if (!assignmentLockedOutboundId) setAssignmentLockedOutboundId(event.target.value);
                    }}
                    value={assignmentCurrentOutboundId}
                  >
                    <option value="">{t.settings.noManagedRouteSelected}</option>
                    {managedWireGuardCandidates.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {format.label(candidate.name)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1.5">
                  <span className="text-[13px] font-bold text-afro-muted">{t.settings.lockedManagedRoute}</span>
                  <select
                    className="min-h-10 rounded-md border border-afro-line bg-white px-3 text-sm font-bold outline-none ring-afro-teal/20 focus:border-afro-teal focus:ring-4 disabled:opacity-50"
                    disabled={!assignmentRouteLocked}
                    onChange={(event) => setAssignmentLockedOutboundId(event.target.value)}
                    value={assignmentLockedOutboundId}
                  >
                    <option value="">{t.settings.noManagedRouteSelected}</option>
                    {managedWireGuardCandidates.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {format.label(candidate.name)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <SettingsInput inputMode="numeric" label={t.settings.hysteresisScoreDelta} onChange={setAssignmentHysteresisScoreDelta} value={assignmentHysteresisScoreDelta} />
                <SettingsInput inputMode="numeric" label={t.settings.cooldownSeconds} onChange={setAssignmentCooldownSeconds} value={assignmentCooldownSeconds} />
              </div>
              {managedWireGuardCandidates.length === 0 ? <p className="text-[12px] font-bold text-afro-muted">{t.settings.noManagedWireGuard}</p> : null}
            </div>

            <div>
              <div className="mb-1.5 text-[13px] font-bold text-afro-muted">{t.settings.loadBalanceStrategy}</div>
              <div className="grid gap-2 md:grid-cols-3">
                {loadBalanceOptions.map(([value, label]) => {
                  const isSelected = loadBalanceStrategy === value;

                  return (
                    <button
                      aria-pressed={isSelected}
                      className={`min-h-10 rounded-md border px-3 text-sm font-bold transition ${isSelected ? 'border-afro-blue bg-[#edf4ff] text-afro-blue' : 'border-afro-line bg-white text-afro-ink hover:border-afro-blue hover:text-afro-blue'}`}
                      key={value}
                      onClick={() => setLoadBalanceStrategy(value)}
                      type="button"
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {routeMode === 'manual' ? (
              <div>
                <div className="mb-1.5 text-[13px] font-bold text-afro-muted">{t.settings.manualWireGuard}</div>
                <div className="grid gap-2 md:grid-cols-3">
                  {wireGuardCandidates.map((candidate) => {
                    const isSelected = selectedWireGuard.id === candidate.id;

                    return (
                      <button
                        aria-pressed={isSelected}
                        className={`grid min-h-[74px] gap-1 rounded-md border px-3 py-2 text-start transition ${isSelected ? 'border-afro-teal bg-[#e7f6ef]' : 'border-afro-line bg-white hover:border-afro-teal'}`}
                        key={candidate.id}
                        onClick={() => setSelectedWireGuardId(candidate.id)}
                        type="button"
                      >
                        <span className="truncate text-sm font-bold text-afro-ink">{candidate.name}</span>
                        <span className="truncate text-[12px] text-afro-muted" dir="ltr">{candidate.endpoint ?? '-'}</span>
                        <span className="inline-flex flex-wrap items-center gap-1">
                          <StatusBadge tone={getWireGuardScoreTone(candidate.score)}>{format.percent(candidate.score)}</StatusBadge>
                          <StatusBadge tone={candidate.source === 'agent' ? 'good' : 'neutral'}>
                            {wireGuardCandidateSourceLabel(candidate, t)}
                          </StatusBadge>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex min-h-10 flex-wrap items-center justify-between gap-2 rounded-md border border-afro-line bg-white px-3 py-2">
                <span className="text-[13px] font-bold text-afro-muted">{t.settings.autoRecommendation}</span>
                <div className="flex min-w-0 items-center gap-2">
                  <strong className="min-w-0 truncate text-sm">{bestWireGuard.name}</strong>
                  <StatusBadge tone={getWireGuardScoreTone(bestWireGuard.score)}>{t.settings.bestHealth}</StatusBadge>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-afro-line pt-3">
              <span className="text-[13px] font-bold text-afro-muted">
                {settingsDataState === 'live' ? t.settings.settingsStorageReady : t.settings.localDraftOnly}
              </span>
              <button
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-afro-sidebar px-4 text-sm font-bold text-white hover:bg-[#1f3138] disabled:cursor-wait disabled:opacity-60"
                disabled={isRouteSaving}
                onClick={() => void saveRouteSettings()}
                type="button"
              >
                <CheckCircle2 size={16} />
                {isRouteSaving ? t.settings.saving : t.settings.saveRouteSettings}
              </button>
            </div>
            {routeMessage ? <p className="text-[13px] font-bold text-afro-teal">{routeMessage}</p> : null}
          </div>
        </section>

        <section className={`${panelClass} ${activeSettingsTab === 'branding' ? '' : 'hidden'}`}>
          <PanelHeading title={t.panels.tenantBranding} icon={Palette} meta={canManageTenantBranding ? t.settings.adminReady : t.settings.adminOnly} />
          <form className="mt-3 grid gap-3" onSubmit={(event) => { event.preventDefault(); void saveTenantBranding(); }}>
            <div className="grid gap-2 md:grid-cols-3">
              <SettingsInput
                disabled={!canManageTenantBranding}
                label={t.settings.tenantSlug}
                onChange={(value) => updateTenantBrandForm('tenantSlug', value)}
                required
                value={tenantBrandForm.tenantSlug}
              />
              <SettingsInput
                disabled={!canManageTenantBranding}
                label={t.settings.brandDisplayName}
                onChange={(value) => updateTenantBrandForm('displayName', value)}
                required
                value={tenantBrandForm.displayName}
              />
              <SettingsInput
                disabled={!canManageTenantBranding}
                label={t.settings.brandLegalName}
                onChange={(value) => updateTenantBrandForm('legalName', value)}
                value={tenantBrandForm.legalName}
              />
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <SettingsInput
                disabled={!canManageTenantBranding}
                label={t.settings.dashboardTitle}
                onChange={(value) => updateTenantBrandForm('dashboardTitle', value)}
                required
                value={tenantBrandForm.dashboardTitle}
              />
              <SettingsInput
                disabled={!canManageTenantBranding}
                label={t.settings.clientAppTitle}
                onChange={(value) => updateTenantBrandForm('clientAppTitle', value)}
                required
                value={tenantBrandForm.clientAppTitle}
              />
            </div>
            <div className="grid gap-2 md:grid-cols-3">
              <SettingsInput
                disabled={!canManageTenantBranding}
                label={t.settings.supportEmail}
                onChange={(value) => updateTenantBrandForm('supportEmail', value)}
                value={tenantBrandForm.supportEmail}
              />
              <SettingsInput
                disabled={!canManageTenantBranding}
                label={t.settings.supportTelegram}
                onChange={(value) => updateTenantBrandForm('supportTelegram', value)}
                value={tenantBrandForm.supportTelegram}
              />
              <SettingsInput
                disabled={!canManageTenantBranding}
                label={t.settings.supportUrl}
                onChange={(value) => updateTenantBrandForm('supportUrl', value)}
                value={tenantBrandForm.supportUrl}
              />
            </div>
            <div className="grid gap-2 md:grid-cols-3">
              <SettingsInput
                disabled={!canManageTenantBranding}
                label={t.settings.logoUrl}
                onChange={(value) => updateTenantBrandForm('logoUrl', value)}
                value={tenantBrandForm.logoUrl}
              />
              <label className="grid gap-1.5">
                <span className="text-[13px] font-bold text-afro-muted">{t.settings.primaryColor}</span>
                <span className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-2">
                  <span
                    aria-hidden="true"
                    className="min-h-10 rounded-md border border-afro-line"
                    style={{ backgroundColor: tenantBrandForm.primaryColor }}
                  />
                  <input
                    className="min-h-10 w-full rounded-md border border-afro-line bg-white px-3 text-sm font-bold text-afro-ink outline-none ring-afro-teal/20 focus:border-afro-teal focus:ring-4 disabled:opacity-45"
                    disabled={!canManageTenantBranding}
                    dir="ltr"
                    onChange={(event) => updateTenantBrandForm('primaryColor', event.target.value)}
                    value={tenantBrandForm.primaryColor}
                  />
                </span>
              </label>
              <label className="grid gap-1.5">
                <span className="text-[13px] font-bold text-afro-muted">{t.settings.accentColor}</span>
                <span className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-2">
                  <span
                    aria-hidden="true"
                    className="min-h-10 rounded-md border border-afro-line"
                    style={{ backgroundColor: tenantBrandForm.accentColor }}
                  />
                  <input
                    className="min-h-10 w-full rounded-md border border-afro-line bg-white px-3 text-sm font-bold text-afro-ink outline-none ring-afro-teal/20 focus:border-afro-teal focus:ring-4 disabled:opacity-45"
                    disabled={!canManageTenantBranding}
                    dir="ltr"
                    onChange={(event) => updateTenantBrandForm('accentColor', event.target.value)}
                    value={tenantBrandForm.accentColor}
                  />
                </span>
              </label>
            </div>
            <label className="grid gap-1.5">
              <span className="text-[13px] font-bold text-afro-muted">{t.settings.clientSupportMessage}</span>
              <textarea
                className="min-h-20 w-full resize-y rounded-md border border-afro-line bg-white px-3 py-2 text-sm font-bold text-afro-ink outline-none ring-afro-teal/20 focus:border-afro-teal focus:ring-4 disabled:opacity-45"
                disabled={!canManageTenantBranding}
                onChange={(event) => updateTenantBrandForm('clientSupportMessage', event.target.value)}
                value={tenantBrandForm.clientSupportMessage}
              />
            </label>
            <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.7fr)]">
              <div className="grid gap-2">
                {tenantBrandingRows.map(([label, value, tone]) => (
                  <div className="flex min-h-9 items-center justify-between gap-2 rounded-md border border-afro-line px-2.5" key={label}>
                    <span className={`${mutedTextClass} min-w-0 truncate`}>{label}</span>
                    <StatusBadge tone={tone}>{value}</StatusBadge>
                  </div>
                ))}
                <label className="flex min-h-10 items-center justify-between gap-3 rounded-md border border-afro-line px-3 py-2">
                  <span className="text-[13px] font-bold text-afro-muted">{t.settings.publicBranding}</span>
                  <input
                    checked={tenantBrandForm.publicBrandingEnabled}
                    className="size-4 accent-afro-teal"
                    disabled={!canManageTenantBranding}
                    onChange={(event) => updateTenantBrandForm('publicBrandingEnabled', event.target.checked)}
                    type="checkbox"
                  />
                </label>
              </div>
              <div className="grid gap-2 rounded-md border border-afro-line bg-white p-2.5">
                <div
                  className="flex min-h-16 items-center gap-3 rounded-md px-3 py-2 text-white"
                  style={{ backgroundColor: tenantBrandForm.primaryColor }}
                >
                  {tenantBrandForm.logoUrl ? (
                    <img
                      alt=""
                      className="size-10 rounded-md border border-white/40 bg-white object-contain"
                      src={tenantBrandForm.logoUrl}
                    />
                  ) : (
                    <span
                      className="inline-flex size-10 items-center justify-center rounded-md border border-white/40 text-sm font-black"
                      style={{ backgroundColor: tenantBrandForm.accentColor }}
                    >
                      {tenantBrandForm.displayName.slice(0, 2).toUpperCase() || 'AG'}
                    </span>
                  )}
                  <span className="min-w-0">
                    <strong className="block truncate text-base">{tenantBrandForm.displayName || t.settings.brandDisplayName}</strong>
                    <span className="block truncate text-[12px] font-bold text-white/85">{tenantBrandForm.clientAppTitle || t.settings.clientAppTitle}</span>
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <StatusBadge tone="neutral">{tenantBrandForm.dashboardTitle || t.settings.dashboardTitle}</StatusBadge>
                  <StatusBadge tone={tenantBrandForm.publicBrandingEnabled ? 'good' : 'neutral'}>
                    {tenantBrandForm.publicBrandingEnabled ? t.settings.enabled : t.settings.disabled}
                  </StatusBadge>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-afro-line pt-3">
              <p className="min-w-0 text-[13px] font-bold text-afro-muted">{t.settings.tenantBrandingNote}</p>
              <button
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-afro-sidebar px-4 text-sm font-bold text-white hover:bg-[#1f3138] disabled:cursor-wait disabled:opacity-60"
                disabled={!canManageTenantBranding || isTenantBrandSaving}
                type="submit"
              >
                <CheckCircle2 size={16} />
                {isTenantBrandSaving ? t.settings.saving : t.settings.saveTenantBranding}
              </button>
            </div>
            {tenantBrandMessage ? <p className="text-[13px] font-bold text-afro-teal">{tenantBrandMessage}</p> : null}
          </form>
        </section>

        <section className={`${panelClass} ${activeSettingsTab === 'telegram' ? '' : 'hidden'}`}>
          <PanelHeading title={t.panels.telegramBotSetup} icon={Bot} meta={canManageTelegramBot ? t.settings.superadminReady : t.settings.superadminOnly} />
          <div className="mt-3 grid gap-3">
            <div className="grid gap-2 md:grid-cols-2">
              <SettingsInput
                autoComplete="off"
                disabled={!canManageTelegramBot}
                label={t.settings.telegramBotToken}
                onChange={(value) => updateTelegramBotForm('botToken', value)}
                placeholder={telegramBotSettings?.hasBotToken ? telegramSecretSourceLabel(telegramBotSettings.botTokenSource, t) : ''}
                type="password"
                value={telegramBotForm.botToken}
              />
              <SettingsInput
                autoComplete="off"
                disabled={!canManageTelegramBot}
                label={t.settings.telegramWebhookSecret}
                onChange={(value) => updateTelegramBotForm('webhookSecret', value)}
                placeholder={telegramBotSettings?.hasWebhookSecret ? telegramSecretSourceLabel(telegramBotSettings.webhookSecretSource, t) : ''}
                type="password"
                value={telegramBotForm.webhookSecret}
              />
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <SettingsInput
                disabled={!canManageTelegramBot}
                inputMode="numeric"
                label={t.settings.telegramAlertChatId}
                onChange={(value) => updateTelegramBotForm('alertChatId', value)}
                value={telegramBotForm.alertChatId}
              />
              <SettingsInput
                disabled={!canManageTelegramBot}
                label={t.settings.telegramAllowedAdminChatIds}
                onChange={(value) => updateTelegramBotForm('allowedAdminChatIds', value)}
                value={telegramBotForm.allowedAdminChatIds}
              />
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <label className="flex min-h-10 items-center justify-between gap-3 rounded-md border border-afro-line px-3 py-2">
                <span className="text-[13px] font-bold text-afro-muted">{t.settings.telegramAlertsEnabled}</span>
                <input
                  checked={telegramBotForm.alertsEnabled}
                  className="size-4 accent-afro-teal"
                  disabled={!canManageTelegramBot}
                  onChange={(event) => updateTelegramBotForm('alertsEnabled', event.target.checked)}
                  type="checkbox"
                />
              </label>
              <label className="flex min-h-10 items-center justify-between gap-3 rounded-md border border-afro-line px-3 py-2">
                <span className="text-[13px] font-bold text-afro-muted">{t.settings.telegramCommandsEnabled}</span>
                <input
                  checked={telegramBotForm.commandsEnabled}
                  className="size-4 accent-afro-teal"
                  disabled={!canManageTelegramBot}
                  onChange={(event) => updateTelegramBotForm('commandsEnabled', event.target.checked)}
                  type="checkbox"
                />
              </label>
            </div>
            <div className="grid gap-2">
              {telegramBotReadinessRows.map(([label, value, tone]) => (
                <div className="flex min-h-9 items-center justify-between gap-2 rounded-md border border-afro-line px-2.5" key={label}>
                  <span className={`${mutedTextClass} min-w-0 truncate`}>{label}</span>
                  <StatusBadge tone={tone}>{value}</StatusBadge>
                </div>
              ))}
            </div>
            {telegramBotSettings?.botUsername || telegramBotSettings?.botFirstName ? (
              <div className="flex min-h-10 flex-wrap items-center justify-between gap-2 rounded-md border border-afro-line bg-white px-3 py-2">
                <span className="text-[13px] font-bold text-afro-muted">{t.settings.telegramBotIdentity}</span>
                <strong className="min-w-0 truncate text-sm" dir="ltr">
                  {telegramBotSettings.botUsername ? `@${telegramBotSettings.botUsername}` : telegramBotSettings.botFirstName}
                </strong>
              </div>
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-afro-line pt-3">
              <div className="flex min-w-0 items-center gap-2 text-[13px] text-afro-muted">
                <LockKeyhole className="shrink-0" size={16} />
                <span className="min-w-0 truncate">{t.settings.telegramBotWriteOnly}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-afro-line px-4 text-sm font-bold text-afro-ink hover:border-afro-blue hover:text-afro-blue disabled:cursor-wait disabled:opacity-60"
                  disabled={!canManageTelegramBot || isTelegramBotTesting || isTelegramBotSaving}
                  onClick={() => void testTelegramBotConnection()}
                  type="button"
                >
                  <ShieldCheck size={16} />
                  {isTelegramBotTesting ? t.settings.testing : t.settings.testTelegramBotApi}
                </button>
                <button
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-afro-sidebar px-4 text-sm font-bold text-white hover:bg-[#1f3138] disabled:cursor-wait disabled:opacity-60"
                  disabled={!canManageTelegramBot || isTelegramBotSaving || isTelegramBotTesting}
                  onClick={() => void saveTelegramBotSettings()}
                  type="button"
                >
                  <CheckCircle2 size={16} />
                  {isTelegramBotSaving ? t.settings.saving : t.settings.saveTelegramBotSettings}
                </button>
              </div>
            </div>
            {telegramBotMessage ? <p className="text-[13px] font-bold text-afro-teal">{telegramBotMessage}</p> : null}
          </div>
        </section>

        <section className={`${panelClass} ${activeSettingsTab === 'protocols' ? '' : 'hidden'}`}>
          <PanelHeading title={t.panels.protocolFactory} icon={Plus} meta={canCreateProtocols ? t.settings.superadminReady : t.settings.superadminOnly} />
          <div className="mt-3 grid gap-3">
            <div>
              <div className="mb-1.5 text-[13px] font-bold text-afro-muted">{t.settings.protocol}</div>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {protocolOptions.map(([value, label]) => {
                  const isSelected = protocolDraft.protocol === value;

                  return (
                    <button
                      aria-pressed={isSelected}
                      className={`min-h-10 rounded-md border px-3 text-sm font-bold transition ${isSelected ? 'border-afro-teal bg-[#e7f6ef] text-afro-green' : 'border-afro-line bg-white text-afro-ink hover:border-afro-teal hover:text-afro-teal'}`}
                      key={value}
                      onClick={() => selectProtocol(value)}
                      type="button"
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="mb-1.5 text-[13px] font-bold text-afro-muted">{t.settings.protocolProfile}</div>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {profileOptions.map(([value, label]) => {
                  const isSelected = protocolDraft.profile === value;

                  return (
                    <button
                      aria-pressed={isSelected}
                      className={`min-h-10 rounded-md border px-3 text-sm font-bold transition ${isSelected ? 'border-afro-blue bg-[#edf4ff] text-afro-blue' : 'border-afro-line bg-white text-afro-ink hover:border-afro-blue hover:text-afro-blue'}`}
                      key={value}
                      onClick={() => updateProtocolDraft('profile', value)}
                      type="button"
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-2 md:grid-cols-4">
              <SettingsInput label={t.settings.protocolName} onChange={(value) => updateProtocolDraft('name', value)} required value={protocolDraft.name} />
              <SettingsInput inputMode="numeric" label={t.settings.protocolPort} onChange={(value) => updateProtocolDraft('port', value)} required value={protocolDraft.port} />
              <SettingsInput label={t.settings.routeGroup} onChange={(value) => updateProtocolDraft('routeGroup', value)} required value={protocolDraft.routeGroup} />
              <SettingsSelect
                label={t.settings.targetServer}
                onChange={(value) => updateProtocolDraft('targetServerId', value)}
                options={[{ label: t.settings.noTargetServer, value: '' }, ...targetServerOptions]}
                value={protocolDraft.targetServerId}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-afro-line pt-3">
              <p className="min-w-0 text-[13px] font-bold text-afro-muted">{t.settings.protocolFactoryNote}</p>
              <button
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-afro-sidebar px-4 text-sm font-bold text-white hover:bg-[#1f3138] disabled:cursor-not-allowed disabled:opacity-55"
                disabled={!canCreateProtocols || isProtocolSaving}
                onClick={() => void createProtocolDraft()}
                type="button"
              >
                <Plus size={16} />
                {isProtocolSaving ? t.settings.saving : t.settings.createProtocolDraft}
              </button>
            </div>
            {protocolMessage ? <p className="text-[13px] font-bold text-afro-teal">{protocolMessage}</p> : null}
            {persistedProtocolSetups.length > 0 ? (
              <div className="grid gap-2 border-t border-afro-line pt-3">
                <div className="text-[13px] font-bold text-afro-muted">{t.settings.persistedDrafts}</div>
                <div className="grid gap-2 md:grid-cols-2">
                  {persistedProtocolSetups.slice(0, 4).map((setup) => {
                    const isProvisioned = Boolean(setup.provisionedOutboundId);
                    const isProvisioning = provisioningSetupId === setup.id;
                    const isServerApplying = serverApplyingSetupId === setup.id;
                    const isServerLiveApplying = serverLiveApplyingSetupId === setup.id;
                    const lastServerApplyEvent = protocolApplyEventsBySetupId[setup.id];
                    const serverApplyPlan = setup.serverApplyPlan;

                    return (
                      <div className="grid gap-2 rounded-md border border-afro-line bg-white px-2.5 py-2" key={setup.id}>
                        <div className="flex min-h-10 items-center justify-between gap-2">
                          <div className="min-w-0">
                            <strong className="block truncate text-[13px]">{setup.name}</strong>
                            <span className="block truncate text-[12px] text-afro-muted">
                              {setup.protocol} / {setup.routeGroup}
                              {setup.targetServerLabel ? ` / ${setup.targetServerLabel}` : ''}
                              {isProvisioned ? ` / ${t.settings.managedOutbound}` : ''}
                            </span>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <StatusBadge tone={isProvisioned || setup.hasSecretRef ? 'good' : 'neutral'}>
                              {isProvisioned ? t.settings.provisioned : setup.status}
                            </StatusBadge>
                            {!isProvisioned ? (
                              <button
                                className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-md border border-afro-line px-2.5 text-[12px] font-bold text-afro-ink hover:border-afro-teal hover:text-afro-teal disabled:cursor-wait disabled:opacity-55"
                                disabled={!canCreateProtocols || Boolean(provisioningSetupId)}
                                onClick={() => void provisionProtocolDraft(setup)}
                                type="button"
                              >
                                <CheckCircle2 size={14} />
                                {isProvisioning ? t.settings.provisioning : t.settings.provisionDraft}
                              </button>
                            ) : null}
                            {isProvisioned ? (
                              <>
                                <button
                                  className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-md border border-afro-line px-2.5 text-[12px] font-bold text-afro-ink hover:border-afro-blue hover:text-afro-blue disabled:cursor-wait disabled:opacity-55"
                                  disabled={!canCreateProtocols || Boolean(serverApplyingSetupId) || Boolean(serverLiveApplyingSetupId)}
                                  onClick={() => void recordProtocolServerApplyDryRun(setup)}
                                  type="button"
                                >
                                  <ShieldCheck size={14} />
                                  {isServerApplying ? t.settings.recordingServerApply : t.settings.recordServerApplyDryRun}
                                </button>
                                <button
                                  className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-md border border-afro-line px-2.5 text-[12px] font-bold text-afro-ink hover:border-[#f0b7b7] hover:text-[#b91c1c] disabled:cursor-wait disabled:opacity-55"
                                  disabled={!canCreateProtocols || Boolean(serverApplyingSetupId) || Boolean(serverLiveApplyingSetupId)}
                                  onClick={() => void requestProtocolServerApplyLive(setup)}
                                  type="button"
                                >
                                  <AlertTriangle size={14} />
                                  {isServerLiveApplying ? t.settings.requestingServerApplyLive : t.settings.requestServerApplyLive}
                                </button>
                              </>
                            ) : null}
                          </div>
                        </div>
                        {serverApplyPlan ? <ProtocolServerApplyPlanCard format={format} plan={serverApplyPlan} t={t} /> : null}
                        {lastServerApplyEvent ? (
                          <div className="flex min-h-8 flex-wrap items-center justify-between gap-2 rounded-md border border-afro-line bg-[#f9fbfc] px-2 text-[12px]">
                            <span className="font-bold text-afro-muted">{t.settings.serverApplyEventRecorded}</span>
                            <span className="flex min-w-0 items-center gap-1.5">
                              <StatusBadge tone={lastServerApplyEvent.secretSafe ? 'good' : 'warning'}>
                                {lastServerApplyEvent.secretSafe ? t.settings.secretSafe : t.settings.serverApplyBlocked}
                              </StatusBadge>
                              <strong className="truncate">{format.time(new Date(lastServerApplyEvent.createdAt), false)}</strong>
                            </span>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
            <ProtocolApplyEventsPanel
              eventDetail={protocolApplyEventDetail}
              events={protocolApplyEvents}
              format={format}
              isDetailLoading={isProtocolApplyEventDetailLoading}
              onInspectEvent={(eventId) => void inspectProtocolApplyEvent(eventId)}
              t={t}
            />
            {provisionMessage ? <p className="text-[13px] font-bold text-afro-teal">{provisionMessage}</p> : null}
            {serverApplyMessage ? <p className="text-[13px] font-bold text-afro-teal">{serverApplyMessage}</p> : null}
          </div>
        </section>

        <section className={`${panelClass} ${activeSettingsTab === 'wireguard' ? '' : 'hidden'}`}>
          <PanelHeading title={t.panels.wireguardSetup} icon={SettingsIcon} meta={t.settings.guidedSetup} />
          <form className="mt-3 grid gap-3" onSubmit={handleSubmit}>
            <div className="grid gap-2 md:grid-cols-3">
              <SettingsInput label={t.settings.serverName} onChange={(value) => updateDraft('serverName', value)} value={draft.serverName} />
              <SettingsInput label={t.settings.interfaceName} onChange={(value) => updateDraft('interfaceName', value)} required value={draft.interfaceName} />
              <SettingsInput label={t.settings.routeGroup} onChange={(value) => updateDraft('routeGroup', value)} required value={draft.routeGroup} />
            </div>

            <div className="grid gap-2 md:grid-cols-3">
              <SettingsInput label={t.settings.addressCidr} onChange={(value) => updateDraft('addressCidr', value)} placeholder="10.10.0.2/32" required value={draft.addressCidr} />
              <SettingsInput inputMode="numeric" label={t.settings.listenPort} onChange={(value) => updateDraft('listenPort', value)} required value={draft.listenPort} />
              <SettingsInput inputMode="numeric" label={t.settings.keepalive} onChange={(value) => updateDraft('persistentKeepalive', value)} value={draft.persistentKeepalive} />
            </div>

            <div className="grid gap-2 md:grid-cols-2">
              <SettingsInput autoComplete="off" label={t.settings.privateKey} onChange={(value) => updateDraft('privateKey', value)} required type="password" value={draft.privateKey} />
              <SettingsInput autoComplete="off" label={t.settings.peerPublicKey} onChange={(value) => updateDraft('peerPublicKey', value)} required value={draft.peerPublicKey} />
            </div>

            <div className="grid gap-2 md:grid-cols-2">
              <SettingsInput label={t.settings.endpoint} onChange={(value) => updateDraft('endpoint', value)} placeholder="gateway.example.com:51820" required value={draft.endpoint} />
              <SettingsInput label={t.settings.allowedIps} onChange={(value) => updateDraft('allowedIps', value)} required value={draft.allowedIps} />
            </div>

            <SettingsInput label={t.settings.healthTarget} onChange={(value) => updateDraft('healthTarget', value)} placeholder="https://example.com/health" value={draft.healthTarget} />

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-afro-line pt-3">
              <div className="flex min-w-0 items-center gap-2 text-[13px] text-afro-muted">
                <LockKeyhole className="shrink-0" size={16} />
                <span className="min-w-0 truncate">{t.settings.writeOnlySecret}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="inline-flex min-h-10 items-center justify-center rounded-md border border-afro-line px-4 text-sm font-bold text-afro-ink hover:border-afro-teal hover:text-afro-teal" onClick={clearDraft} type="button">
                  {t.settings.clearDraft}
                </button>
                <button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-afro-sidebar px-4 text-sm font-bold text-white hover:bg-[#1f3138] disabled:cursor-wait disabled:opacity-60" disabled={isSecretSaving} type="submit">
                  <CheckCircle2 size={16} />
                  {isSecretSaving ? t.settings.saving : t.settings.validateDraft}
                </button>
              </div>
            </div>
            {validationMessage ? <p className="text-[13px] font-bold text-afro-teal">{validationMessage}</p> : null}
          </form>
        </section>
      </section>

      <section className={`grid gap-3 ${settingsHasSideRail ? '' : 'hidden'}`}>
        <section className={`${panelClass} ${activeSettingsTab === 'wireguard' || activeSettingsTab === 'protocols' ? '' : 'hidden'}`}>
          <PanelHeading title={t.panels.setupReadiness} icon={ShieldCheck} meta={t.settings.secretSafe} />
          <div className="mt-2 grid gap-2">
            {readinessRows.map(([label, value, tone]) => (
              <div className="flex min-h-9 items-center justify-between gap-2 rounded-md border border-afro-line px-2.5" key={label}>
                <span className={`${mutedTextClass} min-w-0 truncate`}>{label}</span>
                <StatusBadge tone={tone}>{value}</StatusBadge>
              </div>
            ))}
          </div>
        </section>

        <section className={`${panelClass} ${activeSettingsTab === 'wireguard' ? '' : 'hidden'}`}>
          <PanelHeading title={t.panels.wireguardHealth} icon={Gauge} meta={t.settings.healthChecked} />
          <div className="mt-2 grid gap-2">
            {wireGuardCandidates.map((candidate) => (
              <div className="grid gap-2 rounded-md border border-afro-line px-2.5 py-2" key={candidate.id}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <strong className="block truncate text-[13px]">{candidate.name}</strong>
                    <span className="block truncate text-[12px] text-afro-muted" dir="ltr">{candidate.endpoint ?? '-'}</span>
                  </div>
                  <span className="inline-flex shrink-0 flex-wrap justify-end gap-1">
                    <StatusBadge tone={candidate.source === 'agent' ? 'good' : 'neutral'}>
                      {wireGuardCandidateSourceLabel(candidate, t)}
                    </StatusBadge>
                    <StatusBadge tone={getWireGuardScoreTone(candidate.score)}>{format.percent(candidate.score)}</StatusBadge>
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-[12px] md:grid-cols-4">
                  <MetricPill icon={Clock} label={t.settings.latency} value={format.latency(candidate.latencyMs ?? null)} />
                  <MetricPill icon={ArrowDownUp} label={t.settings.jitter} value={format.latency(candidate.jitterMs ?? null)} />
                  <MetricPill icon={AlertTriangle} label={t.settings.packetLoss} value={format.packetLoss(candidate.packetLossPercent ?? null)} />
                  <MetricPill icon={Gauge} label={t.settings.load} value={format.percent(candidate.loadPercent ?? null)} />
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-[12px] md:grid-cols-3">
                  <MetricPill icon={Network} label={t.settings.peers} value={formatWireGuardCandidatePeers(candidate, format, t)} />
                  <MetricPill icon={Clock} label={t.settings.latestHandshake} value={formatWireGuardCandidateHandshake(candidate, format, t)} />
                  <MetricPill icon={ArrowDownUp} label={t.settings.throughput} value={formatWireGuardCandidateRate(candidate, format)} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className={activeSettingsTab === 'route' ? '' : 'hidden'}>
          <RouteIntelligencePanel analytics={routeQualityAnalytics} format={format} t={t} />
        </div>

        <div className={activeSettingsTab === 'route' ? '' : 'hidden'}>
          <RouteDecisionPreviewPanel
            eventDetail={routeDecisionEventDetail}
            events={routeDecisionEvents}
            format={format}
            isApplying={isDecisionApplying}
            isEventDetailLoading={isDecisionEventDetailLoading}
            isRecording={isDecisionRecording}
            onApply={() => void applyDecisionAssignment()}
            onInspectEvent={(eventId) => void inspectDecisionEvent(eventId)}
            onRecord={() => void recordDecisionEvent()}
            preview={routeDecisionPreview}
            switchExecution={routeDecisionSwitchExecution}
            t={t}
          />
        </div>

        <section className={`${panelClass} ${activeSettingsTab === 'wireguard' || activeSettingsTab === 'protocols' ? '' : 'hidden'}`}>
          <PanelHeading title={t.panels.setupPreview} icon={Route} meta={t.settings.noSecretEcho} />
          <div className="mt-2 grid gap-2">
            {previewRows.map(([label, value]) => (
              <div className="grid min-h-9 grid-cols-[minmax(96px,0.42fr)_minmax(0,1fr)] items-center gap-2 rounded-md border border-afro-line px-2.5" key={label}>
                <span className={`${mutedTextClass} min-w-0 truncate`}>{label}</span>
                <strong className="min-w-0 truncate text-[13px]" dir="ltr">{value}</strong>
              </div>
            ))}
          </div>
        </section>
      </section>
    </section>
    </section>
  );
}





function createProtocolSetupConfig(
  draft: WireGuardSetupDraft,
  routeMode: RouteSelectionMode,
  loadBalanceStrategy: LoadBalanceStrategy,
  activeWireGuard: WireGuardHealthCandidate,
  targetServer: ServerRowData | null,
): Record<string, unknown> {
  return {
    serverName: draft.serverName.trim() || undefined,
    interfaceName: draft.interfaceName.trim() || undefined,
    routeGroup: draft.routeGroup.trim() || undefined,
    addressCidr: draft.addressCidr.trim() || undefined,
    listenPort: Number(draft.listenPort) || undefined,
    peerPublicKeyPresent: Boolean(draft.peerPublicKey.trim()),
    peerPublicKey: draft.peerPublicKey.trim() || undefined,
    endpoint: draft.endpoint.trim() || undefined,
    allowedIps: draft.allowedIps.trim() || undefined,
    persistentKeepalive: Number(draft.persistentKeepalive) || undefined,
    healthTarget: draft.healthTarget.trim() || undefined,
    routeMode,
    loadBalanceStrategy,
    activeWireGuardId: activeWireGuard.source === 'outbound' ? activeWireGuard.id : undefined,
    activeWireGuardSource: activeWireGuard.source,
    activeWireGuardInterfaceName: activeWireGuard.interfaceName ?? undefined,
    activeWireGuardServerExternalId: activeWireGuard.serverExternalId ?? undefined,
    targetServerId: targetServer?.id,
    targetServerLabel: targetServer?.name,
    targetServerExternalId: targetServer?.externalId,
  };
}

function outboundToWireGuardCandidate(outbound: AdminOutboundSummary): AdminWireGuardCandidate | null {
  if (outbound.type !== 'wireguard') return null;

  return {
    id: outbound.id,
    name: outbound.name,
    endpoint: extractEndpointFromConfig(outbound.config),
    routeGroup: outbound.routeGroup,
    healthStatus: outbound.healthStatus,
    score: outbound.enabled && !outbound.maintenanceMode ? 55 : 0,
    latencyMs: null,
    jitterMs: null,
    packetLossPercent: null,
    loadPercent: outbound.weight > 0 ? Math.max(0, 100 - Math.min(outbound.weight, 100)) : null,
    serverExternalId: outbound.serverExternalId ?? null,
    serverHostname: outbound.serverHostname ?? null,
    interfaceName: typeof outbound.config.interfaceName === 'string' ? outbound.config.interfaceName : null,
    peerCount: null,
    activePeerCount: null,
    latestHandshakeAgeSeconds: null,
    rxBps: null,
    txBps: null,
    checkedAt: outbound.lastCheckedAt,
    source: 'outbound',
  };
}

function extractEndpointFromConfig(config: Record<string, unknown>): string | null {
  for (const key of ['endpoint', 'healthEndpoint', 'targetEndpoint']) {
    const value = config[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }

  const host = ['healthHost', 'host', 'targetHost']
    .map((key) => config[key])
    .find((value): value is string => typeof value === 'string' && Boolean(value.trim()));
  const port = ['healthPort', 'port', 'targetPort']
    .map((key) => config[key])
    .find((value): value is string | number => typeof value === 'number' || typeof value === 'string');

  return host ? `${host}${port ? `:${port}` : ''}` : null;
}

const protocolDefaultPorts: Record<ProtocolKind, string> = {
  wireguard: '51820',
  vless: '443',
  l2tp: '1701',
  ikev2: '500',
};

function createEmptyTenantBrandForm(): TenantBrandSettingsForm {
  return {
    accentColor: '#0E9F8F',
    clientAppTitle: 'Afrows Client',
    clientSupportMessage: '',
    dashboardTitle: 'Afrows',
    displayName: 'Afrows',
    legalName: '',
    logoUrl: '',
    primaryColor: '#176B87',
    publicBrandingEnabled: true,
    supportEmail: '',
    supportTelegram: '',
    supportUrl: '',
    tenantSlug: 'default',
  };
}

function mapTenantBrandingToForm(settings: AdminTenantBrandSettingsSummary): TenantBrandSettingsForm {
  return {
    accentColor: settings.accentColor,
    clientAppTitle: settings.clientAppTitle,
    clientSupportMessage: settings.clientSupportMessage ?? '',
    dashboardTitle: settings.dashboardTitle,
    displayName: settings.displayName,
    legalName: settings.legalName ?? '',
    logoUrl: settings.logoUrl ?? '',
    primaryColor: settings.primaryColor,
    publicBrandingEnabled: settings.publicBrandingEnabled,
    supportEmail: settings.supportEmail ?? '',
    supportTelegram: settings.supportTelegram ?? '',
    supportUrl: settings.supportUrl ?? '',
    tenantSlug: settings.tenantSlug,
  };
}

function wireGuardCandidateSourceLabel(candidate: WireGuardHealthCandidate, t: DashboardStrings): string {
  if (candidate.source === 'agent') return t.settings.agentTelemetry;
  if (candidate.source === 'outbound') return t.settings.outboundHealth;

  return t.settings.localSample;
}

function latestProtocolApplyEventsBySetupId(
  events: AdminProtocolServerApplyEventSummary[],
): Record<string, AdminProtocolServerApplyEventSummary> {
  return events.reduce<Record<string, AdminProtocolServerApplyEventSummary>>((items, event) => {
    if (!items[event.protocolSetupId]) items[event.protocolSetupId] = event;

    return items;
  }, {});
}
