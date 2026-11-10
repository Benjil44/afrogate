/**
 * Per-customer server access (0.118.0, migration 0066): one flag per entry
 * server — Germany (de.afrows.com remote exit), Iran/"Shatel" (the afrows-in
 * inbound on the Afrows server, app.afrows.com) and the USA (us.afrows.com
 * remote exit). OFF means BOTH:
 *  - that server's link is hidden everywhere (dashboard export, Telegram,
 *    /sub/<token>, client-app subscription), and
 *  - the customer's configs are removed from that server's inbound (enforced by
 *    XrayProvisioningService), so an old copied link stops authenticating.
 *
 * Pure (no I/O, no decorators, type-only relative imports): loadable by the
 * `node --test` type-stripping runner.
 */
import {
  CUSTOMER_SERVER_KINDS,
  type ClientEntryLinkKind,
  type CustomerEntryAccess,
  type CustomerServerAccess,
  type CustomerServerKind,
} from '@afrows/shared';

/** customer_accounts column per server kind. */
export const SERVER_ACCESS_COLUMNS: Readonly<Record<CustomerServerKind, string>> = {
  germany: 'access_germany',
  iran: 'access_iran',
  usa: 'access_usa',
};

/** Narrow a link kind to one of the three gated server kinds (excludes `hexo`). */
export function isCustomerServerKind(kind: ClientEntryLinkKind): kind is CustomerServerKind {
  return (CUSTOMER_SERVER_KINDS as readonly string[]).includes(kind);
}

/** The access flags as read from SQL (`ca.access_germany AS "accessGermany"`, ...). The
 *  three base servers plus the independent `access_hexo` add-on (migration 0067). */
export interface ServerAccessColumns {
  accessGermany?: boolean | null;
  accessIran?: boolean | null;
  accessUsa?: boolean | null;
  accessHexo?: boolean | null;
}

/** SELECT-list fragment for the access flags of a customer_accounts alias (base servers + hexo). */
export function serverAccessSelectSql(alias: string): string {
  return `${alias}.access_germany AS "accessGermany", ${alias}.access_iran AS "accessIran", ${alias}.access_usa AS "accessUsa", ${alias}.access_hexo AS "accessHexo"`;
}

/**
 * Row -> base-server access. These columns are NOT NULL DEFAULT true, so only an explicit
 * `false` revokes a server; a missing value (row from a query that predates 0066) keeps the
 * pre-0.118 behaviour of "every server allowed". Hexo is NOT here — it is opt-in with the
 * opposite default (see hexoAccessFromRow / entryAccessFromRow).
 */
export function serverAccessFromRow(row: ServerAccessColumns | null | undefined): CustomerServerAccess {
  return {
    germany: row?.accessGermany !== false,
    iran: row?.accessIran !== false,
    usa: row?.accessUsa !== false,
  };
}

/**
 * Row -> Hexo entitlement. Hexo is OPT-IN (migration 0067: DEFAULT false), the OPPOSITE of
 * the three base servers: only an explicit `true` grants it, so a row that predates 0067
 * (missing accessHexo) is correctly OFF. This is the single, fail-closed source of the Hexo
 * gate used by BOTH the visibility filter and the data-plane provisioning gate.
 */
export function hexoAccessFromRow(row: ServerAccessColumns | null | undefined): boolean {
  return row?.accessHexo === true;
}

/** Row -> full entry access: the three base servers plus the independent Hexo add-on. */
export function entryAccessFromRow(row: ServerAccessColumns | null | undefined): CustomerEntryAccess {
  return { ...serverAccessFromRow(row), hexo: hexoAccessFromRow(row) };
}

/** Keep only the SERVER links (germany/iran/usa) whose server the customer may use. Order
 *  is preserved, a disallowed server is NEVER substituted (empty stays empty), and non-server
 *  kinds (`hexo`) are dropped here — they are gated by gateEntryLinks instead. */
export function filterLinksByServerAccess<T extends { kind: ClientEntryLinkKind }>(
  links: readonly T[],
  access: CustomerServerAccess,
): T[] {
  return links.filter((link) => isCustomerServerKind(link.kind) && access[link.kind] === true);
}

/**
 * Gate a full entry-link set for a customer: base-server links by their own access flag, and
 * `hexo` (per-country Hexogate) links by the dedicated `access.hexo` entitlement (0.125.0 —
 * replaces the interim germany||usa foreign-exit gate). Order preserved. This is the
 * subscription-facing filter; `filterLinksByServerAccess` remains the server-only filter.
 */
export function gateEntryLinks<T extends { kind: ClientEntryLinkKind }>(
  links: readonly T[],
  access: CustomerEntryAccess,
): T[] {
  return links.filter((link) =>
    isCustomerServerKind(link.kind) ? access[link.kind] === true : access.hexo === true,
  );
}

export function hasAnyServerAllowed(access: CustomerServerAccess): boolean {
  return CUSTOMER_SERVER_KINDS.some((kind) => access[kind]);
}

/** Apply a partial update (e.g. `{ usa: false }`) on top of the stored access. */
export function mergeServerAccess(
  current: CustomerServerAccess,
  patch: Partial<CustomerServerAccess> | null | undefined,
): CustomerServerAccess {
  const next = { ...current };
  for (const kind of CUSTOMER_SERVER_KINDS) {
    const value = patch?.[kind];
    if (typeof value === 'boolean') next[kind] = value;
  }
  return next;
}

/** Default for a new customer and for rows that predate migration 0066. */
export const ALL_SERVERS_ALLOWED: Readonly<CustomerServerAccess> = { germany: true, iran: true, usa: true };

/**
 * Why an access set may not be stored, or null when it may. Rejects all-off, and
 * (so a mis-click cannot cut a paying customer) a set whose allowed servers are
 * all unconfigured on this deployment (`configured` = which entries resolve).
 */
export function serverAccessProblem(access: CustomerServerAccess, configured: CustomerServerAccess): string | null {
  if (!hasAnyServerAllowed(access)) return 'At least one server (germany, iran, usa) must stay enabled';
  if (CUSTOMER_SERVER_KINDS.some((kind) => access[kind] && configured[kind])) return null;
  const allowed = CUSTOMER_SERVER_KINDS.filter((kind) => access[kind]).join(', ');
  const usable = CUSTOMER_SERVER_KINDS.filter((kind) => configured[kind]).join(', ') || 'none';
  return `None of the enabled servers (${allowed}) is configured on this deployment, so the customer would have no working link; enable a configured server (${usable})`;
}

/** Kinds whose flag differs between two access states. */
export function changedServerKinds(before: CustomerServerAccess, after: CustomerServerAccess): ClientEntryLinkKind[] {
  return CUSTOMER_SERVER_KINDS.filter((kind) => before[kind] !== after[kind]);
}
