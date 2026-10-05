import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import type { AddressInfo } from 'node:net';
import { tunnelAgent } from '../src/outbound/tunnel-agent.ts';

/**
 * Regression (2026-10-05): requests through AFROWS_OUTBOUND_PROXY_URL=socks5://…
 * opened the SOCKS tunnel but then dialed the target DIRECTLY — `agent: false`
 * makes Node build a fresh Agent that ignores `createConnection`. On the Afrows
 * box every Telegram poll timed out against 149.154.x.x.
 *
 * The target host does not resolve, so a request can only succeed if it really
 * rides the pre-connected tunnel socket.
 */
async function withOrigin(fn: (port: number) => Promise<void>): Promise<void> {
  const origin = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end(`ok ${req.headers.host} ${req.url}`);
  });
  await new Promise<void>((r) => origin.listen(0, '127.0.0.1', r));
  try {
    await fn((origin.address() as AddressInfo).port);
  } finally {
    origin.close();
  }
}

function get(options: http.RequestOptions): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
    });
    req.setTimeout(4000, () => req.destroy(new Error('timeout')));
    req.once('error', reject);
    req.end();
  });
}

const target = { hostname: 'socks-only.invalid', port: 8080, path: '/probe', headers: { Host: 'socks-only.invalid:8080' } };

test('tunnelAgent sends the request over the pre-connected tunnel socket', async () => {
  await withOrigin(async (port) => {
    const socket = net.connect(port, '127.0.0.1');
    await new Promise((r) => socket.once('connect', r));
    const res = await get({ ...target, agent: tunnelAgent(false, socket, target.hostname) });
    assert.equal(res.status, 200);
    assert.equal(res.body, 'ok socks-only.invalid:8080 /probe');
  });
});

test('the old `agent: false` + createConnection form ignores the tunnel (documents the bug)', async () => {
  await withOrigin(async (port) => {
    const socket = net.connect(port, '127.0.0.1');
    await new Promise((r) => socket.once('connect', r));
    await assert.rejects(get({ ...target, agent: false, createConnection: () => socket }));
    socket.destroy();
  });
});
