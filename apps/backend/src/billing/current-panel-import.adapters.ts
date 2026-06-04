import { BadRequestException } from '@nestjs/common';
import { createHash } from 'crypto';
import type {
  AdminCurrentPanelImportPreviewResponse,
  CurrentPanelImportCandidate,
  CurrentPanelImportCandidateStatus,
  CurrentPanelImportPreviewRequest,
  CurrentPanelKind,
  ProtocolKind,
} from '@afrows/shared';

const CURRENT_PANEL_IMPORT_ADAPTER_VERSION = 'current-panel-import-preview-v1';
const MAX_IMPORT_PREVIEW_ROWS = 100;
const BYTES_PER_GB = 1024 ** 3;
const MAX_SAFE_BYTES = Number.MAX_SAFE_INTEGER;

const supportedPanelKinds = new Set<CurrentPanelKind>(['marzban', 'xui', 'sanayi', 'generic']);
const supportedProtocols = new Set<ProtocolKind>(['wireguard', 'vless', 'l2tp', 'ikev2']);

const rowArrayKeys = ['users', 'items', 'results', 'clients', 'accounts', 'rows', 'inbounds', 'proxies'];
const wrapperKeys = ['data', 'obj', 'result', 'response'];
const userLabelKeys = ['username', 'email', 'name', 'displayName', 'display_name', 'remark', 'tag'];
const userIdKeys = ['externalPanelUserId', 'external_panel_user_id', 'userId', 'user_id', 'uuid', 'id', 'email', 'username'];
const configIdKeys = [
  'externalPanelConfigId',
  'external_panel_config_id',
  'configId',
  'config_id',
  'subscriptionId',
  'subscription_id',
  'subId',
  'sub_id',
  'uuid',
  'id',
  'subscription_url',
  'sub_url',
  'link',
];
const protocolKeys = ['protocol', 'type', 'proxyProtocol', 'proxy_protocol'];
const quotaKeys = [
  'quotaBytes',
  'quota_bytes',
  'quota',
  'dataLimit',
  'data_limit',
  'transfer_enable',
  'totalBytes',
  'total_bytes',
  'totalGB',
  'totalGb',
  'total',
  'limitBytes',
  'limit_bytes',
  'limit',
];
const usedKeys = [
  'usedBytes',
  'used_bytes',
  'usedTraffic',
  'used_traffic',
  'used',
  'traffic',
  'currentUsage',
  'current_usage',
];
const upKeys = ['up', 'upload', 'uplink', 'tx', 'txBytes', 'tx_bytes'];
const downKeys = ['down', 'download', 'downlink', 'rx', 'rxBytes', 'rx_bytes'];
const expireKeys = ['expiresAt', 'expires_at', 'expireAt', 'expire_at', 'expired_at', 'expiryTime', 'expiry_time', 'expire'];
const deviceLimitKeys = ['deviceLimit', 'device_limit', 'limitIp', 'limit_ip', 'ipLimit', 'ip_limit', 'maxIps', 'max_ips'];
const statusKeys = ['status', 'state', 'accountStatus', 'account_status'];
const enabledKeys = ['enabled', 'enable', 'isActive', 'is_active', 'active'];
const disabledKeys = ['disabled', 'isDisabled', 'is_disabled', 'deactivated'];

interface ExtractedPanelRow {
  index: number;
  row: Record<string, unknown>;
  parent: Record<string, unknown> | null;
  source: string;
}

interface ExtractionResult {
  rows: ExtractedPanelRow[];
  truncated: boolean;
}

