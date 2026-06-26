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

# Recovery: village back -> fail back to via-germany after 2 strikes.
applied, st = ch(True, False, {"applied": "proxy"})
assert applied == "proxy", applied
applied, st = ch(True, False, st)
assert applied == "via-germany", ("failback", applied)

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
