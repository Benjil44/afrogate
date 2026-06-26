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
# Normal egress -> Germany: a 2nd tunnel to the village (wg-village-de over the
# Iranian modems) that the village routes out wg-germany. Gaming -> via-village (Starlink).
VIA_GERMANY_OUT = {"protocol": "freedom", "tag": "via-germany",
                   "streamSettings": {"sockopt": {"interface": "wg-village-de"}}}
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


def iface_alive(iface):
    """True if a foreign 204 endpoint is reachable bound to `iface` (the village
    egress path, wg-village-de). This is how we detect the village/via-germany
    path being down so we can fail over to a village-independent reserve."""
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


def choose_catchall(via_germany_ok, pool_ok, state):
    """Pure health-ordered failover decision with 2-strike hysteresis (so a single
    bad probe never flips the live egress). Returns (applied_tag, new_state).
    Priority: via-germany (owned Germany via the village) -> proxy (relay pool,
    village-independent reserve) -> direct (last resort; only the foreign sites
    Iran doesn't filter)."""
    if via_germany_ok:
        want = "via-germany"
    elif pool_ok:
        want = "proxy"
    else:
        want = "direct"
    applied = state.get("applied", want)
    if want == applied:
        return applied, {"applied": applied, "pending": want, "count": 0}
    cnt = (state.get("count", 0) + 1) if state.get("pending") == want else 1
    if cnt >= 2:
        return want, {"applied": want, "pending": want, "count": 0}
    return applied, {"applied": applied, "pending": want, "count": cnt}


def decide_catchall(egress):
    """NORMAL foreign catch-all outbound (gaming always -> via-village/Starlink).
    'village' forces via-village; otherwise health-ordered auto-failover so a
    village/Germany outage transparently falls to the relay pool, then direct."""
    if egress == "village":
        log("foreign-egress=village -> catch-all=via-village (Starlink)")
        return "via-village"
    vg = iface_alive("wg-village-de")
    pool = False if vg else pool_alive()  # only probe the reserve when the primary is down
    try:
        st = json.load(open(STATE_FILE))
    except Exception:
        st = {}
    applied, st = choose_catchall(vg, pool, st)
    try:
        os.makedirs(os.path.dirname(STATE_FILE), exist_ok=True)
        json.dump(st, open(STATE_FILE, "w"))
    except Exception:
        pass
    log("failover: via-germany=%s pool=%s -> catch-all=%s (pending=%s count=%d)" % (
        "up" if vg else "DOWN", ("up" if pool else "n/a") if vg else ("up" if pool else "DOWN"),
        applied, st.get("pending"), st.get("count", 0)))
    return applied


def client_inbound_tags(rules):
    # The client catch-all is the rule with inboundTag whose outbound is the foreign
    # egress (either the relay pool 'proxy' or the owned 'via-village').
    for r in rules:
        if r.get("inboundTag") and r.get("outboundTag") in ("proxy", "via-village", "via-germany", "direct"):
            return list(r["inboundTag"])
    return None


def desired_rules(mode, client_tags, gaming_sources, gaming_users, catch_outbound, fixed_rules=None):
    # All list members are SORTED so the desired config is deterministic: the DB
    # aggregates (string_agg) can return rows in any order run-to-run, and an
    # order-sensitive `rules == want` compare would otherwise see a phantom change
    # and restart the engine (~every 1-2 min), freezing every user. Dict equality
    # is order-independent in Python, so only these list orders matter.
    rules = [{"type": "field", "inboundTag": ["api"], "outboundTag": "api"}]
    if mode == "smart":
        rules.append(dict(GEOIP_DIRECT))
        rules.append(dict(GEOSITE_DIRECT))
    # gaming -> village Starlink (foreign only; Iran already went direct above)
    if gaming_sources:  # by source IP (afrows-wg peers + router tunnels)
        rules.append({"type": "field", "source": sorted(gaming_sources), "outboundTag": "via-village"})
    if gaming_users:  # by VLESS user email (afrows-xray app clients)
        rules.append({"type": "field", "user": sorted(gaming_users), "outboundTag": "via-village"})
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


def apply_target(cfg_path, svc, mode, gaming_sources, gaming_users, catch_outbound, fixed_rules=None):
    """gaming_sources: source IPs -> via-village; gaming_users: VLESS emails -> via-village.
    catch_outbound: where the normal foreign catch-all goes ('proxy' or 'via-village')."""
    cfg = json.load(open(cfg_path))
    rules = cfg.get("routing", {}).get("rules", [])
    tags = client_inbound_tags(rules)
    if not tags:
        log("%s: no catch-all proxy rule found; skipping (manual config?)" % svc)
        return False

    changed_out = False
    outs = cfg.setdefault("outbounds", [])  # ensure the via-village + via-germany outbounds exist
    for spec in (VIA_VILLAGE_OUT, VIA_GERMANY_OUT):
        if not any(o.get("tag") == spec["tag"] for o in outs):
            outs.append(dict(spec))
            changed_out = True

    want = desired_rules(mode, tags, gaming_sources or [], gaming_users or [], catch_outbound, fixed_rules or [])
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
    # Normal foreign egress: 'germany' (default) = normal->Germany (via wg-village-de) + gaming->Starlink;
    # 'village' = everyone on Starlink; 'pool' = legacy relay self-heal. (Direct Afrows->Germany is
    # blocked by Afrows's filtered uplink, so Germany is reached through the village.)
    egress = file_env("AFROWS_FOREIGN_EGRESS", "germany").lower()
    catch = decide_catchall(egress)
    changed = False
    for cfg_path, svc, use_db in TARGETS:
        if not os.path.exists(cfg_path):
            continue
        if use_db:  # afrows-wg: source-IP based only
            sources, users = db + extra, []
        else:       # afrows-xray: router source IPs + VLESS gaming users
            sources, users = list(extra), xray_users
        # D2: per-config FIXED egress path rules for this engine
        fixed = []
        for p, tag in PATH_TAGS.items():
            if use_db:  # afrows-wg -> source-IP rules
                src = path_wg_sources(url, p)
                if src:
                    fixed.append({"source": src, "outboundTag": tag})
            else:       # afrows-xray -> VLESS user rules
                usr = path_xray_users(url, p)
                if usr:
                    fixed.append({"user": usr, "outboundTag": tag})
        changed |= apply_target(cfg_path, svc, mode, sources, users, catch, fixed)
    if not changed:
        log("no change (mode=%s, catch-all=%s, wg-src=%d xray-src=%d xray-user=%d)" % (
            mode, catch, len(db) + len(extra), len(extra), len(xray_users)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