export function buildCurrentPanelImportPreview(
  request: CurrentPanelImportPreviewRequest,
  generatedAt: Date = new Date(),
): AdminCurrentPanelImportPreviewResponse {
  if (request.payload === undefined || request.payload === null) {
    throw new BadRequestException('Current panel payload is required');
  }

  const warnings = new Set<string>(['read_only_preview_no_changes_applied', 'raw_panel_payload_not_persisted']);
  const panelKindResult = normalizePanelKind(request.panelKind);
  panelKindResult.warnings.forEach((warning) => warnings.add(warning));

  const sourceName = normalizeNullableString(request.sourceName);
  const defaultProtocol = normalizeProtocol(request.defaultProtocol);
  const extracted = extractPanelRows(request.payload);
  if (extracted.truncated) warnings.add('payload_row_limit_reached');

  const candidates: CurrentPanelImportCandidate[] = [];
  const rejectedRows: AdminCurrentPanelImportPreviewResponse['rejectedRows'] = [];

  for (const row of extracted.rows.slice(0, MAX_IMPORT_PREVIEW_ROWS)) {
    const normalized = normalizePanelRow(row, panelKindResult.panelKind, defaultProtocol, generatedAt);
    if (normalized.candidate) {
      candidates.push(normalized.candidate);
    } else {
      rejectedRows.push({
        index: row.index,
        reasonCodes: normalized.reasonCodes,
        rawType: row.source,
      });
    }
  }

  if (extracted.rows.length === 0 || candidates.length === 0) warnings.add('no_import_candidates_detected');
  if (rejectedRows.length > 0) warnings.add('rejected_rows_present');

  const activeCount = candidates.filter((candidate) => candidate.status === 'active').length;
  const disabledCount = candidates.filter((candidate) => candidate.status === 'disabled').length;
  const expiredCount = candidates.filter((candidate) => candidate.status === 'expired').length;
  const limitedCount = candidates.filter((candidate) => candidate.status === 'limited').length;

  return {
    panelKind: panelKindResult.panelKind,
    sourceName,
    generatedAt: generatedAt.toISOString(),
    adapterVersion: CURRENT_PANEL_IMPORT_ADAPTER_VERSION,
    candidateCount: candidates.length,
    activeCount,
    disabledCount,
    expiredCount,
    limitedCount,
    totalQuotaBytes: sumNullable(candidates.map((candidate) => candidate.quotaBytes ?? null)),
    totalUsedBytes: sumNullable(candidates.map((candidate) => candidate.usedBytes ?? null)),
    candidates,
    rejectedRows,
    warnings: Array.from(warnings).sort(),
  };
}

function extractPanelRows(payload: unknown): ExtractionResult {
  const rows: ExtractedPanelRow[] = [];
  let nextIndex = 0;
  let truncated = false;

  const pushRow = (row: Record<string, unknown>, parent: Record<string, unknown> | null, source: string) => {
    if (rows.length >= MAX_IMPORT_PREVIEW_ROWS + 1) {
      truncated = true;
      return;
    }

    rows.push({
      index: nextIndex,
      row,
      parent,
      source,
    });
    nextIndex += 1;
  };

  const visit = (value: unknown, parent: Record<string, unknown> | null, source: string, depth: number): void => {
    if (rows.length >= MAX_IMPORT_PREVIEW_ROWS + 1) {
      truncated = true;
      return;
    }
    if (depth > 5 || value === null || value === undefined) return;

    if (Array.isArray(value)) {
      for (const item of value) visit(item, parent, source, depth + 1);
      return;
    }

    const record = asRecord(value);
    if (!record) return;

    const settings = parseSettingsRecord(record.settings);
    const settingsClients = arrayFromRecord(settings, 'clients');
    if (settingsClients.length > 0) {
      const clientStats = extractClientStats(record);
      for (const client of settingsClients) {
        const clientRecord = asRecord(client);
        if (!clientRecord) continue;

        const stat = matchClientStat(clientRecord, clientStats);
        pushRow(stat ? { ...clientRecord, ...stat } : clientRecord, record, 'settings.clients');
      }
      return;
    }

    for (const key of rowArrayKeys) {
      const nested = record[key];
      if (Array.isArray(nested)) {
        visit(nested, record, key, depth + 1);
        return;
      }
    }

    for (const key of wrapperKeys) {
      const nested = record[key];
      if (nested !== undefined && nested !== null) {
        visit(nested, parent, key, depth + 1);
        return;
      }
    }

    if (looksLikePanelUserRecord(record)) {
      pushRow(record, parent, source);
    }
  };

  visit(payload, null, rawType(payload), 0);
  return { rows, truncated };
}

