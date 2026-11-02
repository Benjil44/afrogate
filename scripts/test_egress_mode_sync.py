"""Regression test: desired_rules must be order-insensitive so that a different
DB row order (string_agg without ORDER BY) does NOT look like a config change and
trigger a spurious xray/wg restart (the "internet freezes every ~1-2 min" bug)."""
import importlib.util
from pathlib import Path

spec = importlib.util.spec_from_file_location(
    "egress_mode_sync", str(Path(__file__).with_name("afrows-egress-mode-sync.py"))
)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

# Same sets of gaming users/sources/tags, two different orderings (as Postgres
# string_agg without ORDER BY can return run-to-run).
a = mod.desired_rules("smart", ["t2", "t1"], ["10.0.0.2", "10.0.0.1"], ["b@afrows", "a@afrows"], "via-germany")
b = mod.desired_rules("smart", ["t1", "t2"], ["10.0.0.1", "10.0.0.2"], ["a@afrows", "b@afrows"], "via-germany")

assert a == b, f"desired_rules is order-sensitive -> spurious restarts:\n{a}\n!=\n{b}"
print("OK: desired_rules is order-insensitive")

# --- health-ordered failover (choose_catchall) ---
ch = mod.choose_catchall

# Primary healthy -> via-germany immediately.
applied, st = ch(True, False, {})
assert applied == "via-germany", applied

# Village/Germany down + pool up: 2-strike hysteresis (stay 1 cycle, then switch).
applied, st = ch(False, True, {"applied": "via-germany"})
assert applied == "via-germany", ("no flip on 1st strike", applied)
applied, st = ch(False, True, st)
assert applied == "proxy", ("failover to pool on 2nd strike", applied)

# Both down -> direct (last resort), again after hysteresis from proxy.
applied, st = ch(False, False, {"applied": "proxy"})
assert applied == "proxy", applied
applied, st = ch(False, False, st)
assert applied == "direct", ("last resort direct", applied)

# Recovery: village back -> fail back to via-germany, but SLOWLY (asymmetric
# hysteresis, k_back=3). Fail-out was 2 strikes; fail-back is deliberately stickier.
applied, st = ch(True, False, {"applied": "proxy"})
assert applied == "proxy", applied
applied, st = ch(True, False, st)
assert applied == "proxy", ("still holding on 2nd strike (slow fail-back)", applied)
applied, st = ch(True, False, st)
assert applied == "via-germany", ("failback on 3rd strike", applied)

print("OK: choose_catchall failover via-germany -> proxy -> direct with hysteresis")

# --- D2: fixed-path per-account rules ---
fixed = [
    {"user": ["cc_b@afrows", "cc_a@afrows"], "outboundTag": "via-germany"},
    {"source": ["10.0.0.2", "10.0.0.1"], "outboundTag": "direct"},
]
r = mod.desired_rules("smart", ["t1"], [], [], "proxy", fixed)
assert {"type": "field", "user": ["cc_a@afrows", "cc_b@afrows"], "outboundTag": "via-germany"} in r
assert {"type": "field", "source": ["10.0.0.1", "10.0.0.2"], "outboundTag": "direct"} in r
assert r[-1]["outboundTag"] == "proxy" and r[-1].get("inboundTag"), "catch-all must stay last"
r2 = mod.desired_rules("smart", ["t1"], [], [], "proxy", list(reversed(fixed)))
assert sorted([str(x) for x in r]) == sorted([str(x) for x in r2]), "fixed rules must be order-insensitive"
# back-compat: omitting fixed_rules behaves as before
assert mod.desired_rules("smart", ["t1"], [], [], "proxy") == mod.desired_rules("smart", ["t1"], [], [], "proxy", [])
print("OK: desired_rules fixed-path rules (D2)")

# --- gaming-tier failover (choose_gaming): Starlink -> Germany -> proxy reserve -> back ---
cg = mod.choose_gaming

# Starlink (village) up -> gaming stays on via-village (pool state irrelevant).
applied, st = cg(True, True, False, {})
assert applied == "via-village", applied

# Starlink down + Germany up: 2-strike hysteresis before flipping to via-germany.
applied, st = cg(False, True, False, {"applied": "via-village"})
assert applied == "via-village", ("no flip on 1st strike", applied)
applied, st = cg(False, True, False, st)
assert applied == "via-germany", ("failover to Germany on 2nd strike", applied)

# Recovery: Starlink back -> fail back to via-village, SLOWLY (asymmetric, k_back=3).
applied, st = cg(True, True, False, {"applied": "via-germany"})
assert applied == "via-germany", applied
applied, st = cg(True, True, False, st)
assert applied == "via-germany", ("still holding on 2nd strike (slow fail-back)", applied)
applied, st = cg(True, True, False, st)
assert applied == "via-village", ("failback to Starlink on 3rd strike", applied)

# Both village paths down but the relay pool is up -> gaming fails over to the
# village-INDEPENDENT proxy reserve (the operator's added exits), 2-strike hysteresis,
# instead of stranding gaming users on a dead tunnel.
applied, st = cg(False, False, True, {"applied": "via-germany"})
assert applied == "via-germany", ("no flip on 1st strike", applied)
applied, st = cg(False, False, True, st)
assert applied == "proxy", ("failover to proxy reserve on 2nd strike", applied)

# Everything down (no pool either) -> stay on via-village (recovers with the village).
applied, st = cg(False, False, False, {"applied": "via-village"})
assert applied == "via-village", applied

