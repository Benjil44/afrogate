import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, ImageOff, Loader2, Wallet, X, XCircle } from 'lucide-react';
import {
  approveResellerTopup,
  fetchResellerTopupReceipt,
  fetchResellerTopups,
  rejectResellerTopup,
  type ResellerTopupStatus,
  type ResellerWalletTopupRequestSummary,
} from '../api/reseller-pricing';
import { DashboardTabs, EmptyState, PanelHeading, StatusBadge } from '../components/primitives';
import { formatMoneyAmount } from '../labels';
import type { DashboardTabItem, Tone } from '../dashboard-types';
import type { DashboardFormatters } from '../formatters';
import type { DashboardStrings } from '../i18n';
import { mutedTextClass, panelClass } from '../ui-classes';

const POLL_MS = 30_000;
const TOAST_MS = 5_000;

type TopupFilter = ResellerTopupStatus | 'all';
type LoadState = 'loading' | 'live' | 'error';

function statusTone(status: string): Tone {
  switch (status) {
    case 'approved':
      return 'good';
    case 'rejected':
      return 'critical';
    case 'pending':
      return 'warning';
    default:
      return 'neutral';
  }
}

function statusLabel(status: string, t: DashboardStrings): string {
  switch (status) {
    case 'approved':
      return t.resellerTopupsPage.statusApproved;
    case 'rejected':
      return t.resellerTopupsPage.statusRejected;
    default:
      return t.resellerTopupsPage.statusPending;
  }
}

/** Operator approval queue for seller card-to-card wallet top-ups: each request
 * carries the seller's transfer receipt photo (authenticated blob proxy) plus
 * Approve / Reject actions. Mirrors the Telegram TopupRequestsPage. */
