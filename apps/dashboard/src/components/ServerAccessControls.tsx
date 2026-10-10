import type { ClientEntryLinkKind, CustomerServerAccess } from '@afrows/shared';
import { CUSTOMER_SERVER_KINDS } from '@afrows/shared';
import type { DashboardStrings } from '../i18n';

/** A row with no `serverAccess` came from an older backend: every server is on. */
export const ALL_SERVERS_ON: CustomerServerAccess = { germany: true, iran: true, usa: true };

export function effectiveServerAccess(value: CustomerServerAccess | null | undefined): CustomerServerAccess {
  return value ? { ...ALL_SERVERS_ON, ...value } : ALL_SERVERS_ON;
}

/** `iran` is the Afrows entry that works on Shatel, so the UI calls it "Shatel". */
export function serverKindLabel(kind: ClientEntryLinkKind, t: DashboardStrings): string {
  const s = t.customersPage;
  return kind === 'germany' ? s.serverGermany : kind === 'iran' ? s.serverIran : s.serverUsa;
}

/**
 * Three labelled checkboxes (Germany / Shatel / USA) that persist immediately
 * via `onToggle`. The only box still on is disabled, with a title saying why,
 * so the operator can never submit an all-off set (the backend rejects it with
 * a 400 anyway). Real `<input type="checkbox">`s inside their visible labels:
 * keyboard operable, 44px tall on phones, compact on `md+` when `dense`.
 */
export function ServerAccessControls({
  configured,
  dense = false,
  disabled = false,
  onToggle,
  t,
  value,
}: {
  /** Servers set up on this deployment (from the list response); missing = all. */
  configured?: CustomerServerAccess;
  /** Row-cell sizing: 44px tap target on phones, 32px rows on desktop. */
  dense?: boolean;
  disabled?: boolean;
  onToggle: (kind: ClientEntryLinkKind) => void;
  t: DashboardStrings;
  value: CustomerServerAccess;
}) {
  const s = t.customersPage;
  const isConfigured = (kind: ClientEntryLinkKind) => configured?.[kind] ?? true;
  // The backend refuses a set with no WORKING server, so the last box that is
  // both on and configured is locked (an unconfigured box can still be cleared).
  const onCount = CUSTOMER_SERVER_KINDS.filter((kind) => value[kind] && isConfigured(kind)).length;

  return (
    <div
      aria-label={s.colServers}
      className={`flex items-center gap-x-0.5 ${dense ? 'flex-nowrap' : 'flex-wrap gap-y-1'}`}
      role="group"
      title={s.serverAccessHint}
    >
      {CUSTOMER_SERVER_KINDS.map((kind) => {
        const on = value[kind];
        const lastOn = on && isConfigured(kind) && onCount === 1;
        const unavailable = !on && !isConfigured(kind); // can't switch on a server that isn't set up
        const locked = disabled || lastOn || unavailable;
        return (
          <label
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-1.5 text-[12px] font-bold text-afro-muted ${
              dense ? 'min-h-11 md:min-h-8' : 'min-h-11'
            } ${locked ? 'cursor-not-allowed' : 'cursor-pointer hover:text-afro-ink'}`}
            key={kind}
            title={lastOn ? s.serverLastOnHint : unavailable ? s.serverNotConfiguredHint : undefined}
          >
            <input
              checked={on}
              className="h-4 w-4 shrink-0 accent-afro-teal focus-visible:outline-2 focus-visible:outline-afro-teal disabled:opacity-50"
              disabled={locked}
              onChange={() => onToggle(kind)}
              type="checkbox"
            />
            {serverKindLabel(kind, t)}
          </label>
        );
      })}
    </div>
  );
}

/** Read-only variant (e.g. the reseller's users table): one pill per server,
 * struck through when that server is off for the customer. */
export function ServerAccessSummary({ t, value }: { t: DashboardStrings; value: CustomerServerAccess }) {
  const s = t.customersPage;
  return (
    <span aria-label={s.colServers} className="inline-flex flex-wrap items-center gap-1" role="group">
      {CUSTOMER_SERVER_KINDS.map((kind) => {
        const on = value[kind];
        return (
          <span
            className={`inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-bold ${
              on ? 'border-afro-line bg-afro-page text-afro-ink' : 'border-dashed border-afro-line text-afro-muted line-through'
            }`}
            key={kind}
            title={on ? s.serverOn : s.serverOff}
          >
            {serverKindLabel(kind, t)}
          </span>
        );
      })}
    </span>
  );
}
