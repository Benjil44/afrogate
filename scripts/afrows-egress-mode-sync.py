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
import json, os, subprocess, sys, time
import egress_state as es  # P2: explicit asymmetric-hysteresis + circuit-breaker core

# Explicit priority ladders (most-preferred first). P2 makes these EXPLICIT and
# single-sourced; the ORDER is unchanged from the prior inline logic (that is P4).
CATCHALL_ORDER = ["via-germany", "proxy", "direct"]
GAMING_ORDER = ["via-village", "via-germany", "proxy"]

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
DNS_TRUSTED = {"servers": ["https://1.1.1.1/dns-query", "8.8.8.8", "https://dns.google/dns-query"],
               "queryStrategy": "UseIP"}
VIA_VILLAGE_OUT = {"protocol": "freedom", "tag": "via-village",
                   "streamSettings": {"sockopt": {"interface": "wg-village"}}}
# Normal egress -> Germany: a 2nd tunnel to the village (wg-village-de over the
# Irelandian modems) that the village routes out wg-germany. Gaming -> via-village (Starlink).
VIA_GERMANY_OUT = {"protocol": "freedom", "tag": "via-germany",
                   "streamSettings": {"sockopt": {"interface": "wg-village-de"}}}
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
        "k_out": _i("AFROWS_EGRESS_K_OUT", es.DEFAULTS["k_out"]),
        "k_back": _i("AFROWS_EGRESS_K_BACK", es.DEFAULTS["k_back"]),
        "breaker_window": _i("AFROWS_EGRESS_BREAKER_WINDOW", es.DEFAULTS["breaker_window"]),
        "breaker_max": _i("AFROWS_EGRESS_BREAKER_MAX", es.DEFAULTS["breaker_max"]),
        "breaker_extra": _i("AFROWS_EGRESS_BREAKER_EXTRA", es.DEFAULTS["breaker_extra"]),
    }


def choose_catchall(via_germany_ok, pool_ok, state):
    """Health-ordered failover via the explicit egress_state machine: asymmetric
    hysteresis (fail out fast, fail back slow) + a flapping circuit breaker + a
    transition log. Returns (applied_tag, new_state). Priority (UNCHANGED):
    via-germany (owned Germany via the village) -> proxy (village-independent relay
    pool) -> direct (last resort; only the foreign sites Ireland doesn't filter)."""
    if via_germany_ok:
        want = "via-germany"
    elif pool_ok:
        want = "proxy"
    else:
        want = "direct"
    return es.decide(want, state, CATCHALL_ORDER, hysteresis_cfg())


def _breaker_of(state_file):
    """Read the circuit-breaker summary a lane persisted (tripped + recent switch
    count), for the health snapshot. Missing/old state -> a calm default."""
    try:
        b = json.load(open(state_file)).get("breaker", {})
        return {"tripped": bool(b.get("tripped", False)), "recent": int(b.get("recent", 0))}
    except Exception:
        return {"tripped": False, "recent": 0}


def write_health(starlink_up, germany_up, catch_all, gaming_out, mode):
    """Persist an egress-health snapshot the backend serves to the dashboard. Now
    includes the P2 circuit-breaker state per lane so the backend can alert on a
    flapping egress ("why is my egress unstable")."""
    try:
        os.makedirs(os.path.dirname(HEALTH_FILE), exist_ok=True)
        json.dump({
            "starlinkUp": bool(starlink_up),
            "germanyUp": bool(germany_up),
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
    return es.decide(want, state, GAMING_ORDER, hysteresis_cfg())


def decide_gaming():
    """Resolve the GAMING-tier outbound, failing Starlink over to Germany, then to the
    village-independent relay pool (the operator's added Exit-page exits) so gaming users
    survive even a full village power loss. Persists hysteresis state."""
    village = iface_alive("wg-village")
    germany = True if village else iface_alive("wg-village-de")  # only probe reserve when needed
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


def desired_rules(mode, client_tags, gaming_sources, gaming_users, catch_outbound, fixed_rules=None, gaming_outbound="via-village"):
    # All list members are SORTED so the desired config is deterministic: the DB
    # aggregates (string_agg) can return rows in any order run-to-run, and an
    # order-sensitive `rules == want` compare would otherwise see a phantom change
    # and restart the engine (~every 1-2 min), freezing every user. Dict equality
    # is order-independent in Python, so only these list orders matter.
    rules = [{"type": "field", "inboundTag": ["api"], "outboundTag": "api"}]
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


def apply_target(cfg_path, svc, mode, gaming_sources, gaming_users, catch_outbound, fixed_rules=None, gaming_outbound="via-village"):
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
    for spec in (VIA_VILLAGE_OUT, VIA_GERMANY_OUT, PROXY_OUT):
        if not any(o.get("tag") == spec["tag"] for o in outs):
            outs.append(dict(spec))
            changed_out = True

    want = desired_rules(mode, tags, gaming_sources or [], gaming_users or [], catch_outbound, fixed_rules or [], gaming_outbound)
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
        changed |= apply_target(cfg_path, svc, mode, sources, users, catch, fixed, gaming_out)
    # Health snapshot for the dashboard: raw path reachability + the applied
    # outbounds, so operators can see at a glance which egress (Starlink/Germany)
    # is down. Written every run (cheap: 2 extra probes ~once/min).
    write_health(
        starlink_up=iface_alive("wg-village"),
        germany_up=iface_alive("wg-village-de"),
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
