/**
 * Pure, allowlist-based sanitizers for the protocol-apply command/SSH builder.
 * These neutralize shell metacharacters, path traversal, and injection in the
 * identifiers/paths that flow into generated commands and config file names.
 * The production apply executor remains disabled-by-default behind feature flags
 * plus superadmin; these helpers are the input-safety layer beneath it.
 */

/** Lowercased path/identifier segment containing only [a-z0-9_-]; defaults to 'main'. */
export function safePathSegment(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return normalized || 'main';
}

/** Route table name derived from a route group, always `afrows_<safe-segment>`. */
export function safeRouteTableName(routeGroup: string): string {
  return `afrows_${safePathSegment(routeGroup)}`;
}

/** Deterministic fwmark hex derived from the route group (no external input in commands). */
export function routeMarkHex(routeGroup: string): string {
  let hash = 0;
  for (const char of routeGroup) hash = (hash * 31 + char.charCodeAt(0)) & 0xffff;

  return `0x${(0xa000 | hash).toString(16)}`;
}

/** POSIX single-quote shell escaping: wraps in '...' and encodes embedded quotes. */
export function shellToken(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/** Config file name limited to [A-Za-z0-9_.:-]; strips path separators; defaults to 'main'. */
export function safeConfigFileName(value: string): string {
  const normalized = value.trim().replace(/[^a-zA-Z0-9_.:-]+/g, '-').replace(/^-+|-+$/g, '');
  return normalized || 'main';
}

/** Accepts a valid 1-32 char interface name, otherwise derives a safe `wg-afro-<id>` name. */
export function safeWireGuardInterfaceName(value: string | null | undefined, id: string): string {
  const normalized = value?.trim();
  if (normalized && /^[a-zA-Z0-9_.:-]{1,32}$/.test(normalized)) return normalized;

  return `wg-afro-${id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) || 'route'}`;
}
