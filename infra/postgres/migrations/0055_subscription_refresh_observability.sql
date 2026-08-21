-- Egress redesign Phase P1 — subscription-refresh observability.
--
-- Additive columns on outbound_subscriptions to make refresh health causal and
-- durable (answering "why is refresh failing / why last-known-good / how long
-- stale / rejected how many times"). Purely observability: the P0 accept/reject
-- decision and the child-set contents are unchanged.
--
--   consecutive_failures : count of back-to-back failed refreshes; reset to 0 on
--                          any success. Drives the consecutive-failure alert.
--   last_success_at      : timestamp of the last import/refresh that committed a
--                          set. Surfaced as "seconds since last success"; a derived
--                          stale alert is deferred (SUBSCRIPTION_REFRESH_STALE is a
--                          reserved reason code, not yet produced — see ADR-0008).
--   last_failure_reason  : typed reason code for the most recent failure (see
--                          subscription-refresh-reason.ts). last_error keeps the
--                          human message (backward compatible).

ALTER TABLE outbound_subscriptions
  ADD COLUMN IF NOT EXISTS consecutive_failures integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_success_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_failure_reason text;
