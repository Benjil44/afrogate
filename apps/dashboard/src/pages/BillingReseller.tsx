import { createResellerSalesStats, createResellerSalesTrendOption, createResellerUsageMixOption, isCompletedResellerSaleOrder, resellerCustomerName, type ResellerSalesStats } from '../reseller-charts';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Activity, Bot, CreditCard, Gauge, Gift, Inbox, Plus, ShieldCheck, Upload, UserRound, WifiOff, X } from 'lucide-react';
import type { AdminBillingSettingsSummary, AdminClientConfigsExportResponse, AdminCurrentPanelImportConfigsResponse, AdminCurrentPanelImportPreviewResponse, AdminCurrentPanelUsageSyncResponse, AdminCurrentPanelVolumeChargeResponse, AdminCustomerAccountSummary, AdminPaymentMethodSummary, AdminPaymentOrderSummary, AdminPaymentProviderAdapterSummary, AdminResellerAccountSummary, AdminResellerPackageSaleResponse, AdminResellerWalletLedgerEntry, AdminRewardedAdSettingsSummary, AdminSessionResponse, AdminTelegramBotSettingsSummary, AdminVolumePackageSummary, CurrentPanelKind, CustomerAccountStatus, CustomerQuotaScope } from '@afrogate/shared';
import { chargeAdminCurrentPanelVolume, createAdminCustomerAccount, createAdminResellerCustomerAccount, createAdminResellerPackageSale, exportAdminCustomerClientConfigs, fetchAdminBillingCatalog, fetchAdminCustomerAccounts, fetchAdminPaymentOrders, fetchAdminResellerWorkspace, fetchAdminRewardedAdSettings, fetchAdminTelegramBotSettings, importAdminCurrentPanelConfigs, previewAdminCurrentPanelImport, syncAdminCurrentPanelUsage, updateAdminCustomerAccount, updateAdminResellerCustomerAccount, updateAdminRewardedAdSettings } from '../api/admin';
import { EChart, type AfroChartOption } from '../components/EChart';
import { DashboardTabs, DataStateNotice, DataTable, EmptyState, MetricCard, MetricPill, PanelHeading, PanelHeadingContent, PanelState, StatusBadge } from '../components/primitives';
import { SettingsInput } from '../components/settings-form';
import type { BillingTab, DashboardTabItem, DataState, DataTableColumn, MetricCardData, Tone } from '../dashboard-types';
import { normalizeNullableText, sumNullable, type DashboardFormatters } from '../formatters';
import type { DashboardStrings } from '../i18n';
import { billingStatusTone, currentPanelKindLabel, currentPanelStatusLabel, currentPanelStatusTone, customerAccountStatusLabel, customerQuotaScopeLabel, formatMoneyAmount, paymentAdapterStatusLabel, paymentAdapterStatusTone, paymentCheckoutModeLabel, paymentProviderLabel, paymentSettlementLabel, paymentVerificationLabel, resellerWalletEntryTypeLabel, resellerWalletSourceLabel } from '../labels';
import { telegramTestStatusLabel } from '../route-labels';
import { formLabelClass, inputClass, mutedTextClass, panelClass, primaryButtonClass } from '../ui-classes';

type CustomerAccountFormState = {
  displayName: string;
  telegramUsername: string;
  quotaScope: CustomerQuotaScope;
  quotaLimitGb: string;
  perClientLimitGb: string;
  status: CustomerAccountStatus;
  notes: string;
};

const customerQuotaScopeOptions: CustomerQuotaScope[] = ['account_shared', 'per_client'];
const customerAccountStatusOptions: CustomerAccountStatus[] = ['active', 'suspended', 'disabled'];
const currentPanelKindOptions: CurrentPanelKind[] = ['marzban', 'xui', 'sanayi', 'generic'];

function createEmptyCustomerAccountForm(): CustomerAccountFormState {
  return {
    displayName: '',
    notes: '',
    perClientLimitGb: '',
    quotaLimitGb: '50',
    quotaScope: 'account_shared',
    status: 'active',
    telegramUsername: '',
  };
}

type ResellerPackageSaleFormState = {
  customerAccountId: string;
  displayName: string;
  notes: string;
  telegramUsername: string;
  volumePackageId: string;
};

function createEmptyResellerPackageSaleForm(): ResellerPackageSaleFormState {
  return {
    customerAccountId: '',
    displayName: '',
    notes: '',
    telegramUsername: '',
    volumePackageId: '',
  };
}

type CurrentPanelImportFormState = {
  chargeGb: string;
  customerAccountId: string;
  defaultProtocol: string;
  panelKind: CurrentPanelKind;
  payloadJson: string;
  sourceName: string;
};

function createEmptyCurrentPanelImportForm(): CurrentPanelImportFormState {
  return {
    chargeGb: '10',
    customerAccountId: '',
    defaultProtocol: 'vless',
    panelKind: 'marzban',
    payloadJson: '',
    sourceName: '',
  };
}

type ResellerWorkspaceViewState = {
  accounts: AdminCustomerAccountSummary[];
  dataState: DataState;
  error: boolean;
  ledgerEntries: AdminResellerWalletLedgerEntry[];
  packages: AdminVolumePackageSummary[];
  paymentOrders: AdminPaymentOrderSummary[];
  reseller: AdminResellerAccountSummary | null;
};

type ResellerWorkspaceController = ResellerWorkspaceViewState & {
  applyPackageSaleResult: (result: AdminResellerPackageSaleResponse) => void;
};


function useResellerWorkspace(sessionToken: string): ResellerWorkspaceController {
  const [state, setState] = useState<ResellerWorkspaceViewState>({
    accounts: [],
    dataState: 'loading',
    error: false,
    ledgerEntries: [],
    packages: [],
    paymentOrders: [],
    reseller: null,
  });

  useEffect(() => {
    const controller = new AbortController();

    setState((current) => ({ ...current, dataState: 'loading', error: false }));
    void fetchAdminResellerWorkspace(sessionToken, controller.signal)
      .then((response) => {
        setState({
          accounts: response.workspace.accounts,
          dataState: 'live',
          error: false,
          ledgerEntries: response.workspace.ledgerEntries,
          packages: response.workspace.packages,
          paymentOrders: response.workspace.paymentOrders,
          reseller: response.workspace.reseller,
        });
      })
      .catch((loadError) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;

        setState((current) => ({ ...current, dataState: 'fallback', error: true }));
      });

    return () => controller.abort();
  }, [sessionToken]);

  const applyPackageSaleResult = (result: AdminResellerPackageSaleResponse) => {
    setState((current) => ({
      ...current,
      accounts: [
        result.customerAccount,
        ...current.accounts.filter((account) => account.id !== result.customerAccount.id),
      ],
      dataState: 'live',
      error: false,
      ledgerEntries: [
        result.ledgerEntry,
        ...current.ledgerEntries.filter((entry) => entry.id !== result.ledgerEntry.id),
      ].slice(0, 50),
      paymentOrders: [
        result.paymentOrder,
        ...current.paymentOrders.filter((order) => order.id !== result.paymentOrder.id),
      ],
      reseller: result.reseller,
    }));
  };

  return { ...state, applyPackageSaleResult };
}

export function ResellerDashboardPage({
  format,
  sessionToken,
  t,
}: {
  format: DashboardFormatters;
  sessionToken: string;
  t: DashboardStrings;
}) {
  const workspace = useResellerWorkspace(sessionToken);
  const stats = useMemo(
    () => createResellerSalesStats(workspace.accounts, workspace.paymentOrders, workspace.reseller),
    [workspace.accounts, workspace.paymentOrders, workspace.reseller],
  );

  const summaryCards: MetricCardData[] = [
    {
      label: t.reseller.salesAmount,
      value: formatMoneyAmount(stats.totalSalesAmount, stats.currency, format),
      tone: stats.totalSalesAmount > 0 ? 'good' : 'neutral',
    },
    {
      label: t.reseller.soldVolume,
      value: format.bytes(stats.soldBytes),
      tone: stats.soldBytes > 0 ? 'good' : 'neutral',
    },
    {
      label: t.reseller.activeCustomers,
      value: format.integer(stats.activeCustomerCount),
      tone: stats.activeCustomerCount > 0 ? 'good' : 'neutral',
    },
    {
      label: t.reseller.availableWallet,
      value: workspace.reseller ? formatMoneyAmount(workspace.reseller.availableBalanceAmount, workspace.reseller.currency, format) : '--',
      tone: workspace.reseller && workspace.reseller.availableBalanceAmount > 0 ? 'good' : 'warning',
    },
  ];

  return (
    <section className="mt-2 grid gap-3">
      {workspace.error ? <PanelState detail={t.billing.errors.load} kind="error" title={t.panelStates.errorTitle} /> : null}
      {workspace.dataState === 'loading' ? <PanelState detail={t.panelStates.loadingDetail} kind="loading" title={t.panelStates.loadingTitle} /> : null}
      {workspace.dataState !== 'live' && workspace.dataState !== 'loading' ? <DataStateNotice state={workspace.dataState} t={t} /> : null}

      <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4" aria-label={t.reseller.dashboardSummary}>
        {summaryCards.map((item) => <MetricCard item={item} key={item.label} />)}
      </section>

      <section className="grid gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
        <ResellerSalesTrendPanel format={format} paymentOrders={workspace.paymentOrders} t={t} />
        <ResellerExperiencePanel accounts={workspace.accounts} format={format} stats={stats} t={t} />
      </section>

      <section className="grid gap-3 xl:grid-cols-[minmax(340px,0.9fr)_minmax(0,1.1fr)]">
        <ResellerSalesSummaryPanel format={format} reseller={workspace.reseller} stats={stats} t={t} />
        <ResellerRecentUsersPanel accounts={workspace.accounts} format={format} paymentOrders={workspace.paymentOrders} t={t} />
      </section>
    </section>
  );
}

