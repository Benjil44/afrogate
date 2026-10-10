import { createResellerSalesStats, createResellerSalesTrendOption, createResellerUsageMixOption, isCompletedResellerSaleOrder, resellerCustomerName, type ResellerSalesStats } from '../reseller-charts';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Activity, Bot, Copy, CreditCard, Eye, Gauge, Gift, Inbox, Pencil, Plus, ShieldCheck, UserRound, X } from 'lucide-react';
import type { AdminBillingSettingsSummary, AdminClientConfigExportEntry, AdminCustomerAccountSummary, AdminPaymentMethodSummary, AdminPaymentOrderSummary, AdminPaymentProviderAdapterSummary, AdminResellerAccountSummary, AdminResellerGbChargeResponse, AdminResellerPackageSaleResponse, AdminResellerWalletLedgerEntry, AdminRewardedAdSettingsSummary, AdminSessionResponse, AdminTelegramBotSettingsSummary, AdminVolumePackageSummary, CustomerAccountStatus, CustomerQuotaScope, UpdateVolumePackageRequest, VolumePackageStatus } from '@afrows/shared';
import { createAdminCustomerAccount, createAdminResellerCustomerAccount, createAdminResellerPackageSale, createAdminVolumePackage, exportResellerCustomerClientConfigs, fetchAdminBillingCatalog, fetchAdminCustomerAccounts, fetchAdminPaymentOrders, fetchAdminResellerWorkspace, fetchAdminRewardedAdSettings, fetchAdminTelegramBotSettings, resetResellerCustomerAccountPassword, rotateResellerClientConfigSubscriptionToken, sendResellerCustomerConfigTelegram, updateAdminCustomerAccount, updateAdminResellerCustomerAccount, updateAdminRewardedAdSettings, updateAdminVolumePackage } from '../api/admin';
import { ConfigLinksList, hasConfigLinks } from '../components/ConfigLinksList';
import { ServerAccessSummary, effectiveServerAccess } from '../components/ServerAccessControls';
import { EChart, type AfroChartOption } from '../components/EChart';
import { GbPricePanel } from './GbPricePanel';
import { ResellerGbHero, ResellerGbSellPanel, ResellerTelegramLinkPanel, ResellerWalletTopupPanel } from './ResellerGbPanels';
import { DashboardTabs, DataStateNotice, DataTable, DetailRow, EmptyState, MetricCard, MetricPill, PanelHeading, PanelHeadingContent, PanelState, StatusBadge } from '../components/primitives';
import { SettingsInput, SettingsSelect } from '../components/settings-form';
import type { BillingTab, DashboardTabItem, DataState, DataTableColumn, MetricCardData, Tone } from '../dashboard-types';
import { normalizeNullableText, sumNullable, type DashboardFormatters } from '../formatters';
import type { DashboardStrings } from '../i18n';
import { billingStatusTone, customerAccountStatusLabel, customerQuotaScopeLabel, formatMoneyAmount, paymentAdapterStatusLabel, paymentAdapterStatusTone, paymentCheckoutModeLabel, paymentProviderLabel, paymentSettlementLabel, paymentVerificationLabel, resellerWalletEntryTypeLabel, resellerWalletSourceLabel } from '../labels';
import { telegramTestStatusLabel } from '../route-labels';
import { formLabelClass, inputClass, mutedTextClass, panelClass, primaryButtonClass } from '../ui-classes';

type CustomerAccountFormState = {
  displayName: string;
  loginEmail: string;
  telegramUsername: string;
  quotaScope: CustomerQuotaScope;
  quotaLimitGb: string;
  perClientLimitGb: string;
  status: CustomerAccountStatus;
  notes: string;
};

const customerQuotaScopeOptions: CustomerQuotaScope[] = ['account_shared', 'per_client'];
const customerAccountStatusOptions: CustomerAccountStatus[] = ['active', 'suspended', 'disabled'];

