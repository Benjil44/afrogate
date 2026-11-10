#!/usr/bin/env python3
"""Afrows egress-mode + per-account tier reconciler.

Two jobs, applied to the client egress engines (afrows-wg, afrows-xray):

1) Global egress mode (egress_settings.mode):
   smart  = geoip:ir/private + geosite:category-ir -> direct, else -> proxy pool
   full   = everything from client inbounds -> proxy pool

2) Per-account GAMING tier (customer_accounts.egress_tier='gaming') -> the
   `via-village` outbound (a freedom outbound bound to wg-village -> the village
   Starlink, low ping/jitter). Normal accounts keep going to the proxy pool
   (Germany/relays). Two matchers, since the two engines identify a client
   differently:
     - afrows-wg : by SOURCE IP (wireguard_peers.client_address).
     - afrows-xray: by VLESS USER email (cc_<client_config_id>@afrows), since
       app clients share the inbound and have no stable source IP. The router
       tunnel source IPs (env/Microtiks game toggle) still apply to afrows-xray
       too. Ireland traffic already split to `direct` above, so only foreign egress
       is diverted to Starlink.

Idempotent: only rewrites + restarts a service when its routing/outbounds change.
No secrets in this file. Run by the afrows-egress-mode-sync systemd timer.
"""
import glob, json, os, subprocess, sys, time

# ---- P2 egress state machine (inlined; kept in this file so the reconciler stays a
# self-contained single script the operator deploys — no sibling-import dependency).
# Pure/deterministic: asymmetric hysteresis (fail out fast, fail back slow) + a flapping
# circuit breaker + a bounded transition log. `seq` (stored in state) is the time proxy,
# so the breaker window is in decisions (matching the 1/min cadence). The priority ORDER
# is unchanged from the prior inline logic (reordering it is P4). Tested by
# scripts/test_egress_state.py (which loads these from this module).
EGRESS_STATE_DEFAULTS = {
    "k_out": 2,           # strikes to leave a higher-priority path that went unhealthy
    "k_back": 3,          # strikes to return to a recovered higher-priority path (slower)
    "breaker_window": 10, # recent decisions defining "recent" (~10 min @ 1/min)
    "breaker_max": 4,     # transitions within the window that mark the lane flapping
    "breaker_extra": 2,   # extra strikes required while flapping (damping)
}
# Explicit priority ladders (most-preferred first). via-backup (2026-10-28) is the
# optional second foreign transport (AFROWS_BACKUP_CHAIN_*): when the primary chain is
# down, customers move to it instead of the relay pool / direct (Iranian internet,
# where YouTube/Instagram/Telegram are blocked). Unconfigured -> never wanted, so the
# ladder behaves exactly as via-germany > proxy > direct.
CATCHALL_ORDER = ["via-germany", "via-backup", "proxy", "direct"]
GAMING_ORDER = ["via-village", "via-germany", "proxy"]


def rank(order, tag):
    """Priority rank of a tag: 0 = most preferred; unknown tags rank last."""
    return order.index(tag) if tag in order else len(order)


def _state(applied, pending, count, seq, transitions, tripped):
    return {
        "applied": applied, "pending": pending, "count": count, "seq": seq,
        "transitions": list(transitions),
        "breaker": {"tripped": bool(tripped), "recent": len(transitions)},
    }


def decide(want, state, order, cfg=None):
    """Pure asymmetric-hysteresis + circuit-breaker transition. Returns (applied, new_state)."""
    c = {**EGRESS_STATE_DEFAULTS, **(cfg or {})}
    seq = int(state.get("seq", 0)) + 1
    applied = state.get("applied", want)
    transitions = [t for t in state.get("transitions", []) if t > seq - c["breaker_window"]]
    flapping = len(transitions) >= c["breaker_max"]
    if want == applied:
        return applied, _state(applied, want, 0, seq, transitions, flapping)
    recovering = rank(order, want) < rank(order, applied)
    need = c["k_back"] if recovering else c["k_out"]
    if flapping:
        need += c["breaker_extra"]
    cnt = (int(state.get("count", 0)) + 1) if state.get("pending") == want else 1
    if cnt >= need:
        transitions = transitions + [seq]
        return want, _state(want, want, 0, seq, transitions, len(transitions) >= c["breaker_max"])
    return applied, _state(applied, want, cnt, seq, transitions, flapping)

ENV = os.environ.get("AFROWS_ENV", "/etc/afrows/afrows.env")
XRAY = os.environ.get("AFROWS_XRAY_BIN", "/usr/local/bin/xray")
# (config, service, gaming_tier_applies)
TARGETS = [
    ("/usr/local/etc/afrows-wg/config.json", "afrows-wg", True),
    ("/usr/local/etc/afrows-xray/config.json", "afrows-xray", False),
]
GEOIP_DIRECT = {"type": "field", "ip": ["geoip:private", "geoip:ir"], "outboundTag": "direct"}
GEOSITE_DIRECT = {"type": "field", "domain": ["geosite:category-ir"], "outboundTag": "direct"}
# Trusted resolver for domainStrategy IPIfNonMatch. The box's default resolver is
# the Irelandian FILTERED one, which resolves geo-localized CDNs/APIs (Apple
# WeatherKit, weather.com, AccuWeather, qweather, Android weather) into Irelandian
# IP space, so geoip:ir wrongly matches them and sends them out the censored
# `direct` uplink -> dead. Resolving against a clean resolver puts those CDNs in
# FOREIGN IP space, so they miss geoip:ir and fall through to the `proxy`
# catch-all and work. Domestic .ir sites still resolve to Irelandian IPs (and
# geosite:category-ir matches them by domain first, before any IP resolution), so
# geoip:ir -> direct keeps working for genuine domestic traffic.
# The DNS "tag" makes the xray DNS client lookups routable (the DoH/8.8.8.8 servers
# below are foreign and unreachable on the filtered uplink): a system rule sends
# DNS_TAG to the current foreign catch-all, so lookups ride the same working path
# as customer traffic instead of silently falling to the first outbound.
DNS_TAG = "dns-internal"
DNS_TRUSTED = {"servers": ["https://1.1.1.1/dns-query", "8.8.8.8", "https://dns.google/dns-query"],
               "queryStrategy": "UseIP", "tag": DNS_TAG}
VIA_VILLAGE_OUT = {"protocol": "freedom", "tag": "via-village",
                   "streamSettings": {"sockopt": {"interface": "wg-village"}}}
# Legacy Germany egress: freedom bound to wg-village-de. Only correct while the
# village MikroTik forwards that tunnel to Germany; since the 2026-10-04 village
# rebuild it NATs out Irancell instead (customers exit in Iran), so when the CF
# chain below is configured it is kept only as the manual fallback
# "via-village-legacy".
VIA_GERMANY_OUT = {"protocol": "freedom", "tag": "via-germany",
                   "streamSettings": {"sockopt": {"interface": "wg-village-de"}}}