export function ResellerUsersPage({
  format,
  sessionToken,
  t,
}: {
  format: DashboardFormatters;
  sessionToken: string;
  t: DashboardStrings;
}) {
  const workspace = useResellerWorkspace(sessionToken);
  const [resellerSaleForm, setResellerSaleForm] = useState<ResellerPackageSaleFormState>(() => createEmptyResellerPackageSaleForm());
  const [resellerSaleMessage, setResellerSaleMessage] = useState<string | null>(null);
  const [isSellingResellerPackage, setIsSellingResellerPackage] = useState(false);
  const [isResellerAddUserDialogOpen, setIsResellerAddUserDialogOpen] = useState(false);
  const stats = useMemo(
    () => createResellerSalesStats(workspace.accounts, workspace.paymentOrders, workspace.reseller),
    [workspace.accounts, workspace.paymentOrders, workspace.reseller],
  );

  useEffect(() => {
    if (resellerSaleForm.volumePackageId || workspace.packages.length === 0) return;
    setResellerSaleForm((current) => ({
      ...current,
      volumePackageId: workspace.packages.find((item) => item.status === 'active')?.id ?? workspace.packages[0].id,
    }));
  }, [resellerSaleForm.volumePackageId, workspace.packages]);

  const handleCreateResellerUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!resellerSaleForm.volumePackageId) return;

    const existingCustomerId = normalizeNullableText(resellerSaleForm.customerAccountId);
    const displayName = normalizeNullableText(resellerSaleForm.displayName);
    const telegramUsername = normalizeNullableText(resellerSaleForm.telegramUsername);
    if (!existingCustomerId && !displayName && !telegramUsername) {
      setResellerSaleMessage(t.billing.resellerPackageSaleFailed);
      return;
    }

    setIsSellingResellerPackage(true);
    setResellerSaleMessage(null);

    try {
      const result = await createAdminResellerPackageSale(sessionToken, {
        customerAccount: existingCustomerId
          ? null
          : {
              displayName,
              notes: normalizeNullableText(resellerSaleForm.notes),
              quotaScope: 'account_shared',
              status: 'active',
              telegramUsername,
            },
        customerAccountId: existingCustomerId,
        idempotencyKey: `dashboard-reseller-users-add:${Date.now()}`,
        metadata: {
          dashboardFlow: 'reseller_users_add_user',
        },
        notes: normalizeNullableText(resellerSaleForm.notes),
        volumePackageId: resellerSaleForm.volumePackageId,
      });

      workspace.applyPackageSaleResult(result);
      setResellerSaleForm((current) => ({
        ...createEmptyResellerPackageSaleForm(),
        volumePackageId: current.volumePackageId,
      }));
      setResellerSaleMessage(t.billing.resellerPackageSaleSaved(
        format.bytes(result.allocation.volumeBytesDelta),
        formatMoneyAmount(result.quote.walletDebitAmount, result.quote.currency, format),
      ));
      setIsResellerAddUserDialogOpen(false);
    } catch {
      setResellerSaleMessage(t.billing.resellerPackageSaleFailed);
    } finally {
      setIsSellingResellerPackage(false);
    }
  };

  const resetResellerSaleForm = () => {
    setResellerSaleForm((current) => ({
      ...createEmptyResellerPackageSaleForm(),
      volumePackageId: current.volumePackageId,
    }));
  };

  const openResellerAddUserDialog = () => {
    resetResellerSaleForm();
    setResellerSaleMessage(null);
    setIsResellerAddUserDialogOpen(true);
  };

  const closeResellerAddUserDialog = () => {
    if (isSellingResellerPackage) return;
    resetResellerSaleForm();
    setResellerSaleMessage(null);
    setIsResellerAddUserDialogOpen(false);
  };

  return (
    <section className="mt-2 grid gap-3">
      {workspace.error ? <PanelState detail={t.billing.errors.load} kind="error" title={t.panelStates.errorTitle} /> : null}
      {workspace.dataState === 'loading' ? <PanelState detail={t.panelStates.loadingDetail} kind="loading" title={t.panelStates.loadingTitle} /> : null}
      {workspace.dataState !== 'live' && workspace.dataState !== 'loading' ? <DataStateNotice state={workspace.dataState} t={t} /> : null}

      <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4" aria-label={t.reseller.usersSummary}>
        <MetricCard item={{ label: t.reseller.totalCustomers, value: format.integer(workspace.accounts.length), tone: workspace.accounts.length > 0 ? 'good' : 'neutral' }} />
        <MetricCard item={{ label: t.reseller.activeCustomers, value: format.integer(stats.activeCustomerCount), tone: stats.activeCustomerCount > 0 ? 'good' : 'neutral' }} />
        <MetricCard item={{ label: t.reseller.lowQuotaUsers, value: format.integer(stats.lowQuotaCount), tone: stats.lowQuotaCount > 0 ? 'warning' : 'good' }} />
        <MetricCard item={{ label: t.reseller.soldVolume, value: format.bytes(stats.soldBytes), tone: stats.soldBytes > 0 ? 'good' : 'neutral' }} />
      </section>

      <ResellerAddUserDialog
        accounts={workspace.accounts}
        format={format}
        form={resellerSaleForm}
        isOpen={isResellerAddUserDialogOpen}
        isSelling={isSellingResellerPackage}
        message={resellerSaleMessage}
        onClose={closeResellerAddUserDialog}
        onFormChange={setResellerSaleForm}
        onSubmit={handleCreateResellerUser}
        packages={workspace.packages}
        t={t}
      />

      <ResellerUsersTable
        accounts={workspace.accounts}
        actionMessage={isResellerAddUserDialogOpen ? null : resellerSaleMessage}
        format={format}
        onAddUser={openResellerAddUserDialog}
        paymentOrders={workspace.paymentOrders}
        t={t}
      />
    </section>
  );
}

function ResellerSalesTrendPanel({
  format,
  paymentOrders,
  t,
}: {
  format: DashboardFormatters;
  paymentOrders: AdminPaymentOrderSummary[];
  t: DashboardStrings;
}) {
  const option = useMemo(() => createResellerSalesTrendOption(paymentOrders, format, t), [format, paymentOrders, t]);
  const hasOrders = paymentOrders.some(isCompletedResellerSaleOrder);

  return (
    <section className={panelClass}>
      <PanelHeading title={t.reseller.salesTrend} icon={Activity} meta={t.reseller.lastSevenDays} />
      <div className="mt-2">
        {hasOrders ? (
          <EChart
            ariaLabel={t.reseller.salesTrend}
            className="h-[260px] w-full"
            option={option}
          />
        ) : (
          <EmptyState message={t.reseller.noSalesYet} />
        )}
      </div>
    </section>
  );
}

function ResellerExperiencePanel({
  accounts,
  format,
  stats,
  t,
}: {
  accounts: AdminCustomerAccountSummary[];
  format: DashboardFormatters;
  stats: ResellerSalesStats;
  t: DashboardStrings;
}) {
  const option = useMemo(() => createResellerUsageMixOption(accounts, format, t), [accounts, format, t]);
  const hasAccounts = accounts.length > 0;

  return (
    <section className={panelClass}>
      <PanelHeading title={t.reseller.serviceExperience} icon={Gauge} meta={t.reseller.customerQuotaMix} />
      <div className="mt-2 grid gap-2">
        <div className="grid gap-2 sm:grid-cols-3">
          <MetricPill icon={ShieldCheck} label={t.reseller.remainingVolume} value={stats.remainingBytes === null ? t.billing.unlimited : format.bytes(stats.remainingBytes)} />
          <MetricPill icon={UserRound} label={t.reseller.lowQuotaUsers} value={format.integer(stats.lowQuotaCount)} />
          <MetricPill icon={Activity} label={t.reseller.averageSoldGb} value={format.bytes(Math.round(stats.averageSoldGb * 1024 ** 3))} />
        </div>
        {hasAccounts ? (
          <EChart
            ariaLabel={t.reseller.serviceExperience}
            className="h-[210px] w-full"
            option={option}
          />
        ) : (
          <EmptyState message={t.billing.noCustomerAccounts} />
        )}
      </div>
    </section>
  );
}

function ResellerSalesSummaryPanel({
  format,
  reseller,
  stats,
  t,
}: {
  format: DashboardFormatters;
  reseller: AdminResellerAccountSummary | null;
  stats: ResellerSalesStats;
  t: DashboardStrings;
}) {
  return (
    <section className={panelClass}>
      <PanelHeading title={t.reseller.salesSummary} icon={CreditCard} meta={reseller ? reseller.displayName : t.dataStatus.loading} />
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <MetricPill icon={CreditCard} label={t.reseller.salesAmount} value={formatMoneyAmount(stats.totalSalesAmount, stats.currency, format)} />
        <MetricPill icon={Inbox} label={t.reseller.soldVolume} value={format.bytes(stats.soldBytes)} />
        <MetricPill icon={ShieldCheck} label={t.reseller.afroGateDebited} value={formatMoneyAmount(stats.afroGateShareAmount, stats.currency, format)} />
        <MetricPill icon={UserRound} label={t.reseller.estimatedSellerMargin} value={formatMoneyAmount(stats.sellerMarginAmount, stats.currency, format)} />
        <MetricPill icon={Activity} label={t.reseller.orders} value={format.integer(stats.orderCount)} />
        <MetricPill icon={Gauge} label={t.reseller.activeCustomers} value={format.integer(stats.activeCustomerCount)} />
      </div>
    </section>
  );
}

