CREATE TABLE IF NOT EXISTS billing_settings (
  setting_key text PRIMARY KEY,
  currency text NOT NULL DEFAULT 'toman',
  price_per_gb bigint NOT NULL DEFAULT 0,
  updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT billing_settings_price_nonnegative
    CHECK (price_per_gb >= 0)
);

INSERT INTO billing_settings (setting_key, currency, price_per_gb)
VALUES ('default', 'toman', 0)
ON CONFLICT (setting_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS volume_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  volume_bytes bigint NOT NULL,
  duration_days integer,
  price_per_gb bigint NOT NULL DEFAULT 0,
  total_price bigint NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'toman',
  status text NOT NULL DEFAULT 'active',
  sort_order integer NOT NULL DEFAULT 1000,
  notes text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT volume_packages_slug_unique UNIQUE (slug),
  CONSTRAINT volume_packages_status_check
    CHECK (status IN ('active', 'archived')),
  CONSTRAINT volume_packages_volume_positive
    CHECK (volume_bytes > 0),
  CONSTRAINT volume_packages_duration_positive
    CHECK (duration_days IS NULL OR duration_days > 0),
  CONSTRAINT volume_packages_price_nonnegative
    CHECK (price_per_gb >= 0),
  CONSTRAINT volume_packages_total_price_nonnegative
    CHECK (total_price >= 0)
);

CREATE INDEX IF NOT EXISTS volume_packages_status_sort_idx
  ON volume_packages (status, sort_order, created_at);

CREATE INDEX IF NOT EXISTS volume_packages_volume_idx
  ON volume_packages (volume_bytes);

CREATE TABLE IF NOT EXISTS payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  provider text NOT NULL DEFAULT 'manual',
  checkout_mode text NOT NULL DEFAULT 'manual',
  currency text NOT NULL DEFAULT 'toman',
  min_amount bigint,
  max_amount bigint,
  status text NOT NULL DEFAULT 'active',
  sort_order integer NOT NULL DEFAULT 1000,
  supports_auto_capture boolean NOT NULL DEFAULT false,
  public_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  instructions text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_methods_slug_unique UNIQUE (slug),
  CONSTRAINT payment_methods_status_check
    CHECK (status IN ('active', 'disabled')),
  CONSTRAINT payment_methods_checkout_mode_check
    CHECK (checkout_mode IN ('manual', 'hosted_redirect', 'external_link', 'provider_sdk')),
  CONSTRAINT payment_methods_amount_nonnegative
    CHECK (
      (min_amount IS NULL OR min_amount >= 0)
      AND (max_amount IS NULL OR max_amount >= 0)
      AND (min_amount IS NULL OR max_amount IS NULL OR max_amount >= min_amount)
    )
);

CREATE INDEX IF NOT EXISTS payment_methods_status_sort_idx
  ON payment_methods (status, sort_order, created_at);

CREATE INDEX IF NOT EXISTS payment_methods_provider_idx
  ON payment_methods (provider);
