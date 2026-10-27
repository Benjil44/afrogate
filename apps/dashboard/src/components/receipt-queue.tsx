import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import { ImageOff, Loader2, X } from 'lucide-react';
import type { Tone } from '../dashboard-types';

/**
 * Shared pieces of the two receipt approval queues (Telegram customer top-ups
 * and seller wallet top-ups): receipt blob lifecycle, the lazy thumbnail, the
 * lightbox, and the status → tone mapping. Both queues render the same
 * authenticated-blob receipt flow; only the request shape differs.
 */

export function receiptStatusTone(status: string): Tone {
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

/**
 * Receipt blob lifecycle: id -> objectURL. A ref mirrors the state so cleanup
 * can revoke every URL on unmount and pruning can revoke URLs whose request
 * left the list after a refresh (no leaked blobs). `isMountedRef` is exposed so
 * the page's own loaders can skip state updates after unmount.
 */
export function useReceiptBlobs(fetchReceipt: (id: string) => Promise<Blob>): {
  ensureReceipt: (id: string) => void;
  isMountedRef: MutableRefObject<boolean>;
  pruneReceiptUrls: (keepIds: Set<string>) => void;
  receiptErrors: Record<string, true>;
  receiptUrls: Record<string, string>;
} {
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
    fetchReceipt(id)
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
  }, [fetchReceipt]);

  return { ensureReceipt, isMountedRef, pruneReceiptUrls, receiptErrors, receiptUrls };
}

/** Placeholder tile for a request that was submitted without a receipt photo. */
export function NoReceiptTile({ label }: { label: string }) {
  return (
    <div className="grid h-24 w-full shrink-0 place-items-center rounded-md border border-dashed border-afro-line bg-afro-page text-afro-muted sm:w-24">
      <span className="grid justify-items-center gap-1 px-1 text-center text-[11px] font-bold">
        <ImageOff size={16} />
        {label}
      </span>
    </div>
  );
}

/** Receipt thumbnail that only fetches its blob once scrolled into view; the
 * parent owns the objectURL and revokes it on refresh/unmount. */
export function ReceiptThumb({
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

/** Full-screen receipt viewer. Closes on backdrop tap, the close button, or Escape. */
export function ReceiptLightbox({
  alt,
  caption,
  closeLabel,
  onClose,
  reference,
  url,
}: {
  alt: string;
  caption: string;
  closeLabel: string;
  onClose: () => void;
  reference: string;
  url: string;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      aria-label={alt}
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4"
      onClick={onClose}
      role="dialog"
    >
      <figure className="relative max-h-full max-w-3xl" onClick={(event) => event.stopPropagation()}>
        <img
          alt={alt}
          className="max-h-[82vh] w-auto max-w-full rounded-md border border-white/20 bg-white object-contain"
          src={url}
        />
        <figcaption className="mt-2 flex min-w-0 items-center justify-between gap-2 text-[13px] font-bold text-white">
          <span className="min-w-0 truncate">{caption}</span>
          <span className="shrink-0 opacity-80" dir="ltr">{reference}</span>
        </figcaption>
        <button
          aria-label={closeLabel}
          autoFocus
          className="absolute -top-3 -end-3 inline-flex size-11 items-center justify-center rounded-full border border-white/30 bg-afro-sidebar text-white shadow-lg hover:bg-[#1f3138]"
          onClick={onClose}
          title={closeLabel}
          type="button"
        >
          <X size={18} />
        </button>
      </figure>
    </div>
  );
}
