#!/usr/bin/env python3
"""Egress P2 (Option A) — the explicit, pure egress-transition state machine.

Today the egress "state" is an implicit outbound tag (via-germany / proxy / direct /
via-village) held in per-lane .state files, and hysteresis is a single symmetric
2-strike counter. This module makes the transition logic EXPLICIT, single-sourced,
and best-practice:

  * priority is an explicit ordered list (most-preferred first) per lane;
  * hysteresis is ASYMMETRIC — fail OUT of a failing higher-priority path quickly
    (k_out), fail BACK to a recovered one slowly (k_back), so a flapping upstream
    can't yank live traffic back and forth;
  * a CIRCUIT BREAKER watches the recent transition rate; when a lane is flapping it
    becomes stickier (raises the strike requirement) and raises a `tripped` flag for
    alerting — it damps oscillation instead of pinning a possibly-bad path;
  * every switch is appended to a bounded TRANSITION LOG (from -> to at seq) so
    "why am I on X right now / how often has it flipped" is answerable.

PURE and DETERMINISTIC: `decide()` is a function of (want, state, config) only — no
wall-clock, no I/O, no randomness. `seq` (a monotonic per-lane counter stored in the
state) is the time proxy, so the breaker window is expressed in decisions, matching
the 1/minute applier cadence. It does NOT change the priority ORDER (that is P4); it
only changes the timing/stability of transitions along the existing ladder.
"""


# Default tuning (overridable by the caller from env). k_out preserves today's
# 2-strike fail-OUT exactly; only fail-BACK is made slower (the best-practice change).
DEFAULTS = {
    "k_out": 2,           # strikes to leave a higher-priority path that went unhealthy
    "k_back": 3,          # strikes to return to a recovered higher-priority path (slower)
    "breaker_window": 10, # how many recent decisions define "recent" (~10 min @ 1/min)
    "breaker_max": 4,     # transitions within the window that mark the lane as flapping
    "breaker_extra": 2,   # extra strikes required while flapping (damping)
}


def rank(order, tag):
    """Priority rank of a tag: 0 = most preferred; unknown tags rank last."""
    return order.index(tag) if tag in order else len(order)


def _state(applied, pending, count, seq, transitions, tripped):
    return {
        "applied": applied,
        "pending": pending,
        "count": count,
        "seq": seq,
        "transitions": list(transitions),
        "breaker": {"tripped": bool(tripped), "recent": len(transitions)},
    }


def decide(want, state, order, cfg=None):
    """Pure asymmetric-hysteresis + circuit-breaker transition.

    want   : the health-ordered desired tag this cycle.
    state  : prior lane state (dict; {} on cold start).
    order  : priority list, most-preferred first (e.g. ['via-germany','proxy','direct']).
    cfg    : optional overrides of DEFAULTS.
    Returns (applied_tag, new_state).
    """
    c = {**DEFAULTS, **(cfg or {})}
    seq = int(state.get("seq", 0)) + 1
    applied = state.get("applied", want)

    # Prune the transition log to the breaker window, measured in decisions (seq).
    transitions = [t for t in state.get("transitions", []) if t > seq - c["breaker_window"]]
    flapping = len(transitions) >= c["breaker_max"]

    # Already on the desired tag: nothing to switch; clear any pending streak.
    if want == applied:
        return applied, _state(applied, want, 0, seq, transitions, flapping)

    # Asymmetric threshold: recovery (want more preferred than applied) is deliberately
    # slower than degradation. The breaker adds stickiness while the lane is flapping.
    recovering = rank(order, want) < rank(order, applied)
    need = c["k_back"] if recovering else c["k_out"]
    if flapping:
        need += c["breaker_extra"]

    cnt = (int(state.get("count", 0)) + 1) if state.get("pending") == want else 1
    if cnt >= need:
        transitions = transitions + [seq]  # record the switch
        return want, _state(want, want, 0, seq, transitions, len(transitions) >= c["breaker_max"])
    return applied, _state(applied, want, cnt, seq, transitions, flapping)
