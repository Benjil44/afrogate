#!/usr/bin/env python3
"""Afrows Germany edge agent.

Runs ON the Germany box (where the Afrows xray API is local) and talks to the
Ireland backend over Cloudflare (Germany->Ireland direct is filtered; Germany->
Cloudflare->Ireland works, and keeps working during a village blackout).

Every tick it:
  1. PULLS the active client list from Ireland (`GET /api/edge/de/clients`) and
     reconciles the local WS inbound — `xray api adu` new users, `xray api rmu`
     departed ones — and mirrors the change into config.json so it survives an
     xray restart. Live (no restart needed).
  2. METERS: `xray api statsquery ... -reset` on the LOCAL xray, sums each
     `cc_<id>@afrows` user's up+down delta, and PUSHES the deltas to Ireland
     (`POST /api/edge/de/usage`) so volume billing counts the Germany path.

Config comes from /etc/afrows/afrows-de-agent.env (KEY=VALUE):
  AFROWS_EDGE_URL      e.g. https://edge.afrows.com   (Cloudflare-fronted Ireland)
  AFROWS_EDGE_TOKEN    shared bearer token (same value set on Ireland)
  AFROWS_DE_XRAY_API   default 127.0.0.1:10085
  AFROWS_DE_WS_TAG     default afrows-de-ws
  AFROWS_DE_WS_PORT    default 8090
  AFROWS_DE_CONFIG     default /usr/local/etc/afrows-xray-de/config.json
  AFROWS_DE_XRAY_BIN   default /usr/local/bin/xray
  AFROWS_DE_INTERVAL   seconds between ticks, default 60

No third-party deps (stdlib urllib/json/subprocess only). Secrets are never printed.
"""
import json
import os
import re
import ssl
import subprocess
import sys
import time
import urllib.request
import urllib.error

UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.I)
EMAIL_RE = re.compile(r"^cc_(?P<id>[0-9a-fA-F-]{36})@afrows$")
MAX_DELTA = 1_000_000_000_000  # 1 TB per tick per user — clamp runaway counters


def load_env(path):
    env = {}
    try:
        with open(path) as fh:
            for line in fh:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip()
    except FileNotFoundError:
        pass
    # environment overrides the file
    for k in ("AFROWS_EDGE_URL", "AFROWS_EDGE_TOKEN", "AFROWS_DE_XRAY_API", "AFROWS_DE_WS_TAG",
              "AFROWS_DE_WS_PORT", "AFROWS_DE_CONFIG", "AFROWS_DE_XRAY_BIN", "AFROWS_DE_INTERVAL"):
        if os.environ.get(k):
            env[k] = os.environ[k]
    return env


