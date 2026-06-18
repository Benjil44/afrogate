-- Operator-managed MikroTik routers (the "Microtiks" panel): village, home, future.
-- Connection info only; the REST password is stored as a SecretVaultService envelope
-- (AES-256-GCM, context 'mikrotik:'||id). Game/Normal mode = gaming_enabled; the
-- afrows-egress-mode-sync reconciler reads gaming_source_ip for every router with
-- gaming_enabled=true and routes those IPs out the village Starlink (via-village).
CREATE TABLE IF NOT EXISTS mikrotik_routers (
  id                text PRIMARY KEY,
  label             text NOT NULL,
  kind              text NOT NULL DEFAULT 'other',
  host              text NOT NULL,
  rest_port         integer NOT NULL DEFAULT 80,
  rest_user         text NOT NULL DEFAULT 'claude',
  rest_password_enc text,
  webfig_url        text,
  gaming_source_ip  text,
  gaming_enabled    boolean NOT NULL DEFAULT false,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mikrotik_routers_kind_chk CHECK (kind IN ('village', 'home', 'other')),
  CONSTRAINT mikrotik_routers_port_chk CHECK (rest_port BETWEEN 1 AND 65535)
);
