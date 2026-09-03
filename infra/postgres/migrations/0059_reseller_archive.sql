-- Soft delete (archive) for reseller (seller) accounts. Mirrors the customer
-- account soft-delete (migration 0051): Afrows never hard-deletes a seller, it
-- ARCHIVES so wallet/ledger history and the seller's customers stay intact and
-- the seller is recoverable. `archived_at` NULL = live; non-NULL = archived.
-- Access is cut by also forcing status = 'disabled' on archive (the reseller
-- session guard rejects any non-'active' status), so an archived seller can no
-- longer log in or create/manage customers or VLESS. Their existing customer
-- accounts are deliberately left untouched (they keep working, keep buying via
-- Telegram, and stay manageable by admins) — only the seller is archived.
ALTER TABLE reseller_accounts
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;