print("OK: choose_gaming failover via-village -> via-germany -> proxy reserve with hysteresis")

# gaming rules honor the resolved gaming_outbound (so a Starlink outage routes
# gaming users to Germany instead of a dead Starlink tunnel).
rg = mod.desired_rules("smart", ["t1"], ["10.0.0.5"], ["g@afrows"], "via-germany",
                       None, "via-germany")
assert {"type": "field", "source": ["10.0.0.5"], "outboundTag": "via-germany"} in rg
assert {"type": "field", "user": ["g@afrows"], "outboundTag": "via-germany"} in rg
# default stays via-village (back-compat)
rv = mod.desired_rules("smart", ["t1"], ["10.0.0.5"], [], "via-germany")
assert {"type": "field", "source": ["10.0.0.5"], "outboundTag": "via-village"} in rv
print("OK: desired_rules gaming_outbound failover")

# --- P4 Part B: opt-in MikroTik-direct bypass (flag-gated) ---
# When active, main() injects a bypass rule (source/user -> AFROWS_BYPASS_OUTBOUND) via the
# fixed-rule path, so it is emitted BEFORE the catch-all and overrides the dead-VLESS
# catch-all. When the master flag is off, main() passes no bypass rule at all. Verify the
# rule shape + precedence via desired_rules (the activation condition is a trivial boolean
# in main(): AFROWS_BYPASS_ENABLED and catch == 'direct').
rb = mod.desired_rules("smart", ["client"], [], [], "direct", [{"source": ["10.9.0.5"], "outboundTag": "direct"}])
assert {"type": "field", "source": ["10.9.0.5"], "outboundTag": "direct"} in rb, "bypass rule present when active"
assert rb[-1].get("inboundTag") and rb[-1]["outboundTag"] == "direct", "catch-all stays last (bypass overrides it earlier)"
rb0 = mod.desired_rules("smart", ["client"], [], [], "direct", [])
assert not any(rule.get("source") == ["10.9.0.5"] for rule in rb0), "no bypass rule when flag off"
# the bypass query functions exist and are callable (shape only; no DB here)
assert callable(mod.bypass_ips) and callable(mod.bypass_xray_emails), "bypass collectors present"
print("OK: P4 Part B bypass rule shape + off-by-default")

# P4 Part B — HIGH fix: an unknown bypass/D2 outbound is DROPPED (xray -test won't catch it).
kept, dropped = mod.partition_known_outbound_rules(
    [{"source": ["1.1.1.1"], "outboundTag": "mikrotik-direct"},   # unknown -> dropped
     {"source": ["2.2.2.2"], "outboundTag": "via-germany"}],       # known -> kept
    {"via-germany", "via-village", "proxy", "direct"})
assert dropped and dropped[0]["outboundTag"] == "mikrotik-direct", "unknown tag dropped"
assert kept and kept[0]["outboundTag"] == "via-germany", "known tag kept"
# P4 Part B — MEDIUM fix: bypass wins over a conflicting D2 pin (identity stripped from D2).
d2 = [{"source": ["10.9.0.5", "10.9.0.6"], "outboundTag": "via-germany"},
      {"user": ["cc_a@afrows"], "outboundTag": "via-village"}]
cleaned = mod.strip_identities_from_fixed(d2, {"10.9.0.5"}, {"cc_a@afrows"})
assert {"10.9.0.5"} not in [set(r.get("source", [])) for r in cleaned], "bypass source removed from D2"
assert any(r.get("source") == ["10.9.0.6"] for r in cleaned), "non-bypass source retained"
assert not any(r.get("user") == ["cc_a@afrows"] for r in cleaned), "sole bypass-user D2 rule dropped when emptied"
print("OK: P4 Part B unknown-tag drop + bypass-over-D2 precedence")

# --- USA mgmt path: via-usa + us-mgmt-socks (AFROWS_US_CHAIN_UUID-gated) ---
import json as _json
import os as _os
import tempfile as _tempfile
from types import SimpleNamespace as _NS

assert "us-mgmt-socks" in mod.SYSTEM_INBOUND_TAGS, "us-mgmt rule must never be taken for the client catch-all"
assert mod.CATCHALL_ORDER == ["via-germany", "via-backup", "proxy", "direct"], "INV-17: catch-all ladder (via-backup added 2026-10-28)"
_us = {"uuid": "00000000-0000-4000-8000-000000000000", "address": "172.64.34.62",
       "host": "us.afrows.com", "path": "/afrowsus", "socks_host": "127.0.0.1", "socks_port": 1083}
_vo = mod.chain_outbound(_us, "via-usa")
assert _vo["tag"] == "via-usa" and _vo["protocol"] == "vless" and _vo["mux"]["enabled"] is True
assert _vo["streamSettings"]["tlsSettings"]["serverName"] == "us.afrows.com"
assert _vo["streamSettings"]["wsSettings"] == {"path": "/afrowsus", "host": "us.afrows.com"}
assert mod.chain_outbound(_us)["tag"] == "via-germany", "default tag stays via-germany (back-compat)"
# direct REALITY mode (zirsakht DC throttles Cloudflare): exit IP + port, no ws/tls, NO mux
# (a DPI-frozen muxed flow hung every customer stream, 2026-10-25)
_re = dict(_us, address="162.19.253.235", mode="reality", port=8443, pbk="PBK", sid="ab12", sni="dl.google.com")
_ro = mod.chain_outbound(_re)
assert _ro["settings"]["vnext"][0]["address"] == "162.19.253.235" and _ro["settings"]["vnext"][0]["port"] == 8443
assert _ro["streamSettings"] == {"network": "tcp", "security": "reality", "realitySettings": {
    "serverName": "dl.google.com", "fingerprint": "chrome", "publicKey": "PBK", "shortId": "ab12"}}
