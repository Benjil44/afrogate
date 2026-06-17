#!/usr/bin/env python3
"""Afrows global egress-mode reconciler.

Reads the global egress mode from the DB (egress_settings.mode) and rewrites the
routing of the client egress engines (afrows-wg, afrows-xray) to match:

  smart (default): geoip:private/ir + geosite:category-ir -> direct (VPS local),
                   everything else -> proxy (the relay pool).
  full           : everything from client inbounds -> proxy (the relay pool),
                   no domestic carve-out (use when Iran filters the local internet too).

Idempotent: only rewrites + restarts a service when its routing actually changes.
The set of client inbound tags is preserved from each config's existing catch-all
proxy rule, so this stays correct as inbounds evolve. Run by a systemd timer.
No secrets in this file — DB URL is read from /etc/afrows/afrows.env at runtime.
"""
import json, os, subprocess, sys, time

ENV = os.environ.get("AFROWS_ENV", "/etc/afrows/afrows.env")
XRAY = os.environ.get("AFROWS_XRAY_BIN", "/usr/local/bin/xray")
TARGETS = [
    ("/usr/local/etc/afrows-wg/config.json", "afrows-wg"),
    ("/usr/local/etc/afrows-xray/config.json", "afrows-xray"),
]
GEOIP_DIRECT = {"type": "field", "ip": ["geoip:private", "geoip:ir"], "outboundTag": "direct"}
GEOSITE_DIRECT = {"type": "field", "domain": ["geosite:category-ir"], "outboundTag": "direct"}


def log(*a):
    print("[egress-mode]", *a, flush=True)


def db_url():
    with open(ENV) as f:
        for line in f:
            if line.startswith("DATABASE_URL="):
                return line.split("=", 1)[1].strip().strip('"').strip("\r")
    raise SystemExit("DATABASE_URL not found in " + ENV)


def read_mode(url):
    out = subprocess.run(
        ["psql", url, "-t", "-A", "-c", "select mode from egress_settings where id=true limit 1;"],
        capture_output=True, text=True, timeout=20)
    mode = (out.stdout or "").strip()
    if mode not in ("smart", "full"):
        log("mode unreadable/invalid (%r); defaulting to smart" % mode)
        return "smart"
    return mode


def client_inbound_tags(rules):
    # the catch-all rule that sends client inbounds to the pool
    for r in rules:
        if r.get("outboundTag") == "proxy" and r.get("inboundTag"):
            return list(r["inboundTag"])
    return None


def desired_rules(mode, client_tags):
    rules = [{"type": "field", "inboundTag": ["api"], "outboundTag": "api"}]
    if mode == "smart":
        rules.append(dict(GEOIP_DIRECT))
        rules.append(dict(GEOSITE_DIRECT))
    rules.append({"type": "field", "inboundTag": client_tags, "outboundTag": "proxy"})
    return rules


def apply_target(cfg_path, svc, mode):
    cfg = json.load(open(cfg_path))
    rules = cfg.get("routing", {}).get("rules", [])
    tags = client_inbound_tags(rules)
    if not tags:
        log("%s: no catch-all proxy rule found; skipping (manual config?)" % svc)
        return False
    want = desired_rules(mode, tags)
    if rules == want:
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
    log("%s: routing -> %s mode" % (svc, mode))
    return True


def main():
    mode = read_mode(db_url())
    changed = False
    for cfg_path, svc in TARGETS:
        if os.path.exists(cfg_path):
            changed |= apply_target(cfg_path, svc, mode)
    if not changed:
        log("no change (mode=%s)" % mode)
    return 0


if __name__ == "__main__":
    sys.exit(main())
