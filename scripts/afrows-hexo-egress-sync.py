#!/usr/bin/env python3
"""Afrows -> Hexogate per-country egress reconciler (companion to afrows-egress-mode-sync.py).

The operator owns both Afrows and Hexogate. Hexogate publishes a SHARDED, rotating
subscription of VLESS/Shadowsocks client links to its own exit fronts in several
countries. This reconciler lets Afrows customers exit through that capacity while
Afrows keeps metering every customer at its own Iran inbound:

    customer -> Afrows Iran inbound (hexo-in-<cc>, bytes metered here as today)
             -> hexo-<cc> outbound (a Hexogate .ir front)
             -> Hexogate exit country

What it does, once per timer tick:
  1) Fetch the subscription from env AFROWS_HEXO_SUB_URL (a full https URL incl. a
     token; NEVER hardcoded, logged, or written to the repo) and base64-decode it.
  2) Parse each link into a structured front and pick ONE best front per country from
     AFROWS_HEXO_COUNTRIES. Preference: .ir-front REALITY > .ir-front TLS(VIP) > ss,
     HTTP last; SKIP *.clients.your-server.de (Hetzner-direct, throttled ~9s); prefer
     primary country tags over secondaries (NL over NL2, TR over TR2) as a tiebreaker.
  3) Emit one xray outbound `hexo-<cc>` per resolved country, one Afrows WS inbound
     `hexo-in-<cc>` (cloned from the customer ws inbound `afrows-in` so the SAME customer
     uuids authenticate and the SAME per-user email meters; listen=127.0.0.1 behind nginx,
     per-country ws path /afrowsws-<cc>), and the routing rule hexo-in-<cc> -> hexo-<cc>.
  4) Reconcile into the afrows-xray config idempotently: rewrite + restart ONLY on a
     real change; run `xray -test` first and KEEP LAST GOOD on failure. A country
     missing from the current (sharded) fetch keeps its previous good outbound rather
     than being dropped.

No secrets in this file. The sub URL/token and the operator's Hexogate UUID exist
only at runtime (env + the fetched body) and are redacted in every log / --dry-run.

Mirrors afrows-egress-mode-sync.py: file_env, upsert_tagged/drop_tagged, the
`xray -test` keep-last-good guard, and the oneshot-timer deploy shape.
"""
import argparse, base64, glob, json, os, re, socket, subprocess, sys, tempfile, time, urllib.parse, urllib.request

ENV = os.environ.get("AFROWS_ENV", "/etc/afrows/afrows.env")
XRAY = os.environ.get("AFROWS_XRAY_BIN", "/usr/local/bin/xray")
XRAY_CONFIG = os.environ.get("AFROWS_HEXO_XRAY_CONFIG", "/usr/local/etc/afrows-xray/config.json")
SERVICE = os.environ.get("AFROWS_HEXO_XRAY_SERVICE", "afrows-xray")
STATE_FILE = os.environ.get("AFROWS_HEXO_STATE_FILE", "/var/lib/afrows/hexo-egress.state")
# Resolved-countries state the backend reads to advertise a `Hexo <CC>` link ONLY for a
# country that currently has a live listener (inbound + outbound). Just country codes + a
# timestamp — no secrets. The backend treats it as fresh for ~30 min, so it is refreshed on
# every healthy tick (apply AND no-change), not only when something changed.
RESOLVED_FILE = os.environ.get("AFROWS_HEXO_RESOLVED_PATH", "/var/lib/afrows/hexo-resolved.json")
DEFAULT_COUNTRIES = "DE,NL,SE,TR,US,AM,RO"
# cc:port map, shared verbatim with the backend entry-link builder (AFROWS_HEXO_ENTRY_PORTS):
# the port a customer's "Hexo <CC>" link dials is exactly the hexo-in-<cc> inbound opened here.
DEFAULT_PORTS = "DE:8460,NL:8461,SE:8462,TR:8463,US:8464,AM:8465,RO:8466"
# The customer inbound whose identity (streamSettings incl. wsSettings) we clone onto each
# hexo-in-<cc>, so hexo entries reuse the existing transport + per-customer uuids/emails
# (metering unchanged). The LIVE Afrows Iran box has NO REALITY inbound: customers enter via
# nginx TLS on :443 -> WS, so the source is the ws inbound `afrows-in` (network=ws,
# security=none, listen=127.0.0.1). Still overridable by env.
CLONE_INBOUND_TAG = os.environ.get("AFROWS_HEXO_CLONE_INBOUND_TAG", "afrows-in")

