# AfroGate Memory

## Stable Product Facts

- Product name: AfroGate / Afrogate.
- First milestone: monitoring MVP.
- Long-term goal: branded enterprise panel that can be sold and improved beyond current third-party panels.
- Current users connect through Telegram bot.
- User-facing channels: Telegram first, app later.
- Admin wants dashboard first, with Telegram alerts.
- Product must be safe for people and human-rights conscious.
- Product should support Persian and English.
- Admin needs remote-friendly management while traveling.
- Backups are required, especially for monitoring and configuration data.

## Current Scale and Capacity

- Initial target: about 150 users.
- Future target: about 10000 users.
- Current total user outbound download is around 20 MB/s.
- Each user should have at least 1 MB/s when capacity allows.
- If the server is quiet, users should be able to use maximum available speed.
- Billing/usage model is volume-based: each GB costs configurable `X` toman.

## Infrastructure Facts

- Current Iran servers: 3.
- Server count should be unlimited in design.
- Iran server examples:
  - 6 cores / 6 GB RAM.
  - 4 cores / 4 GB RAM.
- Germany server:
  - 4 cores / 8 GB RAM.
  - 1 Gbps internet.
- Iran servers have 1 Gbps internet.
- Starlink observed speed test over wireless router:
  - download around 250 Mbps.
  - upload around 67 Mbps.
  - ping around 50 ms.

## Operator and Tunnel Facts

- `ether1`: Mobinnet.
- `ether2`: Irancell.
- `ether5`: Irancell.
- `ether1` connected to `wg1`.
- `ether2` connected to `wireguard2`.
- `ether5` connected to `wireguard3`.

## Quality Rules

- Packet loss should be very low.
- Ping best case is under 10 ms.
- Ping worst case is above 150 ms.
- High ping and jitter cause stuck requests, delayed volume allocation, and laggy speed.
- Alerting should happen within seconds.
- Auto route is desired, but route lock must be available for users/configs that should not move.

## Current Tooling Context

- Current production/operations use Marzban and panel Sanayi/X-UI style tooling.
- AfroGate should not simply depend on another app forever; integration can be used first, then replaced gradually.

## Durable Technical Preferences

- Separate control plane, monitoring plane, and data plane integration.
- Keep server agent lightweight.
- Store minimal personal data:
  - Telegram user id or username.
  - paid number only when needed.
