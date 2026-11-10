import type { CustomerEntryAccess, CustomerServerAccess, CustomerServerKind } from '@afrows/shared';
import { CUSTOMER_SERVER_KINDS } from '@afrows/shared';
import type { DashboardStrings } from '../i18n';

/** Entry-access toggles: the three base servers plus the independent, opt-in Hexo add-on. */
export type EntryAccessKind = CustomerServerKind | 'hexo';
export const ENTRY_ACCESS_KINDS: readonly EntryAccessKind[] = [...CUSTOMER_SERVER_KINDS, 'hexo'];

/** A row with no serverAccess came from an older backend: base servers on, Hexo off (opt-in). */
export const ALL_SERVERS_ON: CustomerEntryAccess = { germany: true, iran: true, usa: true, hexo: false };

/**
 * Build the 4-key entry access for a customer row: the three base servers default ON (a
 * missing serverAccess means an older backend = all on), and Hexo defaults OFF (opt-in, read
 * from the independent `accessHexo` flag).
 */
export function effectiveEntryAccess(a: {
  serverAccess?: CustomerServerAccess | null;
  accessHexo?: boolean;
}): CustomerEntryAccess {
  return { germany: true, iran: true, usa: true, ...(a.serverAccess ?? {}), hexo: a.accessHexo === true };
}

/** `iran` is the Afrows entry that works on Shatel, so the UI calls it "Shatel". */
export function entryAccessKindLabel(kind: EntryAccessKind, t: DashboardStrings): string {
  const s = t.customersPage;
  switch (kind) {
    case 'germany':
      return s.serverGermany;
    case 'iran':
      return s.serverIran;
    case 'usa':
      return s.serverUsa;
    case 'hexo':
      return s.serverHexo;
  }
}

/**
 * Labelled checkboxes (Germany / Shatel / USA / Hexo) that persist immediately via
 * `onToggle`. The three BASE servers obey the "at least one on" rule — the only base box
 * still on + configured is locked, with a title saying why — so the operator can never
 * submit an all-off set (the backend rejects it 400 anyway). HEXO is independent: it is an
 * opt-in add-on with its own flag, never counts toward (or is locked by) that rule, and is
 * only switchable when Hexo is configured on this deployment. Real `<input type="checkbox">`s
 * inside their visible labels: keyboard operable, 44px tall on phones, compact on `md+` when `dense`.
 */
export function ServerAccessControls({
  configured,
  dense = false,
  disabled = false,
  onToggle,
  t,
  value,
}: {
  /** Servers + Hexo set up on this deployment (from the list response); missing base = all. */
  configured?: CustomerEntryAccess;
  /** Row-cell sizing: 44px tap target on phones, 32px rows on desktop. */
  dense?: boolean;
  disabled?: boolean;
  onToggle: (kind: EntryAccessKind) => void;
  t: DashboardStrings;
  value: CustomerEntryAccess;
}) {
  const s = t.customersPage;
  // Base servers default to configured when unknown (old backend); Hexo defaults to NOT
  // configured when unknown, so its toggle stays locked until the backend reports it.
  const isConfigured = (kind: EntryAccessKind) => (kind === 'hexo' ? configured?.hexo ?? false : configured?.[kind] ?? true);
  // The backend refuses a set with no WORKING base server, so the last base box that is both
  // on and configured is locked. Hexo is excluded from this count (independent add-on).
  const onCount = CUSTOMER_SERVER_KINDS.filter((kind) => value[kind] && isConfigured(kind)).length;

  return (
    <div
      aria-label={s.colServers}
      className={`flex items-center gap-x-0.5 ${dense ? 'flex-nowrap' : 'flex-wrap gap-y-1'}`}
      role="group"
      title={s.serverAccessHint}
    >
      {ENTRY_ACCESS_KINDS.map((kind) => {
        const on = value[kind];
        const lastOn = kind !== 'hexo' && on && isConfigured(kind) && onCount === 1;
        const unavailable = !on && !isConfigured(kind); // can't switch on a server/add-on that isn't set up
        const locked = disabled || lastOn || unavailable;
        return (
          <label
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-1.5 text-[12px] font-bold text-afro-muted ${
              dense ? 'min-h-11 md:min-h-8' : 'min-h-11'
            } ${locked ? 'cursor-not-allowed' : 'cursor-pointer hover:text-afro-ink'}`}
            key={kind}
            title={
              lastOn
                ? s.serverLastOnHint
                : unavailable
                  ? kind === 'hexo'
                    ? s.serverHexoNotConfiguredHint
                    : s.serverNotConfiguredHint
                  : kind === 'hexo'
                    ? s.serverHexoHint
                    : undefined
            }
          >
            <input
              checked={on}
              className="h-4 w-4 shrink-0 accent-afro-teal focus-visible:outline-2 focus-visible:outline-afro-teal disabled:opacity-50"
              disabled={locked}
              onChange={() => onToggle(kind)}
              type="checkbox"
            />
            {entryAccessKindLabel(kind, t)}
          </label>
        );
      })}
    </div>
  );
}

/** Read-only variant (e.g. the reseller's users table): one pill per base server, struck
 * through when off; the Hexo pill is shown only when the add-on is on (it is off by default,
 * so a pill for every customer would be noise). */
export function ServerAccessSummary({ t, value }: { t: DashboardStrings; value: CustomerEntryAccess }) {
  const s = t.customersPage;
  const kinds: EntryAccessKind[] = value.hexo ? [...CUSTOMER_SERVER_KINDS, 'hexo'] : [...CUSTOMER_SERVER_KINDS];
  return (
    <span aria-label={s.colServers} className="inline-flex flex-wrap items-center gap-1" role="group">
      {kinds.map((kind) => {
        const on = value[kind];
        return (
          <span
            className={`inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-bold ${
              on ? 'border-afro-line bg-afro-page text-afro-ink' : 'border-dashed border-afro-line text-afro-muted line-through'
            }`}
            key={kind}
            title={on ? s.serverOn : s.serverOff}
          >
            {entryAccessKindLabel(kind, t)}
          </span>
        );
      })}
    </span>
  );
}
