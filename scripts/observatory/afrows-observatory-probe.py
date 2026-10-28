#!/usr/bin/env python3
"""Afrows path observatory: one probe cycle (run every 60 s by afrows-observatory.timer).

Appends one JSON line per probe to OBS_LOG (default /var/log/afrows-observatory/probe.jsonl):
  {"ts": "...Z", "vantage": "iran|usa", "probe": "<name>", "ok": bool, "ms": int|null, "detail": "..."}
ts is the cycle start (same for every probe of a cycle) so lines group by minute.

Purely additive and read-only: it only issues outbound requests through existing
loopback socks ports and reads state files. No listeners, no config changes, and
stdlib + curl/ping only. All probes of a cycle run in parallel (bounded timeouts),
so a cycle takes about 20 s at most. The file rotates to .1 at OBS_MAX_BYTES (~20 MB).

Probe names (prefix = hop class, used by analyze.py):
  iran: chain.*      via 127.0.0.1:10812 (via-germany = what customers get);
                     chain.ip_literal needs no DNS at the USA exit
        usasocks.*   via 127.0.0.1:1083 (via-usa, Telegram proxy)
        direct.*     the Iran server own internet (foreign + Iranian site)
        tcp.usa8447, ping.usa   raw reachability of the USA exit IP/port
        state.catchall, state.xraypid   informational (renderer decision, xray restarts)
  usa:  ping.iran, tcp.iran443, tls.iran_sni   USA -> Iran return path
        cf.app       https://app.afrows.com/ through Cloudflare
        direct.google204   the USA server own internet (control)
        tcp.1111, dns.8844, dns.system   USA egress by IP literal vs DNS (upstream / system stub)
"""
import fcntl
import json
import os
import re
import socket
import subprocess
import sys
import threading
import time
from datetime import datetime, timezone

LOG = os.environ.get("OBS_LOG", "/var/log/afrows-observatory/probe.jsonl")
MAX_BYTES = int(os.environ.get("OBS_MAX_BYTES", str(20 * 1024 * 1024)))
DL_EVERY = max(1, int(os.environ.get("OBS_DL_EVERY", "5")))  # minutes between 1 MB downloads
HEALTH = "/var/lib/afrows/egress-health.json"
USA_IP = os.environ.get("OBS_USA_IP", "93.127.140.50")
IRAN_IP = os.environ.get("OBS_IRAN_IP", "185.252.30.123")
CHAIN_SOCKS = os.environ.get("OBS_CHAIN_SOCKS", "127.0.0.1:10812")
USA_SOCKS = os.environ.get("OBS_USA_SOCKS", "127.0.0.1:1083")
G204 = "https://www.google.com/generate_204"
DL_URL = os.environ.get("OBS_DL_URL", "https://dl.google.com/go/go1.22.0.linux-amd64.tar.gz")
DL_BYTES = 1048576
CURL_PARALLEL = max(1, int(os.environ.get("OBS_CURL_PARALLEL", "3")))


def curl(url, socks=None, timeout=10, extra=(), want=None):
    """GET url (optionally through socks5h). ok = curl rc 0 and HTTP status in want
    (default: any 2xx/3xx). Returns (ok, ms, detail). Never raises."""
    cmd = ["curl", "-s", "-o", "/dev/null", "-m", str(timeout),
           "-w", "%{http_code} %{time_connect} %{time_appconnect} %{time_total} %{size_download}"]
    if socks:
        # No --connect-timeout through socks: with socks5h it also covers the remote
        # dial by xray, so only the total budget applies (same as the renderer probe).
        cmd += ["--socks5-hostname", socks]
    else:
        cmd += ["--connect-timeout", "6"]
    cmd += list(extra) + [url]
    t0 = time.monotonic()
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout + 5)
        rc, out = r.returncode, r.stdout.split()
    except Exception as e:  # pragma: no cover - defensive
        return False, None, "exc=%s" % type(e).__name__
    ms = int((time.monotonic() - t0) * 1000)
    code = out[0] if out else "000"
    ok = rc == 0 and (code in want if want else code[:1] in ("2", "3"))
    conn, tls = (out[1], out[2]) if len(out) >= 3 else ("?", "?")
    detail = "http=%s rc=%d conn=%s tls=%s" % (code, rc, conn, tls)
    if len(out) >= 5:
        detail += " bytes=%s" % out[4]
    return ok, ms, detail


