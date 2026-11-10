"""Unit tests for afrows-hexo-egress-sync.py: country extraction, the preference/skip
rules, redaction, outbound shapes, keep-last-good, and idempotent (no-change) reconcile.
Run: python scripts/hexo-egress/test_hexo_egress_sync.py  (no third-party deps)."""
import importlib.util
import json
import os
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location(
    "hexo_egress_sync", str(HERE.parents[1] / "scripts" / "afrows-hexo-egress-sync.py")
    if (HERE.parents[1] / "scripts" / "afrows-hexo-egress-sync.py").exists()
    else str(HERE.parent / "afrows-hexo-egress-sync.py")
)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

SAMPLE = (HERE / "testdata" / "sample-sub.txt").read_text(encoding="utf-8")
SAMPLE_B64 = (HERE / "testdata" / "sample-sub.txt.b64").read_text(encoding="utf-8")
COUNTRIES = ["DE", "NL", "SE", "TR", "US", "AM", "RO"]
PORTS = mod.parse_ports(mod.DEFAULT_PORTS)

fronts = mod.parse_sub(SAMPLE)


# --- country extraction --------------------------------------------------------------
assert mod._remark_country("🇳🇱 NL ▸ 👑 VIP") == ("NL", False)
assert mod._remark_country("🇳🇱 NL2 ▸ 🔐 TLS") == ("NL", True), "NL2 -> base NL, secondary"
assert mod._remark_country("🇹🇷 TR2 ▸ 🛡 Reality 8080") == ("TR", True)
assert mod._remark_country("▌ 👤 ramin ▸ 📅 ∞") == (None, False), "per-user remark is not a country"
assert mod._remark_country("🛡 Reality") == (None, False), "no 2-letter tag -> not a country"
print("OK: country extraction")


# --- base64 auto-detect --------------------------------------------------------------
assert mod.b64_decode_sub(SAMPLE).splitlines()[0].startswith("vless://"), "decoded text passes through"
assert mod.b64_decode_sub(SAMPLE_B64).splitlines()[0].startswith("vless://"), "base64 body is decoded"
assert len(mod.parse_sub(mod.b64_decode_sub(SAMPLE_B64))) == len(fronts), "b64 and txt parse identically"
print("OK: base64 decode auto-detect")


# --- skip rules ----------------------------------------------------------------------
assert fronts, "fixture parsed into fronts"
assert all(f["skip"] for f in fronts if f["host"].endswith(mod.HETZNER_DIRECT_SUFFIX)), "your-server.de skipped"
assert any(f["host"].endswith(mod.HETZNER_DIRECT_SUFFIX) for f in fronts), "fixture has your-server.de lines"
assert all(f["cc"] != "RAMIN" for f in fronts)
print("OK: skip rules (Hetzner-direct flagged)")


# --- per-country selection (preference: reality > tls > ss > http; primary tiebreak) -
chosen = mod.select_per_country(fronts, COUNTRIES)
assert chosen["DE"]["transport"] == "reality" and chosen["DE"]["host"].endswith(".ir")
assert chosen["NL"]["transport"] == "reality" and chosen["NL"]["secondary"] is False, "NL primary, not NL2"
assert chosen["SE"]["transport"] == "reality"
assert chosen["US"]["transport"] == "reality"
assert chosen["TR"]["transport"] == "reality", "transport-dominant: TR2 reality beats TR tls"
assert chosen["AM"]["transport"] == "ss", "AM has only a shadowsocks front"
assert "RO" not in chosen, "no RO front in this shard"
assert not any(c["host"].endswith(mod.HETZNER_DIRECT_SUFFIX) for c in chosen.values()), "never picks Hetzner-direct"
print("OK: per-country preference + skip selection")


