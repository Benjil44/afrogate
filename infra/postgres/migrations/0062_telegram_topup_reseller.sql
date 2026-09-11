-- Customer -> Seller card-to-card payment (Phase 4 of the seller-role plan).
-- Stamped at request-creation time from the buyer's customer_accounts.reseller_
-- account_id: NULL keeps the existing superadmin-approval path (dashboard);
-- non-NULL routes the request to that seller's Telegram bot chat for
-- approve/reject, settled via a reseller wallet debit (createResellerPackageSaleForReseller)
-- instead of a free superadmin-granted quota credit.
ALTER TABLE telegram_topup_requests
  ADD COLUMN IF NOT EXISTS reseller_account_id uuid REFERENCES reseller_accounts(id);

-- The seller's "pending requests" queue in the bot.
CREATE INDEX IF NOT EXISTS telegram_topup_requests_reseller_status_idx
  ON telegram_topup_requests (reseller_account_id, status, created_at DESC)
  WHERE reseller_account_id IS NOT NULL;
