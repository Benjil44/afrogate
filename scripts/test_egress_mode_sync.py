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
assert mod.CATCHALL_ORDER == ["via-germany", "proxy", "direct"], "INV-17: catch-all order unchanged"
_us = {"uuid": "00000000-0000-4000-8000-000000000000", "address": "172.64.34.62",
       "host": "us.afrows.com", "path": "/afrowsus", "socks_host": "127.0.0.1", "socks_port": 1083}
_vo = mod.chain_outbound(_us, "via-usa")
assert _vo["tag"] == "via-usa" and _vo["protocol"] == "vless" and _vo["mux"]["enabled"] is True
assert _vo["streamSettings"]["tlsSettings"]["serverName"] == "us.afrows.com"
assert _vo["streamSettings"]["wsSettings"] == {"path": "/afrowsus", "host": "us.afrows.com"}
assert mod.chain_outbound(_us)["tag"] == "via-germany", "default tag stays via-germany (back-compat)"
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
