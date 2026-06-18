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
       too. Iran traffic already split to `direct` above, so only foreign egress
       is diverted to Starlink.

Idempotent: only rewrites + restarts a service when its routing/outbounds change.
No secrets in this file. Run by the afrows-egress-mode-sync systemd timer.
"""
import json, os, subprocess, sys, time

ENV = os.environ.get("AFROWS_ENV", "/etc/afrows/afrows.env")
XRAY = os.environ.get("AFROWS_XRAY_BIN", "/usr/local/bin/xray")
# (config, service, gaming_tier_applies)
TARGETS = [
    ("/usr/local/etc/afrows-wg/config.json", "afrows-wg", True),
    ("/usr/local/etc/afrows-xray/config.json", "afrows-xray", False),
]
GEOIP_DIRECT = {"type": "field", "ip": ["geoip:private", "geoip:ir"], "outboundTag": "direct"}
GEOSITE_DIRECT = {"type": "field", "domain": ["geosite:category-ir"], "outboundTag": "direct"}
VIA_VILLAGE_OUT = {"protocol": "freedom", "tag": "via-village",
                   "streamSettings": {"sockopt": {"interface": "wg-village"}}}
# Self-healing foreign egress: probe the relay pool (socks); when it can't carry
# traffic, send the normal foreign catch-all to via-village (owned Germany/Starlink)
# instead of the dead pool, and flip back when the pool recovers.
POOL_SOCKS = os.environ.get("AFROWS_POOL_SOCKS", "127.0.0.1:10808")
POOL_PROBE_URLS = ["https://www.gstatic.com/generate_204", "http://cp.cloudflare.com/generate_204"]
STATE_FILE = "/var/lib/afrows/egress-pool.state"
# Extra source IPs to route to via-village regardless of DB tier (e.g. the home
# router's tunnel IP on afrows-xray, for the operator's own gaming) — read from
# the env FILE in main() (systemd has no shell env).


def log(*a):
    print("[egress-mode]", *a, flush=True)


def file_env(key, default=""):
    try:
        with open(ENV) as f:
            for line in f:
                if line.startswith(key + "="):
                    return line.split("=", 1)[1].strip().strip('"').strip("\r")
    except Exception:
        pass
    return os.environ.get(key, default)


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
        "select coalesce(string_agg(wp.client_address, ','), '') from wireguard_peers wp "
        "join client_configs cc on cc.id = wp.client_config_id "
        "join customer_accounts ca on ca.id = cc.customer_account_id "
        "where ca.egress_tier = 'gaming' and wp.desired_state = 'present' "
        "and wp.client_address is not null"
    ))
    return [x.strip() for x in s.split(",") if x.strip()] if s else []


def router_gaming_ips(url):
    """Source IPs of operator MikroTik routers toggled to game mode (the Microtiks panel)."""
    s = psql1(url, (
        "select coalesce(string_agg(gaming_source_ip, ','), '') from mikrotik_routers "
        "where gaming_enabled = true and gaming_source_ip is not null and gaming_source_ip <> ''"
    ))
    return [x.strip() for x in s.split(",") if x.strip()] if s else []


def xray_gaming_emails(url):
    """VLESS provisioning emails (cc_<client_config_id>@afrows) of gaming-tier
    accounts' active client configs — the same emails XrayProvisioningService
    registers via `xray api adu`, so xray routing can match them by `user`."""
    s = psql1(url, (
        "select coalesce(string_agg('cc_' || cc.id || '@afrows', ','), '') "
        "from client_configs cc "
        "join customer_accounts ca on ca.id = cc.customer_account_id "
        "where ca.egress_tier = 'gaming' and cc.status <> 'disabled'"
    ))
    return [x.strip() for x in s.split(",") if x.strip()] if s else []


def pool_alive():
    """True if the foreign relay pool (socks) can fetch a basic 204 endpoint."""
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


def decide_catchall():
    """Choose the normal foreign catch-all outbound. 'proxy' when the relay pool
    works, else 'via-village'. Requires 2 consecutive divergent readings before
    flipping, to avoid restart flapping."""
    alive = pool_alive()
    want = "proxy" if alive else "via-village"
    try:
        os.makedirs(os.path.dirname(STATE_FILE), exist_ok=True)
        st = json.load(open(STATE_FILE))
    except Exception:
        st = {}
    applied = st.get("applied", "proxy")
    if want == applied:
        st = {"applied": applied, "pending": want, "count": 0}
    else:
        cnt = (st.get("count", 0) + 1) if st.get("pending") == want else 1
        if cnt >= 2:
            applied = want
            st = {"applied": applied, "pending": want, "count": 0}
        else:
            st = {"applied": applied, "pending": want, "count": cnt}
    try:
        json.dump(st, open(STATE_FILE, "w"))
    except Exception:
        pass
    log("pool=%s -> catch-all=%s (pending=%s count=%d)" % (
        "alive" if alive else "DEAD", applied, st.get("pending"), st.get("count", 0)))
    return applied


def client_inbound_tags(rules):
    for r in rules:
        if r.get("outboundTag") == "proxy" and r.get("inboundTag"):
            return list(r["inboundTag"])
    return None


def desired_rules(mode, client_tags, gaming_sources, gaming_users, catch_outbound):
    rules = [{"type": "field", "inboundTag": ["api"], "outboundTag": "api"}]
    if mode == "smart":
        rules.append(dict(GEOIP_DIRECT))
        rules.append(dict(GEOSITE_DIRECT))
    # gaming -> village Starlink (foreign only; Iran already went direct above)
    if gaming_sources:  # by source IP (afrows-wg peers + router tunnels)
        rules.append({"type": "field", "source": gaming_sources, "outboundTag": "via-village"})
    if gaming_users:  # by VLESS user email (afrows-xray app clients)
        rules.append({"type": "field", "user": gaming_users, "outboundTag": "via-village"})
    # normal foreign catch-all: 'proxy' (relay pool) normally; 'via-village' when the pool is dead
    rules.append({"type": "field", "inboundTag": client_tags, "outboundTag": catch_outbound})
    return rules


def apply_target(cfg_path, svc, mode, gaming_sources, gaming_users, catch_outbound):
    """gaming_sources: source IPs -> via-village; gaming_users: VLESS emails -> via-village.
    catch_outbound: where the normal foreign catch-all goes ('proxy' or 'via-village')."""
    cfg = json.load(open(cfg_path))
    rules = cfg.get("routing", {}).get("rules", [])
    tags = client_inbound_tags(rules)
    if not tags:
        log("%s: no catch-all proxy rule found; skipping (manual config?)" % svc)
        return False

    changed_out = False
    outs = cfg.setdefault("outbounds", [])  # ensure the via-village outbound exists
    if not any(o.get("tag") == "via-village" for o in outs):
        outs.append(dict(VIA_VILLAGE_OUT))
        changed_out = True

    want = desired_rules(mode, tags, gaming_sources or [], gaming_users or [], catch_outbound)
    if rules == want and not changed_out:
        return False

    cfg.setdefault("routing", {})["rules"] = want
    cfg["routing"]["domainStrategy"] = "IPIfNonMatch"
    tmp = cfg_path + ".mode.json"
    json.dump(cfg, open(tmp, "w"), indent=2)
    test = subprocess.run([XRAY, "run", "-test", "-config", tmp], capture_output=True, text=True, timeout=30)
    if "Configuration OK" not in (test.stdout + test.stderr):
        log("%s: xray -test FAILED, aborting:\n%s" % (svc, (test.stdout + test.stderr)[-400:]))
        os.remove(tmp)
        return False
    os.replace(cfg_path, cfg_path + ".bak-" + time.strftime("%Y%m%d-%H%M%S"))
    os.replace(tmp, cfg_path)
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
    catch = decide_catchall()  # self-healing: proxy when pool alive, else via-village
    changed = False
    for cfg_path, svc, use_db in TARGETS:
        if not os.path.exists(cfg_path):
            continue
        if use_db:  # afrows-wg: source-IP based only
            sources, users = db + extra, []
        else:       # afrows-xray: router source IPs + VLESS gaming users
            sources, users = list(extra), xray_users
        changed |= apply_target(cfg_path, svc, mode, sources, users, catch)
    if not changed:
        log("no change (mode=%s, catch-all=%s, wg-src=%d xray-src=%d xray-user=%d)" % (
            mode, catch, len(db) + len(extra), len(extra), len(xray_users)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
