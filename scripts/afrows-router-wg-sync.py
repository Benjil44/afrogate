#!/usr/bin/env python3
"""Afrows wg-routers peer reconciler.

Reconciles the WireGuard peers on the Afrows `wg-routers` management interface from
the DB: every managed MikroTik with an Afrows-generated key (mikrotik_routers.
tunnel_public_key) and a host in 10.22.0.0/24 becomes a peer (allowed-ips host/32).
Peers not in the DB are pruned. Lets `office`-style one-paste onboarding connect
without a manual peer step. Idempotent; run by timer + triggered by the backend.
No secrets in this file.
"""
import subprocess
import os

ENV = os.environ.get("AFROWS_ENV", "/etc/afrows/afrows.env")
IFACE = "wg-routers"


def file_env(key):
    try:
        with open(ENV) as f:
            for line in f:
                if line.startswith(key + "="):
                    return line.split("=", 1)[1].strip().strip('"').strip("\r")
    except Exception:
        pass
    return os.environ.get(key, "")


def db_rows():
    url = file_env("DATABASE_URL")
    if not url:
        return []
    out = subprocess.run(
        ["psql", url, "-tAF", "\t", "-c",
         "select tunnel_public_key, host from mikrotik_routers "
         "where tunnel_public_key is not null and tunnel_public_key <> '' "
         "and host like '10.22.0.%'"],
        capture_output=True, text=True, timeout=20,
    )
    rows = {}
    if out.returncode == 0:
        for line in out.stdout.strip().splitlines():
            parts = line.split("\t")
            if len(parts) >= 2 and parts[0]:
                rows[parts[0]] = parts[1]
    return rows


def current_peers():
    out = subprocess.run(["wg", "show", IFACE, "allowed-ips"], capture_output=True, text=True)
    peers = {}
    for line in (out.stdout or "").strip().splitlines():
        p = line.split("\t")
        if len(p) >= 2:
            peers[p[0]] = p[1]
    return peers


def main():
    desired = db_rows()
    current = current_peers()
    for pub, ip in desired.items():
        subprocess.run(["wg", "set", IFACE, "peer", pub, "allowed-ips", ip + "/32"], timeout=15)
    for pub in current:
        if pub not in desired:
            subprocess.run(["wg", "set", IFACE, "peer", pub, "remove"], timeout=15)
    print("[router-wg-sync] %d peer(s) on %s" % (len(desired), IFACE), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