function normalizePanelRow(
  row: ExtractedPanelRow,
  panelKind: CurrentPanelKind,
  defaultProtocol: string,
  now: Date,
): { candidate?: CurrentPanelImportCandidate; reasonCodes: string[] } {
  const reasonCodes = new Set<string>();
  const parent = row.parent;

  const label = truncateText(
    firstText(row.row, userLabelKeys)
      ?? firstText(row.row, userIdKeys)
      ?? firstText(parent, userLabelKeys)
      ?? firstText(parent, userIdKeys),
    120,
  );
  const externalUserId = firstIdentifier(row.row, userIdKeys) ?? label;
  const parentId = firstIdentifier(parent, userIdKeys);
  const externalPanelConfigId = firstIdentifier(row.row, configIdKeys)
    ?? (parentId && externalUserId ? truncateText(`${parentId}:${externalUserId}`, 120) : null);

  if (!label || !externalUserId) {
    return {
      reasonCodes: ['missing_identity'],
    };
  }

  reasonCodes.add('identity_detected');
  if (externalPanelConfigId) reasonCodes.add('config_identity_detected');

  const quotaBytes = firstBytes(row.row, quotaKeys, true);
  const usedBytes = firstUsedBytes(row.row);
  const expiresAt = firstTimestamp(row.row, expireKeys) ?? firstTimestamp(parent, expireKeys);
  const deviceLimit = firstPositiveInteger(row.row, deviceLimitKeys);
  const protocol = normalizeProtocol(firstText(row.row, protocolKeys) ?? firstText(parent, protocolKeys) ?? defaultProtocol);
  const status = resolveCandidateStatus(row.row, parent, quotaBytes, usedBytes, expiresAt, now);
  const remainingBytes = quotaBytes === null || usedBytes === null ? null : Math.max(quotaBytes - usedBytes, 0);

  if (quotaBytes !== null) reasonCodes.add('quota_detected');
  if (usedBytes !== null) reasonCodes.add('usage_detected');
  if (expiresAt) reasonCodes.add('expiry_detected');
  if (deviceLimit !== null) reasonCodes.add('device_limit_detected');
  if (row.source === 'settings.clients') reasonCodes.add('xui_settings_client_detected');
  reasonCodes.add(`${status}_status`);

  return {
    candidate: {
      externalPanel: panelKind,
      externalPanelUserId: externalUserId,
      externalPanelConfigId,
      username: firstText(row.row, ['username', 'email', 'name']) ?? null,
      displayName: firstText(row.row, ['displayName', 'display_name', 'remark', 'tag']) ?? label,
      label,
      protocol,
      status,
      quotaBytes,
      usedBytes,
      remainingBytes,
      expiresAt,
      deviceLimit,
      reasonCodes: Array.from(reasonCodes).sort(),
    },
    reasonCodes: Array.from(reasonCodes).sort(),
  };
}

