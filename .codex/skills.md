# AfroGate Skills and Workflows

## Required Agent Skills

### Product Analysis

- Convert operational notes into clear requirements.
- Keep MVP scope separate from enterprise roadmap.
- Re-check `.codex/memory.md` before changing assumptions.

### Infrastructure Monitoring

- Model server health: CPU, RAM, disk, network throughput, service status.
- Model tunnel health: ping, jitter, packet loss, rx/tx, up/down, health score.
- Treat storage below 10% as a critical alert.

### Network Routing

- Build route scoring with hysteresis and cooldown.
- Support auto route and route lock.
- Record route decision reasons for audit and debugging.

### Privacy and Safety

- Minimize user data collection.
- Store Telegram identity and paid number only when needed.
- Avoid long-term IP history unless justified by security needs and retention rules.
- Encrypt sensitive fields and backups.
- Keep admin-user management privacy-safe: never commit admin passwords, runtime admin-user files, or real account data; store only password hashes in the configured runtime store.
- Preserve the immutable `superadmin` account rule when building role, user, or settings workflows.

### Telegram Operations

- Send admin alerts through Telegram.
- Let users check volume, subscription state, and charge status through Telegram bot.
- Use webhook secrets and do not commit bot tokens.

### Implementation Hygiene

- Add tests around shared logic, billing math, route scoring, and alert thresholds.
- Update docs as architecture stabilizes.
- Keep `.env.example` current once apps are scaffolded.
- Avoid committing generated files, logs, local databases, or backups.
- Use the local `afrogate-versioning` plugin/skill after meaningful implementation sections so versions, `CHANGELOG.md`, and sidebar display stay aligned.

## Future App Skills

- Dashboard frontend.
- Backend API.
- Server agent.
- Telegram bot.
- Billing and usage accounting.
- Backup and restore.
- Marzban/X-UI integration.