function createEmptyCustomerAccountForm(): CustomerAccountFormState {
  return {
    displayName: '',
    loginEmail: '',
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

type VolumePackageFormState = {
  currency: string;
  durationDays: string;
  name: string;
  status: VolumePackageStatus;
  totalPrice: string;
  volumeGb: string;
};

function createEmptyVolumePackageForm(defaultCurrency: string): VolumePackageFormState {
  return {
    currency: defaultCurrency,
    durationDays: '',
    name: '',
    status: 'active',
    totalPrice: '',
    volumeGb: '',
  };
}

type ResellerWorkspaceViewState = {
  accounts: AdminCustomerAccountSummary[];
  dataState: DataState;
  error: boolean;
  /** Current platform price per GB (the reseller's cost), from the workspace. */
  gbPrice: number | null;
  ledgerEntries: AdminResellerWalletLedgerEntry[];
  packages: AdminVolumePackageSummary[];
  paymentOrders: AdminPaymentOrderSummary[];
  reseller: AdminResellerAccountSummary | null;
};

type ResellerWorkspaceController = ResellerWorkspaceViewState & {
  /** Folds a saved customer-account edit (or a password reset's returned account,
   *  when the caller has one) into the workspace in place — no reordering, unlike
   *  the sale/charge folds below, so an inline table edit doesn't jump the row. */
  applyAccountUpdate: (account: AdminCustomerAccountSummary) => void;
  applyGbChargeResult: (result: AdminResellerGbChargeResponse) => void;
  applyPackageSaleResult: (result: AdminResellerPackageSaleResponse) => void;
  /** Folds an updated reseller summary (e.g. after submitting a Telegram-link request) into the workspace. */
  applyResellerUpdate: (reseller: AdminResellerAccountSummary) => void;
};


function useResellerWorkspace(sessionToken: string): ResellerWorkspaceController {
  const [state, setState] = useState<ResellerWorkspaceViewState>({
    accounts: [],
    dataState: 'loading',
    error: false,
    gbPrice: null,
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
          gbPrice: response.workspace.gbPrice ?? null,
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

  /** Fold a per-GB charge (wallet debit + customer + ledger entry) into the view. */
  const applyGbChargeResult = (result: AdminResellerGbChargeResponse) => {
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
      reseller: result.reseller,
    }));
  };

  const applyAccountUpdate = (account: AdminCustomerAccountSummary) => {
    setState((current) => ({
      ...current,
      accounts: current.accounts.map((existing) => (existing.id === account.id ? account : existing)),
    }));
  };

  const applyResellerUpdate = (reseller: AdminResellerAccountSummary) => {
    setState((current) => ({ ...current, reseller }));
  };

  return { ...state, applyAccountUpdate, applyGbChargeResult, applyPackageSaleResult, applyResellerUpdate };
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

  const gbPriceSummary = workspace.gbPrice !== null && workspace.reseller
    ? { amount: workspace.gbPrice, currency: workspace.reseller.currency }
    : null;

  return (
    <section className="mt-2 grid gap-3">
      {workspace.error ? <PanelState detail={t.billing.errors.load} kind="error" title={t.panelStates.errorTitle} /> : null}
      {workspace.dataState === 'loading' ? <PanelState detail={t.panelStates.loadingDetail} kind="loading" title={t.panelStates.loadingTitle} /> : null}
      {workspace.dataState !== 'live' && workspace.dataState !== 'loading' ? <DataStateNotice state={workspace.dataState} t={t} /> : null}

      <ResellerGbHero
        format={format}
        price={gbPriceSummary}
        priceUnavailable={workspace.dataState !== 'loading' && gbPriceSummary === null}
        reseller={workspace.reseller}
        t={t}
      />

      <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4" aria-label={t.reseller.dashboardSummary}>
        {summaryCards.map((item) => <MetricCard item={item} key={item.label} />)}
      </section>

      <section className="grid gap-3 xl:grid-cols-2">
        <ResellerGbSellPanel
          accounts={workspace.accounts}
          format={format}
          onSold={workspace.applyGbChargeResult}
          sessionToken={sessionToken}
          t={t}
        />
        <ResellerWalletTopupPanel
          currency={workspace.reseller?.currency ?? null}
          format={format}
          sessionToken={sessionToken}
          t={t}
        />
      </section>

      <section className="grid gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
        <ResellerSalesTrendPanel format={format} paymentOrders={workspace.paymentOrders} t={t} />
        <ResellerExperiencePanel accounts={workspace.accounts} format={format} stats={stats} t={t} />
      </section>

      <ResellerTelegramLinkPanel
        onUpdated={workspace.applyResellerUpdate}
        reseller={workspace.reseller}
        sessionToken={sessionToken}
        t={t}
      />

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
        onAccountUpdated={workspace.applyAccountUpdate}
        onAddUser={openResellerAddUserDialog}
        paymentOrders={workspace.paymentOrders}
        sessionToken={sessionToken}
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
          <MetricPill icon={Activity} label={t.reseller.averageSoldGb} value={format.bytes(Math.round(stats.averageSoldGb * 1e9))} />
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
        <MetricPill icon={ShieldCheck} label={t.reseller.afrowsDebited} value={formatMoneyAmount(stats.afrowsShareAmount, stats.currency, format)} />
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

/** Fields a reseller may edit on their own customer's account. Quota
 *  (`quotaLimitBytes`) is deliberately absent — the backend strips it from
 *  the reseller update path (see `stripResellerManagedQuotaFields`); a
 *  reseller can only grant volume via a wallet-debiting sale. Per-client cap
 *  stays editable, matching the existing `CustomerAccountEditorPanel` (the
 *  Billing → Customers tab), which already ships this same field set. */
type ResellerCustomerEditForm = {
  displayName: string;
  loginEmail: string;
  notes: string;
  perClientLimitGb: string;
  status: CustomerAccountStatus;
  telegramUsername: string;
};

function createEmptyResellerCustomerEditForm(): ResellerCustomerEditForm {
  return { displayName: '', loginEmail: '', notes: '', perClientLimitGb: '', status: 'active', telegramUsername: '' };
}

function resellerCustomerEditFormFromAccount(account: AdminCustomerAccountSummary): ResellerCustomerEditForm {
  return {
    displayName: account.displayName ?? '',
    loginEmail: account.loginEmail ?? '',
    notes: account.notes ?? '',
    perClientLimitGb: formatGbInput(account.perClientLimitBytes ?? null),
    status: customerAccountStatusOptions.includes(account.status as CustomerAccountStatus)
      ? account.status as CustomerAccountStatus
      : 'active',
    telegramUsername: account.telegramUsername ?? '',
  };
}

/** The seller's "my users" table — the same rich, expandable-row DataTable the
 * superadmin uses on the Customers page (usage bar, status badge, inline
 * view/edit detail panel), scoped to this reseller's own customers only (the
 * `accounts` prop already comes pre-scoped from `fetchAdminResellerWorkspace`).
 * Row actions are reseller-appropriate only: view usage/detail, edit the
 * customer, and reset their login password — no delete/restore/merge, gems,
 * device management, reseller reassignment, or egress-tier controls, all of
 * which stay admin-only on `CustomersPage`. */
function ResellerUsersTable({
  accounts,
  actionMessage,
  format,
  onAccountUpdated,
  onAddUser,
  paymentOrders,
  sessionToken,
  t,
}: {
  accounts: AdminCustomerAccountSummary[];
  actionMessage?: string | null;
  format: DashboardFormatters;
  onAccountUpdated: (account: AdminCustomerAccountSummary) => void;
  onAddUser?: () => void;
  paymentOrders: AdminPaymentOrderSummary[];
  sessionToken: string;
  t: DashboardStrings;
}) {
  const s = t.customersPage;

  // Inline detail-row expand state (chevron), and which single row (if any) is
  // mid-edit — mirrors CustomersPage's controlled-DataTable pattern so the
  // chevron always opens View mode while the row's own Edit button forces Edit.
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ResellerCustomerEditForm>(() => createEmptyResellerCustomerEditForm());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Reset-password mini-flow, scoped to the single row currently in Edit mode
  // (only one row can be edited at a time, so unkeyed state is safe here too).
  const [pwBusy, setPwBusy] = useState(false);
  const [customPw, setCustomPw] = useState('');
  const [shownPassword, setShownPassword] = useState<string | null>(null);
  const [pwCopied, setPwCopied] = useState(false);

  // VLESS QR + Send-to-Telegram: configs are fetched lazily (once) per account
  // as its row is expanded, mirroring CustomersPage's ensureRowConfigs pattern.
  const [configsByAccount, setConfigsByAccount] = useState<Record<string, AdminClientConfigExportEntry[]>>({});
  const [configsLoading, setConfigsLoading] = useState<Record<string, boolean>>({});
  const [telegramBusy, setTelegramBusy] = useState<string | null>(null);
  const [telegramResult, setTelegramResult] = useState<{ id: string; ok: boolean; text: string } | null>(null);

  const ensureConfigs = (accountId: string) => {
    if (configsByAccount[accountId] || configsLoading[accountId]) return;
    setConfigsLoading((cur) => ({ ...cur, [accountId]: true }));
    void exportResellerCustomerClientConfigs(sessionToken, accountId)
      .then((res) => setConfigsByAccount((cur) => ({ ...cur, [accountId]: res.configs })))
      .catch(() => undefined)
      .finally(() => setConfigsLoading((cur) => ({ ...cur, [accountId]: false })));
  };

  // Pushes this customer's VLESS QR + import link to their linked Telegram
  // (account-scoped, IDOR-guarded to this reseller's own customers server-side).
  const onSendTelegram = async (accountId: string) => {
    setTelegramBusy(accountId);
    setTelegramResult(null);
    try {
      const res = await sendResellerCustomerConfigTelegram(sessionToken, accountId);
      if (res.sent) {
        setTelegramResult({ id: accountId, ok: true, text: s.telegramSent });
      } else if (res.reason === 'no_telegram') {
        setTelegramResult({ id: accountId, ok: false, text: s.telegramNoLink });
      } else {
        setTelegramResult({ id: accountId, ok: false, text: s.telegramSendFailed });
      }
    } catch {
      setTelegramResult({ id: accountId, ok: false, text: s.telegramSendFailed });
    } finally {
      setTelegramBusy(null);
    }
  };

  const openEdit = (account: AdminCustomerAccountSummary) => {
    setEditId(account.id);
    setEditForm(resellerCustomerEditFormFromAccount(account));
    setSaveError(null);
    setShownPassword(null);
    setCustomPw('');
    setPwCopied(false);
    setExpandedRows((current) => ({ ...current, [account.id]: true }));
    ensureConfigs(account.id);
  };

  const closeEditToView = () => {
    setEditId(null);
    setSaveError(null);
    setShownPassword(null);
    setCustomPw('');
    setPwCopied(false);
  };

  const onToggleRow = (key: string) => {
    const willOpen = !expandedRows[key];
    // Reopening via the chevron always reverts to View, matching CustomersPage.
    if (willOpen && editId === key) setEditId(null);
    if (willOpen) ensureConfigs(key);
    setExpandedRows((current) => ({ ...current, [key]: !current[key] }));
  };

  const onSaveEdit = async (accountId: string) => {
    if (!editForm.displayName.trim()) {
      setSaveError(s.saveError);
      return;
    }
    const perClientLimitBytes = parseGbLimitInput(editForm.perClientLimitGb);
    if (perClientLimitBytes === undefined) {
      setSaveError(s.saveError);
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await updateAdminResellerCustomerAccount(sessionToken, accountId, {
        displayName: editForm.displayName.trim(),
        loginEmail: editForm.loginEmail.trim() || null,
        notes: editForm.notes.trim() || null,
        perClientLimitBytes,
        status: editForm.status,
        telegramUsername: editForm.telegramUsername.trim() || null,
      });
      onAccountUpdated(saved);
      closeEditToView();
    } catch {
      setSaveError(s.saveError);
    } finally {
      setSaving(false);
    }
  };

  const onResetPassword = async (accountId: string) => {
    setPwBusy(true);
    setSaveError(null);
    setShownPassword(null);
    try {
      const { generatedPassword } = await resetResellerCustomerAccountPassword(sessionToken, accountId, customPw.trim() || undefined);
      setShownPassword(generatedPassword);
      setCustomPw('');
      setPwCopied(false);
    } catch {
      setSaveError(s.saveError);
    } finally {
      setPwBusy(false);
    }
  };

  const copyPassword = async () => {
    if (!shownPassword) return;
    try {
      await navigator.clipboard.writeText(shownPassword);
      setPwCopied(true);
      window.setTimeout(() => setPwCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  // Rotate the subscription token of one of this seller's customer configs and
  // re-export so the panel shows the new URL + QR. Throws on failure so the
  // link list renders its own inline error.
  const onRotateSubscription = async (accountId: string, configId: string) => {
    await rotateResellerClientConfigSubscriptionToken(sessionToken, configId);
    const res = await exportResellerCustomerClientConfigs(sessionToken, accountId);
    setConfigsByAccount((cur) => ({ ...cur, [accountId]: res.configs }));
  };

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
  type SoldUserRow = (typeof soldUserRows)[number];

  const fitCol = 'w-px whitespace-nowrap';
  const soldUserColumns: Array<DataTableColumn<SoldUserRow>> = [
    {
      key: 'customer',
      header: t.billing.customer,
      className: 'min-w-[160px]',
      render: (row) => (
        <>
          <strong className="block text-afro-ink">{resellerCustomerName(row.account)}</strong>
          <span className="text-[12px] text-afro-muted">{row.account.telegramUsername ?? row.account.id.slice(0, 8)}</span>
        </>
      ),
    },
    {
      key: 'status',
      header: t.billing.status,
      className: fitCol,
      render: (row) => <StatusBadge tone={billingStatusTone(row.account.status)}>{customerAccountStatusLabel(row.account.status, t)}</StatusBadge>,
    },
    {
      key: 'usage',
      header: s.colUsed,
      alignRight: true,
      className: fitCol,
      // Same used/limit bar as the superadmin CustomersPage table — quota
      // itself stays read-only for the seller (granted only via a sale).
      render: (row) => {
        const q = row.account.quotaLimitBytes ?? null;
        const used = row.account.usedBytes;
        if (q == null || q <= 0) {
          return <span className="whitespace-nowrap text-afro-ink tabular-nums">{format.bytes(used)} · ∞</span>;
        }
        const pct = Math.min(100, Math.round((used / q) * 100));
        const over = used >= q;
        const near = pct >= 80;
        const barColor = over ? 'bg-red-500' : near ? 'bg-amber-500' : 'bg-afro-teal';
        return (
          <div className="ms-auto flex w-fit min-w-28 flex-col items-end gap-1">
            <span className={`whitespace-nowrap tabular-nums ${over ? 'font-bold text-red-500' : 'text-afro-ink'}`}>
              {format.bytes(used)} / {format.bytes(q)}
            </span>
            <span className="h-1.5 w-full overflow-hidden rounded-full bg-afro-line">
              <span className={`block h-full ${barColor}`} style={{ width: `${pct}%` }} />
            </span>
          </div>
        );
      },
    },
    {
      key: 'clients',
      header: t.billing.clients,
      alignRight: true,
      className: fitCol,
      render: (row) => (
        <span className="whitespace-nowrap tabular-nums">{`${format.integer(row.account.activeClientCount)} / ${format.integer(row.account.clientCount)}`}</span>
      ),
    },
    {
      // Read-only for the seller: which servers the admin enabled for this
      // customer. Editing stays on the superadmin Customers page.
      key: 'servers',
      header: s.colServers,
      className: fitCol,
      render: (row) => <ServerAccessSummary t={t} value={effectiveServerAccess(row.account.serverAccess)} />,
    },
    {
      key: 'soldVolume',
      header: t.reseller.soldVolume,
      alignRight: true,
      className: fitCol,
      render: (row) => <span className="whitespace-nowrap tabular-nums">{format.bytes(row.soldBytes)}</span>,
    },
    {
      key: 'orders',
      header: t.reseller.orders,
      alignRight: true,
      className: fitCol,
      render: (row) => <span className="whitespace-nowrap tabular-nums">{format.integer(row.orderCount)}</span>,
    },
    {
      key: 'lastSale',
      header: t.reseller.lastSale,
      className: fitCol,
      render: (row) => row.latestSale ? <span className="whitespace-nowrap">{format.dateTime(new Date(row.latestSale))}</span> : <span className="text-afro-muted">—</span>,
    },
  ];

  const renderView = (row: SoldUserRow) => {
    const a = row.account;
    const used = a.usedBytes;
    const limit = a.quotaLimitBytes ?? null;
    const hasLimit = limit != null && limit > 0;
    const pct = hasLimit ? Math.min(100, Math.round((used / limit) * 100)) : null;
    const over = hasLimit && used >= limit;
    const near = pct != null && pct >= 80;
    const barColor = over ? 'bg-red-500' : near ? 'bg-amber-500' : 'bg-afro-teal';

    return (
      <div className="grid gap-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => openEdit(a)}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-afro-line bg-white px-3 text-sm font-bold text-afro-ink hover:border-afro-teal hover:text-afro-teal md:min-h-9"
          >
            <Pencil size={15} />
            {s.editAction}
          </button>
        </div>
        {(() => {
          const configs = configsByAccount[a.id] ?? [];
          const vless = configs.find((c) => (c.protocol ?? '').toLowerCase() === 'vless' && hasConfigLinks(c));
          const busy = configsLoading[a.id];
          return (
            <div className="grid gap-2 rounded-md border border-afro-line bg-white p-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[13px] font-bold text-afro-muted">{s.configsTitle}</span>
                <button
                  type="button"
                  onClick={() => void onSendTelegram(a.id)}
                  disabled={telegramBusy === a.id}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-afro-line bg-white px-3 text-[12px] font-bold text-afro-ink hover:border-afro-teal hover:text-afro-teal disabled:opacity-60"
                >
                  {telegramBusy === a.id ? s.sendingToTelegram : s.sendToTelegram}
                </button>
              </div>
              {telegramResult && telegramResult.id === a.id ? (
                <p className={`text-[12px] font-bold ${telegramResult.ok ? 'text-afro-teal' : 'text-[#b91c1c]'}`} role="status">
                  {telegramResult.text}
                </p>
              ) : null}
              {vless ? (
                <ConfigLinksList
                  config={vless}
                  t={t}
                  onRotateSubscription={() => onRotateSubscription(a.id, vless.id)}
                />
              ) : busy ? (
                <span className="text-[12px] text-afro-muted">{t.dataStatus.loading}</span>
              ) : (
                <span className="text-[12px] text-afro-muted">{s.noConfigs}</span>
              )}
            </div>
          );
        })()}
        <div className="grid gap-1.5 sm:grid-cols-2">
          {a.loginEmail ? <DetailRow label={s.colEmail}>{a.loginEmail}</DetailRow> : null}
          {a.phone ? <DetailRow label={s.colPhone}><span dir="ltr">{a.phone}</span></DetailRow> : null}
          {a.expiresAt ? <DetailRow label={s.colExpiry}>{format.time(new Date(a.expiresAt), false)}</DetailRow> : null}
          {a.tags && a.tags.length > 0 ? <DetailRow label={s.colTags}>{a.tags.join(', ')}</DetailRow> : null}
          <DetailRow label={s.colServers}>
            <ServerAccessSummary t={t} value={effectiveServerAccess(a.serverAccess)} />
          </DetailRow>
          <DetailRow label={t.reseller.soldVolume}>{format.bytes(row.soldBytes)}</DetailRow>
          <DetailRow label={t.reseller.orders}>{format.integer(row.orderCount)}</DetailRow>
          {row.latestSale ? <DetailRow label={t.reseller.lastSale}>{format.dateTime(new Date(row.latestSale))}</DetailRow> : null}
        </div>
        <div className="grid gap-1.5 rounded-md border border-afro-line bg-white p-2.5">
          <span className="text-[13px] font-bold text-afro-muted">{s.usageSection}</span>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
            <span className="text-afro-muted">
              {s.colUsed}: <strong className={`tabular-nums ${over ? 'text-red-600' : 'text-afro-ink'}`}>{format.bytes(used)}</strong>
            </span>
            <span className="text-afro-muted">
              {s.usageLimitLabel}:{' '}
              <strong className="tabular-nums text-afro-ink">{hasLimit ? format.bytes(limit) : s.usageNoLimit}</strong>
            </span>
            {pct != null ? (
              <span className="text-afro-muted">
                <strong className={`tabular-nums ${over ? 'text-red-600' : near ? 'text-[#9a5b00]' : 'text-afro-ink'}`}>
                  {format.percent(pct)}
                </strong>
              </span>
            ) : null}
            {over ? (
              <span className="inline-flex whitespace-nowrap rounded-full border border-red-300 bg-red-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-600">
                {s.overQuota}
              </span>
            ) : null}
          </div>
          {pct != null ? (
            <span aria-hidden className="h-1.5 w-full overflow-hidden rounded-full bg-afro-line">
              <span className={`block h-full ${barColor}`} style={{ width: `${pct}%` }} />
            </span>
          ) : null}
          {over ? <span className="text-[12px] font-bold text-red-600">{s.usageOverHint}</span> : null}
        </div>
      </div>
    );
  };

  const renderEdit = (a: AdminCustomerAccountSummary) => (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-afro-ink">{s.editTitle}</h3>
        <button
          type="button"
          onClick={closeEditToView}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-afro-line bg-white px-3 text-sm font-bold text-afro-ink hover:border-afro-teal hover:text-afro-teal"
        >
          <Eye size={15} />
          {s.viewAction}
        </button>
      </div>
      <div className="grid gap-2.5 rounded-md border border-afro-line bg-white p-2.5 sm:grid-cols-2">
        <label className="grid gap-1.5">
          <span className={formLabelClass}>{s.fldName}</span>
          <input className={inputClass} onChange={(event) => setEditForm((current) => ({ ...current, displayName: event.target.value }))} value={editForm.displayName} />
        </label>
        <label className="grid gap-1.5">
          <span className={formLabelClass}>{s.fldEmail}</span>
          <input className={inputClass} dir="ltr" onChange={(event) => setEditForm((current) => ({ ...current, loginEmail: event.target.value }))} value={editForm.loginEmail} />
        </label>
        <label className="grid gap-1.5">
          <span className={formLabelClass}>{s.fldTelegram}</span>
          <input className={inputClass} dir="ltr" onChange={(event) => setEditForm((current) => ({ ...current, telegramUsername: event.target.value }))} value={editForm.telegramUsername} />
        </label>
        <label className="grid gap-1.5">
          <span className={formLabelClass}>{t.billing.perClientLimitGb}</span>
          <input className={inputClass} dir="ltr" inputMode="numeric" onChange={(event) => setEditForm((current) => ({ ...current, perClientLimitGb: event.target.value }))} value={editForm.perClientLimitGb} />
        </label>
        <label className="grid gap-1.5">
          <span className={formLabelClass}>{t.billing.status}</span>
          <select className={inputClass} onChange={(event) => setEditForm((current) => ({ ...current, status: event.target.value as CustomerAccountStatus }))} value={editForm.status}>
            {customerAccountStatusOptions.map((status) => (
              <option key={status} value={status}>{customerAccountStatusLabel(status, t)}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 sm:col-span-2">
          <span className={formLabelClass}>{s.fldNotes}</span>
          <input className={inputClass} onChange={(event) => setEditForm((current) => ({ ...current, notes: event.target.value }))} value={editForm.notes} />
        </label>
      </div>

      <section className="grid gap-1.5 rounded-md border border-afro-line bg-white p-2.5">
        <h4 className="text-[11px] font-bold uppercase tracking-wide text-afro-muted">{s.fldLoginPassword}</h4>
        {shownPassword ? (
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={shownPassword}
              dir="ltr"
              className="min-w-0 flex-1 truncate rounded-md border border-afro-line bg-afro-page px-2 py-1 font-mono text-[13px] outline-none"
            />
            <button
              type="button"
              onClick={() => void copyPassword()}
              className="inline-flex h-9 items-center gap-1 rounded-md border border-afro-line px-2 text-xs font-bold text-afro-ink hover:border-afro-teal hover:text-afro-teal"
            >
              <Copy size={13} />
              {pwCopied ? s.copied : s.copyLink}
            </button>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={customPw}
            onChange={(event) => setCustomPw(event.target.value)}
            dir="ltr"
            placeholder={s.passwordCustomPlaceholder}
            className={`${inputClass} min-w-[200px] flex-1`}
          />
          <button
            type="button"
            disabled={pwBusy}
            onClick={() => void onResetPassword(a.id)}
            className="inline-flex min-h-10 items-center gap-1 rounded-md border border-afro-line px-3 text-[12px] font-bold text-afro-ink hover:border-afro-teal hover:text-afro-teal disabled:opacity-60"
          >
            {customPw.trim() ? s.setPassword : s.generatePassword}
          </button>
        </div>
        <span className="text-[12px] text-afro-muted">
          {shownPassword ? s.passwordShownOnce : s.passwordHashedNote}
        </span>
      </section>

      {saveError ? <p className="text-[13px] font-bold text-[#b91c1c]">{saveError}</p> : null}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void onSaveEdit(a.id)}
          disabled={saving}
          className="inline-flex min-h-10 items-center rounded-md bg-afro-teal px-4 text-sm font-bold text-white disabled:opacity-60"
        >
          {s.save}
        </button>
        <button
          type="button"
          onClick={closeEditToView}
          className="inline-flex min-h-10 items-center rounded-md border border-afro-line px-4 text-sm font-bold text-afro-muted"
        >
          {s.cancel}
        </button>
      </div>
    </div>
  );

  const renderDetail = (row: SoldUserRow) => (editId === row.account.id ? renderEdit(row.account) : renderView(row));

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
          <DataTable
            columns={soldUserColumns}
            detailCollapseLabel={s.detailCollapse}
            detailExpandLabel={s.detailExpand}
            expandedRows={expandedRows}
            minWidth="760px"
            onToggleRow={onToggleRow}
            renderDetail={renderDetail}
            rowKey={(row) => row.account.id}
            rows={soldUserRows}
          />
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
    loginEmail: account.loginEmail ?? '',
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

const BILLING_TABS: BillingTab[] = ['catalog', 'customers', 'telegram', 'orders'];

export function BillingPage({
  activeTab,
  format,
  onTabChange,
  session,
  sessionToken,
  t,
}: {
  /** Canonical `?tab=` search param from the router (null falls back to catalog). */
  activeTab: string | null;
  format: DashboardFormatters;
  onTabChange: (tab: string) => void;
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
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [customerMessage, setCustomerMessage] = useState<string | null>(null);
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);
  const [resellerSaleForm, setResellerSaleForm] = useState<ResellerPackageSaleFormState>(() => createEmptyResellerPackageSaleForm());
  const [resellerSaleMessage, setResellerSaleMessage] = useState<string | null>(null);
  const [isSellingResellerPackage, setIsSellingResellerPackage] = useState(false);
  // Tab lives in the URL (?tab=) so refresh + deep links keep the section.
  const activeBillingTab: BillingTab = BILLING_TABS.includes(activeTab as BillingTab) ? (activeTab as BillingTab) : 'catalog';
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
        // Decimal MB (1 MB = 1e6 bytes) — quota credits are decimal end-to-end.
        rewardBytes: Math.round(rewardMbValue * 1e6),
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

  const handleVolumePackageSaved = (pkg: AdminVolumePackageSummary) => {
    setPackages((current) => (
      current.some((item) => item.id === pkg.id)
        ? current.map((item) => (item.id === pkg.id ? pkg : item))
        : [pkg, ...current]
    ));
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
        loginEmail: normalizeNullableText(customerForm.loginEmail),
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
      setGeneratedPassword(savedAccount.generatedPassword ?? null);
      setCustomerMessage(t.billing.customerAccountSaved);
    } catch {
      setCustomerMessage(t.billing.customerAccountSaveFailed);
    } finally {
      setIsSavingCustomer(false);
    }
  };

  const handleResetResellerCustomerPassword = async () => {
    if (!isResellerSession || !selectedCustomerAccountId) return;
    setIsSavingCustomer(true);
    setCustomerMessage(null);
    try {
      const { generatedPassword } = await resetResellerCustomerAccountPassword(sessionToken, selectedCustomerAccountId);
      setGeneratedPassword(generatedPassword);
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

  const billingTabs: Array<DashboardTabItem<BillingTab>> = [
    { id: 'catalog', label: t.tabs.billingCatalog, meta: t.billing.packagesLoaded(format.integer(packages.length)) },
    // Admins manage customers on the dedicated Customers page; resellers (no
    // Customers sidebar item) still manage them here.
    ...(isResellerSession
      ? [{ id: 'customers' as BillingTab, label: t.tabs.billingCustomers, meta: t.billing.accountsLoaded(format.integer(accounts.length)) }]
      : []),
    // Customer config import (VLESS/panel) lives with customer management, not
    // billing — removed from the billing tabs and this page.
    { id: 'telegram', label: t.tabs.billingTelegram, meta: t.billing.ordersLoaded(format.integer(paymentOrders.length)) },
    { id: 'orders', label: t.tabs.billingOrders, meta: t.billing.ordersLoaded(format.integer(paymentOrders.length)) },
  ];

  return (
    <section className="mt-0 grid gap-3">
      {error ? (
        <div className="grid gap-2">
          <PanelState detail={error} kind="error" title={t.panelStates.errorTitle} />
          <button
            className="inline-flex min-h-11 w-fit items-center rounded-md border border-afro-line bg-white px-3 text-sm font-bold text-afro-ink hover:border-afro-teal hover:text-afro-teal md:min-h-9"
            onClick={() => void loadBilling()}
            type="button"
          >
            {t.actions.retry}
          </button>
        </div>
      ) : null}
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
          onChange={onTabChange}
          tabs={billingTabs}
        />
      ) : null}

      {!isResellerSession ? (
        <div className={activeBillingTab === 'catalog' ? 'min-w-0' : 'hidden'}>
          <GbPricePanel
            canEdit={session.actor.role === 'superadmin' || session.actor.isSuperAdmin === true}
            format={format}
            sessionToken={sessionToken}
            t={t}
          />
        </div>
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
          resellerMarginBps={isResellerSession ? reseller?.sellerMarginBps ?? null : null}
          settings={settings}
          t={t}
        />
      </section>

      {!isResellerSession ? (
        // min-w-0: classless grid items keep min-width:auto, letting the table's
        // min-width blow the whole column past narrow viewports.
        <div className={activeBillingTab === 'catalog' ? 'min-w-0' : 'hidden'}>
          <VolumePackageManagerPanel
            canManageBilling={canManageBilling}
            defaultCurrency={settings?.currency ?? ''}
            format={format}
            onPackageSaved={handleVolumePackageSaved}
            packages={packages}
            sessionToken={sessionToken}
            t={t}
          />
        </div>
      ) : null}

      <section className={`grid gap-3 xl:grid-cols-[minmax(340px,0.8fr)_minmax(0,1.2fr)] ${!isResellerSession && activeBillingTab !== 'customers' ? 'hidden' : ''}`}>
        <CustomerAccountEditorPanel
          accounts={accounts}
          canManageBilling={canManageCustomerAccounts}
          customerForm={customerForm}
          customerMessage={customerMessage}
          format={format}
          generatedPassword={generatedPassword}
          isResellerSession={isResellerSession}
          isSavingCustomer={isSavingCustomer}
          onFormChange={setCustomerForm}
          onResetPassword={handleResetResellerCustomerPassword}
          onSaveCustomerAccount={handleSaveCustomerAccount}
          onSelectCustomerAccount={handleSelectCustomerAccount}
          onStartNewCustomerAccount={handleStartNewCustomerAccount}
          selectedCustomerAccountId={selectedCustomerAccountId}
          t={t}
        />
        <CustomerAccountsPanel accounts={accounts} format={format} t={t} />
      </section>
      {!isResellerSession ? (
        <div className={activeBillingTab === 'telegram' ? 'min-w-0' : 'hidden'}>
          <TelegramBotOperationsPanel
            accounts={accounts}
            canViewTelegramOperations={canViewTelegramOperations}
            format={format}
            paymentOrders={paymentOrders}
            telegramBotSettings={telegramBotSettings}
            t={t}
          />
        </div>
      ) : null}
      <div className={isResellerSession || activeBillingTab === 'orders' ? 'min-w-0' : 'hidden'}>
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
      label: t.billing.afrowsShare,
      value: `${format.integer(reseller.afrowsSharePercent)}%`,
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

function CustomerAccountEditorPanel({
  accounts,
  canManageBilling,
  customerForm,
  customerMessage,
  format,
  generatedPassword,
  isResellerSession,
  isSavingCustomer,
  onFormChange,
  onResetPassword,
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
  generatedPassword: string | null;
  isResellerSession: boolean;
  isSavingCustomer: boolean;
  onFormChange: (form: CustomerAccountFormState) => void;
  onResetPassword: () => void;
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
            label={t.billing.loginEmail}
            onChange={(loginEmail) => updateForm({ loginEmail })}
            value={customerForm.loginEmail}
          />
          {/* Resellers grant quota only via wallet-debiting sales (see the sale
              panel); the backend strips quota on the reseller create/update path,
              so this field is read-only for them to avoid a silent no-op. */}
          <SettingsInput
            disabled={!canManageBilling || isResellerSession}
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

        {generatedPassword ? (
          <div className="rounded-md border border-afro-teal bg-[#eef7f6] p-3">
            <div className="text-[13px] font-bold text-afro-teal">{t.billing.passwordOnce}</div>
            <code className="mt-1 block break-all font-mono text-sm font-bold text-afro-ink">{generatedPassword}</code>
            <div className="mt-1 text-[12px] text-afro-muted">{t.billing.passwordOnceHint}</div>
          </div>
        ) : null}

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
          {isResellerSession && selectedCustomerAccountId ? (
            <button
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-afro-line bg-white px-3 text-sm font-bold text-afro-ink hover:border-afro-blue hover:text-afro-blue disabled:cursor-not-allowed disabled:opacity-45"
              disabled={!canManageBilling || isSavingCustomer}
              onClick={onResetPassword}
              type="button"
            >
              {t.billing.resetLoginPassword}
            </button>
          ) : null}
          {customerMessage ? <span className={mutedTextClass}>{customerMessage}</span> : null}
          {!canManageBilling ? <StatusBadge tone="warning">{t.billing.adminOnly}</StatusBadge> : null}
        </div>
      </form>
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
  resellerMarginBps,
  settings,
  t,
}: {
  activeMethodCount: number;
  activePackageCount: number;
  format: DashboardFormatters;
  paymentMethods: AdminPaymentMethodSummary[];
  paymentProviderAdapters: AdminPaymentProviderAdapterSummary[];
  packages: AdminVolumePackageSummary[];
  /** Seller's margin in bps when a seller is viewing; null for superadmin (no resale price to show). */
  resellerMarginBps: number | null;
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
    {
      key: 'price',
      // For a seller this column is their COST (what the wallet is debited), not
      // what they charge — labelled as such so nobody resells at cost by mistake.
      header: resellerMarginBps === null ? t.billing.price : t.billing.yourCost,
      render: (item) => `${format.integer(item.totalPrice)} ${format.label(item.currency)}`,
    },
    ...(resellerMarginBps === null
      ? []
      : [
          {
            key: 'sellFor',
            header: t.billing.sellFor,
            render: (item: AdminVolumePackageSummary) => {
              const sellPrice = item.totalPrice + Math.round((item.totalPrice * resellerMarginBps) / 10000);
              return (
                <>
                  <strong className="block text-afro-ink">{`${format.integer(sellPrice)} ${format.label(item.currency)}`}</strong>
                  <span className="text-[12px] text-afro-muted">
                    {t.billing.youKeep(format.integer(sellPrice - item.totalPrice))}
                  </span>
                </>
              );
            },
          } satisfies DataTableColumn<AdminVolumePackageSummary>,
        ]),
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

const packageActionButtonClass = 'inline-flex min-h-9 items-center justify-center gap-1 rounded-md border border-afro-line bg-white px-2.5 text-[13px] font-bold text-afro-ink hover:border-afro-blue hover:text-afro-blue disabled:cursor-not-allowed disabled:opacity-45';

/**
 * Admin CRUD for the GB bundles the Telegram bot sells (Buy Data). The backend
 * accepts whole GB (`volumeGb`) and converts to bytes itself with the decimal
 * convention (1 GB = 1,000,000,000 bytes, quota-math BYTES_PER_GB). Archiving a
 * package removes it from the bot without deleting sale history.
 */
function VolumePackageManagerPanel({
  canManageBilling,
  defaultCurrency,
  format,
  onPackageSaved,
  packages,
  sessionToken,
  t,
}: {
  canManageBilling: boolean;
  defaultCurrency: string;
  format: DashboardFormatters;
  onPackageSaved: (pkg: AdminVolumePackageSummary) => void;
  packages: AdminVolumePackageSummary[];
  sessionToken: string;
  t: DashboardStrings;
}) {
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [form, setForm] = useState<VolumePackageFormState>(() => createEmptyVolumePackageForm(defaultCurrency));
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [togglingPackageId, setTogglingPackageId] = useState<string | null>(null);
  const selectedPackage = selectedPackageId ? packages.find((item) => item.id === selectedPackageId) ?? null : null;

  // Billing settings load after mount; prefill the currency once they arrive
  // (only while the field is still empty, so an operator edit is never clobbered).
  useEffect(() => {
    if (!defaultCurrency) return;
    setForm((current) => (current.currency === '' ? { ...current, currency: defaultCurrency } : current));
  }, [defaultCurrency]);

  const updateForm = (patch: Partial<VolumePackageFormState>) => setForm((current) => ({ ...current, ...patch }));

  const mapPackageToForm = (pkg: AdminVolumePackageSummary): VolumePackageFormState => ({
    currency: pkg.currency,
    durationDays: pkg.durationDays ? String(pkg.durationDays) : '',
    name: pkg.name,
    status: pkg.status === 'archived' ? 'archived' : 'active',
    totalPrice: String(pkg.totalPrice),
    volumeGb: String(Math.round(pkg.volumeGb)),
  });

  const handleStartNewPackage = () => {
    setSelectedPackageId(null);
    setForm(createEmptyVolumePackageForm(defaultCurrency));
    setMessage(null);
  };

  const handleEditPackage = (pkg: AdminVolumePackageSummary) => {
    setSelectedPackageId(pkg.id);
    setForm(mapPackageToForm(pkg));
    setMessage(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManageBilling || isSaving) return;

    const name = form.name.trim();
    const currency = form.currency.trim();
    const volumeGb = Number(form.volumeGb);
    const totalPrice = Number(form.totalPrice);
    const durationDaysText = form.durationDays.trim();
    const durationDays = durationDaysText === '' ? null : Number(durationDaysText);
    const invalid = !name
      || !Number.isInteger(volumeGb) || volumeGb <= 0
      || !Number.isInteger(totalPrice) || totalPrice < 0
      || (durationDays !== null && (!Number.isInteger(durationDays) || durationDays <= 0));
    if (invalid) {
      setMessage(t.billing.packageValidationFailed);
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      // Blank currency: omit so the backend falls back to the billing settings currency.
      const payload: UpdateVolumePackageRequest = {
        currency: currency || undefined,
        durationDays,
        name,
        status: form.status,
        totalPrice,
        volumeGb,
      };
      const saved = selectedPackageId
        ? await updateAdminVolumePackage(sessionToken, selectedPackageId, payload)
        : await createAdminVolumePackage(sessionToken, { ...payload, name, volumeGb });
      onPackageSaved(saved);
      setSelectedPackageId(saved.id);
      setForm(mapPackageToForm(saved));
      setMessage(t.billing.packageSaved);
    } catch {
      setMessage(t.billing.packageSaveFailed);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (pkg: AdminVolumePackageSummary) => {
    if (!canManageBilling || togglingPackageId) return;

    setTogglingPackageId(pkg.id);
    setMessage(null);

    try {
      const nextStatus: VolumePackageStatus = pkg.status === 'archived' ? 'active' : 'archived';
      const saved = await updateAdminVolumePackage(sessionToken, pkg.id, { status: nextStatus });
      onPackageSaved(saved);
      if (selectedPackageId === pkg.id) setForm(mapPackageToForm(saved));
      setMessage(t.billing.packageSaved);
    } catch {
      setMessage(t.billing.packageSaveFailed);
    } finally {
      setTogglingPackageId(null);
    }
  };

  const packageStatusLabel = (status: string) =>
    status === 'archived' ? t.billing.packageStatusArchived : t.billing.packageStatusActive;
  const columns: Array<DataTableColumn<AdminVolumePackageSummary>> = [
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
    {
      key: 'status',
      header: t.billing.status,
      render: (item) => <StatusBadge tone={billingStatusTone(item.status)}>{packageStatusLabel(item.status)}</StatusBadge>,
    },
    {
      key: 'actions',
      header: t.billing.packageActions,
      render: (item) => (
        <div className="flex flex-wrap gap-1.5">
          <button
            className={packageActionButtonClass}
            disabled={!canManageBilling}
            onClick={() => handleEditPackage(item)}
            type="button"
          >
            {t.billing.editPackage}
          </button>
          <button
            className={packageActionButtonClass}
            disabled={!canManageBilling || togglingPackageId === item.id}
            onClick={() => void handleToggleStatus(item)}
            type="button"
          >
            {item.status === 'archived' ? t.billing.activatePackage : t.billing.archivePackage}
          </button>
        </div>
      ),
    },
  ];

  return (
    <section className={panelClass}>
      <PanelHeading title={t.billing.volumePackagesManager} icon={Inbox} meta={t.billing.packagesLoaded(format.integer(packages.length))} />
      <p className={`mt-1 ${mutedTextClass}`}>{t.billing.volumePackagesHint}</p>
      <form className="mt-2 grid gap-2" onSubmit={handleSubmit}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-bold text-afro-ink">
            {selectedPackage ? t.billing.editingPackage(selectedPackage.name) : t.billing.newPackage}
          </span>
          {selectedPackage ? (
            <button
              className={packageActionButtonClass}
              onClick={handleStartNewPackage}
              type="button"
            >
              <Plus size={15} />
              {t.billing.newPackage}
            </button>
          ) : null}
        </div>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          <SettingsInput disabled={!canManageBilling} label={t.billing.packageNameField} onChange={(name) => updateForm({ name })} required value={form.name} />
          <SettingsInput disabled={!canManageBilling} inputMode="numeric" label={t.billing.packageVolumeGbField} onChange={(volumeGb) => updateForm({ volumeGb })} required value={form.volumeGb} />
          <SettingsInput disabled={!canManageBilling} inputMode="numeric" label={t.billing.packageTotalPriceField} onChange={(totalPrice) => updateForm({ totalPrice })} required value={form.totalPrice} />
          <SettingsInput disabled={!canManageBilling} label={t.billing.packageCurrencyField} onChange={(currency) => updateForm({ currency })} value={form.currency} />
          <SettingsInput disabled={!canManageBilling} inputMode="numeric" label={t.billing.packageDurationDaysField} onChange={(durationDays) => updateForm({ durationDays })} value={form.durationDays} />
          <SettingsSelect
            disabled={!canManageBilling}
            label={t.billing.packageStatusField}
            onChange={(status) => updateForm({ status: status === 'archived' ? 'archived' : 'active' })}
            options={[
              { label: t.billing.packageStatusActive, value: 'active' },
              { label: t.billing.packageStatusArchived, value: 'archived' },
            ]}
            value={form.status}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className={primaryButtonClass} disabled={!canManageBilling || isSaving} type="submit">
            {isSaving ? t.billing.saving : selectedPackageId ? t.billing.updatePackage : t.billing.createPackage}
          </button>
          {message ? <span className={mutedTextClass} role="status">{message}</span> : null}
          {!canManageBilling ? <StatusBadge tone="warning">{t.billing.adminOnly}</StatusBadge> : null}
        </div>
      </form>
      <div className="mt-2">
        {packages.length === 0 ? (
          <EmptyState message={t.billing.noPackages} />
        ) : (
          <DataTable columns={columns} minWidth="680px" rowKey={(item) => item.id} rows={packages} stickyLastColumn />
        )}
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
      key: 'seller',
      header: t.billing.seller,
      render: (account) =>
        account.resellerDisplayName ? (
          <span className="inline-flex items-center rounded-md bg-[#eef2ff] px-2 py-0.5 text-[12px] font-bold text-[#4f46e5]">
            {account.resellerDisplayName}
          </span>
        ) : (
          <span className="text-[12px] text-afro-muted">{t.billing.directSale}</span>
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

  // Decimal GB (1 GB = 1e9 bytes) — matches backend quota-math BYTES_PER_GB.
  return Math.round(numericValue * 1e9);
}

function formatGbInput(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '';

  const gigabytes = value / 1e9;
  const rounded = Math.round(gigabytes * 100) / 100;

  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}
