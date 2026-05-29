import type {
  ClientConfigStatus,
  ClientRoutePreferenceMode,
  OutboundHealthStatus,
  RouteScoreProfile,
} from '@afrogate/shared';

export type Language = 'en' | 'fa';

export const defaultLanguage: Language = 'en';

export const translations = {
  en: {
    appName: 'AfroGate',
    clientSurface: 'Client',
    token: 'Client token',
    connect: 'Connect',
    signOut: 'Sign out',
    language: 'Language',
    refresh: 'Refresh',
    save: 'Save',
    saving: 'Saving',
    loading: 'Loading',
    connected: 'Connected',
    disconnected: 'Disconnected',
    quota: 'Quota',
    rewardedData: 'Rewarded data',
    watchAd: 'Watch ad',
    claimingReward: 'Claiming',
    rewardAdded: 'Reward added',
    adsToday: 'Ads today',
    adsRemaining: 'Ads left',
    rewardDisabled: 'Rewards disabled',
    rewardLimitReached: 'Daily limit reached',
    remaining: 'Remaining',
    used: 'Used',
    unlimited: 'Unlimited',
    device: 'Device',
    status: 'Status',
    protocol: 'Protocol',
    route: 'Route',
    subscription: 'Subscription',
    subscriptionServers: 'Subscription servers',
    subscriptionUpdated: 'Updated',
    usageCost: 'Usage cost',
    usableOnServer: 'Usable here',
    noSubscriptionEndpoints: 'No subscription endpoints published',
    mode: 'Mode',
    profile: 'Profile',
    detectedCountry: 'Detected country',
    preferredCountry: 'Country',
    preferredServer: 'Server',
    routeOptions: 'Route options',
    availableCountries: 'Countries',
    automatic: 'Automatic',
    country: 'Country',
    outbound: 'Server',
    autoDetect: 'Auto detect',
    useDeviceCountry: 'Use device country',
    overrideLocked: 'Locked by admin',
    routeLocked: 'Route locked',
    stickyProtected: 'Sticky sessions',
    noToken: 'Client token required',
    noCountries: 'No countries available',
    noOutbounds: 'No servers available',
    chooseCountry: 'Choose country',
    chooseServer: 'Choose server',
    saveOk: 'Saved',
    tokenRejected: 'Token rejected',
    requestFailed: 'Request failed',
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
    appName: 'AfroGate',
    clientSurface: 'کلاینت',
    token: 'توکن کلاینت',
    connect: 'اتصال',
    signOut: 'خروج',
    language: 'زبان',
    refresh: 'تازه سازی',
    save: 'ذخیره',
    saving: 'در حال ذخیره',
    loading: 'در حال بارگذاری',
    connected: 'متصل',
    disconnected: 'قطع',
    quota: 'حجم',
    rewardedData: 'حجم هدیه',
    watchAd: 'دیدن تبلیغ',
    claimingReward: 'در حال شارژ',
    rewardAdded: 'حجم اضافه شد',
    adsToday: 'تبلیغ امروز',
    adsRemaining: 'تبلیغ باقی مانده',
    rewardDisabled: 'هدیه غیرفعال است',
    rewardLimitReached: 'سقف روزانه پر شد',
    remaining: 'باقی مانده',
    used: 'مصرف شده',
    unlimited: 'نامحدود',
    device: 'دستگاه',
    status: 'وضعیت',
    protocol: 'پروتکل',
    route: 'مسیر',
    subscription: 'سابسکریپشن',
    subscriptionServers: 'سرورهای سابسکریپشن',
    subscriptionUpdated: 'به روز شده',
    usageCost: 'ضریب مصرف',
    usableOnServer: 'قابل استفاده اینجا',
    noSubscriptionEndpoints: 'اندپوینتی برای سابسکریپشن منتشر نشده',
    mode: 'حالت',
    profile: 'پروفایل',
    detectedCountry: 'کشور تشخیص داده شده',
    preferredCountry: 'کشور',
    preferredServer: 'سرور',
    routeOptions: 'گزینه های مسیر',
    availableCountries: 'کشورها',
    automatic: 'خودکار',
    country: 'کشور',
    outbound: 'سرور',
    autoDetect: 'تشخیص خودکار',
    useDeviceCountry: 'کشور دستگاه',
    overrideLocked: 'قفل توسط ادمین',
    routeLocked: 'مسیر قفل است',
    stickyProtected: 'نشست پایدار',
    noToken: 'توکن کلاینت لازم است',
    noCountries: 'کشوری در دسترس نیست',
    noOutbounds: 'سروری در دسترس نیست',
    chooseCountry: 'انتخاب کشور',
    chooseServer: 'انتخاب سرور',
    saveOk: 'ذخیره شد',
    tokenRejected: 'توکن رد شد',
    requestFailed: 'درخواست ناموفق بود',
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

export function directionFor(language: Language): 'ltr' | 'rtl' {
  return language === 'fa' ? 'rtl' : 'ltr';
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

export function clientStatusLabel(status: ClientConfigStatus | string, messages: ClientMessages): string {
  if (status === 'active') return messages.active;
  if (status === 'limited') return messages.limited;
  if (status === 'disabled') return messages.disabled;
  if (status === 'expired') return messages.expired;
  return status;
}

export function formatBytes(value: number | null | undefined, language: Language, messages: ClientMessages): string {
  if (value === null || value === undefined) return messages.unlimited;
  const units = language === 'fa'
    ? ['بایت', 'کیلوبایت', 'مگابایت', 'گیگابایت', 'ترابایت']
    : ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = Math.max(value, 0);
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  const number = new Intl.NumberFormat(language === 'fa' ? 'fa-IR' : 'en-US', {
    maximumFractionDigits: unitIndex === 0 ? 0 : 1,
  }).format(size);

  return `${number} ${units[unitIndex]}`;
}

export function formatCount(value: number, language: Language): string {
  return new Intl.NumberFormat(language === 'fa' ? 'fa-IR' : 'en-US').format(value);
}