# Health-check knobs. Live probing on the Iran box showed (a) several reality fronts are
# dead at any moment while their tls/http siblings work, and (b) some fronts exit in the
# WRONG country. So selection probes candidates and enforces an exit-country match. The
# xray binary used for the throwaway probe instance (same default as AFROWS_XRAY_BIN):
HEXO_XRAY = os.environ.get("AFROWS_HEXO_XRAY_BIN", XRAY)
# Cloudflare trace endpoint: UNLIMITED (no rate limit like ipinfo) and returns a `loc=XX`
# line we parse as the exit country.
DEFAULT_PROBE_URL = "https://www.cloudflare.com/cdn-cgi/trace"
_LOC_RE = re.compile(r"(?mi)^loc=([A-Za-z]{2})\b")

# Transport preference (lower = better). HTTP (security=none) is the weakest (no TLS
# record layer), so it ranks last; it is only chosen when nothing better exists for a cc.
TRANSPORT_RANK = {"reality": 0, "tls": 1, "ss": 2, "http": 3}
HETZNER_DIRECT_SUFFIX = ".clients.your-server.de"
REDACTED = "<redacted>"


def log(*a):
    print("[hexo-egress]", *a, flush=True)


def file_env(key, default=""):
    """Read KEY from the env FILE first (systemd has no shell env), then the process env."""
    try:
        with open(ENV) as f:
            for line in f:
                if line.startswith(key + "="):
                    return line.split("=", 1)[1].strip().strip('"').strip("\r")
    except Exception:
        pass
    return os.environ.get(key, default)


# --------------------------------------------------------------------------- parsing

def b64_decode_sub(raw):
    """Decode a subscription body. Hexogate returns base64 of the newline-joined links;
    a local --from-file may already be decoded. Auto-detect: if the bytes already look
    like links, use them as-is; else base64-decode (url-safe and standard, padded)."""
    text = raw.decode("utf-8", "replace") if isinstance(raw, (bytes, bytearray)) else raw
    stripped = text.strip()
    if "://" in stripped.split("\n", 1)[0]:
        return stripped
    compact = "".join(stripped.split())
    pad = "=" * (-len(compact) % 4)
    for alpha in (base64.b64decode, base64.urlsafe_b64decode):
        try:
            out = alpha((compact + pad).encode()).decode("utf-8", "replace")
            if "://" in out:
                return out.strip()
        except Exception:
            continue
    return stripped


def _remark_country(remark):
    """(base_cc, is_secondary) from a link remark, or (None, False) when it is not a
    country front. Remarks look like "🇳🇱 NL ▸ 👑 VIP" or "🇹🇷 TR2 ▸ 🛡 Reality". A '👤'
    (per-user) or '?' remark, or no 2-letter tag, is not a country."""
    if "👤" in remark:
        return None, False
    for token in remark.replace("▸", " ").split():
        t = token.strip()
        if len(t) in (2, 3) and t[:2].isalpha() and t[:2].isupper() and t[:2].isascii():
            if len(t) == 2:
                return t, False
            if t[2].isdigit():
                return t[:2], True  # NL2 / TR2 -> base NL/TR, secondary
    return None, False


def _parse_vless(url):
    """vless://UUID@HOST:PORT?QUERY -> dict of connection params (uuid redaction happens
    only at print time; the outbound needs the real uuid)."""
    rest = url[len("vless://"):]
    cred, _, hostpart = rest.partition("@")
    hostport, _, query = hostpart.partition("?")
    host, _, port = hostport.rpartition(":")
    q = {k: v[0] for k, v in urllib.parse.parse_qs(query, keep_blank_values=True).items()}
    security = q.get("security", "none")
    if security == "reality":
        transport = "reality"
    elif security == "tls":
        transport = "tls"
    else:
        transport = "http"  # security=none (bare / http-header camouflage)
    return {
        "scheme": "vless", "transport": transport, "uuid": cred, "host": host, "port": int(port),
        "security": security, "network": q.get("type", "tcp"), "header_type": q.get("headerType", "none"),
        "encryption": q.get("encryption", "none") or "none", "sni": q.get("sni", ""),
        "host_header": q.get("host", ""), "path": q.get("path", "/"), "fp": q.get("fp", "chrome"),
        "flow": q.get("flow", ""), "alpn": q.get("alpn", ""), "pbk": q.get("pbk", ""),
        "sid": q.get("sid", ""), "pqv": q.get("pqv", ""),
    }


def _parse_ss(url):
    """ss://BASE64(method:password)@HOST:PORT -> shadowsocks params."""
    rest = url[len("ss://"):]
    cred, _, hostport = rest.partition("@")
    host, _, port = hostport.rpartition(":")
    method, password = "", ""
    try:
        pad = "=" * (-len(cred) % 4)
        dec = base64.urlsafe_b64decode((cred + pad).encode()).decode("utf-8", "replace")
        method, _, password = dec.partition(":")
    except Exception:
        pass
    return {"scheme": "ss", "transport": "ss", "uuid": cred, "host": host, "port": int(port),
            "method": method, "password": password}


