-- Whether a managed MikroTik routes its CLIENTS through Afrows (egress on) or uses
-- its own local internet (egress off). The panel toggle flips the router-side
-- "afrows-egress" routing-mark rule on/off via REST and records the state here.
ALTER TABLE mikrotik_routers ADD COLUMN IF NOT EXISTS egress_enabled boolean NOT NULL DEFAULT false;
