import type { FormEvent, ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createRewardClaimKey } from './reward-claim-key';
import type {
  ClientRewardedAdStatus,
  ClientPortalProfileResponse,
  ClientRouteOptionsResponse,
  ClientRoutePreferenceMode,
  ClientRoutePreferenceSummary,
  ClientSplitTunnelAppSummary,
  ClientSplitTunnelMode,
  ClientSplitTunnelNativeProfile,
  ClientSubscriptionSummary,
  RouteScoreProfile,
  UpdateClientRoutePreferenceRequest,
} from '@afrows/shared';
import {
  AlertTriangle,
  AppWindow,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Gamepad2,
  Gift,
  Globe2,
  KeyRound,
  Languages,
  LocateFixed,
  LogOut,
  PlayCircle,
  RefreshCw,
  Save,
  Server,
  Shield,
  Smartphone,
  Wifi,
} from 'lucide-react';
import {
  ClientApiError,
  claimClientRewardedAd,
  getClientProfile,
  getClientRewardedAdStatus,
  getClientRouteOptions,
  getClientRoutePreference,
  getClientSubscription,
  updateClientRoutePreference,
} from './api';
import {
  configFormatLabel,
  configRenderStatusLabel,
  clientStatusLabel,
  detectDefaultLanguage,
  directionFor,
  formatBytes,
  formatCount,
  formatPercent,
  healthLabel,
  isLanguage,
  modeLabel,
  profileLabel,
  protocolLabel,
  regionName,
  translations,
  type ClientMessages,
  type Language,
} from './i18n';

const languageStorageKey = 'afrows.client.language';
const tokenStorageKey = 'afrows.client.token';
const splitTunnelStoragePrefix = 'afrows.client.splitTunnel.';
const routeModes: ClientRoutePreferenceMode[] = ['auto', 'country', 'outbound'];
const routeProfiles: RouteScoreProfile[] = [
  'balanced',
  'stability',
  'throughput',
  'gaming',
  'tcp',
  'udp',
  'quic',
  'dns',
  'wireguard',
];
const defaultSplitTunnelApps = ['instagram', 'telegram', 'whatsapp'];
const splitTunnelApps: ClientSplitTunnelAppSummary[] = [
  { id: 'instagram', label: 'Instagram', androidPackage: 'com.instagram.android', iosBundleId: 'com.burbn.instagram' },
  { id: 'telegram', label: 'Telegram', androidPackage: 'org.telegram.messenger', iosBundleId: 'ph.telegra.Telegraph' },
  { id: 'whatsapp', label: 'WhatsApp', androidPackage: 'com.whatsapp', iosBundleId: 'net.whatsapp.WhatsApp' },
  { id: 'chrome', label: 'Chrome', androidPackage: 'com.android.chrome', iosBundleId: 'com.google.chrome.ios' },
  { id: 'firefox', label: 'Firefox', androidPackage: 'org.mozilla.firefox', iosBundleId: 'org.mozilla.ios.Firefox' },
  { id: 'youtube', label: 'YouTube', androidPackage: 'com.google.android.youtube', iosBundleId: 'com.google.ios.youtube' },
];

/**
 * Errors are stored as a translation key (plus the raw API detail, if any) and translated at
 * render time, so switching language re-labels them instead of re-fetching everything.
 * `scope` places the message next to the action that failed.
 */
interface ClientError {
  scope: 'load' | 'save' | 'reward';
  key: 'tokenRejected' | 'requestFailed' | 'noToken' | 'chooseCountry' | 'chooseServer';
  detail?: string;
}