assert "mux" not in _ro and "flow" not in _ro["settings"]["vnext"][0]["users"][0]
# optional Vision flow + uTLS fingerprint
_rv = mod.chain_outbound(dict(_re, sni="www.speedtest.net", flow="xtls-rprx-vision", fp="randomized"))
assert _rv["settings"]["vnext"][0]["users"][0]["flow"] == "xtls-rprx-vision" and "mux" not in _rv
assert _rv["streamSettings"]["realitySettings"]["fingerprint"] == "randomized"
assert _rv["streamSettings"]["realitySettings"]["serverName"] == "www.speedtest.net"
_mi = mod.us_mgmt_inbound(_us)
assert _mi["listen"] == "127.0.0.1" and _mi["port"] == 1083 and _mi["protocol"] == "socks"
# client_inbound_tags skips the system rule even if it is listed first
assert mod.client_inbound_tags([
    {"inboundTag": ["us-mgmt-socks"], "outboundTag": "via-germany"},
    {"inboundTag": ["afrows-in"], "outboundTag": "via-germany"}]) == ["afrows-in"]


def _apply(env_lines, cfg):
    d = _tempfile.mkdtemp()
    envp, cfgp = _os.path.join(d, "afrows.env"), _os.path.join(d, "config.json")
    open(envp, "w").write("\n".join(env_lines) + "\n")
    _json.dump(cfg, open(cfgp, "w"))
    old_env, old_run = mod.ENV, mod.subprocess.run
    mod.ENV = envp
    mod.subprocess.run = lambda *a, **k: _NS(stdout="Configuration OK", stderr="", returncode=0)
    try:
        changed = mod.apply_target(cfgp, "afrows-xray", "smart", [], [], "via-germany", [], "via-village")
    finally:
        mod.ENV, mod.subprocess.run = old_env, old_run
    return changed, _json.load(open(cfgp))


_base = {"inbounds": [{"tag": "afrows-in", "listen": "127.0.0.1", "port": 8447, "protocol": "vless"}],
         "outbounds": [{"tag": "proxy", "protocol": "socks"}, {"tag": "direct", "protocol": "freedom"}],
         "routing": {"rules": [{"type": "field", "inboundTag": ["afrows-in"], "outboundTag": "via-germany"}]}}
for _k in ("AFROWS_US_CHAIN_UUID", "AFROWS_DE_CHAIN_UUID"):
    _os.environ.pop(_k, None)
# unset -> no via-usa / us-mgmt-socks at all
_c, _cfg = _apply(["DATABASE_URL=x"], _base)
assert not any(o["tag"] == "via-usa" for o in _cfg["outbounds"])
assert not any(i["tag"] == "us-mgmt-socks" for i in _cfg["inbounds"])
assert not any(r.get("outboundTag") == "via-usa" for r in _cfg["routing"]["rules"])
# set -> outbound + loopback inbound + rule before the catch-all; first outbound unchanged
_on = ["AFROWS_US_CHAIN_UUID=11111111-1111-4111-8111-111111111111", "AFROWS_US_CHAIN_HOST=us.afrows.com"]
_c, _cfg = _apply(_on, _base)
assert _c is True
_vu = [o for o in _cfg["outbounds"] if o["tag"] == "via-usa"]
assert len(_vu) == 1 and _vu[0]["settings"]["vnext"][0]["users"][0]["id"] == "11111111-1111-4111-8111-111111111111"
assert _vu[0]["settings"]["vnext"][0]["address"] == "172.64.34.62"
assert _cfg["outbounds"][0]["tag"] == "proxy", "via-usa must never become the default (first) outbound"
_mg = [i for i in _cfg["inbounds"] if i["tag"] == "us-mgmt-socks"]
assert len(_mg) == 1 and _mg[0]["listen"] == "127.0.0.1" and _mg[0]["port"] == 1083
_rules = _cfg["routing"]["rules"]
_ri = _rules.index({"type": "field", "inboundTag": ["us-mgmt-socks"], "outboundTag": "via-usa"})
assert _ri < len(_rules) - 1 and _rules[-1]["inboundTag"] == ["afrows-in"], "mgmt rule precedes the catch-all"
# idempotent: re-running on the rendered config is a no-op (no restart)
_c2, _ = _apply(_on, _cfg)
assert _c2 is False, "second run must not change/restart"
# unset again -> the pair is removed (rollback)
_c3, _cfg3 = _apply(["DATABASE_URL=x"], _cfg)
assert _c3 is True
assert not any(o["tag"] == "via-usa" for o in _cfg3["outbounds"])
assert not any(i["tag"] == "us-mgmt-socks" for i in _cfg3["inbounds"])
assert not any(r.get("outboundTag") == "via-usa" for r in _cfg3["routing"]["rules"])
# other engines (afrows-wg) never get the USA mgmt objects
_d = _tempfile.mkdtemp(); _envp = _os.path.join(_d, "e"); open(_envp, "w").write("\n".join(_on) + "\n")
_cp = _os.path.join(_d, "c.json"); _json.dump(_base, open(_cp, "w"))
_oe, _or = mod.ENV, mod.subprocess.run
mod.ENV, mod.subprocess.run = _envp, (lambda *a, **k: _NS(stdout="Configuration OK", stderr="", returncode=0))
try:
    mod.apply_target(_cp, "afrows-wg", "smart", [], [], "via-germany", [], "via-village")