function ResellerRecentUsersPanel({
  accounts,
  format,
  paymentOrders,
  t,
}: {
  accounts: AdminCustomerAccountSummary[];
  format: DashboardFormatters;
  paymentOrders: AdminPaymentOrderSummary[];
  t: DashboardStrings;
}) {
  const recentAccounts = [...accounts]
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
    .slice(0, 6);

  return (
    <section className={panelClass}>
      <PanelHeading title={t.reseller.recentCustomers} icon={UserRound} meta={t.billing.accountsLoaded(format.integer(accounts.length))} />
      <div className="mt-2 grid gap-2">
        {recentAccounts.length === 0 ? <EmptyState message={t.billing.noCustomerAccounts} /> : null}
        {recentAccounts.map((account) => {
          const customerOrders = paymentOrders.filter((order) => order.customerAccountId === account.id && isCompletedResellerSaleOrder(order));
          const soldBytes = customerOrders.reduce((sum, order) => sum + order.volumeBytes, 0);

          return (
            <div className="grid min-h-[58px] grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-md border border-afro-line bg-white px-3 py-2" key={account.id}>
              <div className="min-w-0">
                <strong className="block truncate text-sm text-afro-ink">{resellerCustomerName(account)}</strong>
                <span className="block truncate text-[12px] text-afro-muted">{account.telegramUsername ?? account.id.slice(0, 8)}</span>
              </div>
              <div className="flex flex-wrap justify-end gap-1.5">
                <StatusBadge tone={billingStatusTone(account.status)}>{customerAccountStatusLabel(account.status, t)}</StatusBadge>
                <StatusBadge tone="neutral">{format.bytes(soldBytes)}</StatusBadge>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ResellerUsersTable({
  accounts,
  actionMessage,
  format,
  onAddUser,
  paymentOrders,
  t,
}: {
  accounts: AdminCustomerAccountSummary[];
  actionMessage?: string | null;
  format: DashboardFormatters;
  onAddUser?: () => void;
  paymentOrders: AdminPaymentOrderSummary[];
  t: DashboardStrings;
}) {
  const soldUserRows = accounts.map((account) => {
    const customerOrders = paymentOrders.filter((order) => order.customerAccountId === account.id && isCompletedResellerSaleOrder(order));
    const soldBytes = customerOrders.reduce((sum, order) => sum + order.volumeBytes, 0);
    const latestSale = customerOrders
      .map((order) => order.paidAt ?? order.createdAt)
      .sort((left, right) => Date.parse(right) - Date.parse(left))[0] ?? null;

    return {
      account,
      latestSale,
      orderCount: customerOrders.length,
      soldBytes,
    };
  });
  const soldUserColumns: Array<DataTableColumn<(typeof soldUserRows)[number]>> = [
    {
      key: 'customer',
      header: t.billing.customer,
      render: (row) => (
        <>
          <strong className="block text-afro-ink">{resellerCustomerName(row.account)}</strong>
          <span className="text-[12px] text-afro-muted">{row.account.telegramUsername ?? row.account.id.slice(0, 8)}</span>
        </>
      ),
    },
    {
      key: 'clients',
      header: t.billing.clients,
      render: (row) => `${format.integer(row.account.activeClientCount)} / ${format.integer(row.account.clientCount)}`,
    },
    { key: 'usedQuota', header: t.billing.usedQuota, render: (row) => format.bytes(row.account.usedBytes) },
    {
      key: 'remaining',
      header: t.billing.remaining,
      render: (row) => row.account.remainingBytes === null || row.account.remainingBytes === undefined ? t.billing.unlimited : format.bytes(row.account.remainingBytes),
    },
    { key: 'soldVolume', header: t.reseller.soldVolume, render: (row) => format.bytes(row.soldBytes) },
    { key: 'orders', header: t.reseller.orders, render: (row) => format.integer(row.orderCount) },
    { key: 'lastSale', header: t.reseller.lastSale, render: (row) => row.latestSale ? format.dateTime(new Date(row.latestSale)) : '--' },
    {
      key: 'status',
      header: t.billing.status,
      render: (row) => <StatusBadge tone={billingStatusTone(row.account.status)}>{customerAccountStatusLabel(row.account.status, t)}</StatusBadge>,
    },
  ];

  return (
    <section className={panelClass}>
      <div className="flex min-h-7 flex-wrap items-center justify-between gap-2 border-b border-afro-line pb-1.5">
        <PanelHeadingContent title={t.reseller.soldUsers} meta={t.billing.accountsLoaded(format.integer(accounts.length))} />
        <button
          className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md bg-afro-sidebar px-3 text-sm font-bold text-white hover:bg-[#1f3138]"
          onClick={onAddUser}
          type="button"
        >
          <Plus size={16} />
          {t.reseller.addUser}
        </button>
      </div>
      {actionMessage ? <p className={`${mutedTextClass} mt-2`}>{actionMessage}</p> : null}
      {accounts.length === 0 ? <div className="mt-2"><EmptyState message={t.billing.noCustomerAccounts} /></div> : null}
      {accounts.length > 0 ? (
        <div className="mt-2">
          <DataTable columns={soldUserColumns} minWidth="880px" rowKey={(row) => row.account.id} rows={soldUserRows} />
        </div>
      ) : null}
    </section>
  );
}

function ResellerAddUserDialog({
  accounts,
  format,
  form,
  isOpen,
  isSelling,
  message,
  onClose,
  onFormChange,
  onSubmit,
  packages,
  t,
}: {
  accounts: AdminCustomerAccountSummary[];
  format: DashboardFormatters;
  form: ResellerPackageSaleFormState;
  isOpen: boolean;
  isSelling: boolean;
  message: string | null;
  onClose: () => void;
  onFormChange: (form: ResellerPackageSaleFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  packages: AdminVolumePackageSummary[];
  t: DashboardStrings;
}) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-afro-sidebar/55 px-3 py-6 backdrop-blur-sm sm:px-6"
      onClick={onClose}
    >
      <div
        aria-labelledby="reseller-add-user-title"
        aria-modal="true"
        className="mx-auto mt-[min(12vh,96px)] w-full max-w-4xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <ResellerPackageSalePanel
          accounts={accounts}
          format={format}
          form={form}
          isSelling={isSelling}
          message={message}
          onClose={onClose}
          onFormChange={onFormChange}
          onSubmit={onSubmit}
          packages={packages}
          submitLabel={t.reseller.addUser}
          t={t}
          title={t.reseller.addUser}
          titleId="reseller-add-user-title"
        />
      </div>
    </div>
  );
}

function mapCustomerAccountToForm(account: AdminCustomerAccountSummary): CustomerAccountFormState {
  return {
    displayName: account.displayName ?? '',
    notes: account.notes ?? '',
    perClientLimitGb: formatGbInput(account.perClientLimitBytes ?? null),
    quotaLimitGb: formatGbInput(account.quotaLimitBytes ?? null),
    quotaScope: customerQuotaScopeOptions.includes(account.quotaScope as CustomerQuotaScope)
      ? account.quotaScope as CustomerQuotaScope
      : 'account_shared',
    status: customerAccountStatusOptions.includes(account.status as CustomerAccountStatus)
      ? account.status as CustomerAccountStatus
      : 'active',
    telegramUsername: account.telegramUsername ?? '',
  };
}

export function BillingPage({
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
  const [settings, setSettings] = useState<AdminBillingSettingsSummary | null>(null);
  const [packages, setPackages] = useState<AdminVolumePackageSummary[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<AdminPaymentMethodSummary[]>([]);
  const [paymentOrders, setPaymentOrders] = useState<AdminPaymentOrderSummary[]>([]);
  const [paymentProviderAdapters, setPaymentProviderAdapters] = useState<AdminPaymentProviderAdapterSummary[]>([]);
  const [accounts, setAccounts] = useState<AdminCustomerAccountSummary[]>([]);
  const [reseller, setReseller] = useState<AdminResellerAccountSummary | null>(null);
  const [resellerLedgerEntries, setResellerLedgerEntries] = useState<AdminResellerWalletLedgerEntry[]>([]);
  const [rewardSettings, setRewardSettings] = useState<AdminRewardedAdSettingsSummary | null>(null);
  const [telegramBotSettings, setTelegramBotSettings] = useState<AdminTelegramBotSettingsSummary | null>(null);
  const [dataState, setDataState] = useState<DataState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [rewardEnabled, setRewardEnabled] = useState(true);
  const [rewardMb, setRewardMb] = useState('100');
  const [dailyLimit, setDailyLimit] = useState('20');
  const [provider, setProvider] = useState('mvp_rewarded_ad');
  const [verificationMode, setVerificationMode] = useState('client_callback_mvp');
  const [rewardMessage, setRewardMessage] = useState<string | null>(null);
  const [isSavingReward, setIsSavingReward] = useState(false);
  const [selectedCustomerAccountId, setSelectedCustomerAccountId] = useState<string | null>(null);
  const [customerForm, setCustomerForm] = useState<CustomerAccountFormState>(() => createEmptyCustomerAccountForm());
  const [customerMessage, setCustomerMessage] = useState<string | null>(null);
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);
  const [resellerSaleForm, setResellerSaleForm] = useState<ResellerPackageSaleFormState>(() => createEmptyResellerPackageSaleForm());
  const [resellerSaleMessage, setResellerSaleMessage] = useState<string | null>(null);
  const [isSellingResellerPackage, setIsSellingResellerPackage] = useState(false);
  const [currentPanelForm, setCurrentPanelForm] = useState<CurrentPanelImportFormState>(() => createEmptyCurrentPanelImportForm());
  const [currentPanelPreview, setCurrentPanelPreview] = useState<AdminCurrentPanelImportPreviewResponse | null>(null);
  const [currentPanelMessage, setCurrentPanelMessage] = useState<string | null>(null);
  const [clientConfigExportJson, setClientConfigExportJson] = useState<string | null>(null);
  const [isPreviewingCurrentPanel, setIsPreviewingCurrentPanel] = useState(false);
  const [isImportingCurrentPanel, setIsImportingCurrentPanel] = useState(false);
  const [isSyncingCurrentPanelUsage, setIsSyncingCurrentPanelUsage] = useState(false);
  const [isExportingClientConfigs, setIsExportingClientConfigs] = useState(false);
  const [isChargingCurrentPanelVolume, setIsChargingCurrentPanelVolume] = useState(false);
  const [activeBillingTab, setActiveBillingTab] = useState<BillingTab>('catalog');
  const isResellerSession = session.actor.role === 'reseller';
  const canManageBilling = session.actor.role === 'superadmin' || session.actor.role === 'owner' || session.actor.role === 'admin';
  const canManageCustomerAccounts = canManageBilling || isResellerSession;
  const canViewTelegramOperations = session.actor.role === 'superadmin' || session.actor.isSuperAdmin === true;

  const loadBilling = useMemo(() => async (signal?: AbortSignal) => {
    setDataState('loading');
    setError(null);

    try {
      if (isResellerSession) {
        const response = await fetchAdminResellerWorkspace(sessionToken, signal);
        setSettings(response.workspace.settings);
        setPackages(response.workspace.packages);
        setPaymentMethods([]);
        setPaymentProviderAdapters([]);
        setPaymentOrders(response.workspace.paymentOrders);
        setAccounts(response.workspace.accounts);
        setRewardSettings(null);
        setTelegramBotSettings(null);
        setReseller(response.workspace.reseller);
        setResellerLedgerEntries(response.workspace.ledgerEntries);
        setDataState('live');
        return;
      }

      const telegramBotRequest = canViewTelegramOperations
        ? fetchAdminTelegramBotSettings(sessionToken, signal).catch(() => null)
        : Promise.resolve(null);
      const [catalogResponse, orderResponse, accountResponse, rewardResponse, telegramBotResponse] = await Promise.all([
        fetchAdminBillingCatalog(sessionToken, signal),
        fetchAdminPaymentOrders(sessionToken, signal),
        fetchAdminCustomerAccounts(sessionToken, signal),
        fetchAdminRewardedAdSettings(sessionToken, signal),
        telegramBotRequest,
      ]);

      setSettings(catalogResponse.settings);
      setPackages(catalogResponse.packages);
      setPaymentMethods(catalogResponse.paymentMethods);
      setPaymentProviderAdapters(catalogResponse.paymentProviderAdapters ?? []);
      setPaymentOrders(orderResponse.paymentOrders);
      setAccounts(accountResponse.accounts);
      setRewardSettings(rewardResponse.rewardedAds);
      setTelegramBotSettings(telegramBotResponse?.telegramBot ?? null);
      setReseller(null);
      setResellerLedgerEntries([]);
      setDataState('live');
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === 'AbortError') return;

      setError(t.billing.errors.load);
      setDataState((current) => (current === 'live' || current === 'stale' ? 'stale' : 'fallback'));
    }
  }, [canViewTelegramOperations, isResellerSession, sessionToken, t]);

  useEffect(() => {
    const controller = new AbortController();
    void loadBilling(controller.signal);

    return () => controller.abort();
  }, [loadBilling]);

  useEffect(() => {
    if (!rewardSettings) return;

    setRewardEnabled(rewardSettings.enabled);
    setRewardMb(String(Math.round(rewardSettings.rewardMb * 10) / 10));
    setDailyLimit(String(rewardSettings.dailyLimit));
    setProvider(rewardSettings.provider);
    setVerificationMode(rewardSettings.verificationMode);
  }, [rewardSettings]);

  useEffect(() => {
    if (!isResellerSession || resellerSaleForm.volumePackageId || packages.length === 0) return;
    setResellerSaleForm((current) => ({
      ...current,
      volumePackageId: packages.find((item) => item.status === 'active')?.id ?? packages[0].id,
    }));
  }, [isResellerSession, packages, resellerSaleForm.volumePackageId]);

  useEffect(() => {
    if (!selectedCustomerAccountId) return;

    const selectedAccount = accounts.find((account) => account.id === selectedCustomerAccountId);
    if (selectedAccount) setCustomerForm(mapCustomerAccountToForm(selectedAccount));
  }, [accounts, selectedCustomerAccountId]);

  const totalUsedBytes = accounts.reduce((sum, account) => sum + account.usedBytes, 0);
  const totalQuotaBytes = sumNullable(accounts.map((account) => account.quotaLimitBytes ?? null));
  const pendingAllocationCount = paymentOrders.filter((order) => order.status === 'paid' && order.allocationStatus === 'pending').length;
  const activePackageCount = packages.filter((item) => item.status === 'active').length;
  const activeMethodCount = paymentMethods.filter((item) => item.status === 'active').length;
  const resellerStats = useMemo(
    () => createResellerSalesStats(accounts, paymentOrders, reseller),
    [accounts, paymentOrders, reseller],
  );
  const summaryCards: MetricCardData[] = isResellerSession && reseller ? [
    {
      label: t.billing.resellerWalletBalance,
      value: formatMoneyAmount(reseller.balanceAmount, reseller.currency, format),
      tone: reseller.balanceAmount >= 0 ? 'good' : 'warning',
    },
    {
      label: t.billing.resellerAvailableBalance,
      value: formatMoneyAmount(reseller.availableBalanceAmount, reseller.currency, format),
      tone: reseller.availableBalanceAmount > 0 ? 'good' : 'warning',
    },
    {
      label: t.billing.customerAccounts,
      value: format.integer(accounts.length),
      tone: accounts.length > 0 ? 'good' : 'neutral',
    },
    {
      label: t.billing.usedQuota,
      value: format.bytes(totalUsedBytes),
      tone: 'neutral',
    },
  ] : [
    {
      label: t.billing.customerAccounts,
      value: format.integer(accounts.length),
      tone: accounts.length > 0 ? 'good' : 'neutral',
    },
    {
      label: t.billing.usedQuota,
      value: format.bytes(totalUsedBytes),
      tone: 'neutral',
    },
    {
      label: t.billing.totalQuota,
      value: totalQuotaBytes === null ? t.billing.unlimited : format.bytes(totalQuotaBytes),
      tone: totalQuotaBytes === null ? 'warning' : 'good',
    },
    {
      label: t.billing.pendingAllocations,
      value: format.integer(pendingAllocationCount),
      tone: pendingAllocationCount > 0 ? 'warning' : 'good',
    },
  ];

  const handleSaveRewardSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManageBilling) return;

    const rewardMbValue = Number(rewardMb);
    const dailyLimitValue = Number(dailyLimit);
    if (!Number.isFinite(rewardMbValue) || rewardMbValue <= 0 || !Number.isInteger(dailyLimitValue) || dailyLimitValue < 0) {
      setRewardMessage(t.billing.rewardSettingsSaveFailed);
      return;
    }

    setIsSavingReward(true);
    setRewardMessage(null);

    try {
      const response = await updateAdminRewardedAdSettings(sessionToken, {
        dailyLimit: dailyLimitValue,
        enabled: rewardEnabled,
        provider,
        rewardBytes: Math.round(rewardMbValue * 1024 ** 2),
        verificationMode,
      });
      setRewardSettings(response.rewardedAds);
      setRewardMessage(t.billing.rewardSettingsSaved);
    } catch {
      setRewardMessage(t.billing.rewardSettingsSaveFailed);
    } finally {
      setIsSavingReward(false);
    }
  };

  const handleStartNewCustomerAccount = () => {
    setSelectedCustomerAccountId(null);
    setCustomerForm(createEmptyCustomerAccountForm());
    setCustomerMessage(null);
  };

  const handleSelectCustomerAccount = (accountId: string) => {
    setSelectedCustomerAccountId(accountId || null);
    setCustomerMessage(null);

    const selectedAccount = accounts.find((account) => account.id === accountId);
    setCustomerForm(selectedAccount ? mapCustomerAccountToForm(selectedAccount) : createEmptyCustomerAccountForm());
  };

  const handleSaveCustomerAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManageCustomerAccounts) return;

    const quotaLimitBytes = parseGbLimitInput(customerForm.quotaLimitGb);
    const perClientLimitBytes = parseGbLimitInput(customerForm.perClientLimitGb);
    if (quotaLimitBytes === undefined || perClientLimitBytes === undefined || !customerForm.displayName.trim()) {
      setCustomerMessage(t.billing.customerAccountSaveFailed);
      return;
    }

    setIsSavingCustomer(true);
    setCustomerMessage(null);

    try {
      const payload = {
        displayName: normalizeNullableText(customerForm.displayName),
        notes: normalizeNullableText(customerForm.notes),
        perClientLimitBytes,
        quotaLimitBytes,
        quotaScope: customerForm.quotaScope,
        status: customerForm.status,
        telegramUsername: normalizeNullableText(customerForm.telegramUsername),
      };
      const savedAccount = selectedCustomerAccountId
        ? isResellerSession
          ? await updateAdminResellerCustomerAccount(sessionToken, selectedCustomerAccountId, payload)
          : await updateAdminCustomerAccount(sessionToken, selectedCustomerAccountId, payload)
        : isResellerSession
          ? await createAdminResellerCustomerAccount(sessionToken, payload)
          : await createAdminCustomerAccount(sessionToken, payload);

      setAccounts((current) => [
        savedAccount,
        ...current.filter((account) => account.id !== savedAccount.id),
      ]);
      setSelectedCustomerAccountId(savedAccount.id);
      setCustomerForm(mapCustomerAccountToForm(savedAccount));
      setCustomerMessage(t.billing.customerAccountSaved);
    } catch {
      setCustomerMessage(t.billing.customerAccountSaveFailed);
    } finally {
      setIsSavingCustomer(false);
    }
  };

  const handleCreateResellerPackageSale = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isResellerSession || !resellerSaleForm.volumePackageId) return;
    const existingCustomerId = normalizeNullableText(resellerSaleForm.customerAccountId);
    const displayName = normalizeNullableText(resellerSaleForm.displayName);
    const telegramUsername = normalizeNullableText(resellerSaleForm.telegramUsername);
    if (!existingCustomerId && !displayName && !telegramUsername) {
      setResellerSaleMessage(t.billing.resellerPackageSaleFailed);
      return;
    }

    setIsSellingResellerPackage(true);
    setResellerSaleMessage(null);

    try {
      const result = await createAdminResellerPackageSale(sessionToken, {
        customerAccount: existingCustomerId
          ? null
          : {
              displayName,
              notes: normalizeNullableText(resellerSaleForm.notes),
              quotaScope: 'account_shared',
              status: 'active',
              telegramUsername,
            },
        customerAccountId: existingCustomerId,
        idempotencyKey: `dashboard-reseller-sale:${Date.now()}`,
        metadata: {
          dashboardFlow: 'reseller_package_sale',
        },
        notes: normalizeNullableText(resellerSaleForm.notes),
        volumePackageId: resellerSaleForm.volumePackageId,
      });

      setAccounts((current) => [
        result.customerAccount,
        ...current.filter((account) => account.id !== result.customerAccount.id),
      ]);
      setPaymentOrders((current) => [
        result.paymentOrder,
        ...current.filter((order) => order.id !== result.paymentOrder.id),
      ]);
      setReseller(result.reseller);
      setResellerLedgerEntries((current) => [
        result.ledgerEntry,
        ...current.filter((entry) => entry.id !== result.ledgerEntry.id),
      ].slice(0, 50));
      setResellerSaleForm((current) => ({
        ...createEmptyResellerPackageSaleForm(),
        volumePackageId: current.volumePackageId,
      }));
      setResellerSaleMessage(t.billing.resellerPackageSaleSaved(
        format.bytes(result.allocation.volumeBytesDelta),
        formatMoneyAmount(result.quote.walletDebitAmount, result.quote.currency, format),
      ));
    } catch {
      setResellerSaleMessage(t.billing.resellerPackageSaleFailed);
    } finally {
      setIsSellingResellerPackage(false);
    }
  };

  const handlePreviewCurrentPanelImport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManageBilling) return;

    let payload: unknown;
    try {
      payload = JSON.parse(currentPanelForm.payloadJson);
    } catch {
      setCurrentPanelPreview(null);
      setCurrentPanelMessage(t.billing.currentPanelPayloadInvalid);
      return;
    }

    setIsPreviewingCurrentPanel(true);
    setCurrentPanelMessage(null);

    try {
      const preview = await previewAdminCurrentPanelImport(sessionToken, {
        defaultProtocol: currentPanelForm.defaultProtocol,
        panelKind: currentPanelForm.panelKind,
        payload,
        sourceName: normalizeNullableText(currentPanelForm.sourceName),
      });

      setCurrentPanelPreview(preview);
      setCurrentPanelMessage(t.billing.currentPanelPreviewReady(format.integer(preview.candidateCount)));
    } catch {
      setCurrentPanelPreview(null);
      setCurrentPanelMessage(t.billing.currentPanelPreviewFailed);
    } finally {
      setIsPreviewingCurrentPanel(false);
    }
  };

  const handleImportCurrentPanelConfigs = async () => {
    if (!canManageBilling) return;

    let payload: unknown;
    try {
      payload = JSON.parse(currentPanelForm.payloadJson);
    } catch {
      setCurrentPanelMessage(t.billing.currentPanelPayloadInvalid);
      return;
    }

    if (!currentPanelForm.customerAccountId) {
      setCurrentPanelMessage(t.billing.currentPanelSelectCustomer);
      return;
    }

    setIsImportingCurrentPanel(true);
    setCurrentPanelMessage(null);

    try {
      const result = await importAdminCurrentPanelConfigs(sessionToken, {
        customerAccountId: currentPanelForm.customerAccountId,
        defaultProtocol: currentPanelForm.defaultProtocol,
        panelKind: currentPanelForm.panelKind,
        payload,
        sourceName: normalizeNullableText(currentPanelForm.sourceName),
      });

      setAccounts((current) => updateImportedCurrentPanelAccount(current, result));
      setCurrentPanelMessage(t.billing.currentPanelImportSucceeded(format.integer(result.importedCount), format.integer(result.skippedCount)));
    } catch {
      setCurrentPanelMessage(t.billing.currentPanelImportFailed);
    } finally {
      setIsImportingCurrentPanel(false);
    }
  };

  const handleSyncCurrentPanelUsage = async () => {
    if (!canManageBilling) return;

    let payload: unknown;
    try {
      payload = JSON.parse(currentPanelForm.payloadJson);
    } catch {
      setCurrentPanelMessage(t.billing.currentPanelPayloadInvalid);
      return;
    }

    if (!currentPanelForm.customerAccountId) {
      setCurrentPanelMessage(t.billing.currentPanelSelectCustomer);
      return;
    }

    setIsSyncingCurrentPanelUsage(true);
    setCurrentPanelMessage(null);

    try {
      const result = await syncAdminCurrentPanelUsage(sessionToken, {
        customerAccountId: currentPanelForm.customerAccountId,
        defaultProtocol: currentPanelForm.defaultProtocol,
        panelKind: currentPanelForm.panelKind,
        payload,
        sourceName: normalizeNullableText(currentPanelForm.sourceName),
      });

      setAccounts((current) => updateSyncedCurrentPanelUsageAccount(current, result));
      setCurrentPanelMessage(t.billing.currentPanelUsageSyncSucceeded(format.integer(result.syncedCount), format.integer(result.skippedCount)));
    } catch {
      setCurrentPanelMessage(t.billing.currentPanelUsageSyncFailed);
    } finally {
      setIsSyncingCurrentPanelUsage(false);
    }
  };

  const handleExportClientConfigs = async () => {
    if (!canManageBilling) return;

    if (!currentPanelForm.customerAccountId) {
      setCurrentPanelMessage(t.billing.currentPanelSelectCustomer);
      return;
    }

    setIsExportingClientConfigs(true);
    setCurrentPanelMessage(null);

    try {
      const result = await exportAdminCustomerClientConfigs(sessionToken, currentPanelForm.customerAccountId);
      setClientConfigExportJson(formatClientConfigExportJson(result));
      setCurrentPanelMessage(t.billing.currentPanelExportSucceeded(format.integer(result.configCount)));
    } catch {
      setCurrentPanelMessage(t.billing.currentPanelExportFailed);
    } finally {
      setIsExportingClientConfigs(false);
    }
  };

  const handleChargeCurrentPanelVolume = async () => {
    if (!canManageBilling) return;

    if (!currentPanelForm.customerAccountId) {
      setCurrentPanelMessage(t.billing.currentPanelSelectCustomer);
      return;
    }

    const volumeBytesDelta = parseGbLimitInput(currentPanelForm.chargeGb);
    if (volumeBytesDelta === undefined || volumeBytesDelta === null || volumeBytesDelta <= 0) {
      setCurrentPanelMessage(t.billing.currentPanelChargeFailed);
      return;
    }

    setIsChargingCurrentPanelVolume(true);
    setCurrentPanelMessage(null);

    try {
      const result = await chargeAdminCurrentPanelVolume(sessionToken, {
        customerAccountId: currentPanelForm.customerAccountId,
        idempotencyKey: `dashboard:${currentPanelForm.customerAccountId}:${Date.now()}`,
        metadata: {
          dashboardFlow: 'current_panel_charge_volume',
        },
        scope: 'account_quota',
        volumeBytesDelta,
      });
      setAccounts((current) => updateCurrentPanelVolumeChargeAccount(current, result));
      setCurrentPanelMessage(t.billing.currentPanelChargeSucceeded(format.bytes(result.chargeEvent.volumeBytesDelta)));
    } catch {
      setCurrentPanelMessage(t.billing.currentPanelChargeFailed);
    } finally {
      setIsChargingCurrentPanelVolume(false);
    }
  };

  const billingTabs: Array<DashboardTabItem<BillingTab>> = [
    { id: 'catalog', label: t.tabs.billingCatalog, meta: t.billing.packagesLoaded(format.integer(packages.length)) },
    { id: 'customers', label: t.tabs.billingCustomers, meta: t.billing.accountsLoaded(format.integer(accounts.length)) },
    { id: 'panelImport', label: t.tabs.billingPanelImport, meta: t.billing.currentPanelReadOnly },
    { id: 'telegram', label: t.tabs.billingTelegram, meta: t.billing.ordersLoaded(format.integer(paymentOrders.length)) },
    { id: 'orders', label: t.tabs.billingOrders, meta: t.billing.ordersLoaded(format.integer(paymentOrders.length)) },
  ];

  return (
    <section className="mt-0 grid gap-3">
      {error ? <PanelState detail={error} kind="error" title={t.panelStates.errorTitle} /> : null}
      {dataState === 'loading' ? <PanelState detail={t.panelStates.loadingDetail} kind="loading" title={t.panelStates.loadingTitle} /> : null}
      {dataState !== 'live' && dataState !== 'loading' ? <DataStateNotice state={dataState} t={t} /> : null}

      <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4" aria-label={t.billing.summary}>
        {summaryCards.map((item) => <MetricCard item={item} key={item.label} />)}
      </section>

      {isResellerSession ? (
        <ResellerWorkspacePanel
          format={format}
          ledgerEntries={resellerLedgerEntries}
          reseller={reseller}
          t={t}
        />
      ) : null}

      {isResellerSession ? (
        <ResellerSalesSummaryPanel
          format={format}
          reseller={reseller}
          stats={resellerStats}
          t={t}
        />
      ) : null}

      {isResellerSession ? (
        <ResellerPackageSalePanel
          accounts={accounts}
          format={format}
          form={resellerSaleForm}
          isSelling={isSellingResellerPackage}
          message={resellerSaleMessage}
          onFormChange={setResellerSaleForm}
          onSubmit={handleCreateResellerPackageSale}
          packages={packages}
          t={t}
        />
      ) : null}

      {!isResellerSession ? (
        <DashboardTabs
          activeTab={activeBillingTab}
          ariaLabel={t.tabs.billingSections}
          onChange={setActiveBillingTab}
          tabs={billingTabs}
        />
      ) : null}

      <section className={`grid gap-3 xl:grid-cols-[minmax(320px,0.85fr)_minmax(0,1.15fr)] ${!isResellerSession && activeBillingTab !== 'catalog' ? 'hidden' : ''}`}>
        {!isResellerSession ? (
        <section className={panelClass}>
          <PanelHeading
            title={t.billing.rewardSettings}
            icon={Gift}
            meta={rewardSettings ? `${format.bytes(rewardSettings.rewardBytes)} / ${format.integer(rewardSettings.dailyLimit)}` : t.dataStatus.loading}
          />
          <form className="mt-2 grid gap-2" onSubmit={handleSaveRewardSettings}>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone={rewardEnabled ? 'good' : 'neutral'}>
                {rewardEnabled ? t.billing.enabled : t.billing.disabled}
              </StatusBadge>
              <label className="inline-flex min-h-9 items-center gap-2 rounded-md border border-afro-line bg-white px-3 text-[13px] font-bold text-afro-ink">
                <input
                  checked={rewardEnabled}
                  disabled={!canManageBilling}
                  onChange={(event) => setRewardEnabled(event.target.checked)}
                  type="checkbox"
                />
                {t.billing.rewardsEnabled}
              </label>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <SettingsInput inputMode="numeric" label={t.billing.rewardMb} onChange={setRewardMb} value={rewardMb} />
              <SettingsInput inputMode="numeric" label={t.billing.dailyLimit} onChange={setDailyLimit} value={dailyLimit} />
              <SettingsInput label={t.billing.provider} onChange={setProvider} value={provider} />
              <SettingsInput label={t.billing.verificationMode} onChange={setVerificationMode} value={verificationMode} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                className={primaryButtonClass}
                disabled={!canManageBilling || isSavingReward}
                type="submit"
              >
                {isSavingReward ? t.billing.saving : t.billing.saveRewardSettings}
              </button>
              {rewardMessage ? <span className={mutedTextClass}>{rewardMessage}</span> : null}
              {!canManageBilling ? <StatusBadge tone="warning">{t.billing.adminOnly}</StatusBadge> : null}
            </div>
          </form>
        </section>
        ) : null}

        <BillingCatalogPanel
          activeMethodCount={activeMethodCount}
          activePackageCount={activePackageCount}
          format={format}
          paymentMethods={paymentMethods}
          paymentProviderAdapters={paymentProviderAdapters}
          packages={packages}
          settings={settings}
          t={t}
        />
      </section>

      <section className={`grid gap-3 xl:grid-cols-[minmax(340px,0.8fr)_minmax(0,1.2fr)] ${!isResellerSession && activeBillingTab !== 'customers' ? 'hidden' : ''}`}>
        <CustomerAccountEditorPanel
          accounts={accounts}
          canManageBilling={canManageCustomerAccounts}
          customerForm={customerForm}
          customerMessage={customerMessage}
          format={format}
          isSavingCustomer={isSavingCustomer}
          onFormChange={setCustomerForm}
          onSaveCustomerAccount={handleSaveCustomerAccount}
          onSelectCustomerAccount={handleSelectCustomerAccount}
          onStartNewCustomerAccount={handleStartNewCustomerAccount}
          selectedCustomerAccountId={selectedCustomerAccountId}
          t={t}
        />
        <CustomerAccountsPanel accounts={accounts} format={format} t={t} />
      </section>
      {!isResellerSession ? (
        <>
          <div className={activeBillingTab === 'panelImport' ? '' : 'hidden'}>
            <CurrentPanelImportPreviewPanel
              accounts={accounts}
              canManageBilling={canManageBilling}
              clientConfigExportJson={clientConfigExportJson}
              currentPanelForm={currentPanelForm}
              currentPanelMessage={currentPanelMessage}
              currentPanelPreview={currentPanelPreview}
              format={format}
              isExportingClientConfigs={isExportingClientConfigs}
              isChargingCurrentPanelVolume={isChargingCurrentPanelVolume}
              isImportingCurrentPanel={isImportingCurrentPanel}
              isPreviewingCurrentPanel={isPreviewingCurrentPanel}
              isSyncingCurrentPanelUsage={isSyncingCurrentPanelUsage}
              onFormChange={setCurrentPanelForm}
              onExportClientConfigs={handleExportClientConfigs}
              onChargeCurrentPanelVolume={handleChargeCurrentPanelVolume}
              onImportCurrentPanelConfigs={handleImportCurrentPanelConfigs}
              onPreviewCurrentPanelImport={handlePreviewCurrentPanelImport}
              onSyncCurrentPanelUsage={handleSyncCurrentPanelUsage}
              t={t}
            />
          </div>
          <div className={activeBillingTab === 'telegram' ? '' : 'hidden'}>
            <TelegramBotOperationsPanel
              accounts={accounts}
              canViewTelegramOperations={canViewTelegramOperations}
              format={format}
              paymentOrders={paymentOrders}
              telegramBotSettings={telegramBotSettings}
              t={t}
            />
          </div>
        </>
      ) : null}
      <div className={isResellerSession || activeBillingTab === 'orders' ? '' : 'hidden'}>
        <PaymentOrdersPanel format={format} paymentOrders={paymentOrders} t={t} />
      </div>
    </section>
  );
}