# --- outbound shapes -----------------------------------------------------------------
de = mod.build_outbound(chosen["DE"], "hexo-de")
assert de["protocol"] == "vless" and de["streamSettings"]["security"] == "reality"
assert de["streamSettings"]["realitySettings"]["publicKey"], "reality carries the server public key"
assert de["settings"]["vnext"][0]["port"] == chosen["DE"]["port"]
# a reality front with pqv -> mldsa65Verify
pqv_front = next(f for f in fronts if f.get("pqv"))
assert mod.build_outbound(pqv_front, "t")["streamSettings"]["realitySettings"]["mldsa65Verify"] == pqv_front["pqv"]
# VLESS Encryption string is carried onto the user when present
assert de["settings"]["vnext"][0]["users"][0]["encryption"].startswith("mlkem") or de["settings"]["vnext"][0]["users"][0]["encryption"] == "none"
am = mod.build_outbound(chosen["AM"], "hexo-am")
assert am["protocol"] == "shadowsocks" and am["settings"]["servers"][0]["method"]
print("OK: outbound shapes (reality / ss / pqv)")


# --- redaction -----------------------------------------------------------------------
line = mod.redact_front(chosen["DE"])
assert mod.REDACTED in line and chosen["DE"]["uuid"] not in line, "uuid never printed"
masked = json.dumps(mod._mask(de))
assert de["streamSettings"]["realitySettings"]["publicKey"] not in masked, "pbk masked in diff"
assert chosen["DE"]["uuid"] not in masked, "uuid masked in diff"
assert mod._mask(am)["settings"]["servers"][0]["password"] == mod.REDACTED, "ss password masked (method, a public cipher name, stays)"
print("OK: redaction (uuid / pbk / ss password)")


# --- reconcile against a synthetic config (no xray binary needed) ---------------------
# The live Afrows Iran box has NO REALITY inbound: customers enter via nginx TLS on :443 ->
# WS, so the clone source is the ws inbound `afrows-in` (network=ws, security=none,
# listen=127.0.0.1, wsSettings.path=/afrowsws). The hexo inbounds are cloned from THIS.
PRIMARY_WS = {
    "tag": mod.CLONE_INBOUND_TAG, "listen": "127.0.0.1", "port": 8447, "protocol": "vless",
    "settings": {"clients": [{"id": "uuid-a", "email": "cc_1@afrows"}], "decryption": "none"},
    "streamSettings": {"network": "ws", "security": "none",
                       "wsSettings": {"path": "/afrowsws"}},
}
BASE_CFG = {
    "inbounds": [PRIMARY_WS],
    "outbounds": [{"tag": "direct", "protocol": "freedom"}],
    "routing": {"rules": [{"type": "field", "inboundTag": ["api"], "outboundTag": "api"},
                          {"type": "field", "inboundTag": ["afrows-in"], "outboundTag": "proxy"}]},
}

outs, _fronts, source = mod.resolve_outbounds(fronts, COUNTRIES, PORTS, {})
cfg = json.loads(json.dumps(BASE_CFG))
o1, i1, r1, note1, changed1 = mod.build_desired(cfg, outs, PORTS, COUNTRIES)
assert changed1 is True and note1 is None
# a hexo inbound was cloned from the source ws inbound, on its mapped port, staying on
# loopback behind nginx with a per-country ws path
nl_in = next(i for i in i1 if i["tag"] == "hexo-in-nl")
assert nl_in["port"] == PORTS["NL"] and nl_in["listen"] == "127.0.0.1", "ws inbound stays on loopback behind nginx"
assert nl_in["streamSettings"]["network"] == "ws" and nl_in["streamSettings"]["security"] == "none", "ws identity cloned"
assert nl_in["streamSettings"]["wsSettings"]["path"] == "/afrowsws-nl", "per-country ws path (lowercase cc)"
assert nl_in["settings"]["clients"] == [], "clients emptied: only entitlement-gated adu populates hexo (fail-closed by construction)"
# routing: a hexo rule sits right after `api`, before the client catch-all
assert r1[0]["outboundTag"] == "api"
assert any(r.get("outboundTag", "").startswith("hexo-") for r in r1)
catch_idx = next(idx for idx, r in enumerate(r1) if r.get("outboundTag") == "proxy")
hexo_idx = next(idx for idx, r in enumerate(r1) if r.get("outboundTag", "").startswith("hexo-"))
assert hexo_idx < catch_idx, "hexo rules precede the client catch-all"

