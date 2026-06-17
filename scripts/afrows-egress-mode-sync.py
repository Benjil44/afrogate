#!/usr/bin/env python3
"""Afrows egress-mode + per-account tier reconciler.

Two jobs, applied to the client egress engines (afrows-wg, afrows-xray):

1) Global egress mode (egress_settings.mode):
   smart  = geoip:ir/private + geosite:category-ir -> direct, else -> proxy pool
   full   = everything from client inbounds -> proxy pool

2) Per-account GAMING tier (customer_accounts.egress_tier='gaming'): those accounts'
   WireGuard source IPs (wireguard_peers.client_address) are routed to the
   `via-village` outbound (a freedom outbound bound to wg-village -> the village
   Starlink, low ping/jitter). Normal accounts keep going to the proxy pool
   (Germany/relays). Tier routing is applied to afrows-wg only (source-IP based);
   afrows-xray (VLESS) tier routing by user is a later step.

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


def client_inbound_tags(rules):
    for r in rules:
        if r.get("outboundTag") == "proxy" and r.get("inboundTag"):
            return list(r["inboundTag"])
    return None


def desired_rules(mode, client_tags, gaming):
    rules = [{"type": "field", "inboundTag": ["api"], "outboundTag": "api"}]
    if mode == "smart":
        rules.append(dict(GEOIP_DIRECT))
        rules.append(dict(GEOSITE_DIRECT))
    if gaming:  # gaming source IPs -> village Starlink (foreign; Iran already went direct above)
        rules.append({"type": "field", "source": gaming, "outboundTag": "via-village"})
    rules.append({"type": "field", "inboundTag": client_tags, "outboundTag": "proxy"})
    return rules


def apply_target(cfg_path, svc, mode, gaming):
    """gaming: list of source IPs for afrows-wg, or None when tier routing N/A."""
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

    want = desired_rules(mode, tags, gaming or [])
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
    log("%s: routing -> %s mode, gaming-src=%d" % (svc, mode, len(gaming or [])))
    return True


def main():
    url = db_url()
    mode = read_mode(url)
    db = gaming_ips(url)
    extra = [s.strip() for s in file_env("AFROWS_GAMING_EXTRA_SOURCES").split(",") if s.strip()]
    changed = False
    for cfg_path, svc, use_db in TARGETS:
        if os.path.exists(cfg_path):
            gaming = (db + extra) if use_db else list(extra)
            changed |= apply_target(cfg_path, svc, mode, gaming)
    if not changed:
        log("no change (mode=%s, gaming wg=%d xray=%d)" % (mode, len(db) + len(extra), len(extra)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