VIA_VILLAGE_LEGACY_OUT = dict(VIA_GERMANY_OUT, tag="via-village-legacy")
# Village-independent Germany egress (2026-10-05): VLESS-WS-TLS to the Germany
# afrows-xray-de through Cloudflare (de.afrows.com /afrowsws) as ONE dedicated
# system user (email afrows-chain@afrows: ignored by the Germany cc_-only usage
# recorder and never touched by the backend cc_-only adu/rmu). No sockopt binding
# on purpose: the kernel route to the CF ranges is owned by afrows-cf-route (eth0
# when the DC lets CF through, else wg-village-de, else wg-home), so the chain
# follows whichever path currently reaches Cloudflare. Enabled only when
# AFROWS_DE_CHAIN_UUID is set in the env file (the uuid is a credential, never in
# the repo); unset -> legacy behavior, nothing changes.
CHAIN_PROBE_TAG = "chain-probe"
CHAIN_PROBE_SVC = "afrows-xray"  # engine that hosts the local chain probe inbound
# USA exit management path (2026-10-08, infra/usa/README.md): VLESS-WS-TLS through
# Cloudflare (us.afrows.com /afrowsus) to the USA xray as the system user
# afrows-chain@afrows, whose ONLY private-address exception on the USA is
# 127.0.0.1:22. A loopback-only socks inbound us-mgmt-socks -> via-usa carries the
# backend's forced-command mgmt SSH (adu/rmu/read-usage); no customer traffic is
# routed to via-usa here (CATCHALL_ORDER is unchanged). Enabled only when
# AFROWS_US_CHAIN_UUID is set in the env file; unset -> neither object exists (a
# previously rendered pair is removed, so unsetting is the rollback).
US_MGMT_TAG = "us-mgmt-socks"
US_CHAIN_TAG = "via-usa"
# Backup foreign transport (2026-10-28): a second chain outbound built by the same
# chain_outbound() (mode reality / ss / ws) from AFROWS_BACKUP_CHAIN_*, plus a
# loopback probe socks (backup-probe, 127.0.0.1:10813) routed to it. Iranian DPI
# tends to freeze one transport while another still passes (SS-2022 outages of
# ~20 min while REALITY kept working), so the catch-all fails over to it before
# falling to the relay pool / direct. Rendered on every engine that carries the
# catch-all (so it is always a valid target); the probe inbound only on afrows-xray.
# Env unset -> neither object exists (a previously rendered pair is removed).
BACKUP_TAG = "via-backup"
BACKUP_PROBE_TAG = "backup-probe"
SYSTEM_INBOUND_TAGS = {"api", CHAIN_PROBE_TAG, DNS_TAG, US_MGMT_TAG, BACKUP_PROBE_TAG}
# Self-healing foreign egress: probe the relay pool (socks); when it can't carry
# traffic, send the normal foreign catch-all to via-village (owned Germany/Starlink)
# instead of the dead pool, and flip back when the pool recovers.
POOL_SOCKS = os.environ.get("AFROWS_POOL_SOCKS", "127.0.0.1:10808")
# The 'proxy' reserve outbound: a socks client into the uplink xray, where
# afrows-uplink-pool-sync renders the operator's added Exit-page VLESS exits as
# relay-* members. Guaranteed to exist (see apply_target) so a failover that
# selects 'proxy' can never fail `xray -test` and silently abort, pinning the
# engine to a dead primary path. It is only SELECTED when pool_alive() confirms
# it carries traffic, so guaranteeing the outbound is safe even when the uplink
# pool is empty/down (xray -test validates syntax, not connectivity).
_PROXY_HOST, _, _PROXY_PORT = POOL_SOCKS.partition(":")
PROXY_OUT = {"protocol": "socks", "tag": "proxy",
             "settings": {"servers": [{"address": _PROXY_HOST or "127.0.0.1",
                                        "port": int(_PROXY_PORT or "10808")}]}}
POOL_PROBE_URLS = ["https://www.gstatic.com/generate_204", "http://cp.cloudflare.com/generate_204"]
STATE_FILE = "/var/lib/afrows/egress-pool.state"
GAMING_STATE_FILE = "/var/lib/afrows/egress-gaming.state"
HEALTH_FILE = "/var/lib/afrows/egress-health.json"
# Extra source IPs to route to via-village regardless of DB tier (e.g. the home
# router's tunnel IP on afrows-xray, for the operator's own gaming) — read from
# the env FILE in main() (systemd has no shell env).


def log(*a):
    print("[egress-mode]", *a, flush=True)


def prune_backups(path, keep=5):
    """Keep only the newest `keep` <path>.bak-* files; delete older ones. These backups hold
    tunnel/chain credentials (REALITY keys, chain UUIDs, SS passwords), so an unbounded pile
    accumulating once/min is a liability."""
    try:
        for old in sorted(glob.glob(path + ".bak-*"))[:-keep]:
            os.remove(old)
    except Exception:
        pass


def file_env(key, default=""):
    try:
        with open(ENV) as f:
            for line in f:
                if line.startswith(key + "="):
                    return line.split("=", 1)[1].strip().strip('"').strip("\r")
    except Exception:
        pass
    return os.environ.get(key, default)


def reality_cfg(prefix):
    """Optional direct (non-Cloudflare) VLESS+REALITY entry for a chain, from
    <prefix>_MODE=reality + _PORT/_REALITY_PBK/_REALITY_SID/_REALITY_SNI (2026-10-20:
    the زیرساخت DC throttles Cloudflare but reaches the exits directly). Mode unset ->
    {} and the chain stays VLESS-WS-TLS via Cloudflare. _REALITY_FLOW (e.g.
    xtls-rprx-vision; must match the exit's inbound) and _REALITY_FP (uTLS fingerprint)
    are optional (2026-10-25: DPI froze the plain, muxed chain; Vision got through).
    "randomized" falls back to chrome: xray's random uTLS hello offers curves REALITY
    rejects ("CurvePreferences includes unsupported curve"), failing most dials (2026-10-26)."""
    if file_env(prefix + "_MODE") != "reality":
        return {}
    fp = file_env(prefix + "_REALITY_FP", "chrome")
    return {
        "mode": "reality",
        "port": int(file_env(prefix + "_PORT", "8443")),
        "pbk": file_env(prefix + "_REALITY_PBK"),
        "sid": file_env(prefix + "_REALITY_SID"),
        "sni": file_env(prefix + "_REALITY_SNI", "dl.google.com"),
        "flow": file_env(prefix + "_REALITY_FLOW", ""),
        "fp": "chrome" if fp in ("random", "randomized") else fp,
    }


def ss_cfg(prefix):
    """Optional Shadowsocks-2022 chain straight to the exit, from <prefix>_MODE=ss +
    _PORT/_SS_PASSWORD (multi-user "serverPSK:userPSK")/_SS_METHOD. From the زیرساخت DC
    it was the only transport DPI left alone in every round (2026-10-26: SS-2022 14-20/20,
    REALITY 0-18/20). Mode not ss -> {}."""
    if file_env(prefix + "_MODE") != "ss":
        return {}
    return {
        "mode": "ss",
        "port": int(file_env(prefix + "_PORT", "8447")),
        "ss_method": file_env(prefix + "_SS_METHOD", "2022-blake3-aes-128-gcm"),
        "ss_password": file_env(prefix + "_SS_PASSWORD"),
    }