# idempotent: applying the same desired set to the already-converged config is a no-op
cfg2 = json.loads(json.dumps(cfg))
cfg2["outbounds"], cfg2["inbounds"], cfg2["routing"]["rules"] = o1, i1, r1
o2, i2, r2, note2, changed2 = mod.build_desired(cfg2, outs, PORTS, COUNTRIES)
assert changed2 is False, "second reconcile sees no change (no spurious restart)"
print("OK: reconcile is idempotent + inbound clone + rule precedence")


# --- keep-last-good: a country absent from the shard keeps its previous outbound ------
prev = {"outbounds": {"RO": {"tag": "hexo-ro", "protocol": "vless",
                             "settings": {"vnext": [{"address": "old.ir", "port": 9000, "users": [{"id": "x"}]}]},
                             "streamSettings": {"network": "tcp", "security": "reality", "realitySettings": {}}}}}
outs_kept, _f, source_kept = mod.resolve_outbounds(fronts, COUNTRIES, PORTS, prev)
assert source_kept["RO"] == "kept-last-good" and outs_kept["RO"]["tag"] == "hexo-ro"
assert source_kept["DE"] == "fresh"
print("OK: keep-last-good for a country missing from the current shard")


# --- health-check selection: exit-country match + stability (fake probe, no net/xray) -----
def mkfront(cc, transport, host, idx, secondary=False, skip=False, uuid="u"):
    return {"cc": cc, "transport": transport, "host": host, "port": 443, "scheme": "vless",
            "uuid": uuid + "-" + host, "secondary": secondary, "index": idx, "skip": skip}

# DE: top-ranked reality exits in the WRONG country (NL); the lower-ranked tls exits DE.
de_reality_wrong = mkfront("DE", "reality", "de-reality", 0)
de_tls_ok = mkfront("DE", "tls", "de-tls", 1)
# TR: the single reality front exits in TR (clean pass on the first candidate).
tr_ok = mkfront("TR", "reality", "tr-reality", 0)
# NL: two same-rank reality fronts, both exit NL; prev-good should win (stability).
nl_a = mkfront("NL", "reality", "nl-a", 0)
nl_b = mkfront("NL", "reality", "nl-b", 1)
# SE: its only front exits in DE -> no passing front -> SE absent.
se_bad = mkfront("SE", "reality", "se-bad", 0)
hfronts = [de_reality_wrong, de_tls_ok, tr_ok, nl_a, nl_b, se_bad]

# exit country keyed by host (what the probe "observes")
EXIT = {"de-reality": "NL", "de-tls": "DE", "tr-reality": "TR",
        "nl-a": "NL", "nl-b": "NL", "se-bad": "DE"}
probe_calls = []
def fake_probe(front):
    probe_calls.append(front["host"])
    return EXIT.get(front["host"])

hc = mod.health_select_per_country(hfronts, ["DE", "TR", "NL", "SE"], {}, probe=fake_probe)
# geo-match: DE drops the top-ranked reality (wrong exit) and takes the tls that exits DE
assert hc["DE"]["host"] == "de-tls", "drops top-ranked front that exits the wrong country"
# clean first-candidate pass
assert hc["TR"]["host"] == "tr-reality", "picks the first geo-matching front"
# a country with no geo-matching front is simply absent (not advertised)
assert "SE" not in hc, "no passing front -> country absent"
# stops at the first pass per country: TR probed once; NL's second front never reached
assert probe_calls.count("tr-reality") == 1, "first geo-match ends the country's probing"
assert "nl-b" not in probe_calls, "nl-a passed first, so nl-b is never probed"
print("OK: health-select geo-match (wrong-exit dropped, no-pass absent)")

# stability: with a prev-good front, probe it first and keep it if it still passes
probe_calls.clear()
prev_nl = {"fronts": {"NL": nl_b}}
hc2 = mod.health_select_per_country(hfronts, ["NL"], prev_nl, probe=fake_probe)
assert hc2["NL"]["host"] == "nl-b", "prev-good front preferred while it still passes (no churn)"
assert probe_calls[0] == "nl-b", "prev-good front probed first"
assert probe_calls == ["nl-b"], "a single pass ends the probing for the country"
print("OK: health-select stability (prev-good probed first, kept)")

