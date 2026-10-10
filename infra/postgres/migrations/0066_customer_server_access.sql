-- Per-customer server access (0.118.0).
--
-- One flag per entry server a customer may use: Germany (de.afrows.com remote
-- exit), Iran/"Shatel" (the afrows-in inbound on the Afrows server,
-- app.afrows.com) and the USA (us.afrows.com remote exit). OFF hides that
-- server's link everywhere (dashboard, Telegram, /sub/<token>, client app) AND
-- removes the customer's configs from that server's xray inbound, so an old
-- copied link stops authenticating too. The API rejects turning all three off.
--
-- DEFAULT true keeps every existing customer exactly as before. ADD COLUMN IF NOT
-- EXISTS keeps this idempotent under the re-run-every-file migration runner.
ALTER TABLE customer_accounts ADD COLUMN IF NOT EXISTS access_germany boolean NOT NULL DEFAULT true;
ALTER TABLE customer_accounts ADD COLUMN IF NOT EXISTS access_iran boolean NOT NULL DEFAULT true;
ALTER TABLE customer_accounts ADD COLUMN IF NOT EXISTS access_usa boolean NOT NULL DEFAULT true;
