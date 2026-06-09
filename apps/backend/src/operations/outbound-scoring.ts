/**
 * Pure outbound-pool scoring for the smart router (Phase 5). Ranks egress
 * outbounds by health + quality so the engine can pick the best and fail over.
 * No I/O — fed from outbound_health_checks + throughput metrics.
 */

export interface OutboundCandidate {
  id: string;
  status: string; // healthy | degraded | critical | unknown
  latencyMs: number | null;
  jitterMs: number | null;
  downMbps: number | null;
  upMbps: number | null;
}

export interface RankedOutbound extends OutboundCandidate {
  score: number;
}

function score(c: OutboundCandidate): number {
  const healthyBonus = c.status === 'healthy' ? 50 : 0;
  const down = c.downMbps ?? 0;
  const up = c.upMbps ?? 0;
  const latency = c.latencyMs ?? 999;
  const jitter = c.jitterMs ?? 0;
  return healthyBonus + down * 10 + up * 2 - latency * 0.1 - jitter * 0.2;
}

/** Ranked best-first, excluding unreachable (no latency) and critical/unknown. */
export function rankOutbounds(candidates: OutboundCandidate[]): RankedOutbound[] {
  return candidates
    .filter((c) => c.latencyMs !== null && c.status !== 'critical' && c.status !== 'unknown')
    .map((c) => ({ ...c, score: score(c) }))
    .sort((a, b) => b.score - a.score);
}

export function pickBestOutbound(candidates: OutboundCandidate[]): string | null {
  return rankOutbounds(candidates)[0]?.id ?? null;
}
