#!/usr/bin/env python3
"""Egress P3 — tests for the uplink pool stability scoring (score_relay).

Deterministic, assert-based. Pins: success_rate dominance, recency weighting
(recovering > degrading), variance penalty (steady > equal-mean flapper), the
unchanged eligibility gates, and stale/cold-start behavior handled by the caller.
"""
import importlib.util
from pathlib import Path

spec = importlib.util.spec_from_file_location(
    "uplink_pool_sync", str(Path(__file__).with_name("afrows-uplink-pool-sync.py"))
)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
score = m.score_relay
MIN = m.MIN_MBPS       # default 3
K = m.HYSTERESIS_K     # default 2
S = m.MIN_SUCCESS      # default 0.5


def sc(samples):
    return score(samples)  # (eligible, score, success)


# --- empty / trivial ------------------------------------------------------------
assert sc([]) == (False, 0.0, 0.0)
print("OK: empty -> ineligible, zero score")

# --- success_rate leads within the realistic relay band: reliable-low beats flaky-high.
# (Dominance holds for throughput < ~1000/HISTORY_N Mbps; these are well within it.)
steady_low = sc([15, 15, 15, 15])       # success 1.0
flaky_high = sc([30, 0, 30, 0])         # success 0.5, high throughput when up
assert steady_low[1] > flaky_high[1], ("reliability leads throughput in-band", steady_low, flaky_high)
print("OK: success_rate leads throughput in the realistic band (reliable-low > flaky-high)")

# --- VARIANCE penalty: steady beats an equal-mean flapper (both 100% passing) ----
steady = sc([17, 17, 17, 17])           # success 1.0, mean 17, stability ~1
flapper = sc([30, 5, 30, 5])            # success 1.0, mean 17.5, high variance
assert steady[1] > flapper[1], ("steady beats equal-mean flapper", steady, flapper)
print("OK: variance penalty — steady 17 outranks flapping avg-17.5")

# --- higher STEADY throughput still wins (penalty doesn't invert real quality) ---
steady_hi = sc([30, 30, 30, 30])
steady_mid = sc([17, 17, 17, 17])
assert steady_hi[1] > steady_mid[1], ("steady-30 > steady-17", steady_hi, steady_mid)
print("OK: among steady relays, higher throughput still wins")

# --- RECENCY weighting: a recovering relay outranks a recently-degrading one -----
# Both have unweighted success 0.5, so both gate the same; recency breaks the tie.
recovering = sc([0, 0, 30, 30])         # recent samples healthy
degrading = sc([30, 30, 0, 0])          # recent samples failing
assert recovering[1] > degrading[1], ("recovering > degrading at equal success", recovering, degrading)
print("OK: recency weighting — recovering relay scores above a degrading one")

# --- ELIGIBILITY gates unchanged ------------------------------------------------
# recent-K healthy required: last K must all be >= MIN
assert sc([30, 30, 0, 0])[0] is False, "last-K failing -> ineligible"
assert sc([0, 0, 30, 30])[0] is True, "last-K healthy + success>=MIN_SUCCESS -> eligible"
# MIN_SUCCESS floor: mostly-failing is ineligible even if it ends healthy
mostly_fail = sc([0, 0, 0, 0, 0, 3, 3])  # success 2/7 < 0.5, last-K healthy
assert mostly_fail[0] is False, ("below MIN_SUCCESS -> ineligible", mostly_fail)
print("OK: eligibility gates unchanged (last-K healthy + MIN_SUCCESS floor)")

# --- determinism ----------------------------------------------------------------
assert sc([10, 20, 15, 12]) == sc([10, 20, 15, 12]), "deterministic"
print("OK: deterministic")

print("\nALL uplink pool score tests passed")

# --- egress binding: build_outbound pins relays to the village tunnel (fix for the
# dead pool where relays exited the filtered eth0 default route with 0 throughput). ---
ob = m.build_outbound("relay-1", {"address": "188.114.97.2", "port": 2087, "uuid": "x", "network": "xhttp", "security": "tls"})
assert ob["streamSettings"].get("sockopt", {}).get("interface") == "wg-village-de", ("relay must bind egress to the village tunnel", ob["streamSettings"].get("sockopt"))
print("OK: build_outbound pins relay egress to the village tunnel (sockopt.interface)")
