import type {
  ClientConfigStatus,
  ClientRoutePreferenceMode,
  OutboundHealthStatus,
  RouteScoreProfile,
} from '@afrows/shared';

export type Language = 'en' | 'fa';

export const translations = {
  en: {
    appName: 'Afrows',
    clientSurface: 'Customer panel',
    token: 'Client token',
    tokenHint: 'Paste the access token you received from Afrows support.',
    connect: 'Connect',
    signOut: 'Sign out',
    language: 'Language',
    refresh: 'Refresh',
    save: 'Save',
    saving: 'Saving…',
    loading: 'Loading…',
    loadingAccount: 'Loading your account…',
    routeOpen: 'Route open',
    quota: 'Quota',
    rewardedData: 'Rewarded data',
    watchAd: 'Watch ad',
    claimingReward: 'Adding…',
    rewardAdded: 'Reward added to your quota',
    adsToday: 'Ads today',
    adsRemaining: 'Ads left',
    rewardDisabled: 'Rewards disabled',
    rewardLimitReached: 'Daily limit reached',
    remaining: 'Remaining',
    used: 'Used',
    unlimited: 'Unlimited',
    status: 'Status',
    protocol: 'Protocol',
    route: 'Route',
    perAppVpn: 'Per-app VPN',
    allApps: 'All apps',
    selectedAppsOnly: 'Selected apps',
    selectedApps: 'Selected apps',
    nativeStatus: 'Android',
    androidReady: 'Ready',
    iosStatus: 'iOS',
    iosManaged: 'Managed profile',
    privacy: 'Privacy',
    localOnly: 'Local only',
    copyNativeProfile: 'Copy profile',
    copiedNativeProfile: 'Profile copied',
    subscription: 'Subscription',
    subscriptionServers: 'Servers',
    configLinks: 'Config links',
    usageCost: 'Usage cost',
    usableOnServer: 'Usable here',
    noSubscriptionEndpoints: 'No servers have been published for your subscription yet',
    ready: 'Ready',
    needsSecret: 'Needs client secret',
    secretUnavailable: 'Secret unavailable',
    secretInvalid: 'Secret incomplete',
    missingEndpoint: 'Missing endpoint',
    unsupportedProtocol: 'Unsupported',
    manualProfile: 'Manual profile',
    vlessUri: 'VLESS link',
    l2tpProfile: 'L2TP profile',
    ikev2Profile: 'IKEv2 profile',
    requiresClientSecret: 'Client secret required',
    privateConfig: 'Private config',
    copyConfig: 'Copy link',
    copiedConfig: 'Copied',
    openInApp: 'Open in VPN app',
    profile: 'Profile',
    detectedCountry: 'Your current country',
    preferredCountry: 'Country',
    preferredServer: 'Server',
    routeOptions: 'Route options',
    availableCountries: 'Countries',
    automatic: 'Automatic',
    country: 'Country',
    outbound: 'Server',
    autoDetect: 'Detect country automatically',
    useDeviceCountry: 'Use device country',
    overrideLocked: 'Locked by support',
    routeLocked: 'Route locked',
    stickyProtected: 'Sticky sessions',
    noToken: 'Enter your client token',
    noCountries: 'No countries available',
    noOutbounds: 'No servers available',
    chooseCountry: 'Choose country',
    chooseServer: 'Choose server',
    saveOk: 'Saved',
    tokenRejected: 'Token rejected. Check it or ask support for a new one.',
    requestFailed: 'Could not reach the server. Check your connection and try again.',
    healthy: 'Healthy',
    degraded: 'Degraded',
    critical: 'Critical',
    unknown: 'Unknown',
    active: 'Active',
    limited: 'Limited',
    disabled: 'Disabled',
    expired: 'Expired',
    balanced: 'Balanced',
    stability: 'Stability',
    throughput: 'Throughput',
    gaming: 'Gaming',
    tcp: 'TCP',
    udp: 'UDP',
    quic: 'QUIC',
    dns: 'DNS',
    wireguard: 'WireGuard',
  },
  fa: {
    appName: 'Afrows',
    clientSurface: 'پنل مشتری',
    token: 'توکن کلاینت',
    tokenHint: 'توکنی را که از پشتیبانی افروز گرفته‌اید اینجا وارد کنید.',
    connect: 'ورود',
    signOut: 'خروج',
    language: 'زبان',
    refresh: 'تازه‌سازی',
    save: 'ذخیره',
    saving: 'در حال ذخیره…',
    loading: 'در حال بارگذاری…',
    loadingAccount: 'در حال بارگذاری حساب شما…',
    routeOpen: 'مسیر آزاد',
    quota: 'حجم',
    rewardedData: 'حجم هدیه',
    watchAd: 'دیدن تبلیغ',
    claimingReward: 'در حال افزودن…',
    rewardAdded: 'حجم هدیه به حساب شما اضافه شد',
    adsToday: 'تبلیغ امروز',
    adsRemaining: 'تبلیغ باقی‌مانده',
    rewardDisabled: 'هدیه غیرفعال است',
    rewardLimitReached: 'سقف روزانه پر شد',
    remaining: 'باقی‌مانده',
    used: 'مصرف‌شده',
    unlimited: 'نامحدود',
    status: 'وضعیت',
    protocol: 'پروتکل',
    route: 'مسیر',
    perAppVpn: 'VPN برای هر اپ',
    allApps: 'همهٔ اپ‌ها',
    selectedAppsOnly: 'فقط اپ‌های انتخابی',
    selectedApps: 'اپ‌های انتخابی',
    nativeStatus: 'اندروید',
    androidReady: 'آماده',
    iosStatus: 'iOS',
    iosManaged: 'پروفایل مدیریتی',
    privacy: 'حریم خصوصی',
    localOnly: 'فقط روی دستگاه',
    copyNativeProfile: 'کپی پروفایل',
    copiedNativeProfile: 'پروفایل کپی شد',
    subscription: 'اشتراک',
    subscriptionServers: 'سرورها',
    configLinks: 'لینک‌های کانفیگ',
    usageCost: 'ضریب مصرف',
    usableOnServer: 'قابل استفاده اینجا',
    noSubscriptionEndpoints: 'هنوز سروری برای اشتراک شما منتشر نشده است',
    ready: 'آماده',
    needsSecret: 'نیاز به کلید کلاینت',
    secretUnavailable: 'کلید در دسترس نیست',
    secretInvalid: 'کلید ناقص است',
    missingEndpoint: 'آدرس سرور ناقص است',
    unsupportedProtocol: 'پشتیبانی نمی‌شود',
    manualProfile: 'پروفایل دستی',
    vlessUri: 'لینک VLESS',
    l2tpProfile: 'پروفایل L2TP',
    ikev2Profile: 'پروفایل IKEv2',
    requiresClientSecret: 'کلید کلاینت لازم است',
    privateConfig: 'کانفیگ خصوصی',
    copyConfig: 'کپی لینک',
    copiedConfig: 'کپی شد',
    openInApp: 'باز کردن در اپ VPN',
    profile: 'پروفایل',
    detectedCountry: 'کشور فعلی شما',
    preferredCountry: 'کشور',
    preferredServer: 'سرور',
    routeOptions: 'تنظیمات مسیر',
    availableCountries: 'کشورها',
    automatic: 'خودکار',
    country: 'کشور',
    outbound: 'سرور',
    autoDetect: 'تشخیص خودکار کشور',
    useDeviceCountry: 'کشور دستگاه',
    overrideLocked: 'قفل‌شده توسط پشتیبانی',
    routeLocked: 'مسیر قفل است',
    stickyProtected: 'نشست پایدار',
    noToken: 'توکن کلاینت را وارد کنید',
    noCountries: 'کشوری در دسترس نیست',
    noOutbounds: 'سروری در دسترس نیست',
    chooseCountry: 'انتخاب کشور',
    chooseServer: 'انتخاب سرور',
    saveOk: 'ذخیره شد',
    tokenRejected: 'توکن پذیرفته نشد. آن را دوباره بررسی کنید یا از پشتیبانی توکن تازه بگیرید.',
    requestFailed: 'ارتباط با سرور برقرار نشد. اینترنت را بررسی کنید و دوباره تلاش کنید.',
    healthy: 'سالم',
    degraded: 'ضعیف',
    critical: 'بحرانی',
    unknown: 'نامشخص',
    active: 'فعال',
    limited: 'محدود',
    disabled: 'غیرفعال',
    expired: 'منقضی',
    balanced: 'متعادل',
    stability: 'پایداری',
    throughput: 'سرعت',
    gaming: 'گیمینگ',
    tcp: 'TCP',
    udp: 'UDP',
    quic: 'QUIC',
    dns: 'DNS',
    wireguard: 'WireGuard',
  },
} as const;