finally:
    mod.ENV, mod.subprocess.run = _oe, _or
_wg = _json.load(open(_cp))
assert not any(o["tag"] == "via-usa" for o in _wg["outbounds"]) and not any(i["tag"] == "us-mgmt-socks" for i in _wg["inbounds"])
print("OK: USA mgmt path via-usa + us-mgmt-socks (gated, idempotent, removable, afrows-xray only)")

# --- direct REALITY chain mode via env (AFROWS_US_CHAIN_MODE=reality) ---
_onr = _on + ["AFROWS_US_CHAIN_ADDRESS=93.127.140.50", "AFROWS_US_CHAIN_MODE=reality", "AFROWS_US_CHAIN_PORT=8443",
              "AFROWS_US_CHAIN_REALITY_PBK=PBK", "AFROWS_US_CHAIN_REALITY_SID=ab12"]
_c, _cfg = _apply(_onr, _base)
_vu = [o for o in _cfg["outbounds"] if o["tag"] == "via-usa"][0]
assert _vu["settings"]["vnext"][0]["address"] == "93.127.140.50" and _vu["settings"]["vnext"][0]["port"] == 8443
assert _vu["streamSettings"]["security"] == "reality" and _vu["streamSettings"]["realitySettings"]["serverName"] == "dl.google.com"
assert _apply(_onr, _cfg)[0] is False, "reality render is idempotent"
_onv = _onr + ["AFROWS_US_CHAIN_REALITY_FLOW=xtls-rprx-vision", "AFROWS_US_CHAIN_REALITY_FP=randomized",
               "AFROWS_US_CHAIN_REALITY_SNI=www.speedtest.net"]
_c, _cfgv = _apply(_onv, _cfg)
_vv = [o for o in _cfgv["outbounds"] if o["tag"] == "via-usa"][0]
assert _c is True and _vv["settings"]["vnext"][0]["users"][0]["flow"] == "xtls-rprx-vision" and "mux" not in _vv
assert _vv["streamSettings"]["realitySettings"]["fingerprint"] == "chrome", "randomized fp is mapped to chrome"
assert _apply(_onv, _cfgv)[0] is False, "vision render is idempotent"
# Shadowsocks-2022 chain mode
_ons = _on + ["AFROWS_US_CHAIN_ADDRESS=93.127.140.50", "AFROWS_US_CHAIN_MODE=ss", "AFROWS_US_CHAIN_PORT=8447",
              "AFROWS_US_CHAIN_SS_PASSWORD=SRV:USR"]
_c, _cfgs = _apply(_ons, _cfgv)
_vs = [o for o in _cfgs["outbounds"] if o["tag"] == "via-usa"][0]
assert _c is True and _vs["protocol"] == "shadowsocks" and "mux" not in _vs and "streamSettings" not in _vs
assert _vs["settings"]["servers"] == [{"address": "93.127.140.50", "port": 8447,
                                        "method": "2022-blake3-aes-128-gcm", "password": "SRV:USR"}]
assert _apply(_ons, _cfgs)[0] is False, "ss render is idempotent"
# mode unset again -> back to the Cloudflare WS chain
_c, _cfg = _apply(_on, _cfg)
_vu = [o for o in _cfg["outbounds"] if o["tag"] == "via-usa"][0]
assert _c is True and _vu["streamSettings"]["network"] == "ws" and _vu["settings"]["vnext"][0]["port"] == 443
print("OK: chain REALITY mode (env-gated, idempotent, reversible)")

# --- backup foreign transport: via-backup + backup-probe (AFROWS_BACKUP_CHAIN_*-gated) ---
_bk_on = ["DATABASE_URL=x", "AFROWS_BACKUP_CHAIN_MODE=reality", "AFROWS_BACKUP_CHAIN_ADDRESS=93.127.140.50",
          "AFROWS_BACKUP_CHAIN_PORT=443", "AFROWS_BACKUP_CHAIN_UUID=22222222-2222-4222-8222-222222222222",
          "AFROWS_BACKUP_CHAIN_REALITY_PBK=PBK", "AFROWS_BACKUP_CHAIN_REALITY_SID=ab12",
          "AFROWS_BACKUP_CHAIN_REALITY_SNI=www.speedtest.net", "AFROWS_BACKUP_CHAIN_REALITY_FP=ios"]


def _apply_svc(env_lines, cfg, svc, catch="via-germany"):
    d = _tempfile.mkdtemp()
    envp, cfgp = _os.path.join(d, "afrows.env"), _os.path.join(d, "config.json")
    open(envp, "w").write("\n".join(env_lines) + "\n")
    _json.dump(cfg, open(cfgp, "w"))
    old_env, old_run = mod.ENV, mod.subprocess.run
    mod.ENV = envp
    mod.subprocess.run = lambda *a, **k: _NS(stdout="Configuration OK", stderr="", returncode=0)
    try:
        changed = mod.apply_target(cfgp, svc, "smart", [], [], catch, [], "via-village")
    finally:
        mod.ENV, mod.subprocess.run = old_env, old_run
    return changed, _json.load(open(cfgp))