function resolveCandidateStatus(
  record: Record<string, unknown>,
  parent: Record<string, unknown> | null,
  quotaBytes: number | null,
  usedBytes: number | null,
  expiresAt: string | null,
  now: Date,
): CurrentPanelImportCandidateStatus {
  const statusText = firstText(record, statusKeys)?.toLowerCase() ?? firstText(parent, statusKeys)?.toLowerCase() ?? null;
  const enabled = firstBoolean(record, enabledKeys) ?? firstBoolean(parent, enabledKeys);
  const disabled = firstBoolean(record, disabledKeys) ?? firstBoolean(parent, disabledKeys);

  if (disabled === true || enabled === false || statusText?.match(/disabled|deactive|inactive|banned|blocked|stopped/)) {
    return 'disabled';
  }
  if (statusText?.match(/expired|expire/)) return 'expired';
  if (expiresAt && Date.parse(expiresAt) <= now.getTime()) return 'expired';
  if (statusText?.match(/limited|quota|exhausted|traffic/)) return 'limited';
  if (quotaBytes !== null && usedBytes !== null && quotaBytes > 0 && usedBytes >= quotaBytes) return 'limited';
  if (enabled === true || statusText?.match(/active|enabled|online|valid/)) return 'active';

  return 'unknown';
}

function normalizePanelKind(value: string | null | undefined): { panelKind: CurrentPanelKind; warnings: string[] } {
  const normalized = normalizeNullableString(value)?.toLowerCase().replace(/[^a-z0-9_-]+/g, '_') ?? 'generic';
  if (supportedPanelKinds.has(normalized as CurrentPanelKind)) {
    return { panelKind: normalized as CurrentPanelKind, warnings: [] };
  }

  return { panelKind: 'generic', warnings: ['unknown_panel_kind_generic_adapter'] };
}

function normalizeProtocol(value: string | null | undefined): ProtocolKind | string {
  const normalized = normalizeNullableString(value)?.toLowerCase().replace(/[^a-z0-9_-]+/g, '_') ?? 'vless';
  return supportedProtocols.has(normalized as ProtocolKind) ? normalized as ProtocolKind : normalized;
}

function looksLikePanelUserRecord(record: Record<string, unknown>): boolean {
  const keys = new Set(Object.keys(record));
  return [
    ...userLabelKeys,
    ...userIdKeys,
    ...quotaKeys,
    ...usedKeys,
    ...statusKeys,
    ...expireKeys,
  ].some((key) => keys.has(key));
}

function parseSettingsRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'string' && value.trim()) {
    try {
      return asRecord(JSON.parse(value));
    } catch {
      return null;
    }
  }

  return asRecord(value);
}

function extractClientStats(record: Record<string, unknown>): Record<string, unknown>[] {
  const stats = [
    ...arrayFromRecord(record, 'clientStats'),
    ...arrayFromRecord(record, 'client_stats'),
    ...arrayFromRecord(record, 'stats'),
  ];

  return stats.map(asRecord).filter((item): item is Record<string, unknown> => Boolean(item));
}

function matchClientStat(
  client: Record<string, unknown>,
  stats: Record<string, unknown>[],
): Record<string, unknown> | null {
  const clientId = firstText(client, ['id', 'uuid']);
  const clientEmail = firstText(client, ['email', 'username', 'name']);
  return stats.find((stat) => {
    const statId = firstText(stat, ['id', 'uuid']);
    const statEmail = firstText(stat, ['email', 'username', 'name']);
    return Boolean((clientId && clientId === statId) || (clientEmail && clientEmail === statEmail));
  }) ?? null;
}

function arrayFromRecord(record: Record<string, unknown> | null, key: string): unknown[] {
  const value = record?.[key];
  return Array.isArray(value) ? value : [];
}

function firstText(record: Record<string, unknown> | null, keys: string[]): string | null {
  if (!record) return null;
  for (const key of keys) {
    const value = textValue(record[key]);
    if (value) return value;
  }

  return null;
}

function firstIdentifier(record: Record<string, unknown> | null, keys: string[]): string | null {
  if (!record) return null;

  for (const key of keys) {
    const value = textValue(record[key]);
    if (!value) continue;

    if (/url|uri|link|token|subscription/i.test(key)) return fingerprintIdentifier(value);
    return truncateText(value, 120);
  }

  return null;
}

