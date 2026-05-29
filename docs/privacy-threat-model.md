# AfroGate Privacy Threat Model

## Overview

AfroGate handles operational data for internet access infrastructure. The product must improve stability without becoming a traffic-inspection or identity-surveillance system. Privacy protection is a product requirement because route quality, billing, and support data can reveal sensitive facts about users even when packet contents are never stored.

Primary privacy assets:

- Customer account metadata: display name, Telegram id/username, account status, notes, quota state, and paid-number hash presence.
- Client account data: client config labels, protocol type, quota/usage counters, route preference, and client access-token metadata.
- Billing and rewarded-ad data: payment orders, provider ids, package/price snapshots, allocation events, rewarded-ad grants, and provider callback metadata.
- Operational telemetry: server metrics, tunnel/interface health, outbound health checks, route-probe samples, alerts, and route decision events.
- Secrets and credentials: admin sessions, one-time plaintext agent/client tokens at issuance, stored agent/client token hashes, Telegram/PayPal secrets, server credentials, and protocol private keys.

AfroGate must not store user traffic content, user destination history, DNS query history from user traffic, per-user IP history for routing, decrypted server credentials in logs, or raw paid phone numbers in API responses or dashboard state.

## Threat Model, Trust Boundaries, and Assumptions

Privacy actors:

- VPN clients whose route and quota data must stay client-scoped.
- Admin/seller users who manage accounts and packages but should not see raw paid numbers or secrets.
- Support users who may need safe troubleshooting data but not credentials or private routing keys.
- Operators with deployment/database access who must be treated as highly privileged.
- Third-party providers such as PayPal, Telegram, and future ad-network/payment providers.

Privacy trust boundaries:

- Client app to backend: `/api/client/*` may show only the authenticated client's own profile, quota, rewarded-ad status, and route preferences.
- Admin dashboard to backend: `/api/admin/*` can manage operations but must keep paid numbers write-only and secrets metadata-only.
- Agent to backend: metrics and route probes are infrastructure signals, not user browsing data. Probe targets must be configured synthetic endpoints or local tunnel telemetry.
- Backend to providers: Telegram/PayPal/ad-network calls must send only required provider data and must not include internal secrets, route decisions, or user traffic details.
- Database to exports/backups: backups, logs, and future reports must not expand access to sensitive metadata beyond production access controls.

Assumptions:

- Stable routing can be achieved with synthetic probes, coarse country choices, tunnel telemetry, and aggregate usage counters.
- Exact traffic destinations, packet payloads, and user browsing behavior are unnecessary for the product and must remain out of scope.
- Some identity metadata is needed for billing/support, but it must be minimized and role-scoped.

## Attack Surface, Mitigations, and Privacy Stories

Privacy-sensitive inputs and stores:

- Customer notes and display names may accidentally contain personal data; support/admin UI should discourage storing secrets or unnecessary identity details.
- Telegram id/username links are useful for bot support, but bot replies must reveal only safe account/quota summaries to the linked user.
- Paid phone numbers are accepted only as write-only input and stored as HMAC hashes with `AFROGATE_IDENTITY_HASH_KEY` or the deployment secrets key.
- Usage accounting stores byte counters and idempotency keys, not packet captures, URLs, or user destinations.
- Client country detection stores only coarse ISO country code, source, and timestamp; no client IP history is needed.
- Future per-app VPN split tunneling should keep app selection local to the native client or store only explicit client-scoped preference metadata; it must not collect installed-app inventories, traffic contents, or destination history.
- Route analytics use synthetic probe metadata such as route group, operator, outbound, protocol, score profile, hour, and day; they must not derive from user destinations.
- Rewarded-ad claims and provider metadata must stay idempotent and minimal, with provider secrets outside public config.

Existing mitigations:

- Admin and VPN-client UX/API boundaries are separate.
- Client tokens are scoped to one client config and stored only as hashes.
- Per-client subscription credentials are encrypted, scoped to one client config and outbound, and rendered only to the authenticated client that owns the credential.
- Dashboard customer-limit management avoids raw paid-number capture/display.
- Telegram command replies do not expose paid numbers, tokens, server details, or private route data.
- Route decision previews and switch events are advisory/assignment-only and record non-secret reason/context data.
- Secret vault responses return references and readiness metadata only.
- Repository secret scans and dependency audits run in CI.

Realistic privacy failure stories:

- An admin/support user stores raw personal data or credentials in notes, payment metadata, or public provider config.
- A dashboard page accidentally exposes all customer quotas or Telegram identities to a lower-privilege role.
- Route analytics gradually expand from synthetic probes into user destination or DNS history.
- Logs capture tokens, provider headers, webhook payloads, decrypted secrets, or raw paid numbers.
- Provider integrations send more identity or route data than required.
- Backups or exports become broad data dumps without encryption, retention, or role checks.

Out-of-scope or rejected product paths:

- DPI, packet capture, browsing history, per-user DNS logging, and traffic-content classification are not acceptable routing inputs.
- GPU-assisted analysis of user traffic is not an AfroGate privacy or performance strategy.
- Automatic mid-session route movement based on inferred application traffic is out of scope until explicit, privacy-safe, session-safe controls exist.

## Severity Calibration

Critical:

- Storing or exposing user traffic content, destination history, raw paid phone numbers, decrypted credentials, private keys, admin session tokens, or plaintext client tokens.
- A role/auth bug that lets one VPN client read another client's profile, quota, route preference, or rewarded-ad data.
- A provider integration or export that sends internal secrets, traffic destinations, or bulk customer identity data to a third party.

High:

- Lower-privilege admin/support access to broad customer identity, payment, quota, or route data outside assigned duties.
- Logs or audit snapshots that include webhook secrets, payment credentials, server credentials, protocol keys, raw phone numbers, or provider private metadata.
- Route intelligence that stores client IP history, real user destinations, or traffic-derived hostnames.
- Unencrypted backups containing customer identity, payments, token hashes, route decisions, or secret references.

Medium:

- Excessive retention of high-resolution metrics, route decisions, alert history, payment metadata, or rewarded-ad events beyond operational need.
- Telegram bot responses that reveal account existence or quota details without a strong account link.
- Admin notes, metadata, or provider config fields accepting unnecessary personal data without guidance or validation.
- Reports that aggregate small groups so individual customer behavior can be inferred.

Low:

- Aggregate server/outbound health, synthetic probe quality, or package pricing reports that cannot identify a person or client.
- Dashboard layout issues that reveal no additional data and do not weaken access controls.
- Local-only development sample data that contains no real identifiers or secrets.

## Required Privacy Controls

- Keep all future route intelligence based on synthetic targets, managed outbound metadata, coarse country preferences, and local tunnel health.
- Keep paid-number handling write-only and HMAC-only.
- Keep dashboard/admin and VPN-client APIs separate.
- Keep future per-app VPN rules client-scoped and privacy-safe; the control plane should not learn which non-selected apps a user has installed.
- Keep provider secrets and webhook credentials in deployment/encrypted secret storage.
- Keep audit snapshots secret-safe and compact.
- Add retention policies before enterprise reporting/export features.
- Add privacy review before expanding current controlled panel import into live panel sync/export, ad-network SDK, backup/restore UI, reports, or live data-plane route apply features.
