import type { AdminCustomerAccountSummary, AdminPaymentOrderSummary, AdminResellerAccountSummary } from '@afrows/shared';
import type { AfroChartOption } from './components/EChart';
import type { DashboardFormatters } from './formatters';
import type { DashboardStrings } from './i18n';

export type ResellerSalesStats = {
  activeCustomerCount: number;
  afrowsShareAmount: number;
  averageSoldGb: number;
  currency: string;
  lowQuotaCount: number;
  orderCount: number;
  remainingBytes: number | null;
  sellerMarginAmount: number;
  soldBytes: number;
  totalSalesAmount: number;
  usedBytes: number;
};

export function createResellerSalesStats(
  accounts: AdminCustomerAccountSummary[],
  paymentOrders: AdminPaymentOrderSummary[],
  reseller: AdminResellerAccountSummary | null,
): ResellerSalesStats {
  const completedOrders = paymentOrders.filter(isCompletedResellerSaleOrder);
  const totalSalesAmount = completedOrders.reduce((sum, order) => sum + order.amount, 0);
  const soldBytes = completedOrders.reduce((sum, order) => sum + order.volumeBytes, 0);
  const afrowsShareAmount = reseller
    ? Math.round(totalSalesAmount * reseller.afrowsShareBps / 10_000)
    : 0;
  const remainingValues = accounts
    .map((account) => account.remainingBytes ?? null)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  const allRemainingKnown = remainingValues.length === accounts.length;
  const lowQuotaCount = accounts.filter((account) => {
    if (account.quotaLimitBytes === null || account.quotaLimitBytes === undefined || account.quotaLimitBytes <= 0) return false;
    const remainingBytes = account.remainingBytes ?? Math.max(account.quotaLimitBytes - account.usedBytes, 0);

    return remainingBytes / account.quotaLimitBytes <= 0.2;
  }).length;

  return {
    activeCustomerCount: accounts.filter((account) => account.status === 'active').length,
    afrowsShareAmount,
    averageSoldGb: completedOrders.length > 0 ? soldBytes / completedOrders.length / 1024 ** 3 : 0,
    currency: reseller?.currency ?? completedOrders[0]?.currency ?? 'IRR',
    lowQuotaCount,
    orderCount: completedOrders.length,
    remainingBytes: allRemainingKnown ? remainingValues.reduce((sum, value) => sum + value, 0) : null,
    sellerMarginAmount: Math.max(totalSalesAmount - afrowsShareAmount, 0),
    soldBytes,
    totalSalesAmount,
    usedBytes: accounts.reduce((sum, account) => sum + account.usedBytes, 0),
  };
}

export function isCompletedResellerSaleOrder(order: AdminPaymentOrderSummary): boolean {
  return order.provider === 'reseller_wallet' && order.status === 'paid';
}

export function resellerCustomerName(account: AdminCustomerAccountSummary): string {
  return account.displayName || account.telegramUsername || account.telegramId || account.id.slice(0, 8);
}

