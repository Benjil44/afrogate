/**
 * Collapse a source IP to a coarse "network" key so that one client whose
 * carrier IP rotates inside a single mobile pool (e.g. Irelandcell 151.238.x.x)
 * counts as ONE network, not many devices.
 *
 * Heuristic, deliberately crude: IPv4 -> /16 (first two octets), IPv6 -> /32
 * (first two hextet groups). This under-counts two genuinely different users
 * who share a carrier /16, but that false-negative is far safer for any future
 * auto-enforcement than the false-positive of throttling every mobile user.
 */
export function sourceNetworkKey(ip: string): string {
  if (ip.includes(':')) {
    const groups = ip.split(':').filter((g) => g !== '');
    return groups.slice(0, 2).join(':').toLowerCase() + '::/32';
  }
  const octets = ip.split('.');
  if (octets.length === 4) return `${octets[0]}.${octets[1]}.0.0/16`;
  return ip; // unparseable -> treat as its own network
}

/** Distinct collapsed networks across a set of source IPs. */
export function countDistinctNetworks(ips: readonly string[]): number {
  return new Set(ips.map(sourceNetworkKey)).size;
}