def download(socks):
    ok, ms, detail = curl(DL_URL, socks=socks, timeout=20, extra=("-r", "0-%d" % (DL_BYTES - 1)),
                          want=("200", "206"))
    m = re.search(r"bytes=(\d+)", detail)
    got = int(m.group(1)) if m else 0
    ok = ok and got >= DL_BYTES
    if got and ms:
        detail += " mbps=%.2f" % (got * 8 / 1000.0 / ms)
    return ok, ms, detail


def tcp(host, port, timeout=5):
    t0 = time.monotonic()
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True, int((time.monotonic() - t0) * 1000), "connected"
    except Exception as e:
        why = getattr(e, "strerror", None) or type(e).__name__
        return False, int((time.monotonic() - t0) * 1000), "err=%s" % why


def ping(host, count=5):
    try:
        r = subprocess.run(["ping", "-n", "-q", "-c", str(count), "-i", "0.2", "-W", "2", host],
                           capture_output=True, text=True, timeout=count * 2 + 5)
    except Exception as e:
        return False, None, "exc=%s" % type(e).__name__
    loss = re.search(r"([\d.]+)% packet loss", r.stdout)
    rtt = re.search(r"= [\d.]+/([\d.]+)/([\d.]+)", r.stdout)
    lp = float(loss.group(1)) if loss else 100.0
    ms = int(float(rtt.group(1))) if rtt else None
    return lp < 100.0, ms, "loss=%g%%%s" % (lp, " max=%s" % rtt.group(2) if rtt else "")


def dns_query(server, name="www.google.com", timeout=4):
    """One uncached A query straight to server:53 over UDP (bypasses the local stub cache)."""
    qid = os.getpid() & 0xFFFF
    q = qid.to_bytes(2, "big") + bytes.fromhex("01000001000000000000")
    q += b"".join(bytes([len(p)]) + p.encode() for p in name.split(".")) + bytes.fromhex("0000010001")
    t0 = time.monotonic()
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sk:
            sk.settimeout(timeout)
            sk.sendto(q, (server, 53))
            data = sk.recv(1500)
    except Exception as e:
        return False, int((time.monotonic() - t0) * 1000), "err=%s" % type(e).__name__
    ms = int((time.monotonic() - t0) * 1000)
    rcode, ancount = data[3] & 0x0F, int.from_bytes(data[6:8], "big")
    return rcode == 0 and ancount > 0, ms, "rcode=%d answers=%d" % (rcode, ancount)


def resolve(name="api.telegram.org"):
    """System resolver (the path the USA xray uses: Go resolver -> 127.0.0.53 stub)."""
    t0 = time.monotonic()
    try:
        n = len(socket.getaddrinfo(name, 443, socket.AF_INET, socket.SOCK_STREAM))
        return n > 0, int((time.monotonic() - t0) * 1000), "addrs=%d" % n
    except Exception as e:
        return False, int((time.monotonic() - t0) * 1000), "err=%s" % type(e).__name__


def catchall():
    try:
        with open(HEALTH) as f:
            h = json.load(f)
    except Exception as e:
        return False, None, "unreadable=%s" % type(e).__name__
    age = None
    try:
        age = int(time.time() - datetime.strptime(h.get("updatedAt", ""), "%Y-%m-%dT%H:%M:%SZ")
                  .replace(tzinfo=timezone.utc).timestamp())
    except Exception:
        pass
    applied = h.get("appliedCatchAll")
    return applied != "direct", None, "applied=%s germanyUp=%s age=%ss" % (applied, h.get("germanyUp"), age)