def xhttp_cfg(prefix):
    """Optional VLESS + XHTTP packet-up chain straight to the exit, from <prefix>_MODE=xhttp +
    _PORT/_PATH/_XHTTP_ENCRYPTION (the VLESS Encryption client string from `xray vlessenc`,
    default "none")/_XHTTP_POST_BYTES/_XHTTP_POST_INTERVAL_MS. 2026-10-28: from the
    zirsakht DC every upload flow to the USA IP loses ~80% of its packets after its first
    ~40 (per 5-tuple, any protocol, any payload); packet-up with one POST per fresh TCP
    connection keeps each flow under that quota. Mode not xhttp -> {}."""
    if file_env(prefix + "_MODE") != "xhttp":
        return {}
    return {
        "mode": "xhttp",
        "port": int(file_env(prefix + "_PORT", "8448")),
        "xhttp_encryption": file_env(prefix + "_XHTTP_ENCRYPTION", "none") or "none",
        "xhttp_post_bytes": int(file_env(prefix + "_XHTTP_POST_BYTES", "32000")),
        "xhttp_post_interval_ms": int(file_env(prefix + "_XHTTP_POST_INTERVAL_MS", "5")),
    }


def chain_cfg():
    """Germany chain settings from the env file, or None when not configured."""
    uuid = file_env("AFROWS_DE_CHAIN_UUID")
    if not uuid:
        return None
    host, _, port = file_env("AFROWS_CHAIN_PROBE_SOCKS", "127.0.0.1:10812").partition(":")
    return dict({
        "uuid": uuid,
        "address": file_env("AFROWS_DE_CHAIN_ADDRESS", "172.64.34.62"),
        "host": file_env("AFROWS_DE_CHAIN_HOST", "de.afrows.com"),
        "path": file_env("AFROWS_DE_CHAIN_PATH", "/afrowsws"),
        "probe_host": host or "127.0.0.1",
        "probe_port": int(port or "10812"),
    }, **reality_cfg("AFROWS_DE_CHAIN"), **ss_cfg("AFROWS_DE_CHAIN"), **xhttp_cfg("AFROWS_DE_CHAIN"))


def us_chain_cfg():
    """USA chain (mgmt path) settings from the env file, or None when not configured."""
    uuid = file_env("AFROWS_US_CHAIN_UUID")
    if not uuid:
        return None
    host, _, port = file_env("AFROWS_US_MGMT_SOCKS", "127.0.0.1:1083").partition(":")
    return dict({
        "uuid": uuid,
        "address": file_env("AFROWS_US_CHAIN_ADDRESS", "172.64.34.62"),
        "host": file_env("AFROWS_US_CHAIN_HOST", "us.afrows.com"),
        "path": file_env("AFROWS_US_CHAIN_PATH", "/afrowsus"),
        "socks_host": host or "127.0.0.1",
        "socks_port": int(port or "1083"),
    }, **reality_cfg("AFROWS_US_CHAIN"), **ss_cfg("AFROWS_US_CHAIN"))


def backup_cfg():
    """Backup chain settings from the env file, or None when not configured.
    AFROWS_BACKUP_CHAIN_MODE selects the transport: reality / ss / xhttp reuse
    reality_cfg / ss_cfg / xhttp_cfg (same keys as the other chains, prefix
    AFROWS_BACKUP_CHAIN), ws is the Cloudflare VLESS-WS chain (_HOST/_PATH). Needs
    _ADDRESS and the mode credential (_UUID for reality/ws/xhttp, _SS_PASSWORD for ss);
    anything missing -> None (disabled)."""
    p = "AFROWS_BACKUP_CHAIN"
    mode = file_env(p + "_MODE").lower()
    address = file_env(p + "_ADDRESS")
    if mode not in ("reality", "ss", "ws", "xhttp") or not address:
        return None
    if mode == "ss" and not file_env(p + "_SS_PASSWORD"):
        return None
    if mode != "ss" and not file_env(p + "_UUID"):
        return None
    host, _, port = file_env("AFROWS_BACKUP_PROBE_SOCKS", "127.0.0.1:10813").partition(":")
    return dict({
        "uuid": file_env(p + "_UUID"),
        "address": address,
        "host": file_env(p + "_HOST", ""),
        "path": file_env(p + "_PATH", "/"),
        # ws via Cloudflare: uTLS fingerprint (the زیرساخت DC blocks chrome; ios passes, 2026-11-02)
        "ws_fp": file_env(p + "_WS_FP", "chrome"),
        "ws_mux": file_env(p + "_WS_MUX", "on").lower() not in ("0", "off", "false", "no"),
        "probe_host": host or "127.0.0.1",
        "probe_port": int(port or "10813"),
    }, **reality_cfg(p), **ss_cfg(p), **xhttp_cfg(p))


def backup_probe_inbound(c):
    """Loopback-only socks inbound routed to via-backup (health probe of the backup chain)."""
    return {"tag": BACKUP_PROBE_TAG, "listen": c["probe_host"], "port": c["probe_port"],
            "protocol": "socks", "settings": {"auth": "noauth", "udp": False}}


def us_mgmt_inbound(c):
    """Loopback-only socks inbound routed to via-usa: the mgmt SSH ProxyCommand target."""
    return {"tag": US_MGMT_TAG, "listen": c["socks_host"], "port": c["socks_port"],
            "protocol": "socks", "settings": {"auth": "noauth", "udp": False}}


def upsert_tagged(items, want):
    """Insert `want` into a list of tagged xray objects, or replace the same-tag entry in
    place when it differs. Returns True when the list changed."""
    for i, x in enumerate(items):
        if x.get("tag") == want["tag"]:
            if x == want:
                return False
            items[i] = want
            return True
    items.append(want)
    return True


def drop_tagged(items, tag):
    """Remove every entry with the given tag. Returns True when the list changed."""
    keep = [x for x in items if x.get("tag") != tag]
    changed = len(keep) != len(items)
    items[:] = keep
    return changed


