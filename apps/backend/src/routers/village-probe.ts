/**
 * Pure helpers for VillageFailoverService (no Nest, no I/O of their own), so the
 * `node --test` runner can load them directly.
 */

/** True when a MikroTik REST error is an auth rejection (the router is up). */
export function isRouterAuthRejection(error: string | null | undefined): boolean {
  return typeof error === 'string' && /-> 40[13]\b/.test(error);
}

/** egress-health.json older than this is "unknown" (the reconciler runs every ~1 min). */
export const EGRESS_HEALTH_MAX_AGE_MS = 15 * 60 * 1000;

/**
 * Germany exit health from the egress reconciler's snapshot. Null when the file is
 * missing, unreadable or stale, so the alert falls back to the reserve wording.
 */
export async function readGermanyUp(
  read: (path: string, encoding: 'utf8') => Promise<string>,
  env: Record<string, string | undefined>,
  nowMs: number,
): Promise<boolean | null> {
  const path = env.AFROWS_EGRESS_HEALTH_PATH?.trim() || '/var/lib/afrows/egress-health.json';
  try {
    const raw = JSON.parse(await read(path, 'utf8')) as { germanyUp?: unknown; updatedAt?: unknown };
    const updated = typeof raw.updatedAt === 'string' ? Date.parse(raw.updatedAt) : NaN;
    if (!Number.isFinite(updated) || nowMs - updated > EGRESS_HEALTH_MAX_AGE_MS) return null;
    return typeof raw.germanyUp === 'boolean' ? raw.germanyUp : null;
  } catch {
    return null;
  }
}
