#!/usr/bin/env python3
"""Merge Afrows observatory JSONL (Iran + USA vantages) and attribute each outage to a hop.

usage:
  python3 analyze.py iran.jsonl usa.jsonl [--router-log router.txt] [--router-tz +03:30]
                     [--renderer-log renderer.txt] [--since 2026-10-28T12:00] [--until ...]
                     [--merge-gap 0] [--min-minutes 1]

Inputs (any number of JSONL files, rotated .1 files included) as written by
afrows-observatory-probe.py. Optional:
  --router-log    output of RouterOS  /log print where message~"afr-watch"  (router local time,
                  converted with --router-tz, default +03:30 = Asia/Tehran)
  --renderer-log  output of  journalctl -u afrows-egress-mode-sync -o short-iso  (UTC)

Prints: per-probe success rate + p50/p95 latency, state events (catch-all flips, afrows-xray
restarts), every failure episode (consecutive failing minutes) with the probes that failed
together and a verdict naming the indicted hop, then the renderer / router episodes.
Stdlib only; never needs network access.
"""
import argparse
import json
import re
import sys
from collections import Counter, OrderedDict, defaultdict
from datetime import datetime, timedelta, timezone

UTC = timezone.utc


def pct(vals, q):
    if not vals:
        return None
    v = sorted(vals)
    return v[min(len(v) - 1, max(0, int(round(q / 100.0 * len(v) + 0.5)) - 1))]


def minute(ts):
    return datetime.strptime(ts[:16], "%Y-%m-%dT%H:%M").replace(tzinfo=UTC)


def fmt(dt):
    return dt.strftime("%m-%d %H:%M")


def load(paths, since, until):
    recs = []
    for p in paths:
        with open(p, encoding="utf-8", errors="replace") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    r = json.loads(line)
                    r["_m"] = minute(r["ts"])
                except Exception:
                    continue
                if since and r["_m"] < since or until and r["_m"] > until:
                    continue
                recs.append(r)
    recs.sort(key=lambda r: (r["_m"], r["vantage"], r["probe"]))
    return recs


def key(r):
    return "%s:%s" % (r["vantage"], r["probe"])


def stats(recs):
    by = OrderedDict()
    for r in recs:
        by.setdefault(key(r), []).append(r)
    print("== Per-probe stats (latency over successful samples, ms)")
    print("%-26s %6s %8s %7s %7s  %s" % ("probe", "n", "success", "p50", "p95", "notes"))
    for k in sorted(by):
        rs = by[k]
        if ":state." in k:
            continue
        ok = [r for r in rs if r["ok"]]
        ms = [r["ms"] for r in ok if r.get("ms") is not None]
        note = ""
        if k.endswith("chain.dl1m"):
            mb = [float(m.group(1)) for r in ok for m in [re.search(r"mbps=([\d.]+)", r["detail"])] if m]
            if mb:
                note = "Mbps p50=%.1f min=%.1f max=%.1f" % (pct(mb, 50), min(mb), max(mb))
        if k.endswith("ping.usa") or k.endswith("ping.iran"):
            loss = [float(m.group(1)) for r in rs for m in [re.search(r"loss=([\d.]+)%", r["detail"])] if m]
            if loss:
                note = "avg loss %.1f%%, cycles with any loss %d" % (sum(loss) / len(loss), sum(1 for x in loss if x > 0))
        fails = Counter(re.sub(r"conn=\S+ tls=\S+ ?|bytes=\d+ ?", "", r["detail"]).strip() for r in rs if not r["ok"])
        if fails:
            note += ("; " if note else "") + "fail: " + ", ".join("%s x%d" % kv for kv in fails.most_common(3))
        print("%-26s %6d %7.2f%% %7s %7s  %s" % (k, len(rs), 100.0 * len(ok) / len(rs),
                                               pct(ms, 50), pct(ms, 95), note))
    print()


def state_events(recs):
    """Catch-all flips and afrows-xray MainPID changes, in time order."""
    ev = []
    last = {}
    for r in recs:
        if r["vantage"] != "iran" or not r["probe"].startswith("state."):
            continue
        if r["probe"] == "state.catchall":
            m = re.search(r"applied=(\S+)", r["detail"])
            val = m.group(1) if m else "?"
        else:
            m = re.search(r"pid=(\d+)", r["detail"])
            val = m.group(1) if m else "?"
        prev = last.get(r["probe"])
        if prev is not None and val != prev:
            what = "catch-all %s -> %s" % (prev, val) if r["probe"] == "state.catchall" \
                else "afrows-xray restarted (pid %s -> %s)" % (prev, val)
            ev.append((r["_m"], what))
        last[r["probe"]] = val
    return ev