def chain_outbound(c, tag="via-germany"):
    """A chain outbound (via-germany, or via-usa); deterministic per env. VLESS-WS-TLS
    through Cloudflare by default; VLESS+REALITY straight to the exit (address = the
    exit's own IP) when the chain's mode is "reality"; Shadowsocks-2022 to the exit when
    it is "ss" (no mux, for the same reason as REALITY); VLESS + XHTTP packet-up when it
    is "xhttp" (no mux: the transport itself spreads the upload over short flows)."""
    if c.get("mode") == "ss":
        return {
            "tag": tag, "protocol": "shadowsocks",
            "settings": {"servers": [{"address": c["address"], "port": c["port"],
                                      "method": c["ss_method"], "password": c["ss_password"]}]},
        }
    if c.get("mode") == "xhttp":
        # One POST per fresh TCP connection (every xmux field set, as xray requires when
        # any is): each upload flow stays below the per-flow packet quota, after which
        # Iranian DPI drops ~80% of that flow's upstream packets (2026-10-28).
        extra = {
            "scMaxEachPostBytes": str(c["xhttp_post_bytes"]),
            "scMinPostsIntervalMs": str(c["xhttp_post_interval_ms"]),
            "xmux": {"maxConcurrency": "1", "maxConnections": 0, "cMaxReuseTimes": "1",
                     "hMaxRequestTimes": "1", "hMaxReusableSecs": "5-10", "hKeepAlivePeriod": 0},
        }
        return {
            "tag": tag, "protocol": "vless",
            "settings": {"vnext": [{"address": c["address"], "port": c["port"],
                                    "users": [{"id": c["uuid"], "encryption": c["xhttp_encryption"],
                                               "level": 0}]}]},
            "streamSettings": {"network": "xhttp", "security": "none",
                               "xhttpSettings": {"path": c["path"], "mode": "packet-up", "extra": extra}},
        }
    user = {"id": c["uuid"], "encryption": "none", "level": 0}
    # Mux: every customer shares this one chain, and each new stream otherwise
    # pays a fresh TCP+TLS+WS setup over LTE+CF (~1.3s TTFB measured vs ~0.5s
    # muxed). UDP/443 (QUIC) is rejected so apps fall back to TCP, which this
    # TCP-carried tunnel serves better.
    mux = {"enabled": True, "concurrency": 8, "xudpConcurrency": 16, "xudpProxyUDP443": "reject"}
    if c.get("mode") == "reality":
        port = c["port"]
        stream = {
            "network": "tcp", "security": "reality",
            "realitySettings": {"serverName": c["sni"], "fingerprint": c.get("fp") or "chrome",
                                "publicKey": c["pbk"], "shortId": c["sid"]},
        }
        if c.get("flow"):
            user["flow"] = c["flow"]
        # No mux on the direct REALITY chain: when Iranian DPI freezes a flow, a
        # muxed chain hangs every customer stream inside that one dead connection
        # (2026-10-25 outage); separate flows lose only the frozen request.
        mux = None
    else:
        port = 443
        stream = {
            "network": "ws", "security": "tls",
            "tlsSettings": {"serverName": c["host"], "fingerprint": c.get("ws_fp") or "chrome", "alpn": ["http/1.1"]},
            "wsSettings": {"path": c["path"], "host": c["host"]},
        }
        # <prefix>_WS_MUX=off: no mux (one muxed flow frozen by DPI hangs every stream in it;
        # the Cloudflare->Germany backup from the زیرساخت DC went 8/8 without mux, 1/5 with, 2026-11-02)
        if c.get("ws_mux") is False:
            mux = None
    return dict({
        "tag": tag, "protocol": "vless",
        "settings": {"vnext": [{"address": c["address"], "port": port, "users": [user]}]},
        "streamSettings": stream,
    }, **({"mux": mux} if mux else {}))


def chain_probe_inbound(c):
    """Loopback-only socks inbound routed to via-germany, used solely to health-probe
    the chain end-to-end (exit really in Germany), not just the first-hop interface."""
    return {"tag": CHAIN_PROBE_TAG, "listen": c["probe_host"], "port": c["probe_port"],
            "protocol": "socks", "settings": {"auth": "noauth", "udp": False}}


def db_url():
    u = file_env("DATABASE_URL")
    if not u:
        raise SystemExit("DATABASE_URL not found in " + ENV)
    return u


def psql1(url, q):
    out = subprocess.run(["psql", url, "-t", "-A", "-c", q], capture_output=True, text=True, timeout=20)
    return (out.stdout or "").strip() if out.returncode == 0 else None


def read_mode(url):
    m = psql1(url, "select mode from egress_settings where id=true limit 1;")
    return m if m in ("smart", "full") else "smart"


def gaming_ips(url):
    s = psql1(url, (
        "select coalesce(string_agg(wp.client_address, ',' order by wp.client_address), '') from wireguard_peers wp "
        "join client_configs cc on cc.id = wp.client_config_id "
        "join customer_accounts ca on ca.id = cc.customer_account_id "
        "where ca.egress_tier = 'gaming' and wp.desired_state = 'present' "
        "and wp.client_address is not null"
    ))
    return [x.strip() for x in s.split(",") if x.strip()] if s else []


def router_gaming_ips(url):
    """Source IPs of operator MikroTik routers toggled to game mode (the Microtiks panel)."""
    s = psql1(url, (
        "select coalesce(string_agg(gaming_source_ip, ',' order by gaming_source_ip), '') from mikrotik_routers "
        "where gaming_enabled = true and gaming_source_ip is not null and gaming_source_ip <> ''"
    ))
    return [x.strip() for x in s.split(",") if x.strip()] if s else []


def xray_gaming_emails(url):
    """VLESS provisioning emails (cc_<client_config_id>@afrows) of gaming-tier
    accounts' active client configs — the same emails XrayProvisioningService
    registers via `xray api adu`, so xray routing can match them by `user`."""
    s = psql1(url, (
        "select coalesce(string_agg('cc_' || cc.id || '@afrows', ',' order by cc.id), '') "
        "from client_configs cc "
        "join customer_accounts ca on ca.id = cc.customer_account_id "
        "where ca.egress_tier = 'gaming' and cc.status <> 'disabled'"
    ))
    return [x.strip() for x in s.split(",") if x.strip()] if s else []


# ---- P4 Part B (flag-gated) — opt-in MikroTik-direct bypass allow-list ----------
# The checkbox in the Customers table sets customer_accounts.egress_bypass_enabled.
# When VLESS/foreign egress is FULLY down (the catch-all fell to 'direct'), ONLY these
# customers are routed to a configurable MikroTik-direct outbound (AFROWS_BYPASS_OUTBOUND);
# everyone else waits for VLESS. Master flag AFROWS_BYPASS_ENABLED defaults OFF, so this
# changes nothing until the operator confirms the direct path (reachability probe) and
# points AFROWS_BYPASS_OUTBOUND at the real MikroTik-direct tag, then flips the flag.
def bypass_ips(url):
    """afrows-wg peer source IPs of active bypass-listed customers."""
    s = psql1(url, (
        "select coalesce(string_agg(wp.client_address, ',' order by wp.client_address), '') from wireguard_peers wp "
        "join client_configs cc on cc.id = wp.client_config_id "
        "join customer_accounts ca on ca.id = cc.customer_account_id "
        "where ca.egress_bypass_enabled = true and ca.status = 'active' "
        "and wp.desired_state = 'present' and wp.client_address is not null"
    ))
    return [x.strip() for x in s.split(",") if x.strip()] if s else []


def bypass_xray_emails(url):
    """afrows-xray VLESS emails (cc_<id>@afrows) of active bypass-listed customers."""
    s = psql1(url, (
        "select coalesce(string_agg('cc_' || cc.id || '@afrows', ',' order by cc.id), '') "
        "from client_configs cc "
        "join customer_accounts ca on ca.id = cc.customer_account_id "
        "where ca.egress_bypass_enabled = true and ca.status = 'active' and cc.status <> 'disabled'"
    ))
    return [x.strip() for x in s.split(",") if x.strip()] if s else []


# D2: per-client-config FIXED egress path -> outbound tag (germany/village/direct).
PATH_TAGS = {"germany": "via-germany", "village": "via-village", "direct": "direct"}


def path_xray_users(url, path):
    """VLESS emails of active client configs pinned to this fixed egress path."""
    s = psql1(url, (
        "select coalesce(string_agg('cc_' || cc.id || '@afrows', ',' order by cc.id), '') "
        "from client_configs cc "
        "join client_route_preferences rp on rp.client_config_id = cc.id "
        "join customer_accounts ca on ca.id = cc.customer_account_id "
        "where rp.preferred_egress_path = '%s' and cc.status <> 'disabled' and ca.status = 'active'" % path
    ))
    return [x.strip() for x in s.split(",") if x.strip()] if s else []