def xraypid():
    try:
        out = subprocess.run(["systemctl", "show", "-p", "MainPID", "--value", "afrows-xray"],
                             capture_output=True, text=True, timeout=5).stdout.strip()
        pid = int(out or 0)
    except Exception:
        pid = 0
    return pid > 0, None, "pid=%d" % pid


def probes(vantage, minute):
    if vantage == "iran":
        p = {
            "chain.google204": lambda: curl(G204, CHAIN_SOCKS, want=("204",)),
            "chain.youtube": lambda: curl("https://www.youtube.com/", CHAIN_SOCKS),
            "chain.telegram": lambda: curl("https://api.telegram.org/", CHAIN_SOCKS),
            # IP literal: the USA exit needs no DNS for this one (splits USA DNS vs egress)
            "chain.ip_literal": lambda: curl("https://1.1.1.1/cdn-cgi/trace", CHAIN_SOCKS),
            "usasocks.google204": lambda: curl(G204, USA_SOCKS, want=("204",)),
            "direct.google204": lambda: curl(G204, want=("204",)),
            "direct.aparat": lambda: curl("https://www.aparat.com/"),
            "tcp.usa8447": lambda: tcp(USA_IP, 8447),
            "ping.usa": lambda: ping(USA_IP),
            "state.catchall": catchall,
            "state.xraypid": xraypid,
        }
        if minute % DL_EVERY == 0:
            p = dict([("chain.dl1m", lambda: download(CHAIN_SOCKS))] + list(p.items()))
        return p
    if vantage == "usa":
        return {
            "ping.iran": lambda: ping(IRAN_IP),
            "tcp.iran443": lambda: tcp(IRAN_IP, 443),
            "tls.iran_sni": lambda: curl("https://app.afrows.com/", extra=(
                "-k", "--resolve", "app.afrows.com:443:%s" % IRAN_IP)),
            "cf.app": lambda: curl("https://app.afrows.com/"),
            "direct.google204": lambda: curl(G204, want=("204",)),
            "tcp.1111": lambda: tcp("1.1.1.1", 443),
            "dns.8844": lambda: dns_query("8.8.4.4"),
            "dns.system": resolve,
        }
    raise SystemExit("unknown vantage %r (want iran or usa)" % vantage)


def rotate():
    try:
        if os.path.getsize(LOG) >= MAX_BYTES:
            os.replace(LOG, LOG + ".1")
    except FileNotFoundError:
        pass


def main():
    vantage = (sys.argv[1] if len(sys.argv) > 1 else os.environ.get("OBS_VANTAGE", "")).strip()
    now = datetime.now(timezone.utc).replace(microsecond=0)
    ts = now.strftime("%Y-%m-%dT%H:%M:%SZ")
    todo = probes(vantage, now.hour * 60 + now.minute)
    results = {}
    # The Iran server has 1 vCPU: ~9 concurrent curl TLS handshakes inflate every latency by
    # 1-2 s. Cap the curl probes at CURL_PARALLEL; cheap socket/ping/state probes run free.
    gate = threading.BoundedSemaphore(CURL_PARALLEL)

    def run(name, fn):
        heavy = not name.startswith(("ping.", "tcp.", "state.", "dns."))
        try:
            if heavy:
                with gate:
                    results[name] = fn()
            else:
                results[name] = fn()
        except Exception as e:  # pragma: no cover - a probe must never kill the cycle
            results[name] = (False, None, "exc=%s" % type(e).__name__)

    threads = [threading.Thread(target=run, args=(n, f), daemon=True) for n, f in todo.items()]
    for t in threads:
        t.start()
    for t in threads:
        t.join(48)
    os.makedirs(os.path.dirname(LOG), exist_ok=True)
    with open(LOG + ".lock", "w") as lk:
        fcntl.flock(lk, fcntl.LOCK_EX)
        rotate()
        with open(LOG, "a") as f:
            for name in todo:
                ok, ms, detail = results.get(name, (False, None, "no-result"))
                f.write(json.dumps({"ts": ts, "vantage": vantage, "probe": name, "ok": bool(ok),
                                    "ms": ms, "detail": detail}, separators=(",", ":")) + "\n")


if __name__ == "__main__":
    main()
