const LINE = / from (\[[0-9a-fA-F:]+\]|\d+\.\d+\.\d+\.\d+):\d+ accepted .* email: cc_([0-9a-zA-Z-]+)@afrows/;
const LOCAL = new Set(['127.0.0.1', '::1']);

/**
 * Parse one xray access-log line into the source IP + owning client_config id.
 * Returns null for non-matching lines and for localhost (the WS path behind
 * nginx logs 127.0.0.1, which is not a real client device).
 */
export function parseAccessLogLine(line: string): { configId: string; ip: string } | null {
  const m = LINE.exec(line);
  if (!m) return null;
  const ip = m[1].startsWith('[') ? m[1].slice(1, -1) : m[1];
  if (LOCAL.has(ip)) return null;
  return { configId: m[2], ip };
}
