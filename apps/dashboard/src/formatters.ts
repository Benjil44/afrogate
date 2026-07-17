import { useEffect, useState } from 'react';
import type { MetricsTimeRange, StorageVolumeMetric } from '@afrows/shared';
import type { DashboardLanguage } from './i18n';

export type DashboardFormatters = ReturnType<typeof createDashboardFormatters>;

export const timeRanges: Array<{ label: string; value: MetricsTimeRange }> = [
  { label: '15m', value: '15m' },
  { label: '1h', value: '1h' },
  { label: '6h', value: '6h' },
  { label: '24h', value: '24h' },
];

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function normalizePercent(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return clamp(value, 0, 100);
}

export function normalizePositive(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.max(0, value);
}

export function createStorageFallback(diskFreePercent: number | null | undefined): StorageVolumeMetric[] {
  const freePercent = normalizePercent(diskFreePercent);

  return freePercent === null ? [] : [{ path: '/', freePercent, usedPercent: 100 - freePercent }];
}

export function averagePercent(values: Array<number | null>): number | null {
  const validValues = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

  if (validValues.length === 0) return null;

  return validValues.reduce((sum, value) => sum + value, 0) / validValues.length;
}

export function sumNullable(values: Array<number | null>): number | null {
  const validValues = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

  if (validValues.length === 0) return null;

  return validValues.reduce((sum, value) => sum + value, 0);
}

