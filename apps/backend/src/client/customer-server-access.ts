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
import { CUSTOMER_SERVER_KINDS, type ClientEntryLinkKind, type CustomerServerAccess } from '@afrows/shared';

/** customer_accounts column per server kind. */
export const SERVER_ACCESS_COLUMNS: Readonly<Record<ClientEntryLinkKind, string>> = {
  germany: 'access_germany',
  iran: 'access_iran',
  usa: 'access_usa',
};

/** The three flags as read from SQL (`ca.access_germany AS "accessGermany"`, ...). */
export interface ServerAccessColumns {
  accessGermany?: boolean | null;
  accessIran?: boolean | null;
  accessUsa?: boolean | null;
}

/** SELECT-list fragment for the three flags of a customer_accounts alias. */
export function serverAccessSelectSql(alias: string): string {
  return `${alias}.access_germany AS "accessGermany", ${alias}.access_iran AS "accessIran", ${alias}.access_usa AS "accessUsa"`;
}

/**
 * Row -> access. The columns are NOT NULL DEFAULT true, so only an explicit
 * `false` revokes a server; a missing value (row from a query that predates
 * 0066) keeps the pre-0.118 behaviour of "every server allowed".
 */
export function serverAccessFromRow(row: ServerAccessColumns | null | undefined): CustomerServerAccess {
  return {
    germany: row?.accessGermany !== false,
    iran: row?.accessIran !== false,
    usa: row?.accessUsa !== false,
  };
}

/** Keep only the links whose server the customer may use. Order is preserved, and a
 *  disallowed server is NEVER substituted: an empty result stays empty. */
export function filterLinksByServerAccess<T extends { kind: ClientEntryLinkKind }>(
  links: readonly T[],
  access: CustomerServerAccess,
): T[] {
  return links.filter((link) => access[link.kind] === true);
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