# max-candidates cap: only the Nth (beyond the cap) passes -> country absent
cap_fronts = [mkfront("US", "reality", "us-%d" % i, i) for i in range(6)]
CAP_EXIT = {"us-5": "US"}  # only the 6th exits US; everything before fails
hc3 = mod.health_select_per_country(cap_fronts, ["US"], {}, probe=lambda f: CAP_EXIT.get(f["host"]),
                                    max_candidates=4)
assert "US" not in hc3, "max_candidates cap stops before a late-passing front"
hc3b = mod.health_select_per_country(cap_fronts, ["US"], {}, probe=lambda f: CAP_EXIT.get(f["host"]),
                                     max_candidates=6)
assert hc3b["US"]["host"] == "us-5", "raising the cap finds it"
print("OK: health-select max-candidates cap")

# health-check OFF falls back to rank-only: select_per_country would keep the wrong-exit top
rank_only = mod.select_per_country(hfronts, ["DE"])
assert rank_only["DE"]["host"] == "de-reality", "rank-only (healthcheck off) ignores exit country"
print("OK: rank-only fallback differs from health-select (off path)")

# resolved file hides an unhealthy-but-kept country; keeps a healthy one
_in = [{"tag": "hexo-in-de"}, {"tag": "hexo-in-nl"}]
_out = [{"tag": "hexo-de"}, {"tag": "hexo-nl"}]
# NL kept-last-good (in config) but NOT healthy this tick -> excluded from resolved
assert mod.resolved_countries(_in, _out, ["DE", "NL"], healthy={"DE"}) == ["de"], "unhealthy kept country hidden from resolved"
# healthy=None (health-check off) keeps the config-presence-only behaviour
assert mod.resolved_countries(_in, _out, ["DE", "NL"]) == ["de", "nl"], "off path advertises all live listeners"
print("OK: resolved file health-filter (kept-but-unhealthy hidden, off path unchanged)")


# --- grace window: resolved file is as sticky as the outbound keep-last-good (no flap) ----
G = 1200
_in2 = [{"tag": "hexo-in-de"}, {"tag": "hexo-in-nl"}]
_out2 = [{"tag": "hexo-de"}, {"tag": "hexo-nl"}]
# t0: both pass -> both advertised immediately (fresh pass is in `healthy`)
lh0 = mod.bump_last_healthy({}, {"DE", "NL"}, ["DE", "NL"], 1000.0)
assert mod.resolved_countries(_in2, _out2, ["DE", "NL"], healthy={"DE", "NL"},
                              last_healthy=lh0, grace=G, now=1000.0) == ["de", "nl"], "fresh pass advertised immediately"
# +600s: NL fails this tick but passed 600s ago (< grace) and still has its outbound -> stays
lh1 = mod.bump_last_healthy(lh0, {"DE"}, ["DE", "NL"], 1600.0)   # only DE passes now
assert mod.resolved_countries(_in2, _out2, ["DE", "NL"], healthy={"DE"},
                              last_healthy=lh1, grace=G, now=1600.0) == ["de", "nl"], "within grace: kept country stays advertised"
# +1300s: NL still failing, its last pass (t=1000) is now older than grace -> drops
lh2 = mod.bump_last_healthy(lh1, {"DE"}, ["DE", "NL"], 2300.0)
assert mod.resolved_countries(_in2, _out2, ["DE", "NL"], healthy={"DE"},
                              last_healthy=lh2, grace=G, now=2300.0) == ["de"], "beyond grace: continuously-failing country drops"
