# رودمپ و بک‌لاگ AfroGate

## فاز 0: آماده‌سازی

- انتخاب stack نهایی backend و frontend.
- تعریف schema اولیه دیتابیس.
- تعریف i18n فارسی/انگلیسی.
- تعریف secrets و env config.
- آماده‌سازی بدون Docker برای شروع سریع local.
- آماده‌سازی Ubuntu deploy با systemd و Nginx.
- نگه داشتن Docker Compose به عنوان گزینه بعدی برای deploy تکرارپذیر.

## فاز 1: Monitoring MVP

### Backend

- API احراز هویت ادمین.
- CRUD سرورها.
- CRUD tunnel ها و interface ها.
- endpoint دریافت metrics از agent.
- ذخیره metrics کلیدی.
- protocol-aware route metrics schema for TCP/UDP/QUIC/DNS/WireGuard probe results.
- smart-route scoring service with speed profiles for low-speed stability and high-speed throughput.
- alert engine ساده.
- Telegram alert sender.
- audit log.

### Agent

- ثبت سرور در control plane.
- چرخش token هر agent از طریق endpoint محافظت‌شده و audited، با ذخیره فقط hash.
- ارسال CPU/RAM/disk.
- ارسال network counters.
- ارسال WireGuard status.
- اجرای ping/jitter/packet loss probe.
- اجرای lightweight TCP/UDP/QUIC/DNS route probes against configured synthetic targets.
- گزارش low-speed/high-speed route classification signals without inspecting user traffic.
- ارسال heartbeat.

### Dashboard

- صفحه overview.
- صفحه servers.
- صفحه tunnels.
- صفحه alerts.
- Incident timeline on the Alerts page from alert and route-decision events.
- صفحه settings.
- نمایش health score.
- نمایش storage زیر 10%.

## فاز 2: Usage و Billing

- مدل user با Telegram identity.
- مدل package حجمی.
- محاسبه مصرف GB.
- price per GB قابل تنظیم.
- نمایش remaining volume.
- اتصال Telegram bot برای مشاهده حجم و شارژ.
- Superadmin Settings Telegram bot setup now stores BotFather token/webhook secret encrypted and write-only, captures alert/admin chat IDs, and tests Telegram API connectivity through the shared outbound egress path.
- Future Telegram purchase fulfillment should send one client-scoped VLESS config and one private usage/status link after a Telegram purchase is verified and quota is allocated, without exposing admin data or server/provider secrets.
- ثبت paid number با privacy protection.
- Separate seller/admin UX from VPN client UX; mobile/client APIs now start with scoped profile/quota, route options, and route-preference actions under `/api/client/*`, with package/usage purchase flows remaining future work.
- Usage accounting now starts with idempotent `client_usage_events` rows that update account/client used-byte counters for remaining-volume reads.
- Expensive outbounds can now carry usage multipliers so a high-cost VPS route can charge quota at `2x`, `10x`, or higher while preserving raw and charged bytes in the ledger.
- Paid payment orders now allocate purchased volume through an idempotent `payment_order_allocations` ledger before customer quota changes.
- Payment provider adapters now cover PayPal verified checkout/capture/webhooks, generic card/local hosted checkout preparation, and bank-transfer/crypto payment-reference instructions. Non-PayPal generic adapters stay pending/manual until admin verification or a future provider-specific verified callback marks an order paid.
- Rewarded ads now include admin-managed reward/cap settings, a capped `rewarded_ad_grants` quota-credit ledger, a mobile client claim surface for MVP wiring, and a signed provider webhook path for production-style ad-network/server callbacks.
- The admin Usage/Billing dashboard now includes a customer limit manager for creating/updating customer accounts, shared account GB quota, per-client GB caps, quota scope, and account status without collecting raw paid numbers in the dashboard.

## فاز 3: Auto Route