function ResellerWorkspacePanel({
  format,
  ledgerEntries,
  reseller,
  t,
}: {
  format: DashboardFormatters;
  ledgerEntries: AdminResellerWalletLedgerEntry[];
  reseller: AdminResellerAccountSummary | null;
  t: DashboardStrings;
}) {
  const walletMetrics = reseller ? [
    {
      icon: CreditCard,
      label: t.billing.resellerWalletBalance,
      value: formatMoneyAmount(reseller.balanceAmount, reseller.currency, format),
    },
    {
      icon: ShieldCheck,
      label: t.billing.resellerAvailableBalance,
      value: formatMoneyAmount(reseller.availableBalanceAmount, reseller.currency, format),
    },
    {
      icon: UserRound,
      label: t.billing.sellerMargin,
      value: `${format.integer(reseller.sellerMarginPercent)}%`,
    },
    {
      icon: Inbox,
      label: t.billing.afroGateShare,
      value: `${format.integer(reseller.afroGateSharePercent)}%`,
    },
  ] : [];
  const walletLedgerColumns: Array<DataTableColumn<AdminResellerWalletLedgerEntry>> = [
    {
      key: 'entry',
      header: t.billing.walletEntry,
      render: (entry) => <StatusBadge tone={entry.amount >= 0 ? 'good' : 'warning'}>{resellerWalletEntryTypeLabel(entry.entryType, t)}</StatusBadge>,
    },
    {
      key: 'amount',
      header: t.billing.amount,
      render: (entry) => formatMoneyAmount(entry.amount, entry.currency, format),
    },
    {
      key: 'balanceAfter',
      header: t.billing.balanceAfter,
      render: (entry) => formatMoneyAmount(entry.balanceAfterAmount, entry.currency, format),
    },
    { key: 'source', header: t.billing.source, render: (entry) => resellerWalletSourceLabel(entry.source, t) },
    { key: 'package', header: t.billing.packageName, render: (entry) => entry.volumePackageName ?? '--' },
    { key: 'createdAt', header: t.billing.createdAt, render: (entry) => format.dateTime(new Date(entry.createdAt)) },
  ];

  return (
    <section className={panelClass}>
      <PanelHeading
        title={t.billing.resellerWorkspace}
        icon={CreditCard}
        meta={reseller ? reseller.displayName : t.dataStatus.loading}
      />
      {reseller ? (
        <>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {walletMetrics.map((item) => <MetricPill icon={item.icon} key={item.label} label={item.label} value={item.value} />)}
          </div>
          {ledgerEntries.length > 0 ? (
            <div className="mt-2">
              <DataTable columns={walletLedgerColumns} minWidth="760px" rowKey={(entry) => entry.id} rows={ledgerEntries} />
            </div>
          ) : (
            <div className="mt-2">
              <EmptyState message={t.billing.noWalletLedgerEntries} />
            </div>
          )}
        </>
      ) : (
        <PanelState detail={t.panelStates.loadingDetail} kind="loading" title={t.panelStates.loadingTitle} />
      )}
    </section>
  );
}

