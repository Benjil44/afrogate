#!/usr/bin/env python3
"""Afrows Germany usage recorder (durable, local, no network).

Runs ON the Germany box next to afrows-xray-de. Xray's per-user traffic stats are
in-memory and reset when xray restarts, so this recorder makes Germany-path usage
DURABLE: every tick it reads-and-resets xray's counters and adds the delta into a
persisted per-user CUMULATIVE total on disk.

Because Germany cannot reach Ireland (the datacenter filters it), Ireland can only
PULL. So this recorder never talks to Ireland — it just maintains the buffer, and
the Ireland backend reads it over SSH (the village route) whenever the link is up.
During a village blackout the buffer keeps accumulating; when Ireland reconnects it
reads the full accumulated total and computes its own delta (no loss, no double
count). The buffer surviving xray restarts is the whole point of this process.

Buffer format /var/lib/afrows/de-usage.json:
  { "updated_at": "<iso>", "users": { "cc_<clientConfigId>@afrows": {"bytes": <int>} } }

Env (optional): AFROWS_DE_XRAY_API (127.0.0.1:10085), AFROWS_DE_XRAY_BIN
(/usr/local/bin/xray), AFROWS_DE_RECORD_INTERVAL (30), AFROWS_DE_USAGE_FILE.
stdlib only; no secrets.
"""
import json
import os
import re
import subprocess
import time
from datetime import datetime, timezone

EMAIL_RE = re.compile(r"^cc_[0-9a-fA-F-]{36}@afrows$")
API = os.environ.get("AFROWS_DE_XRAY_API", "127.0.0.1:10085")
BIN = os.environ.get("AFROWS_DE_XRAY_BIN", "/usr/local/bin/xray")
INTERVAL = int(os.environ.get("AFROWS_DE_RECORD_INTERVAL", "30"))
USAGE_FILE = os.environ.get("AFROWS_DE_USAGE_FILE", "/var/lib/afrows/de-usage.json")


def read_and_reset_deltas():
    """`xray api statsquery -reset` -> {email: delta_bytes} (uplink+downlink). The -reset
    is atomic per query, so each call returns exactly the bytes since the previous call."""
    p = subprocess.run(
        [BIN, "api", "statsquery", "--server=" + API, "-pattern", "user>>>", "-reset"],
        capture_output=True, text=True, timeout=20,
    )
    if p.returncode != 0:
        return None  # xray down this tick; DON'T advance (nothing was reset)
    try:
        stats = json.loads(p.stdout or "{}").get("stat") or []
    except json.JSONDecodeError:
        return None
    out = {}
    for s in stats:
        parts = s.get("name", "").split(">>>")
        if len(parts) < 4 or parts[0] != "user":
            continue
        email = parts[1]
        if not EMAIL_RE.match(email):
            continue
        try:
            val = int(s.get("value", 0))
        except (TypeError, ValueError):
            continue
        out[email] = out.get(email, 0) + max(0, val)
    return out


def load_buffer():
    try:
        with open(USAGE_FILE) as fh:
            data = json.load(fh)
            if isinstance(data, dict) and isinstance(data.get("users"), dict):
                return data
    except (FileNotFoundError, json.JSONDecodeError):
        pass
    return {"updated_at": None, "users": {}}


def save_buffer(buf):
    os.makedirs(os.path.dirname(USAGE_FILE), exist_ok=True)
    tmp = USAGE_FILE + ".tmp"
    with open(tmp, "w") as fh:
        json.dump(buf, fh)
    os.replace(tmp, USAGE_FILE)


def tick():
    deltas = read_and_reset_deltas()
    if not deltas:
        return  # xray down or nothing new; buffer untouched
    buf = load_buffer()
    users = buf["users"]
    for email, d in deltas.items():
        if d <= 0:
            continue
        entry = users.setdefault(email, {"bytes": 0})
        entry["bytes"] = int(entry.get("bytes", 0)) + d
    buf["updated_at"] = datetime.now(timezone.utc).isoformat()
    save_buffer(buf)


def main():
    print("[recorder] started; api=%s interval=%ss file=%s" % (API, INTERVAL, USAGE_FILE), flush=True)
    while True:
        try:
            tick()
        except Exception as e:  # noqa: BLE001 — never let one tick kill the loop
            print("[recorder] tick error: %s" % e, flush=True)
        time.sleep(INTERVAL)


if __name__ == "__main__":
    main()
