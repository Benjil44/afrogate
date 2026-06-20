-- Customer-owned MikroTik gateways: explicit role + customer link + a per-peer
-- billing cursor so a gateway's Afrows WG usage is attributed (once) to its
-- customer's quota. village = transport (no customer); home/office = gateway.
ALTER TABLE mikrotik_routers
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'gateway',
  ADD COLUMN IF NOT EXISTS customer_account_id uuid
    REFERENCES customer_accounts(id) ON DELETE SET NULL;

UPDATE mikrotik_routers SET role = 'transport' WHERE kind = 'village';

DO $$ BEGIN
  ALTER TABLE mikrotik_routers
    ADD CONSTRAINT mikrotik_routers_role_chk CHECK (role IN ('transport','gateway'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS mikrotik_routers_customer_idx
  ON mikrotik_routers (customer_account_id);

-- Per-(router,peer) cursor of the last absolute WG counters already billed, so
-- repeated billing cycles only add the new delta.
CREATE TABLE IF NOT EXISTS mikrotik_gateway_usage_cursor (
  router_id  text NOT NULL REFERENCES mikrotik_routers(id) ON DELETE CASCADE,
  peer_key   text NOT NULL,
  last_rx    bigint NOT NULL DEFAULT 0,
  last_tx    bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (router_id, peer_key)
);
