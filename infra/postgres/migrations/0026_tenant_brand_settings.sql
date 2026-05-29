CREATE TABLE IF NOT EXISTS tenant_brand_settings (
  setting_key text PRIMARY KEY,
  tenant_slug text NOT NULL DEFAULT 'default',
  display_name text NOT NULL DEFAULT 'AfroGate',
  legal_name text,
  support_email text,
  support_telegram text,
  support_url text,
  logo_url text,
  dashboard_title text NOT NULL DEFAULT 'AfroGate',
  client_app_title text NOT NULL DEFAULT 'AfroGate Client',
  primary_color text NOT NULL DEFAULT '#176B87',
  accent_color text NOT NULL DEFAULT '#0E9F8F',
  public_branding_enabled boolean NOT NULL DEFAULT true,
  client_support_message text,
  updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenant_brand_settings_slug_check
    CHECK (tenant_slug ~ '^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$' OR tenant_slug = 'default'),
  CONSTRAINT tenant_brand_settings_primary_color_check
    CHECK (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  CONSTRAINT tenant_brand_settings_accent_color_check
    CHECK (accent_color ~ '^#[0-9A-Fa-f]{6}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS tenant_brand_settings_slug_idx
  ON tenant_brand_settings (tenant_slug);

INSERT INTO tenant_brand_settings (setting_key)
VALUES ('default')
ON CONFLICT (setting_key) DO NOTHING;
