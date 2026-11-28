-- 0072_monthly_catalog_two_plans.sql
-- Rebase the sellable Telegram catalog to exactly TWO monthly plans (owner
-- decision 2026-11-28):
--   • 50 GB  — 400,000 Toman
--   • 100 GB — 700,000 Toman
-- Both are MONTHLY (duration_days = 30): the quota expires 30 days after it is
-- credited and does NOT carry over — that is the existing monthly-period
-- behaviour, this migration only seeds the catalog rows that drive it.
--
-- Bytes are DECIMAL (1 GB = 1e9), matching billing + formatDataSize.
-- Existing active packages are ARCHIVED (not deleted) so historical
-- topup_requests keep their volume_package_id FK intact.
--
-- FIRST-RUN GUARD: the infra runner re-applies EVERY .sql on every deploy (no
-- ledger). The one-time "archive everything else" step must therefore run only
-- the first time, or it would fight any package the owner later adds from the
-- dashboard. We gate on our own marker rows (created_by = 'migration-0072'):
-- once they exist, the whole block is skipped and catalog management is back in
-- the owner's hands.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM volume_packages WHERE created_by = 'migration-0072') THEN
    -- 1) Retire whatever is currently on sale.
    UPDATE volume_packages
       SET status = 'archived', updated_at = now()
     WHERE status = 'active';

    -- 2) Seed the two monthly plans (ON CONFLICT keeps re-seeds safe if a slug
    --    already existed from a manual create).
    INSERT INTO volume_packages
      (name, slug, volume_bytes, duration_days, price_per_gb, total_price, currency, status, sort_order, notes, created_by)
    VALUES
      ('اشتراک ماهانه ۵۰ گیگابایت',  'monthly-50gb',   50000000000, 30, 8000, 400000, 'toman', 'active', 10, 'Monthly 30-day plan (no carry-over)', 'migration-0072'),
      ('اشتراک ماهانه ۱۰۰ گیگابایت', 'monthly-100gb', 100000000000, 30, 7000, 700000, 'toman', 'active', 20, 'Monthly 30-day plan (no carry-over)', 'migration-0072')
    ON CONFLICT (slug) DO UPDATE SET
      name          = EXCLUDED.name,
      volume_bytes  = EXCLUDED.volume_bytes,
      duration_days = EXCLUDED.duration_days,
      price_per_gb  = EXCLUDED.price_per_gb,
      total_price   = EXCLUDED.total_price,
      currency      = EXCLUDED.currency,
      status        = 'active',
      sort_order    = EXCLUDED.sort_order,
      created_by    = 'migration-0072',
      updated_at    = now();
  END IF;
END $$;
