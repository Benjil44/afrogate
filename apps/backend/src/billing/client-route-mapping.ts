/** Sort rank for client route health: healthy < degraded < unknown < everything else. */
export function clientRouteHealthRank(status: string): number {
  if (status === 'healthy') return 0;
  if (status === 'degraded') return 1;
  if (status === 'unknown') return 2;
  return 3;
}

/** Maps a client score profile to its protocol preference, defaulting to `balanced`. */
export function mapClientScoreProfileToProtocol(scoreProfile: string): string {
  if (['gaming', 'tcp', 'udp', 'quic', 'dns', 'wireguard'].includes(scoreProfile)) return scoreProfile;
  return 'balanced';
}

/** Maps a client score profile to its speed preference, defaulting to `balanced`. */
export function mapClientScoreProfileToSpeed(scoreProfile: string): string {
  if (scoreProfile === 'throughput') return 'highSpeed';
  if (scoreProfile === 'gaming') return 'gaming';
  return 'balanced';
}

/** Deterministic cache/assignment key for a client config's route assignment. */
export function clientRouteAssignmentKey(clientConfigId: string): string {
  return `client_config:${clientConfigId}`;
}