export function createResellerSalesTrendOption(
  paymentOrders: AdminPaymentOrderSummary[],
  format: DashboardFormatters,
  t: DashboardStrings,
): AfroChartOption {
  const buckets = createRecentDayBuckets(7).map((date) => ({
    amount: 0,
    date,
    key: localDateKey(date),
    orderCount: 0,
    volumeGb: 0,
  }));
  const bucketByKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));

  paymentOrders.filter(isCompletedResellerSaleOrder).forEach((order) => {
    const orderDate = new Date(order.paidAt ?? order.createdAt);
    const bucket = bucketByKey.get(localDateKey(orderDate));
    if (!bucket) return;

    bucket.amount += order.amount;
    bucket.orderCount += 1;
    bucket.volumeGb += order.volumeBytes / 1024 ** 3;
  });

  return {
    color: ['#2764a8', '#0f8f83', '#c27a1a'],
    textStyle: {
      fontFamily: format.fontFamily,
    },
    tooltip: {
      trigger: 'axis',
      valueFormatter: (value) => format.integer(Number(value)),
    },
    legend: {
      top: 0,
      icon: 'roundRect',
      itemHeight: 8,
      itemWidth: 18,
      textStyle: {
        color: '#60717a',
        fontFamily: format.fontFamily,
      },
    },
    grid: {
      bottom: 26,
      containLabel: true,
      left: 6,
      right: 8,
      top: 34,
    },
    xAxis: {
      type: 'category',
      data: buckets.map((bucket) => format.dateTime(bucket.date)),
      axisLine: {
        lineStyle: { color: '#dce4e8' },
      },
      axisLabel: {
        color: '#60717a',
        hideOverlap: true,
        margin: 8,
      },
    },
    yAxis: [
      {
        type: 'value',
        min: 0,
        splitNumber: 4,
        axisLabel: {
          color: '#60717a',
          formatter: (value: string | number) => format.integer(Number(value)),
          margin: 6,
        },
        splitLine: {
          lineStyle: { color: '#edf2f4' },
        },
      },
      {
        type: 'value',
        min: 0,
        splitNumber: 4,
        axisLabel: {
          color: '#60717a',
          formatter: (value: string | number) => format.integer(Number(value)),
          margin: 6,
        },
        splitLine: {
          show: false,
        },
      },
    ],
    dataZoom: [
      {
        type: 'inside',
        throttle: 50,
      },
    ],
    series: [
      {
        name: t.reseller.soldGbSeries,
        type: 'bar',
        barMaxWidth: 24,
        itemStyle: {
          borderRadius: [4, 4, 0, 0],
        },
        data: buckets.map((bucket) => Math.round(bucket.volumeGb * 10) / 10),
      },
      {
        name: t.reseller.ordersSeries,
        type: 'line',
        yAxisIndex: 1,
        showSymbol: false,
        smooth: true,
        lineStyle: {
          width: 3,
        },
        areaStyle: {
          opacity: 0.08,
        },
        data: buckets.map((bucket) => bucket.orderCount),
      },
    ],
  };
}

export function createResellerUsageMixOption(
  accounts: AdminCustomerAccountSummary[],
  format: DashboardFormatters,
  t: DashboardStrings,
): AfroChartOption {
  const rows = [...accounts]
    .sort((left, right) => (right.usedBytes + (right.remainingBytes ?? 0)) - (left.usedBytes + (left.remainingBytes ?? 0)))
    .slice(0, 8);

  return {
    color: ['#2764a8', '#8bbf9f'],
    textStyle: {
      fontFamily: format.fontFamily,
    },
    tooltip: {
      trigger: 'axis',
      valueFormatter: (value) => format.bytes(Math.round(Number(value) * 1024 ** 3)),
    },
    legend: {
      top: 0,
      icon: 'roundRect',
      itemHeight: 8,
      itemWidth: 18,
      textStyle: {
        color: '#60717a',
        fontFamily: format.fontFamily,
      },
    },
    grid: {
      bottom: 30,
      containLabel: true,
      left: 6,
      right: 8,
      top: 34,
    },
    xAxis: {
      type: 'category',
      data: rows.map((account) => resellerCustomerName(account)),
      axisLine: {
        lineStyle: { color: '#dce4e8' },
      },
      axisLabel: {
        color: '#60717a',
        hideOverlap: true,
        margin: 8,
        overflow: 'truncate',
        width: 86,
      },
    },
    yAxis: {
      type: 'value',
      min: 0,
      splitNumber: 4,
      axisLabel: {
        color: '#60717a',
        formatter: (value: string | number) => format.integer(Number(value)),
        margin: 6,
      },
      splitLine: {
        lineStyle: { color: '#edf2f4' },
      },
    },
    dataZoom: [
      {
        type: 'inside',
        throttle: 50,
      },
    ],
    series: [
      {
        name: t.reseller.usedGbSeries,
        type: 'bar',
        stack: 'quota',
        barMaxWidth: 26,
        data: rows.map((account) => Math.round(account.usedBytes / 1024 ** 3 * 10) / 10),
      },
      {
        name: t.reseller.remainingGbSeries,
        type: 'bar',
        stack: 'quota',
        barMaxWidth: 26,
        itemStyle: {
          borderRadius: [4, 4, 0, 0],
        },
        data: rows.map((account) => (
          account.remainingBytes === null || account.remainingBytes === undefined
            ? 0
            : Math.round(account.remainingBytes / 1024 ** 3 * 10) / 10
        )),
      },
    ],
  };
}

export function createRecentDayBuckets(dayCount: number): Date[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Array.from({ length: dayCount }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (dayCount - 1 - index));

    return date;
  });
}

export function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}