def path_wg_sources(url, path):
    """afrows-wg peer source IPs of active client configs pinned to this path."""
    s = psql1(url, (
        "select coalesce(string_agg(wp.client_address, ',' order by wp.client_address), '') "
        "from wireguard_peers wp "
        "join client_route_preferences rp on rp.client_config_id = wp.client_config_id "
        "join client_configs cc on cc.id = wp.client_config_id "
        "join customer_accounts ca on ca.id = cc.customer_account_id "
        "where rp.preferred_egress_path = '%s' and wp.desired_state = 'present' and ca.status = 'active'" % path
    ))
    return [x.strip() for x in s.split(",") if x.strip()] if s else []


_PROBE_MEMO = {}


def _memo(key, fn):
    """Probe once per run: the catch-all ladder, the gaming ladder and the health
    snapshot ask for the same paths, and a dead path costs up to ~25 s per probe
    (the whole run must stay well under the unit TimeoutStartSec=240)."""
    if key not in _PROBE_MEMO:
        _PROBE_MEMO[key] = fn()
    return _PROBE_MEMO[key]


def pool_alive():
    """True if the foreign relay pool (socks) can fetch a basic 204 endpoint."""
    return _memo(("pool",), _pool_alive)


def _pool_alive():
    for url in POOL_PROBE_URLS:
        try:
            r = subprocess.run(
                ["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", "-m", "8",
                 "--socks5-hostname", POOL_SOCKS, url],
                capture_output=True, text=True, timeout=12,
            )
            if r.stdout.strip() in ("200", "204"):
                return True
        except Exception:
            pass
    return False


def iface_alive(iface):
    """True if a foreign 204 endpoint is reachable bound to `iface` (the village
    egress path, wg-village-de). This is how we detect the village/via-germany
    path being down so we can fail over to a village-independent reserve."""
    return _memo(("iface", iface), lambda: _iface_alive(iface))


def _iface_alive(iface):
    for url in POOL_PROBE_URLS:
        try:
            r = subprocess.run(
                ["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", "-m", "8",
                 "--interface", iface, url],
                capture_output=True, text=True, timeout=12,
            )
            if r.stdout.strip() in ("200", "204"):
                return True
        except Exception:
            pass
    return False


def socks_alive(socks, max_time=10):
    """True if a foreign 204 endpoint is reachable through the given local socks.
    Worst case (both URLs time out) about 2 * (max_time + 4) s."""
    for url in POOL_PROBE_URLS:
        try:
            r = subprocess.run(
                ["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", "-m", str(max_time),
                 "--socks5-hostname", socks, url],
                capture_output=True, text=True, timeout=max_time + 4,
            )
            if r.stdout.strip() in ("200", "204"):
                return True
        except Exception:
            pass
    return False


_GERMANY_ALIVE = None


def germany_alive():
    """Health of the via-germany path, probed once per run. CF chain configured ->
    a real fetch THROUGH the chain (probe inbound -> via-germany); otherwise the
    legacy wg-village-de interface probe."""
    global _GERMANY_ALIVE
    if _GERMANY_ALIVE is None:
        c = chain_cfg()
        if c:
            _GERMANY_ALIVE = socks_alive("%s:%d" % (c["probe_host"], c["probe_port"]))
        else:
            _GERMANY_ALIVE = iface_alive("wg-village-de")
    return _GERMANY_ALIVE


def backup_alive():
    """Health of the via-backup chain through its probe socks, probed once per run.
    Shorter curl bound than the primary (8 s): with every path dead the run still
    ends well inside the 240 s unit limit. Unconfigured -> False."""
    c = backup_cfg()
    if not c:
        return False
    return _memo(("backup",), lambda: socks_alive("%s:%d" % (c["probe_host"], c["probe_port"]), max_time=8))


def hysteresis_cfg():
    """Env-tunable asymmetric-hysteresis + circuit-breaker config (falls back to the
    egress_state DEFAULTS). k_out preserves today's 2-strike fail-OUT exactly; only
    fail-BACK (k_back) is slower — the best-practice anti-flap change."""
    def _i(key, default):
        try:
            return int(file_env(key, str(default)))
        except Exception:
            return default
    return {
        "k_out": _i("AFROWS_EGRESS_K_OUT", EGRESS_STATE_DEFAULTS["k_out"]),
        "k_back": _i("AFROWS_EGRESS_K_BACK", EGRESS_STATE_DEFAULTS["k_back"]),
        "breaker_window": _i("AFROWS_EGRESS_BREAKER_WINDOW", EGRESS_STATE_DEFAULTS["breaker_window"]),
        "breaker_max": _i("AFROWS_EGRESS_BREAKER_MAX", EGRESS_STATE_DEFAULTS["breaker_max"]),
        "breaker_extra": _i("AFROWS_EGRESS_BREAKER_EXTRA", EGRESS_STATE_DEFAULTS["breaker_extra"]),
    }


def choose_catchall(via_germany_ok, pool_ok, state, backup_ok=False):
    """Health-ordered failover via the explicit egress_state machine: asymmetric
    hysteresis (fail out fast, fail back slow) + a flapping circuit breaker + a
    transition log. Returns (applied_tag, new_state). Priority: via-germany (primary
    foreign chain) -> via-backup (second transport; only when configured, else
    backup_ok is always False) -> proxy (relay pool) -> direct (last resort; only
    the foreign sites Iran does not filter)."""
    if via_germany_ok:
        want = "via-germany"
    elif backup_ok:
        want = BACKUP_TAG
    elif pool_ok:
        want = "proxy"
    else:
        want = "direct"
    return decide(want, state, CATCHALL_ORDER, hysteresis_cfg())


def _breaker_of(state_file):
    """Read the circuit-breaker summary a lane persisted (tripped + recent switch
    count), for the health snapshot. Missing/old state -> a calm default."""
    try:
        b = json.load(open(state_file)).get("breaker", {})
        return {"tripped": bool(b.get("tripped", False)), "recent": int(b.get("recent", 0))}
    except Exception:
        return {"tripped": False, "recent": 0}


