#!/usr/bin/env python3
"""Afrows uplink relay-pool reconciler (smart selection).

Keeps the foreign-egress pool in /usr/local/etc/xray/config.json populated with
the most *stable* VLESS relays from the `outbounds` DB, so egress self-heals even
when the current cluster dies.

Selection is NOT just instantaneous speed (a relay flapping 0<->30 Mbps would
otherwise get admitted mid-spike, then fail live). Each run records the latest
speed-test result per relay into a small state file and scores relays on their
RECENT HISTORY:
  - success_rate  = fraction of the last N samples that passed (down >= MIN_MBPS)
  - healthy_avg   = avg throughput of the passing samples
  - hysteresis    = a relay must have its last K samples all healthy to be admitted
                    (so a one-sample fluke / a flapper mid-spike is not promoted)
  - score         = success_rate (dominant) then healthy_avg (tiebreak)
Cold start (not enough history yet) falls back to the instantaneous check so a
fresh relay can still join. HARD SAFETY: if 0 relays qualify, the pool is left
unchanged (egress is never emptied). Idempotent: reloads xray only on a real
membership change. Run by the afrows-uplink-pool-sync systemd timer.
"""
import json, os, subprocess, sys, time

CFG = os.environ.get("AFROWS_UPLINK_CFG", "/usr/local/etc/xray/config.json")
ENV = os.environ.get("AFROWS_ENV", "/etc/afrows/afrows.env")
XRAY = os.environ.get("AFROWS_XRAY_BIN", "/usr/local/bin/xray")
STATE = os.environ.get("AFROWS_POOL_STATE", "/var/lib/afrows/pool-sync-state.json")
MIN_MBPS = float(os.environ.get("POOL_MIN_MBPS", "3"))
MAX_AGE_MIN = int(os.environ.get("POOL_MAX_AGE_MIN", "90"))
MAX_RELAYS = int(os.environ.get("POOL_MAX_RELAYS", "5"))
MIN_HEALTHY = int(os.environ.get("POOL_MIN_HEALTHY", "3"))
HISTORY_N = int(os.environ.get("POOL_HISTORY_N", "8"))       # samples kept per relay
HYSTERESIS_K = int(os.environ.get("POOL_HYSTERESIS_K", "2")) # consecutive-healthy to admit
MIN_SUCCESS = float(os.environ.get("POOL_MIN_SUCCESS", "0.5"))


def log(*a):
    print("[pool-sync]", *a, flush=True)


def db_url():
    with open(ENV) as f:
        for line in f:
            if line.startswith("DATABASE_URL="):
                return line.split("=", 1)[1].strip().strip('"').strip("\r")
    raise SystemExit("DATABASE_URL not found in " + ENV)


def fetch_candidates(url):
    """All enabled VLESS relays with current down + test timestamp (epoch)."""
    q = (
        "select coalesce(json_agg(t),'[]') from ("
        "  select config as cfg,"
        "         coalesce(latest_down_mbps,0)::float as dn,"
        "         coalesce(extract(epoch from last_speed_test_at),0)::bigint as ts,"
        "         (last_speed_test_at > now() - interval '%s minutes') as fresh"
        "  from outbounds"
        "  where coalesce(enabled,true)"
        "    and config ? 'uuid' and config ? 'address' and config ? 'port'"
        ") t" % (MAX_AGE_MIN,)
    )
    out = subprocess.run(["psql", url, "-t", "-A", "-c", q],
                         capture_output=True, text=True, timeout=30)
    if out.returncode != 0:
        raise SystemExit("psql failed: " + out.stderr.strip())
    return json.loads(out.stdout.strip() or "[]")


def load_state():
    try:
        return json.load(open(STATE))
    except Exception:
        return {}


def save_state(st):
    try:
        os.makedirs(os.path.dirname(STATE), exist_ok=True)
        json.dump(st, open(STATE + ".tmp", "w"))
        os.replace(STATE + ".tmp", STATE)
    except Exception as e:
        log("warn: could not persist state: %s" % e)


def key_of(cfg):
    return "%s:%s" % (cfg.get("address"), cfg.get("port"))


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