def parse_sub(text):
    """Decoded sub body -> list of parsed fronts, each tagged with (base_cc, secondary,
    skip, line index). Malformed lines are skipped. UUIDs/passwords are kept (needed for
    the outbound) and only redacted when printed."""
    fronts = []
    for i, line in enumerate(text.splitlines()):
        line = line.strip()
        if not line or "#" not in line:
            continue
        url, _, remark_raw = line.partition("#")
        remark = urllib.parse.unquote(remark_raw)
        try:
            if url.startswith("vless://"):
                f = _parse_vless(url)
            elif url.startswith("ss://"):
                f = _parse_ss(url)
            else:
                continue
        except Exception:
            continue
        cc, secondary = _remark_country(remark)
        f["cc"] = cc
        f["secondary"] = secondary
        f["remark"] = remark
        f["index"] = i
        f["skip"] = bool(f.get("host", "").endswith(HETZNER_DIRECT_SUFFIX)) or ("?" in remark)
        fronts.append(f)
    return fronts


def _rank(front):
    """Sort key: transport first (reality>tls>ss>http), then primary before secondary,
    then original order. Lower is better."""
    return (TRANSPORT_RANK.get(front["transport"], 99), 1 if front["secondary"] else 0, front["index"])


def select_per_country(fronts, countries):
    """{cc: best front} for the requested countries, applying the skip + preference rules.
    A country with no surviving candidate is simply absent (handled by keep-last-good).
    Rank-only (no probe) — the fallback when AFROWS_HEXO_HEALTHCHECK is off."""
    chosen = {}
    for cc in countries:
        cands = [f for f in fronts if f.get("cc") == cc and not f["skip"]]
        if cands:
            chosen[cc] = min(cands, key=_rank)
    return chosen


# --------------------------------------------------------------------------- health probe

def _free_port():
    """An ephemeral loopback TCP port, released immediately so xray can bind it. A tiny
    bind-race window exists but each probe picks a fresh port, so collisions self-heal."""
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]
    finally:
        s.close()


def _kill(proc):
    """Terminate a probe xray, escalating to kill, and reap it so no zombie is left."""
    if proc is None:
        return
    try:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait(timeout=5)
    except Exception:
        pass


def _front_key(f):
    """A stable identity for a front across shards (for prev-good stability matching)."""
    return (f.get("scheme"), f.get("host"), f.get("port"), f.get("transport"), f.get("uuid"))


