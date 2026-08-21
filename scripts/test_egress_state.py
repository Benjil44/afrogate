#!/usr/bin/env python3
"""Egress P2 — tests for the pure egress-transition state machine (egress_state.py).

Deterministic, assert-based (matches test_egress_mode_sync.py). Covers: asymmetric
hysteresis (fail-out fast / fail-back slow), the circuit-breaker damping + trip flag,
the transition log, and that the priority ORDER is never altered by the machine.
"""
import importlib.util
from pathlib import Path

# The state machine is inlined in the reconciler (self-contained single-file deploy),
# so load `decide`/`rank`/DEFAULTS from it — the same importlib pattern the sibling
# test uses. This also exercises that the reconciler module imports cleanly.
spec = importlib.util.spec_from_file_location(
    "egress_mode_sync", str(Path(__file__).with_name("afrows-egress-mode-sync.py"))
)
es = importlib.util.module_from_spec(spec)
spec.loader.exec_module(es)

ORDER = ["via-germany", "proxy", "direct"]  # most-preferred first


def run(seq_of_wants, order=ORDER, cfg=None, state=None):
    """Drive decide() over a sequence of desired tags; return the applied trail + final state."""
    st = state or {}
    trail = []
    for want in seq_of_wants:
        applied, st = es.decide(want, st, order, cfg)
        trail.append(applied)
    return trail, st


# --- fail-OUT is fast (k_out=2, unchanged from today) ---------------------------
trail, _ = run(["via-germany", "proxy", "proxy"])
assert trail == ["via-germany", "via-germany", "proxy"], ("fail-out on 2nd strike", trail)
print("OK: degradation fails out on k_out=2 (unchanged)")

# --- fail-BACK is slow (k_back=3, the best-practice change) ---------------------
# Start applied=proxy, then want via-germany (recovery, more preferred). Needs 3 strikes.
trail, _ = run(["via-germany", "via-germany", "via-germany"], state={"applied": "proxy"})
assert trail == ["proxy", "proxy", "via-germany"], ("fail-back only on k_back=3", trail)
print("OK: recovery fails back slowly on k_back=3 (asymmetric)")

# asymmetry is real: same 2 strikes flips OUT but NOT back
out2, _ = run(["proxy", "proxy"], state={"applied": "via-germany"})
back2, _ = run(["via-germany", "via-germany"], state={"applied": "proxy"})
assert out2[-1] == "proxy" and back2[-1] == "proxy", ("2 strikes: out yes, back no", out2, back2)
print("OK: asymmetric — 2 strikes degrades but does not recover")

# --- a flapping want streak that resets does not accumulate --------------------
# want alternates so pending never reaches the threshold -> stays put.
trail, _ = run(["proxy", "via-germany", "proxy", "via-germany"], state={"applied": "via-germany"})
assert trail == ["via-germany"] * 4, ("alternating never crosses threshold", trail)
print("OK: alternating desired never crosses hysteresis threshold")

# --- circuit breaker: repeated switching trips the flag ------------------------
# Force many switches by feeding sustained streaks past the threshold repeatedly.
cfg = {"k_out": 1, "k_back": 1, "breaker_window": 10, "breaker_max": 3, "breaker_extra": 5}
st = {}
tripped_seen = False
for want in ["proxy", "via-germany", "proxy", "via-germany", "proxy", "via-germany"]:
    applied, st = es.decide(want, st, ORDER, cfg)
    if st["breaker"]["tripped"]:
        tripped_seen = True
assert tripped_seen, "breaker should trip under sustained flapping"
print("OK: circuit breaker trips under sustained flapping")

# --- breaker damping: once flapping, switching requires MORE strikes -----------
# With k=1 nominal but breaker_extra=5, after tripping a single-strike switch is refused.
cfg = {"k_out": 1, "k_back": 1, "breaker_window": 20, "breaker_max": 2, "breaker_extra": 5}
st = {}
for want in ["proxy", "via-germany", "proxy"]:  # build up transitions to trip
    _, st = es.decide(want, st, ORDER, cfg)
assert st["breaker"]["tripped"], "precondition: tripped"
# now a single new desired should NOT immediately switch (needs 1 + 5 strikes)
applied, st2 = es.decide("direct", st, ORDER, cfg)
assert applied == st["applied"], ("damped: no single-strike switch while flapping", applied)
print("OK: breaker damps — switching gets stickier while flapping")

# --- transition log records switches with monotonic seq ------------------------
trail, st = run(["via-germany", "proxy", "proxy", "direct", "direct"])
assert st["transitions"] == sorted(st["transitions"]), "transition seqs monotonic"
assert len(st["transitions"]) >= 1, "at least one transition recorded"
assert st["seq"] == 5, ("seq counts every decision", st["seq"])
print("OK: transition log records switches; seq counts decisions")

# --- the machine never invents a tag outside the order / desired ---------------
trail, _ = run(["via-germany", "proxy", "direct"])
assert all(t in ORDER for t in trail), ("only tags from the ladder", trail)
print("OK: applied is always a real ladder tag; priority order untouched")

# --- cold start applies the first desired immediately --------------------------
applied, st = es.decide("proxy", {}, ORDER)
assert applied == "proxy" and st["seq"] == 1, ("cold start", applied, st)
print("OK: cold start applies the first desired tag")

print("\nALL egress_state tests passed")
