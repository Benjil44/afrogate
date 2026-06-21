#!/usr/bin/env node
/* READ-ONLY: decrypt a managed router's REST credential and dump its
   Afrows-egress-relevant config (WG tunnel to Afrows, the afrows-egress mangle
   rule, custom routing table/route, masquerade). Changes nothing.
   Usage: node afrows-router-egress-inspect.js <routerId>
   ax3 hangs on full /ip/firewall|/ip/route, so every query is ?.proplist=. */
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const { execSync } = require('child_process');

const ENV = '/etc/afrows/afrows.env';
const ID = process.argv[2] || 'office';
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
  const [, , iv, tag, ct] = payload.split('.');
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
      { host, path: '/rest' + path, method: 'GET', headers: { Authorization: 'Basic ' + Buffer.from(user + ':' + pw).toString('base64') }, timeout: 15000 },
      (r) => { let s = ''; r.on('data', (c) => (s += c)); r.on('end', () => { try { res(JSON.parse(s)); } catch { res(null); } }); },
    );
    req.on('error', () => res(null));
    req.on('timeout', () => { req.destroy(); res(null); });
    req.end();
  });
}

(async () => {
  const key = decodeKey(fileEnv('AFROWS_SECRETS_KEY'));
  const enc = psql1(`select rest_password_enc from mikrotik_routers where id='${ID}'`);
  const user = psql1(`select rest_user from mikrotik_routers where id='${ID}'`);
  const host = psql1(`select host from mikrotik_routers where id='${ID}'`);
  const pw = decrypt(enc, `mikrotik:${ID}`, key).password;
  console.log(`router=${ID} host=${host} user=${user}`);

  const wg = (await vget(host, user, pw, '/interface/wireguard?.proplist=name,running,listen-port')) || [];
  const peers = (await vget(host, user, pw, '/interface/wireguard/peers?.proplist=interface,endpoint-address,endpoint-port,allowed-address,comment,last-handshake')) || [];
  const mangle = (await vget(host, user, pw, '/ip/firewall/mangle?.proplist=chain,action,new-routing-mark,routing-mark,dst-address-list,src-address,comment,disabled')) || [];
  const routes = (await vget(host, user, pw, '/ip/route?.proplist=dst-address,gateway,routing-table,comment,disabled,active')) || [];
  const nat = (await vget(host, user, pw, '/ip/firewall/nat?.proplist=chain,action,out-interface,src-address,comment,disabled')) || [];
  const tables = (await vget(host, user, pw, '/routing/table?.proplist=name,fib')) || [];

  console.log(`\n-- WG interfaces (${wg.length}) --`);
  for (const i of wg) console.log(`  ${i.name} running=${i.running} listen=${i['listen-port'] || '-'}`);
  console.log(`\n-- WG peers (${peers.length}) --`);
  for (const p of peers) console.log(`  [${p.interface}] ep=${p['endpoint-address'] || '-'}:${p['endpoint-port'] || '-'} allowed=${p['allowed-address'] || '-'} hs=${p['last-handshake'] || 'never'} "${p.comment || ''}"`);
  console.log(`\n-- mangle (${mangle.length}) --`);
  for (const m of mangle) console.log(`  ${m.disabled === 'true' ? '(off) ' : ''}${m.chain}/${m.action} mark=${m['new-routing-mark'] || m['routing-mark'] || '-'} dstlist=${m['dst-address-list'] || '-'} src=${m['src-address'] || '-'} "${m.comment || ''}"`);
  console.log(`\n-- routing tables (${tables.length}) --`);
  for (const t of tables) console.log(`  ${t.name} fib=${t.fib}`);
  console.log(`\n-- routes (${routes.length}) --`);
  for (const r of routes) console.log(`  ${r.disabled === 'true' ? '(off) ' : ''}${r['dst-address']} gw=${r.gateway || '-'} table=${r['routing-table'] || 'main'} active=${r.active} "${r.comment || ''}"`);
  console.log(`\n-- nat (${nat.length}) --`);
  for (const n of nat) console.log(`  ${n.disabled === 'true' ? '(off) ' : ''}${n.chain}/${n.action} out=${n['out-interface'] || '-'} src=${n['src-address'] || '-'} "${n.comment || ''}"`);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