def _cfg_with(env_lines, fn):
    d = _tempfile.mkdtemp()
    envp = _os.path.join(d, "afrows.env")
    open(envp, "w").write("\n".join(env_lines) + "\n")
    old = mod.ENV
    mod.ENV = envp
    try:
        return fn()
    finally:
        mod.ENV = old


for _k in [k for k in _os.environ if k.startswith("AFROWS_BACKUP_")]:
    _os.environ.pop(_k)
assert "backup-probe" in mod.SYSTEM_INBOUND_TAGS, "backup probe rule must never be taken for the client catch-all"

# env unset / incomplete -> disabled (None), and the render is unchanged
assert _cfg_with(["DATABASE_URL=x"], mod.backup_cfg) is None
assert _cfg_with([l for l in _bk_on if "_UUID" not in l], mod.backup_cfg) is None, "reality needs a uuid"
assert _cfg_with([l for l in _bk_on if "_ADDRESS" not in l], mod.backup_cfg) is None, "needs an address"
assert _cfg_with(["AFROWS_BACKUP_CHAIN_MODE=ss", "AFROWS_BACKUP_CHAIN_ADDRESS=1.2.3.4"], mod.backup_cfg) is None, "ss needs a password"
_c0, _off = _apply_svc(["DATABASE_URL=x"], _base, "afrows-xray")
_c0b, _off_again = _apply_svc(["DATABASE_URL=x"], _off, "afrows-xray")
assert _c0b is False, "unset backup: second run is a no-op"
assert not any(o["tag"] == "via-backup" for o in _off["outbounds"])
assert not any(i["tag"] == "backup-probe" for i in _off["inbounds"])
assert not any(r.get("outboundTag") == "via-backup" or r.get("inboundTag") == ["backup-probe"] for r in _off["routing"]["rules"])

# set -> reality outbound (port 443, fp ios, no mux, no flow) + probe socks + its rule
_bc = _cfg_with(_bk_on, mod.backup_cfg)
assert _bc["mode"] == "reality" and _bc["port"] == 443 and _bc["fp"] == "ios" and _bc["flow"] == ""
assert (_bc["probe_host"], _bc["probe_port"]) == ("127.0.0.1", 10813)
_c1, _bon = _apply_svc(_bk_on, _off, "afrows-xray")
assert _c1 is True
_vb = [o for o in _bon["outbounds"] if o["tag"] == "via-backup"]
assert len(_vb) == 1 and _vb[0]["protocol"] == "vless" and "mux" not in _vb[0]
assert _vb[0]["settings"]["vnext"][0]["address"] == "93.127.140.50" and _vb[0]["settings"]["vnext"][0]["port"] == 443
assert "flow" not in _vb[0]["settings"]["vnext"][0]["users"][0]
assert _vb[0]["streamSettings"]["realitySettings"] == {"serverName": "www.speedtest.net", "fingerprint": "ios",
                                                       "publicKey": "PBK", "shortId": "ab12"}
assert _bon["outbounds"][0]["tag"] == "proxy", "via-backup must never become the default (first) outbound"
_bp = [i for i in _bon["inbounds"] if i["tag"] == "backup-probe"]
assert len(_bp) == 1 and _bp[0]["listen"] == "127.0.0.1" and _bp[0]["port"] == 10813 and _bp[0]["protocol"] == "socks"
_rules = _bon["routing"]["rules"]
_ri = _rules.index({"type": "field", "inboundTag": ["backup-probe"], "outboundTag": "via-backup"})
assert _ri < len(_rules) - 1 and _rules[-1]["inboundTag"] == ["afrows-in"], "probe rule precedes the catch-all"
assert _rules[-1]["outboundTag"] == "via-germany"
# idempotent: no rewrite / restart on re-run
assert _apply_svc(_bk_on, _bon, "afrows-xray")[0] is False, "backup render is idempotent"
# failover = rule change only: the outbound/inbound sets stay identical
_cf, _bfail = _apply_svc(_bk_on, _bon, "afrows-xray", catch="via-backup")
assert _cf is True and _bfail["routing"]["rules"][-1]["outboundTag"] == "via-backup"
assert _bfail["outbounds"] == _bon["outbounds"] and _bfail["inbounds"] == _bon["inbounds"]
assert {"type": "field", "inboundTag": ["dns-internal"], "outboundTag": "via-backup"} in _bfail["routing"]["rules"], \
    "xray DNS follows the catch-all onto the backup"
# a config whose catch-all already points at via-backup is still recognised next run
assert mod.client_inbound_tags(_bfail["routing"]["rules"]) == ["afrows-in"]
assert _apply_svc(_bk_on, _bfail, "afrows-xray", catch="via-backup")[0] is False
# Vision variant and ss / ws modes use the same builders
_bv = _cfg_with(_bk_on + ["AFROWS_BACKUP_CHAIN_REALITY_FLOW=xtls-rprx-vision"], mod.backup_cfg)
assert mod.chain_outbound(_bv, "via-backup")["settings"]["vnext"][0]["users"][0]["flow"] == "xtls-rprx-vision"
_bs = _cfg_with(["AFROWS_BACKUP_CHAIN_MODE=ss", "AFROWS_BACKUP_CHAIN_ADDRESS=93.127.140.50",
                 "AFROWS_BACKUP_CHAIN_PORT=8447", "AFROWS_BACKUP_CHAIN_SS_PASSWORD=SRV:USR"], mod.backup_cfg)
