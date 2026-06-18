#!/usr/bin/env node
/* READ-ONLY village discovery: decrypt the stored village REST credential, then
   enumerate the village's WireGuard tunnels + the server endpoints behind them.
   Changes nothing. Run on the Afrows box (reaches the village at 10.20.0.2). */
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const { execSync } = require('child_process');

const ENV = '/etc/afrows/afrows.env';
function fileEnv(k) {
  const t = fs.readFileSync(ENV, 'utf8');
  for (const l of t.split('\n')) if (l.startsWith(k + '=')) return l.slice(k.length + 1).trim().replace(/^"|"$/g, '').replace(/\r$/, '');
  return '';
}
function decodeKey(raw) {
  if (/^[0-9a-f]{64}$/i.test(raw)) return Buffer.from(raw, 'hex');
  const n = raw.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(n.padEnd(Math.ceil(n.length / 4) * 4, '='), 'base64');
}
const fromB64u = (v) => {
  const n = v.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(n.padEnd(Math.ceil(n.length / 4) * 4, '='), 'base64');
};
function decrypt(payload, context, key) {
  const [ver, keyId, iv, tag, ct] = payload.split('.');
  const d = crypto.createDecipheriv('aes-256-gcm', key, fromB64u(iv));
  d.setAAD(Buffer.from(context, 'utf8'));
  d.setAuthTag(fromB64u(tag));
  return JSON.parse(Buffer.concat([d.update(fromB64u(ct)), d.final()]).toString('utf8'));
}
function psql1(q) {
  return execSync(`sudo -u postgres psql afrows -tAc ${JSON.stringify(q)}`, { encoding: 'utf8' }).trim();
}
function vget(host, user, pw, path) {
  return new Promise((res) => {
    const req = http.request(
      { host, path: '/rest' + path, method: 'GET', headers: { Authorization: 'Basic ' + Buffer.from(user + ':' + pw).toString('base64') }, timeout: 12000 },
      (r) => { let s = ''; r.on('data', (c) => (s += c)); r.on('end', () => { try { res(JSON.parse(s)); } catch { res(null); } }); },
    );
    req.on('error', () => res(null));
    req.on('timeout', () => { req.destroy(); res(null); });
    req.end();
  });
}

(async () => {
  const key = decodeKey(fileEnv('AFROWS_SECRETS_KEY'));
  const enc = psql1("select rest_password_enc from mikrotik_routers where id='village'");
  const user = psql1("select rest_user from mikrotik_routers where id='village'");
  const host = psql1("select host from mikrotik_routers where id='village'");
  const pw = decrypt(enc, 'mikrotik:village', key).password;
  console.log('village host=%s user=%s pwlen=%d', host, user, String(pw).length);

  const ifs = (await vget(host, user, pw, '/interface/wireguard?.proplist=name,public-key,listen-port,running')) || [];
  const peers = (await vget(host, user, pw, '/interface/wireguard/peers?.proplist=interface,public-key,endpoint-address,endpoint-port,current-endpoint-address,current-endpoint-port,allowed-address,comment,last-handshake,rx,tx,disabled')) || [];
  const addrs = (await vget(host, user, pw, '/ip/address?.proplist=address,interface')) || [];
  const ident = (await vget(host, user, pw, '/system/identity')) || {};

  console.log('\n=== IDENTITY ===\n', JSON.stringify(ident));
  console.log('\n=== WG INTERFACES (%d) ===', ifs.length);
  for (const i of ifs) console.log(`  ${i.name}  listen=${i['listen-port'] || '-'}  running=${i.running}`);
  console.log('\n=== WG PEERS / SERVERS (%d) ===', peers.length);
  for (const p of peers) {
    console.log(
      `  [${p.interface}] ${p.disabled === 'true' ? '(DISABLED) ' : ''}endpoint=${p['endpoint-address'] || '-'}:${p['endpoint-port'] || '-'}` +
        `  current=${p['current-endpoint-address'] || '-'}:${p['current-endpoint-port'] || '-'}  allowed=${p['allowed-address'] || '-'}` +
        `  hs=${p['last-handshake'] || 'never'}  comment="${p.comment || ''}"`,
    );
  }
  console.log('\n=== ADDRESSES ===');
  for (const a of addrs) console.log(`  ${a.address}  on ${a.interface}`);

  // unique server endpoints (the VPSs behind the tunnels)
  const eps = [...new Set(peers.map((p) => p['endpoint-address']).filter(Boolean))];
  console.log('\n=== UNIQUE SERVER ENDPOINTS ===');
  console.log(eps.join('\n'));
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