def verdict(F, gaps, okset=frozenset(), peak=99):
    """F = failed 'vantage:probe' keys during an episode; okset = keys that succeeded at least
    once in it; gaps = vantages with no data."""
    has = lambda *ks: any(k in F for k in ks)
    chain_core = has("iran:chain.google204")
    chain_any = any(k.startswith("iran:chain.") for k in F)
    usas = has("iran:usasocks.google204")
    tcpusa, pingusa = has("iran:tcp.usa8447"), has("iran:ping.usa")
    dint, dir_ir = has("iran:direct.google204"), has("iran:direct.aparat")
    ret = [k for k in ("usa:ping.iran", "usa:tcp.iran443", "usa:tls.iran_sni") if k in F]
    usanet, cf = has("usa:direct.google204"), has("usa:cf.app")
    chain_ipl = has("iran:chain.ip_literal")
    usadns = [k for k in ("usa:dns.8844", "usa:dns.system") if k in F]
    usatcp = has("usa:tcp.1111")
    out = []
    if peak <= 1 and not gaps:
        return ["SPORADIC: isolated single-request failure(s), never 2 probes in the same minute "
                "(a stalled flow, not a hop outage)"]
    if "iran" in gaps:
        out.append("NO IRAN DATA: Iran server down/frozen or probe timer stalled")
    if dir_ir and dint:
        out.append("IRAN SERVER / DC NETWORK: even the Iranian site fails")
    elif dir_ir:
        out.append("aparat only (Iranian site itself; not our path)")
    if dint and not dir_ir:
        if tcpusa or pingusa:
            out.append("DC INTERNATIONAL LINK: all foreign traffic from the Iran server fails")
        else:
            out.append("direct google fails but USA reachable: partial international filtering")
    if (tcpusa or pingusa) and not dint:
        if tcpusa and pingusa:
            out.append("USA IP UNREACHABLE FROM IRAN: IP-level block/DPI on 93.127.140.50 or its route")
        elif tcpusa:
            out.append("PORT 8447 BLOCKED (TCP fails, ICMP fine): port/protocol DPI on the SS port")
        else:
            out.append("ICMP loss to USA only (TCP fine): minor")
        if ret:
            out.append("+ USA->Iran also failing (%s): bidirectional inter-DC problem" % ",".join(ret))
    if ret and not (tcpusa or pingusa):
        if ret == ["usa:tls.iran_sni"]:
            out.append("RETURN PATH, TLS only: Iran nginx/TLS or SNI filtering on USA->Iran")
        else:
            out.append("RETURN PATH USA->Iran (%s)" % ",".join(ret))
    if usadns:
        out.append("USA DNS FAILING (%s): every domain the USA xray dials needs it" % ",".join(usadns))
    if usatcp and usanet:
        out.append("USA SERVER EGRESS (IP-literal TCP to 1.1.1.1 and google both fail)")
    elif usanet and not usadns:
        out.append("USA SERVER INTERNET (its own google 204 fails)")
    if (chain_any or usas) and not (tcpusa or pingusa or dint or usanet or usadns or "iran" in gaps):
        if chain_core and not chain_ipl and "iran:chain.ip_literal" in okset:
            out.append("USA EXIT NAME RESOLUTION: domain targets fail through the chain while the "
                       "IP-literal target works (SS tunnel up; USA xray -> systemd-resolved -> 8.8.4.4)")
        elif chain_core and usas:
            out.append("CHAIN / USA SIDE: SS sessions to 8447 fail while raw TCP+ICMP to USA are fine "
                       "(flow-level DPI on the SS stream, or the USA xray)")
        elif chain_core:
            out.append("via-germany outbound only (10812 fails, 1083 fine): Iran xray outbound state")
        elif usas:
            out.append("via-usa outbound only (1083 fails, 10812 fine)")
        else:
            out.append("PARTIAL: heavier chain fetches (youtube/telegram/1MB) fail, google 204 ok: "
                       "slow/throttled chain or site-specific")
    if cf and not ret:
        out.append("Cloudflare -> origin path only (cf.app)")
    if "usa" in gaps:
        out.append("no USA data (USA server/timer)")
    return out or ["unclassified"]