# grace persists across ticks via state: NL kept its t=1000 stamp through DE-only ticks
assert lh1["NL"] == 1000.0 and lh2["NL"] == 1000.0, "last_healthy carried forward across ticks (not reset)"
# a country with NO last-good outbound is never advertised, even within grace
lh3 = dict(lh2); lh3["NL"] = 2300.0
assert mod.resolved_countries([{"tag": "hexo-in-nl"}], [], ["NL"], healthy=set(),
                              last_healthy=lh3, grace=G, now=2300.0) == [], "no outbound -> never advertised"
# prune: a country dropped from AFROWS_HEXO_COUNTRIES loses its timestamp
lh_pruned = mod.bump_last_healthy(lh2, {"DE"}, ["DE"], 2400.0)
assert "NL" not in lh_pruned and lh_pruned["DE"] == 2400.0, "unconfigured country's last_healthy pruned"
# off path ignores grace entirely (config presence only)
assert mod.resolved_countries(_in2, _out2, ["DE", "NL"], healthy=None,
                              last_healthy=lh2, grace=G, now=9_999_999.0) == ["de", "nl"], "off path unaffected by grace"
print("OK: resolved grace window (sticky within grace, drops after, no-outbound excluded, pruned, off unaffected)")


# --- primary reality inbound absent -> inbounds/rules skipped, outbounds still refresh -
no_primary = {"inbounds": [], "outbounds": [], "routing": {"rules": []}}
o3, i3, r3, note3, _c = mod.build_desired(no_primary, outs, PORTS, COUNTRIES)
assert note3 and "not found" in note3
assert any(o["tag"].startswith("hexo-") for o in o3), "outbounds still emitted"
assert not any(i["tag"].startswith("hexo-in-") for i in i3), "no inbounds without a primary to clone"
assert not any(r.get("outboundTag", "").startswith("hexo-") for r in r3), "no dangling hexo rules"
print("OK: graceful skip when the clone-source inbound is missing")

# --- redaction hardening: privateKey + scrub -----------------------------------------
_inbound_with_key = {"tag": "hexo-in-de", "streamSettings": {"realitySettings": {"privateKey": "SUPERSECRETPRIVATEKEY123456"}}}
assert mod._mask(_inbound_with_key)["streamSettings"]["realitySettings"]["privateKey"] == mod.REDACTED, "privateKey masked"
_secrets = mod._collect_secrets({"a": {"privateKey": "PRIVKEY_ABCDEFGHIJKLMN", "id": chosen["DE"]["uuid"]}})
_leak = "xray error near 'PRIVKEY_ABCDEFGHIJKLMN' and %s and bareToken_ABCDEFGHIJKLMNOP" % chosen["DE"]["uuid"]
_scrubbed = mod._scrub(_leak, _secrets)
assert "PRIVKEY_ABCDEFGHIJKLMN" not in _scrubbed, "known privateKey scrubbed from error text"
assert chosen["DE"]["uuid"] not in _scrubbed, "known uuid scrubbed from error text"
assert "bareToken_ABCDEFGHIJKLMNOP" not in _scrubbed, "unknown long token scrubbed by regex belt-and-suspenders"
assert len(mod._scrub("fail " * 400, set(), cap=400)) == 400, "error log is length-capped"
print("OK: redaction hardening (privateKey + scrub + cap)")


# --- BLOCKER regression: the two reconcilers must place the hexo block on the SAME side
#     of dns-internal, or they flap-restart afrows-xray forever. Fixed-point on both sides.
eg_spec = importlib.util.spec_from_file_location(
    "egress_mode_sync", str(HERE.parents[1] / "scripts" / "afrows-egress-mode-sync.py")
    if (HERE.parents[1] / "scripts" / "afrows-egress-mode-sync.py").exists()
    else str(HERE.parent / "afrows-egress-mode-sync.py")
)
eg = importlib.util.module_from_spec(eg_spec)
eg_spec.loader.exec_module(eg)

# A hexo-converged config (api, hexo..., client catch-all), produced by hexo build_desired.
conv_outs, _cf, _src = mod.resolve_outbounds(fronts, COUNTRIES, PORTS, {})
conv_cfg = json.loads(json.dumps(BASE_CFG))
co, ci, cr, _n, _c = mod.build_desired(conv_cfg, conv_outs, PORTS, COUNTRIES)

