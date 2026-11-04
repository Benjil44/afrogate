#!/usr/bin/env python3
"""Add the customer-facing DIRECT USA inbounds (no Cloudflare), idempotently.

Mobile ISPs (MCI, 2026-11-04) throttle Cloudflare after the handshake, so the
"USA AI Support 2x" WS link pings but loads nothing. These inbounds let customers
reach the USA box directly, Hexogate-style, with three independent transports:

  afrows-us-dr  :8450  VLESS + REALITY (tcp, no flow), SNI www.speedtest.net;
                       public :443 is redirected here by afrows-us-direct-fw.
  afrows-us-dx  :8080  VLESS + XHTTP packet-up + VLESS Encryption, no TLS: the recipe that
                       fixed upload on the Iran->USA chain (DPI cuts each long upload flow;
                       one POST per connection never gets that far). The first version
                       (XHTTP over REALITY) failed on MCI, Irancell and Shatel (2026-11-04).
  afrows-us-dh  :2095  VLESS + tcp headerType=http (decoy Host) + VLESS Encryption
                       (mlkem768x25519plus, X25519 auth), no TLS.

Customers are the same cc_<uuid>@afrows users as afrows-us-ws (copied here and kept
in sync by afrows-us-mgmt-cmd), so usage is metered per user and billed 2x as before.

The REALITY private key is reused from afrows-us-rv; the VLESS Encryption keypair is
generated once and its server half stays in config.json. Prints only PUBLIC link
parameters (as AFROWS_US_DIRECT_* env lines) on stdout. Run as root on the USA box:
  python3 -I afrows-us-direct.py [--config /usr/local/etc/xray/config.json]
"""
import json
import os
import re
import subprocess
import sys

XR = "/usr/local/bin/xray"
CFG = sys.argv[sys.argv.index("--config") + 1] if "--config" in sys.argv else "/usr/local/etc/xray/config.json"
SOURCE_TAG = "afrows-us-ws"
KEY_TAG = "afrows-us-rv"
SID = "a3f19c0e5d7b2468"
XHTTP_PATH = "/a7d2c94e1b"
HTTP_HOST = "download.windowsupdate.com"
HTTP_PATH = "/msdownload/update/v3/static/trustedr/en/authrootstl.cab"


def run(*args: str) -> str:
    return subprocess.run(args, check=True, capture_output=True, text=True).stdout


def vless_encryption_pair() -> tuple[str, str]:
    """(decryption, encryption) for the X25519-authenticated mlkem768x25519plus pair."""
    out = run(XR, "vlessenc").split("Authentication: X25519", 1)[1].split("Authentication:", 1)[0]
    dec = re.search(r'"decryption": "([^"]+)"', out).group(1)
    enc = re.search(r'"encryption": "([^"]+)"', out).group(1)
    return dec, enc


def reality(dest: str, private_key: str) -> dict:
    return {"show": False, "dest": f"{dest}:443", "xver": 0, "serverNames": [dest], "privateKey": private_key, "shortIds": [SID]}


def main() -> None:
    with open(CFG) as fh:
        cfg = json.load(fh)
    inbounds = cfg["inbounds"]
    by_tag = {i.get("tag"): i for i in inbounds}
    customers = [
        {"id": c["id"], "email": c["email"], "level": 0}
        for c in by_tag[SOURCE_TAG]["settings"]["clients"]
        if re.match(r"^cc_[0-9a-fA-F-]{36}@afrows$", str(c.get("email", "")))
    ]
    private_key = by_tag[KEY_TAG]["streamSettings"]["realitySettings"]["privateKey"]
    sniff = {"enabled": True, "destOverride": ["http", "tls", "quic"], "routeOnly": True}

    existing_dh = by_tag.get("afrows-us-dh")
    if existing_dh:
        decryption = existing_dh["settings"]["decryption"]
        encryption = open("/etc/afrows/us-direct-encryption").read().strip()
    else:
        decryption, encryption = vless_encryption_pair()
        os.makedirs("/etc/afrows", exist_ok=True)
        with open(os.open("/etc/afrows/us-direct-encryption", os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600), "w") as fh:
            fh.write(encryption + "\n")

    wanted = [
        {
            "tag": "afrows-us-dr", "listen": "0.0.0.0", "port": 8450, "protocol": "vless",
            "settings": {"clients": customers, "decryption": "none"},
            "streamSettings": {"network": "tcp", "security": "reality", "realitySettings": reality("www.speedtest.net", private_key)},
            "sniffing": sniff,
        },
        {
            "tag": "afrows-us-dx", "listen": "0.0.0.0", "port": 8080, "protocol": "vless",
            "settings": {"clients": customers, "decryption": decryption},
            "streamSettings": {
                "network": "xhttp", "security": "none",
                "xhttpSettings": {"host": HTTP_HOST, "path": XHTTP_PATH, "mode": "packet-up", "extra": {"scMaxBufferedPosts": 200}},
                "sockopt": {"tcpcongestion": "bbr"},
            },
            "sniffing": sniff,
        },
        {
            "tag": "afrows-us-dh", "listen": "0.0.0.0", "port": 2095, "protocol": "vless",
            "settings": {"clients": customers, "decryption": decryption},
            "streamSettings": {
                "network": "tcp", "security": "none",
                "tcpSettings": {"header": {"type": "http", "request": {"path": [HTTP_PATH], "headers": {"Host": [HTTP_HOST]}}}},
            },
            "sniffing": sniff,
        },
    ]
    for inbound in wanted:
        old = by_tag.get(inbound["tag"])
        if old:
            inbounds[inbounds.index(old)] = inbound
        else:
            inbounds.append(inbound)

    tmp = CFG + ".direct.new"
    with open(tmp, "w") as fh:
        json.dump(cfg, fh, indent=2)
    st = os.stat(CFG)
    os.chmod(tmp, st.st_mode & 0o777)
    os.chown(tmp, st.st_uid, st.st_gid)
    if subprocess.run([XR, "run", "-test", "-format", "json", "-config", tmp], capture_output=True).returncode != 0:
        os.remove(tmp)
        sys.exit("xray -test rejected the new config; nothing changed")
    os.replace(tmp, CFG)

    public_key = re.search(r"(?:Public key|Password|PublicKey)[^:]*:\s*(\S+)", run(XR, "x25519", "-i", private_key)).group(1)
    print("AFROWS_US_DIRECT_ENABLED=true")
    print("AFROWS_US_DIRECT_PBK=" + public_key)
    print("AFROWS_US_DIRECT_SID=" + SID)
    print("AFROWS_US_DIRECT_REALITY_PORT=443")
    print("AFROWS_US_DIRECT_REALITY_SNI=www.speedtest.net")
    print("AFROWS_US_DIRECT_XHTTP_PORT=8080")
    print("AFROWS_US_DIRECT_XHTTP_PATH=" + XHTTP_PATH)
    print("AFROWS_US_DIRECT_HTTP_PORT=2095")
    print("AFROWS_US_DIRECT_HTTP_HOST=" + HTTP_HOST)
    print("AFROWS_US_DIRECT_HTTP_PATH=" + HTTP_PATH)
    print("AFROWS_US_DIRECT_HTTP_ENCRYPTION=" + encryption)
    print(f"# {len(customers)} customers copied", file=sys.stderr)


if __name__ == "__main__":
    main()