export function ResellerTopupRequestsPage({
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
  const s = t.resellerTopupsPage;
  const [filter, setFilter] = useState<TopupFilter>('pending');
  const [requests, setRequests] = useState<ResellerWalletTopupRequestSummary[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; tone: Tone } | null>(null);
  const [lightboxId, setLightboxId] = useState<string | null>(null);

  // Receipt blob lifecycle: id -> objectURL. The ref mirrors state so cleanup
  // can revoke every URL on unmount, and pruning revokes URLs whose request
  // left the list after a refresh (no leaked blobs).
  const [receiptUrls, setReceiptUrls] = useState<Record<string, string>>({});
  const receiptUrlsRef = useRef<Record<string, string>>({});
  const receiptLoadingRef = useRef<Set<string>>(new Set());
  const [receiptErrors, setReceiptErrors] = useState<Record<string, true>>({});
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      for (const url of Object.values(receiptUrlsRef.current)) URL.revokeObjectURL(url);
      receiptUrlsRef.current = {};
    };
  }, []);

  const pruneReceiptUrls = useCallback((keepIds: Set<string>) => {
    const removed = Object.keys(receiptUrlsRef.current).filter((id) => !keepIds.has(id));
    if (removed.length === 0) return;

    for (const id of removed) {
      URL.revokeObjectURL(receiptUrlsRef.current[id]);
      delete receiptUrlsRef.current[id];
    }
    setReceiptUrls((current) => {
      const next = { ...current };
      for (const id of removed) delete next[id];
      return next;
    });
  }, []);

  /** Lazily fetch one receipt (called when its thumbnail scrolls into view). */
  const ensureReceipt = useCallback((id: string) => {
    if (receiptUrlsRef.current[id] || receiptLoadingRef.current.has(id)) return;

    receiptLoadingRef.current.add(id);
    fetchResellerTopupReceipt(sessionToken, id)
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        if (!isMountedRef.current) {
          URL.revokeObjectURL(url);
          return;
        }
        receiptUrlsRef.current[id] = url;
        setReceiptUrls((current) => ({ ...current, [id]: url }));
      })
      .catch(() => {
        if (isMountedRef.current) setReceiptErrors((current) => ({ ...current, [id]: true }));
      })
      .finally(() => {
        receiptLoadingRef.current.delete(id);
      });
  }, [sessionToken]);

  const load = useCallback(async (activeFilter: TopupFilter) => {
    try {
      const list = await fetchResellerTopups(sessionToken, activeFilter);
      if (!isMountedRef.current) return;

      setRequests(list);
      setLoadState('live');
      pruneReceiptUrls(new Set(list.map((request) => request.id)));
    } catch {
      if (!isMountedRef.current) return;

      setLoadState((current) => (current === 'live' ? 'live' : 'error'));
    }
  }, [pruneReceiptUrls, sessionToken]);

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

  // Close the lightbox with Escape.
  useEffect(() => {
    if (!lightboxId) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLightboxId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxId]);

  const sellerName = (request: ResellerWalletTopupRequestSummary): string =>
    request.resellerDisplayName || s.unknownSeller;

  const amountLabel = (request: ResellerWalletTopupRequestSummary): string =>
    formatMoneyAmount(request.amount, request.currency ?? '', format).trim();

  const applyResult = (updated: ResellerWalletTopupRequestSummary) => {
    setRequests((current) => (
      filter === 'all' || updated.status === filter
        ? current.map((item) => (item.id === updated.id ? updated : item))
        : current.filter((item) => item.id !== updated.id)
    ));
  };

  const approve = async (request: ResellerWalletTopupRequestSummary) => {
    const confirmed = window.confirm(s.approveConfirm(sellerName(request), amountLabel(request)));
    if (!confirmed) return;

    setBusyId(request.id);
    try {
      const updated = await approveResellerTopup(sessionToken, request.id);
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

  const openReject = (request: ResellerWalletTopupRequestSummary) => {
    setRejectingId(request.id);
    setRejectReason('');
    setRejectError(null);
  };

  const confirmReject = async (request: ResellerWalletTopupRequestSummary) => {
    const reason = rejectReason.trim();
    if (!reason) {
      setRejectError(s.rejectReasonRequired);
      return;
    }

    setBusyId(request.id);
    try {
      const updated = await rejectResellerTopup(sessionToken, request.id, reason);
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
        <PanelHeading icon={Wallet} meta={s.total(format.integer(requests.length))} title={t.pageHeaders['reseller-topups'].title} />

        <div className="mt-3 grid gap-2">
          {loadState === 'loading' && requests.length === 0 ? (
            <EmptyState kind="loading" message={t.panelStates.loadingTitle} detail={t.panelStates.loadingDetail} />
          ) : loadState === 'error' && requests.length === 0 ? (
            <EmptyState kind="error" message={t.panelStates.errorTitle} detail={s.loadFailed} />
          ) : requests.length === 0 ? (
            <EmptyState message={filter === 'pending' ? s.emptyPending : s.empty} />
          ) : (
            requests.map((request) => (
              <ResellerTopupCard
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
        <div
          aria-label={s.receiptAlt(lightboxRequest.reference)}
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4"
          onClick={() => setLightboxId(null)}
          role="dialog"
        >
          <figure className="relative max-h-full max-w-3xl" onClick={(event) => event.stopPropagation()}>
            <img
              alt={s.receiptAlt(lightboxRequest.reference)}
              className="max-h-[82vh] w-auto max-w-full rounded-md border border-white/20 bg-white object-contain"
              src={lightboxUrl}
            />
            <figcaption className="mt-2 flex min-w-0 items-center justify-between gap-2 text-[13px] font-bold text-white">
              <span className="min-w-0 truncate">
                {sellerName(lightboxRequest)}
                {` / ${amountLabel(lightboxRequest)}`}
              </span>
              <span className="shrink-0 opacity-80" dir="ltr">{lightboxRequest.reference}</span>
            </figcaption>
            <button
              aria-label={s.closeReceipt}
              autoFocus
              className="absolute -top-3 -right-3 inline-flex size-11 items-center justify-center rounded-full border border-white/30 bg-afro-sidebar text-white shadow-lg hover:bg-[#1f3138]"
              onClick={() => setLightboxId(null)}
              title={s.closeReceipt}
              type="button"
            >
              <X size={18} />
            </button>
          </figure>
        </div>
      ) : null}
    </section>
  );
}

function ResellerTopupCard({
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
  request: ResellerWalletTopupRequestSummary;
  t: DashboardStrings;
}) {
  const s = t.resellerTopupsPage;
  const isPending = request.status === 'pending';
  const amount = formatMoneyAmount(request.amount, request.currency ?? '', format).trim();
  const metaRows: Array<[string, string]> = [
    [s.seller, request.resellerDisplayName || s.unknownSeller],
    [s.amount, amount],
    [s.submitted, format.time(new Date(request.createdAt), false)],
  ];

  return (
    <article className="grid min-w-0 gap-2.5 rounded-md border border-afro-line bg-white p-3">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <span className="flex min-w-0 items-baseline gap-2">
          <strong className="min-w-0 truncate text-[14px]">{request.resellerDisplayName || s.unknownSeller}</strong>
          <span className={`${mutedTextClass} shrink-0`} dir="ltr">{request.reference}</span>
        </span>
        <StatusBadge tone={statusTone(String(request.status))}>{statusLabel(String(request.status), t)}</StatusBadge>
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
          <div className="grid h-24 w-full shrink-0 place-items-center rounded-md border border-dashed border-afro-line bg-afro-page text-afro-muted sm:w-24">
            <span className="grid justify-items-center gap-1 px-1 text-center text-[11px] font-bold">
              <ImageOff size={16} />
              {s.noReceipt}
            </span>
          </div>
        )}

        <dl className="grid min-w-0 flex-1 content-start gap-x-4 gap-y-1 sm:grid-cols-2">
          {metaRows.map(([label, value]) => (
            <div className="flex min-w-0 items-baseline justify-between gap-2 sm:justify-start" key={label}>
              <dt className={`${mutedTextClass} shrink-0`}>{label}</dt>
              <dd className="min-w-0 truncate text-[13px] font-bold" title={value}>
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {request.status !== 'pending' && (request.reviewedBy || request.note) ? (
        <p className={`${mutedTextClass} min-w-0 border-t border-afro-line pt-2`}>
          {request.reviewedBy ? `${s.reviewedBy}: ${request.reviewedBy}` : null}
          {request.reviewedBy && request.reviewedAt ? ` / ${format.time(new Date(request.reviewedAt), false)}` : null}
          {request.note ? (
            <span className="block break-words">{`${s.reviewNote}: ${request.note}`}</span>
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

/** Receipt thumbnail that only fetches its blob once scrolled into view; the
 * parent owns the objectURL and revokes it on refresh/unmount. */
function ReceiptThumb({
  alt,
  failed,
  failedLabel,
  loadingLabel,
  onOpen,
  onVisible,
  openLabel,
  url,
}: {
  alt: string;
  failed: boolean;
  failedLabel: string;
  loadingLabel: string;
  onOpen: () => void;
  onVisible: () => void;
  openLabel: string;
  url: string | null;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const onVisibleRef = useRef(onVisible);
  onVisibleRef.current = onVisible;

  useEffect(() => {
    const element = ref.current;
    if (!element || url || failed) return;

    if (typeof IntersectionObserver === 'undefined') {
      onVisibleRef.current();
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        onVisibleRef.current();
        observer.disconnect();
      }
    }, { rootMargin: '200px' });
    observer.observe(element);
    return () => observer.disconnect();
  }, [failed, url]);

  return (
    <button
      aria-label={openLabel}
      className="relative block h-24 w-full shrink-0 overflow-hidden rounded-md border border-afro-line bg-afro-page text-afro-muted outline-none ring-afro-teal/20 focus-visible:border-afro-teal focus-visible:ring-4 enabled:hover:border-afro-teal sm:w-24"
      data-receipt-thumb="true"
      disabled={!url}
      onClick={onOpen}
      ref={ref}
      title={openLabel}
      type="button"
    >
      {url ? (
        <img alt={alt} className="size-full object-cover" src={url} />
      ) : (
        <span className="grid size-full place-items-center px-1 text-center text-[11px] font-bold">
          {failed ? (
            <span className="grid justify-items-center gap-1"><ImageOff size={16} />{failedLabel}</span>
          ) : (
            <span className="grid justify-items-center gap-1"><Loader2 className="animate-spin" size={16} />{loadingLabel}</span>
          )}
        </span>
      )}
    </button>
  );
}