- route assignment برای هر کاربر/کانفیگ.
- auto route toggle.
- route lock toggle.
- health-based route decision.
- protocol-aware route decision for TCP-heavy, UDP-heavy, QUIC, DNS-sensitive, low-speed, and high-speed profiles.
- cooldown/hysteresis برای جلوگیری از route flapping.
- نمایش reason انتخاب مسیر.
- Per-client route preferences and a separate mobile-first client app for automatic country detection, preferred exit country, explicit server/outbound choice, subscription refresh metadata, and secret-safe protocol config readiness without exposing admin controls.
- Future native client per-app VPN split tunneling so selected apps such as Instagram, Telegram, and WhatsApp can use AfroGate while other apps keep normal internet unless the client explicitly includes them.
- Route health score history now appears on the Routes page from compact hourly synthetic-probe summaries, so admins can review recent score, latency, jitter, and packet-loss history without inspecting user traffic or applying route changes.
- Route canary rollout status now appears on the Routes page through guarded `GET /api/admin/route-canary/status`, showing new-session canary readiness, rollback thresholds, session protection, and assignment-only/data-plane-disabled boundaries without moving traffic.

## فاز 4: Integration با سیستم فعلی

- خواندن users از Marzban/X-UI.
- sync مصرف حجم.
- عملیات شارژ volume از AfroGate به سیستم فعلی.
- import/export config.
- Encrypted per-client subscription config renderer exists for client-owned WireGuard, VLESS, L2TP, and IKEv2 material; panel import/provisioning still needs to feed it safely.
- Current implementation note: admins can now paste/export current-panel user/config payloads into the Billing page, preview them through guarded `POST /api/admin/current-panels/import-preview`, import sanitized non-duplicate configs through guarded `POST /api/admin/current-panels/import-configs`, reconcile later panel counters through guarded `POST /api/admin/current-panels/sync-usage`, locally charge AfroGate account volume through guarded `POST /api/admin/current-panels/charge-volume`, and export local AfroGate client config summaries through guarded `GET /api/admin/customer-accounts/:id/client-configs/export`. Import writes AfroGate client configs and idempotent baseline `panel_sync` usage events; usage sync records only positive idempotent `panel_sync` deltas for existing matched configs and never overwrites counters downward; local charge writes `quota_charge_events`, increases AfroGate quota, and reports that external-panel write was not executed; export excludes subscription credentials and secret-bearing config material. Live external-panel quota writes, scheduled external-panel sync, and external-panel-native config export remain future work.

## فاز 5: Enterprise Foundation

- role های Owner/Admin/Support با permission catalog و نمایش ماتریس RBAC در داشبورد.
- multi-server scaling.
- advanced audit.
- backup/restore UI.
- reports و data analysis.
- tenant/brand settings برای فروش enterprise.
- Current implementation note: default-tenant brand settings are now persisted in `tenant_brand_settings`, exposed through guarded `GET/PATCH /api/admin/tenant-branding`, and editable in the dashboard Settings page for public names, support contacts, logo URL, colors, and client support copy. Multi-tenant data isolation and per-tenant routing/billing ownership remain future enterprise work.

## تصمیم‌های باز

- ORM نهایی: Prisma یا Drizzle.
- روش realtime: polling اول یا WebSocket/SSE از ابتدا.
- ذخیره metrics: schema ساده PostgreSQL در MVP، TimescaleDB/partitioning در صورت رشد.
- میزان وابستگی اولیه به Marzban/X-UI.
- روش دقیق محاسبه مصرف per-user از data plane.

## پیشنهاد فنی اولیه

- Backend: NestJS/TypeScript.
- Frontend: React با Vite و Tailwind CSS برای UI عملیاتی و کم‌حاشیه.
- DB: PostgreSQL، قابل ارتقا به TimescaleDB.
- Cache/Queue: Redis وقتی alert/queue جدی شد؛ برای شروع optional.
- Agent: Go یا Python.
- Deploy: local-first بدون Docker؛ روی Ubuntu با systemd و Nginx؛ Docker Compose بعداً optional.

## اولویت اجرای بعدی

1. ساخت اسکفولد backend/frontend.
2. ساخت schema دیتابیس.
3. ساخت server agent ساده.
4. ارسال metrics نمونه از agent به API.
5. نمایش dashboard realtime.
6. اضافه کردن Telegram alerts.