export type ClientMessageKey = keyof typeof translations.en;
export type ClientMessages = Record<ClientMessageKey, string>;

export function isLanguage(value: string | null): value is Language {
  return value === 'en' || value === 'fa';
}

/** First visit: follow the phone's language (most customers are Persian), otherwise English. */
export function detectDefaultLanguage(): Language {
  if (typeof navigator === 'undefined') return 'en';
  const locales = navigator.languages?.length ? navigator.languages : [navigator.language];
  return locales.some((locale) => /^fa\b/i.test(locale ?? '')) ? 'fa' : 'en';
}

export function directionFor(language: Language): 'ltr' | 'rtl' {
  return language === 'fa' ? 'rtl' : 'ltr';
}

function localeFor(language: Language): string {
  return language === 'fa' ? 'fa-IR' : 'en-US';
}

export function modeLabel(mode: ClientRoutePreferenceMode | string, messages: ClientMessages): string {
  if (mode === 'auto') return messages.automatic;
  if (mode === 'country') return messages.country;
  if (mode === 'outbound') return messages.outbound;
  return mode;
}

export function profileLabel(profile: RouteScoreProfile | string, messages: ClientMessages): string {
  if (profile === 'balanced') return messages.balanced;
  if (profile === 'stability') return messages.stability;
  if (profile === 'throughput') return messages.throughput;
  if (profile === 'gaming') return messages.gaming;
  if (profile === 'tcp') return messages.tcp;
  if (profile === 'udp') return messages.udp;
  if (profile === 'quic') return messages.quic;
  if (profile === 'dns') return messages.dns;
  if (profile === 'wireguard') return messages.wireguard;
  return profile;
}