class Agent:
    def __init__(self, env):
        self.base = env["AFROWS_EDGE_URL"].rstrip("/")
        self.token = env["AFROWS_EDGE_TOKEN"]
        self.api = env.get("AFROWS_DE_XRAY_API", "127.0.0.1:10085")
        self.tag = env.get("AFROWS_DE_WS_TAG", "afrows-de-ws")
        self.port = int(env.get("AFROWS_DE_WS_PORT", "8090"))
        self.cfg_path = env.get("AFROWS_DE_CONFIG", "/usr/local/etc/afrows-xray-de/config.json")
        self.bin = env.get("AFROWS_DE_XRAY_BIN", "/usr/local/bin/xray")

    # ---- HTTP (over Cloudflare) ----
    def _req(self, path, method="GET", body=None):
        url = self.base + path
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(url, data=data, method=method)
        req.add_header("Authorization", "Bearer " + self.token)
        req.add_header("Content-Type", "application/json")
        ctx = ssl.create_default_context()
        with urllib.request.urlopen(req, timeout=25, context=ctx) as resp:
            raw = resp.read().decode() or "{}"
            return json.loads(raw)

    # ---- xray CLI ----
    def _xray(self, args):
        return subprocess.run([self.bin] + args, capture_output=True, text=True, timeout=20)

    def adu(self, uuid, email):
        cfg = {"inbounds": [{"tag": self.tag, "port": self.port, "protocol": "vless",
                             "settings": {"decryption": "none",
                                          "clients": [{"id": uuid, "email": email, "level": 0}]}}]}
        p = subprocess.run([self.bin, "api", "adu", "--server=" + self.api, "-"],
                           input=json.dumps(cfg), capture_output=True, text=True, timeout=20)
        return p.returncode == 0

    def rmu(self, email):
        p = self._xray(["api", "rmu", "--server=" + self.api, "-tag=" + self.tag, email])
        return p.returncode == 0

    # ---- config.json mirror (persistence across restart) ----
    def _load_cfg(self):
        with open(self.cfg_path) as fh:
            return json.load(fh)

    def _ws_inbound(self, cfg):
        for inb in cfg.get("inbounds", []):
            if inb.get("tag") == self.tag:
                return inb
        return None

    def _write_cfg(self, cfg):
        tmp = self.cfg_path + ".agent.tmp"
        with open(tmp, "w") as fh:
            json.dump(cfg, fh, indent=2)
        os.replace(tmp, self.cfg_path)
        os.chmod(self.cfg_path, 0o600)

    # ---- provisioning reconcile ----
    def reconcile_clients(self):
        remote = self._req("/api/edge/de/clients").get("clients", [])
        desired = {}
        for c in remote:
            uuid = (c.get("entryUuid") or "").strip()
            email = (c.get("email") or "").strip()
            if UUID_RE.match(uuid) and email:
                desired[email] = uuid
        cfg = self._load_cfg()
        inb = self._ws_inbound(cfg)
        if inb is None:
            print("[agent] WS inbound %s not found in config" % self.tag, flush=True)
            return
        clients = inb["settings"].get("clients", [])
        current = {c.get("email"): c.get("id") for c in clients if c.get("email")}
        add = [(e, u) for e, u in desired.items() if current.get(e) != u]
        remove = [e for e in current if e not in desired]
        if not add and not remove:
            return
        for email, uuid in add:
            self.rmu(email)  # drop any stale uuid for this email first (idempotent)
            self.adu(uuid, email)
        for email in remove:
            self.rmu(email)
        # mirror into config.json so a restart keeps the same set
        inb["settings"]["clients"] = [{"id": u, "email": e, "level": 0} for e, u in sorted(desired.items())]
        self._write_cfg(cfg)
        print("[agent] provision: +%d -%d (now %d)" % (len(add), len(remove), len(desired)), flush=True)

    # ---- metering ----
    # We DON'T use `-reset`: xray counters are cumulative and we keep a per-user baseline in
    # a state file. delta = current - baseline. Baseline advances ONLY after a successful push,
    # so if Ireland is briefly unreachable (e.g. during a deploy) NO usage is lost — it's just
    # retried next tick. A counter going backwards (xray restarted) is treated as delta=current.
    STATE = "/var/lib/afrows/de-agent-usage.json"

    def _load_state(self):
        try:
            with open(self.STATE) as fh:
                return json.load(fh)
        except (FileNotFoundError, json.JSONDecodeError):
            return {}

    def _save_state(self, state):
        os.makedirs(os.path.dirname(self.STATE), exist_ok=True)
        tmp = self.STATE + ".tmp"
        with open(tmp, "w") as fh:
            json.dump(state, fh)
        os.replace(tmp, self.STATE)

    def meter(self):
        p = self._xray(["api", "statsquery", "--server=" + self.api, "-pattern", "user>>>"])
        if p.returncode != 0:
            return
        try:
            stats = json.loads(p.stdout or "{}").get("stat") or []
        except json.JSONDecodeError:
            return
        cumulative = {}
        for s in stats:
            parts = s.get("name", "").split(">>>")
            if len(parts) < 4 or parts[0] != "user":
                continue
            m = EMAIL_RE.match(parts[1])
            if not m:
                continue
            try:
                val = int(s.get("value", 0))
            except (TypeError, ValueError):
                continue
            cumulative[m.group("id")] = cumulative.get(m.group("id"), 0) + max(0, val)
        baseline = self._load_state()
        deltas = []
        for cid, cur in cumulative.items():
            prev = baseline.get(cid, 0)
            d = cur if cur < prev else cur - prev  # reset-safe
            if d > 0:
                deltas.append({"clientConfigId": cid, "bytes": min(d, MAX_DELTA)})
        if not deltas:
            return
        try:
            res = self._req("/api/edge/de/usage", method="POST", body={"deltas": deltas})
        except urllib.error.URLError as e:
            print("[agent] usage push failed (will retry, no loss): %s" % e, flush=True)
            return  # do NOT advance baseline -> retried next tick
        # push succeeded -> advance baseline to the cumulative we just reported
        self._save_state(cumulative)
        print("[agent] usage pushed: %d rows, %d applied" % (len(deltas), res.get("applied", 0)), flush=True)

    def tick(self):
        try:
            self.reconcile_clients()
        except Exception as e:  # noqa: BLE001 — never let one tick kill the loop
            print("[agent] reconcile error: %s" % e, flush=True)
        try:
            self.meter()
        except Exception as e:  # noqa: BLE001
            print("[agent] meter error: %s" % e, flush=True)


def main():
    env = load_env("/etc/afrows/afrows-de-agent.env")
    if not env.get("AFROWS_EDGE_URL") or not env.get("AFROWS_EDGE_TOKEN"):
        print("[agent] AFROWS_EDGE_URL / AFROWS_EDGE_TOKEN not set — agent idle", flush=True)
        sys.exit(0)
    agent = Agent(env)
    interval = int(env.get("AFROWS_DE_INTERVAL", "60"))
    print("[agent] started; edge=%s interval=%ss" % (agent.base, interval), flush=True)
    while True:
        agent.tick()
        time.sleep(interval)


if __name__ == "__main__":
    main()