function ResellerPackageSalePanel({
  accounts,
  format,
  form,
  isSelling,
  message,
  onClose,
  onFormChange,
  onSubmit,
  packages,
  submitLabel,
  t,
  title,
  titleId,
}: {
  accounts: AdminCustomerAccountSummary[];
  format: DashboardFormatters;
  form: ResellerPackageSaleFormState;
  isSelling: boolean;
  message: string | null;
  onClose?: () => void;
  onFormChange: (form: ResellerPackageSaleFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  packages: AdminVolumePackageSummary[];
  submitLabel?: string;
  t: DashboardStrings;
  title?: string;
  titleId?: string;
}) {
  const activePackages = packages.filter((item) => item.status === 'active');
  const selectedPackage = activePackages.find((item) => item.id === form.volumePackageId) ?? null;
  const panelTitle = title ?? t.billing.resellerPackageSale;
  const updateForm = (patch: Partial<ResellerPackageSaleFormState>) => onFormChange({ ...form, ...patch });

  return (
    <section className={panelClass}>
      <div className="flex min-h-7 items-center justify-between gap-2 border-b border-afro-line pb-1.5">
        <PanelHeadingContent
          title={panelTitle}
          meta={selectedPackage ? `${format.bytes(selectedPackage.volumeBytes)} / ${formatMoneyAmount(selectedPackage.totalPrice, selectedPackage.currency, format)}` : t.billing.selectPackage}
          titleId={titleId}
        />
        <div className="flex shrink-0 items-center gap-2 text-afro-muted">
          <CreditCard size={16} />
          {onClose ? (
            <button
              aria-label={t.actions.cancel}
              className="inline-flex size-8 items-center justify-center rounded-md border border-afro-line bg-white text-afro-muted hover:border-afro-blue hover:text-afro-blue disabled:cursor-not-allowed disabled:opacity-55"
              disabled={isSelling}
              onClick={onClose}
              title={t.actions.cancel}
              type="button"
            >
              <X size={16} />
            </button>
          ) : null}
        </div>
      </div>
      <form className="mt-2 grid gap-2" onSubmit={onSubmit}>
        <div className="grid gap-2 md:grid-cols-3">
          <label className="grid gap-1.5">
            <span className={formLabelClass}>{t.billing.packageName}</span>
            <select
              className={inputClass}
              onChange={(event) => updateForm({ volumePackageId: event.target.value })}
              required
              value={form.volumePackageId}
            >
              <option value="">{t.billing.selectPackage}</option>
              {activePackages.map((item) => (
                <option key={item.id} value={item.id}>
                  {`${item.name} / ${formatMoneyAmount(item.totalPrice, item.currency, format)}`}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5">
            <span className={formLabelClass}>{t.billing.saleCustomer}</span>
            <select
              className={inputClass}
              onChange={(event) => updateForm({ customerAccountId: event.target.value })}
              value={form.customerAccountId}
            >
              <option value="">{t.billing.newCustomer}</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.displayName ?? account.telegramUsername ?? account.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5">
            <span className={formLabelClass}>{t.billing.notes}</span>
            <input
              className={inputClass}
              onChange={(event) => updateForm({ notes: event.target.value })}
              value={form.notes}
            />
          </label>
        </div>
        {!form.customerAccountId ? (
          <div className="grid gap-2 md:grid-cols-2">
            <label className="grid gap-1.5">
              <span className={formLabelClass}>{t.billing.displayName}</span>
              <input
                className={inputClass}
                onChange={(event) => updateForm({ displayName: event.target.value })}
                required={!form.telegramUsername.trim()}
                value={form.displayName}
              />
            </label>
            <label className="grid gap-1.5">
              <span className={formLabelClass}>{t.billing.telegramUsername}</span>
              <input
                className={inputClass}
                onChange={(event) => updateForm({ telegramUsername: event.target.value })}
                value={form.telegramUsername}
              />
            </label>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2 border-t border-afro-line pt-2">
          <button
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-afro-sidebar px-4 text-sm font-bold text-white hover:bg-[#1f3138] disabled:cursor-not-allowed disabled:opacity-55"
            disabled={isSelling || !form.volumePackageId}
            type="submit"
          >
            <CreditCard size={16} />
            {isSelling ? t.billing.saving : submitLabel ?? t.billing.sellPackage}
          </button>
          {message ? <span className={mutedTextClass}>{message}</span> : null}
        </div>
      </form>
    </section>
  );
}

function updateImportedCurrentPanelAccount(
  accounts: AdminCustomerAccountSummary[],
  result: AdminCurrentPanelImportConfigsResponse,
): AdminCustomerAccountSummary[] {
  const activeImportedCount = result.importedConfigs.filter((config) => config.status === 'active').length;

  return accounts.map((account) => {
    if (account.id !== result.customerAccountId) return account;

    const usedBytes = account.usedBytes + result.baselineUsedBytes;
    return {
      ...account,
      activeClientCount: account.activeClientCount + activeImportedCount,
      clientCount: account.clientCount + result.importedCount,
      remainingBytes: account.quotaLimitBytes === null || account.quotaLimitBytes === undefined
        ? null
        : Math.max(account.quotaLimitBytes - usedBytes, 0),
      updatedAt: result.generatedAt,
      usedBytes,
    };
  });
}

function updateSyncedCurrentPanelUsageAccount(
  accounts: AdminCustomerAccountSummary[],
  result: AdminCurrentPanelUsageSyncResponse,
): AdminCustomerAccountSummary[] {
  return accounts.map((account) => {
    if (account.id !== result.customerAccountId) return account;

    const usedBytes = account.usedBytes + result.syncedUsedBytesDelta;
    return {
      ...account,
      remainingBytes: account.quotaLimitBytes === null || account.quotaLimitBytes === undefined
        ? null
        : Math.max(account.quotaLimitBytes - usedBytes, 0),
      updatedAt: result.generatedAt,
      usedBytes,
    };
  });
}

function updateCurrentPanelVolumeChargeAccount(
  accounts: AdminCustomerAccountSummary[],
  result: AdminCurrentPanelVolumeChargeResponse,
): AdminCustomerAccountSummary[] {
  return [
    result.account,
    ...accounts.filter((account) => account.id !== result.account.id),
  ];
}

function formatClientConfigExportJson(result: AdminClientConfigsExportResponse): string {
  return JSON.stringify({
    configCount: result.configCount,
    configs: result.configs,
    customerAccountId: result.customerAccountId,
    exportFormat: result.exportFormat,
    generatedAt: result.generatedAt,
    warnings: result.warnings,
  }, null, 2);
}


function CustomerAccountEditorPanel({
  accounts,
  canManageBilling,
  customerForm,
  customerMessage,
  format,
  isSavingCustomer,
  onFormChange,
  onSaveCustomerAccount,
  onSelectCustomerAccount,
  onStartNewCustomerAccount,
  selectedCustomerAccountId,
  t,
}: {
  accounts: AdminCustomerAccountSummary[];
  canManageBilling: boolean;
  customerForm: CustomerAccountFormState;
  customerMessage: string | null;
  format: DashboardFormatters;
  isSavingCustomer: boolean;
  onFormChange: (form: CustomerAccountFormState) => void;
  onSaveCustomerAccount: (event: FormEvent<HTMLFormElement>) => void;
  onSelectCustomerAccount: (accountId: string) => void;
  onStartNewCustomerAccount: () => void;
  selectedCustomerAccountId: string | null;
  t: DashboardStrings;
}) {
  const selectedAccount = accounts.find((account) => account.id === selectedCustomerAccountId) ?? null;
  const updateForm = (patch: Partial<CustomerAccountFormState>) => onFormChange({ ...customerForm, ...patch });

  return (
    <section className={panelClass}>
      <PanelHeading
        title={t.billing.customerLimitManager}
        icon={UserRound}
        meta={selectedAccount ? (selectedAccount.displayName ?? selectedAccount.telegramUsername ?? selectedAccount.id.slice(0, 8)) : t.billing.newCustomer}
      />
      <form className="mt-2 grid gap-2" onSubmit={onSaveCustomerAccount}>
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <label className="grid gap-1.5">
            <span className={mutedTextClass}>{t.billing.selectCustomer}</span>
            <select
              className="min-h-10 rounded-md border border-afro-line bg-white px-3 text-sm font-bold text-afro-ink outline-none ring-afro-teal/20 focus:border-afro-teal focus:ring-4 disabled:opacity-45"
              disabled={!canManageBilling}
              onChange={(event) => onSelectCustomerAccount(event.target.value)}
              value={selectedCustomerAccountId ?? ''}
            >
              <option value="">{t.billing.newCustomer}</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.displayName ?? account.telegramUsername ?? account.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </label>
          <button
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-afro-line bg-white px-3 text-sm font-bold text-afro-ink hover:border-afro-blue hover:text-afro-blue disabled:cursor-not-allowed disabled:opacity-45"
            disabled={!canManageBilling}
            onClick={onStartNewCustomerAccount}
            type="button"
          >
            <Plus size={15} />
            {t.billing.newCustomer}
          </button>
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          <SettingsInput
            disabled={!canManageBilling}
            label={t.billing.displayName}
            onChange={(displayName) => updateForm({ displayName })}
            required
            value={customerForm.displayName}
          />
          <SettingsInput
            disabled={!canManageBilling}
            label={t.billing.telegramUsername}
            onChange={(telegramUsername) => updateForm({ telegramUsername })}
            value={customerForm.telegramUsername}
          />
          <SettingsInput
            disabled={!canManageBilling}
            inputMode="numeric"
            label={t.billing.accountQuotaGb}
            onChange={(quotaLimitGb) => updateForm({ quotaLimitGb })}
            value={customerForm.quotaLimitGb}
          />
          <SettingsInput
            disabled={!canManageBilling}
            inputMode="numeric"
            label={t.billing.perClientLimitGb}
            onChange={(perClientLimitGb) => updateForm({ perClientLimitGb })}
            value={customerForm.perClientLimitGb}
          />
          <label className="grid gap-1.5">
            <span className={mutedTextClass}>{t.billing.quotaScope}</span>
            <select
              aria-label={t.billing.quotaScope}
              className="min-h-10 rounded-md border border-afro-line bg-white px-3 text-sm font-bold text-afro-ink outline-none ring-afro-teal/20 focus:border-afro-teal focus:ring-4 disabled:opacity-45"
              disabled={!canManageBilling}
              onChange={(event) => updateForm({ quotaScope: event.target.value as CustomerQuotaScope })}
              value={customerForm.quotaScope}
            >
              {customerQuotaScopeOptions.map((scope) => (
                <option key={scope} value={scope}>
                  {customerQuotaScopeLabel(scope, t)}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5">
            <span className={mutedTextClass}>{t.billing.status}</span>
            <select
              className="min-h-10 rounded-md border border-afro-line bg-white px-3 text-sm font-bold text-afro-ink outline-none ring-afro-teal/20 focus:border-afro-teal focus:ring-4 disabled:opacity-45"
              disabled={!canManageBilling}
              onChange={(event) => updateForm({ status: event.target.value as CustomerAccountStatus })}
              value={customerForm.status}
            >
              {customerAccountStatusOptions.map((status) => (
                <option key={status} value={status}>
                  {customerAccountStatusLabel(status, t)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <SettingsInput
          disabled={!canManageBilling}
          label={t.billing.notes}
          onChange={(notes) => updateForm({ notes })}
          value={customerForm.notes}
        />

        <div className="grid gap-2 sm:grid-cols-3">
          <MetricPill
            icon={ShieldCheck}
            label={t.billing.accountLimit}
            value={customerForm.quotaLimitGb.trim() ? format.bytes(parseGbLimitInput(customerForm.quotaLimitGb) ?? null) : t.billing.unlimited}
          />
          <MetricPill
            icon={UserRound}
            label={t.billing.clientLimit}
            value={customerForm.perClientLimitGb.trim() ? format.bytes(parseGbLimitInput(customerForm.perClientLimitGb) ?? null) : t.billing.unlimited}
          />
          <MetricPill
            icon={Inbox}
            label={t.billing.quotaScope}
            value={customerQuotaScopeLabel(customerForm.quotaScope, t)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            className={primaryButtonClass}
            disabled={!canManageBilling || isSavingCustomer}
            type="submit"
          >
            {isSavingCustomer
              ? t.billing.saving
              : selectedCustomerAccountId
                ? t.billing.updateCustomerAccount
                : t.billing.createCustomerAccount}
          </button>
          {customerMessage ? <span className={mutedTextClass}>{customerMessage}</span> : null}
          {!canManageBilling ? <StatusBadge tone="warning">{t.billing.adminOnly}</StatusBadge> : null}
        </div>
      </form>
    </section>
  );
}

function CurrentPanelImportPreviewPanel({
  accounts,
  canManageBilling,
  clientConfigExportJson,
  currentPanelForm,
  currentPanelMessage,
  currentPanelPreview,
  format,
  isChargingCurrentPanelVolume,
  isExportingClientConfigs,
  isImportingCurrentPanel,
  isPreviewingCurrentPanel,
  isSyncingCurrentPanelUsage,
  onFormChange,
  onChargeCurrentPanelVolume,
  onExportClientConfigs,
  onImportCurrentPanelConfigs,
  onPreviewCurrentPanelImport,
  onSyncCurrentPanelUsage,
  t,
}: {
  accounts: AdminCustomerAccountSummary[];
  canManageBilling: boolean;
  clientConfigExportJson: string | null;
  currentPanelForm: CurrentPanelImportFormState;
  currentPanelMessage: string | null;
  currentPanelPreview: AdminCurrentPanelImportPreviewResponse | null;
  format: DashboardFormatters;
  isChargingCurrentPanelVolume: boolean;
  isExportingClientConfigs: boolean;
  isImportingCurrentPanel: boolean;
  isPreviewingCurrentPanel: boolean;
  isSyncingCurrentPanelUsage: boolean;
  onFormChange: (form: CurrentPanelImportFormState) => void;
  onChargeCurrentPanelVolume: () => void;
  onExportClientConfigs: () => void;
  onImportCurrentPanelConfigs: () => void;
  onPreviewCurrentPanelImport: (event: FormEvent<HTMLFormElement>) => void;
  onSyncCurrentPanelUsage: () => void;
  t: DashboardStrings;
}) {
  const updateForm = (patch: Partial<CurrentPanelImportFormState>) => onFormChange({ ...currentPanelForm, ...patch });
  const candidates = currentPanelPreview?.candidates ?? [];
  const isBusy = isPreviewingCurrentPanel || isImportingCurrentPanel || isSyncingCurrentPanelUsage || isExportingClientConfigs || isChargingCurrentPanelVolume;
  const payloadPlaceholder = `{"users":[{"username":"vip_gamer","status":"active","data_limit":"25GB","used_traffic":"6GB","expire":1893456000}]}`;
  const candidateRows = candidates.slice(0, 8);
  const candidateColumns: Array<DataTableColumn<(typeof candidateRows)[number]>> = [
    {
      key: 'candidate',
      header: t.billing.currentPanelCandidate,
      render: (candidate) => (
        <>
          <strong className="block text-afro-ink">{candidate.label}</strong>
          <span className="text-[12px] text-afro-muted">{candidate.username ?? candidate.externalPanelUserId ?? candidate.protocol}</span>
        </>
      ),
    },
    {
      key: 'kind',
      header: t.billing.currentPanelKind,
      render: () => currentPanelPreview ? currentPanelKindLabel(currentPanelPreview.panelKind as CurrentPanelKind, t) : '--',
    },
    {
      key: 'usedQuota',
      header: t.billing.usedQuota,
      render: (candidate) => candidate.usedBytes === null || candidate.usedBytes === undefined ? '--' : format.bytes(candidate.usedBytes),
    },
    {
      key: 'totalQuota',
      header: t.billing.totalQuota,
      render: (candidate) => candidate.quotaBytes === null || candidate.quotaBytes === undefined ? t.billing.unlimited : format.bytes(candidate.quotaBytes),
    },
    {
      key: 'remaining',
      header: t.billing.remaining,
      render: (candidate) => candidate.remainingBytes === null || candidate.remainingBytes === undefined ? t.billing.unlimited : format.bytes(candidate.remainingBytes),
    },
    {
      key: 'status',
      header: t.billing.status,
      render: (candidate) => (
        <StatusBadge tone={currentPanelStatusTone(candidate.status)}>
          {currentPanelStatusLabel(candidate.status, t)}
        </StatusBadge>
      ),
    },
  ];

  return (
    <section className={panelClass}>
      <PanelHeading
        title={t.billing.currentPanelImport}
        icon={Upload}
        meta={currentPanelPreview ? t.billing.currentPanelAdapter(currentPanelPreview.adapterVersion) : t.billing.currentPanelReadOnly}
      />
      <form className="mt-2 grid gap-2" onSubmit={onPreviewCurrentPanelImport}>
        <div className="grid gap-2 md:grid-cols-4">
          <label className="grid gap-1.5">
            <span className={mutedTextClass}>{t.billing.currentPanelKind}</span>
            <select
              aria-label={t.billing.currentPanelKind}
              className="min-h-10 rounded-md border border-afro-line bg-white px-3 text-sm font-bold text-afro-ink outline-none ring-afro-teal/20 focus:border-afro-teal focus:ring-4 disabled:opacity-45"
              disabled={!canManageBilling || isBusy}
              onChange={(event) => updateForm({ panelKind: event.target.value as CurrentPanelKind })}
              value={currentPanelForm.panelKind}
            >
              {currentPanelKindOptions.map((kind) => (
                <option key={kind} value={kind}>
                  {currentPanelKindLabel(kind, t)}
                </option>
              ))}
            </select>
          </label>
          <SettingsInput
            disabled={!canManageBilling || isBusy}
            label={t.billing.currentPanelSourceName}
            onChange={(sourceName) => updateForm({ sourceName })}
            value={currentPanelForm.sourceName}
          />
          <SettingsInput
            disabled={!canManageBilling || isBusy}
            label={t.billing.currentPanelDefaultProtocol}
            onChange={(defaultProtocol) => updateForm({ defaultProtocol })}
            value={currentPanelForm.defaultProtocol}
          />
          <div className="grid content-end">
            <button
              className={primaryButtonClass}
              disabled={!canManageBilling || isBusy || !currentPanelForm.payloadJson.trim()}
              type="submit"
            >
              {isPreviewingCurrentPanel ? t.billing.saving : t.billing.currentPanelPreviewImport}
            </button>
          </div>
        </div>
        <label className="grid gap-1.5">
          <span className={mutedTextClass}>{t.billing.currentPanelPayloadJson}</span>
          <textarea
            aria-label={t.billing.currentPanelPayloadJson}
            className="min-h-[150px] w-full rounded-md border border-afro-line bg-white px-3 py-2 font-mono text-[13px] text-afro-ink outline-none ring-afro-teal/20 focus:border-afro-teal focus:ring-4 disabled:opacity-45"
            dir="ltr"
            disabled={!canManageBilling || isBusy}
            onChange={(event) => updateForm({ payloadJson: event.target.value })}
            placeholder={payloadPlaceholder}
            value={currentPanelForm.payloadJson}
          />
        </label>
        <div className="grid gap-2 md:grid-cols-[minmax(220px,1fr)_minmax(140px,180px)_minmax(260px,1fr)]">
          <label className="grid gap-1.5">
            <span className={mutedTextClass}>{t.billing.currentPanelImportToCustomer}</span>
            <select
              aria-label={t.billing.currentPanelImportToCustomer}
              className="min-h-10 rounded-md border border-afro-line bg-white px-3 text-sm font-bold text-afro-ink outline-none ring-afro-teal/20 focus:border-afro-teal focus:ring-4 disabled:opacity-45"
              disabled={!canManageBilling || isBusy}
              onChange={(event) => updateForm({ customerAccountId: event.target.value })}
              value={currentPanelForm.customerAccountId}
            >
              <option value="">{t.billing.currentPanelSelectCustomer}</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.displayName ?? account.telegramUsername ?? account.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </label>
          <SettingsInput
            disabled={!canManageBilling || isBusy}
            inputMode="numeric"
            label={t.billing.currentPanelChargeGb}
            onChange={(chargeGb) => updateForm({ chargeGb })}
            value={currentPanelForm.chargeGb}
          />
          <div className="grid content-end gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <button
              className={primaryButtonClass}
              disabled={!canManageBilling || isBusy || !currentPanelForm.payloadJson.trim() || !currentPanelForm.customerAccountId}
              onClick={onImportCurrentPanelConfigs}
              type="button"
            >
              {isImportingCurrentPanel ? t.billing.saving : t.billing.currentPanelImportConfigs}
            </button>
            <button
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-afro-line bg-white px-3 text-sm font-bold text-afro-ink hover:border-afro-blue hover:text-afro-blue disabled:cursor-not-allowed disabled:opacity-45"
              disabled={!canManageBilling || isBusy || !currentPanelForm.payloadJson.trim() || !currentPanelForm.customerAccountId}
              onClick={onSyncCurrentPanelUsage}
              type="button"
            >
              {isSyncingCurrentPanelUsage ? t.billing.saving : t.billing.currentPanelSyncUsage}
            </button>
            <button
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-afro-line bg-white px-3 text-sm font-bold text-afro-ink hover:border-afro-blue hover:text-afro-blue disabled:cursor-not-allowed disabled:opacity-45"
              disabled={!canManageBilling || isBusy || !currentPanelForm.customerAccountId}
              onClick={onExportClientConfigs}
              type="button"
            >
              {isExportingClientConfigs ? t.billing.saving : t.billing.currentPanelExportConfigs}
            </button>
            <button
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-afro-line bg-white px-3 text-sm font-bold text-afro-ink hover:border-afro-blue hover:text-afro-blue disabled:cursor-not-allowed disabled:opacity-45"
              disabled={!canManageBilling || isBusy || !currentPanelForm.customerAccountId || !currentPanelForm.chargeGb.trim()}
              onClick={onChargeCurrentPanelVolume}
              type="button"
            >
              {isChargingCurrentPanelVolume ? t.billing.saving : t.billing.currentPanelChargeVolume}
            </button>
          </div>
        </div>
        {clientConfigExportJson ? (
          <label className="grid gap-1.5">
            <span className={mutedTextClass}>{t.billing.currentPanelExportJson}</span>
            <textarea
              aria-label={t.billing.currentPanelExportJson}
              className="min-h-[130px] w-full rounded-md border border-afro-line bg-white px-3 py-2 font-mono text-[13px] text-afro-ink outline-none ring-afro-teal/20 focus:border-afro-teal focus:ring-4"
              dir="ltr"
              readOnly
              value={clientConfigExportJson}
            />
          </label>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          {currentPanelMessage ? <span className={mutedTextClass}>{currentPanelMessage}</span> : null}
          {!canManageBilling ? <StatusBadge tone="warning">{t.billing.adminOnly}</StatusBadge> : null}
        </div>
      </form>

      {currentPanelPreview ? (
        <div className="mt-2 grid gap-2">
          <div className="grid gap-2 sm:grid-cols-4">
            <MetricPill icon={UserRound} label={t.billing.currentPanelCandidates} value={format.integer(currentPanelPreview.candidateCount)} />
            <MetricPill icon={ShieldCheck} label={t.billing.active} value={format.integer(currentPanelPreview.activeCount)} />
            <MetricPill icon={WifiOff} label={t.billing.limited} value={format.integer(currentPanelPreview.limitedCount)} />
            <MetricPill
              icon={Inbox}
              label={t.billing.totalQuota}
              value={currentPanelPreview.totalQuotaBytes === null || currentPanelPreview.totalQuotaBytes === undefined ? t.billing.unlimited : format.bytes(currentPanelPreview.totalQuotaBytes)}
            />
          </div>
          {candidates.length > 0 ? (
            <DataTable
              columns={candidateColumns}
              minWidth="760px"
              rowKey={(candidate) => `${candidate.externalPanel}:${candidate.externalPanelUserId ?? candidate.label}`}
              rows={candidateRows}
            />
          ) : <EmptyState message={t.billing.currentPanelNoPreview} />}
          <div className="flex flex-wrap gap-1.5">
            {currentPanelPreview.rejectedRows.length > 0 ? (
              <StatusBadge tone="warning">{t.billing.currentPanelRejectedRows(format.integer(currentPanelPreview.rejectedRows.length))}</StatusBadge>
            ) : null}
            {currentPanelPreview.warnings.map((warning) => (
              <StatusBadge key={warning} tone="neutral">{format.label(warning)}</StatusBadge>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-2">
          <EmptyState message={t.billing.currentPanelNoPreview} />
        </div>
      )}
    </section>
  );
}

function BillingCatalogPanel({
  activeMethodCount,
  activePackageCount,
  format,
  paymentMethods,
  paymentProviderAdapters,
  packages,
  settings,
  t,
}: {
  activeMethodCount: number;
  activePackageCount: number;
  format: DashboardFormatters;
  paymentMethods: AdminPaymentMethodSummary[];
  paymentProviderAdapters: AdminPaymentProviderAdapterSummary[];
  packages: AdminVolumePackageSummary[];
  settings: AdminBillingSettingsSummary | null;
  t: DashboardStrings;
}) {
  const visiblePackages = packages.slice(0, 8);
  const packageColumns: Array<DataTableColumn<AdminVolumePackageSummary>> = [
    {
      key: 'package',
      header: t.billing.packageName,
      render: (item) => (
        <>
          <strong className="block text-afro-ink">{item.name}</strong>
          <span className="text-[12px] text-afro-muted">{item.slug}</span>
        </>
      ),
    },
    { key: 'volume', header: t.billing.volume, render: (item) => format.bytes(item.volumeBytes) },
    { key: 'price', header: t.billing.price, render: (item) => `${format.integer(item.totalPrice)} ${format.label(item.currency)}` },
    { key: 'duration', header: t.billing.duration, render: (item) => item.durationDays ? t.billing.days(format.integer(item.durationDays)) : t.billing.noExpiry },
    {
      key: 'status',
      header: t.billing.status,
      render: (item) => <StatusBadge tone={billingStatusTone(item.status)}>{format.label(item.status)}</StatusBadge>,
    },
  ];
  const paymentProviderAdapterColumns: Array<DataTableColumn<AdminPaymentProviderAdapterSummary>> = [
    { key: 'provider', header: t.billing.provider, render: (adapter) => paymentProviderLabel(adapter.provider, t) },
    { key: 'checkout', header: t.billing.checkoutMode, render: (adapter) => paymentCheckoutModeLabel(adapter.checkoutMode, t) },
    { key: 'settlement', header: t.billing.settlement, render: (adapter) => paymentSettlementLabel(adapter.settlementMode, t) },
    { key: 'verification', header: t.billing.verification, render: (adapter) => paymentVerificationLabel(adapter.supportsWebhookVerification, t) },
    {
      key: 'status',
      header: t.billing.status,
      render: (adapter) => (
        <StatusBadge tone={paymentAdapterStatusTone(adapter.status)}>
          {paymentAdapterStatusLabel(adapter.status, t)}
        </StatusBadge>
      ),
    },
  ];

  return (
    <section className={panelClass}>
      <PanelHeading title={t.billing.catalog} icon={CreditCard} meta={t.billing.packagesLoaded(format.integer(packages.length))} />
      <div className="mt-2 grid gap-2">
        <div className="grid gap-2 sm:grid-cols-3">
          <MetricPill
            icon={CreditCard}
            label={t.billing.pricePerGb}
            value={settings ? `${format.integer(settings.pricePerGb)} ${format.label(settings.currency)}` : '--'}
          />
          <MetricPill icon={Inbox} label={t.billing.activePackages} value={format.integer(activePackageCount)} />
          <MetricPill icon={ShieldCheck} label={t.billing.activeMethods} value={format.integer(activeMethodCount)} />
        </div>
        {packages.length === 0 ? <EmptyState message={t.billing.noPackages} /> : null}
        {packages.length > 0 ? (
          <DataTable columns={packageColumns} minWidth="620px" rowKey={(item) => item.id} rows={visiblePackages} />
        ) : null}
        <div className="flex flex-wrap gap-1.5">
          {paymentMethods.map((method) => (
            <StatusBadge key={method.id} tone={billingStatusTone(method.status)}>
              {`${format.label(method.provider)} / ${format.label(method.checkoutMode)}`}
            </StatusBadge>
          ))}
        </div>
        {paymentProviderAdapters.length > 0 ? (
          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-afro-ink">{t.billing.paymentProviderAdapters}</h3>
              <span className={mutedTextClass}>{t.billing.adaptersLoaded(format.integer(paymentProviderAdapters.length))}</span>
            </div>
            <DataTable
              columns={paymentProviderAdapterColumns}
              minWidth="760px"
              rowKey={(adapter) => adapter.provider}
              rows={paymentProviderAdapters}
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}

function PaymentOrdersPanel({
  format,
  paymentOrders,
  t,
}: {
  format: DashboardFormatters;
  paymentOrders: AdminPaymentOrderSummary[];
  t: DashboardStrings;
}) {
  const visiblePaymentOrders = paymentOrders.slice(0, 10);
  const paymentOrderColumns: Array<DataTableColumn<AdminPaymentOrderSummary>> = [
    {
      key: 'customer',
      header: t.billing.customer,
      render: (order) => (
        <>
          <strong className="block text-afro-ink">{order.customerDisplayName || order.customerTelegramUsername || order.customerAccountId.slice(0, 8)}</strong>
          <span className="text-[12px] text-afro-muted">{format.time(new Date(order.createdAt), false)}</span>
        </>
      ),
    },
    { key: 'package', header: t.billing.packageName, render: (order) => order.packageName },
    { key: 'amount', header: t.billing.amount, render: (order) => `${format.integer(order.amount)} ${format.label(order.currency)}` },
    { key: 'provider', header: t.billing.provider, render: (order) => format.label(order.provider) },
    {
      key: 'status',
      header: t.billing.status,
      render: (order) => <StatusBadge tone={billingStatusTone(order.status)}>{format.label(order.status)}</StatusBadge>,
    },
    {
      key: 'allocation',
      header: t.billing.allocation,
      render: (order) => {
        const allocationStatus = order.allocationStatus ?? 'not_applicable';

        return (
          <StatusBadge tone={billingStatusTone(allocationStatus)}>
            {format.label(allocationStatus)}
          </StatusBadge>
        );
      },
    },
  ];

  return (
    <section className={panelClass}>
      <PanelHeading title={t.billing.paymentOrders} icon={CreditCard} meta={t.billing.ordersLoaded(format.integer(paymentOrders.length))} />
      <div className="mt-2 grid gap-2">
        {paymentOrders.length === 0 ? <EmptyState message={t.billing.noPaymentOrders} /> : null}
        {paymentOrders.length > 0 ? (
          <DataTable
            columns={paymentOrderColumns}
            minWidth="760px"
            rowKey={(order) => order.id}
            rows={visiblePaymentOrders}
          />
        ) : null}
      </div>
    </section>
  );
}

function TelegramBotOperationsPanel({
  accounts,
  canViewTelegramOperations,
  format,
  paymentOrders,
  telegramBotSettings,
  t,
}: {
  accounts: AdminCustomerAccountSummary[];
  canViewTelegramOperations: boolean;
  format: DashboardFormatters;
  paymentOrders: AdminPaymentOrderSummary[];
  telegramBotSettings: AdminTelegramBotSettingsSummary | null;
  t: DashboardStrings;
}) {
  const accountsById = new Map(accounts.map((account) => [account.id, account]));
  const linkedAccountCount = accounts.filter((account) => Boolean(account.telegramId)).length;
  const paidOrders = paymentOrders.filter((order) => order.status === 'paid');
  const pendingAllocationCount = paidOrders.filter((order) => order.allocationStatus === 'pending').length;
  const allocatedLinkedOrderCount = paidOrders.filter((order) => {
    const account = accountsById.get(order.customerAccountId);
    return Boolean(account?.telegramId) && order.allocationStatus === 'allocated';
  }).length;
  const deliveryCandidateCount = paidOrders.filter((order) => {
    const account = accountsById.get(order.customerAccountId);
    return Boolean(account?.telegramId) && account?.activeClientCount === 1;
  }).length;
  const botIdentity = telegramBotSettings?.botUsername
    ? `@${telegramBotSettings.botUsername}`
    : telegramBotSettings?.botFirstName ?? (canViewTelegramOperations ? t.billing.pending : t.billing.adminOnly);
  const deliveryReady = Boolean(telegramBotSettings?.hasBotToken);
  const commandsReady = Boolean(telegramBotSettings?.hasBotToken && telegramBotSettings.commandsEnabled && telegramBotSettings.botUsername);
  const alertsReady = Boolean(telegramBotSettings?.hasBotToken && telegramBotSettings.alertsEnabled && telegramBotSettings.alertChatId);
  const apiTestTone: Tone = telegramBotSettings?.lastTestStatus === 'ok'
    ? 'good'
    : telegramBotSettings?.lastTestStatus === 'failed' || telegramBotSettings?.lastTestStatus === 'missingToken'
      ? 'warning'
      : 'neutral';
  const readinessRows: Array<{ label: string; value: string; tone: Tone }> = [
    {
      label: t.settings.telegramBotToken,
      value: telegramBotSettings?.hasBotToken ? t.billing.stored : t.billing.missing,
      tone: telegramBotSettings?.hasBotToken ? 'good' : 'warning',
    },
    {
      label: t.settings.telegramWebhookSecret,
      value: telegramBotSettings?.hasWebhookSecret ? t.billing.ready : t.billing.pending,
      tone: telegramBotSettings?.hasWebhookSecret ? 'good' : 'neutral',
    },
    {
      label: t.billing.telegramCommands,
      value: commandsReady ? t.billing.ready : t.billing.blocked,
      tone: commandsReady ? 'good' : 'warning',
    },
    {
      label: t.billing.telegramAlerts,
      value: alertsReady ? t.billing.ready : t.billing.pending,
      tone: alertsReady ? 'good' : 'neutral',
    },
    {
      label: t.settings.telegramBotApiTest,
      value: telegramTestStatusLabel(telegramBotSettings?.lastTestStatus ?? 'notTested', t),
      tone: apiTestTone,
    },
    {
      label: t.settings.outboundProxy,
      value: telegramBotSettings?.outboundProxyConfigured ? t.billing.configured : t.billing.direct,
      tone: telegramBotSettings?.outboundProxyConfigured ? 'good' : 'neutral',
    },
  ];
  const operationRows: Array<{ label: string; value: string; tone: Tone }> = [
    {
      label: t.billing.telegramDeliveryGate,
      value: deliveryReady ? t.billing.ready : t.billing.blocked,
      tone: deliveryReady ? 'good' : 'warning',
    },
    {
      label: t.billing.telegramUsageLinkGate,
      value: commandsReady ? t.billing.ready : t.billing.blocked,
      tone: commandsReady ? 'good' : 'warning',
    },
    {
      label: t.billing.telegramLinkedAccounts,
      value: format.integer(linkedAccountCount),
      tone: linkedAccountCount > 0 ? 'good' : 'neutral',
    },
    {
      label: t.billing.telegramDeliveryCandidates,
      value: format.integer(deliveryCandidateCount),
      tone: deliveryCandidateCount > 0 ? 'good' : 'neutral',
    },
    {
      label: t.billing.telegramAllocatedLinkedOrders,
      value: format.integer(allocatedLinkedOrderCount),
      tone: allocatedLinkedOrderCount > 0 ? 'good' : 'neutral',
    },
    {
      label: t.billing.telegramPendingAllocationOrders,
      value: format.integer(pendingAllocationCount),
      tone: pendingAllocationCount > 0 ? 'warning' : 'good',
    },
  ];

  return (
    <section className={panelClass}>
      <PanelHeading title={t.billing.telegramOperations} icon={Bot} meta={t.billing.telegramOrdersTracked(format.integer(paymentOrders.length))} />
      <div className="mt-2 grid gap-3 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.2fr)]">
        <div className="grid content-start gap-2">
          <div className="flex min-h-10 flex-wrap items-center justify-between gap-2 rounded-md border border-afro-line bg-white px-3 py-2">
            <span className="text-[13px] font-bold text-afro-muted">{t.settings.telegramBotIdentity}</span>
            <strong className="min-w-0 truncate text-sm" dir="ltr" title={botIdentity}>
              {botIdentity}
            </strong>
          </div>
          {readinessRows.map((row) => (
            <div className="flex min-h-9 items-center justify-between gap-2 rounded-md border border-afro-line px-2.5" key={row.label}>
              <span className={`${mutedTextClass} min-w-0 truncate`}>{row.label}</span>
              <StatusBadge tone={row.tone}>{row.value}</StatusBadge>
            </div>
          ))}
        </div>
        <div className="grid content-start gap-2 sm:grid-cols-2">
          {operationRows.map((row) => (
            <div className="flex min-h-12 items-center justify-between gap-2 rounded-md border border-afro-line bg-[#fbfcfc] px-3 py-2" key={row.label}>
              <span className={`${mutedTextClass} min-w-0 truncate`}>{row.label}</span>
              <StatusBadge tone={row.tone}>{row.value}</StatusBadge>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CustomerAccountsPanel({
  accounts,
  format,
  t,
}: {
  accounts: AdminCustomerAccountSummary[];
  format: DashboardFormatters;
  t: DashboardStrings;
}) {
  const visibleAccounts = accounts.slice(0, 10);
  const customerAccountColumns: Array<DataTableColumn<AdminCustomerAccountSummary>> = [
    {
      key: 'customer',
      header: t.billing.customer,
      render: (account) => (
        <>
          <strong className="block text-afro-ink">
            {account.displayName || account.telegramUsername || account.telegramId || account.id.slice(0, 8)}
          </strong>
          <span className="text-[12px] text-afro-muted">{format.time(new Date(account.updatedAt), false)}</span>
        </>
      ),
    },
    {
      key: 'clients',
      header: t.billing.clients,
      render: (account) => `${format.integer(account.activeClientCount)} / ${format.integer(account.clientCount)}`,
    },
    { key: 'usedQuota', header: t.billing.usedQuota, render: (account) => format.bytes(account.usedBytes) },
    {
      key: 'remaining',
      header: t.billing.remaining,
      render: (account) => account.remainingBytes === null || account.remainingBytes === undefined ? t.billing.unlimited : format.bytes(account.remainingBytes),
    },
    { key: 'quotaScope', header: t.billing.quotaScope, render: (account) => format.label(account.quotaScope) },
    {
      key: 'status',
      header: t.billing.status,
      render: (account) => <StatusBadge tone={billingStatusTone(account.status)}>{format.label(account.status)}</StatusBadge>,
    },
  ];

  return (
    <section className={panelClass}>
      <PanelHeading title={t.billing.customerAccounts} icon={UserRound} meta={t.billing.accountsLoaded(format.integer(accounts.length))} />
      <div className="mt-2 grid gap-2">
        {accounts.length === 0 ? <EmptyState message={t.billing.noCustomerAccounts} /> : null}
        {accounts.length > 0 ? (
          <DataTable
            columns={customerAccountColumns}
            minWidth="720px"
            rowKey={(account) => account.id}
            rows={visibleAccounts}
          />
        ) : null}
      </div>
    </section>
  );
}


function parseGbLimitInput(value: string): number | null | undefined {
  const trimmedValue = value.trim();
  if (!trimmedValue) return null;

  const numericValue = Number(trimmedValue);
  if (!Number.isFinite(numericValue) || numericValue < 0) return undefined;

  return Math.round(numericValue * 1024 ** 3);
}

function formatGbInput(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '';

  const gigabytes = value / 1024 ** 3;
  const rounded = Math.round(gigabytes * 100) / 100;

  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}
