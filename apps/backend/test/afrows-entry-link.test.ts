import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAfrowsEntryUri,
  buildEntryLinkSet,
  customerEntryLinkRemarks,
  HEXO_RESOLVED_MAX_AGE_MS,
  parseHexoResolvedCountries,
  PUBLIC_ENTRY_LINK_REMARKS,
  readAfrowsHexoEntriesEnv,
  readAfrowsUsDirectEnv,
  readAfrowsDeEntryEnv,
  readAfrowsInboundEnv,
  readAfrowsRealityEnv,
} from '../src/client/afrows-entry-link.ts';

// Hexo entries ARE the native Afrows Shatel WS entry with a per-country ws path, so they
// resolve from the base WS inbound env (no REALITY params; the live box has no REALITY inbound).
const HEXO_ENV: Record<string, string> = {
  AFROWS_HEXO_ENTRY_ENABLED: 'true',
  AFROWS_INBOUND_MODE: 'ws',
  AFROWS_INBOUND_HOST: '185.252.30.123',
  AFROWS_INBOUND_SNI: 'app.afrows.com',
  AFROWS_INBOUND_WS_PATH: '/afrowsws',
};

test('builds a ws+tls entry uri', () => {
  const uri = buildAfrowsEntryUri(
    { mode: 'ws', host: '94.74.145.199', port: 443, serverName: 'app.afrows.com', fingerprint: 'chrome', wsPath: '/afrowsws', wsHost: 'app.afrows.com' },
    '00113fad-42da-4be7-ae1e-cce226baf47e',
    'Afrows',
  );
  assert.match(uri, /^vless:\/\/00113fad-42da-4be7-ae1e-cce226baf47e@94\.74\.145\.199:443\?/);
  assert.match(uri, /security=tls/);
  assert.match(uri, /type=ws/);
  assert.match(uri, /path=%2Fafrowsws/);
  assert.match(uri, /host=app\.afrows\.com/);
  assert.match(uri, /#Afrows$/);
});

test('builds a reality entry uri', () => {
  const uri = buildAfrowsEntryUri(
    { mode: 'reality', host: '1.2.3.4', port: 443, serverName: 'x.com', fingerprint: 'chrome', publicKey: 'PBK', shortId: 'SID', flow: 'xtls-rprx-vision' },
    'uuid-1',
    'Afrows',
  );
  assert.match(uri, /security=reality/);
  assert.match(uri, /pbk=PBK/);
  assert.match(uri, /sid=SID/);
  assert.match(uri, /flow=xtls-rprx-vision/);
});

test('readAfrowsInboundEnv ws mode', () => {
  const cfg = readAfrowsInboundEnv({
    AFROWS_INBOUND_MODE: 'ws',
    AFROWS_INBOUND_HOST: 'app.afrows.com',
    AFROWS_INBOUND_PORT: '443',
    AFROWS_INBOUND_SNI: 'app.afrows.com',
    AFROWS_INBOUND_WS_PATH: '/afrowsws',
  });
  assert.equal(cfg?.mode, 'ws');
  assert.equal(cfg?.wsPath, '/afrowsws');
  assert.equal(cfg?.port, 443);
});

test('readAfrowsInboundEnv reality default + null when missing', () => {
  assert.equal(readAfrowsInboundEnv({}), null);
  const cfg = readAfrowsInboundEnv({
    AFROWS_INBOUND_HOST: '1.2.3.4',
    AFROWS_INBOUND_REALITY_PBK: 'PBK',
    AFROWS_INBOUND_REALITY_SID: 'SID',
    AFROWS_INBOUND_REALITY_SNI: 'x.com',
  });
  assert.equal(cfg?.mode, 'reality');
  assert.equal(cfg?.publicKey, 'PBK');
});

// Deployed default: Germany is a VLESS+WS+TLS entry fronted by Cloudflare (de.afrows.com:443).
const DE_ENV = {
  AFROWS_DE_ENTRY_ENABLED: 'true',
  AFROWS_DE_ENTRY_HOST: 'de.afrows.com',
  AFROWS_DE_ENTRY_PORT: '443',
  AFROWS_DE_ENTRY_SNI: 'de.afrows.com',
  AFROWS_DE_ENTRY_WS_PATH: '/afrowsws',
};

test('readAfrowsDeEntryEnv off by default (flag unset) and when disabled', () => {
  assert.equal(readAfrowsDeEntryEnv({}), null);
  assert.equal(readAfrowsDeEntryEnv({ ...DE_ENV, AFROWS_DE_ENTRY_ENABLED: 'false' }), null);
});

test('readAfrowsDeEntryEnv null when enabled but missing host/sni', () => {
  assert.equal(readAfrowsDeEntryEnv({ ...DE_ENV, AFROWS_DE_ENTRY_HOST: '' }), null);
  assert.equal(readAfrowsDeEntryEnv({ ...DE_ENV, AFROWS_DE_ENTRY_SNI: undefined }), null);
});

test('readAfrowsDeEntryEnv (reality mode) null when missing pbk/sid', () => {
  const rEnv = { ...DE_ENV, AFROWS_DE_ENTRY_MODE: 'reality' };
  assert.equal(readAfrowsDeEntryEnv({ ...rEnv, AFROWS_DE_ENTRY_PBK: '' }), null);
});

test('readAfrowsDeEntryEnv builds the Germany WS+TLS entry when enabled + configured', () => {
  const cfg = readAfrowsDeEntryEnv(DE_ENV);
  assert.equal(cfg?.mode, 'ws');
  assert.equal(cfg?.host, 'de.afrows.com');
  assert.equal(cfg?.port, 443);
  assert.equal(cfg?.wsPath, '/afrowsws');
  const uri = buildAfrowsEntryUri(cfg!, 'uuid-de', 'Afrows Germany');
  assert.match(uri, /^vless:\/\/uuid-de@de\.afrows\.com:443\?/);
  assert.match(uri, /security=tls/);
  assert.match(uri, /type=ws/);
  assert.match(uri, /path=%2Fafrowsws/);
  assert.match(uri, /#Afrows%20Germany$/);
});

test('subscription entry order: Germany first, Ireland reality as fallback when DE on', () => {
  const de = readAfrowsDeEntryEnv(DE_ENV);
  const ie = readAfrowsRealityEnv({
    AFROWS_REALITY_HOST: '1.2.3.4',
    AFROWS_REALITY_SNI: 'x.com',
    AFROWS_REALITY_PBK: 'IE_PBK',
    AFROWS_REALITY_SID: 'IE_SID',
  });
  // Mirrors billing.service assembly: [deEntryLink, ...ireland].filter(Boolean)
  const ordered = [de, ie].filter((x): x is NonNullable<typeof x> => x !== null);
  assert.equal(ordered.length, 2);
  assert.equal(ordered[0]?.host, 'de.afrows.com'); // Germany primary
  assert.equal(ordered[1]?.host, '1.2.3.4'); // Ireland fallback
});

test('subscription entry order: DE omitted when flag off, Ireland stays primary', () => {
  const de = readAfrowsDeEntryEnv({ ...DE_ENV, AFROWS_DE_ENTRY_ENABLED: 'off' });
  const ie = readAfrowsRealityEnv({
    AFROWS_REALITY_HOST: '1.2.3.4',
    AFROWS_REALITY_SNI: 'x.com',
    AFROWS_REALITY_PBK: 'IE_PBK',
    AFROWS_REALITY_SID: 'IE_SID',
  });
  const ordered = [de, ie].filter((x): x is NonNullable<typeof x> => x !== null);
  assert.equal(ordered.length, 1);
  assert.equal(ordered[0]?.host, '1.2.3.4'); // Ireland only
});

test('DE ws entry carries ech= when AFROWS_DE_ENTRY_ECH is set (Shatel SNI workaround)', () => {
  const ech = 'crypto.cloudflare.com+udp://1.1.1.1';
  const de = readAfrowsDeEntryEnv({ ...DE_ENV, AFROWS_DE_ENTRY_ECH: ech });
  assert.equal(de?.ech, ech);
  const uri = buildAfrowsEntryUri(de!, '00000000-0000-0000-0000-000000000001', 'DE');
  const params = new URL(uri.replace('vless://', 'http://')).searchParams;
  assert.equal(params.get('ech'), ech);
  assert.equal(params.get('type'), 'ws');
});

test('ech is omitted when unset, so existing links are unchanged', () => {
  const de = readAfrowsDeEntryEnv(DE_ENV);
  assert.equal(de?.ech, undefined);
  const uri = buildAfrowsEntryUri(de!, '00000000-0000-0000-0000-000000000001', 'DE');
  assert.ok(!uri.includes('ech='));
});

test('reality links never carry ech even if set on params', () => {
  const uri = buildAfrowsEntryUri(
    { mode: 'reality', host: '1.2.3.4', port: 443, serverName: 'x.com', fingerprint: 'chrome', publicKey: 'P', shortId: 'S', ech: 'x' },
    '00000000-0000-0000-0000-000000000001',
    'R',
  );
  assert.ok(!uri.includes('ech='));
});

const BOTH_ENTRIES_ENV = {
  AFROWS_DE_ENTRY_ENABLED: 'true',
  AFROWS_DE_ENTRY_HOST: 'de.afrows.com',
  AFROWS_DE_ENTRY_SNI: 'de.afrows.com',
  AFROWS_INBOUND_MODE: 'ws',
  AFROWS_INBOUND_HOST: '94.74.145.199',
  AFROWS_INBOUND_SNI: 'app.afrows.com',
  AFROWS_INBOUND_WS_PATH: '/afrowsws',
};
const UUID = '00113fad-42da-4be7-ae1e-cce226baf47e';

test('buildEntryLinkSet: Germany first, then Iran, with per-customer remarks', () => {
  const links = buildEntryLinkSet(BOTH_ENTRIES_ENV, UUID, customerEntryLinkRemarks('ben'));
  assert.deepEqual(links.map((link) => link.kind), ['germany', 'iran']);
  assert.ok(links[0].uri.startsWith(`vless://${UUID}@de.afrows.com:443?`));
  assert.ok(links[1].uri.startsWith(`vless://${UUID}@94.74.145.199:443?`));
  assert.match(links[1].uri, /sni=app\.afrows\.com/);
  assert.match(links[1].uri, /path=%2Fafrowsws/);
  assert.ok(links[0].uri.endsWith(`#${encodeURIComponent('ben · Germany')}`));
  assert.ok(links[1].uri.endsWith(`#${encodeURIComponent('ben · Shatel')}`));
});

test('buildEntryLinkSet: public remarks are fixed ASCII with no customer name', () => {
  const links = buildEntryLinkSet(BOTH_ENTRIES_ENV, UUID, PUBLIC_ENTRY_LINK_REMARKS);
  assert.ok(links[0].uri.endsWith('#Afrows%20Germany'));
  assert.ok(links[1].uri.endsWith('#Afrows%20Shatel'));
  assert.ok(links.every((link) => /^[!-~]+$/.test(link.uri)));
});

test('buildEntryLinkSet: each link only when its env is configured; none without a uuid', () => {
  const { AFROWS_DE_ENTRY_ENABLED: _off, ...iranOnly } = BOTH_ENTRIES_ENV;
  assert.deepEqual(buildEntryLinkSet(iranOnly, UUID, PUBLIC_ENTRY_LINK_REMARKS).map((l) => l.kind), ['iran']);
  const { AFROWS_INBOUND_HOST: _h, ...germanyOnly } = BOTH_ENTRIES_ENV;
  assert.deepEqual(buildEntryLinkSet(germanyOnly, UUID, PUBLIC_ENTRY_LINK_REMARKS).map((l) => l.kind), ['germany']);
  assert.deepEqual(buildEntryLinkSet(BOTH_ENTRIES_ENV, null, PUBLIC_ENTRY_LINK_REMARKS), []);
  assert.deepEqual(buildEntryLinkSet({}, UUID, PUBLIC_ENTRY_LINK_REMARKS), []);
});

test('customerEntryLinkRemarks falls back to Afrows for a blank name', () => {
  assert.deepEqual(customerEntryLinkRemarks('  '), { germany: 'Afrows · Germany', iran: 'Afrows · Shatel', usa: 'Afrows · USA AI Support 2x', hexo: 'Afrows · Afro', deFast: 'Afrows · Germany Fast x2' });
});

test('buildEntryLinkSet: extra Iran entry hosts add "Shatel 2", "Shatel 3" right after the primary', () => {
  const env = {
    ...BOTH_ENTRIES_ENV,
    AFROWS_INBOUND_HOST: '185.252.30.123',
    AFROWS_INBOUND_EXTRA_HOSTS: ' 94.74.145.199 , bad host;rm, 185.252.30.123, 94.74.145.199, 10.0.0.9',
  };
  const links = buildEntryLinkSet(env, UUID, PUBLIC_ENTRY_LINK_REMARKS);
  assert.deepEqual(links.map((link) => link.kind), ['germany', 'iran', 'iran', 'iran']);
  assert.ok(links[1].uri.startsWith(`vless://${UUID}@185.252.30.123:443?`) && links[1].uri.endsWith('#Afrows%20Shatel'));
  assert.ok(links[2].uri.startsWith(`vless://${UUID}@94.74.145.199:443?`) && links[2].uri.endsWith('#Afrows%20Shatel%202'));
  assert.ok(links[3].uri.startsWith(`vless://${UUID}@10.0.0.9:443?`) && links[3].uri.endsWith('#Afrows%20Shatel%203'));
  // same inbound settings, only the host differs
  assert.equal(links[2].uri.split('?')[1].split('#')[0], links[1].uri.split('?')[1].split('#')[0]);
  // unset -> unchanged
  assert.equal(buildEntryLinkSet({ ...BOTH_ENTRIES_ENV }, UUID, PUBLIC_ENTRY_LINK_REMARKS).length, 2);
});

const US_DIRECT_ENV = {
  AFROWS_US_DIRECT_ENABLED: 'true',
  AFROWS_US_DIRECT_HOST: '203.0.113.7',
  AFROWS_US_DIRECT_PBK: 'pbkPUBLIC',
  AFROWS_US_DIRECT_SID: 'a1b2',
  AFROWS_US_DIRECT_REALITY_PORT: '443',
  AFROWS_US_DIRECT_REALITY_SNI: 'www.speedtest.net',
  AFROWS_US_DIRECT_XHTTP_PORT: '8080',
  AFROWS_US_DIRECT_XHTTP_PATH: '/x1',
  AFROWS_US_DIRECT_HTTP_PORT: '2095',
  AFROWS_US_DIRECT_HTTP_HOST: 'download.windowsupdate.com',
  AFROWS_US_DIRECT_HTTP_PATH: '/a/b.cab',
  AFROWS_US_DIRECT_HTTP_ENCRYPTION: 'mlkem768x25519plus.native.0rtt.KEY',
};

test('direct USA links: best-first (1 REALITY, 3 HTTP, 2 XHTTP), fixed names, Cloudflare USA last', () => {
  const links = buildEntryLinkSet({ ...BOTH_ENTRIES_ENV, ...US_DIRECT_ENV }, UUID, PUBLIC_ENTRY_LINK_REMARKS);
  const direct = links.filter((link) => link.kind === 'usa');
  assert.equal(direct.length, 3);
  const [r, h, x] = direct.map((link) => new URL(link.uri));
  assert.equal(r.host, '203.0.113.7:443');
  assert.equal(r.searchParams.get('security'), 'reality');
  assert.equal(r.searchParams.get('type'), 'tcp');
  assert.equal(r.searchParams.get('fp'), 'ios');
  assert.equal(r.searchParams.get('sni'), 'www.speedtest.net');
  assert.equal(r.searchParams.get('flow'), null);
  assert.equal(decodeURIComponent(r.hash.slice(1)), 'USA AI Support 2x · Direct 1');
  assert.equal(x.searchParams.get('type'), 'xhttp');
  assert.equal(x.searchParams.get('mode'), 'packet-up');
  assert.equal(x.searchParams.get('path'), '/x1');
  assert.equal(x.port, '8080');
  assert.equal(x.searchParams.get('security'), 'none');
  assert.equal(x.searchParams.get('host'), 'download.windowsupdate.com');
  assert.equal(x.searchParams.get('encryption'), 'mlkem768x25519plus.native.0rtt.KEY');
  assert.equal(JSON.parse(x.searchParams.get('extra') ?? '{}').xmux.cMaxReuseTimes, '1');
  assert.equal(decodeURIComponent(x.hash.slice(1)), 'USA AI Support 2x · Direct 2');
  const withCloudflare = buildEntryLinkSet(
    { ...BOTH_ENTRIES_ENV, ...US_DIRECT_ENV, AFROWS_US_ENTRY_ENABLED: 'true', AFROWS_US_ENTRY_HOST: '104.16.0.1', AFROWS_US_ENTRY_SNI: 'us.example.com' },
    UUID,
    PUBLIC_ENTRY_LINK_REMARKS,
  );
  assert.ok(withCloudflare.at(-1)?.uri.endsWith('#USA%20AI%20Support%202x'));
  assert.equal(h.searchParams.get('security'), 'none');
  assert.equal(h.searchParams.get('headerType'), 'http');
  assert.equal(h.searchParams.get('host'), 'download.windowsupdate.com');
  assert.equal(h.searchParams.get('encryption'), 'mlkem768x25519plus.native.0rtt.KEY');
  assert.equal(decodeURIComponent(h.hash.slice(1)), 'USA AI Support 2x · Direct 3');
});

test('direct USA links: off unless enabled; each transport needs its own settings', () => {
  assert.deepEqual(readAfrowsUsDirectEnv({ ...US_DIRECT_ENV, AFROWS_US_DIRECT_ENABLED: 'false' }), []);
  assert.deepEqual(readAfrowsUsDirectEnv({ ...US_DIRECT_ENV, AFROWS_US_DIRECT_HOST: '' }), []);
  const { AFROWS_US_DIRECT_HTTP_ENCRYPTION: _e, ...realityOnly } = US_DIRECT_ENV;
  assert.deepEqual(readAfrowsUsDirectEnv(realityOnly).map((entry) => entry.slot), [1]);
  assert.deepEqual(readAfrowsUsDirectEnv({ ...US_DIRECT_ENV, AFROWS_US_DIRECT_PBK: '' }).map((entry) => entry.slot), [3, 2]);
});

test('hexo entries: off unless enabled; need the base WS inbound', () => {
  assert.deepEqual(readAfrowsHexoEntriesEnv({}), []);
  assert.deepEqual(readAfrowsHexoEntriesEnv({ ...HEXO_ENV, AFROWS_HEXO_ENTRY_ENABLED: 'false' }), []);
  // enabled but no WS inbound configured -> no hexo links.
  const { AFROWS_INBOUND_HOST: _h, ...noBase } = HEXO_ENV;
  assert.deepEqual(readAfrowsHexoEntriesEnv(noBase), []);
  // enabled but the base inbound is REALITY (no WS entry) -> none (the live box has no REALITY inbound).
  assert.deepEqual(
    readAfrowsHexoEntriesEnv({
      AFROWS_HEXO_ENTRY_ENABLED: 'true',
      AFROWS_INBOUND_MODE: 'reality',
      AFROWS_INBOUND_HOST: '1.2.3.4',
      AFROWS_INBOUND_REALITY_SNI: 'x.com',
      AFROWS_INBOUND_REALITY_PBK: 'PBK',
      AFROWS_INBOUND_REALITY_SID: 'SID',
    }),
    [],
  );
});

test('hexo entries: one WS+TLS entry per country, base WS identity reused (port 443, per-country path)', () => {
  const entries = readAfrowsHexoEntriesEnv(HEXO_ENV);
  // default port map order: DE,NL,SE,TR,US,AM,RO
  assert.deepEqual(entries.map((e) => e.cc), ['DE', 'NL', 'SE', 'TR', 'US', 'AM', 'RO']);
  const de = entries[0];
  assert.equal(de.params.mode, 'ws');
  assert.equal(de.params.host, '185.252.30.123');
  assert.equal(de.params.port, 443); // customer link stays on the base WS port, NOT the per-country port
  assert.equal(de.params.serverName, 'app.afrows.com');
  assert.equal(de.params.wsHost, 'app.afrows.com');
  assert.equal(de.params.wsPath, '/afrowsws-de');
  assert.equal(entries[1].params.wsPath, '/afrowsws-nl');
});

test('hexo entries: AFROWS_HEXO_COUNTRIES narrows; AFROWS_HEXO_ENTRY_PORTS only enumerates (link stays :443)', () => {
  const entries = readAfrowsHexoEntriesEnv({
    ...HEXO_ENV,
    AFROWS_HEXO_COUNTRIES: 'DE,US',
    AFROWS_HEXO_ENTRY_PORTS: 'DE:9001,NL:9002,US:9003',
  });
  assert.deepEqual(
    entries.map((e) => [e.cc, e.params.wsPath, e.params.port]),
    [['DE', '/afrowsws-de', 443], ['US', '/afrowsws-us', 443]],
  );
});

test('buildEntryLinkSet: hexo entries appear last, kind hexo, remark "Afro <CC>", ws+tls identical to Shatel except path', () => {
  const env = { ...HEXO_ENV, AFROWS_HEXO_COUNTRIES: 'DE,NL' };
  const links = buildEntryLinkSet(env, UUID, PUBLIC_ENTRY_LINK_REMARKS);
  // the base WS inbound now also yields the native "Afrows Shatel" (iran) entry, before hexo.
  assert.deepEqual(links.map((l) => l.kind), ['iran', 'hexo', 'hexo']);
  const hexo = links.filter((l) => l.kind === 'hexo');
  assert.ok(hexo[0].uri.endsWith('#Afro%20DE'));
  assert.ok(hexo[1].uri.endsWith('#Afro%20NL'));
  assert.match(hexo[0].uri, /security=tls/);
  assert.match(hexo[0].uri, /type=ws/);
  assert.match(hexo[0].uri, /path=%2Fafrowsws-de/);
  assert.match(hexo[0].uri, /:443\?/);
  // no uuid leakage of a Hexogate credential: the link carries the customer's own uuid
  assert.ok(hexo[0].uri.startsWith(`vless://${UUID}@185.252.30.123:443`));
  // byte-identical to the native "Afrows Shatel" (iran) entry EXCEPT the ws path.
  const q = (uri: string) => new URL(uri.replace('vless://', 'http://')).searchParams;
  const iranQ = q(links[0].uri);
  const hexoQ = q(hexo[0].uri);
  assert.equal(iranQ.get('path'), '/afrowsws');
  assert.equal(hexoQ.get('path'), '/afrowsws-de');
  for (const key of ['security', 'type', 'sni', 'host', 'fp', 'encryption']) {
    assert.equal(hexoQ.get(key), iranQ.get(key), `param ${key} must match the Shatel entry`);
  }
});

// --- Finding 6: resolved-countries state (no dead links) ----------------------
const NOW = 1_800_000_000_000; // fixed "now" in ms

test('parseHexoResolvedCountries: fresh file -> UPPERCASE CC set (reconciler writes lowercase + unix seconds)', () => {
  const fresh = JSON.stringify({ countries: ['de', 'nl'], updated_at: Math.floor(NOW / 1000) });
  const set = parseHexoResolvedCountries(fresh, NOW);
  assert.deepEqual(set && [...set].sort(), ['DE', 'NL']);
});

test('parseHexoResolvedCountries: absent/malformed/non-object/bad-shape -> null (fall back)', () => {
  assert.equal(parseHexoResolvedCountries(null, NOW), null);
  assert.equal(parseHexoResolvedCountries('', NOW), null);
  assert.equal(parseHexoResolvedCountries('not json', NOW), null);
  assert.equal(parseHexoResolvedCountries('123', NOW), null);
  assert.equal(parseHexoResolvedCountries(JSON.stringify({ countries: 'de', updated_at: NOW / 1000 }), NOW), null);
  assert.equal(parseHexoResolvedCountries(JSON.stringify({ countries: ['de'] }), NOW), null); // no updated_at
});

test('parseHexoResolvedCountries: stale beyond 30 min (and absurd future clock) -> null (fall back)', () => {
  const staleSecs = Math.floor((NOW - HEXO_RESOLVED_MAX_AGE_MS - 1000) / 1000);
  assert.equal(parseHexoResolvedCountries(JSON.stringify({ countries: ['de'], updated_at: staleSecs }), NOW), null);
  const futureSecs = Math.floor((NOW + HEXO_RESOLVED_MAX_AGE_MS + 1000) / 1000);
  assert.equal(parseHexoResolvedCountries(JSON.stringify({ countries: ['de'], updated_at: futureSecs }), NOW), null);
  // Just-inside-the-window is accepted.
  const edgeSecs = Math.floor((NOW - HEXO_RESOLVED_MAX_AGE_MS + 1000) / 1000);
  assert.deepEqual([...(parseHexoResolvedCountries(JSON.stringify({ countries: ['de'], updated_at: edgeSecs }), NOW) ?? [])], ['DE']);
});

test('parseHexoResolvedCountries: fresh but EMPTY countries -> empty set (advertise no hexo), distinct from null', () => {
  const set = parseHexoResolvedCountries(JSON.stringify({ countries: [], updated_at: Math.floor(NOW / 1000) }), NOW);
  assert.ok(set instanceof Set);
  assert.equal(set?.size, 0);
});

test('readAfrowsHexoEntriesEnv: resolved set filters to live countries; null = all configured; empty = none', () => {
  // configured = DE,NL,SE,TR,US,AM,RO (default ports); resolved to just DE + US.
  assert.deepEqual(readAfrowsHexoEntriesEnv(HEXO_ENV, new Set(['DE', 'US'])).map((e) => e.cc), ['DE', 'US']);
  // resolved AND the AFROWS_HEXO_COUNTRIES narrowing both apply (intersection).
  assert.deepEqual(
    readAfrowsHexoEntriesEnv({ ...HEXO_ENV, AFROWS_HEXO_COUNTRIES: 'DE,NL' }, new Set(['NL', 'US'])).map((e) => e.cc),
    ['NL'],
  );
  // null -> fall back to every configured country (unchanged behaviour).
  assert.equal(readAfrowsHexoEntriesEnv(HEXO_ENV, null).length, 7);
  // empty resolved set -> no entries (the reconciler says zero listeners are live).
  assert.deepEqual(readAfrowsHexoEntriesEnv(HEXO_ENV, new Set()), []);
});

// --- BILLING-CRITICAL: Germany Fast x2 link requires the DEF meter (fail-closed) ----------------
// The direct DEF (2x) entry env and the DEF meter env both default OFF and must be enabled together.
// If AFROWS_DEF_DIRECT_ENABLED is on WITHOUT AFROWS_DEF_MGMT_ENABLED, the fast link must NOT ship,
// or every customer gets unmetered (free) premium traffic. Mirrors the USA link/mgmt coupling.
const DEF_DIRECT_ENV = {
  AFROWS_DEF_DIRECT_ENABLED: 'true',
  AFROWS_DEF_DIRECT_HOST: '198.51.100.9',
  AFROWS_DEF_DIRECT_PBK: 'defPUBLIC',
  AFROWS_DEF_DIRECT_SID: 'c3d4',
  AFROWS_DEF_DIRECT_REALITY_PORT: '8443',
  AFROWS_DEF_DIRECT_REALITY_SNI: 'www.microsoft.com',
};

test('buildEntryLinkSet: Germany Fast x2 is OMITTED when DIRECT on but DEF meter off (no free premium)', () => {
  const env = { ...BOTH_ENTRIES_ENV, ...DEF_DIRECT_ENV }; // AFROWS_DEF_MGMT_ENABLED unset -> meter off
  const links = buildEntryLinkSet(env, UUID, PUBLIC_ENTRY_LINK_REMARKS);
  assert.ok(!links.some((l) => l.uri.endsWith('#Germany%20Fast%20x2')), 'fast link must not ship without its meter');
  // Only the Cloudflare Germany entry + Iran remain (no second `germany` fast link).
  assert.deepEqual(links.map((l) => l.kind), ['germany', 'iran']);
});

test('buildEntryLinkSet: Germany Fast x2 is PRESENT when DIRECT on AND DEF meter on', () => {
  const env = { ...BOTH_ENTRIES_ENV, ...DEF_DIRECT_ENV, AFROWS_DEF_MGMT_ENABLED: 'true' };
  const links = buildEntryLinkSet(env, UUID, PUBLIC_ENTRY_LINK_REMARKS);
  assert.deepEqual(links.map((l) => l.kind), ['germany', 'germany', 'iran']);
  const fast = links.find((l) => l.uri.endsWith('#Germany%20Fast%20x2'));
  assert.ok(fast, 'fast link must ship when the meter is enabled');
  assert.ok(fast!.uri.startsWith(`vless://${UUID}@198.51.100.9:8443?`));
  assert.match(fast!.uri, /security=reality/);
  // The fast link sits right after the Cloudflare Germany entry.
  assert.ok(links[1].uri.endsWith('#Germany%20Fast%20x2'));
});

test('buildEntryLinkSet: hexoResolved filters the emitted Hexo links to live countries only', () => {
  const env = { ...HEXO_ENV, AFROWS_HEXO_COUNTRIES: 'DE,NL,SE' };
  const hexoRemarks = (resolved?: ReadonlySet<string> | null) =>
    buildEntryLinkSet(env, UUID, PUBLIC_ENTRY_LINK_REMARKS, resolved)
      .filter((l) => l.kind === 'hexo')
      .map((l) => l.uri.split('#')[1]);
  assert.deepEqual(hexoRemarks(new Set(['DE'])), ['Afro%20DE']);
  assert.deepEqual(hexoRemarks(null), ['Afro%20DE', 'Afro%20NL', 'Afro%20SE']);
  assert.deepEqual(hexoRemarks(new Set()), []);
});