function firstBytes(record: Record<string, unknown>, keys: string[], zeroMeansUnlimited: boolean): number | null {
  for (const key of keys) {
    const bytes = parseBytes(record[key], key);
    if (bytes === null) continue;
    if (zeroMeansUnlimited && bytes <= 0) continue;
    return bytes;
  }

  return null;
}

function firstUsedBytes(record: Record<string, unknown>): number | null {
  const direct = firstBytes(record, usedKeys, false);
  if (direct !== null) return direct;

  const up = firstBytes(record, upKeys, false);
  const down = firstBytes(record, downKeys, false);
  if (up === null && down === null) return null;

  return (up ?? 0) + (down ?? 0);
}

function firstTimestamp(record: Record<string, unknown> | null, keys: string[]): string | null {
  if (!record) return null;
  for (const key of keys) {
    const timestamp = parseTimestamp(record[key]);
    if (timestamp) return timestamp;
  }

  return null;
}

function firstPositiveInteger(record: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key];
    const numeric = typeof value === 'number' ? value : typeof value === 'string' ? Number(value.trim()) : Number.NaN;
    if (Number.isInteger(numeric) && numeric > 0 && numeric <= 1000) return numeric;
  }

  return null;
}

function firstBoolean(record: Record<string, unknown> | null, keys: string[]): boolean | null {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number' && (value === 0 || value === 1)) return Boolean(value);
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['true', '1', 'yes', 'enabled', 'active'].includes(normalized)) return true;
      if (['false', '0', 'no', 'disabled', 'inactive'].includes(normalized)) return false;
    }
  }

  return null;
}

function parseBytes(value: unknown, keyHint: string): number | null {
  const parsed = parseNumberWithOptionalUnit(value);
  if (!parsed) return null;

  let bytes = parsed.value;
  if (parsed.unit) {
    bytes *= unitMultiplier(parsed.unit);
  } else if (/gb/i.test(keyHint) && bytes > 0 && bytes <= 10_000) {
    bytes *= BYTES_PER_GB;
  }

  if (!Number.isFinite(bytes) || bytes < 0 || bytes > MAX_SAFE_BYTES) return null;
  return Math.round(bytes);
}

function parseNumberWithOptionalUnit(value: unknown): { value: number; unit: string | null } | null {
  if (typeof value === 'number') return Number.isFinite(value) ? { value, unit: null } : null;
  if (typeof value !== 'string') return null;

  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)\s*([kmgt]?i?b)?$/i);
  if (!match) return null;

  const numeric = Number(match[1]);
  if (!Number.isFinite(numeric)) return null;
  return { value: numeric, unit: match[2]?.toLowerCase() ?? null };
}

function unitMultiplier(unit: string): number {
  if (unit.startsWith('t')) return 1024 ** 4;
  if (unit.startsWith('g')) return BYTES_PER_GB;
  if (unit.startsWith('m')) return 1024 ** 2;
  if (unit.startsWith('k')) return 1024;
  return 1;
}

function parseTimestamp(value: unknown): string | null {
  if (value === null || value === undefined) return null;

  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) return null;
    const millis = value > 10_000_000_000 ? value : value * 1000;
    const date = new Date(millis);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed || trimmed === '0' || trimmed === '-1') return null;
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) return parseTimestamp(numeric);

    const date = new Date(trimmed);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function textValue(value: unknown): string | null {
  if (typeof value === 'string') return normalizeNullableString(value);
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function normalizeNullableString(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function truncateText(value: string | null, maxLength: number): string | null {
  if (!value) return null;
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

function fingerprintIdentifier(value: string): string {
  const digest = createHash('sha256').update(value, 'utf8').digest('hex').slice(0, 24);
  return `sha256:${digest}`;
}

function sumNullable(values: Array<number | null>): number | null {
  let total = 0;
  let seen = false;

  for (const value of values) {
    if (value === null || value === undefined) continue;
    total += value;
    seen = true;
  }

  return seen ? total : null;
}

function rawType(value: unknown): string {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  return typeof value;
}