_bso = mod.chain_outbound(_bs, "via-backup")
assert _bso["protocol"] == "shadowsocks" and _bso["settings"]["servers"][0]["port"] == 8447
_bw = _cfg_with(["AFROWS_BACKUP_CHAIN_MODE=ws", "AFROWS_BACKUP_CHAIN_ADDRESS=172.64.34.62",
                 "AFROWS_BACKUP_CHAIN_UUID=33333333-3333-4333-8333-333333333333",
                 "AFROWS_BACKUP_CHAIN_HOST=us.afrows.com", "AFROWS_BACKUP_CHAIN_PATH=/afrowsus"], mod.backup_cfg)
_bwo = mod.chain_outbound(_bw, "via-backup")
assert _bwo["streamSettings"]["network"] == "ws"
assert _bwo["streamSettings"]["wsSettings"] == {"path": "/afrowsus", "host": "us.afrows.com"}
# xhttp mode (2026-10-28): VLESS + XHTTP packet-up, one POST per fresh TCP connection
_bx_on = ["DATABASE_URL=x", "AFROWS_BACKUP_CHAIN_MODE=xhttp", "AFROWS_BACKUP_CHAIN_ADDRESS=93.127.140.50",
          "AFROWS_BACKUP_CHAIN_PORT=8448", "AFROWS_BACKUP_CHAIN_UUID=44444444-4444-4444-8444-444444444444",
          "AFROWS_BACKUP_CHAIN_PATH=/xu", "AFROWS_BACKUP_CHAIN_XHTTP_ENCRYPTION=mlkem768x25519plus.native.0rtt.KEY"]
assert _cfg_with([l for l in _bx_on if "_UUID" not in l], mod.backup_cfg) is None, "xhttp needs a uuid"
_bx = _cfg_with(_bx_on, mod.backup_cfg)
assert _bx["mode"] == "xhttp" and _bx["port"] == 8448 and _bx["path"] == "/xu"
assert (_bx["xhttp_post_bytes"], _bx["xhttp_post_interval_ms"]) == (32000, 5), "measured defaults"
_bxo = mod.chain_outbound(_bx, "via-backup")
assert _bxo["protocol"] == "vless" and "mux" not in _bxo
assert _bxo["settings"]["vnext"] == [{"address": "93.127.140.50", "port": 8448, "users": [
    {"id": "44444444-4444-4444-8444-444444444444", "encryption": "mlkem768x25519plus.native.0rtt.KEY", "level": 0}]}]
assert "flow" not in _bxo["settings"]["vnext"][0]["users"][0]
_bxs = _bxo["streamSettings"]
assert _bxs["network"] == "xhttp" and _bxs["security"] == "none"
assert _bxs["xhttpSettings"]["path"] == "/xu" and _bxs["xhttpSettings"]["mode"] == "packet-up"
_bxx = _bxs["xhttpSettings"]["extra"]
assert (_bxx["scMaxEachPostBytes"], _bxx["scMinPostsIntervalMs"]) == ("32000", "5")
assert set(_bxx["xmux"]) == {"maxConcurrency", "maxConnections", "cMaxReuseTimes", "hMaxRequestTimes",
                             "hMaxReusableSecs", "hKeepAlivePeriod"}, "xray needs every xmux field once any is set"
assert (_bxx["xmux"]["cMaxReuseTimes"], _bxx["xmux"]["hMaxRequestTimes"]) == ("1", "1"), "one request per connection"
# tunables and the encryption default
_bx2 = _cfg_with([l for l in _bx_on if "_ENCRYPTION" not in l] + ["AFROWS_BACKUP_CHAIN_XHTTP_POST_BYTES=24000",
                 "AFROWS_BACKUP_CHAIN_XHTTP_POST_INTERVAL_MS=10"], mod.backup_cfg)
_bx2o = mod.chain_outbound(_bx2, "via-backup")
assert _bx2o["settings"]["vnext"][0]["users"][0]["encryption"] == "none"
assert _bx2o["streamSettings"]["xhttpSettings"]["extra"]["scMaxEachPostBytes"] == "24000"
assert _bx2o["streamSettings"]["xhttpSettings"]["extra"]["scMinPostsIntervalMs"] == "10"
# render: gated, idempotent, removable, the same way as the other modes
_cx, _bxon = _apply_svc(_bx_on, _off, "afrows-xray")
assert _cx is True and [o for o in _bxon["outbounds"] if o["tag"] == "via-backup"] == [_bxo]
assert _apply_svc(_bx_on, _bxon, "afrows-xray")[0] is False, "xhttp render is idempotent"
_cxr, _bxoff = _apply_svc(["DATABASE_URL=x"], _bxon, "afrows-xray")
assert _cxr is True and _bxoff == _off, "unsetting the xhttp backup restores the pre-backup config exactly"
# a mode string the renderer does not know still disables the backup (unchanged behaviour)
assert _cfg_with([l.replace("=xhttp", "=hysteria") for l in _bx_on], mod.backup_cfg) is None
# the customer chain (via-germany) can run xhttp too; the mgmt chain (via-usa) keeps its own mode
_px_on = ["DATABASE_URL=x", "AFROWS_DE_CHAIN_UUID=44444444-4444-4444-8444-444444444444",
          "AFROWS_DE_CHAIN_ADDRESS=93.127.140.50", "AFROWS_DE_CHAIN_MODE=xhttp", "AFROWS_DE_CHAIN_PORT=8448",
          "AFROWS_DE_CHAIN_PATH=/xu", "AFROWS_DE_CHAIN_XHTTP_ENCRYPTION=mlkem768x25519plus.native.0rtt.KEY"]