export function ClientApp() {
  const [language, setLanguage] = useState<Language>(() => {
    const stored = localStorage.getItem(languageStorageKey);
    return isLanguage(stored) ? stored : detectDefaultLanguage();
  });
  const messages = translations[language];
  const [tokenInput, setTokenInput] = useState('');
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<ClientPortalProfileResponse | null>(null);
  const [rewardedAds, setRewardedAds] = useState<ClientRewardedAdStatus | null>(null);
  const [routePreference, setRoutePreference] = useState<ClientRoutePreferenceSummary | null>(null);
  const [routeOptions, setRouteOptions] = useState<ClientRouteOptionsResponse | null>(null);
  const [subscription, setSubscription] = useState<ClientSubscriptionSummary | null>(null);
  const [mode, setMode] = useState<ClientRoutePreferenceMode>('auto');
  const [scoreProfile, setScoreProfile] = useState<RouteScoreProfile>('balanced');
  const [autoDetectCountry, setAutoDetectCountry] = useState(true);
  const [detectedCountryCode, setDetectedCountryCode] = useState('');
  const [preferredCountryCode, setPreferredCountryCode] = useState('');
  const [preferredOutboundId, setPreferredOutboundId] = useState('');
  const [splitTunnelMode, setSplitTunnelMode] = useState<ClientSplitTunnelMode>('selected_apps');
  const [selectedSplitTunnelApps, setSelectedSplitTunnelApps] = useState<string[]>(defaultSplitTunnelApps);
  const [splitTunnelCopied, setSplitTunnelCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [claimingReward, setClaimingReward] = useState(false);
  const [error, setError] = useState<ClientError | null>(null);
  const [saved, setSaved] = useState(false);
  const [rewardClaimed, setRewardClaimed] = useState(false);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = directionFor(language);
    localStorage.setItem(languageStorageKey, language);
  }, [language]);

  const applyPreference = useCallback((preference: ClientRoutePreferenceSummary) => {
    const nextMode = isRouteMode(preference.mode) ? preference.mode : 'auto';
    const nextProfile = isRouteProfile(preference.scoreProfile) ? preference.scoreProfile : 'balanced';

    setRoutePreference(preference);
    setMode(nextMode);
    setScoreProfile(nextProfile);
    setAutoDetectCountry(preference.autoDetectCountry);
    setDetectedCountryCode(preference.detectedCountryCode ?? '');
    setPreferredCountryCode(preference.preferredExitCountryCode ?? '');
    setPreferredOutboundId(preference.preferredOutboundId ?? '');
  }, []);

  const loadClientData = useCallback(async (token: string, routeGroup?: string) => {
    setLoading(true);
    setError(null);
    setSaved(false);
    setRewardClaimed(false);

    try {
      const nextProfile = await getClientProfile(token);
      const selectedRouteGroup = routeGroup ?? nextProfile.routePreference.routeGroup;
      const [preferenceResponse, optionsResponse, subscriptionResponse, rewardResponse] = await Promise.all([
        getClientRoutePreference(token, selectedRouteGroup),
        getClientRouteOptions(token, selectedRouteGroup),
        getClientSubscription(token, selectedRouteGroup),
        getClientRewardedAdStatus(token),
      ]);

      setProfile({
        ...nextProfile,
        routePreference: preferenceResponse.routePreference,
      });
      setRewardedAds(rewardResponse.rewardedAds);
      setRouteOptions(optionsResponse);
      setSubscription(subscriptionResponse.subscription);
      applyPreference(preferenceResponse.routePreference);
    } catch (requestError) {
      setProfile(null);
      setRewardedAds(null);
      setRoutePreference(null);
      setRouteOptions(null);
      setSubscription(null);
      setError(toClientError(requestError, 'load'));
      if (requestError instanceof ClientApiError && requestError.status === 401) {
        localStorage.removeItem(tokenStorageKey);
        setSessionToken(null);
      }
    } finally {
      setLoading(false);
    }
  }, [applyPreference]);

  useEffect(() => {
    const storedToken = localStorage.getItem(tokenStorageKey);
    if (!storedToken) return;

    setSessionToken(storedToken);
    void loadClientData(storedToken);
  }, [loadClientData]);

  useEffect(() => {
    if (!profile?.clientConfig.id) return;
    const stored = readSplitTunnelState(profile.clientConfig.id);
    setSplitTunnelMode(stored.mode);
    setSelectedSplitTunnelApps(stored.selectedAppIds);
    setSplitTunnelCopied(false);
  }, [profile?.clientConfig.id]);

  const countryOptions = routeOptions?.countries ?? [];
  const outboundOptions = routeOptions?.outbounds ?? [];
  const canOverride = routePreference?.allowClientOverride ?? false;
  const quotaLimit = profile?.clientConfig.effectiveQuotaLimitBytes ?? null;
  const quotaUsed = profile?.clientConfig.usedBytes ?? 0;
  const quotaPercent = quotaLimit && quotaLimit > 0 ? Math.min(Math.round((quotaUsed / quotaLimit) * 100), 100) : null;
  const rewardButtonText = !rewardedAds
    ? messages.loading
    : !rewardedAds.enabled
      ? messages.rewardDisabled
      : rewardedAds.remainingToday <= 0
        ? messages.rewardLimitReached
        : claimingReward
          ? messages.claimingReward
          : messages.watchAd;
  const errorMessage = error ? errorText(error, messages) : null;

  const selectedOutbound = useMemo(
    () => outboundOptions.find((outbound) => outbound.id === preferredOutboundId) ?? null,
    [outboundOptions, preferredOutboundId],
  );
  const nativeSplitTunnelProfile = useMemo(
    () => profile && routePreference
      ? createNativeSplitTunnelProfile(
        profile.clientConfig.id,
        routePreference.routeGroup,
        splitTunnelMode,
        selectedSplitTunnelApps,
      )
      : null,
    [profile, routePreference, selectedSplitTunnelApps, splitTunnelMode],
  );
  const splitTunnelAppSelectionActive = splitTunnelMode === 'selected_apps';

  async function handleConnect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = tokenInput.trim();
    if (!token) {
      setError({ scope: 'load', key: 'noToken' });
      return;
    }

    localStorage.setItem(tokenStorageKey, token);
    setSessionToken(token);
    await loadClientData(token);
  }

  function handleSignOut() {
    localStorage.removeItem(tokenStorageKey);
    setSessionToken(null);
    setTokenInput('');
    setProfile(null);
    setRewardedAds(null);
    setRoutePreference(null);
    setRouteOptions(null);
    setSubscription(null);
    setError(null);
    setSaved(false);
    setRewardClaimed(false);
  }

  async function handleSave() {
    if (!sessionToken || !routePreference || !canOverride) return;

    if (mode === 'country' && !preferredCountryCode) {
      setError({ scope: 'save', key: 'chooseCountry' });
      return;
    }

    if (mode === 'outbound' && !preferredOutboundId) {
      setError({ scope: 'save', key: 'chooseServer' });
      return;
    }

    const payload: UpdateClientRoutePreferenceRequest = {
      routeGroup: routePreference.routeGroup,
      mode,
      detectedCountryCode: normalizeCountryInput(detectedCountryCode),
      preferredExitCountryCode: mode === 'country' ? preferredCountryCode : null,
      preferredOutboundId: mode === 'outbound' ? preferredOutboundId : null,
      scoreProfile,
      autoDetectCountry,
    };

    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const response = await updateClientRoutePreference(sessionToken, payload);
      applyPreference(response.routePreference);
      setProfile((current) => current ? { ...current, routePreference: response.routePreference } : current);
      setSaved(true);
    } catch (requestError) {
      setError(toClientError(requestError, 'save'));
    } finally {
      setSaving(false);
    }
  }

  async function handleClaimReward() {
    if (!sessionToken || !rewardedAds || !rewardedAds.enabled || rewardedAds.remainingToday <= 0) return;

    const claimKey = createRewardClaimKey();
    setClaimingReward(true);
    setError(null);
    setSaved(false);
    setRewardClaimed(false);

    try {
      const response = await claimClientRewardedAd(sessionToken, {
        provider: rewardedAds.provider,
        adSessionId: claimKey,
        idempotencyKey: claimKey,
        metadata: {
          source: 'client_app',
          verificationMode: rewardedAds.verificationMode,
        },
      });
      setRewardedAds(response.rewardedAds);
      setProfile(response.profile);
      applyPreference(response.profile.routePreference);
      setRewardClaimed(true);
    } catch (requestError) {
      setError(toClientError(requestError, 'reward'));
    } finally {
      setClaimingReward(false);
    }
  }

  function handleDeviceCountry() {
    const localeCountry = detectLocaleCountry();
    if (localeCountry) {
      setDetectedCountryCode(localeCountry);
    }
  }

  function handleSplitTunnelMode(nextMode: ClientSplitTunnelMode) {
    if (!profile) return;
    setSplitTunnelMode(nextMode);
    persistSplitTunnelState(profile.clientConfig.id, nextMode, selectedSplitTunnelApps);
    setSplitTunnelCopied(false);
  }

  function handleSplitTunnelApp(appId: string) {
    if (!profile) return;
    const nextSelected = selectedSplitTunnelApps.includes(appId)
      ? selectedSplitTunnelApps.filter((candidate) => candidate !== appId)
      : [...selectedSplitTunnelApps, appId];
    setSelectedSplitTunnelApps(nextSelected);
    persistSplitTunnelState(profile.clientConfig.id, splitTunnelMode, nextSelected);
    setSplitTunnelCopied(false);
  }

  async function handleCopyNativeSplitTunnelProfile() {
    if (!nativeSplitTunnelProfile) return;
    const ok = await copyText(JSON.stringify(nativeSplitTunnelProfile, null, 2));
    if (ok) {
      setSplitTunnelCopied(true);
      window.setTimeout(() => setSplitTunnelCopied(false), 1600);
    }
  }

  if (!sessionToken || !profile || !routePreference) {
    // A stored token is being verified: show a quiet loading screen instead of flashing the login form.
    const restoringSession = Boolean(sessionToken) && loading;

    return (
      <main className="min-h-dvh bg-client-page px-4 py-6 text-client-ink sm:px-6">
        <div className="mx-auto flex min-h-[calc(100dvh-3rem)] max-w-md flex-col justify-center">
          <div className="mb-6 flex items-center justify-between gap-3">
            <BrandMark messages={messages} />
            <LanguageButton language={language} setLanguage={setLanguage} label={messages.language} />
          </div>

          {restoringSession ? (
            <div
              role="status"
              aria-live="polite"
              className="flex min-h-14 items-center justify-center gap-2 rounded-[8px] border border-client-line bg-client-panel p-4 text-sm font-semibold text-client-muted shadow-sm"
            >
              <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
              {messages.loadingAccount}
            </div>
          ) : (
            <form onSubmit={handleConnect} className="rounded-[8px] border border-client-line bg-client-panel p-4 shadow-sm">
              <label className="mb-2 block text-sm font-semibold text-client-ink" htmlFor="client-token">
                {messages.token}
              </label>
              <div className="flex gap-2">
                <input
                  id="client-token"
                  type="password"
                  value={tokenInput}
                  onChange={(event) => setTokenInput(event.target.value)}
                  aria-describedby="client-token-hint"
                  className="min-h-11 min-w-0 flex-1 rounded-[8px] border border-client-line bg-white px-3 text-base outline-none focus:border-client-teal focus:ring-2 focus:ring-client-teal/20"
                  autoComplete="current-password"
                />
                <button
                  type="submit"
                  className="inline-flex min-h-11 items-center gap-2 rounded-[8px] bg-client-deep px-4 text-sm font-semibold text-white disabled:bg-client-muted"
                  disabled={loading}
                >
                  <KeyRound className="h-4 w-4" aria-hidden="true" />
                  {loading ? messages.loading : messages.connect}
                </button>
              </div>
              <p id="client-token-hint" className="mt-2 text-xs text-client-muted">{messages.tokenHint}</p>
              {errorMessage ? <StatusMessage tone="error" text={errorMessage} /> : null}
            </form>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-client-page text-client-ink">
      <header className="border-b border-client-line bg-client-panel">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2 sm:px-6">
          <BrandMark messages={messages} />
          <div className="flex items-center gap-2">
            <LanguageButton language={language} setLanguage={setLanguage} label={messages.language} />
            <IconButton
              label={messages.refresh}
              disabled={loading}
              onClick={() => void loadClientData(sessionToken, routePreference.routeGroup)}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            </IconButton>
            <IconButton label={messages.signOut} onClick={handleSignOut}>
              <LogOut className="h-4 w-4" aria-hidden="true" />
            </IconButton>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-5xl gap-4 px-4 py-4 safe-bottom sm:px-6 lg:grid-cols-[0.9fr_1.1fr]">
        {error?.scope === 'load' && errorMessage ? (
          <div className="lg:col-span-2">
            <StatusMessage tone="error" text={errorMessage} />
          </div>
        ) : null}

        <div className="grid gap-4">
          <section className="rounded-[8px] border border-client-line bg-client-panel p-4 shadow-sm">
            <PanelTitle icon={<Smartphone className="h-5 w-5" aria-hidden="true" />} title={profile.clientConfig.label} />
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Metric label={messages.remaining} value={formatBytes(profile.clientConfig.remainingBytes, language, messages)} />
              <Metric label={messages.used} value={formatBytes(profile.clientConfig.usedBytes, language, messages)} />
              <Metric label={messages.protocol} value={protocolLabel(profile.clientConfig.protocol)} />
              <Metric label={messages.status} value={clientStatusLabel(profile.clientConfig.status, messages)} />
            </div>
            <div
              role="progressbar"
              aria-label={messages.quota}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={quotaPercent ?? undefined}
              aria-valuetext={quotaPercent === null ? messages.unlimited : formatPercent(quotaPercent, language)}
              className="mt-4 h-2 overflow-hidden rounded-full bg-client-line"
            >
              <div
                className="h-full rounded-full bg-client-green"
                style={{ width: `${quotaPercent ?? 0}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-client-muted">
              <span>{messages.quota}</span>
              <span>{quotaPercent === null ? messages.unlimited : formatPercent(quotaPercent, language)}</span>
            </div>
          </section>

          <section className="rounded-[8px] border border-client-line bg-client-panel p-4 shadow-sm">
            <PanelTitle icon={<Gift className="h-5 w-5" aria-hidden="true" />} title={messages.rewardedData} />
            <div className="mt-4 grid grid-cols-3 gap-2">
              <CompactMetric
                label={messages.rewardedData}
                value={rewardedAds ? formatBytes(rewardedAds.rewardBytes, language, messages) : messages.loading}
              />
              <CompactMetric
                label={messages.adsToday}
                value={formatCount(rewardedAds?.watchedToday ?? 0, language)}
              />
              <CompactMetric
                label={messages.adsRemaining}
                value={formatCount(rewardedAds?.remainingToday ?? 0, language)}
              />
            </div>
            <button
              type="button"
              onClick={() => void handleClaimReward()}
              disabled={!rewardedAds || !rewardedAds.enabled || rewardedAds.remainingToday <= 0 || claimingReward}
              aria-busy={claimingReward}
              className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[8px] bg-client-teal px-4 text-sm font-semibold text-white disabled:bg-client-muted"
            >
              <PlayCircle className="h-4 w-4" aria-hidden="true" />
              {rewardButtonText}
            </button>
            {rewardClaimed ? <StatusMessage tone="ok" text={messages.rewardAdded} /> : null}
            {error?.scope === 'reward' && errorMessage ? <StatusMessage tone="error" text={errorMessage} /> : null}
          </section>

          <section className="rounded-[8px] border border-client-line bg-client-panel p-4 shadow-sm">
            <PanelTitle icon={<Shield className="h-5 w-5" aria-hidden="true" />} title={messages.route} />
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge tone={routePreference.routeLocked ? 'warning' : 'ok'} text={routePreference.routeLocked ? messages.routeLocked : messages.routeOpen} />
              {routePreference.stickySessionProtection ? <Badge tone="neutral" text={messages.stickyProtected} /> : null}
              {!canOverride ? <Badge tone="warning" text={messages.overrideLocked} /> : null}
            </div>
            <div role="group" aria-label={messages.route} className="mt-4 grid grid-cols-3 gap-2">
              {routeModes.map((candidate) => (
                <button
                  key={candidate}
                  type="button"
                  onClick={() => setMode(candidate)}
                  disabled={!canOverride}
                  aria-pressed={mode === candidate}
                  className={segmentClass(mode === candidate)}
                >
                  {modeLabel(candidate, messages)}
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-[8px] border border-client-line bg-client-panel p-4 shadow-sm">
            <PanelTitle icon={<AppWindow className="h-5 w-5" aria-hidden="true" />} title={messages.perAppVpn} />
            <div role="group" aria-label={messages.perAppVpn} className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleSplitTunnelMode('all_apps')}
                aria-pressed={splitTunnelMode === 'all_apps'}
                className={segmentClass(splitTunnelMode === 'all_apps')}
              >
                {messages.allApps}
              </button>
              <button
                type="button"
                onClick={() => handleSplitTunnelMode('selected_apps')}
                aria-pressed={splitTunnelMode === 'selected_apps'}
                className={segmentClass(splitTunnelMode === 'selected_apps')}
              >
                {messages.selectedAppsOnly}
              </button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {splitTunnelApps.map((app) => {
                const selected = splitTunnelAppSelectionActive && selectedSplitTunnelApps.includes(app.id);
                return (
                  <button
                    key={app.id}
                    type="button"
                    onClick={() => handleSplitTunnelApp(app.id)}
                    className={splitAppClass(selected, splitTunnelAppSelectionActive)}
                    aria-pressed={selected}
                    disabled={!splitTunnelAppSelectionActive}
                  >
                    <span className="truncate">{app.label}</span>
                    {selected ? <Check className="h-4 w-4 shrink-0" aria-hidden="true" /> : null}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <CompactMetric
                label={messages.selectedApps}
                value={formatCount(nativeSplitTunnelProfile?.selectedApps.length ?? 0, language)}
              />
              <CompactMetric label={messages.nativeStatus} value={messages.androidReady} />
              <CompactMetric label={messages.iosStatus} value={messages.iosManaged} />
              <CompactMetric label={messages.privacy} value={messages.localOnly} />
            </div>
            <button
              type="button"
              onClick={() => void handleCopyNativeSplitTunnelProfile()}
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[8px] border border-client-line bg-white px-3 text-sm font-semibold"
            >
              {splitTunnelCopied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
              {splitTunnelCopied ? messages.copiedNativeProfile : messages.copyNativeProfile}
            </button>
          </section>

          <section className="rounded-[8px] border border-client-line bg-client-panel p-4 shadow-sm">
            <PanelTitle icon={<RefreshCw className="h-5 w-5" aria-hidden="true" />} title={messages.subscription} />
            <div className="mt-4 grid gap-2">
              <div className="grid grid-cols-2 gap-2">
                <CompactMetric
                  label={messages.subscriptionServers}
                  value={formatCount(subscription?.endpoints.length ?? 0, language)}
                />
                <CompactMetric
                  label={messages.configLinks}
                  value={formatCount(subscription?.configLinks?.length ?? 0, language)}
                />
              </div>
              {subscription?.endpoints.length ? subscription.endpoints.map((endpoint) => (
                <div key={endpoint.outboundId} className="rounded-[8px] border border-client-line bg-client-page p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate font-semibold"><bdi>{endpoint.name}</bdi></span>
                    <Badge tone={endpoint.usageMultiplier > 1 ? 'warning' : 'neutral'} text={endpoint.chargeLabel} />
                  </div>
                  <div className="mt-1 truncate text-client-muted" dir="ltr">{subscriptionEndpointAddress(endpoint)}</div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <CompactMetric label={messages.usageCost} value={endpoint.chargeLabel} />
                    <CompactMetric
                      label={messages.usableOnServer}
                      value={formatBytes(endpoint.usableBytesAtMultiplier, language, messages)}
                    />
                  </div>
                </div>
              )) : <EmptyState text={messages.noSubscriptionEndpoints} />}
              {subscription?.configLinks?.map((configLink) => (
                <ConfigLinkCard key={`config-${configLink.outboundId}`} configLink={configLink} messages={messages} />
              ))}
            </div>
          </section>
        </div>

        <section className="rounded-[8px] border border-client-line bg-client-panel p-4 shadow-sm">
          <PanelTitle icon={<Wifi className="h-5 w-5" aria-hidden="true" />} title={messages.routeOptions} />

          <div className="mt-4 grid gap-4">
            <div>
              <label className="mb-2 block text-sm font-semibold" htmlFor="detected-country">
                {messages.detectedCountry}
              </label>
              <div className="flex flex-wrap gap-2">
                <input
                  id="detected-country"
                  value={detectedCountryCode}
                  onChange={(event) => setDetectedCountryCode(normalizeCountryInput(event.target.value) ?? '')}
                  maxLength={2}
                  disabled={!canOverride}
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  dir="ltr"
                  className="min-h-11 min-w-0 flex-1 rounded-[8px] border border-client-line bg-white px-3 text-base uppercase outline-none focus:border-client-teal focus:ring-2 focus:ring-client-teal/20 disabled:bg-client-page"
                />
                <button
                  type="button"
                  onClick={handleDeviceCountry}
                  disabled={!canOverride}
                  className="inline-flex min-h-11 items-center gap-2 rounded-[8px] border border-client-line px-3 text-sm font-semibold text-client-ink disabled:text-client-muted"
                >
                  <LocateFixed className="h-4 w-4" aria-hidden="true" />
                  {messages.useDeviceCountry}
                </button>
              </div>
            </div>

            {mode === 'country' ? (
              <div>
                <label className="mb-2 block text-sm font-semibold" htmlFor="preferred-country">
                  {messages.preferredCountry}
                </label>
                <select
                  id="preferred-country"
                  value={preferredCountryCode}
                  onChange={(event) => setPreferredCountryCode(event.target.value)}
                  disabled={!canOverride || countryOptions.length === 0}
                  className="min-h-11 w-full rounded-[8px] border border-client-line bg-white px-3 text-base outline-none focus:border-client-teal focus:ring-2 focus:ring-client-teal/20 disabled:bg-client-page"
                >
                  <option value="">{messages.chooseCountry}</option>
                  {countryOptions.map((country) => (
                    <option key={country.countryCode} value={country.countryCode}>
                      {regionName(country.countryCode, language)} · {formatCount(country.healthyOutboundCount, language)}/{formatCount(country.availableOutboundCount, language)}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {mode === 'outbound' ? (
              <div role="group" aria-labelledby="preferred-server-label">
                <div id="preferred-server-label" className="mb-2 text-sm font-semibold">{messages.preferredServer}</div>
                <div className="grid gap-2">
                  {outboundOptions.length === 0 ? (
                    <EmptyState text={messages.noOutbounds} />
                  ) : outboundOptions.map((outbound) => (
                    <button
                      key={outbound.id}
                      type="button"
                      onClick={() => setPreferredOutboundId(outbound.id)}
                      disabled={!canOverride || !outbound.available}
                      aria-pressed={preferredOutboundId === outbound.id}
                      className={outboundClass(preferredOutboundId === outbound.id)}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <Server className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span className="truncate"><bdi>{outbound.name}</bdi></span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="text-client-muted">{outbound.countryCode ? regionName(outbound.countryCode, language) : '--'}</span>
                        {outbound.usageMultiplier > 1 ? <Badge tone="warning" text={outbound.chargeLabel} /> : null}
                        <HealthPill status={outbound.healthStatus} label={healthLabel(outbound.healthStatus, messages)} />
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div role="group" aria-labelledby="route-profile-label">
              <div id="route-profile-label" className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Gamepad2 className="h-4 w-4 text-client-teal" aria-hidden="true" />
                {messages.profile}
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {routeProfiles.map((profileOption) => (
                  <button
                    key={profileOption}
                    type="button"
                    onClick={() => setScoreProfile(profileOption)}
                    disabled={!canOverride}
                    aria-pressed={scoreProfile === profileOption}
                    className={profileClass(scoreProfile === profileOption)}
                  >
                    {profileLabel(profileOption, messages)}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex min-h-11 items-center justify-between gap-3 rounded-[8px] border border-client-line px-3 text-sm font-semibold">
              <span>{messages.autoDetect}</span>
              <input
                type="checkbox"
                checked={autoDetectCountry}
                onChange={(event) => setAutoDetectCountry(event.target.checked)}
                disabled={!canOverride}
                className="h-5 w-5 shrink-0 accent-client-teal"
              />
            </label>

            {selectedOutbound ? (
              <div className="rounded-[8px] border border-client-line bg-client-page p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate font-semibold"><bdi>{selectedOutbound.name}</bdi></span>
                  <HealthPill status={selectedOutbound.healthStatus} label={healthLabel(selectedOutbound.healthStatus, messages)} />
                </div>
                <div className="mt-1 text-client-muted">
                  {selectedOutbound.countryCode ? regionName(selectedOutbound.countryCode, language) : '--'} {selectedOutbound.region ?? ''}
                </div>
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={!canOverride || saving}
              aria-busy={saving}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[8px] bg-client-deep px-4 text-sm font-semibold text-white disabled:bg-client-muted"
            >
              <Save className="h-4 w-4" aria-hidden="true" />
              {saving ? messages.saving : messages.save}
            </button>

            {saved ? <StatusMessage tone="ok" text={messages.saveOk} /> : null}
            {error?.scope === 'save' && errorMessage ? <StatusMessage tone="error" text={errorMessage} /> : null}
          </div>
        </section>

        <section className="rounded-[8px] border border-client-line bg-client-panel p-4 shadow-sm lg:col-span-2">
          <PanelTitle icon={<Globe2 className="h-5 w-5" aria-hidden="true" />} title={messages.availableCountries} />
          <div className="mt-4 flex flex-wrap gap-2">
            {countryOptions.length === 0 ? <EmptyState text={messages.noCountries} /> : countryOptions.map((country) => (
              <button
                key={country.countryCode}
                type="button"
                onClick={() => {
                  setMode('country');
                  setPreferredCountryCode(country.countryCode);
                }}
                disabled={!canOverride}
                aria-pressed={mode === 'country' && preferredCountryCode === country.countryCode}
                className="min-h-11 rounded-[8px] border border-client-line px-3 text-sm font-semibold disabled:text-client-muted aria-pressed:border-client-teal aria-pressed:bg-client-teal/10"
              >
                {regionName(country.countryCode, language)} · {formatCount(country.healthyOutboundCount, language)}
              </button>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

function BrandMark({ messages }: { messages: ClientMessages }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[8px] bg-client-deep text-white">
        <Shield className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <h1 className="truncate text-base font-bold">{messages.appName}</h1>
        <div className="truncate text-xs font-semibold text-client-muted">{messages.clientSurface}</div>
      </div>
    </div>
  );
}

function LanguageButton({
  language,
  setLanguage,
  label,
}: {
  language: Language;
  setLanguage: (language: Language) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => setLanguage(language === 'en' ? 'fa' : 'en')}
      className="inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-[8px] border border-client-line bg-white px-3 text-sm font-semibold"
      title={label}
      aria-label={label}
    >
      <Languages className="h-4 w-4" aria-hidden="true" />
      {language === 'en' ? 'FA' : 'EN'}
    </button>
  );
}

function IconButton({
  label,
  onClick,
  disabled = false,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="grid h-11 w-11 place-items-center rounded-[8px] border border-client-line bg-white disabled:text-client-muted"
      title={label}
      aria-label={label}
    >
      {children}
    </button>
  );
}

function PanelTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] bg-client-page text-client-teal">{icon}</span>
      <h2 className="truncate text-base font-bold"><bdi>{title}</bdi></h2>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-h-[76px] min-w-0 rounded-[8px] border border-client-line bg-client-page p-3">
      <div className="text-xs font-semibold leading-tight text-client-muted">{label}</div>
      <div className="mt-2 break-words text-base font-bold leading-tight">{value}</div>
    </div>
  );
}

function CompactMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-h-[64px] min-w-0 rounded-[8px] border border-client-line bg-client-page p-2">
      <div className="text-[11px] font-semibold leading-tight text-client-muted">{label}</div>
      <div className="mt-2 break-words text-sm font-bold leading-tight">{value}</div>
    </div>
  );
}

function ConfigLinkCard({
  configLink,
  messages,
}: {
  configLink: ClientSubscriptionSummary['configLinks'][number];
  messages: ClientMessages;
}) {
  const [copied, setCopied] = useState(false);
  const renderedPayload = configLink.uri ?? configLink.configText ?? null;
  // A rendered VLESS link can be handed straight to the installed VPN app (v2rayNG, Hiddify, Streisand, …).
  const appLink = configLink.format === 'vless-uri' && configLink.uri?.startsWith('vless://') ? configLink.uri : null;
  const statusTone = configLink.renderStatus === 'rendered'
    ? 'ok'
    : configLink.renderStatus === 'unsupported_protocol'
      ? 'neutral'
      : 'warning';

  async function handleCopy() {
    if (!renderedPayload) return;
    const ok = await copyText(renderedPayload);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    }
  }

  return (
    <div className="rounded-[8px] border border-client-line bg-client-page p-3 text-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 truncate font-semibold"><bdi>{configLink.name}</bdi></span>
        <Badge tone={statusTone} text={configRenderStatusLabel(configLink.renderStatus, messages)} />
      </div>
      <div className="mt-1 truncate text-client-muted" dir="ltr">{subscriptionConfigAddress(configLink)}</div>
      <div className="mt-2 flex flex-wrap gap-2">
        <Badge tone="neutral" text={configFormatLabel(configLink.format, messages)} />
        {configLink.requiresClientSecret ? <Badge tone="warning" text={messages.requiresClientSecret} /> : null}
        {configLink.sensitive ? <Badge tone="warning" text={messages.privateConfig} /> : null}
        {configLink.usageMultiplier > 1 ? <Badge tone="warning" text={configLink.chargeLabel} /> : null}
      </div>
      {renderedPayload ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-[8px] bg-client-deep px-3 text-sm font-semibold text-white"
          >
            {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
            {copied ? messages.copiedConfig : messages.copyConfig}
          </button>
          {appLink ? (
            <a
              href={appLink}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-[8px] border border-client-line bg-white px-3 text-sm font-semibold text-client-ink"
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              {messages.openInApp}
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Badge({ tone, text }: { tone: 'ok' | 'warning' | 'neutral'; text: string }) {
  const toneClass = tone === 'ok'
    ? 'border-client-green/30 bg-client-green/10 text-client-green'
    : tone === 'warning'
      ? 'border-client-amber/30 bg-client-amber/10 text-client-amber'
      : 'border-client-line bg-client-page text-client-muted';

  return (
    <span className={`inline-flex min-h-8 shrink-0 items-center rounded-[8px] border px-2 text-xs font-semibold ${toneClass}`}>
      {text}
    </span>
  );
}

function HealthPill({ status, label }: { status: string; label: string }) {
  const toneClass = status === 'healthy'
    ? 'bg-client-green text-white'
    : status === 'degraded'
      ? 'bg-client-amber text-white'
      : status === 'critical'
        ? 'bg-client-red text-white'
        : 'bg-client-muted text-white';

  return (
    <span className={`inline-flex min-h-7 items-center rounded-[8px] px-2 text-xs font-semibold ${toneClass}`}>
      {label}
    </span>
  );
}

function StatusMessage({ tone, text }: { tone: 'ok' | 'error'; text: string }) {
  const toneClass = tone === 'ok'
    ? 'border-client-green/30 bg-client-green/10 text-client-green'
    : 'border-client-red/30 bg-client-red/10 text-client-red';
  const Icon = tone === 'ok' ? CheckCircle2 : AlertTriangle;

  return (
    <div
      role={tone === 'ok' ? 'status' : 'alert'}
      className={`mt-3 flex items-center gap-2 rounded-[8px] border px-3 py-2 text-sm font-semibold ${toneClass}`}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{text}</span>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="min-h-10 rounded-[8px] border border-dashed border-client-line px-3 py-2 text-sm font-semibold text-client-muted">
      {text}
    </div>
  );
}

function segmentClass(active: boolean): string {
  return [
    'min-h-11 rounded-[8px] border px-2 text-sm font-semibold disabled:text-client-muted',
    active
      ? 'border-client-deep bg-client-deep text-white'
      : 'border-client-line bg-white text-client-ink',
  ].join(' ');
}

function profileClass(active: boolean): string {
  return [
    'min-h-11 rounded-[8px] border px-2 text-xs font-bold disabled:text-client-muted',
    active
      ? 'border-client-teal bg-client-teal text-white'
      : 'border-client-line bg-white text-client-ink',
  ].join(' ');
}

function outboundClass(active: boolean): string {
  return [
    'flex min-h-12 items-center justify-between gap-3 rounded-[8px] border px-3 text-sm font-semibold disabled:text-client-muted',
    active
      ? 'border-client-teal bg-client-teal/10 text-client-ink'
      : 'border-client-line bg-white text-client-ink',
  ].join(' ');
}

function splitAppClass(active: boolean, enabled: boolean): string {
  return [
    'flex min-h-11 items-center justify-between gap-2 rounded-[8px] border px-3 text-sm font-semibold',
    active
      ? 'border-client-teal bg-client-teal/10 text-client-ink'
      : 'border-client-line bg-white text-client-ink',
    enabled ? '' : 'cursor-not-allowed opacity-60',
  ].join(' ');
}

function toClientError(error: unknown, scope: ClientError['scope']): ClientError {
  if (error instanceof ClientApiError) {
    if (error.status === 401) return { scope, key: 'tokenRejected' };
    // Keep the API's own message as a detail; the headline stays translated.
    return { scope, key: 'requestFailed', detail: error.message || undefined };
  }
  return { scope, key: 'requestFailed' };
}

function errorText(error: ClientError, messages: ClientMessages): string {
  const headline = messages[error.key];
  return error.detail && error.detail !== messages.requestFailed ? `${headline} (${error.detail})` : headline;
}

function normalizeCountryInput(value: string | null | undefined): string | null {
  const normalized = value?.trim().toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2) ?? '';
  return normalized || null;
}

function detectLocaleCountry(): string | null {
  const candidates = navigator.languages?.length ? navigator.languages : [navigator.language];

  for (const locale of candidates) {
    const match = /[-_]([A-Za-z]{2})\b/.exec(locale);
    if (match?.[1]) return match[1].toUpperCase();
  }

  return null;
}

function readSplitTunnelState(clientConfigId: string): { mode: ClientSplitTunnelMode; selectedAppIds: string[] } {
  const fallback = { mode: 'selected_apps' as const, selectedAppIds: defaultSplitTunnelApps };
  try {
    const raw = localStorage.getItem(splitTunnelStoragePrefix + clientConfigId);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as { mode?: unknown; selectedAppIds?: unknown };
    const mode = parsed.mode === 'all_apps' || parsed.mode === 'selected_apps' ? parsed.mode : fallback.mode;
    const selectedAppIds = Array.isArray(parsed.selectedAppIds)
      ? parsed.selectedAppIds.filter((value): value is string => splitTunnelApps.some((app) => app.id === value))
      : fallback.selectedAppIds;
    return { mode, selectedAppIds: selectedAppIds.length ? [...new Set(selectedAppIds)] : fallback.selectedAppIds };
  } catch {
    return fallback;
  }
}

function persistSplitTunnelState(
  clientConfigId: string,
  mode: ClientSplitTunnelMode,
  selectedAppIds: string[],
): void {
  const normalizedSelected = selectedAppIds.filter((value) => splitTunnelApps.some((app) => app.id === value));
  localStorage.setItem(splitTunnelStoragePrefix + clientConfigId, JSON.stringify({
    mode,
    selectedAppIds: [...new Set(normalizedSelected)],
    updatedAt: new Date().toISOString(),
  }));
}

function createNativeSplitTunnelProfile(
  clientConfigId: string,
  routeGroup: string,
  mode: ClientSplitTunnelMode,
  selectedAppIds: string[],
): ClientSplitTunnelNativeProfile {
  const selectedApps = mode === 'selected_apps'
    ? splitTunnelApps.filter((app) => selectedAppIds.includes(app.id))
    : [];

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    clientConfigId,
    routeGroup,
    mode,
    selectedApps,
    privacy: {
      localOnly: true,
      installedAppInventoryShared: false,
      trafficDestinationsShared: false,
    },
    nativeTargets: {
      androidVpnService: true,
      iosManagedPerAppVpn: true,
    },
  };
}

async function copyText(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Fall back to the hidden textarea path below.
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  document.body.removeChild(textarea);
  return copied;
}

function subscriptionEndpointAddress(endpoint: ClientSubscriptionSummary['endpoints'][number]): string {
  if (endpoint.address) return endpoint.address;
  const hostPort = [endpoint.host, endpoint.port].filter(Boolean).join(':');
  return hostPort || endpoint.countryCode || '--';
}

function subscriptionConfigAddress(configLink: ClientSubscriptionSummary['configLinks'][number]): string {
  if (configLink.address) return configLink.address;
  const hostPort = [configLink.host, configLink.port].filter(Boolean).join(':');
  return hostPort || configLink.countryCode || '--';
}

function isRouteMode(value: string): value is ClientRoutePreferenceMode {
  return routeModes.includes(value as ClientRoutePreferenceMode);
}

function isRouteProfile(value: string): value is RouteScoreProfile {
  return routeProfiles.includes(value as RouteScoreProfile);
}
