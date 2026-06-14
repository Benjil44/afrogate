#!/usr/bin/env python3
"""Add (or replace) the afrows-in-tcp inbound on the afrows-xray instance.

Mirrors the bought egress (r-juuh4sm3) structure on the INBOUND side so the
phone -> afrows hop disguises itself as plaintext HTTP to a whitelisted Iranian
domain (fake Host header), which survives Iran DPI.

    vless + tcp + header.type=http + Host: <fakehost> + security=none

No secrets are stored in this file: uuid/email/port/fakehost are passed as args.

Usage:
    afrows-add-tcp-inbound.py <port> <fakehost> <uuid> <email>
"""
import json, sys, os, time, shutil

CONF = "/usr/local/etc/afrows-xray/config.json"
TAG = "afrows-in-tcp"

if len(sys.argv) != 5:
    print("usage: afrows-add-tcp-inbound.py <port> <fakehost> <uuid> <email>")
    sys.exit(2)

port = int(sys.argv[1])
fakehost = sys.argv[2]
uuid = sys.argv[3]
email = sys.argv[4]

c = json.load(open(CONF))

bak = CONF + ".bak-" + str(int(time.time()))
shutil.copy(CONF, bak)

# Idempotent: drop any prior copy of this inbound + its routing rule.
c["inbounds"] = [ib for ib in c.get("inbounds", []) if ib.get("tag") != TAG]

inbound = {
    "tag": TAG,
    "listen": "0.0.0.0",
    "port": port,
    "protocol": "vless",
    "settings": {
        "decryption": "none",
        "clients": [{"id": uuid, "email": email, "level": 0}],
    },
    "streamSettings": {
        "network": "tcp",
        "security": "none",
        "tcpSettings": {
            "header": {
                "type": "http",
                "request": {
                    "version": "1.1",
                    "method": "GET",
                    "path": ["/"],
                    "headers": {
                        "Host": [fakehost],
                        "User-Agent": [
                            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                            "AppleWebKit/537.36 (KHTML, like Gecko) "
                            "Chrome/124.0 Safari/537.36"
                        ],
                        "Accept-Encoding": ["gzip, deflate"],
                        "Connection": ["keep-alive"],
                        "Pragma": "no-cache",
                    },
                },
                "response": {
                    "version": "1.1",
                    "status": "200",
                    "reason": "OK",
                    "headers": {
                        "Content-Type": ["text/html; charset=utf-8"],
                        "Connection": ["keep-alive"],
                        "Pragma": "no-cache",
                    },
                },
            }
        },
    },
}
c["inbounds"].append(inbound)

routing = c.setdefault("routing", {})
rules = routing.setdefault("rules", [])
rules = [r for r in rules if TAG not in (r.get("inboundTag") or [])]
rules.append({"type": "field", "inboundTag": [TAG], "outboundTag": "proxy"})
routing["rules"] = rules

# Turn on access/error logging so connections are visible per-section.
os.makedirs("/var/log/afrows-xray", exist_ok=True)
c["log"] = {
    "loglevel": "info",
    "access": "/var/log/afrows-xray/access.log",
    "error": "/var/log/afrows-xray/error.log",
}

json.dump(c, open(CONF, "w"), indent=2)
print("OK backup=%s port=%s host=%s user=%s" % (bak, port, fakehost, uuid))