def write_health(starlink_up, germany_up, catch_all, gaming_out, mode, backup_up=None):
    """Persist an egress-health snapshot the backend serves to the dashboard. Now
    includes the P2 circuit-breaker state per lane so the backend can alert on a
    flapping egress ("why is my egress unstable")."""
    try:
        os.makedirs(os.path.dirname(HEALTH_FILE), exist_ok=True)
        json.dump({
            "starlinkUp": bool(starlink_up),
            "germanyUp": bool(germany_up),
            "backupUp": backup_up,  # null = backup chain not configured
            "appliedCatchAll": catch_all,
            "gamingOutbound": gaming_out,
            "mode": mode,
            "catchAllBreaker": _breaker_of(STATE_FILE),
            "gamingBreaker": _breaker_of(GAMING_STATE_FILE),
            "updatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }, open(HEALTH_FILE, "w"))
    except Exception:
        pass


def choose_gaming(village_ok, germany_ok, pool_ok, state):
    """Pure failover for the GAMING tier (normally pinned to via-village/Starlink)
    with 2-strike hysteresis. Priority: via-village (Starlink, low ping) -> via-germany
    (owned Germany via the village) -> proxy (the village-INDEPENDENT relay pool = the
    operator's added Exit-page VLESS reserve) -> via-village (last resort; recovers with
    the village). The proxy reserve means gaming users survive a full village power loss
    instead of being stranded on a dead tunnel. Returns (tag, state)."""
    if village_ok:
        want = "via-village"
    elif germany_ok:
        want = "via-germany"
    elif pool_ok:
        want = "proxy"
    else:
        want = "via-village"
    return decide(want, state, GAMING_ORDER, hysteresis_cfg())


def decide_gaming():
    """Resolve the GAMING-tier outbound, failing Starlink over to Germany, then to the
    village-independent relay pool (the operator's added Exit-page exits) so gaming users
    survive even a full village power loss. Persists hysteresis state."""
    village = iface_alive("wg-village")
    germany = True if village else germany_alive()  # only probe reserve when needed
    pool = False if (village or germany) else pool_alive()       # last reserve: probe only when both down
    try:
        st = json.load(open(GAMING_STATE_FILE))
    except Exception:
        st = {}
    applied, st = choose_gaming(village, germany, pool, st)
    try:
        os.makedirs(os.path.dirname(GAMING_STATE_FILE), exist_ok=True)
        json.dump(st, open(GAMING_STATE_FILE, "w"))
    except Exception:
        pass
    log("gaming-failover: starlink=%s germany=%s pool=%s -> gaming-out=%s (pending=%s count=%d)" % (
        "up" if village else "DOWN",
        ("n/a" if village else ("up" if germany else "DOWN")),
        ("n/a" if (village or germany) else ("up" if pool else "DOWN")),
        applied, st.get("pending"), st.get("count", 0)))
    return applied


def forget_unconfigured_backup(st, has_backup):
    """Backup unconfigured (rollback) while it is the applied catch-all: its outbound
    is gone, so do not hold a dangling tag through hysteresis; re-decide at once."""
    if has_backup or st.get("applied") != BACKUP_TAG:
        return st
    return {k: v for k, v in st.items() if k not in ("applied", "pending", "count")}


def decide_catchall(egress):
    """NORMAL foreign catch-all outbound (gaming always -> via-village/Starlink).
    'village' forces via-village; otherwise health-ordered auto-failover so a
    village/Germany outage transparently falls to the relay pool, then direct."""
    if egress == "village":
        log("foreign-egress=village -> catch-all=via-village (Starlink)")
        return "via-village"
    vg = germany_alive()
    has_backup = backup_cfg() is not None
    # Each reserve is probed only when everything above it is down.
    bk = False if (vg or not has_backup) else backup_alive()
    pool = False if (vg or bk) else pool_alive()
    try:
        st = json.load(open(STATE_FILE))
    except Exception:
        st = {}
    applied, st = choose_catchall(vg, pool, forget_unconfigured_backup(st, has_backup), bk)
    try:
        os.makedirs(os.path.dirname(STATE_FILE), exist_ok=True)
        json.dump(st, open(STATE_FILE, "w"))
    except Exception:
        pass
    log("failover: via-germany=%s backup=%s pool=%s -> catch-all=%s (pending=%s count=%d)" % (
        "up" if vg else "DOWN",
        ("n/a" if (vg or not has_backup) else ("up" if bk else "DOWN")),
        ("n/a" if (vg or bk) else ("up" if pool else "DOWN")),
        applied, st.get("pending"), st.get("count", 0)))
    return applied


def client_inbound_tags(rules):
    # The client catch-all is the rule with inboundTag whose outbound is the foreign
    # egress (either the relay pool 'proxy' or the owned 'via-village').
    for r in rules:
        if r.get("inboundTag") and r.get("outboundTag") in ("proxy", "via-village", "via-germany", BACKUP_TAG, "direct"):
            if set(r["inboundTag"]) <= SYSTEM_INBOUND_TAGS:
                continue  # chain probe / internal DNS rule, not the client catch-all
            return list(r["inboundTag"])
    return None


def hexo_rules_of(rules):
    """The hexo per-country routing rules (inboundTag hexo-in-* -> hexo-*), owned by the
    companion afrows-hexo-egress-sync.py. This reconciler rebuilds routing.rules from
    scratch every tick, so it must carry these forward verbatim or it would wipe them
    within a minute (they are disjoint from the client catch-all and the egress ladder)."""
    out = []
    for r in rules:
        tags = r.get("inboundTag") or []
        if tags and all(isinstance(t, str) and t.startswith("hexo-in-") for t in tags):
            out.append({"type": "field", "inboundTag": sorted(tags), "outboundTag": r.get("outboundTag")})
    return out


def desired_rules(mode, client_tags, gaming_sources, gaming_users, catch_outbound, fixed_rules=None, gaming_outbound="via-village", system_rules=None, full_tunnel_sources=None, full_tunnel_outbounds=None, preserved_rules=None):
    # All list members are SORTED so the desired config is deterministic: the DB
    # aggregates (string_agg) can return rows in any order run-to-run, and an
    # order-sensitive `rules == want` compare would otherwise see a phantom change
    # and restart the engine (~every 1-2 min), freezing every user. Dict equality
    # is order-independent in Python, so only these list orders matter.
    rules = [{"type": "field", "inboundTag": ["api"], "outboundTag": "api"}]
    # Companion-owned hexo per-country rules (afrows-hexo-egress-sync.py), carried forward
    # verbatim right after `api` and BEFORE the system rules. This is the EXACT position the
    # companion's build_desired splices them (index 1, ahead of dns-internal/chain-probe): if
    # the two reconcilers disagreed on which side of dns-internal the block sits, each would
    # see the other's layout as "changed" and the pair would flap-restart afrows-xray forever.
    for hr in (preserved_rules or []):
        rules.append({"type": "field", "inboundTag": list(hr["inboundTag"]), "outboundTag": hr["outboundTag"]})
    # System inbounds (chain probe, xray internal DNS) are matched by their own
    # inboundTag, disjoint from the client tags, so placement cannot shadow clients.
    for sr in (system_rules or []):
        rules.append({"type": "field", "inboundTag": list(sr["inboundTag"]), "outboundTag": sr["outboundTag"]})
    # Full-tunnel sources (AFROWS_FULL_TUNNEL_SOURCES, e.g. the operator's home router
    # 10.21.0.2): ALL their traffic, Iranian destinations included, follows the foreign
    # catch-all, so ahead of the smart-mode Iran-direct rules (2026-10-29).
    # When no foreign path is up (catch-all fell to direct) they are blocked rather than
    # leaked onto the Iranian internet: those users asked for USA-only egress.
    # AFROWS_FULL_TUNNEL_OUTBOUNDS optionally pins them to specific exits (e.g. only the USA
    # chain, so the exit IP never changes); any other catch-all blocks them too.
    if full_tunnel_sources:
        allowed = catch_outbound != "direct" and (not full_tunnel_outbounds or catch_outbound in full_tunnel_outbounds)
        rules.append({"type": "field", "source": sorted(full_tunnel_sources),
                      "outboundTag": catch_outbound if allowed else "block"})
    if mode == "smart":
        rules.append(dict(GEOIP_DIRECT))
        rules.append(dict(GEOSITE_DIRECT))
    # gaming -> Starlink normally (gaming_outbound='via-village'); fails over to
    # via-germany when Starlink is down so gaming users aren't stranded.
    if gaming_sources:  # by source IP (afrows-wg peers + router tunnels)
        rules.append({"type": "field", "source": sorted(gaming_sources), "outboundTag": gaming_outbound})
    if gaming_users:  # by VLESS user email (afrows-xray app clients)
        rules.append({"type": "field", "user": sorted(gaming_users), "outboundTag": gaming_outbound})
    # D2 per-config FIXED egress path rules (sorted + deterministic order so the
    # config doesn't look changed run-to-run). Emitted before the catch-all.
    for fr in sorted(fixed_rules or [], key=lambda x: (x["outboundTag"], "user" in x)):
        if fr.get("user"):
            rules.append({"type": "field", "user": sorted(fr["user"]), "outboundTag": fr["outboundTag"]})
        if fr.get("source"):
            rules.append({"type": "field", "source": sorted(fr["source"]), "outboundTag": fr["outboundTag"]})
    # normal foreign catch-all: 'proxy' (relay pool) normally; 'via-village' when the pool is dead
    rules.append({"type": "field", "inboundTag": sorted(client_tags), "outboundTag": catch_outbound})
    return rules


def partition_known_outbound_rules(fixed_rules, known_tags):
    """Split fixed rules into (kept, dropped) by whether their outboundTag exists as a real
    outbound. A dangling outboundTag is NOT caught by `xray -test` (tag references resolve
    lazily at dispatch, not at -test), so routing to a missing tag would silently strand
    those users — drop + log instead of shipping a dead route."""
    kept, dropped = [], []
    for fr in (fixed_rules or []):
        (kept if fr.get("outboundTag") in known_tags else dropped).append(fr)
    return kept, dropped


def strip_identities_from_fixed(fixed, src_set, usr_set):
    """Remove given source IPs / VLESS emails from D2 fixed rules so a higher-priority rule
    (the bypass rule) wins over a conflicting per-config pin — otherwise `desired_rules`'
    alphabetical outboundTag sort would decide it arbitrarily. Drops any rule left empty."""
    out = []
    for fr in fixed:
        nfr = dict(fr)
        if nfr.get("source"):
            nfr["source"] = [s for s in nfr["source"] if s not in src_set]
        if nfr.get("user"):
            nfr["user"] = [u for u in nfr["user"] if u not in usr_set]
        if nfr.get("source") or nfr.get("user"):
            out.append(nfr)
    return out


def apply_target(cfg_path, svc, mode, gaming_sources, gaming_users, catch_outbound, fixed_rules=None, gaming_outbound="via-village", full_tunnel_sources=None, full_tunnel_outbounds=None):
    """gaming_sources: source IPs -> via-village; gaming_users: VLESS emails -> via-village.
    catch_outbound: where the normal foreign catch-all goes ('proxy' or 'via-village')."""
    cfg = json.load(open(cfg_path))
    rules = cfg.get("routing", {}).get("rules", [])
    tags = client_inbound_tags(rules)
    if not tags:
        log("%s: no catch-all proxy rule found; skipping (manual config?)" % svc)
        return False

    changed_out = False
    # Ensure via-village + via-germany + the 'proxy' reserve outbounds all exist, so a
    # health-driven failover to any of them can never fail xray -test and abort (which
    # would leave the engine pinned to a dead primary path — the "all VPN gone on power
    # loss" symptom). Only ADD when missing; never overwrite an existing outbound.
    outs = cfg.setdefault("outbounds", [])
    chain = chain_cfg()
    if chain:
        # CF chain configured: via-germany MUST be the chain (replace a legacy/stale
        # definition in place, keeping its position), and the old village freedom
        # stays available as via-village-legacy for manual fallback.
        want_de = chain_outbound(chain)
        for i, o in enumerate(outs):
            if o.get("tag") == "via-germany" and o != want_de:
                outs[i] = want_de
                changed_out = True
        specs = (VIA_VILLAGE_OUT, want_de, VIA_VILLAGE_LEGACY_OUT, PROXY_OUT)
    else:
        specs = (VIA_VILLAGE_OUT, VIA_GERMANY_OUT, PROXY_OUT)
    for spec in specs:
        if not any(o.get("tag") == spec["tag"] for o in outs):
            outs.append(dict(spec))
            changed_out = True
    system_rules = [{"inboundTag": [DNS_TAG], "outboundTag": catch_outbound}]
    if chain and svc == CHAIN_PROBE_SVC:
        changed_out |= upsert_tagged(cfg.setdefault("inbounds", []), chain_probe_inbound(chain))
        system_rules.insert(0, {"inboundTag": [CHAIN_PROBE_TAG], "outboundTag": "via-germany"})
    if svc == CHAIN_PROBE_SVC:
        # USA mgmt path: via-usa + us-mgmt-socks + their rule, only on the chain engine.
        us = us_chain_cfg()
        ins = cfg.setdefault("inbounds", [])
        if us:
            changed_out |= upsert_tagged(outs, chain_outbound(us, US_CHAIN_TAG))
            changed_out |= upsert_tagged(ins, us_mgmt_inbound(us))
            system_rules.insert(0, {"inboundTag": [US_MGMT_TAG], "outboundTag": US_CHAIN_TAG})
        else:
            changed_out |= drop_tagged(ins, US_MGMT_TAG)
            changed_out |= drop_tagged(outs, US_CHAIN_TAG)
    # Backup chain: the outbound on every engine (the catch-all may point at it), the
    # probe inbound + its rule only on the chain engine. The outbound set stays constant
    # while configured, so a failover changes only the catch-all rule.
    backup = backup_cfg()
    if backup:
        changed_out |= upsert_tagged(outs, chain_outbound(backup, BACKUP_TAG))
    else:
        changed_out |= drop_tagged(outs, BACKUP_TAG)
    if svc == CHAIN_PROBE_SVC:
        ins = cfg.setdefault("inbounds", [])
        if backup:
            changed_out |= upsert_tagged(ins, backup_probe_inbound(backup))
            system_rules.insert(0, {"inboundTag": [BACKUP_PROBE_TAG], "outboundTag": BACKUP_TAG})
        else:
            changed_out |= drop_tagged(ins, BACKUP_PROBE_TAG)

    # Drop any fixed rule (D2 pin / bypass) whose outbound does not exist — `xray -test`
    # would NOT reject a dangling outboundTag, so an unknown target must be caught here.
    fixed_rules, dropped_rules = partition_known_outbound_rules(fixed_rules or [], {o.get("tag") for o in outs})
    for dr in dropped_rules:
        log("%s: dropping fixed rule -> unknown outbound '%s' (create it before routing to it)" % (svc, dr.get("outboundTag")))

    want = desired_rules(mode, tags, gaming_sources or [], gaming_users or [], catch_outbound, fixed_rules or [], gaming_outbound, system_rules, full_tunnel_sources, full_tunnel_outbounds, hexo_rules_of(rules))
    # Include the trusted DNS block in the change gate so an already-converged
    # config that predates the DNS fix still gets it written once, and so a config
    # that already has it does NOT get needlessly rewritten/restarted. Dict equality
    # is order-independent, so a value compare converges cleanly on re-runs.
    want_dns = dict(DNS_TRUSTED)
    if rules == want and cfg.get("dns") == want_dns and not changed_out:
        return False

    cfg.setdefault("routing", {})["rules"] = want
    # domainStrategy decision (belt-and-suspenders considered, DNS-only chosen):
    #   - Keep IPIfNonMatch, NOT AsIs. AsIs stops resolving domains for routing, so
    #     geoip:ir could only match traffic handed to it as literal IPs. Domestic
    #     .ir services reached by DOMAIN that aren't in geosite:category-ir would
    #     then miss geoip:ir and fall through to the FOREIGN `proxy` catch-all --
    #     i.e. AsIs would leak domestic traffic out the foreign gateway, the exact
    #     thing we must avoid. So AsIs is rejected.
    #   - Do NOT narrow GEOIP_DIRECT either: its whole job is keeping domestic-hosted
    #     traffic domestic; narrowing it risks the same domestic leak.
    #   The clean DNS block below fixes the weather breakage with zero domestic-leak
    #   risk, because it only changes WHICH resolver IPIfNonMatch consults; the
    #   routing rules and their precedence are unchanged.
    cfg["routing"]["domainStrategy"] = "IPIfNonMatch"
    cfg["dns"] = want_dns
    tmp = cfg_path + ".mode.json"
    json.dump(cfg, open(tmp, "w"), indent=2)
    test = subprocess.run([XRAY, "run", "-test", "-config", tmp], capture_output=True, text=True, timeout=30)
    if "Configuration OK" not in (test.stdout + test.stderr):
        log("%s: xray -test FAILED, aborting:\n%s" % (svc, (test.stdout + test.stderr)[-400:]))
        os.remove(tmp)
        return False
    os.replace(cfg_path, cfg_path + ".bak-" + time.strftime("%Y%m%d-%H%M%S"))
    os.replace(tmp, cfg_path)
    prune_backups(cfg_path)
    subprocess.run(["systemctl", "restart", svc], timeout=30)
    log("%s: routing -> %s mode, catch-all=%s, gaming-src=%d gaming-user=%d" % (
        svc, mode, catch_outbound, len(gaming_sources or []), len(gaming_users or [])))
    return True


def main():
    url = db_url()
    mode = read_mode(url)
    db = gaming_ips(url)  # afrows-wg gaming peer source IPs
    extra = [s.strip() for s in file_env("AFROWS_GAMING_EXTRA_SOURCES").split(",") if s.strip()]
    extra += [ip for ip in router_gaming_ips(url) if ip not in extra]  # router tunnel source IPs
    xray_users = xray_gaming_emails(url)  # afrows-xray gaming VLESS user emails
    # Normal foreign egress: 'germany' (default) = normal->Germany (via wg-village-de) + gaming->Starlink;
    # 'village' = everyone on Starlink; 'pool' = legacy relay self-heal. (Direct Afrows->Germany is
    # blocked by Afrows's filtered uplink, so Germany is reached through the village.)
    egress = file_env("AFROWS_FOREIGN_EGRESS", "germany").lower()
    catch = decide_catchall(egress)
    gaming_out = decide_gaming()  # via-village normally; via-germany when Starlink is down
    # P4 Part B (flag-gated, default OFF): route opt-in bypass customers to MikroTik-direct
    # only when foreign egress is fully down (catch == 'direct'). OFF -> no bypass rule at all.
    bypass_on = file_env("AFROWS_BYPASS_ENABLED", "false").lower() in ("1", "true", "yes", "on")
    bypass_active = bypass_on and catch == "direct"
    bypass_outbound = file_env("AFROWS_BYPASS_OUTBOUND", "direct")
    bypass_wg = bypass_ips(url) if bypass_active else []
    bypass_xray = bypass_xray_emails(url) if bypass_active else []
    if bypass_on:
        log("bypass: enabled active=%s catch=%s -> %s (wg=%d xray=%d)" % (
            bypass_active, catch, bypass_outbound, len(bypass_wg), len(bypass_xray)))
    changed = False
    for cfg_path, svc, use_db in TARGETS:
        if not os.path.exists(cfg_path):
            continue
        if use_db:  # afrows-wg: source-IP based only
            sources, users = db + extra, []
        else:       # afrows-xray: router source IPs + VLESS gaming users
            sources, users = list(extra), xray_users
        # D2: per-config FIXED egress path rules for this engine. A 'village'
        # (Starlink) pin rides the same failover as the gaming tier so a Starlink
        # outage routes those configs to Germany instead of a dead tunnel.
        fixed = []
        for p, tag in PATH_TAGS.items():
            eff_tag = gaming_out if p == "village" else tag
            if use_db:  # afrows-wg -> source-IP rules
                src = path_wg_sources(url, p)
                if src:
                    fixed.append({"source": src, "outboundTag": eff_tag})
            else:       # afrows-xray -> VLESS user rules
                usr = path_xray_users(url, p)
                if usr:
                    fixed.append({"user": usr, "outboundTag": eff_tag})
        # P4 Part B: inject the bypass rule (only when active) via the same fixed-rule
        # mechanism, so bypass customers override the (dead-VLESS) catch-all. First strip
        # bypass identities from the D2 pins so bypass wins over a conflicting pin
        # (otherwise desired_rules' alphabetical sort would decide it arbitrarily).
        if bypass_active:
            fixed = strip_identities_from_fixed(fixed, set(bypass_wg), set(bypass_xray))
            if use_db and bypass_wg:
                fixed.append({"source": bypass_wg, "outboundTag": bypass_outbound})
            elif not use_db and bypass_xray:
                fixed.append({"user": bypass_xray, "outboundTag": bypass_outbound})
        # full-tunnel sources are source IPs, so only the afrows-wg engine has them
        full = [x.strip() for x in file_env("AFROWS_FULL_TUNNEL_SOURCES").split(",") if x.strip()] if use_db else []
        full_out = [x.strip() for x in file_env("AFROWS_FULL_TUNNEL_OUTBOUNDS").split(",") if x.strip()]
        changed |= apply_target(cfg_path, svc, mode, sources, users, catch, fixed, gaming_out, full, full_out)
    # Health snapshot for the dashboard: raw path reachability + the applied
    # outbounds, so operators can see at a glance which egress (Starlink/Germany)
    # is down. Written every run (cheap: 2 extra probes ~once/min).
    write_health(
        starlink_up=iface_alive("wg-village"),
        germany_up=germany_alive(),
        # memoized when the ladder already probed it; else one fast probe (keeps the
        # backup health visible while it is idle, so a dead backup is seen early)
        backup_up=(backup_alive() if backup_cfg() else None),
        catch_all=catch,
        gaming_out=gaming_out,
        mode=mode,
    )
    if not changed:
        log("no change (mode=%s, catch-all=%s, wg-src=%d xray-src=%d xray-user=%d)" % (
            mode, catch, len(db) + len(extra), len(extra), len(xray_users)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
