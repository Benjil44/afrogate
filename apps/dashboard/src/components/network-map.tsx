import { useEffect, useState } from 'react';
import type { AdminInboundSummary } from '@afrows/shared';
import { fetchAdminInbounds, fetchAdminNetworkOverview } from '../api/admin';
import type { DashboardStrings } from '../i18n';

// Ordered by the reconciler's auto-failover preference (free chain first); the
// paid Starlink path is gaming/VIP-only and not in the normal auto chain.
const EGRESS = [
  { tag: 'via-germany', key: 'viaGermany' as const, cost: 'free' as const, roleKey: 'roleAutoPrimary' as const, prio: 1 },
  { tag: 'proxy', key: 'proxy' as const, cost: 'free' as const, roleKey: 'roleAutoFailover' as const, prio: 2 },
  { tag: 'direct', key: 'direct' as const, cost: 'free' as const, roleKey: 'roleLastResort' as const, prio: 3 },
  { tag: 'via-village', key: 'viaVillage' as const, cost: 'paid' as const, roleKey: 'roleGamingOnly' as const, prio: null },
];

export function NetworkMap({
  sessionToken,
  t,
  onOpenExits,
  onOpenInbounds,
}: {
  sessionToken: string;
  t: DashboardStrings;
  onOpenExits: () => void;
  onOpenInbounds: () => void;
}) {
  const m = t.networkMapView;
  const [inbounds, setInbounds] = useState<AdminInboundSummary[]>([]);
  const [applied, setApplied] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [ib, ov] = await Promise.all([
          fetchAdminInbounds(sessionToken).catch(() => ({ inbounds: [] as AdminInboundSummary[], available: false })),
          fetchAdminNetworkOverview(sessionToken).catch(() => ({ appliedCatchAll: null })),
        ]);
        if (!active) return;
        setInbounds(ib.inbounds);
        setApplied(ov.appliedCatchAll);
        setUpdatedAt(new Date());
      } catch {
        /* keep last */
      }
    };
    void load();
    const timer = setInterval(() => void load(), 20000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [sessionToken]);

  const card = 'rounded-lg border border-afro-line bg-white p-3 shadow-sm';
  const dot = (on: boolean) => `inline-flex h-2 w-2 shrink-0 rounded-full ${on ? 'bg-afro-teal' : 'bg-afro-line'}`;

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[12px] font-bold text-afro-muted">
          {m.catchAll}: <span className="text-afro-ink">{applied ?? '—'}</span>
        </span>
        {updatedAt ? <span className="text-[11px] text-afro-muted">{m.asOf} {updatedAt.toLocaleTimeString()}</span> : null}
      </div>
      <div className="grid items-start gap-3 md:grid-cols-3">
        {/* Incoming */}
        <div className="grid gap-2">
          <div className="text-[11px] font-bold uppercase tracking-wide text-afro-muted">{m.incoming}</div>
          {inbounds.length === 0 ? (
            <div className={card}>—</div>
          ) : (
            inbounds.map((ib) => (
              <button
                key={ib.tag}
                type="button"
                onClick={onOpenInbounds}
                className={`${card} flex items-center justify-between gap-2 text-left hover:border-afro-teal`}
              >
                <span className="min-w-0">
                  <strong className="block truncate text-[13px] text-afro-ink">{ib.protocol.toUpperCase()} · :{ib.port}</strong>
                  <span className="block truncate text-[11px] text-afro-muted" dir="ltr">
                    {ib.network}
                    {ib.path ? ` ${ib.path}` : ''}
                  </span>
                </span>
                <span className={dot(true)} />
              </button>
            ))
          )}
        </div>
        {/* Afrows */}
        <div className="grid gap-2">
          <div className="text-[11px] font-bold uppercase tracking-wide text-afro-muted">&nbsp;</div>
          <div className={`${card} text-center`}>
            <strong className="block text-[13px] text-afro-ink">{m.server}</strong>
            <span className="block text-[11px] text-afro-muted" dir="ltr">94.74.145.199</span>
            <span className="mt-1 inline-block text-[11px] text-afro-muted">xray · wg0 → {applied ?? '—'}</span>
          </div>
        </div>
        {/* Outgoing */}
        <div className="grid gap-2">
          <div className="text-[11px] font-bold uppercase tracking-wide text-afro-muted">{m.outgoing}</div>
          {EGRESS.map((e) => {
            const isActive = applied === e.tag;
            return (
              <button
                key={e.tag}
                type="button"
                onClick={onOpenExits}
                className={`${card} flex items-center justify-between gap-2 text-left hover:border-afro-teal ${isActive ? 'border-afro-teal ring-1 ring-afro-teal/40' : ''}`}
              >
                <span className="min-w-0">
                  <strong className="block truncate text-[13px] text-afro-ink">
                    {e.prio ? <span className="text-afro-muted">{e.prio}. </span> : null}
                    {m[e.key]}
                  </strong>
                  <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span
                      className={`inline-flex rounded-full border px-1.5 font-bold ${e.cost === 'paid' ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-afro-line bg-afro-page text-afro-muted'}`}
                    >
                      {e.cost === 'paid' ? m.costPaid : m.costFree}
                    </span>
                    <span className="text-afro-muted">{m[e.roleKey]}</span>
                    <span className="text-afro-muted">· {isActive ? m.active : m.standby}</span>
                  </span>
                </span>
                <span className={dot(isActive)} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
