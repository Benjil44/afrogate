import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Coins, CreditCard, Loader2, ShieldCheck, Upload, UserRound, Wallet } from 'lucide-react';
import type { AdminCustomerAccountSummary, AdminResellerAccountSummary } from '@afrows/shared';
import {
  createResellerGbSale,
  createResellerWalletTopupRequest,
  fetchMyResellerWalletTopups,
  quoteResellerGbSale,
  type GbPriceSummary,
  type ResellerGbSaleQuote,
  type ResellerWalletTopupRequestSummary,
} from '../api/reseller-pricing';
import { EmptyState, PanelHeading, StatusBadge } from '../components/primitives';
import { formatMoneyAmount } from '../labels';
import type { AfroIcon, Tone } from '../dashboard-types';
import { normalizeNullableText, type DashboardFormatters } from '../formatters';
import type { DashboardStrings } from '../i18n';
import { formLabelClass, inputClass, mutedTextClass, panelClass } from '../ui-classes';

/** Labeled stat tile (label + bold value) — clearer than a value-only pill for
 * money amounts that would otherwise be indistinguishable. */
function LabeledStat({ icon: Icon, label, value }: { icon: AfroIcon; label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-afro-line bg-white p-3">
      <div className="flex items-center gap-1.5 text-[12px] font-bold text-afro-muted">
        <Icon className="shrink-0" size={14} />
        <span className="min-w-0 truncate">{label}</span>
      </div>
      <div className="mt-1 truncate text-[15px] font-bold text-afro-ink" dir="ltr" title={value}>{value}</div>
    </div>
  );
}

/**
 * Reseller-facing per-GB pricing surfaces (docs/reseller-per-gb-pricing-plan.md):
 * the "Today: <price> / GB" hero, the per-GB sell form (cost debited + the
 * markup the seller keeps), and the card-to-card wallet top-up request flow.
 */

function topupStatusTone(status: string): Tone {
  switch (status) {
    case 'approved':
      return 'good';
    case 'rejected':
      return 'critical';
    default:
      return 'warning';
  }
}

function topupStatusLabel(status: string, t: DashboardStrings): string {
  switch (status) {
    case 'approved':
      return t.reseller.topUpStatusApproved;
    case 'rejected':
      return t.reseller.topUpStatusRejected;
    default:
      return t.reseller.topUpStatusPending;
  }
}

