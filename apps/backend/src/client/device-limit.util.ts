/**
 * Parse the distinct source-IPs out of `xray api statsonlineiplist` output.
 *
 * The exact JSON shape has varied across xray versions:
 *   { "name": "...>>>online", "ips": { "1.2.3.4": 1693..., ... } }   // object keyed by IP
 *   { "name": "...>>>online", "ips": [ { "ip": "1.2.3.4", ... }, ] } // array of objects
 *   { "name": "...>>>online", "ips": [ "1.2.3.4", ... ] }            // array of strings
 *   { "name": "...>>>online" }                                       // no IPs (offline)
 *
 * We read the structured `ips` field when present, and fall back to scanning the
 * raw text for IP literals — the only other field, `name`
 * (user>>>cc_<uuid>@afrows>>>online), never contains an IP pattern, so the
 * fallback cannot pick up a false positive from it.
 */
export function parseOnlineIpList(stdout: string): string[] {
  const ips = new Set<string>();
  try {
    const d = JSON.parse(stdout) as { ips?: unknown };
    const bag = d?.ips;
    if (Array.isArray(bag)) {
      for (const e of bag) {
        if (typeof e === 'string') ips.add(e);
        else if (e && typeof e === 'object' && 'ip' in e) ips.add(String((e as { ip: unknown }).ip));
      }
    } else if (bag && typeof bag === 'object') {
      for (const k of Object.keys(bag as Record<string, unknown>)) ips.add(k);
    }
  } catch {
    /* not JSON — fall through to regex */
  }
  if (ips.size === 0) {
    const m = stdout.match(/(?:\d{1,3}\.){3}\d{1,3}|(?:[0-9a-fA-F]{1,4}:){2,7}[0-9a-fA-F]{1,4}/g);
    if (m) for (const ip of m) ips.add(ip);
  }
  return [...ips];
}
