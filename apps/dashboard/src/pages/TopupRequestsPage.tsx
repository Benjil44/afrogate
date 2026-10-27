import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Receipt, XCircle } from 'lucide-react';
import type { AdminTelegramTopupRequest, TelegramTopupStatus } from '@afrows/shared';
import {
  approveTelegramTopupRequest,
  fetchTelegramTopupReceipt,
  fetchTelegramTopupRequests,
  rejectTelegramTopupRequest,
} from '../api/admin';
import { DashboardTabs, EmptyState, PanelHeading, StatusBadge } from '../components/primitives';
import { NoReceiptTile, ReceiptLightbox, ReceiptThumb, receiptStatusTone, useReceiptBlobs } from '../components/receipt-queue';
import { formatMoneyAmount } from '../labels';
import type { DashboardTabItem, Tone } from '../dashboard-types';
import type { DashboardFormatters } from '../formatters';
import type { DashboardStrings } from '../i18n';
import { mutedTextClass, panelClass } from '../ui-classes';

const POLL_MS = 30_000;
const TOAST_MS = 5_000;

type TopupFilter = TelegramTopupStatus | 'all';
type LoadState = 'loading' | 'live' | 'error';

function statusLabel(status: TelegramTopupStatus, t: DashboardStrings): string {
  switch (status) {
    case 'approved':
      return t.topupsPage.statusApproved;
    case 'rejected':
      return t.topupsPage.statusRejected;
    case 'pending':
      return t.topupsPage.statusPending;
    default:
      return t.topupsPage.statusAwaitingReceipt;
  }
}

/** Operator approval queue for card-to-card top-ups submitted through the
 * afroWS Telegram bot: each request carries the user's receipt photo (served
 * by an authenticated backend proxy) plus Approve / Reject actions. */
