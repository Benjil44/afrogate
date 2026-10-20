#!/usr/bin/env python3
"""Add a direct VLESS+REALITY entry for the Afrows chain user to an exit's xray.

Runs ON an exit box (Germany afrows-xray-de, USA xray) as root. Copies only the
`afrows-chain@afrows` client from an existing inbound (SRC_TAG) into a new inbound
NEW_TAG on PORT, so the Afrows server can reach the exit without Cloudflare
(زیرساخت مشهد throttles CF; direct foreign TCP is fast).

Live-safe: the inbound is added through the xray API (`api adi`), never by a
restart (exits hold runtime-only customers added with `api adu`). The same inbound
is then written to the config file (backup first, `xray run -test` gate) so it
survives the next restart. Idempotent: an existing NEW_TAG is left untouched.

Usage: afrows-chain-reality-add.py CONFIG API SRC_TAG NEW_TAG PORT SNI
Prints one JSON line {"pbk","sid","sni","port"} (public values only).
"""
import json, os, secrets, shutil, subprocess, sys, tempfile, time

XRAY = "/usr/local/bin/xray"
CHAIN_EMAIL = "afrows-chain@afrows"

cfg_path, api, src_tag, new_tag, port, sni = sys.argv[1:7]
port = int(port)
cfg = json.load(open(cfg_path))
inbounds = cfg["inbounds"]

existing = next((i for i in inbounds if i.get("tag") == new_tag), None)
if existing:
    rs = existing["streamSettings"]["realitySettings"]
    pbk = open(cfg_path + "." + new_tag + ".pbk").read().strip()
    print(json.dumps({"pbk": pbk, "sid": rs["shortIds"][0], "sni": rs["serverNames"][0],
                      "port": existing["port"], "status": "exists"}))
    sys.exit(0)

src = next(i for i in inbounds if i.get("tag") == src_tag)
chain = [c for c in src["settings"]["clients"] if c.get("email") == CHAIN_EMAIL]
if len(chain) != 1:
    sys.exit("chain user %s not found exactly once in %s" % (CHAIN_EMAIL, src_tag))

out = subprocess.run([XRAY, "x25519"], capture_output=True, text=True, check=True).stdout
keys = dict(l.split(":", 1) for l in out.splitlines() if ":" in l)
priv = keys["PrivateKey"].strip()
pbk = next(v.strip() for k, v in keys.items() if k.startswith("Password") or k.startswith("Public"))
sid = secrets.token_hex(8)

inbound = {
    "tag": new_tag, "listen": "0.0.0.0", "port": port, "protocol": "vless",
    "settings": {"clients": [{"id": chain[0]["id"], "email": CHAIN_EMAIL, "level": chain[0].get("level", 0)}],
                 "decryption": "none"},
    "streamSettings": {"network": "tcp", "security": "reality",
                       "realitySettings": {"show": False, "dest": sni + ":443", "xver": 0,
                                           "serverNames": [sni], "privateKey": priv,
                                           "shortIds": [sid]}},
    "sniffing": src.get("sniffing", {"enabled": True, "destOverride": ["http", "tls"], "routeOnly": True}),
}

# 1) live, no restart
with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
    json.dump({"inbounds": [inbound]}, f)
    tmp = f.name
os.chmod(tmp, 0o600)
try:
    subprocess.run([XRAY, "api", "adi", "--server=" + api, tmp], check=True, capture_output=True, text=True)
finally:
    os.unlink(tmp)

# 2) persist (backup + test gate)
new_cfg = json.loads(json.dumps(cfg))
new_cfg["inbounds"].append(inbound)
rules = new_cfg.get("routing", {}).get("rules", [])
src_rule = next((r for r in rules if r.get("inboundTag") == [src_tag]), None)
if src_rule:
    rules.insert(rules.index(src_rule) + 1, dict(src_rule, inboundTag=[new_tag]))
bak = "%s.bak-reality-%s" % (cfg_path, time.strftime("%Y%m%d-%H%M%S"))
shutil.copy2(cfg_path, bak)
staged = cfg_path + ".staged.json"  # xray picks the config format from the extension
with open(staged, "w") as f:
    json.dump(new_cfg, f, indent=2)
shutil.copymode(cfg_path, staged)
st = os.stat(cfg_path)
os.chown(staged, st.st_uid, st.st_gid)
try:
    subprocess.run([XRAY, "run", "-test", "-config", staged], check=True, capture_output=True, text=True)
except subprocess.CalledProcessError as e:
    # config file untouched; take the live inbound back out so a rerun starts clean
    os.unlink(staged)
    subprocess.run([XRAY, "api", "rmi", "--server=" + api, new_tag], capture_output=True)
    sys.exit("xray -test failed, live inbound removed:\n" + e.stdout + e.stderr)
os.replace(staged, cfg_path)
with open(cfg_path + "." + new_tag + ".pbk", "w") as f:
    f.write(pbk + "\n")
print(json.dumps({"pbk": pbk, "sid": sid, "sni": sni, "port": port, "status": "added", "backup": bak}))