export function createDashboardFormatters(language: DashboardLanguage) {
  const isarabic = language === 'fa';
  const locale = isarabic ? 'fa-IR-u-nu-arabext' : 'en-US';
  const percentSign = isarabic ? '٪' : '%';
  const fontFamily = isarabic
    ? '"Afrows YekanBakh", Tahoma, Arial, sans-serif'
    : 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  const integerFormatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const decimalFormatter = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  });
  const clockFormatter = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    hour12: !isarabic,
    minute: '2-digit',
    second: '2-digit',
  });
  const shortTimeFormatter = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    hour12: !isarabic,
    minute: '2-digit',
  });
  const dateTimeFormatter = new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    hour: '2-digit',
    hour12: !isarabic,
    minute: '2-digit',
    month: 'short',
  });

  const integer = (value: number): string => integerFormatter.format(Number.isFinite(value) ? value : 0);
  const decimal = (value: number): string => decimalFormatter.format(Number.isFinite(value) ? value : 0);
  const percent = (value: number | null): string => value === null ? '--' : `${integer(Math.round(value))}${percentSign}`;
  const arabicLabels: Record<string, string> = {
    'Ireland Edge 01': 'لبه ایران ۰۱',
    'Ireland Edge 02': 'لبه ایران ۰۲',
    'Germany Core 01': 'هسته آلمان ۰۱',
    'Germany gateway': 'درگاه آلمان',
    'Control egress': 'خروجی کنترل',
    'Ireland direct': 'مسیر مستقیم ایران',
    'Mobinnet': 'مبین‌نت',
    'Irelandcell': 'ایرانسل',
    'IR': 'ایران',
    'DE': 'آلمان',
    'WireGuard': 'وایرگارد',
    'VLESS proxy': 'پراکسی VLESS',
    'Direct': 'مستقیم',
    'primary': 'اصلی',
    'telegram/api': 'تلگرام/API',
    'last resort': 'آخرین مسیر',
    'balanced': 'متعادل',
    'stability': 'پایداری',
    'throughput': 'سرعت بالا',
    'gaming': 'گیمینگ',
    'tcp': 'TCP',
    'udp': 'UDP',
    'quic': 'QUIC',
    'dns': 'DNS',
    'wireguard': 'WireGuard',
    'ether1 / Mobinnet / wg1': 'ether1 / مبین‌نت / wg1',
    'ether2 / Irelandcell / wireguard2': 'ether2 / ایرانسل / wireguard2',
    'ether5 / Irelandcell / wireguard3': 'ether5 / ایرانسل / wireguard3',
    'core uplink / Germany / gateway': 'آپ‌لینک هسته / آلمان / درگاه',
  };

  const formatCompactNumber = (value: number): string => {
    const roundedValue = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;

    return Number.isInteger(roundedValue) ? integer(roundedValue) : decimal(roundedValue);
  };

  return {
    fontFamily,
    integer,
    percent,
    label(value: string): string {
      return isarabic ? arabicLabels[value] ?? value : value;
    },
    bytesPerSecond(value: number | null): string {
      if (value === null) return '--';

      const units = isarabic
        ? ['بایت/ث', 'کیلوبایت/ث', 'مگابایت/ث', 'گیگابایت/ث']
        : ['B/s', 'KB/s', 'MB/s', 'GB/s'];
      let currentValue = value;
      let unitIndex = 0;

      while (currentValue >= 1024 && unitIndex < units.length - 1) {
        currentValue /= 1024;
        unitIndex += 1;
      }

      return `${formatCompactNumber(currentValue)} ${units[unitIndex]}`;
    },
    bytes(value: number | null): string {
      if (value === null) return '--';

      const units = isarabic
        ? ['بایت', 'کیلوبایت', 'مگابایت', 'گیگابایت', 'ترابایت']
        : ['B', 'KB', 'MB', 'GB', 'TB'];
      let currentValue = value;
      let unitIndex = 0;

      while (currentValue >= 1024 && unitIndex < units.length - 1) {
        currentValue /= 1024;
        unitIndex += 1;
      }

      return `${formatCompactNumber(currentValue)} ${units[unitIndex]}`;
    },
    packetLoss(value: number | null): string {
      return value === null ? '--' : `${decimal(value)}${percentSign}`;
    },
    latency(value: number | null): string {
      if (value === null) return '--';

      return isarabic ? `${integer(value)} میلی‌ثانیه` : `${integer(value)} ms`;
    },
    durationSeconds(value: number): string {
      return isarabic ? `${integer(value)} ثانیه` : `${integer(value)}s`;
    },
    durationMinutes(value: number): string {
      if (value <= 0) return isarabic ? 'اکنون' : 'now';

      return isarabic ? `${integer(value)} دقیقه` : `${integer(value)}m`;
    },
    percentThreshold(operator: '<' | '>', value: number): string {
      return `${operator} ${percent(value)}`;
    },
    numberThreshold(operator: '<' | '>', value: number): string {
      return `${operator} ${integer(value)}`;
    },
    latencyThreshold(operator: '<' | '>', value: number): string {
      return `${operator} ${isarabic ? `${integer(value)} میلی‌ثانیه` : `${integer(value)} ms`}`;
    },
    scoreDelta(value: number): string {
      return isarabic ? `+${integer(value)} امتیاز` : `+${integer(value)} score`;
    },
    time(date: Date, includeSeconds = true): string {
      return includeSeconds ? clockFormatter.format(date) : shortTimeFormatter.format(date);
    },
    dateTime(date: Date): string {
      return Number.isNaN(date.getTime()) ? '--' : dateTimeFormatter.format(date);
    },
    timeRange(range: MetricsTimeRange): string {
      if (!isarabic) return timeRanges.find((item) => item.value === range)?.label ?? range;

      const ranges: Record<MetricsTimeRange, string> = {
        '15m': `${integer(15)}د`,
        '1h': `${integer(1)}س`,
        '6h': `${integer(6)}س`,
        '24h': `${integer(24)}س`,
      };

      return ranges[range];
    },
    chartTime(value: string | number): string {
      const timestamp = typeof value === 'number' ? value : Date.parse(value);

      return Number.isFinite(timestamp) ? shortTimeFormatter.format(new Date(timestamp)) : String(value);
    },
  };
}

export function dashboardLanguageLabel(language: DashboardLanguage): string {
  return language === 'fa' ? 'فارسی' : 'English';
}

export function useWallClock(format: DashboardFormatters): string {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);

    return () => window.clearInterval(timer);
  }, []);

  return format.time(now);
}

export function normalizeNullableText(value: string): string | null {
  const trimmedValue = value.trim();

  return trimmedValue ? trimmedValue : null;
}
