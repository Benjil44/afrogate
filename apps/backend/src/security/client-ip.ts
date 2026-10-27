import { isIP } from 'node:net';

export type HeaderBag = Record<string, string | string[] | undefined> | undefined;

/**
 * Resolves the client IP used as the rate-limit key.
 *
 * Without trusted proxy headers it is the TCP peer. With them (production:
 * Cloudflare → nginx → backend) it must NOT be the FIRST X-Forwarded-For entry:
 * nginx's `$proxy_add_x_forwarded_for` appends to whatever the client sent, so
 * the first entry is attacker-chosen (random value per request = unlimited
 * guesses; a spoofed carrier-NAT IP = lockout of real customers). Order:
 *   1. `cf-connecting-ip`  single value (nginx overwrites it with a trusted value,
 *                          see infra/ubuntu/nginx.conf.sample)
 *   2. `x-real-ip`         single value set by our nginx
 *   3. LAST X-Forwarded-For hop (the one our own proxy appended)
 *   4. TCP peer
 * Values that are not a literal IP address are ignored.
 */
export function resolveClientIp(headers: HeaderBag, socketAddress: string | undefined, trustProxyHeaders: boolean): string {
  if (trustProxyHeaders) {
    const cf = validIp(singleHeader(headers?.['cf-connecting-ip']));
    if (cf) return cf;

    const realIp = validIp(singleHeader(headers?.['x-real-ip']));
    if (realIp) return realIp;

    const forwardedFor = singleHeader(headers?.['x-forwarded-for']);
    const lastHop = validIp(forwardedFor?.split(',').pop());
    if (lastHop) return lastHop;
  }

  return socketAddress || 'unknown';
}

/**
 * A repeated header arrives as an array: joined with commas, so XFF keeps list
 * semantics (last hop wins) and a duplicated single-value header fails isIP.
 */
function singleHeader(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value.length ? value.join(',') : undefined;
  return value;
}

function validIp(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return isIP(trimmed) ? trimmed : undefined;
}
