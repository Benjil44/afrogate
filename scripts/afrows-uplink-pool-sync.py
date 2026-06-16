#!/usr/bin/env python3
"""Afrows uplink relay-pool reconciler.

Keeps the foreign-egress pool in /usr/local/etc/xray/config.json populated with
*currently-working* VLESS relays from the `outbounds` DB, so the egress
self-heals even if the whole current relay cluster dies.

Selection = relays that recently passed a real speed test (download Mbps), NOT
just "healthy" (TCP-reachable). It rebuilds only the `relay-N` outbounds; the
observatory + balancer + inbounds + routing are preserved. Idempotent: reloads
xray only when the selected relay *set* changes. HARD SAFETY: if zero working
relays are found, it leaves the existing pool untouched (never empties egress).

Run by the afrows-uplink-pool-sync systemd timer. No secrets in this file — the
DB URL is read from /etc/afrows/afrows.env at runtime.
"""
import json, os, subprocess, sys

CFG = os.environ.get("AFROWS_UPLINK_CFG", "/usr/local/etc/xray/config.json")
ENV = os.environ.get("AFROWS_ENV", "/etc/afrows/afrows.env")
XRAY = os.environ.get("AFROWS_XRAY_BIN", "/usr/local/bin/xray")
MIN_MBPS = float(os.environ.get("POOL_MIN_MBPS", "3"))
MAX_AGE_MIN = int(os.environ.get("POOL_MAX_AGE_MIN", "90"))
MAX_RELAYS = int(os.environ.get("POOL_MAX_RELAYS", "5"))


def log(*a):
    print("[pool-sync]", *a, flush=True)


def db_url():
    with open(ENV) as f:
        for line in f:
            if line.startswith("DATABASE_URL="):
                return line.split("=", 1)[1].strip().strip('"').strip("\r")
    raise SystemExit("DATABASE_URL not found in " + ENV)


def fetch_relays(url):
    # Working = recently speed-tested with real download throughput.
    q = (
        "select coalesce(json_agg(t order by t.dn desc),'[]') from ("
        "  select config as cfg, latest_down_mbps as dn from outbounds"
        "  where coalesce(enabled,true)"
        "    and config ? 'uuid' and config ? 'address' and config ? 'port'"
        "    and coalesce(latest_down_mbps,0) >= %s"
        "    and last_speed_test_at > now() - interval '%s minutes'"
        "  order by latest_down_mbps desc nulls last limit %s"
        ") t" % (MIN_MBPS, MAX_AGE_MIN, MAX_RELAYS)
    )
    out = subprocess.run(["psql", url, "-t", "-A", "-c", q],
                         capture_output=True, text=True, timeout=30)
    if out.returncode != 0:
        raise SystemExit("psql failed: " + out.stderr.strip())
    return json.loads(out.stdout.strip() or "[]")


def build_outbound(tag, c):
    net = c.get("network", "tcp")
    sec = c.get("security", "none")
    user = {"id": c["uuid"], "encryption": c.get("encryption", "none")}
    if c.get("flow"):
        user["flow"] = c["flow"]
    ob = {"protocol": "vless", "tag": tag,
          "settings": {"vnext": [{"address": c["address"], "port": int(c["port"]), "users": [user]}]}}
    ss = {"network": net, "security": sec}
    if sec == "reality":
        rs = {"serverName": c.get("serverName", ""),
              "fingerprint": c.get("fingerprint", "chrome"),
              "publicKey": c.get("publicKey", ""),
              "shortId": c.get("shortId", "")}
        if c.get("spiderX"):
            rs["spiderX"] = c["spiderX"]
        ss["realitySettings"] = rs
    elif sec == "tls":
        tls = {"serverName": c.get("serverName") or c.get("host", "")}
        if c.get("fingerprint"):
            tls["fingerprint"] = c["fingerprint"]
        ss["tlsSettings"] = tls
    if net == "ws":
        ws = {"path": c.get("path", "/")}
        if c.get("host"):
            ws["headers"] = {"Host": c["host"]}
        ss["wsSettings"] = ws
    elif net == "xhttp":
        xh = {"path": c.get("path", "/")}
        if c.get("host"):
            xh["host"] = c["host"]
        ss["xhttpSettings"] = xh
    elif net == "tcp" and c.get("headerType") == "http":
        ss["tcpSettings"] = {"header": {"type": "http",
                             "request": {"headers": {"Host": [c.get("host", "")]}}}}
    ob["streamSettings"] = ss
    return ob


def identity(ob):
    v = ob["settings"]["vnext"][0]
    return "%s:%s#%s/%s/%s" % (v["address"], v["port"], v["users"][0]["id"],
                               ob["streamSettings"]["network"], ob["streamSettings"]["security"])


def main():
    rows = fetch_relays(db_url())
    relays = []
    for i, r in enumerate(rows, 1):
        c = r["cfg"]
        try:
            relays.append(build_outbound("relay-%d" % i, c))
        except Exception as e:  # skip a malformed/unsupported relay rather than fail
            log("skip relay (%s): %s" % (c.get("address"), e))
    if not relays:
        log("SAFETY: 0 working relays found (down>=%s, <%smin) -> leaving pool unchanged" % (MIN_MBPS, MAX_AGE_MIN))
        return 0

    cfg = json.load(open(CFG))
    cur = [o for o in cfg.get("outbounds", []) if str(o.get("tag", "")).startswith("relay-")]
    if sorted(identity(o) for o in cur) == sorted(identity(o) for o in relays):
        log("no change (%d relays): %s" % (len(relays), ", ".join(identity(o) for o in relays)))
        return 0

    others = [o for o in cfg.get("outbounds", []) if not str(o.get("tag", "")).startswith("relay-")]
    cfg["outbounds"] = relays + others
    tmp = CFG + ".pool.json"
    json.dump(cfg, open(tmp, "w"), indent=2)
    test = subprocess.run([XRAY, "run", "-test", "-config", tmp], capture_output=True, text=True, timeout=30)
    if "Configuration OK" not in (test.stdout + test.stderr):
        log("xray -test FAILED, aborting:\n" + (test.stdout + test.stderr)[-500:])
        os.remove(tmp)
        return 1
    import time
    os.replace(CFG, CFG + ".bak-" + time.strftime("%Y%m%d-%H%M%S"))
    os.replace(tmp, CFG)
    subprocess.run(["systemctl", "restart", "xray"], timeout=30)
    log("pool updated -> %d relays: %s" % (len(relays), ", ".join(identity(o) for o in relays)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
