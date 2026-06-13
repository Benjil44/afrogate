import { createHash } from 'node:crypto';

import { parseVlessUrl } from './outbound-vless-parser';

export interface SubscriptionUserInfo {
  upload?: number;
  download?: number;
  total?: number;
  expire?: number;
}

export interface SubscriptionMeta {
  title?: string;
  updateIntervalHours?: number;
  userInfo: SubscriptionUserInfo;
}

export interface ParsedSubscriptionConfig {
  /** Stable per-config identity within the subscription (for upsert on refresh). */
  key: string;
  name: string;
  type: 'vless-local-proxy';
  config: Record<string, unknown>;
}

export interface ParsedSubscription extends SubscriptionMeta {
  configs: ParsedSubscriptionConfig[];
  /** Lines we recognized as a link but could not import (e.g. non-VLESS). */
  skipped: number;
}

/** Decode a `profile-title: base64:...` header value (or pass through plain text). */
function decodeTitle(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  const b64 = trimmed.startsWith('base64:') ? trimmed.slice('base64:'.length) : null;
  if (b64) {
    try {
      return Buffer.from(b64, 'base64').toString('utf8').trim() || undefined;
    } catch {
      return undefined;
    }
  }
  return trimmed || undefined;
}

/** Parse the `subscription-userinfo` header: `upload=..; download=..; total=..; expire=..`. */
function parseUserInfo(raw: string | undefined): SubscriptionUserInfo {
  const info: SubscriptionUserInfo = {};
  if (!raw) return info;
  for (const part of raw.split(';')) {
    const [k, v] = part.split('=').map((s) => s.trim());
    const num = Number(v);
    if (!k || !Number.isFinite(num)) continue;
    if (k === 'upload') info.upload = num;
    else if (k === 'download') info.download = num;
    else if (k === 'total') info.total = num;
    else if (k === 'expire') info.expire = num;
  }
  return info;
}

export function parseSubscriptionMeta(headers: Record<string, string | undefined>): SubscriptionMeta {
  const lower: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(headers)) lower[k.toLowerCase()] = v;
  const interval = Number(lower['profile-update-interval']);
  return {
    title: decodeTitle(lower['profile-title']),
    updateIntervalHours: Number.isFinite(interval) && interval > 0 ? interval : undefined,
    userInfo: parseUserInfo(lower['subscription-userinfo']),
  };
}

/**
 * Turn a subscription body into importable VLESS configs. The body is either a
 * base64 blob or already-plaintext, newline-separated share links. Non-VLESS
 * links (vmess/trojan/ss/...) are counted as `skipped` (the engine is VLESS-only).
 */
export function parseSubscriptionBody(body: string): { configs: ParsedSubscriptionConfig[]; skipped: number } {
  const text = maybeBase64Decode(body);
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const configs: ParsedSubscriptionConfig[] = [];
  const seen = new Set<string>();
  let skipped = 0;

  for (const line of lines) {
    if (!line.includes('://')) continue;
    if (!line.toLowerCase().startsWith('vless://')) {
      skipped += 1;
      continue;
    }
    let parsed;
    try {
      parsed = parseVlessUrl(line);
    } catch {
      skipped += 1;
      continue;
    }
    const c = parsed.config;
    const key = createHash('sha1')
      .update(
        [c.address, c.port, c.uuid, c.network ?? 'tcp', c.security ?? 'none', c.path ?? '', c.host ?? '']
          .map((v) => String(v ?? ''))
          .join('|'),
      )
      .digest('hex')
      .slice(0, 16);
    if (seen.has(key)) continue; // de-dupe identical endpoints
    seen.add(key);
    configs.push({ key, name: parsed.name, type: 'vless-local-proxy', config: c });
  }

  return { configs, skipped };
}

export function parseSubscription(
  headers: Record<string, string | undefined>,
  body: string,
): ParsedSubscription {
  const meta = parseSubscriptionMeta(headers);
  const { configs, skipped } = parseSubscriptionBody(body);
  return { ...meta, configs, skipped };
}

/** If the whole body base64-decodes to text containing share links, use that. */
function maybeBase64Decode(body: string): string {
  const trimmed = body.trim();
  if (trimmed.includes('://')) return trimmed; // already plaintext links
  if (!/^[A-Za-z0-9+/=\s]+$/.test(trimmed)) return trimmed;
  try {
    const decoded = Buffer.from(trimmed.replace(/\s+/g, ''), 'base64').toString('utf8');
    return decoded.includes('://') ? decoded : trimmed;
  } catch {
    return trimmed;
  }
}
