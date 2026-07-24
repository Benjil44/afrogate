-- Quota unit corrected to DECIMAL GB (1 GB = 1,000,000,000 bytes); see
-- apps/backend/src/billing/quota-math.ts (BYTES_PER_GB). Existing rows were
-- written under the old binary basis (1 GB stored as 1024**3 = 1,073,741,824
-- bytes), which over-delivered every plan by ~7.4%.
--
-- GRANDFATHER decision (operator, 2026-07-24): live paid balances are NOT
-- shrunk — customer_accounts.quota_limit_bytes, client_configs.quota_limit_bytes,
-- per_client_limit_bytes, and used_bytes are deliberately left untouched, and
-- immutable payment/allocation/charge audit rows are never rewritten. Only the
-- sellable CATALOG (volume_packages) is rebased to decimal so future sales made
-- from these templates match their GB labels. Run-once (migration-tracked); the
-- exact integer-GB transform is old_bytes * 1e9 / 2^30 (e.g. 21,474,836,480 -> 20e9).
UPDATE volume_packages
SET volume_bytes = round(volume_bytes::numeric * 1000000000 / 1073741824)::bigint
WHERE volume_bytes > 0;
