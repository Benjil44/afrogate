import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs/promises';
import { DatabaseService } from '../database/database.service';
import { createSecureTempFile } from '../common/secure-temp-file';
import { GermanyMgmtService } from './germany-mgmt.service';
import { UsaMgmtService } from './usa-mgmt.service';
import type { RemoteExitMgmt } from './remote-exit-mgmt';
import {
  createRemoteMembershipState,
  expireRemoteRevocations,
  planRemoteMembership,
  planRemoteRevocations,
  recordRemoteMembership,
  recordRemoteRevocation,
  type RemoteMembershipState,
} from './remote-exit-membership';
import {
  applyAcrossEndpoints,
  buildAddUserConfig,
  buildProvisioningEndpoints,
  localGateKey,
  parseIranInboundTags,
  partitionEndpointsByAccess,
  provisioningEmail,
  type ProvisioningEndpoint,
  type ProvisioningTarget,
} from './xray-provisioning';
import { serverAccessFromRow, serverAccessSelectSql, type ServerAccessColumns } from './customer-server-access';

const execFileAsync = promisify(execFile);

/** One provisionable config + its account's per-server access flags (migration 0066). */
interface ActiveClientRow extends ServerAccessColumns {
  id: string;
  entryUuid: string;
}

/** A remote exit (Germany, USA) kept in sync over its SSH mgmt channel. */
interface RemoteExitSite {
  /** The customer_accounts access flag that gates this site. */
  kind: 'germany' | 'usa';
  mgmt: RemoteExitMgmt;
  /** Whether the membership sweep runs for this site. */
  membershipEnabled(): boolean;
  sweepIntervalMs(): number;
  /** Ids confirmed present on the site + last full re-sync (per site, never shared). */
  membership: RemoteMembershipState;
}

/** Outcome of revoking one config everywhere. `usa: null` = USA mgmt is off (nothing to revoke). */
export interface RevokeClientConfigResult {
  local: boolean;
  germany: boolean;
  usa: boolean | null;
}

/**
 * Keeps the native Afrows xray inbound (afrows-in) in sync with Postgres:
 * active client_configs get a user (their entry_uuid) provisioned via the xray
 * API; non-active ones are removed. Runs on the box where xray lives; in dev
 * (no xray / disabled) it no-ops gracefully.
 */
