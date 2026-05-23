import { useEffect, useMemo, useState } from 'react';

export type DashboardLanguage = 'en' | 'fa';

const languageStorageKey = 'afrogate.dashboard.language';

export const dashboardTranslations = {
  en: {
    languageName: 'English',
    nextLanguageLabel: 'FA',
    switchLanguage: 'Switch language',
    nav: {
      dashboard: 'Dashboard',
      servers: 'Servers',
      routes: 'Routes',
      alerts: 'Alerts',
    },
    pageHeaders: {
      dashboard: { eyebrow: 'Operations', title: 'Network operations display' },
      servers: { eyebrow: 'Infrastructure', title: 'Server management' },
      routes: { eyebrow: 'Routing', title: 'Routes and failover' },
      alerts: { eyebrow: 'Incidents', title: 'Alerts and delivery' },
    },
    dataStatus: {
      live: 'Live',
      stale: 'Stale',
      loading: 'Connecting',
      fallback: 'Local sample',
    },
    aria: {
      systemResources: 'System resources',
      summary: 'Summary',
      healthChart: 'Server health score timeline',
    },
    resources: {
      cpuAverage: 'CPU average',
      ramAverage: 'RAM average',
      lowestStorage: 'Lowest storage',
      download: 'Download',
      upload: 'Upload',
      cpu: 'CPU',
      ram: 'RAM',
      diskFree: 'Disk free',
      down: 'Down',
      up: 'Up',
      health: 'Health',
    },
    summary: {
      activeUsers: 'Active users',
      downloadNow: 'Download now',
      uploadNow: 'Upload now',
      criticalAlerts: 'Critical alerts',
    },
    panels: {
      healthTimeline: 'Health timeline',
      monitoredNodes: (count: number) => `${count} monitored nodes`,
      outbounds: 'Outbounds',
      priorityFailover: 'priority failover',
      alerts: 'Alerts',
      visible: (count: number) => `${count} visible`,
      capacity: 'Capacity',
      managerView: 'manager view',
      controlPlane: 'Control Plane',
      operations: 'operations',
      serverInventory: 'Server Inventory',
      managedNodes: (count: number) => `${count} managed nodes`,
      accessBootstrap: 'Access & Bootstrap',
      safeOperations: 'safe operations',
      routePolicy: 'Route Policy',
      stabilityRules: 'stability rules',
      failover: 'Failover',
      latestDecisions: 'latest decisions',
      openAlerts: 'Open Alerts',
      activeRows: (count: number) => `${count} active rows`,
      alertRules: 'Alert Rules',
      mvpThresholds: 'MVP thresholds',
      servers: 'Servers',
      nodes: (count: number) => `${count} nodes`,
      tunnels: 'Tunnels',
      links: (count: number) => `${count} links`,
    },
    capacity: {
      usersOnline: 'Users online',
      minTargetUser: 'Min target/user',
      routeMode: 'Route mode',
      autoLock: 'Auto + lock',
    },
    controlPlaneRows: {
      metricsIngest: 'Metrics ingest',
      telegramApiEgress: 'Telegram/API egress',
      proxyReady: 'Proxy ready',
      storageAlert: 'Storage alert',
      backups: 'Backups',
      pending: 'Pending',
    },
    accessRows: {
      defaultUser: 'Default user',
      accessMethod: 'Access method',
      sshKey: 'SSH key',
      rootPassword: 'Root password',
      bootstrapOnly: 'bootstrap only',
      credentialView: 'Credential view',
      hidden: 'hidden',
      auditMode: 'Audit mode',
      required: 'required',
    },
    actions: {
      edit: 'Edit',
    },
    routePolicy: {
      autoRoute: 'Auto route',
      routeLock: 'Route lock',
      cooldown: 'Cooldown',
      hysteresis: 'Hysteresis',
      enabled: 'enabled',
      available: 'available',
      score: '+15 score',
    },
    failover: {
      primaryRouteHealthy: 'primary route healthy',
      standbyTelegramApi: 'standby for Telegram/API',
      restrictedInternetPath: 'restricted internet path',
    },
    alerts: {
      storageBelow: 'Storage below 10%',
      healthScoreDegraded: 'Health score degraded',
      noCriticalServerAlerts: 'No critical server alerts',
      outboundFailoverReady: 'Outbound failover ready',
      backupMonitorPending: 'Backup monitor pending',
      monitoring: 'Monitoring',
      routes: 'Routes',
      controlPlane: 'Control plane',
      dashboard: 'Dashboard',
    },
    alertRules: {
      storage: 'Storage',
      healthScore: 'Health score',
      ping: 'Ping',
      packetLoss: 'پکت لاست',
    },
    tables: {
      tunnel: 'Tunnel',
      operator: 'Operator',
      ping: 'Ping',
      jitter: 'Jitter',
      loss: 'افت بسته',
      score: 'Score',
      severity: 'Severity',
      source: 'Source',
      alert: 'Alert',
      channel: 'Channel',
    },
    status: {
      healthy: 'healthy',
      standby: 'standby',
      restricted: 'restricted',
      good: 'good',
      neutral: 'neutral',
      warning: 'warning',
      critical: 'critical',
    },
    chart: {
      watch: 'watch',
    },
  },
  fa: {
    languageName: 'فارسی',
    nextLanguageLabel: 'EN',
    switchLanguage: 'تغییر زبان',
    nav: {
      dashboard: 'داشبورد',
      servers: 'سرورها',
      routes: 'مسیرها',
      alerts: 'هشدارها',
    },
    pageHeaders: {
      dashboard: { eyebrow: 'عملیات', title: 'نمایش عملیات شبکه' },
      servers: { eyebrow: 'زیرساخت', title: 'مدیریت سرورها' },
      routes: { eyebrow: 'مسیریابی', title: 'مسیرها و فیل‌اور' },
      alerts: { eyebrow: 'رخدادها', title: 'هشدارها و ارسال اعلان' },
    },
    dataStatus: {
      live: 'زنده',
      stale: 'قدیمی',
      loading: 'در حال اتصال',
      fallback: 'نمونه محلی',
    },
    aria: {
      systemResources: 'منابع سیستم',
      summary: 'خلاصه',
      healthChart: 'نمودار امتیاز سلامت سرورها',
    },
    resources: {
      cpuAverage: 'میانگین CPU',
      ramAverage: 'میانگین RAM',
      lowestStorage: 'کمترین فضای آزاد',
      download: 'دانلود',
      upload: 'آپلود',
      cpu: 'CPU',
      ram: 'RAM',
      diskFree: 'فضای آزاد دیسک',
      down: 'دانلود',
      up: 'آپلود',
      health: 'سلامت',
    },
    summary: {
      activeUsers: 'کاربران فعال',
      downloadNow: 'دانلود فعلی',
      uploadNow: 'آپلود فعلی',
      criticalAlerts: 'هشدارهای بحرانی',
    },
    panels: {
      healthTimeline: 'روند سلامت',
      monitoredNodes: (count: number) => `${count} نود مانیتور می‌شود`,
      outbounds: 'اوت‌باندها',
      priorityFailover: 'اولویت و فیل‌اور',
      alerts: 'هشدارها',
      visible: (count: number) => `${count} مورد قابل مشاهده`,
      capacity: 'ظرفیت',
      managerView: 'نمای مدیر',
      controlPlane: 'کنترل‌پلین',
      operations: 'عملیات',
      serverInventory: 'فهرست سرورها',
      managedNodes: (count: number) => `${count} نود مدیریت‌شده`,
      accessBootstrap: 'دسترسی و راه‌اندازی',
      safeOperations: 'عملیات امن',
      routePolicy: 'سیاست مسیر',
      stabilityRules: 'قوانین پایداری',
      failover: 'فیل‌اور',
      latestDecisions: 'آخرین تصمیم‌ها',
      openAlerts: 'هشدارهای باز',
      activeRows: (count: number) => `${count} ردیف فعال`,
      alertRules: 'قوانین هشدار',
      mvpThresholds: 'آستانه‌های MVP',
      servers: 'سرورها',
      nodes: (count: number) => `${count} نود`,
      tunnels: 'تونل‌ها',
      links: (count: number) => `${count} لینک`,
    },
    capacity: {
      usersOnline: 'کاربران آنلاین',
      minTargetUser: 'حداقل هدف/کاربر',
      routeMode: 'حالت مسیر',
      autoLock: 'خودکار + قفل',
    },
    controlPlaneRows: {
      metricsIngest: 'دریافت متریک',
      telegramApiEgress: 'خروجی تلگرام/API',
      proxyReady: 'پروکسی آماده',
      storageAlert: 'هشدار فضای ذخیره',
      backups: 'بکاپ‌ها',
      pending: 'در انتظار',
    },
    accessRows: {
      defaultUser: 'کاربر پیش‌فرض',
      accessMethod: 'روش دسترسی',
      sshKey: 'کلید SSH',
      rootPassword: 'پسورد root',
      bootstrapOnly: 'فقط راه‌اندازی',
      credentialView: 'نمایش اعتبارنامه',
      hidden: 'مخفی',
      auditMode: 'حالت حسابرسی',
      required: 'الزامی',
    },
    actions: {
      edit: 'ویرایش',
    },
    routePolicy: {
      autoRoute: 'مسیر خودکار',
      routeLock: 'قفل مسیر',
      cooldown: 'کول‌داون',
      hysteresis: 'هیسترزیس',
      enabled: 'فعال',
      available: 'در دسترس',
      score: '+15 امتیاز',
    },
    failover: {
      primaryRouteHealthy: 'مسیر اصلی سالم است',
      standbyTelegramApi: 'آماده برای تلگرام/API',
      restrictedInternetPath: 'مسیر محدود اینترنت',
    },
    alerts: {
      storageBelow: 'فضای ذخیره زیر 10٪',
      healthScoreDegraded: 'امتیاز سلامت افت کرده',
      noCriticalServerAlerts: 'هشدار بحرانی سرور وجود ندارد',
      outboundFailoverReady: 'فیل‌اور اوت‌باند آماده است',
      backupMonitorPending: 'مانیتور بکاپ در انتظار است',
      monitoring: 'مانیتورینگ',
      routes: 'مسیرها',
      controlPlane: 'کنترل‌پلین',
      dashboard: 'داشبورد',
    },
    alertRules: {
      storage: 'فضای ذخیره',
      healthScore: 'امتیاز سلامت',
      ping: 'پینگ',
      packetLoss: 'Packet loss',
    },
    tables: {
      tunnel: 'تونل',
      operator: 'اپراتور',
      ping: 'پینگ',
      jitter: 'جیتر',
      loss: 'Loss',
      score: 'امتیاز',
      severity: 'شدت',
      source: 'منبع',
      alert: 'هشدار',
      channel: 'کانال',
    },
    status: {
      healthy: 'سالم',
      standby: 'آماده',
      restricted: 'محدود',
      good: 'خوب',
      neutral: 'عادی',
      warning: 'هشدار',
      critical: 'بحرانی',
    },
    chart: {
      watch: 'بررسی',
    },
  },
};

export type DashboardStrings = typeof dashboardTranslations.en;

export function useDashboardLanguage() {
  const [language, setLanguage] = useState<DashboardLanguage>(loadInitialLanguage);

  useEffect(() => {
    window.localStorage.setItem(languageStorageKey, language);
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'fa' ? 'rtl' : 'ltr';
  }, [language]);

  return useMemo(() => {
    const nextLanguage: DashboardLanguage = language === 'fa' ? 'en' : 'fa';

    return {
      language,
      isRtl: language === 'fa',
      nextLanguage,
      setLanguage,
      strings: dashboardTranslations[language],
    };
  }, [language]);
}

function loadInitialLanguage(): DashboardLanguage {
  const savedLanguage = window.localStorage.getItem(languageStorageKey);
  if (savedLanguage === 'en' || savedLanguage === 'fa') return savedLanguage;

  const browserLanguages = window.navigator.languages.length > 0 ? window.navigator.languages : [window.navigator.language];
  return browserLanguages.some((language) => language.toLowerCase().startsWith('fa')) ? 'fa' : 'en';
}