- Avoid storing traffic content.
- Keep audit logs for sensitive admin actions.
- Encrypt secrets and backups.
- Enhancement work should be progressive: visibility first, reliability second, manual control third, automation fourth, enterprise readiness last.
- Current GitHub remote is `https://github.com/Benjil44/afrogate.git`.
- Repository has been pushed to GitHub and local `main` tracks `origin/main`.
- Repository can still be developed local-first; push when useful.
- Initial implementation direction: NestJS/TypeScript backend, React/Vite/Tailwind dashboard, PostgreSQL database, Python agent.
- Docker should not block the first local MVP. For Ubuntu, start with native services plus systemd/Nginx; Docker Compose can be added later.
- Current repository structure uses `apps/backend`, `apps/dashboard`, `apps/agent`, `packages/shared`, `infra/ubuntu`, and `infra/docker`.
- Clean code, typed boundaries, and no duplicated business logic are required.
- VPS efficiency is a core requirement because servers are expensive and low-resource.
- Security posture is default-deny: close public holes, require roles, protect metrics ingest, and keep database/cache/backend internals private.
- Stable internet is treated as a human-rights and safety goal, not a casual feature.
- Dashboard should stay static-first where possible to reduce server runtime exposure and resource use.
- Tailwind CSS is the dashboard styling direction for faster UI implementation and consistent operational components.
- Backend persistence uses PostgreSQL with Drizzle ORM runtime queries and hand-written SQL migrations to avoid vulnerable migration dependencies.
- Apps consume shared TypeScript contracts from built `packages/shared/dist` declarations; app prebuild/pretypecheck scripts build the shared package first.
- The dashboard polls the backend latest-metrics endpoint every 10 seconds and keeps a local sample fallback so the UI remains useful while the database/API is offline.
- Dashboard monitoring charts use Apache ECharts with direct modular imports, canvas rendering, and backend `/api/metrics/timeseries` data.
- Dashboard should serve a second-LCD/NOC display use case: one dense screen with clock, live status, health chart, servers, tunnels, alerts, outbounds, capacity, and control-plane status.
- Sidebar items must correspond to real pages; default page is the NOC dashboard, then Servers, Routes, and Alerts should become functional views before adding later pages.
- Agents collect local system resources for each installed system: CPU load, RAM usage, all detected storage volumes, network interface counters, and traffic rate deltas.
- Dashboard header shows local system resources first, then a divider, then connectivity/routing/traffic monitoring sections.
- Restricted Iran servers need a control-plane egress path for Telegram/API access; first implementation should use `AFROGATE_OUTBOUND_PROXY_URL` with a localhost HTTP proxy exposed by a local VLESS/sing-box/xray or gateway client.
- Server management should use temporary bootstrap credentials only when needed, then agent-first monitoring plus a dedicated SSH-key-based management user; do not build normal workflows around stored reusable root passwords.
- Outbound management should support ordered priorities, move up/down, health checks, failover thresholds, cooldowns, maintenance mode, and route locks.
- Server access and outbound failover database foundation exists in PostgreSQL migration `0002_server_access_outbounds.sql`; mutation APIs should wait for admin auth/roles.
- Backend has bootstrap admin bearer-token and role-guard foundations; future sensitive APIs should use `AdminTokenGuard` plus `Roles`.
- AfroGate uses one product version across root/workspace packages, shown in the dashboard sidebar and tracked in `VERSION` plus `CHANGELOG.md`.
- After every meaningful implementation section, agents should run the appropriate `npm run version:*` command, update `CHANGELOG.md`, run `npm run version:check`, and commit the bump with the implementation.
- Local versioning guidance lives in `docs/versioning-policy.md` and the `plugins/afrogate-versioning` Codex plugin.
- Dashboard traffic display separates download and upload values; current MVP mapping uses agent aggregate inbound/RX as download and outbound/TX as upload until route-aware attribution is added.
- Dashboard multilingual support uses `apps/dashboard/src/i18n.ts` for English/Persian strings, persists language in localStorage, and exposes the language icon toggle in the sidebar footer.
- New dashboard user-facing labels should be added to the typed translation object in the same commit as the UI change.
- Packet loss should be labeled `Packet loss` / `Loss` in English and `افت بسته` in Persian dashboard contexts.
- Persian mode should format generated numbers/times/units through the dashboard formatter: Persian digits, `٪`, `مگابایت/ث`, `میلی‌ثانیه`, localized thresholds, and local sample display labels.
- Persian dashboard typography is wired to local IRANSans assets under `apps/dashboard/public/assets/fonts/iransans/`; no CDN font source should be used, and proprietary font files should only be committed with a valid license.
- Persian typography must be applied both through CSS (`html[lang="fa"]` and `[lang="fa"]`) and ECharts options, because canvas chart text does not inherit DOM font styles reliably.
- Dashboard sidebar should not use horizontal scrolling; mobile nav wraps in a compact grid and desktop sidebar stays sticky with no sidebar scroll.
- Responsive checks should cover Dashboard, Servers, Routes, and Alerts in English and Persian at mobile, tablet, desktop, and second-LCD widths.
- Desktop dashboard shell uses a fixed-height viewport layout: document scrolling is disabled, the sidebar stays fixed at the left in English/LTR, and `main > section` owns vertical scrolling.
- The second-LCD dashboard target is 1920x1080 with no main-content overflow; keep NOC sections compact, use truncation for dense labels, and prefer panel-internal density over growing the page height.
- Sidebar alert navigation state is driven by computed alert rows: critical count wins and must render red; warning-only state renders amber; counts should use the current dashboard formatter.
- Dashboard UI/UX audits should check Dashboard, Servers, Routes, and Alerts in English and Persian at mobile, tablet, 1440x900, and 1920x1080; the second-LCD Dashboard target is `0px` main-content overflow and zero measured text-overflow cases.
- Dense dashboard rows should use compact icon indicators with accessible labels/tooltips for repeated CPU/RAM/disk/download/upload values, especially in Persian where localized units are longer.
- Desktop sidebar collapse state is stored in `afrogate.dashboard.sidebar`; expanded width is 248px, collapsed width is 80px, and mobile/tablet navigation should stay full-width even when the stored state is collapsed.
- Sidebar collapse/expand should remain an icon-only edge handle on the sidebar/content divider, not a text button row inside the sidebar header.
