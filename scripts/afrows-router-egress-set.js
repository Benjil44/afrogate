#!/usr/bin/env node
/* Enable/disable a managed router's `afrows-egress` mangle rule via REST (the
   same action the panel's "Afrows internet" toggle performs). Reversible.
   Usage: node afrows-router-egress-set.js <routerId> <on|off> */
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const { execSync } = require('child_process');

const ENV = '/etc/afrows/afrows.env';
const ID = process.argv[2];
const WANT = (process.argv[3] || '').toLowerCase() === 'on';
if (!ID) { console.error('usage: <routerId> <on|off>'); process.exit(2); }

function fileEnv(k) {
  for (const l of fs.readFileSync(ENV, 'utf8').split('\n')) if (l.startsWith(k + '=')) return l.slice(k.length + 1).trim().replace(/^"|"$/g, '').replace(/\r$/, '');
  return '';
}
function decodeKey(raw) {
  if (/^[0-9a-f]{64}$/i.test(raw)) return Buffer.from(raw, 'hex');
  const n = raw.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(n.padEnd(Math.ceil(n.length / 4) * 4, '='), 'base64');
}
const fromB64u = (v) => { const n = v.replace(/-/g, '+').replace(/_/g, '/'); return Buffer.from(n.padEnd(Math.ceil(n.length / 4) * 4, '='), 'base64'); };
function decrypt(payload, context, key) {
  const [, , iv, tag, ct] = payload.split('.');
  const d = crypto.createDecipheriv('aes-256-gcm', key, fromB64u(iv));
  d.setAAD(Buffer.from(context, 'utf8'));
  d.setAuthTag(fromB64u(tag));
  return JSON.parse(Buffer.concat([d.update(fromB64u(ct)), d.final()]).toString('utf8'));
}
function psql1(q) { return execSync(`sudo -u postgres psql afrows -tAc ${JSON.stringify(q)}`, { encoding: 'utf8' }).trim(); }
function rest(host, user, pw, method, path, body) {
  return new Promise((res) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(
      { host, path: '/rest' + path, method, timeout: 15000,
        headers: { Authorization: 'Basic ' + Buffer.from(user + ':' + pw).toString('base64'), 'Content-Type': 'application/json', ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}) } },
      (r) => { let s = ''; r.on('data', (c) => (s += c)); r.on('end', () => { try { res(JSON.parse(s)); } catch { res(s); } }); },
    );
    req.on('error', (e) => res({ error: e.message }));
    req.on('timeout', () => { req.destroy(); res({ error: 'timeout' }); });
    if (data) req.write(data);
    req.end();
  });
}

(async () => {
  const key = decodeKey(fileEnv('AFROWS_SECRETS_KEY'));
  const enc = psql1(`select rest_password_enc from mikrotik_routers where id='${ID}'`);
  const user = psql1(`select rest_user from mikrotik_routers where id='${ID}'`);
  const host = psql1(`select host from mikrotik_routers where id='${ID}'`);
  const pw = decrypt(enc, `mikrotik:${ID}`, key).password;

  const rules = (await rest(host, user, pw, 'GET', '/ip/firewall/mangle?.proplist=.id,comment,disabled')) || [];
  const rule = Array.isArray(rules) ? rules.find((m) => m.comment === 'afrows-egress') : null;
  if (!rule) { console.error('NO afrows-egress mangle rule on', ID); process.exit(1); }
  console.log(`found afrows-egress rule ${rule['.id']} currently disabled=${rule.disabled}`);
  const r = await rest(host, user, pw, 'POST', '/ip/firewall/mangle/set', { '.id': rule['.id'], disabled: WANT ? 'no' : 'yes' });
  console.log('set ->', JSON.stringify(r));
  const after = (await rest(host, user, pw, 'GET', '/ip/firewall/mangle?.proplist=.id,comment,disabled')) || [];
  const a = Array.isArray(after) ? after.find((m) => m.comment === 'afrows-egress') : null;
  console.log(`verify: afrows-egress disabled=${a ? a.disabled : '?'} (wanted ${WANT ? 'no' : 'yes'})`);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