def probe_front(front, probe_url=None, timeout=None, xray_bin=None):
    """REAL network probe (runs on the Iran box). Stand up a throwaway xray with a localhost
    socks inbound -> this front's outbound, curl the trace URL through it, and return the
    2-letter EXIT country (`loc=XX` from the Cloudflare trace), or None on any failure.
    Bounded timeouts, NEVER raises, and always cleans up the process + temp file (no
    zombies, fresh ephemeral port each call so no port collisions)."""
    probe_url = probe_url or file_env("AFROWS_HEXO_PROBE_URL", DEFAULT_PROBE_URL)
    xray_bin = xray_bin or HEXO_XRAY
    try:
        timeout = int(timeout if timeout is not None else file_env("AFROWS_HEXO_PROBE_TIMEOUT", "10"))
    except (TypeError, ValueError):
        timeout = 10
    port = _free_port()
    tmp = tempfile.NamedTemporaryFile("w", suffix=".hexo-probe.json", delete=False)
    proc = None
    try:
        cfg = {
            "log": {"loglevel": "none"},
            "inbounds": [{"tag": "probe-in", "listen": "127.0.0.1", "port": port,
                          "protocol": "socks", "settings": {"auth": "noauth", "udp": False}}],
            "outbounds": [build_outbound(front, "probe")],
        }
        json.dump(cfg, tmp)
        tmp.flush()
        tmp.close()
        proc = subprocess.Popen([xray_bin, "run", "-config", tmp.name],
                                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        time.sleep(3.5)  # let the outbound dial + complete its handshake
        if proc.poll() is not None:
            return None  # xray exited early (bad config / unreachable front)
        curl = subprocess.run(
            ["curl", "-s", "-m", str(timeout), "--socks5-hostname", "127.0.0.1:%d" % port, probe_url],
            capture_output=True, text=True, timeout=timeout + 5)
        if curl.returncode != 0:
            return None
        m = _LOC_RE.search(curl.stdout or "")
        return m.group(1).upper() if m else None
    except Exception:
        return None
    finally:
        _kill(proc)
        try:
            os.remove(tmp.name)
        except OSError:
            pass


def health_select_per_country(fronts, countries, prev, probe=probe_front,
                              max_candidates=None, budget=None, report=None):
    """{cc: front} keeping ONLY fronts whose PROBED exit country matches the label. For each
    country, probe candidates in `_rank` order and take the FIRST that exits in the right
    country. STABILITY: probe the previously-good front first and keep it if it still passes,
    to avoid churn. COST CAPS: stop at the first pass per country, probe at most
    AFROWS_HEXO_PROBE_MAX_CANDIDATES per country, and stop entirely once the wall-clock
    budget (AFROWS_HEXO_PROBE_BUDGET_SECS) is spent. A country with no passing front is
    simply absent from the result (-> keep-last-good keeps its outbound but the backend hides
    the link). `probe` is injectable so tests pass a fake (no network/xray). If `report` is a
    list, each probe outcome ({cc, front, loc, pass}) is appended for --dry-run."""
    try:
        max_candidates = int(max_candidates if max_candidates is not None
                             else file_env("AFROWS_HEXO_PROBE_MAX_CANDIDATES", "4"))
    except (TypeError, ValueError):
        max_candidates = 4
    try:
        budget = float(budget if budget is not None else file_env("AFROWS_HEXO_PROBE_BUDGET_SECS", "90"))
    except (TypeError, ValueError):
        budget = 90.0
    prev_fronts = (prev or {}).get("fronts", {})
    chosen = {}
    start = time.monotonic()
    for cc in countries:
        if time.monotonic() - start > budget:
            break
        cands = sorted((f for f in fronts if f.get("cc") == cc and not f["skip"]), key=_rank)
        # stability: if the previous good front is still offered this shard, probe it first
        prevf = prev_fronts.get(cc)
        if prevf:
            pk = _front_key(prevf)
            match = next((f for f in cands if _front_key(f) == pk), None)
            if match is not None:
                cands = [match] + [f for f in cands if f is not match]
        for f in cands[:max_candidates]:
            if time.monotonic() - start > budget:
                break
            loc = probe(f)
            if report is not None:
                report.append({"cc": cc, "front": f, "loc": loc, "pass": loc == cc})
            if loc == cc:
                chosen[cc] = f
                break
    return chosen


# --------------------------------------------------------------------------- outbounds

def build_outbound(front, tag):
    """A parsed front -> an xray outbound object (deterministic per front)."""
    if front["transport"] == "ss":
        return {"tag": tag, "protocol": "shadowsocks",
                "settings": {"servers": [{"address": front["host"], "port": front["port"],
                                          "method": front["method"], "password": front["password"]}]}}
    user = {"id": front["uuid"], "encryption": front.get("encryption", "none") or "none", "level": 0}
    if front.get("flow"):
        user["flow"] = front["flow"]
    alpn = [a for a in front.get("alpn", "").split(",") if a]
    if front["transport"] == "reality":
        reality = {"serverName": front["sni"], "fingerprint": front.get("fp") or "chrome",
                   "publicKey": front["pbk"], "shortId": front["sid"]}
        if front.get("pqv"):
            reality["mldsa65Verify"] = front["pqv"]  # post-quantum REALITY verify key (pqv= in the link)
        stream = {"network": front.get("network", "tcp"), "security": "reality", "realitySettings": reality}
    elif front["transport"] == "tls":
        tls = {"serverName": front["sni"], "fingerprint": front.get("fp") or "chrome", "allowInsecure": False}
        if alpn:
            tls["alpn"] = alpn
        stream = {"network": front.get("network", "tcp"), "security": "tls", "tlsSettings": tls}
    else:  # http: VLESS over a plain-HTTP request header, no TLS (weakest; last resort)
        stream = {"network": front.get("network", "tcp"), "security": "none"}
    if front.get("header_type") == "http" and front.get("network", "tcp") == "tcp":
        stream.setdefault("tcpSettings", {})["header"] = {
            "type": "http",
            "request": {"path": [front.get("path") or "/"],
                        "headers": {"Host": [front.get("host_header") or front["host"]]}},
        }
    return {"tag": tag, "protocol": "vless",
            "settings": {"vnext": [{"address": front["host"], "port": front["port"], "users": [user]}]},
            "streamSettings": stream}


def clone_inbound(primary, tag, port, cc):
    """Clone the source WS inbound's IDENTITY (streamSettings incl. wsSettings, security
    none) onto a new hexo inbound tag + port, with a per-country ws path and an EMPTY
    client list. The live source `afrows-in` is ws-behind-nginx (network=ws, security=none,
    listen=127.0.0.1, wsSettings.path=/afrowsws), so each hexo-in-<cc> MUST stay on
    127.0.0.1 behind nginx (NOT bind all interfaces) and gets its own path /afrowsws-<cc>;
    the app.afrows.com :443 nginx server maps that path to this inbound's port (see the
    nginx snippet in CONTRACT.md). Only entitlement-gated provisioning
    (XrayProvisioningService `xray api adu`, for customers with access_hexo=true) may
    populate a hexo inbound. This makes the Hexo gate fail-closed BY CONSTRUCTION: a
    non-entitled customer can never auth on hexo-in-<cc> even by hand-building a link,
    regardless of the clone source's static client list. Metering is unchanged (adu uses
    the same per-customer email). REQUIRES hexo-in-<cc> in AFROWS_XRAY_INBOUND_TAGS so
    entitled customers get adu'd (see CONTRACT)."""
    inbound = json.loads(json.dumps(primary))  # deep copy
    inbound["tag"] = tag
    inbound["port"] = port
    inbound["listen"] = "127.0.0.1"  # stay on loopback behind nginx (the ws source is 127.0.0.1)
    ws = inbound.setdefault("streamSettings", {}).setdefault("wsSettings", {})
    ws["path"] = "/afrowsws-%s" % cc.lower()  # per-country ws path nginx proxies to this port
    inbound.setdefault("settings", {})["clients"] = []  # fail-closed: only gated adu adds customers
    return inbound


# --------------------------------------------------------------------------- reconcile
# (upsert_tagged / drop_tagged mirror afrows-egress-mode-sync.py exactly.)

def upsert_tagged(items, want):
    for i, x in enumerate(items):
        if x.get("tag") == want["tag"]:
            if x == want:
                return False
            items[i] = want
            return True
    items.append(want)
    return True


def drop_tagged(items, tag):
    keep = [x for x in items if x.get("tag") != tag]
    changed = len(keep) != len(items)
    items[:] = keep
    return changed


def read_state():
    try:
        return json.load(open(STATE_FILE))
    except Exception:
        return {}


def write_state(state):
    try:
        os.makedirs(os.path.dirname(STATE_FILE), exist_ok=True)
        json.dump(state, open(STATE_FILE, "w"))
    except Exception:
        pass


def bump_last_healthy(last_healthy, passed, countries, now):
    """New per-country last-healthy-timestamp map: stamp `now` for every country that PASSED
    the health+geo probe this tick, carry the rest forward, and PRUNE entries for countries
    no longer configured. Pure (injectable `now`) so the grace logic is unit-testable."""
    keep = {c.upper() for c in countries}
    out = {cc.upper(): ts for cc, ts in (last_healthy or {}).items() if cc.upper() in keep}
    for cc in passed:
        if cc.upper() in keep:
            out[cc.upper()] = now
    return out


def resolved_countries(in_objs, out_objs, countries, healthy=None, last_healthy=None, grace=0, now=None):
    """Sorted, lowercased CCs the backend may advertise. A cc must ALWAYS have BOTH a live
    hexo-in-<cc> inbound AND a hexo-<cc> outbound in the config (no inbound/outbound -> never
    advertised). On top of that:

    - `healthy=None` (health-check OFF): config-presence-only (advertise every live listener).
    - `healthy` given (ON): advertise a cc if it PASSED the probe this tick (`cc in healthy`),
      OR — the GRACE WINDOW — it still has its live last-good outbound (checked above) and it
      last passed within `grace` seconds (`now - last_healthy[cc] <= grace`). This makes the
      advertised list as sticky as the outbound keep-last-good, so a single transient
      false-negative probe (a Cloudflare-trace blip / momentary front hiccup) does NOT drop a
      country from the customer's subscription. A cc leaves the list only when it loses its
      last-good outbound or has been failing continuously longer than the grace window."""
    have_in = {i.get("tag") for i in in_objs}
    have_out = {o.get("tag") for o in out_objs}
    allow = None if healthy is None else {c.lower() for c in healthy}
    lh = {str(k).upper(): v for k, v in (last_healthy or {}).items()}
    if now is None:
        now = time.time()
    out = []
    for cc in countries:
        lc = cc.lower()
        if ("hexo-in-%s" % lc) not in have_in or ("hexo-%s" % lc) not in have_out:
            continue  # no live inbound+outbound -> never advertised
        if allow is None or lc in allow:
            out.append(lc)  # off path (config presence), or passed this tick
            continue
        ts = lh.get(cc.upper())  # grace: kept-last-good outbound (checked above) + passed recently
        if ts is not None and (now - ts) <= grace:
            out.append(lc)
    return sorted(out)


def write_resolved(ccs, path=None):
    """Atomically publish the resolved-countries state (temp file in the same dir + replace,
    mode 0644, parent dir created). Country codes + a unix timestamp only; never secrets."""
    path = path or RESOLVED_FILE
    try:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        tmp = path + ".tmp"
        with open(tmp, "w") as f:
            json.dump({"countries": sorted(ccs), "updated_at": int(time.time())}, f)
        os.chmod(tmp, 0o644)
        os.replace(tmp, path)
    except Exception:
        pass


def parse_ports(spec):
    """"DE:8460,NL:8461" -> {"DE": 8460, ...}. Bad entries are skipped."""
    out = {}
    for item in spec.split(","):
        cc, _, port = item.strip().partition(":")
        cc = cc.strip().upper()
        try:
            if cc and port:
                out[cc] = int(port)
        except ValueError:
            continue
    return out


def resolve_outbounds(fronts, countries, ports, prev, chosen=None):
    """Decide the per-country outbound set. Freshly-resolved countries win; a country
    missing (or unhealthy) this tick keeps its previous good outbound. `chosen` is the
    pre-selected {cc: front} (health-checked when AFROWS_HEXO_HEALTHCHECK is on); if None,
    fall back to the rank-only selector. Returns
    (outbounds_by_cc, chosen_fronts_by_cc, source_by_cc)."""
    if chosen is None:
        chosen = select_per_country(fronts, countries)
    outbounds, fronts_by_cc, source = {}, {}, {}
    prev_out = prev.get("outbounds", {})
    for cc in countries:
        if cc not in ports:
            continue
        tag = "hexo-%s" % cc.lower()
        if cc in chosen:
            outbounds[cc] = build_outbound(chosen[cc], tag)
            fronts_by_cc[cc] = chosen[cc]
            source[cc] = "fresh"
        elif cc in prev_out:
            outbounds[cc] = prev_out[cc]
            source[cc] = "kept-last-good"
    return outbounds, fronts_by_cc, source


def redact_front(front):
    t = front["transport"]
    extra = "method=%s" % front.get("method", "") if t == "ss" else "sni=%s" % front.get("sni", "")
    return "%s:%d %s uuid=%s %s" % (front["host"], front["port"], t, REDACTED, extra)


SECRET_KEYS = ("id", "password", "publicKey", "privateKey", "shortId", "mldsa65Verify")


def _mask(obj):
    """Deep-copy an object with every secret field masked, for a safe diff/print."""
    clone = json.loads(json.dumps(obj))

    def walk(node):
        if isinstance(node, dict):
            for k, v in node.items():
                if k in SECRET_KEYS and isinstance(v, str):
                    node[k] = REDACTED
                elif isinstance(v, str) and k == "encryption" and v != "none":
                    node[k] = "mlkem768x25519plus.<redacted>"
                else:
                    walk(v)
        elif isinstance(node, list):
            for v in node:
                walk(v)
    walk(clone)
    return clone


def _collect_secrets(obj):
    """Every secret string value in a config (keys in SECRET_KEYS + non-'none' encryption),
    so they can be scrubbed out of any text (e.g. an xray error fragment) before logging."""
    found = set()

    def walk(node):
        if isinstance(node, dict):
            for k, v in node.items():
                if isinstance(v, str) and (k in SECRET_KEYS or (k == "encryption" and v != "none")):
                    if len(v) >= 4:
                        found.add(v)
                else:
                    walk(v)
        elif isinstance(node, list):
            for v in node:
                walk(v)
    walk(obj)
    return found


_LONG_TOKEN = re.compile(r"[A-Za-z0-9+/_\-]{20,}={0,2}")


def _scrub(text, secrets, cap=400):
    """Redact known secret values AND any long credential-like token from `text`, then cap
    its length — so a malformed candidate fragment echoed by `xray -test` cannot spill a
    key, uuid, or password into the journal."""
    for s in sorted(secrets, key=len, reverse=True):
        text = text.replace(s, REDACTED)
    text = _LONG_TOKEN.sub(REDACTED, text)
    return text[-cap:]


def prune_backups(path, keep=5):
    """Keep only the newest `keep` <path>.bak-* files; delete older ones. The backups hold
    the REALITY privateKey + Hexogate outbound creds, so an unbounded pile is a liability."""
    try:
        backups = sorted(glob.glob(path + ".bak-*"))
        for old in backups[:-keep]:
            os.remove(old)
    except Exception:
        pass


def build_desired(cfg, outbounds, ports, countries):
    """Return (new_outbounds, new_inbounds, new_rules, note) for the given config without
    mutating it. Inbounds are cloned from the source ws inbound (CLONE_INBOUND_TAG); if it
    is absent, inbounds/rules are skipped (outbounds still refresh) and the reason is
    returned."""
    out_objs = list(cfg.get("outbounds", []))
    in_objs = list(cfg.get("inbounds", []))
    rules = list(cfg.get("routing", {}).get("rules", []))
    note = None
    changed = False

    for cc in countries:
        tag = "hexo-%s" % cc.lower()
        if cc in outbounds:
            changed |= upsert_tagged(out_objs, outbounds[cc])
        else:
            changed |= drop_tagged(out_objs, tag)  # unresolved and no last-good -> remove stale

    primary = next((i for i in in_objs if i.get("tag") == CLONE_INBOUND_TAG), None)
    if primary is None:
        note = "source inbound '%s' not found; hexo inbounds/rules skipped" % CLONE_INBOUND_TAG
        # Drop any stale hexo inbounds/rules we previously created, so a renamed primary
        # inbound does not leave orphaned listeners.
        for cc in countries:
            changed |= drop_tagged(in_objs, "hexo-in-%s" % cc.lower())
        rules = [r for r in rules if not _is_hexo_rule(r)]
        return out_objs, in_objs, rules, note, changed

    for cc in countries:
        in_tag, out_tag = "hexo-in-%s" % cc.lower(), "hexo-%s" % cc.lower()
        has_out = any(o.get("tag") == out_tag for o in out_objs)
        if cc in ports and has_out:
            changed |= upsert_tagged(in_objs, clone_inbound(primary, in_tag, ports[cc], cc))
        else:
            changed |= drop_tagged(in_objs, in_tag)

    # Rebuild the hexo routing block deterministically (sorted), then splice it in right
    # after the `api` rule so it precedes the client catch-all. Non-hexo rules are kept
    # verbatim and in order (we never touch the via-germany/via-usa/via-backup ladder).
    non_hexo = [r for r in rules if not _is_hexo_rule(r)]
    hexo_rules = []
    for cc in sorted(countries):
        in_tag, out_tag = "hexo-in-%s" % cc.lower(), "hexo-%s" % cc.lower()
        if any(i.get("tag") == in_tag for i in in_objs) and any(o.get("tag") == out_tag for o in out_objs):
            hexo_rules.append({"type": "field", "inboundTag": [in_tag], "outboundTag": out_tag})
    insert_at = 1 if (non_hexo and non_hexo[0].get("outboundTag") == "api") else 0
    new_rules = non_hexo[:insert_at] + hexo_rules + non_hexo[insert_at:]
    if new_rules != rules:
        changed = True
    return out_objs, in_objs, new_rules, note, changed


def _is_hexo_rule(rule):
    tags = rule.get("inboundTag") or []
    return bool(tags) and all(isinstance(t, str) and t.startswith("hexo-in-") for t in tags)


def apply_config(cfg, out_objs, in_objs, rules):
    """Write a candidate config, `xray -test` it, and on success swap it in + restart.
    KEEP LAST GOOD: on a failed test the live config is untouched. Returns True on apply."""
    candidate = dict(cfg)
    candidate["outbounds"] = out_objs
    candidate["inbounds"] = in_objs
    candidate.setdefault("routing", {})["rules"] = rules
    tmp = XRAY_CONFIG + ".hexo.json"
    json.dump(candidate, open(tmp, "w"), indent=2)
    test = subprocess.run([XRAY, "run", "-test", "-config", tmp], capture_output=True, text=True, timeout=30)
    if "Configuration OK" not in (test.stdout + test.stderr):
        log("xray -test FAILED, keeping last good:\n%s" % _scrub(test.stdout + test.stderr, _collect_secrets(candidate)))
        os.remove(tmp)
        return False
    os.replace(XRAY_CONFIG, XRAY_CONFIG + ".bak-" + time.strftime("%Y%m%d-%H%M%S"))
    os.replace(tmp, XRAY_CONFIG)
    prune_backups(XRAY_CONFIG)
    subprocess.run(["systemctl", "restart", SERVICE], timeout=30)
    return True


def fetch_sub(url, timeout=20):
    req = urllib.request.Request(url, headers={"User-Agent": "afrows-hexo-sync"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def run(args):
    countries = [c.strip().upper() for c in file_env("AFROWS_HEXO_COUNTRIES", DEFAULT_COUNTRIES).split(",") if c.strip()]
    ports = parse_ports(file_env("AFROWS_HEXO_ENTRY_PORTS", DEFAULT_PORTS))

    if args.from_file:
        raw = open(args.from_file, "rb").read()
    else:
        url = file_env("AFROWS_HEXO_SUB_URL")
        if not url:
            log("AFROWS_HEXO_SUB_URL not set; nothing to do")
            return 0
        try:
            raw = fetch_sub(url)
        except Exception as e:
            log("subscription fetch failed (%s); keeping last good" % type(e).__name__)
            return 1  # do not touch the live config on a transient fetch error

    fronts = parse_sub(b64_decode_sub(raw))
    prev = read_state()

    # Selection: health-checked (probe + exit-country match) by default, rank-only when off.
    # `healthy` is the set of countries that PASSED this tick; it filters the resolved file so
    # the backend advertises ONLY verified-working, correctly-geolocated countries.
    healthcheck = file_env("AFROWS_HEXO_HEALTHCHECK", "1").strip().lower() not in ("0", "false", "no", "off")
    report = [] if (healthcheck and args.dry_run) else None
    if healthcheck:
        chosen = health_select_per_country(fronts, countries, prev, report=report)
    else:
        chosen = select_per_country(fronts, countries)
    outbounds, fronts_by_cc, source = resolve_outbounds(fronts, countries, ports, prev, chosen)
    healthy = set(chosen) if healthcheck else None

    # GRACE WINDOW for the resolved (advertised) file: stamp now for every country that passed
    # this tick, then advertise a country while it still has a live last-good outbound AND it
    # passed within the grace window — so a single transient false-negative probe does not
    # flap the customer's country list. Only passers (never rank-only picks) refresh the
    # timestamp, so the off path never feeds the grace logic.
    now = time.time()
    try:
        grace = float(file_env("AFROWS_HEXO_RESOLVED_GRACE_SECS", "1200"))
    except ValueError:
        grace = 1200.0
    passed = set(chosen) if healthcheck else set()
    last_healthy = bump_last_healthy(prev.get("last_healthy", {}), passed, countries, now)

    if args.dry_run:
        log("parsed %d fronts; countries=%s; healthcheck=%s" % (len(fronts), ",".join(countries), "on" if healthcheck else "off"))
        for cc in countries:
            if cc not in ports:
                log("  %s: no port assigned (not in AFROWS_HEXO_ENTRY_PORTS); skipped" % cc)
            elif cc in fronts_by_cc:
                log("  %s -> %s  [%s]" % (cc, redact_front(fronts_by_cc[cc]), source.get(cc)))
            elif cc in outbounds:
                log("  %s -> (kept last good; absent/unhealthy this shard -> hidden from resolved)" % cc)
            else:
                log("  %s -> UNRESOLVED (no passing front this shard, no last good)" % cc)
        if report is not None:
            log("health probes (exit-country must match the label):")
            for cc in countries:
                if cc not in ports:
                    continue
                entries = [e for e in report if e["cc"] == cc]
                if not entries:
                    log("  %s: not probed (no candidate this shard, or budget reached)" % cc)
                for e in entries:
                    log("  %s: %s exit=%s %s" % (cc, redact_front(e["front"]), e["loc"] or "?",
                                                 "PASS" if e["pass"] else "SKIP(wrong-exit/dead)"))
            would = sorted(cc.lower() for cc in countries
                           if cc in outbounds and last_healthy.get(cc.upper()) is not None
                           and (now - last_healthy[cc.upper()]) <= grace)
            log("would-advertise (resolved, grace=%ds) = %s" % (int(grace), ",".join(would) or "(none)"))
        try:
            cfg = json.load(open(XRAY_CONFIG))
        except Exception as e:
            log("cannot read %s for diff (%s); endpoints above are the plan" % (XRAY_CONFIG, type(e).__name__))
            return 0
        out_objs, in_objs, rules, note, changed = build_desired(cfg, outbounds, ports, countries)
        if note:
            log("note: %s" % note)
        log("would-change=%s" % changed)
        for cc in countries:
            tag = "hexo-%s" % cc.lower()
            obj = next((o for o in out_objs if o.get("tag") == tag), None)
            if obj:
                log("  outbound %s: %s" % (tag, json.dumps(_mask(obj))))
        return 0

    # Persist the fresh resolutions as the new last-good BEFORE applying, so a crash
    # mid-apply still remembers what resolved. Only fresh fronts overwrite last-good; the
    # chosen fronts are kept too so next tick can probe the prev-good front first (stability).
    merged = dict(prev.get("outbounds", {}))
    for cc, obj in outbounds.items():
        merged[cc] = obj
    merged_fronts = dict(prev.get("fronts", {}))
    for cc, f in fronts_by_cc.items():
        merged_fronts[cc] = f
    write_state({"outbounds": merged, "fronts": merged_fronts, "last_healthy": last_healthy,
                 "updatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())})

    try:
        cfg = json.load(open(XRAY_CONFIG))
    except Exception as e:
        log("cannot read %s (%s); nothing applied" % (XRAY_CONFIG, type(e).__name__))
        return 1
    out_objs, in_objs, rules, note, changed = build_desired(cfg, outbounds, ports, countries)
    if note:
        log("note: %s" % note)
    if not changed:
        # Config already matches the live one, so these in/out objs ARE the live listeners:
        # refresh the resolved-countries state (health-filtered + grace) so the backend's
        # freshness window stays green for passers and recently-passing kept-last-good.
        advertised = resolved_countries(in_objs, out_objs, countries, healthy, last_healthy, grace, now)
        write_resolved(advertised)
        log("no change (countries resolved=%d of %d; advertised=%d)" % (
            len(outbounds), len([c for c in countries if c in ports]), len(advertised)))
        return 0
    if apply_config(cfg, out_objs, in_objs, rules):
        # Apply succeeded, so in/out objs are now the live listeners.
        write_resolved(resolved_countries(in_objs, out_objs, countries, healthy, last_healthy, grace, now))
        log("applied: %s" % ", ".join("hexo-%s(%s)" % (cc.lower(), source.get(cc, "kept")) for cc in countries if cc in outbounds))
    return 0


def main(argv=None):
    p = argparse.ArgumentParser(description="Afrows -> Hexogate per-country egress reconciler")
    p.add_argument("--dry-run", action="store_true", help="print the chosen endpoints + config diff; no write/restart")
    p.add_argument("--from-file", metavar="PATH", help="read the subscription from a local file instead of the network")
    return run(p.parse_args(argv))


if __name__ == "__main__":
    sys.exit(main())