export function TopupRequestsPage({
  format,
  onPendingChanged,
  sessionToken,
  t,
}: {
  format: DashboardFormatters;
  /** Called after an approve/reject so the sidebar pending badge refreshes. */
  onPendingChanged?: () => void;
  sessionToken: string;
  t: DashboardStrings;
}) {
  const s = t.topupsPage;
  const [filter, setFilter] = useState<TopupFilter>('pending');
  const [requests, setRequests] = useState<AdminTelegramTopupRequest[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; tone: Tone } | null>(null);
  const [lightboxId, setLightboxId] = useState<string | null>(null);

  const fetchReceipt = useCallback((id: string) => fetchTelegramTopupReceipt(sessionToken, id), [sessionToken]);
  const { ensureReceipt, isMountedRef, pruneReceiptUrls, receiptErrors, receiptUrls } = useReceiptBlobs(fetchReceipt);

  const load = useCallback(async (activeFilter: TopupFilter) => {
    try {
      const list = await fetchTelegramTopupRequests(sessionToken, activeFilter);
      if (!isMountedRef.current) return;

      setRequests(list);
      setLoadState('live');
      pruneReceiptUrls(new Set(list.map((request) => request.id)));
    } catch {
      if (!isMountedRef.current) return;

      setLoadState((current) => (current === 'live' ? 'live' : 'error'));
    }
  }, [isMountedRef, pruneReceiptUrls, sessionToken]);

  useEffect(() => {
    let active = true;
    let timer: number | undefined;

    setLoadState('loading');
    const run = async () => {
      await load(filter);
      if (active) timer = window.setTimeout(run, POLL_MS);
    };
    void run();

    return () => {
      active = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [filter, load]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const customerName = (request: AdminTelegramTopupRequest): string =>
    request.customerDisplayName
    || (request.telegramUsername ? `@${request.telegramUsername}` : null)
    || request.telegramId
    || s.unknownCustomer;

  const amountLabel = (request: AdminTelegramTopupRequest): string | null =>
    request.amountMinor != null ? formatMoneyAmount(request.amountMinor, request.currency ?? '', format).trim() : null;

  const applyResult = (updated: AdminTelegramTopupRequest) => {
    setRequests((current) => (
      filter === 'all' || updated.status === filter
        ? current.map((item) => (item.id === updated.id ? updated : item))
        : current.filter((item) => item.id !== updated.id)
    ));
  };

  const approve = async (request: AdminTelegramTopupRequest) => {
    const amount = amountLabel(request);
    const confirmed = window.confirm(
      s.approveConfirm(customerName(request), amount ?? format.bytes(request.packageVolumeBytes ?? null)),
    );
    if (!confirmed) return;

    setBusyId(request.id);
    try {
      const updated = await approveTelegramTopupRequest(sessionToken, request.id);
      applyResult(updated);
      setToast({ text: s.approved, tone: 'good' });
      onPendingChanged?.();
      void load(filter);
    } catch {
      setToast({ text: s.approveFailed, tone: 'critical' });
    } finally {
      setBusyId(null);
    }
  };

  const openReject = (request: AdminTelegramTopupRequest) => {
    setRejectingId(request.id);
    setRejectReason('');
    setRejectError(null);
  };

  const confirmReject = async (request: AdminTelegramTopupRequest) => {
    const reason = rejectReason.trim();
    if (!reason) {
      setRejectError(s.rejectReasonRequired);
      return;
    }

    setBusyId(request.id);
    try {
      const updated = await rejectTelegramTopupRequest(sessionToken, request.id, reason);
      applyResult(updated);
      setRejectingId(null);
      setRejectReason('');
      setToast({ text: s.rejected, tone: 'good' });
      onPendingChanged?.();
      void load(filter);
    } catch {
      setToast({ text: s.rejectFailed, tone: 'critical' });
    } finally {
      setBusyId(null);
    }
  };

  const filterTabs: Array<DashboardTabItem<TopupFilter>> = [
    { id: 'pending', label: s.filterPending },
    { id: 'approved', label: s.filterApproved },
    { id: 'rejected', label: s.filterRejected },
    { id: 'all', label: s.filterAll },
  ];

  const lightboxRequest = lightboxId ? requests.find((request) => request.id === lightboxId) ?? null : null;
  const lightboxUrl = lightboxId ? receiptUrls[lightboxId] ?? null : null;

  return (
    <section className="mt-3 grid gap-3">
      <DashboardTabs activeTab={filter} ariaLabel={s.filterLabel} onChange={setFilter} tabs={filterTabs} />

      {toast ? (
        <div role="status">
          <StatusBadge tone={toast.tone}>{toast.text}</StatusBadge>
        </div>
      ) : null}

      <section className={panelClass}>
        <PanelHeading icon={Receipt} meta={s.total(format.integer(requests.length))} title={t.pageHeaders.topups.title} />

        <div className="mt-3 grid gap-2">
          {loadState === 'loading' && requests.length === 0 ? (
            <EmptyState kind="loading" message={t.panelStates.loadingTitle} detail={t.panelStates.loadingDetail} />
          ) : loadState === 'error' && requests.length === 0 ? (
            <EmptyState kind="error" message={t.panelStates.errorTitle} detail={s.loadFailed} />
          ) : requests.length === 0 ? (
            <EmptyState message={filter === 'pending' ? s.emptyPending : s.empty} />
          ) : (
            requests.map((request) => (
              <TopupRequestCard
                busy={busyId === request.id}
                format={format}
                key={request.id}
                onApprove={() => void approve(request)}
                onCancelReject={() => { setRejectingId(null); setRejectError(null); }}
                onConfirmReject={() => void confirmReject(request)}
                onOpenLightbox={() => setLightboxId(request.id)}
                onOpenReject={() => openReject(request)}
                onReceiptVisible={ensureReceipt}
                onRejectReasonChange={(value) => { setRejectReason(value); setRejectError(null); }}
                receiptFailed={Boolean(receiptErrors[request.id])}
                receiptUrl={receiptUrls[request.id] ?? null}
                rejectError={rejectingId === request.id ? rejectError : null}
                rejectReason={rejectingId === request.id ? rejectReason : ''}
                rejecting={rejectingId === request.id}
                request={request}
                t={t}
              />
            ))
          )}
        </div>
      </section>

      {lightboxRequest && lightboxUrl ? (
        <ReceiptLightbox
          alt={s.receiptAlt(lightboxRequest.reference)}
          caption={`${customerName(lightboxRequest)}${amountLabel(lightboxRequest) ? ` / ${amountLabel(lightboxRequest)}` : ''}`}
          closeLabel={s.closeReceipt}
          onClose={() => setLightboxId(null)}
          reference={lightboxRequest.reference}
          url={lightboxUrl}
        />
      ) : null}
    </section>
  );
}

function TopupRequestCard({
  busy,
  format,
  onApprove,
  onCancelReject,
  onConfirmReject,
  onOpenLightbox,
  onOpenReject,
  onReceiptVisible,
  onRejectReasonChange,
  receiptFailed,
  receiptUrl,
  rejectError,
  rejectReason,
  rejecting,
  request,
  t,
}: {
  busy: boolean;
  format: DashboardFormatters;
  onApprove: () => void;
  onCancelReject: () => void;
  onConfirmReject: () => void;
  onOpenLightbox: () => void;
  onOpenReject: () => void;
  onReceiptVisible: (id: string) => void;
  onRejectReasonChange: (value: string) => void;
  receiptFailed: boolean;
  receiptUrl: string | null;
  rejectError: string | null;
  rejectReason: string;
  rejecting: boolean;
  request: AdminTelegramTopupRequest;
  t: DashboardStrings;
}) {
  const s = t.topupsPage;
  const isPending = request.status === 'pending';
  const telegramHandle = request.telegramUsername
    ? `@${request.telegramUsername}`
    : request.telegramId ?? null;
  const packageParts = [
    request.packageLabel,
    request.packageVolumeBytes != null ? format.bytes(request.packageVolumeBytes) : null,
  ].filter(Boolean);
  const amount = request.amountMinor != null
    ? formatMoneyAmount(request.amountMinor, request.currency ?? '', format).trim()
    : null;
  const metaRows: Array<[string, string, boolean]> = [
    ...(telegramHandle ? [[s.telegramUser, telegramHandle, true] as [string, string, boolean]] : []),
    ...(packageParts.length > 0 ? [[s.package, packageParts.join(' / '), false] as [string, string, boolean]] : []),
    ...(amount ? [[s.amount, amount, false] as [string, string, boolean]] : []),
    [s.submitted, format.time(new Date(request.createdAt), false), false],
  ];

  return (
    <article className="grid min-w-0 gap-2.5 rounded-md border border-afro-line bg-white p-3">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <span className="flex min-w-0 items-baseline gap-2">
          <strong className="min-w-0 truncate text-[14px]">
            {request.customerDisplayName ?? telegramHandle ?? s.unknownCustomer}
          </strong>
          <span className={`${mutedTextClass} shrink-0`} dir="ltr">{request.reference}</span>
        </span>
        <StatusBadge tone={receiptStatusTone(request.status)}>{statusLabel(request.status, t)}</StatusBadge>
      </div>

      <div className="flex min-w-0 flex-col gap-2.5 sm:flex-row">
        {request.hasReceipt ? (
          <ReceiptThumb
            alt={s.receiptAlt(request.reference)}
            failed={receiptFailed}
            failedLabel={s.receiptFailed}
            loadingLabel={s.receiptLoading}
            onOpen={onOpenLightbox}
            onVisible={() => onReceiptVisible(request.id)}
            openLabel={s.openReceipt}
            url={receiptUrl}
          />
        ) : (
          <NoReceiptTile label={s.noReceipt} />
        )}

        <dl className="grid min-w-0 flex-1 content-start gap-x-4 gap-y-1 sm:grid-cols-2">
          {metaRows.map(([label, value, isLtr]) => (
            <div className="flex min-w-0 items-baseline justify-between gap-2 sm:justify-start" key={label}>
              <dt className={`${mutedTextClass} shrink-0`}>{label}</dt>
              <dd className="min-w-0 truncate text-[13px] font-bold" dir={isLtr ? 'ltr' : undefined} title={value}>
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {request.status !== 'pending' && (request.reviewedBy || request.reviewNote) ? (
        <p className={`${mutedTextClass} min-w-0 border-t border-afro-line pt-2`}>
          {request.reviewedBy ? `${s.reviewedBy}: ${request.reviewedBy}` : null}
          {request.reviewedBy && request.reviewedAt ? ` / ${format.time(new Date(request.reviewedAt), false)}` : null}
          {request.reviewNote ? (
            <span className="block break-words">{`${s.reviewNote}: ${request.reviewNote}`}</span>
          ) : null}
        </p>
      ) : null}

      {isPending && !rejecting ? (
        <div className="flex flex-wrap gap-2 border-t border-afro-line pt-2.5">
          <button
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md bg-afro-green px-4 text-sm font-bold text-white hover:opacity-90 disabled:cursor-wait disabled:opacity-60 sm:flex-none"
            disabled={busy}
            onClick={onApprove}
            type="button"
          >
            {busy ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
            {busy ? s.working : s.approve}
          </button>
          <button
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md border border-[#f0b7b7] bg-white px-4 text-sm font-bold text-[#b91c1c] hover:bg-[#fff1f1] disabled:cursor-wait disabled:opacity-60 sm:flex-none"
            disabled={busy}
            onClick={onOpenReject}
            type="button"
          >
            <XCircle size={16} />
            {s.reject}
          </button>
        </div>
      ) : null}

      {isPending && rejecting ? (
        <form
          className="grid gap-2 border-t border-afro-line pt-2.5"
          onSubmit={(event) => { event.preventDefault(); onConfirmReject(); }}
        >
          <label className="grid gap-1.5">
            <span className="text-[13px] font-bold text-afro-muted">{s.rejectReasonLabel}</span>
            <textarea
              autoFocus
              className="min-h-20 w-full resize-y rounded-md border border-afro-line bg-white px-3 py-2 text-sm text-afro-ink outline-none ring-afro-teal/20 focus:border-afro-teal focus:ring-4"
              onChange={(event) => onRejectReasonChange(event.target.value)}
              placeholder={s.rejectReasonPlaceholder}
              required
              value={rejectReason}
            />
          </label>
          {rejectError ? <p className="text-[13px] font-bold text-[#b91c1c]" role="alert">{rejectError}</p> : null}
          <div className="flex flex-wrap gap-2">
            <button
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md bg-[#b91c1c] px-4 text-sm font-bold text-white hover:opacity-90 disabled:cursor-wait disabled:opacity-60 sm:flex-none"
              disabled={busy}
              type="submit"
            >
              {busy ? <Loader2 className="animate-spin" size={16} /> : <XCircle size={16} />}
              {busy ? s.working : s.rejectConfirm}
            </button>
            <button
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-md border border-afro-line bg-white px-4 text-sm font-bold text-afro-ink hover:border-afro-blue hover:text-afro-blue sm:flex-none"
              disabled={busy}
              onClick={onCancelReject}
              type="button"
            >
              {s.cancel}
            </button>
          </div>
        </form>
      ) : null}
    </article>
  );
}