_px = _cfg_with(_px_on, mod.chain_cfg)
assert _px["mode"] == "xhttp" and _px["port"] == 8448
_pxo = mod.chain_outbound(_px, "via-germany")
assert _pxo["tag"] == "via-germany" and _pxo["streamSettings"]["network"] == "xhttp" and "mux" not in _pxo
print("OK: xhttp packet-up chain mode (backup and primary; one POST per connection; gated, idempotent, removable)")
# afrows-wg also carries the catch-all -> it gets the outbound, but never the probe inbound
_cw, _wg = _apply_svc(_bk_on, _base, "afrows-wg", catch="via-backup")
assert any(o["tag"] == "via-backup" for o in _wg["outbounds"])
assert not any(i["tag"] == "backup-probe" for i in _wg["inbounds"])
assert _wg["routing"]["rules"][-1]["outboundTag"] == "via-backup"
# via-usa is untouched by the backup
_cu, _cfgu = _apply_svc(_on + _bk_on[1:], _base, "afrows-xray")
_cu2, _cfgu2 = _apply_svc(_on, _base, "afrows-xray")
assert [o for o in _cfgu["outbounds"] if o["tag"] == "via-usa"] == [o for o in _cfgu2["outbounds"] if o["tag"] == "via-usa"]
# unset again -> outbound, probe inbound and rule removed (rollback)
_cr, _boff = _apply_svc(["DATABASE_URL=x"], _bon, "afrows-xray")
assert _cr is True and _boff == _off, "unsetting the backup env restores the pre-backup config exactly"
# a fixed (D2/bypass) rule may target via-backup only while it exists
_ok_tags, _no_tags = {o["tag"] for o in _bon["outbounds"]}, {o["tag"] for o in _off["outbounds"]}
assert mod.partition_known_outbound_rules([{"user": ["u"], "outboundTag": "via-backup"}], _ok_tags)[1] == []
assert mod.partition_known_outbound_rules([{"user": ["u"], "outboundTag": "via-backup"}], _no_tags)[0] == []
print("OK: via-backup + backup-probe render (gated, idempotent, rule-only failover, removable)")

# --- failover ladder: via-germany -> via-backup -> proxy -> direct, with hysteresis ---
# (ch is choose_catchall; positional args: germany_ok, pool_ok, state, backup_ok)
applied, st = ch(True, False, {}, True)
assert applied == "via-germany"
# primary down, backup up: k_out=2 strikes before leaving via-germany
applied, st = ch(False, False, {"applied": "via-germany"}, True)
assert applied == "via-germany", ("hold on 1st strike", applied)
applied, st = ch(False, True, st, True)  # pool health is irrelevant while the backup is up
assert applied == "via-backup", ("backup on 2nd strike, preferred over the pool", applied)
# a single primary blip does not flip (the count resets when the primary answers again)
applied, st2 = ch(False, False, {"applied": "via-germany"}, True)
applied, st2 = ch(True, False, st2, True)
applied, st2 = ch(False, False, st2, True)
assert applied == "via-germany", ("blips separated by a good probe never flip", applied)
# backup down too: the pool, else direct (k_out=2 each)
applied, st = ch(False, True, st, False)
assert applied == "via-backup", applied
applied, st = ch(False, True, st, False)
assert applied == "proxy", ("pool when both chains are down", applied)
applied, st = ch(False, False, {"applied": "via-backup"}, False)
applied, st = ch(False, False, st, False)
assert applied == "direct", ("direct only when everything is down", applied)
# recovery: direct -> via-backup (k_back=3) -> via-germany (k_back=3)
for n, exp in ((1, "direct"), (2, "direct"), (3, "via-backup")):
    applied, st = ch(False, False, st, True)
    assert applied == exp, (n, applied)
for n, exp in ((1, "via-backup"), (2, "via-backup"), (3, "via-germany")):
    applied, st = ch(True, False, st, True)
    assert applied == exp, ("slow fail-back to the primary", n, applied)
# backup unconfigured -> backup_ok defaults to False -> exactly the old ladder
assert ch(False, True, {"applied": "proxy"})[0] == "proxy"
print("OK: choose_catchall ladder via-germany -> via-backup -> proxy -> direct with hysteresis")

# --- decide_catchall: probe order, bounded probing, rollback of a stale applied tag ---
_d = _tempfile.mkdtemp()
_old = (mod.STATE_FILE, mod.germany_alive, mod.backup_alive, mod.pool_alive, mod.ENV)
_calls = []


def _probe(name, result):
    def f():
        _calls.append(name)
        return result
    return f


def _run(env_lines, vg, bk, pool, state):
    envp = _os.path.join(_d, "afrows.env")
    open(envp, "w").write("\n".join(env_lines) + "\n")
    mod.ENV = envp
    mod.STATE_FILE = _os.path.join(_d, "pool.state")
    _json.dump(state, open(mod.STATE_FILE, "w"))
    _calls.clear()
    mod.germany_alive, mod.backup_alive, mod.pool_alive = _probe("germany", vg), _probe("backup", bk), _probe("pool", pool)
    return mod.decide_catchall("germany"), _json.load(open(mod.STATE_FILE))


