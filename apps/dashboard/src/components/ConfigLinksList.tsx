import { useState } from 'react';
import { Copy, QrCode, RefreshCw } from 'lucide-react';
import type { AdminClientConfigExportEntry, ClientEntryLinkKind } from '@afrows/shared';
import type { DashboardStrings } from '../i18n';

type LinkRowKey = 'subscription' | ClientEntryLinkKind | 'legacy';

type LinkRow = {
  key: LinkRowKey;
  label: string;
  hint: string | null;
  value: string;
  qrSvg: string | null;
  qrAlt: string;
  recommended: boolean;
};

type ConfigLinksListProps = {
  config: AdminClientConfigExportEntry;
  t: DashboardStrings;
  /** Older entry link fetched separately (CustomersPage linkMap) — used only when the export carries no links. */
  fallbackUri?: string | null;
  /** Rotates the subscription token; resolve when the parent has refreshed `config` with the new URL/QR. */
  onRotateSubscription?: () => Promise<void>;
};

/** True when the export carries anything the list can show (new links, subscription, or the legacy single link). */
export function hasConfigLinks(config: AdminClientConfigExportEntry): boolean {
  return Boolean(config.subscriptionUrl || (config.entryLinks?.length ?? 0) > 0 || config.entryUri);
}

// Shared per-config link list for the admin Customers panel and the seller's
// sold-users panel: Subscription (recommended) → Germany → Shatel → USA, each with a
// truncated monospace value, Copy (with "Copied" feedback) and a QR toggle.
// QR SVGs are rendered through an <img data: URI> — never injected as HTML.
// Falls back to the single legacy entryUri/qrSvg when the backend sends no
// entryLinks / subscriptionUrl yet, so older payloads still render.
export function ConfigLinksList({ config, t, fallbackUri, onRotateSubscription }: ConfigLinksListProps) {
  const s = t.customersPage;
  const [copiedKey, setCopiedKey] = useState<LinkRowKey | null>(null);
  const [qrOpenKey, setQrOpenKey] = useState<LinkRowKey | null>(null);
  const [rotateConfirm, setRotateConfirm] = useState(false);
  const [rotateBusy, setRotateBusy] = useState(false);
  const [rotateMsg, setRotateMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const rows: LinkRow[] = [];
  if (config.subscriptionUrl) {
    rows.push({
      key: 'subscription',
      label: s.linkSubscription,
      hint: s.linkSubscriptionHint,
      value: config.subscriptionUrl,
      qrSvg: config.subscriptionQrSvg || null,
      qrAlt: s.scanSubscription,
      recommended: true,
    });
  }
  const entryText: Record<ClientEntryLinkKind, { label: string; hint: string }> = {
    germany: { label: s.linkGermany, hint: s.linkGermanyHint },
    iran: { label: s.linkShatel, hint: s.linkShatelHint },
    usa: { label: s.linkUsa, hint: s.linkUsaHint },
  };
  for (const link of config.entryLinks ?? []) {
    if (!link.uri) continue;
    const text = entryText[link.kind];
    if (!text) continue; // unknown kind from a newer backend: skip rather than mislabel
    rows.push({
      key: link.kind,
      label: text.label,
      hint: text.hint,
      value: link.uri,
      qrSvg: link.qrSvg || null,
      qrAlt: s.scanVless,
      recommended: false,
    });
  }
  if (rows.length === 0) {
    const legacy = config.entryUri || fallbackUri || null;
    if (legacy) {
      rows.push({ key: 'legacy', label: s.linkVless, hint: null, value: legacy, qrSvg: config.qrSvg || null, qrAlt: s.scanVless, recommended: false });
    }
  }
  if (rows.length === 0) return null;

  const copy = async (key: LinkRowKey, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey((cur) => (cur === key ? null : cur)), 1500);
    } catch {
      /* clipboard blocked — the value stays selectable in the field */
    }
  };

  const rotate = async () => {
    if (!onRotateSubscription) return;
    setRotateBusy(true);
    setRotateMsg(null);
    try {
      await onRotateSubscription();
      setRotateMsg({ ok: true, text: s.rotateSubscriptionDone });
      setRotateConfirm(false);
      setQrOpenKey((cur) => (cur === 'subscription' ? null : cur));
    } catch {
      setRotateMsg({ ok: false, text: s.rotateSubscriptionFailed });
    } finally {
      setRotateBusy(false);
    }
  };

  const smallButton =
    'inline-flex min-h-11 shrink-0 items-center gap-1 rounded-md border border-afro-line bg-white px-2.5 text-xs font-bold text-afro-ink hover:border-afro-teal hover:text-afro-teal focus-visible:outline-2 focus-visible:outline-afro-teal disabled:opacity-60 md:min-h-8';

  return (
    <div className="grid gap-2">
      {rows.map((row) => {
        const qrOpen = qrOpenKey === row.key;
        const qrId = `cfg-qr-${config.id}-${row.key}`;
        return (
          <div key={row.key} className="grid gap-1 rounded-md border border-afro-line bg-afro-page/60 p-2">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <strong className="text-[12px] text-afro-ink">{row.label}</strong>
              {row.recommended ? (
                <span className="rounded-sm bg-afro-teal/10 px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-afro-teal">{s.linkRecommended}</span>
              ) : null}
              {row.hint ? <span className="text-[11px] text-afro-muted">{row.hint}</span> : null}
            </div>
            <div className="flex items-center gap-1.5">
              <input
                readOnly
                value={row.value}
                dir="ltr"
                aria-label={row.label}
                onFocus={(e) => e.currentTarget.select()}
                className="min-w-[6rem] flex-1 truncate rounded-md border border-afro-line bg-white px-2 py-1.5 text-start font-mono text-[11px] text-afro-ink outline-none focus:border-afro-teal"
              />
              <button type="button" onClick={() => void copy(row.key, row.value)} className={smallButton}>
                <Copy size={13} />
                {copiedKey === row.key ? s.copied : s.copyLink}
              </button>
              {row.qrSvg ? (
                <button
                  type="button"
                  aria-expanded={qrOpen}
                  aria-controls={qrId}
                  onClick={() => setQrOpenKey((cur) => (cur === row.key ? null : row.key))}
                  className={smallButton}
                >
                  <QrCode size={13} />
                  {qrOpen ? s.hideQr : s.showQr}
                </button>
              ) : null}
            </div>
            {qrOpen && row.qrSvg ? (
              <img
                id={qrId}
                className="mx-auto h-48 w-48 rounded-md bg-white p-2"
                src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(row.qrSvg)}`}
                title={row.qrAlt}
                alt={row.qrAlt}
              />
            ) : null}
            {row.key === 'subscription' && onRotateSubscription ? (
              <div className="grid gap-1.5">
                {rotateConfirm ? (
                  <div className="grid gap-1.5 rounded-md border border-amber-300 bg-amber-50 p-2" role="alertdialog" aria-live="polite">
                    <p className="text-[12px] font-bold text-amber-800">{s.rotateSubscriptionConfirm}</p>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        disabled={rotateBusy}
                        onClick={() => void rotate()}
                        className="inline-flex min-h-11 items-center gap-1 rounded-md bg-red-600 px-3 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-60 md:min-h-8"
                      >
                        <RefreshCw size={13} />
                        {rotateBusy ? t.dataStatus.loading : s.rotateSubscriptionYes}
                      </button>
                      <button
                        type="button"
                        disabled={rotateBusy}
                        onClick={() => setRotateConfirm(false)}
                        className="inline-flex min-h-11 items-center rounded-md border border-afro-line bg-white px-3 text-xs font-bold text-afro-muted disabled:opacity-60 md:min-h-8"
                      >
                        {s.cancel}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setRotateMsg(null);
                      setRotateConfirm(true);
                    }}
                    className="inline-flex min-h-11 w-fit items-center gap-1 rounded-md border border-afro-line bg-white px-2.5 text-xs font-bold text-afro-muted hover:border-[#d23f3f] hover:text-[#d23f3f] md:min-h-8"
                  >
                    <RefreshCw size={13} />
                    {s.rotateSubscription}
                  </button>
                )}
                {rotateMsg ? (
                  <p className={`text-[12px] font-bold ${rotateMsg.ok ? 'text-afro-teal' : 'text-[#b91c1c]'}`} role="status">
                    {rotateMsg.text}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