# Now egress rebuilds routing from scratch with dns-internal (+ chain-probe) present,
# carrying the hexo rules forward via hexo_rules_of.
system_rules = [{"inboundTag": ["chain-probe"], "outboundTag": "via-germany"},
                {"inboundTag": ["dns-internal"], "outboundTag": "proxy"}]
egress_rules = eg.desired_rules(
    "smart", ["afrows-in"], [], [], "proxy", [], "via-village", system_rules, None, None, eg.hexo_rules_of(cr))

# The hexo block must sit immediately after `api` and BEFORE dns-internal on the egress side.
hexo_positions = [i for i, r in enumerate(egress_rules) if str(r.get("outboundTag", "")).startswith("hexo-")]
dns_pos = next(i for i, r in enumerate(egress_rules) if r.get("inboundTag") == ["dns-internal"])
assert egress_rules[0].get("outboundTag") == "api"
assert hexo_positions and hexo_positions[0] == 1, "hexo block starts right after api on the egress side"
assert max(hexo_positions) < dns_pos, "hexo block precedes dns-internal on the egress side (same as hexo side)"

# Forward fixed point: egress's layout is a no-op for hexo build_desired (no flap).
cfg_from_egress = {"inbounds": ci, "outbounds": co, "routing": {"rules": egress_rules}}
o4, i4, r4, _note4, changed4 = mod.build_desired(cfg_from_egress, conv_outs, PORTS, COUNTRIES)
assert changed4 is False, "hexo build_desired sees egress's rule order as already converged (no restart)"
assert r4 == egress_rules, "hexo build_desired leaves egress's rules byte-identical"

# Reverse fixed point: the hexo rules egress extracts are identical to what hexo wrote.
assert eg.hexo_rules_of(egress_rules) == eg.hexo_rules_of(cr), "hexo rules survive an egress rebuild unchanged"
print("OK: cross-reconciler fixed point (no afrows-xray flap-restart)")


# --- resolved-countries state file (Finding 6: no dead links) ------------------------
# Reuse the converged config from the fixed-point block: it has inbounds for the resolved
# countries (DE,NL,SE,TR,US,AM) and NO inbound/outbound for RO (unresolved, no last-good).
resolved = mod.resolved_countries(ci, co, COUNTRIES)
assert resolved == ["am", "de", "nl", "se", "tr", "us"], ("exactly the live-listener countries, sorted+lowercased", resolved)
assert "ro" not in resolved, "RO excluded (no inbound and no outbound this shard)"

# only a country with BOTH inbound and outbound is listed
assert mod.resolved_countries([{"tag": "hexo-in-de"}], [{"tag": "hexo-de"}], ["DE", "NL"]) == ["de"]
assert mod.resolved_countries([{"tag": "hexo-in-de"}], [], ["DE"]) == [], "inbound without outbound -> excluded"
assert mod.resolved_countries([], [{"tag": "hexo-de"}], ["DE"]) == [], "outbound without inbound -> excluded"

tmpdir = tempfile.mkdtemp()
rpath = os.path.join(tmpdir, "nested", "hexo-resolved.json")  # parent dir does not exist yet
mod.write_resolved(resolved, rpath)
assert os.path.exists(rpath), "parent dir created and file written"
assert not os.path.exists(rpath + ".tmp"), "atomic: no temp file left behind"
doc = json.loads(Path(rpath).read_text(encoding="utf-8"))  # valid JSON
assert doc["countries"] == ["am", "de", "nl", "se", "tr", "us"]
assert isinstance(doc["updated_at"], int) and doc["updated_at"] > 0
if hasattr(os, "stat"):
    assert (os.stat(rpath).st_mode & 0o777) in (0o644, 0o666), "mode 0644 requested (Windows may widen)"
# no secrets: the only values are 2-letter codes + an int timestamp
assert all(len(c) == 2 for c in doc["countries"])
print("OK: resolved-countries state file (atomic, both inbound+outbound, RO excluded)")


print("\nALL HEXO-EGRESS TESTS PASSED")
