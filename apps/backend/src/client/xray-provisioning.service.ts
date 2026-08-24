import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs/promises';
import { DatabaseService } from '../database/database.service';
import { createSecureTempFile } from '../common/secure-temp-file';
import {
  applyAcrossEndpoints,
  buildAddUserConfig,
  buildProvisioningEndpoints,
  provisioningEmail,
  type ProvisioningEndpoint,
} from './xray-provisioning';

const execFileAsync = promisify(execFile);

interface ActiveClientRow {
  id: string;
  entryUuid: string;
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

  constructor(
    private readonly config: ConfigService,
    private readonly database: DatabaseService,
  ) {}

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

  /** Provision one user now onto every target inbound of every endpoint (best-effort).
   *  A remote endpoint (Germany) being unreachable NEVER blocks the local one (Ireland). */
  async addUser(uuid: string, email: string): Promise<boolean> {
    const globalFlow = this.config.get<string>('AFROWS_XRAY_INBOUND_FLOW')?.trim();
    const okByEndpoint = await applyAcrossEndpoints(
      this.endpoints(),
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

  /** Sync Postgres active client_configs → xray inbound users. */
  async reconcile(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const result = await this.database.query<ActiveClientRow>(
        `
          SELECT cc.id, cc.entry_uuid AS "entryUuid"
          FROM client_configs cc
          JOIN customer_accounts ca ON ca.id = cc.customer_account_id
          WHERE cc.status <> 'disabled'
            AND ca.status = 'active'
            AND ca.deleted_at IS NULL
        `,
      );
      let added = 0;
      for (const row of result.rows) {
        // adu is idempotent enough for our scale: re-adding an existing user is a no-op/ignored.
        if (await this.addUser(row.entryUuid, provisioningEmail(row.id))) added += 1;
      }
      if (added)
        this.logger.log(
          `Provisioning reconcile: ensured ${added} user(s) across ${this.endpoints()
            .map((e) => `${e.label}[${e.targets.map((t) => t.tag).join(',')}]`)
            .join(' ')}`,
        );
    } catch (error) {
      this.logger.warn(`Provisioning reconcile failed: ${error instanceof Error ? error.message : error}`);
    } finally {
      this.running = false;
    }
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
  private envRecord(): Record<string, string | undefined> {
    const get = (k: string) => this.config.get<string>(k) ?? process.env[k];
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
