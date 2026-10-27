import { BadRequestException } from '@nestjs/common';
import type { MikroTikRouterRole } from '@afrows/shared';

/**
 * Normalizes a router's role + customer link, enforcing the invariants:
 * - kind 'village' is always a transport hub (no customer).
 * - transport routers must not have a customer.
 * - gateway routers may be unassigned (null customer) until linked.
 */
export function resolveRouterRoleAndCustomer(
  role: MikroTikRouterRole,
  customerAccountId: string | null | undefined,
  kind?: string | null,
): { role: MikroTikRouterRole; customerAccountId: string | null } {
  if (kind === 'village') return { role: 'transport', customerAccountId: null };
  const cust = customerAccountId && customerAccountId.trim() ? customerAccountId.trim() : null;
  if (role === 'transport') {
    if (cust) throw new BadRequestException('A transport router cannot have a customer');
    return { role: 'transport', customerAccountId: null };
  }
  // customer_account_id is a uuid column: a malformed id would surface as a PG
  // 22P02 → 500 instead of a 400.
  if (cust && !UUID_TEXT_RE.test(cust)) throw new BadRequestException('customerAccountId must be a UUID');
  return { role: 'gateway', customerAccountId: cust };
}

const UUID_TEXT_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
