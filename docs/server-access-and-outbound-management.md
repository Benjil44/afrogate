# Server Access and Outbound Management

AfroGate needs server management, traffic visibility, route control, and outbound failover without turning the panel into a vault of reusable root passwords. This document defines the safer shape for the UI and backend.

## Best Practice Summary

- Use a server agent for normal monitoring.
- Use SSH only for bootstrap, repair, and explicit admin actions.
- Prefer SSH keys and a dedicated `afrogate` sudo user over reusable root passwords.
- If a provider only gives a root password, use it once during bootstrap, then install keys, create the dedicated user, and stop storing the root password.
- Never show saved secrets back to the admin. Allow replace, test, rotate, and revoke.
- Every sensitive action must create an audit log.
- Outbound routes must be ordered, health checked, and failed over with cooldown/hysteresis, not switched on every small ping spike.

## Server Edit Flow

Each server card can have an `Edit` button. The edit screen should be split into tabs:

- Overview: name, country, role, status, tags, last seen.
- Access: host/address, SSH port, access method, connection test, bootstrap action.
- Monitoring: CPU/RAM/disk/network/tunnel metrics and health interval.
- Interfaces: `ether1`, `ether2`, `ether5`, operators, linked WireGuard tunnel.
- Outbounds: ordered outbound/gateway configs available from this server.
- Routing: route group, auto route, route lock support, failover settings.
- Audit: who changed what and when.

## Access Model

### Bootstrap Credential

This is only for first connection or emergency repair.

Allowed methods:

- temporary root password.
- temporary root SSH key.
- existing admin user SSH key.

Rules:

- Mark as temporary.
- Encrypt at rest if it must be saved before bootstrap.
- Delete or disable after agent/key installation.
- Do not display the secret again after save.
- Require Owner/Admin permission and later MFA.

### Managed Credential

This is the normal long-term access path.

Recommended shape:

```text
user: afrogate
auth: SSH key
sudo: restricted commands first, broader sudo only if explicitly enabled
root login: disabled or key-only emergency path
password auth: disabled when possible
```

OpenSSH supports controls such as `PermitRootLogin`, `PasswordAuthentication`, and `AuthorizedKeysFile`; AfroGate should generate hardening guidance around these options instead of encouraging permanent root-password use.

## Monitoring Data Collection

Normal traffic and health visibility should come from the agent, not repeated SSH commands.

Agent metrics:

- CPU/RAM/disk.
- input/output bytes per interface.
- total inbound/outbound bps.
- WireGuard peer transfer and handshake state.
- ping/jitter/packet loss to configured targets.
- service health.
- control-plane egress health.

SSH can still be used for:

- installing/updating the agent.
- emergency service restart.
- one-time configuration sync.
- reading diagnostic logs with explicit admin action.

MVP should avoid a free-form terminal. Later enterprise terminal access should require MFA, session recording, command audit, and role restrictions.

## Outbound Management

An outbound is a control or data-plane path that can be used for Telegram/API access, route failover, or user traffic depending on its type.

Fields:

- name.
- type: `wireguard`, `vless-local-proxy`, `http-proxy`, `socks-proxy`, `direct`, `custom`.
- server id.
- route group.
- priority.
- enabled.
- health check interval.
- fail threshold.
- recovery threshold.
- cooldown seconds.
- max users or weight.
- secret reference, not raw secret.

UI actions:

- add outbound.
- edit outbound.
- delete/disable outbound.
- move up/down.
- test health now.
- mark as maintenance.
- view failover history.

Priority should be stored as an integer or decimal rank so moving up/down is cheap and auditable.

## Failover Policy

Do not fail over after one bad sample. Use thresholds:

```text
candidate is unhealthy if:
- N consecutive failed checks, or
- packet loss above threshold for duration, or
- ping/jitter above threshold for duration, or
- tunnel down / no recent handshake, or
- server health score below minimum
```

Do not fail back immediately. Use:

- recovery threshold: e.g. 3 healthy checks.
- cooldown: e.g. 60-300 seconds.
- hysteresis: new route must be meaningfully better.
- route lock: locked users stay on their route and only receive alerts.

## Health Check Intervals

Recommended defaults:

- Latest dashboard cards: 5-10 seconds.
- Normal route health: 10-15 seconds.
- Outbound control-plane health: 30-60 seconds.
- Deep checks: 1-5 minutes.
- 1-second checks: diagnostics only, short-lived, for an active incident.

Permanent 1-second checks can waste CPU/network on small VPS machines and can cause noisy route flapping. If 1-second mode is added, it should auto-expire and require admin permission.

## Data Model Direction

Future tables:

- `server_access_profiles`
- `server_credentials`
- `outbounds`
- `outbound_health_checks`
- `route_groups`
- `route_failover_events`
- `server_commands`

Credentials should store:

- encrypted secret material or external secret reference.
- secret type.
- last rotated time.
- last used time.
- owner.
- revoked time.

They should not store:

- plaintext passwords.
- user traffic content.
- unrestricted shell history without explicit enterprise audit mode.

## Security References

- OWASP recommends centralizing, standardizing, access-controlling, auditing, and rotating secrets: https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html
- OpenSSH `sshd_config` documents `PermitRootLogin`, `PasswordAuthentication`, and authorized keys behavior: https://manpages.debian.org/bookworm/openssh-server/sshd_config.5.en.html