def episodes(recs, merge_gap, min_minutes, extra_events):
    per_min = defaultdict(lambda: {"fail": set(), "seen": set(), "ok": set()})
    span = {}
    for r in recs:
        if r["probe"].startswith("state."):
            continue
        b = per_min[r["_m"]]
        b["seen"].add(r["vantage"])
        (b["ok"] if r["ok"] else b["fail"]).add(key(r))
        lo, hi = span.get(r["vantage"], (r["_m"], r["_m"]))
        span[r["vantage"]] = (min(lo, r["_m"]), max(hi, r["_m"]))
    if not span:
        return []
    start = min(lo for lo, _ in span.values())
    end = max(hi for _, hi in span.values())
    bad = []
    t = start
    while t <= end:
        b = per_min.get(t, {"fail": set(), "seen": set(), "ok": set()})
        gaps = {v for v, (lo, hi) in span.items() if lo <= t <= hi and v not in b["seen"]}
        if b["fail"] or gaps:
            bad.append((t, b["fail"], gaps, b["ok"]))
        t += timedelta(minutes=1)
    eps = []
    for t, fail, gaps, oks in bad:
        if eps and (t - eps[-1]["end"]) <= timedelta(minutes=1 + merge_gap):
            e = eps[-1]
            e["end"] = t
        else:
            e = {"start": t, "end": t, "fail": Counter(), "gaps": Counter(), "minutes": 0, "ok": set(),
                 "peak": 0}
            eps.append(e)
        e["minutes"] += 1
        e["fail"].update(fail)
        e["gaps"].update(gaps)
        e["ok"] |= oks
        e["peak"] = max(e["peak"], len(fail))
    eps = [e for e in eps if e["minutes"] >= min_minutes]
    for e in eps:
        lo, hi = e["start"] - timedelta(minutes=2), e["end"] + timedelta(minutes=2)
        e["events"] = ["%s %s" % (fmt(t), w) for t, w in extra_events if lo <= t <= hi]
        e["verdict"] = verdict(set(e["fail"]), set(e["gaps"]), e["ok"], e["peak"])
    return eps