/** Prominent strip: today's GB price + available credit + margin + markup/GB. */
export function ResellerGbHero({
  format,
  price,
  priceUnavailable,
  reseller,
  t,
}: {
  format: DashboardFormatters;
  /** Current platform GB price (from the reseller workspace), null while loading. */
  price: GbPriceSummary | null;
  priceUnavailable: boolean;
  reseller: AdminResellerAccountSummary | null;
  t: DashboardStrings;
}) {
  const s = t.reseller;
  const marginPercent = reseller?.sellerMarginPercent ?? null;
  const markupPerGb = price && marginPercent !== null
    ? Math.round(price.amount * (marginPercent / 100))
    : null;

  return (
    <section aria-label={s.gbPriceLabel} className={panelClass} data-reseller-gb-hero="true">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-md border border-afro-teal bg-[#eef7f6] p-3 sm:col-span-2 xl:col-span-1">
          <div className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide text-afro-teal">
            <Coins size={14} />
            {s.gbPriceLabel}
          </div>
          <div className="mt-1 text-[22px] font-bold leading-tight text-afro-ink">
            {price ? s.gbPriceToday(formatMoneyAmount(price.amount, price.currency, format)) : priceUnavailable ? s.gbPriceUnavailable : t.dataStatus.loading}
          </div>
        </div>
        <LabeledStat
          icon={CreditCard}
          label={s.availableCredit}
          value={reseller ? formatMoneyAmount(reseller.availableBalanceAmount, reseller.currency, format) : '--'}
        />
        <LabeledStat
          icon={ShieldCheck}
          label={s.yourMarginPercent}
          value={marginPercent === null ? '--' : `${format.integer(marginPercent)}%`}
        />
        <LabeledStat
          icon={UserRound}
          label={s.markupPerGb}
          value={markupPerGb === null || !price ? '--' : formatMoneyAmount(markupPerGb, price.currency, format)}
        />
      </div>
    </section>
  );
}

type GbSaleFormState = {
  customerAccountId: string;
  displayName: string;
  gb: string;
  telegramUsername: string;
};

const emptyGbSaleForm: GbSaleFormState = { customerAccountId: '', displayName: '', gb: '', telegramUsername: '' };

/** Per-GB sell form: enter GB for a customer -> cost debited + suggested sell price. */
export function ResellerGbSellPanel({
  accounts,
  format,
  onSold,
  sessionToken,
  t,
}: {
  accounts: AdminCustomerAccountSummary[];
  format: DashboardFormatters;
  /** Lets the parent fold the sale (new balance, customer, ledger entry) into its state. */
  onSold?: (result: Awaited<ReturnType<typeof createResellerGbSale>>) => void;
  sessionToken: string;
  t: DashboardStrings;
}) {
  const s = t.reseller;
  const [form, setForm] = useState<GbSaleFormState>(emptyGbSaleForm);
  const [quote, setQuote] = useState<ResellerGbSaleQuote | null>(null);
  const [isSelling, setIsSelling] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const quoteTimerRef = useRef<number | undefined>(undefined);

  const gbValue = Number(form.gb);
  const gbValid = Number.isFinite(gbValue) && gbValue > 0;

  // Debounced live quote: shows walletDebit (= cost) + suggested sell price +
  // the markup the seller keeps, straight from the backend quote endpoint.
  useEffect(() => {
    window.clearTimeout(quoteTimerRef.current);
    if (!gbValid) {
      setQuote(null);
      return;
    }

    const controller = new AbortController();
    quoteTimerRef.current = window.setTimeout(() => {
      quoteResellerGbSale(sessionToken, gbValue, controller.signal)
        .then(setQuote)
        .catch(() => setQuote(null));
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(quoteTimerRef.current);
    };
  }, [gbValid, gbValue, sessionToken]);

  const updateForm = (patch: Partial<GbSaleFormState>) => setForm((current) => ({ ...current, ...patch }));

  const handleSell = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!gbValid) return;

    const existingCustomerId = normalizeNullableText(form.customerAccountId);
    const displayName = normalizeNullableText(form.displayName);
    const telegramUsername = normalizeNullableText(form.telegramUsername);
    if (!existingCustomerId && !displayName && !telegramUsername) {
      setMessage(s.selectCustomerFirst);
      return;
    }

    setIsSelling(true);
    setMessage(null);
    try {
      const result = await createResellerGbSale(sessionToken, {
        customerAccount: existingCustomerId
          ? null
          : {
              displayName,
              quotaScope: 'account_shared',
              status: 'active',
              telegramUsername,
            },
        customerAccountId: existingCustomerId,
        gb: gbValue,
        idempotencyKey: `dashboard-reseller-gb-sale:${Date.now()}`,
        metadata: { dashboardFlow: 'reseller_gb_sale' },
      });
      onSold?.(result);
      setMessage(s.gbSaleSaved(
        format.integer(result.quote.gb),
        formatMoneyAmount(result.quote.walletDebitAmount, result.quote.currency, format),
      ));
      setForm(emptyGbSaleForm);
      setQuote(null);
    } catch {
      setMessage(s.gbSaleFailed);
    } finally {
      setIsSelling(false);
    }
  };

  return (
    <section className={panelClass} data-reseller-gb-sell="true">
      <PanelHeading icon={Coins} meta={s.sellByGbHint} title={s.sellByGb} />
      <form className="mt-2 grid gap-2" onSubmit={handleSell}>
        <div className="grid gap-2 md:grid-cols-2">
          <label className="grid gap-1.5">
            <span className={formLabelClass}>{s.gbAmount}</span>
            <input
              className={inputClass}
              dir="ltr"
              inputMode="numeric"
              min={1}
              onChange={(event) => updateForm({ gb: event.target.value })}
              required
              type="number"
              value={form.gb}
            />
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

        {quote ? (
          <div className="grid gap-2 sm:grid-cols-3" data-reseller-gb-quote="true">
            <LabeledStat icon={CreditCard} label={s.quoteCost} value={formatMoneyAmount(quote.walletDebitAmount, quote.currency, format)} />
            <LabeledStat icon={Coins} label={s.quoteSellPrice} value={formatMoneyAmount(quote.resellerSellPrice, quote.currency, format)} />
            <LabeledStat icon={ShieldCheck} label={s.quoteMarkup} value={formatMoneyAmount(quote.marginAmount, quote.currency, format)} />
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 border-t border-afro-line pt-2">
          <button
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-afro-sidebar px-4 text-sm font-bold text-white hover:bg-[#1f3138] disabled:cursor-not-allowed disabled:opacity-55"
            disabled={isSelling || !gbValid || (quote !== null && !quote.canDebit)}
            type="submit"
          >
            {isSelling ? <Loader2 className="animate-spin" size={16} /> : <Coins size={16} />}
            {isSelling ? t.billing.saving : s.sellNow}
          </button>
          {quote && !quote.canDebit ? (
            <StatusBadge tone="warning">
              {`${t.billing.resellerAvailableBalance}: ${formatMoneyAmount(quote.balanceBeforeAmount, quote.currency, format)}`}
            </StatusBadge>
          ) : null}
          {message ? <span className={mutedTextClass}>{message}</span> : null}
        </div>
      </form>
    </section>
  );
}

/** Card-to-card wallet top-up: amount + receipt photo -> pending admin approval. */
export function ResellerWalletTopupPanel({
  currency,
  format,
  sessionToken,
  t,
}: {
  currency: string | null;
  format: DashboardFormatters;
  sessionToken: string;
  t: DashboardStrings;
}) {
  const s = t.reseller;
  const [amount, setAmount] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [requests, setRequests] = useState<ResellerWalletTopupRequestSummary[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchMyResellerWalletTopups(sessionToken, controller.signal)
      .then(setRequests)
      .catch(() => undefined);
    return () => controller.abort();
  }, [sessionToken]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const amountValue = Math.round(Number(amount));
    if (!Number.isFinite(amountValue) || amountValue <= 0) return;
    if (!receiptFile) {
      setMessage(s.receiptRequired);
      return;
    }

    setIsSubmitting(true);
    setMessage(null);
    try {
      const created = await createResellerWalletTopupRequest(sessionToken, { amount: amountValue }, receiptFile);
      setRequests((current) => [created, ...current.filter((item) => item.id !== created.id)].slice(0, 10));
      setAmount('');
      setReceiptFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setMessage(s.topUpRequestSubmitted);
    } catch {
      setMessage(s.topUpRequestFailed);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className={panelClass} data-reseller-wallet-topup="true">
      <PanelHeading icon={Wallet} meta={s.topUpWalletHint} title={s.topUpWallet} />
      <form className="mt-2 grid gap-2" onSubmit={handleSubmit}>
        <div className="grid gap-2 md:grid-cols-2">
          <label className="grid gap-1.5">
            <span className={formLabelClass}>{`${s.topUpAmount}${currency ? ` (${currency})` : ''}`}</span>
            <input
              className={inputClass}
              dir="ltr"
              inputMode="numeric"
              min={1}
              onChange={(event) => setAmount(event.target.value)}
              required
              type="number"
              value={amount}
            />
          </label>
          <label className="grid gap-1.5">
            <span className={formLabelClass}>{s.receiptFile}</span>
            <input
              accept="image/*"
              className="min-h-10 w-full rounded-md border border-afro-line bg-white px-3 py-2 text-sm text-afro-ink outline-none ring-afro-teal/20 file:mr-3 file:rounded-md file:border-0 file:bg-afro-page file:px-3 file:py-1 file:text-[12px] file:font-bold file:text-afro-ink focus:border-afro-teal focus:ring-4"
              onChange={(event) => setReceiptFile(event.target.files?.[0] ?? null)}
              ref={fileInputRef}
              required
              type="file"
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-afro-line pt-2">
          <button
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-afro-sidebar px-4 text-sm font-bold text-white hover:bg-[#1f3138] disabled:cursor-not-allowed disabled:opacity-55"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
            {isSubmitting ? t.billing.saving : s.submitTopUpRequest}
          </button>
          {message ? <span className={mutedTextClass}>{message}</span> : null}
        </div>
      </form>

      <div className="mt-3 border-t border-afro-line pt-2">
        <strong className="text-[13px] text-afro-ink">{s.myTopUpRequests}</strong>
        <div className="mt-1.5 grid gap-1.5">
          {requests.length === 0 ? <EmptyState message={s.noTopUpRequests} /> : null}
          {requests.slice(0, 6).map((request) => (
            <div
              className="grid min-h-11 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-md border border-afro-line bg-white px-3 py-1.5"
              key={request.id}
            >
              <span className="min-w-0">
                <strong className="block truncate text-[13px] text-afro-ink" dir="ltr">
                  {formatMoneyAmount(request.amount, request.currency ?? '', format)}
                </strong>
                <span className="block truncate text-[12px] text-afro-muted">
                  {format.time(new Date(request.createdAt), false)}
                  {request.note ? ` / ${request.note}` : ''}
                </span>
              </span>
              <StatusBadge tone={topupStatusTone(String(request.status))}>
                {topupStatusLabel(String(request.status), t)}
              </StatusBadge>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
