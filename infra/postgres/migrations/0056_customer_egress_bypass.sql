-- Egress P4 (Part A — control plane) — opt-in MikroTik-direct internet bypass.
--
-- Per-customer allow-list flag: when VLESS/foreign egress is down, ONLY customers
-- with this flag set may fall over to the MikroTik-direct internet (activation is
-- Part B, gated on the reachability probe). Default false = a customer is NOT on the
-- bypass list. Mirrors the existing per-customer egress_tier control. Additive.

ALTER TABLE customer_accounts
  ADD COLUMN IF NOT EXISTS egress_bypass_enabled boolean NOT NULL DEFAULT false;