def print_episodes(eps):
    print("== Failure episodes (minutes with >=1 failed probe; counts = failing minutes)")
    if not eps:
        print("(none)")
    for i, e in enumerate(eps, 1):
        dur = int((e["end"] - e["start"]).total_seconds() // 60) + 1
        print("#%d  %s .. %s  (%d min, %d failing)" % (i, fmt(e["start"]), e["end"].strftime("%H:%M"),
                                                       dur, e["minutes"]))
        fails = ", ".join("%s x%d" % kv for kv in sorted(e["fail"].items(), key=lambda kv: -kv[1]))
        print("    failed : %s" % (fails or "-"))
        if e["gaps"]:
            print("    no data: %s" % ", ".join("%s x%d" % kv for kv in e["gaps"].items()))
        for ev in e["events"]:
            print("    event  : %s" % ev)
        for v in e["verdict"]:
            print("    VERDICT: %s" % v)
    print()


MONTHS = {m: i for i, m in enumerate("jan feb mar apr may jun jul aug sep oct nov dec".split(), 1)}


def parse_tz(s):
    m = re.match(r"([+-])(\d{1,2}):?(\d{2})$", s)
    if not m:
        raise SystemExit("bad --router-tz %r" % s)
    d = timedelta(hours=int(m.group(2)), minutes=int(m.group(3)))
    return d if m.group(1) == "+" else -d


def router_events(path, tz, year, bare_date):
    """afr-watch lines -> [(utc datetime, target, UP/DOWN)]. Handles RouterOS 7 (YYYY-MM-DD HH:MM:SS),
    older (mon/DD HH:MM:SS) and today-only (HH:MM:SS, dated with --router-date)."""
    out = []
    with open(path, encoding="utf-8", errors="replace") as f:
        for line in f:
            m = re.search(r"afr-watch (\S+) (UP|DOWN)\b", line)
            if not m or "Netwatch config" in line:
                continue
            d = re.search(r"(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})", line)
            o = re.search(r"\b([a-z]{3})/(\d{2})/?(\d{4})? (\d{2}):(\d{2}):(\d{2})", line)
            b = re.match(r"\s*(\d{2}):(\d{2}):(\d{2})\s", line)
            try:
                if d:
                    t = datetime(*map(int, d.groups()))
                elif o and o.group(1) in MONTHS:
                    t = datetime(int(o.group(3) or year), MONTHS[o.group(1)], int(o.group(2)),
                                 int(o.group(4)), int(o.group(5)), int(o.group(6)))
                elif b and bare_date:
                    t = datetime.strptime(bare_date, "%Y-%m-%d").replace(
                        hour=int(b.group(1)), minute=int(b.group(2)), second=int(b.group(3)))
                else:
                    continue
            except ValueError:
                continue
            out.append(((t - tz).replace(tzinfo=UTC), m.group(1), m.group(2)))
    return sorted(out)


def print_router(evs):
    print("== Home router (Shatel vantage) afr-watch DOWN intervals, UTC")
    down = {}
    rows = 0
    for t, tgt, st in evs:
        if st == "DOWN":
            down.setdefault(tgt, t)
        elif tgt in down:
            s = down.pop(tgt)
            print("  %-12s DOWN %s .. %s (%ds)" % (tgt, fmt(s), t.strftime("%H:%M:%S"), (t - s).total_seconds()))
            rows += 1
    for tgt, s in down.items():
        print("  %-12s DOWN since %s (no UP yet)" % (tgt, fmt(s)))
        rows += 1
    if not rows:
        print("  (no DOWN events)")
    print()


def renderer_episodes(path, since, until):
    """journalctl short-iso of afrows-egress-mode-sync -> via-germany DOWN runs."""
    rx = re.compile(r"^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})\S*\s.*\] failover: via-germany=(\S+).*"
                    r"-> catch-all=(\S+)")
    runs, cur = [], None
    with open(path, encoding="utf-8", errors="replace") as f:
        for line in f:
            m = rx.search(line)
            if not m:
                continue
            t = datetime.strptime(m.group(1), "%Y-%m-%dT%H:%M:%S").replace(tzinfo=UTC)
            if since and t < since or until and t > until:
                continue
            down, applied = m.group(2) == "DOWN", m.group(3)
            if down:
                if cur is None:
                    cur = {"start": t, "end": t, "n": 0, "direct": None}
                cur["end"] = t
                cur["n"] += 1
                if applied == "direct" and cur["direct"] is None:
                    cur["direct"] = t
            elif cur is not None:
                cur["up"] = t
                runs.append(cur)
                cur = None
    if cur:
        runs.append(cur)
    return runs


def print_renderer(runs, recs_span):
    print("== Renderer (afrows-egress-mode-sync) via-germany DOWN runs")
    print("  %-12s %-9s %5s %-11s %s" % ("first DOWN", "first UP", "runs", "direct at", "note"))
    for r in runs:
        up = r.get("up")
        note = "single-run blip (no flip)" if r["n"] == 1 and not r["direct"] else ""
        if recs_span and recs_span[0] <= r["start"] <= recs_span[1]:
            note += (" | " if note else "") + "covered by probe data"
        print("  %-12s %-9s %5d %-11s %s" % (fmt(r["start"]), up.strftime("%H:%M:%S") if up else "-",
                                             r["n"], r["direct"].strftime("%H:%M:%S") if r["direct"] else "-",
                                             note))
    lens = [int(((r.get("up") or r["end"]) - r["start"]).total_seconds() // 60) for r in runs if r["direct"]]
    if lens:
        print("  flips to direct: %d, DOWN-run minutes: %s" % (len(lens), lens))
    print()


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("jsonl", nargs="*")
    ap.add_argument("--router-log")
    ap.add_argument("--router-tz", default="+03:30")
    ap.add_argument("--router-year", type=int, default=datetime.now(UTC).year)
    ap.add_argument("--router-date", help="date for bare HH:MM:SS router lines (YYYY-MM-DD, router local)")
    ap.add_argument("--renderer-log")
    ap.add_argument("--since")
    ap.add_argument("--until")
    ap.add_argument("--merge-gap", type=int, default=0, help="merge episodes separated by <= N ok minutes")
    ap.add_argument("--min-minutes", type=int, default=1, help="hide episodes shorter than N failing minutes")
    a = ap.parse_args()
    since = minute(a.since) if a.since else None
    until = minute(a.until) if a.until else None
    recs = load(a.jsonl, since, until)
    span = None
    if recs:
        span = (recs[0]["_m"], recs[-1]["_m"])
        vs = Counter(r["vantage"] for r in recs)
        cycles = {v: len({r["_m"] for r in recs if r["vantage"] == v}) for v in vs}
        print("Probe data %s .. %s UTC; cycles per vantage: %s" % (fmt(span[0]), fmt(span[1]), cycles))
        print()
        stats(recs)
    extra = state_events(recs)
    rev = []
    if a.router_log:
        rev = router_events(a.router_log, parse_tz(a.router_tz), a.router_year, a.router_date)
        extra += [(t.replace(second=0), "router: %s %s" % (tgt, st)) for t, tgt, st in rev]
    extra.sort()
    if recs:
        print("== State events (catch-all flips, afrows-xray restarts)")
        evs = state_events(recs)
        print("\n".join("  %s %s" % (fmt(t), w) for t, w in evs) or "  (none)")
        print()
        print_episodes(episodes(recs, a.merge_gap, a.min_minutes, extra))
    if a.renderer_log:
        print_renderer(renderer_episodes(a.renderer_log, since, until), span)
    if a.router_log:
        print_router(rev)


if __name__ == "__main__":
    main()
