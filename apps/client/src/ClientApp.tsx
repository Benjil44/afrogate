import type { FormEvent, ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  ClientRewardedAdStatus,
  ClientPortalProfileResponse,
  ClientRouteOptionsResponse,
  ClientRoutePreferenceMode,
  ClientRoutePreferenceSummary,
  RouteScoreProfile,
  UpdateClientRoutePreferenceRequest,
} from '@afrogate/shared';
import {
  AlertTriangle,
  CheckCircle2,
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
  updateClientRoutePreference,
} from './api';
import {
  clientStatusLabel,
  defaultLanguage,
  directionFor,
  formatBytes,
  formatCount,
  healthLabel,
  isLanguage,
  modeLabel,
  profileLabel,
  translations,
  type ClientMessages,
  type Language,
} from './i18n';

const languageStorageKey = 'afrogate.client.language';
const tokenStorageKey = 'afrogate.client.token';
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

export function ClientApp() {
  const [language, setLanguage] = useState<Language>(() => {
    const stored = localStorage.getItem(languageStorageKey);
    return isLanguage(stored) ? stored : defaultLanguage;
  });
  const messages = translations[language];
  const [tokenInput, setTokenInput] = useState('');
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<ClientPortalProfileResponse | null>(null);
  const [rewardedAds, setRewardedAds] = useState<ClientRewardedAdStatus | null>(null);
  const [routePreference, setRoutePreference] = useState<ClientRoutePreferenceSummary | null>(null);
  const [routeOptions, setRouteOptions] = useState<ClientRouteOptionsResponse | null>(null);
  const [mode, setMode] = useState<ClientRoutePreferenceMode>('auto');
  const [scoreProfile, setScoreProfile] = useState<RouteScoreProfile>('balanced');
  const [autoDetectCountry, setAutoDetectCountry] = useState(true);
  const [detectedCountryCode, setDetectedCountryCode] = useState('');
  const [preferredCountryCode, setPreferredCountryCode] = useState('');
  const [preferredOutboundId, setPreferredOutboundId] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [claimingReward, setClaimingReward] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      const [preferenceResponse, optionsResponse, rewardResponse] = await Promise.all([
        getClientRoutePreference(token, selectedRouteGroup),
        getClientRouteOptions(token, selectedRouteGroup),
        getClientRewardedAdStatus(token),
      ]);

      setProfile({
        ...nextProfile,
        routePreference: preferenceResponse.routePreference,
      });
      setRewardedAds(rewardResponse.rewardedAds);
      setRouteOptions(optionsResponse);
      applyPreference(preferenceResponse.routePreference);
    } catch (requestError) {
      setProfile(null);
      setRewardedAds(null);
      setRoutePreference(null);
      setRouteOptions(null);
      setError(errorText(requestError, messages));
      if (requestError instanceof ClientApiError && requestError.status === 401) {
        localStorage.removeItem(tokenStorageKey);
        setSessionToken(null);
      }
    } finally {
      setLoading(false);
    }
  }, [applyPreference, messages]);

  useEffect(() => {
    const storedToken = localStorage.getItem(tokenStorageKey);
    if (!storedToken) return;

    setSessionToken(storedToken);
    void loadClientData(storedToken);
  }, [loadClientData]);

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

  const selectedOutbound = useMemo(
    () => outboundOptions.find((outbound) => outbound.id === preferredOutboundId) ?? null,
    [outboundOptions, preferredOutboundId],
  );

  async function handleConnect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = tokenInput.trim();
    if (!token) {
      setError(messages.noToken);
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
    setError(null);
    setSaved(false);
    setRewardClaimed(false);
  }

  async function handleSave() {
    if (!sessionToken || !routePreference || !canOverride) return;

    if (mode === 'country' && !preferredCountryCode) {
      setError(messages.chooseCountry);
      return;
    }

    if (mode === 'outbound' && !preferredOutboundId) {
      setError(messages.chooseServer);
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
      setError(errorText(requestError, messages));
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
      setError(errorText(requestError, messages));
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

  if (!sessionToken || !profile || !routePreference) {
    return (
      <main className="min-h-screen bg-client-page px-4 py-6 text-client-ink sm:px-6">
        <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-md flex-col justify-center">
          <div className="mb-6 flex items-center justify-between">
            <BrandMark messages={messages} />
            <LanguageButton language={language} setLanguage={setLanguage} label={messages.language} />
          </div>

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
                className="min-h-11 min-w-0 flex-1 rounded-[8px] border border-client-line bg-white px-3 text-base outline-none focus:border-client-teal focus:ring-2 focus:ring-client-teal/20"
                autoComplete="current-password"
              />
              <button
                type="submit"
                className="inline-flex min-h-11 items-center gap-2 rounded-[8px] bg-client-deep px-4 text-sm font-semibold text-white"
                disabled={loading}
              >
                <KeyRound className="h-4 w-4" aria-hidden="true" />
                {loading ? messages.loading : messages.connect}
              </button>
            </div>
            {error ? <StatusMessage tone="error" text={error} /> : null}
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-client-page text-client-ink">
      <header className="border-b border-client-line bg-client-panel">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <BrandMark messages={messages} />
          <div className="flex items-center gap-2">
            <LanguageButton language={language} setLanguage={setLanguage} label={messages.language} />
            <IconButton label={messages.refresh} onClick={() => void loadClientData(sessionToken, routePreference.routeGroup)}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
            </IconButton>
            <IconButton label={messages.signOut} onClick={handleSignOut}>
              <LogOut className="h-4 w-4" aria-hidden="true" />
            </IconButton>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-5xl gap-4 px-4 py-4 safe-bottom sm:px-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="grid gap-4">
          <section className="rounded-[8px] border border-client-line bg-client-panel p-4 shadow-sm">
            <PanelTitle icon={<Smartphone className="h-5 w-5" aria-hidden="true" />} title={profile.clientConfig.label} />
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Metric label={messages.remaining} value={formatBytes(profile.clientConfig.remainingBytes, language, messages)} />
              <Metric label={messages.used} value={formatBytes(profile.clientConfig.usedBytes, language, messages)} />
              <Metric label={messages.protocol} value={profile.clientConfig.protocol} />
              <Metric label={messages.status} value={clientStatusLabel(profile.clientConfig.status, messages)} />
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-client-line">
              <div
                className="h-full rounded-full bg-client-green"
                style={{ width: `${quotaPercent ?? 0}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-client-muted">
              <span>{messages.quota}</span>
              <span>{quotaPercent === null ? messages.unlimited : `${formatCount(quotaPercent, language)}%`}</span>
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
              className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[8px] bg-client-teal px-4 text-sm font-semibold text-white disabled:bg-client-muted"
            >
              <PlayCircle className="h-4 w-4" aria-hidden="true" />
              {rewardButtonText}
            </button>
            {rewardClaimed ? <StatusMessage tone="ok" text={messages.rewardAdded} /> : null}
          </section>

          <section className="rounded-[8px] border border-client-line bg-client-panel p-4 shadow-sm">
            <PanelTitle icon={<Shield className="h-5 w-5" aria-hidden="true" />} title={messages.route} />
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge tone={routePreference.routeLocked ? 'warning' : 'ok'} text={routePreference.routeLocked ? messages.routeLocked : messages.connected} />
              <Badge tone="neutral" text={routePreference.stickySessionProtection ? messages.stickyProtected : messages.unknown} />
              {!canOverride ? <Badge tone="warning" text={messages.overrideLocked} /> : null}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {routeModes.map((candidate) => (
                <button
                  key={candidate}
                  type="button"
                  onClick={() => setMode(candidate)}
                  disabled={!canOverride}
                  className={segmentClass(mode === candidate)}
                >
                  {modeLabel(candidate, messages)}
                </button>
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
              <div className="flex gap-2">
                <input
                  id="detected-country"
                  value={detectedCountryCode}
                  onChange={(event) => setDetectedCountryCode(normalizeCountryInput(event.target.value) ?? '')}
                  maxLength={2}
                  disabled={!canOverride}
                  className="min-h-11 min-w-0 flex-1 rounded-[8px] border border-client-line bg-white px-3 text-base uppercase outline-none focus:border-client-teal focus:ring-2 focus:ring-client-teal/20 disabled:bg-client-page"
                />
                <button
                  type="button"
                  onClick={handleDeviceCountry}
                  disabled={!canOverride}
                  className="inline-flex min-h-11 items-center gap-2 rounded-[8px] border border-client-line px-3 text-sm font-semibold text-client-ink disabled:text-client-muted"
                  title={messages.useDeviceCountry}
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
                      {country.countryCode} - {formatCount(country.healthyOutboundCount, language)}/{formatCount(country.availableOutboundCount, language)}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {mode === 'outbound' ? (
              <div>
                <div className="mb-2 text-sm font-semibold">{messages.preferredServer}</div>
                <div className="grid gap-2">
                  {outboundOptions.length === 0 ? (
                    <EmptyState text={messages.noOutbounds} />
                  ) : outboundOptions.map((outbound) => (
                    <button
                      key={outbound.id}
                      type="button"
                      onClick={() => setPreferredOutboundId(outbound.id)}
                      disabled={!canOverride || !outbound.available}
                      className={outboundClass(preferredOutboundId === outbound.id)}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <Server className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span className="truncate">{outbound.name}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="text-client-muted">{outbound.countryCode ?? '--'}</span>
                        <HealthPill status={outbound.healthStatus} label={healthLabel(outbound.healthStatus, messages)} />
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
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
                    className={profileClass(scoreProfile === profileOption)}
                  >
                    {profileLabel(profileOption, messages)}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex min-h-11 items-center justify-between rounded-[8px] border border-client-line px-3 text-sm font-semibold">
              <span>{messages.autoDetect}</span>
              <input
                type="checkbox"
                checked={autoDetectCountry}
                onChange={(event) => setAutoDetectCountry(event.target.checked)}
                disabled={!canOverride}
                className="h-5 w-5 accent-client-teal"
              />
            </label>

            {selectedOutbound ? (
              <div className="rounded-[8px] border border-client-line bg-client-page p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate font-semibold">{selectedOutbound.name}</span>
                  <HealthPill status={selectedOutbound.healthStatus} label={healthLabel(selectedOutbound.healthStatus, messages)} />
                </div>
                <div className="mt-1 text-client-muted">{selectedOutbound.countryCode ?? '--'} {selectedOutbound.region ?? ''}</div>
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={!canOverride || saving}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[8px] bg-client-deep px-4 text-sm font-semibold text-white disabled:bg-client-muted"
            >
              <Save className="h-4 w-4" aria-hidden="true" />
              {saving ? messages.saving : messages.save}
            </button>

            {saved ? <StatusMessage tone="ok" text={messages.saveOk} /> : null}
            {error ? <StatusMessage tone="error" text={error} /> : null}
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
                className="min-h-10 rounded-[8px] border border-client-line px-3 text-sm font-semibold disabled:text-client-muted"
              >
                {country.countryCode} · {formatCount(country.healthyOutboundCount, language)}
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
        <div className="truncate text-base font-bold">{messages.appName}</div>
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
      className="inline-flex h-10 min-w-10 items-center justify-center gap-2 rounded-[8px] border border-client-line bg-white px-3 text-sm font-semibold"
      title={label}
      aria-label={label}
    >
      <Languages className="h-4 w-4" aria-hidden="true" />
      {language === 'en' ? 'FA' : 'EN'}
    </button>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid h-10 w-10 place-items-center rounded-[8px] border border-client-line bg-white"
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
      <h1 className="truncate text-base font-bold">{title}</h1>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-h-[76px] rounded-[8px] border border-client-line bg-client-page p-3">
      <div className="truncate text-xs font-semibold text-client-muted">{label}</div>
      <div className="mt-2 truncate text-base font-bold">{value}</div>
    </div>
  );
}

function CompactMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-h-[64px] rounded-[8px] border border-client-line bg-client-page p-2">
      <div className="truncate text-[11px] font-semibold text-client-muted">{label}</div>
      <div className="mt-2 truncate text-sm font-bold">{value}</div>
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
    <span className={`inline-flex min-h-8 items-center rounded-[8px] border px-2 text-xs font-semibold ${toneClass}`}>
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
    <div className={`mt-3 flex items-center gap-2 rounded-[8px] border px-3 py-2 text-sm font-semibold ${toneClass}`}>
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
    'min-h-10 rounded-[8px] border px-2 text-xs font-bold disabled:text-client-muted',
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

function errorText(error: unknown, messages: ClientMessages): string {
  if (error instanceof ClientApiError && error.status === 401) return messages.tokenRejected;
  if (error instanceof Error && error.message) return error.message;
  return messages.requestFailed;
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

function createRewardClaimKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `client-ad:${crypto.randomUUID()}`;
  }

  return `client-ad:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

function isRouteMode(value: string): value is ClientRoutePreferenceMode {
  return routeModes.includes(value as ClientRoutePreferenceMode);
}

function isRouteProfile(value: string): value is RouteScoreProfile {
  return routeProfiles.includes(value as RouteScoreProfile);
}
