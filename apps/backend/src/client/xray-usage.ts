/**
 * Pure parser for `xray api statsquery` output. Extracts per-client_config
 * traffic deltas (uplink+downlink) keyed by the client_config id encoded in the
 * user email (cc_<id>@afrows). No I/O.
 */

export interface UsageDelta {
  clientConfigId: string;
  bytes: number;
}

const USER_STAT = /^user>>>cc_(.+?)@afrows>>>traffic>>>(?:uplink|downlink)$/;

export function parseUserStats(json: string): UsageDelta[] {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return [];
  }
  const stat = (data as { stat?: unknown })?.stat;
  if (!Array.isArray(stat)) return [];

  const byId = new Map<string, number>();
  for (const entry of stat) {
    const name = typeof (entry as { name?: unknown })?.name === 'string' ? (entry as { name: string }).name : '';
    const match = name.match(USER_STAT);
    if (!match) continue;
    const value = Number((entry as { value?: unknown }).value ?? 0);
    if (!Number.isFinite(value) || value <= 0) continue;
    byId.set(match[1], (byId.get(match[1]) ?? 0) + value);
  }
  return [...byId.entries()].map(([clientConfigId, bytes]) => ({ clientConfigId, bytes }));
}