def score_relay(samples):
    """(eligible, score, success_rate) from a relay's recent samples."""
    if not samples:
        return False, 0.0, 0.0
    passes = [1 if s >= MIN_MBPS else 0 for s in samples]
    success = sum(passes) / len(passes)
    healthy = [s for s in samples if s >= MIN_MBPS]
    healthy_avg = sum(healthy) / len(healthy) if healthy else 0.0
    recent_ok = len(samples) >= HYSTERESIS_K and all(s >= MIN_MBPS for s in samples[-HYSTERESIS_K:])
    eligible = recent_ok and success >= MIN_SUCCESS
    return eligible, success * 1000 + healthy_avg, success


def main():
    cands = fetch_candidates(db_url())
    st = load_state()
    seen = set()
    scored = []  # (score, key, cfg, success, eligible)
    for r in cands:
        cfg = r["cfg"]
        k = key_of(cfg)
        seen.add(k)
        rec = st.get(k, {"ts": 0, "samples": []})
        # record a NEW sample only when a fresh speed test landed since last seen
        if int(r["ts"]) and int(r["ts"]) != int(rec.get("ts", 0)):
            rec["samples"] = (rec.get("samples", []) + [float(r["dn"])])[-HISTORY_N:]
            rec["ts"] = int(r["ts"])
        st[k] = rec
        eligible, score, success = score_relay(rec["samples"])
        # cold start: not enough history yet -> fall back to instantaneous + fresh
        if len(rec["samples"]) < HYSTERESIS_K:
            eligible = bool(r["fresh"]) and float(r["dn"]) >= MIN_MBPS
            score = float(r["dn"])
        # stale relays (not tested within MAX_AGE) are never selected
        if not r["fresh"]:
            eligible = False
        scored.append((score, k, cfg, success, eligible))
    # prune state for relays no longer in the DB
    for k in list(st.keys()):
        if k not in seen:
            del st[k]
    save_state(st)

    eligible = [s for s in scored if s[4]]
    eligible.sort(key=lambda s: s[0], reverse=True)
    chosen = eligible[:MAX_RELAYS]

    if not chosen:
        log("SAFETY: 0 eligible relays (stable down>=%s, last %d healthy) -> leaving pool unchanged" % (MIN_MBPS, HYSTERESIS_K))
        return 0
    if len(chosen) < MIN_HEALTHY:
        log("WARNING: only %d stable relay(s) (< %d) — egress redundancy is thin, add/own more relays" % (len(chosen), MIN_HEALTHY))

    relays = []
    for i, (score, k, cfg, success, _e) in enumerate(chosen, 1):
        try:
            relays.append(build_outbound("relay-%d" % i, cfg))
        except Exception as e:
            log("skip relay (%s): %s" % (cfg.get("address"), e))
    if not relays:
        log("SAFETY: chosen relays unrenderable -> leaving pool unchanged")
        return 0

    cfg_doc = json.load(open(CFG))
    cur = [o for o in cfg_doc.get("outbounds", []) if str(o.get("tag", "")).startswith("relay-")]
    if sorted(identity(o) for o in cur) == sorted(identity(o) for o in relays):
        log("no change (%d relays): %s" % (len(relays), ", ".join(identity(o) for o in relays)))
        return 0

    others = [o for o in cfg_doc.get("outbounds", []) if not str(o.get("tag", "")).startswith("relay-")]
    cfg_doc["outbounds"] = relays + others
    tmp = CFG + ".pool.json"
    json.dump(cfg_doc, open(tmp, "w"), indent=2)
    test = subprocess.run([XRAY, "run", "-test", "-config", tmp], capture_output=True, text=True, timeout=30)
    if "Configuration OK" not in (test.stdout + test.stderr):
        log("xray -test FAILED, aborting:\n" + (test.stdout + test.stderr)[-500:])
        os.remove(tmp)
        return 1
    os.replace(CFG, CFG + ".bak-" + time.strftime("%Y%m%d-%H%M%S"))
    os.replace(tmp, CFG)
    subprocess.run(["systemctl", "restart", "xray"], timeout=30)
    log("pool updated -> %d relays: %s" % (len(relays), ", ".join(identity(o) for o in relays)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