export function healthLabel(status: OutboundHealthStatus | string, messages: ClientMessages): string {
  if (status === 'healthy') return messages.healthy;
  if (status === 'degraded') return messages.degraded;
  if (status === 'critical') return messages.critical;
  return messages.unknown;
}

export function configRenderStatusLabel(status: string, messages: ClientMessages): string {
  if (status === 'rendered') return messages.ready;
  if (status === 'blocked_secret_required') return messages.needsSecret;
  if (status === 'blocked_secret_unavailable') return messages.secretUnavailable;
  if (status === 'blocked_secret_invalid') return messages.secretInvalid;
  if (status === 'missing_public_config') return messages.missingEndpoint;
  if (status === 'unsupported_protocol') return messages.unsupportedProtocol;
  return messages.unknown;
}

export function configFormatLabel(format: string, messages: ClientMessages): string {
  if (format === 'wireguard-profile') return messages.wireguard;
  if (format === 'vless-uri') return messages.vlessUri;
  if (format === 'l2tp-profile') return messages.l2tpProfile;
  if (format === 'ikev2-profile') return messages.ikev2Profile;
  return messages.manualProfile;
}

export function clientStatusLabel(status: ClientConfigStatus | string, messages: ClientMessages): string {
  if (status === 'active') return messages.active;
  if (status === 'limited') return messages.limited;
  if (status === 'disabled') return messages.disabled;
  if (status === 'expired') return messages.expired;
  return status;
}

/** Protocol ids are technical identifiers (`vless`, `wireguard`); show them in their usual capitalised form. */
export function protocolLabel(protocol: string): string {
  if (protocol === 'wireguard') return 'WireGuard';
  return protocol.toUpperCase();
}

/** Human country name for an ISO code ("DE" -> "Germany" / "آلمان"); falls back to the code. */
export function regionName(countryCode: string, language: Language): string {
  try {
    const name = new Intl.DisplayNames([localeFor(language)], { type: 'region', fallback: 'none' }).of(countryCode.toUpperCase());
    return name || countryCode;
  } catch {
    return countryCode;
  }
}

export function formatBytes(value: number | null | undefined, language: Language, messages: ClientMessages): string {
  if (value === null || value === undefined) return messages.unlimited;
  const units = language === 'fa'
    ? ['بایت', 'کیلوبایت', 'مگابایت', 'گیگابایت', 'ترابایت']
    : ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = Math.max(value, 0);
  let unitIndex = 0;

  // Decimal units (1 GB = 1,000,000,000 bytes), matching how Afrows sells data.
  while (size >= 1000 && unitIndex < units.length - 1) {
    size /= 1000;
    unitIndex += 1;
  }

  const number = new Intl.NumberFormat(localeFor(language), {
    maximumFractionDigits: unitIndex === 0 ? 0 : 1,
  }).format(size);

  return `${number} ${units[unitIndex]}`;
}

export function formatCount(value: number, language: Language): string {
  return new Intl.NumberFormat(localeFor(language)).format(value);
}

/** `62%` / `۶۲٪` from a 0-100 value. */
export function formatPercent(value: number, language: Language): string {
  return new Intl.NumberFormat(localeFor(language), { style: 'percent', maximumFractionDigits: 0 }).format(value / 100);
}
