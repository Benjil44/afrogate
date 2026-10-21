/**
 * Drives the REAL TelegramPollingService loop against a fake Telegram API.
 * Bundled with esbuild like telegram-bot-superadmin.test.ts (Nest decorators).
 *
 * Regression for 0.121.1: every poll failure (e.g. the Telegram SOCKS link
 * timing out) re-ran deleteWebhook with drop_pending_updates=true, so messages
 * users sent while the link was down were deleted — sign-ups vanished.
 */
import assert from 'node:assert/strict';
import Module, { createRequire } from 'node:module';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(here, '..');
const requireFromBackend = createRequire(path.join(backendRoot, 'package.json'));

type PollingCtor = new (bot: unknown, telegramConfig: unknown, outboundHttp: unknown, config: unknown) => {
  onModuleInit(): void;
  onModuleDestroy(): void;
};

let skipReason: string | false = false;
try {
  requireFromBackend.resolve('esbuild');
} catch {
  if (process.env.CI) throw new Error('esbuild must be resolvable from apps/backend in CI for the polling suite');
  skipReason = 'esbuild not resolvable from apps/backend';
}

function loadService(): PollingCtor {
  requireFromBackend('reflect-metadata');
  const esbuild = requireFromBackend('esbuild') as typeof import('esbuild');
  const out = esbuild.buildSync({
    entryPoints: [path.join(backendRoot, 'src/telegram/telegram-polling.service.ts')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    packages: 'external',
    write: false,
    tsconfig: path.join(backendRoot, 'tsconfig.json'),
    target: 'node20',
    logLevel: 'error',
  });
  const filename = path.join(here, '__telegram-polling.service.bundle.cjs');
  const mod = new Module(filename) as Module & { _compile(code: string, filename: string): void; paths: string[] };
  mod.filename = filename;
  mod.paths = (Module as unknown as { _nodeModulePaths(dir: string): string[] })._nodeModulePaths(here);
  mod._compile(out.outputFiles[0].text, filename);
  return (mod.exports as { TelegramPollingService: PollingCtor }).TelegramPollingService;
}

describe('TelegramPollingService', { skip: skipReason }, () => {
  it('drops the backlog only on the first webhook clear, not after a link failure', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const TelegramPollingService = loadService();
    const deleteWebhookDrops: boolean[] = [];
    const handled: unknown[] = [];
    let getUpdatesCalls = 0;
    let service: { onModuleDestroy(): void } | undefined;

    const outboundHttp = {
      async request(url: string, init: { body: string }) {
        const method = url.split('/').pop();
        const body = JSON.parse(init.body) as Record<string, unknown>;
        if (method === 'deleteWebhook') deleteWebhookDrops.push(body.drop_pending_updates === true);
        if (method !== 'getUpdates') return { ok: true, statusCode: 200, body: '{"ok":true}' };
        getUpdatesCalls += 1;
        if (getUpdatesCalls === 1) throw new Error('SOCKS proxy timed out');
        if (getUpdatesCalls === 2) {
          return { ok: true, statusCode: 200, body: JSON.stringify({ ok: true, result: [{ update_id: 7, message: { text: 'masoud' } }] }) };
        }
        service?.onModuleDestroy();
        return { ok: true, statusCode: 200, body: '{"ok":true,"result":[]}' };
      },
    };

    service = new TelegramPollingService(
      { handleUpdate: async (update: unknown) => void handled.push(update) },
      { getRuntimeConfig: async () => ({ commandsEnabled: true, botToken: 'test-token' }) },
      outboundHttp,
      { get: () => undefined },
    );
    (service as unknown as { onModuleInit(): void }).onModuleInit();

    for (let i = 0; i < 50 && getUpdatesCalls < 3; i += 1) {
      await new Promise<void>((resolve) => setImmediate(resolve));
      t.mock.timers.tick(3000);
    }

    assert.equal(getUpdatesCalls, 3);
    assert.deepEqual(deleteWebhookDrops, [true, false]);
    assert.equal(handled.length, 1);
  });
});