try:
    _a, _ = _run(_bk_on, True, True, True, {"applied": "via-germany"})
    assert _a == "via-germany" and _calls == ["germany"], ("primary up: no reserve probed", _calls)
    _a, _ = _run(_bk_on, False, True, True, {"applied": "via-backup"})
    assert _a == "via-backup" and _calls == ["germany", "backup"], ("backup up: pool not probed", _calls)
    _a, _ = _run(_bk_on, False, False, False, {"applied": "via-backup", "pending": "via-backup"})
    assert _calls == ["germany", "backup", "pool"], _calls
    _a, _ = _run(["DATABASE_URL=x"], False, True, False, {"applied": "via-germany"})
    assert "backup" not in _calls, ("an unconfigured backup is never probed", _calls)
    # rollback while via-backup is applied: decide afresh, never keep the dangling tag
    _a, _st = _run(["DATABASE_URL=x"], False, True, True, {"applied": "via-backup", "pending": "via-backup", "count": 0})
    assert _a == "proxy" and _st["applied"] == "proxy", (_a, _st)
    _a, _st = _run(["DATABASE_URL=x"], True, False, False, {"applied": "via-backup"})
    assert _a == "via-germany", _a
finally:
    mod.STATE_FILE, mod.germany_alive, mod.backup_alive, mod.pool_alive, mod.ENV = _old
print("OK: decide_catchall probes each reserve only when every path above it is down")

# --- probe bounds: memoised per run, the backup curl bound shorter than the primary ---
_seen = []


def _fake_run(cmd, **k):
    _seen.append((cmd, k.get("timeout")))
    return _NS(stdout="000", stderr="", returncode=0)


_or, _oe = mod.subprocess.run, mod.ENV
mod.subprocess.run = _fake_run
try:
    mod._PROBE_MEMO.clear()
    _envp = _os.path.join(_d, "bk.env")
    open(_envp, "w").write("\n".join(_bk_on) + "\n")
    mod.ENV = _envp
    assert mod.backup_alive() is False and mod.backup_alive() is False
    assert len(_seen) == 2, ("2 URLs once, then memoised", len(_seen))
    assert all(c[c.index("-m") + 1] == "8" and t == 12 for c, t in _seen), _seen
    assert all("127.0.0.1:10813" in c for c, _t in _seen)
    _seen.clear()
    assert mod.pool_alive() is False and mod.pool_alive() is False and len(_seen) == 2
    _seen.clear()
    assert mod.iface_alive("wg-x") is False and mod.iface_alive("wg-x") is False and len(_seen) == 2
finally:
    mod.subprocess.run, mod.ENV = _or, _oe
    mod._PROBE_MEMO.clear()
# all-down worst case: primary 2x14 + backup 2x12 + pool 2x12 + village 2x12 = 100 s < 240 s
print("OK: backup probe bounded (8 s curl / 12 s hard) and memoised per run")

# full-tunnel sources: every packet (Iranian destinations too) follows the catch-all, ahead of Iran-direct
_ft = mod.desired_rules("smart", ["tproxy-in"], [], [], "via-germany", [], "via-village", None, ["10.21.0.2"])
_fti = _ft.index({"type": "field", "source": ["10.21.0.2"], "outboundTag": "via-germany"})
_geo = next(i for i, r in enumerate(_ft) if r.get("outboundTag") == "direct" and r.get("ip"))
assert _fti < _geo, "full-tunnel rule must precede the Iran-direct rule"
assert mod.desired_rules("smart", ["tproxy-in"], [], [], "via-backup", [], "via-village", None, ["10.21.0.2"])[_fti]["outboundTag"] == "via-backup", "follows failover"
assert mod.desired_rules("smart", ["tproxy-in"], [], [], "via-germany") == [r for r in _ft if r.get("source") != ["10.21.0.2"]], "unset = unchanged"
assert mod.desired_rules("smart", ["tproxy-in"], [], [], "direct", [], "via-village", None, ["10.21.0.2"])[_fti]["outboundTag"] == "block", "never leaked to direct"
print("OK: full-tunnel sources precede Iran-direct, follow the catch-all, block instead of direct; unset = unchanged")

# full-tunnel sources pinned to an exit list block on any other catch-all (e.g. a Germany backup)
_pin = lambda catch: mod.desired_rules("smart", ["tproxy-in"], [], [], catch, [], "via-village", None, ["10.21.0.2"], ["via-germany"])[_fti]["outboundTag"]
assert (_pin("via-germany"), _pin("via-backup"), _pin("direct")) == ("via-germany", "block", "block")
# backup ws via Cloudflare takes a configurable uTLS fingerprint (default chrome = unchanged)
_bw = ["DATABASE_URL=x", "AFROWS_BACKUP_CHAIN_MODE=ws", "AFROWS_BACKUP_CHAIN_ADDRESS=172.64.34.62",
       "AFROWS_BACKUP_CHAIN_UUID=55555555-5555-4555-8555-555555555555", "AFROWS_BACKUP_CHAIN_HOST=de.afrows.com",
       "AFROWS_BACKUP_CHAIN_PATH=/afrowsws"]
assert mod.chain_outbound(_cfg_with(_bw, mod.backup_cfg), "via-backup")["streamSettings"]["tlsSettings"]["fingerprint"] == "chrome"
_bwo = mod.chain_outbound(_cfg_with(_bw + ["AFROWS_BACKUP_CHAIN_WS_FP=ios"], mod.backup_cfg), "via-backup")
assert _bwo["streamSettings"]["tlsSettings"] == {"serverName": "de.afrows.com", "fingerprint": "ios", "alpn": ["http/1.1"]}
print("OK: full-tunnel exit pin; backup ws fingerprint configurable (default unchanged)")
