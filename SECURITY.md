# Security Policy

AfroGate is built for privacy, safety, and resilient access. Stable internet is not a luxury feature; for many people it is part of work, speech, learning, safety, and the future.

## Security Principles

- Default deny: every network port, API route, role, and integration starts closed.
- Least privilege: users, operators, services, database accounts, and agents get only the minimum access they need.
- No secrets in git: tokens, private keys, paid numbers, server credentials, Telegram webhook secrets, PayPal/provider credentials, and production configs must never be committed.
- Human safety first: do not store traffic content, avoid unnecessary identity data, and keep retention short.
- Audit sensitive actions: login attempts, role changes, billing changes, route changes, agent registration, and failed authorization must be logged.
- Low-resource first: every feature must justify CPU, RAM, disk, and bandwidth usage.
- Secure routing: use explicit route ownership, health scoring, cooldowns, and locked routes where needed.

## Reporting

For now, report security issues privately to the project owner. Do not open public GitHub issues with exploitable details, tokens, server IPs, or real user data.

## Required Before Production

- Admin authentication, role-based authorization, and a visible permission matrix for production RBAC review.
- Per-agent credentials and the guarded agent token rotation endpoint.
- Firewall baseline applied on every VPS.
- Nginx rate limiting, backend API rate limiting for sensitive public endpoints, and request size limits.
- PostgreSQL bound to private/local interfaces only, with separate owner, migration, and runtime least-privilege roles.
- Encrypted backups and restore tests.
- Dependency audit and secret scan in CI.

## Threat Models

- Security threat model: [`docs/security-threat-model.md`](docs/security-threat-model.md)
- Privacy threat model: [`docs/privacy-threat-model.md`](docs/privacy-threat-model.md)