@Injectable()
export class XrayProvisioningService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(XrayProvisioningService.name);
  private timer: NodeJS.Timeout | undefined;
  private running = false;
  /** A `requestReconcile()` arrived while a pass was running: run once more after it. */
  private rerunRequested = false;
  /** Local gate (server access): `localGateKey(id, apiServer, tag)` keys confirmed rmu'd
   *  from the Iran (afrows-in*) and pushed-Germany targets they may not use. Only
   *  `removed` + `lastSweepAt` are used; cleared every AFROWS_LOCAL_ACCESS_SWEEP_SECONDS. */
  private readonly localAccessGate: RemoteMembershipState = createRemoteMembershipState();
  /** Remote exits, Germany first. Each has its own membership cache (ids confirmed
   *  present on its WS inbound; the per-tick fast-path only adu's ids NOT in it, so
   *  new/recovered users are re-provisioned within ~60s while steady-state SSH churn
   *  is ~zero; rebuilt by the periodic full re-sync and reset on restart) and its
   *  own SSH breaker, so one site being down never delays the other. */
  private readonly remoteExits: RemoteExitSite[];

  constructor(
    private readonly config: ConfigService,
    private readonly database: DatabaseService,
    private readonly germanyMgmt: GermanyMgmtService,
    private readonly usaMgmt: UsaMgmtService,
  ) {
    this.remoteExits = [
      {
        kind: 'germany',
        mgmt: germanyMgmt,
        membershipEnabled: () => this.germanyEnabled(),
        sweepIntervalMs: () => this.sweepIntervalMs('AFROWS_DE_MEMBERSHIP_SWEEP_SECONDS'),
        membership: createRemoteMembershipState(),
      },
      {
        kind: 'usa',
        mgmt: usaMgmt,
        membershipEnabled: () => usaMgmt.isEnabled(),
        sweepIntervalMs: () => this.sweepIntervalMs('AFROWS_US_MEMBERSHIP_SWEEP_SECONDS'),
        membership: createRemoteMembershipState(),
      },
    ];
  }

  onModuleInit(): void {
    if (!process.env.DATABASE_URL) return;
    if (!this.flag('AFROWS_XRAY_PROVISIONING_ENABLED', true)) return;
    this.timer = setInterval(() => void this.reconcile(), this.intervalMs());
    this.timer.unref?.();
    void this.reconcile();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Provision one user now onto every target inbound of every endpoint (best-effort),
   *  or only onto `endpoints` when given (server-access filtered).
   *  A remote endpoint (Germany) being unreachable NEVER blocks the local one (Ireland). */
  async addUser(uuid: string, email: string, endpoints: ProvisioningEndpoint[] = this.endpoints()): Promise<boolean> {
    const globalFlow = this.config.get<string>('AFROWS_XRAY_INBOUND_FLOW')?.trim();
    const okByEndpoint = await applyAcrossEndpoints(
      endpoints,
      async (endpoint, t) => {
        // per-inbound flow (from tag:port:flow) wins; else the global flow. Keeps Vision
        // on the reality inbound only and off WS/tcp inbounds.
        const cfg = buildAddUserConfig({ inboundTag: t.tag, port: t.port, uuid, email, flow: t.flow ?? globalFlow });
        const tmp = await createSecureTempFile(
          `afrows-adu-${endpoint.label}-${t.tag}-${email.replace(/[^a-z0-9_-]/gi, '')}.json`,
        );
        try {
          await fs.writeFile(tmp.path, JSON.stringify(cfg), { encoding: 'utf8', mode: 0o600 });
          await this.xray(['api', 'adu', `--server=${endpoint.apiServer}`, tmp.path]);
        } finally {
          await tmp.cleanup();
        }
      },
      (endpoint, t, error) =>
        this.logger.warn(`adu ${email} on ${endpoint.label}/${t.tag} failed: ${this.errMsg(error)}`),
    );
    // Success = the LOCAL endpoint took the user; remote (Germany) is best-effort.
    return okByEndpoint.get(this.localApiServer()) ?? false;
  }

  async removeUser(email: string): Promise<boolean> {
    const okByEndpoint = await applyAcrossEndpoints(
      this.endpoints(),
      async (endpoint, t) => {
        await this.xray(['api', 'rmu', `--server=${endpoint.apiServer}`, `-tag=${t.tag}`, email]);
      },
      (endpoint, t, error) =>
        this.logger.warn(`rmu ${email} on ${endpoint.label}/${t.tag} failed: ${this.errMsg(error)}`),
    );
    return okByEndpoint.get(this.localApiServer()) ?? false;
  }

  /**
   * Run a reconcile pass now, or right after the one in flight (whose rows may
   * predate the change). Used after a per-customer server-access change: a
   * revoked server is rmu'd within seconds, a re-granted one re-adu'd.
   */
  requestReconcile(): void {
    if (this.running) {
      this.rerunRequested = true;
      return;
    }
    void this.reconcile();
  }

  /**
   * Revoke a DELETED client config everywhere it can still authenticate: the local
   * xray inbounds AND every remote exit (Germany, USA). The remote exits otherwise
   * only drop users that go over quota, so a config deleted in the dashboard kept
   * working there (found 2026-10-05). Best-effort and not retried: failures are
   * logged, and a `false` site result means the revocation must be verified by
   * hand. Germany and the USA run in parallel (one down site never delays the other).
   */
  async revokeClientConfig(clientConfigId: string): Promise<RevokeClientConfigResult> {
    const email = provisioningEmail(clientConfigId);
    const local = await this.removeUser(email);
    const [germany, usa] = await Promise.all([
      this.germanyMgmt.removeUser(email),
      this.usaMgmt.isEnabled() ? this.usaMgmt.removeUser(email) : Promise.resolve(null),
    ]);
    if (!germany) this.logger.warn(`Germany rmu for deleted client config ${clientConfigId} failed; it may still authenticate there`);
    if (usa === false) this.logger.warn(`USA rmu for deleted client config ${clientConfigId} failed; it may still authenticate there`);
    // Forget it in every membership cache so a later restore re-adu's it.
    for (const site of this.remoteExits) {
      site.membership.confirmed.delete(clientConfigId);
      site.membership.removed.delete(clientConfigId);
    }
    for (const key of [...this.localAccessGate.removed]) {
      if (key.startsWith(`${clientConfigId}|`)) this.localAccessGate.removed.delete(key);
    }
    return { local, germany, usa };
  }

  /** Sync Postgres active client_configs → xray inbound users. */
  async reconcile(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.recoverBackUnderQuota();
      await this.ensureRemoteExitMembership();
      const result = await this.database.query<ActiveClientRow>(
        `
          SELECT cc.id, cc.entry_uuid AS "entryUuid", ${serverAccessSelectSql('ca')}
          FROM client_configs cc
          JOIN customer_accounts ca ON ca.id = cc.customer_account_id
          WHERE cc.status <> 'disabled'
            AND ca.status = 'active'
            AND ca.deleted_at IS NULL
            AND (ca.quota_limit_bytes IS NULL OR ca.used_bytes < ca.quota_limit_bytes)
            AND (cc.blocked_until IS NULL OR cc.blocked_until <= now())
        `,
      );
      const endpoints = this.endpoints();
      const iranTags = parseIranInboundTags(this.envValue('AFROWS_XRAY_IRAN_INBOUND_TAGS'));
      const deniedTargets = new Map<string, ProvisioningEndpoint[]>();
      let added = 0;
      for (const row of result.rows) {
        // Per-customer server access: only the inbounds the account may use. afrows-in
        // (Iran/Shatel) follows access_iran, the pushed Germany endpoint access_germany;
        // every other local inbound (afrows-reality, ...) is unchanged.
        const { allowed, denied } = partitionEndpointsByAccess(endpoints, serverAccessFromRow(row), iranTags);
        if (denied.length) deniedTargets.set(row.id, denied);
        // adu is idempotent enough for our scale: re-adding an existing user is a no-op/ignored.
        if (allowed.length && (await this.addUser(row.entryUuid, provisioningEmail(row.id), allowed))) added += 1;
      }
      await this.revokeLocalDenied(deniedTargets);
      if (added)
        this.logger.log(
          `Provisioning reconcile: ensured ${added} user(s) across ${endpoints
            .map((e) => `${e.label}[${e.targets.map((t) => t.tag).join(',')}]`)
            .join(' ')}`,
        );
    } catch (error) {
      this.logger.warn(`Provisioning reconcile failed: ${error instanceof Error ? error.message : error}`);
    } finally {
      this.running = false;
      if (this.rerunRequested) {
        this.rerunRequested = false;
        void this.reconcile();
      }
    }
  }

  /**
   * rmu each in-good-standing config from the local targets its account may not use
   * (the Iran tags when access_iran is off; the pushed Germany endpoint when
   * access_germany is off). Tracked per (config, apiServer, tag), so a target that
   * becomes denied later (Germany switched off after Iran, a new Iran tag) still
   * gets its rmu, and each target must succeed on its own: a failed target is
   * retried next tick. The cache is cleared every sweep (default 300 s), so at
   * most one local rmu per denied (config, target) per sweep. xray's `api rmu`
   * exits 0 for an absent user.
   */
  private async revokeLocalDenied(deniedTargets: Map<string, ProvisioningEndpoint[]>): Promise<void> {
    expireRemoteRevocations(this.localAccessGate, Date.now(), this.sweepIntervalMs('AFROWS_LOCAL_ACCESS_SWEEP_SECONDS'));
    const byKey = new Map<string, { id: string; endpoint: ProvisioningEndpoint; target: ProvisioningTarget }>();
    for (const [id, endpoints] of deniedTargets) {
      for (const endpoint of endpoints) {
        for (const target of endpoint.targets) byKey.set(localGateKey(id, endpoint.apiServer, target.tag), { id, endpoint, target });
      }
    }
    const toRemove = planRemoteRevocations(this.localAccessGate, [...byKey.keys()]);
    let removed = 0;
    for (const key of toRemove) {
      const entry = byKey.get(key);
      if (!entry) continue;
      const email = provisioningEmail(entry.id);
      let ok = true;
      try {
        await this.xray(['api', 'rmu', `--server=${entry.endpoint.apiServer}`, `-tag=${entry.target.tag}`, email]);
      } catch (error) {
        ok = false;
        this.logger.warn(`rmu ${email} on ${entry.endpoint.label}/${entry.target.tag} failed: ${this.errMsg(error)}`);
      }
      recordRemoteRevocation(this.localAccessGate, key, ok);
      if (ok) removed += 1;
    }
    if (toRemove.length) {
      this.logger.log(`Server access: removed ${removed}/${toRemove.length} (client, inbound) pair(s) the account may not use`);
    }
  }

  /**
   * Self-healing recovery for customers who were cut for over-quota and have since
   * returned under quota (top-up, quota increase, or a usage correction). Quota
   * enforcement sets `client_configs.status = 'limited'` and removes the user from
   * BOTH Ireland's inbounds AND Germany's WS inbound. The Ireland reconcile below
   * re-adds `limited` users on Ireland, but Germany is reachable only over the SSH
   * mgmt channel (not a direct-API provisioning endpoint), so nothing re-adds them
   * there — a topped-up customer keeps timing out on the Germany data plane.
   *
   * This clears the stale `limited` status for every active, under-quota client and
   * re-provisions each recovered one on Germany (idempotent adu; a still-present
   * user is a no-op). It acts ONLY on the transition set (usually empty), so it adds
   * no steady-state SSH load. Best-effort: a Germany link failure is logged, the
   * status is already cleared, and the next tick retries the adu.
   */
  private async recoverBackUnderQuota(): Promise<void> {
    let recovered: { rows: ActiveClientRow[] };
    try {
      recovered = await this.database.query<ActiveClientRow>(
        `
          UPDATE client_configs cc
          SET status = 'active', updated_at = now()
          FROM customer_accounts ca
          WHERE cc.customer_account_id = ca.id
            AND cc.status = 'limited'
            AND ca.status = 'active'
            AND ca.deleted_at IS NULL
            AND (ca.quota_limit_bytes IS NULL OR ca.used_bytes < ca.quota_limit_bytes)
          RETURNING cc.id, cc.entry_uuid AS "entryUuid", ${serverAccessSelectSql('ca')}
        `,
      );
    } catch (error) {
      this.logger.warn(`Provisioning recovery query failed: ${error instanceof Error ? error.message : error}`);
      return;
    }
    if (!recovered.rows.length) return;
    const sites = this.remoteExits.filter((site) => site.mgmt.isEnabled());
    await Promise.all(
      sites.map(async (site) => {
        for (const row of recovered.rows) {
          if (!serverAccessFromRow(row)[site.kind]) continue; // server access off: never re-add
          if (await site.mgmt.addUserByIdentity(row.entryUuid, provisioningEmail(row.id))) {
            site.membership.confirmed.add(row.id); // let the membership fast-path skip the redundant re-adu
          }
        }
      }),
    );
    this.logger.log(
      `Provisioning recovery: un-limited + re-provisioned ${recovered.rows.length} back-under-quota client(s) on ${sites
        .map((site) => site.mgmt.label)
        .join(', ')}`,
    );
  }

  /**
   * Keeps EVERY active, under-quota, non-disabled VLESS client present on each
   * remote exit's WS inbound (Germany, USA). They are reachable only over their
   * SSH mgmt channels (not direct-API provisioning endpoints), so they aren't
   * covered by the Ireland reconcile below, and any way a user (re)enters good
   * standing (a fresh signup, disabled->enabled, over-quota->top-up, a transient
   * enforcement rmu) would otherwise leave them silently off that exit. `adu` is
   * idempotent (a still-present user is a no-op), so this only ADDS, never
   * disconnects.
   *
   * Runs every reconcile tick, but SSH-cheap (see remote-exit-membership.ts):
   * fast-path ticks adu only unconfirmed ids; a periodic FULL re-sync (every
   * AFROWS_DE_MEMBERSHIP_SWEEP_SECONDS / AFROWS_US_MEMBERSHIP_SWEEP_SECONDS,
   * default 300 s) re-adu's everyone. One eligibility query is shared; the sites
   * then run in parallel with their own caches and breakers.
   *
   * Per-customer server access (0.118.0): a config whose account has the site's
   * flag off is NOT eligible there (never adu'd, dropped from `confirmed`) and is
   * rmu'd from the site once (`planRemoteRevocations`; failed rmu retried next
   * tick). Turning the flag back on makes it eligible again: it is not in
   * `confirmed`, so the next tick's fast path re-adu's it.
   */
  private async ensureRemoteExitMembership(): Promise<void> {
    const sites = this.remoteExits.filter((site) => site.membershipEnabled());
    if (!sites.length) return;

    let rows: { rows: ActiveClientRow[] };
    try {
      rows = await this.database.query<ActiveClientRow>(
        `
          SELECT cc.id, cc.entry_uuid AS "entryUuid", ${serverAccessSelectSql('ca')}
          FROM client_configs cc
          JOIN customer_accounts ca ON ca.id = cc.customer_account_id
          WHERE cc.status <> 'disabled'
            AND ca.status = 'active'
            AND ca.deleted_at IS NULL
            AND lower(cc.protocol) = 'vless'
            AND (ca.quota_limit_bytes IS NULL OR ca.used_bytes < ca.quota_limit_bytes)
            AND (cc.blocked_until IS NULL OR cc.blocked_until <= now())
        `,
      );
    } catch (error) {
      this.logger.warn(`Remote-exit membership query failed: ${error instanceof Error ? error.message : error}`);
      return;
    }
    await Promise.all(sites.map((site) => this.ensureSiteMembership(site, rows.rows)));
  }

  private async ensureSiteMembership(site: RemoteExitSite, allRows: ActiveClientRow[]): Promise<void> {
    const rows = allRows.filter((row) => serverAccessFromRow(row)[site.kind]);
    const deniedIds = allRows.filter((row) => !serverAccessFromRow(row)[site.kind]).map((row) => row.id);

    const byId = new Map(rows.map((row) => [row.id, row] as const));
    // Planned first: a full re-sync also clears `removed`, so the denied ids below are
    // rmu'd once more this sweep (an xray restart may have restored them).
    const { toAdd, fullResync } = planRemoteMembership(site.membership, [...byId.keys()], Date.now(), site.sweepIntervalMs());
    await this.revokeSiteDenied(site, deniedIds);
    let ensured = 0;
    for (const id of toAdd) {
      const row = byId.get(id);
      if (!row) continue;
      const ok = await site.mgmt.addUserByIdentity(row.entryUuid, provisioningEmail(row.id));
      recordRemoteMembership(site.membership, row.id, ok); // failed -> retried next tick
      if (ok) ensured += 1;
    }
    if (toAdd.length) {
      const label = site.mgmt.label;
      this.logger.log(
        `${label} membership ${fullResync ? 're-sync' : 'fast-path'}: ensured ${ensured}/${toAdd.length} of ${rows.length} active under-quota client(s) on ${label}`,
      );
    }
  }

  /** rmu configs whose account may not use this site (once each; failures retried next tick). */
  private async revokeSiteDenied(site: RemoteExitSite, deniedIds: string[]): Promise<void> {
    const toRemove = planRemoteRevocations(site.membership, deniedIds);
    let removed = 0;
    for (const id of toRemove) {
      const ok = await site.mgmt.removeUser(provisioningEmail(id));
      recordRemoteRevocation(site.membership, id, ok);
      if (ok) removed += 1;
    }
    if (toRemove.length) {
      this.logger.log(`${site.mgmt.label} server access: removed ${removed}/${toRemove.length} client(s) whose ${site.kind} access is off`);
    }
  }

  private germanyEnabled(): boolean {
    return Boolean((this.config.get<string>('AFROWS_DE_MGMT_SSH') ?? process.env.AFROWS_DE_MGMT_SSH)?.trim());
  }
  private sweepIntervalMs(key: string): number {
    return this.intFromValue(this.config.get<string>(key), 300, 60, 3600) * 1000;
  }

  private async xray(args: string[]): Promise<void> {
    await execFileAsync(this.bin(), args, { timeout: 15000 });
  }

  private bin(): string {
    return this.config.get<string>('AFROWS_XRAY_BIN')?.trim() || 'xray';
  }
  private localApiServer(): string {
    return this.config.get<string>('AFROWS_XRAY_API_SERVER')?.trim() || '127.0.0.1:10085';
  }
  /**
   * Ordered provisioning endpoints: local Ireland xray first, then the remote
   * Germany xray (pushed Ireland→Germany over the village route) when
   * AFROWS_XRAY_DE_API_SERVER is set. Germany is best-effort and never blocks Ireland.
   */
  private endpoints(): ProvisioningEndpoint[] {
    return buildProvisioningEndpoints(this.envRecord());
  }
  /** Config-backed view of the env keys the endpoint builder reads (test/DI-friendly). */
  private envValue(key: string): string | undefined {
    return this.config.get<string>(key) ?? process.env[key];
  }
  private envRecord(): Record<string, string | undefined> {
    const get = (k: string) => this.envValue(k);
    return {
      AFROWS_XRAY_API_SERVER: get('AFROWS_XRAY_API_SERVER'),
      AFROWS_XRAY_INBOUND_TAG: get('AFROWS_XRAY_INBOUND_TAG'),
      AFROWS_XRAY_INBOUND_PORT: get('AFROWS_XRAY_INBOUND_PORT'),
      AFROWS_XRAY_INBOUND_TAGS: get('AFROWS_XRAY_INBOUND_TAGS'),
      AFROWS_XRAY_DE_API_SERVER: get('AFROWS_XRAY_DE_API_SERVER'),
      AFROWS_XRAY_DE_INBOUND_TAGS: get('AFROWS_XRAY_DE_INBOUND_TAGS'),
      AFROWS_XRAY_DE_INBOUND_PORT: get('AFROWS_XRAY_DE_INBOUND_PORT'),
    };
  }
  private errMsg(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
  private intervalMs(): number {
    return this.intFromValue(this.config.get<string>('AFROWS_XRAY_PROVISION_INTERVAL_SECONDS'), 60, 15, 3600) * 1000;
  }
  private intFromValue(raw: unknown, fallback: number, min: number, max: number): number {
    const n = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isInteger(n)) return fallback;
    return Math.min(Math.max(n, min), max);
  }
  private flag(name: string, fallback: boolean): boolean {
    const v = this.config.get<string>(name)?.trim().toLowerCase();
    if (!v) return fallback;
    return ['1', 'true', 'yes', 'on'].includes(v);
  }
}
