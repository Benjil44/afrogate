# معماری فنی پیشنهادی AfroGate MVP

## خلاصه

معماری MVP باید سریع قابل اجرا باشد، اما طوری طراحی شود که بعداً به پنل enterprise تبدیل شود. پیشنهاد این است که سیستم از سه بخش اصلی ساخته شود:

- Control Plane: API، داشبورد، احراز هویت، تنظیمات، billing، Telegram bot.
- Monitoring Plane: agent روی سرورها، health checks، metrics، alerts.
- Data Plane Integration: اتصال به Marzban/X-UI/پنل صنایی و بعداً provisioning اختصاصی AfroGate.

## اجزای اصلی

### Web Dashboard

- داشبورد ادمین.
- نمایش وضعیت لحظه‌ای.
- مدیریت users، servers، tunnels، alerts، settings.
- دو زبانه از ابتدا.

### Backend API

مسئول:

- user management
- package and usage accounting
- route decision
- alert rules
- Telegram bot webhook
- integration با Marzban/X-UI در مرحله اول
- audit log
- backup orchestration

### Server Agent

روی هر سرور ایران/آلمان نصب می‌شود و متریک‌ها را جمع می‌کند:

- CPU/RAM/disk
- network throughput
- interface counters
- WireGuard peer/tunnel status
- ping/jitter/packet loss به target های تعریف‌شده
- service status
- queue/API probe status

Protocol-aware smart routing probes should be added to the agent as lightweight synthetic checks, not by inspecting user traffic:

- TCP connect latency, TCP failure rate, and optional TLS handshake latency to configured targets.
- UDP reachability, jitter, packet loss, and response delay when a safe echo/probe target exists.
- QUIC/HTTP3 handshake/request timing where UDP-based web traffic matters.
- DNS lookup latency and failure rate when DNS behavior affects route quality.
- WireGuard handshake freshness, peer transfer counters, and tunnel up/down state.
- Short bounded loaded-latency and throughput probes for low-speed/high-speed classification.

agent باید lightweight باشد و حتی با سرورهای 4 core / 4 GB RAM هم مشکلی ایجاد نکند.

### Metrics Store

برای MVP دو مسیر ممکن است:

- سریع و عملیاتی: Prometheus + Grafana-compatible metrics، اما داشبورد اصلی داخل AfroGate.
- محصولی‌تر: PostgreSQL/TimescaleDB برای time-series های اصلی.

پیشنهاد MVP:

- PostgreSQL برای داده‌های محصول، کاربران، billing، تنظیمات.
- TimescaleDB extension یا جدول‌های partition شده برای metrics مهم.
- Redis برای queue، cache، و event های سریع.

### Alerting

Alert engine باید rule های ساده داشته باشد:

- threshold
- duration
- severity
- target channel
- cooldown

کانال‌های MVP:

- Telegram
- Dashboard notification

کانال‌های بعدی:

- Email
- Webhook
- Slack/Discord برای نسخه enterprise

## مدل داده پیشنهادی

### users

- id
- telegram_id
- telegram_username
- paid_number_hash یا encrypted paid_number
- status
- created_at

### customer_accounts

Current implementation starts Phase 2 with `customer_accounts` instead of a single flat user row:

- id
- display_name nullable
- telegram_id nullable unique
- telegram_username nullable
- paid_number_hash nullable, HMAC only
- status
- quota_scope: `account_shared` or `per_client`
- quota_limit_bytes nullable
- per_client_limit_bytes nullable
- used_bytes
- notes
- created_at
- updated_at

### client_configs

- id
- customer_account_id
- label
- protocol
- external_panel
- external_panel_user_id
- external_panel_config_id
- device_limit
- quota_limit_bytes nullable
- used_bytes
- status
- notes
- created_at
- updated_at

### client_usage_events

Usage accounting is append-only and idempotent at the API boundary. Admin/panel-sync/agent flows record compact usage events instead of writing per-packet logs:

- id
- customer_account_id
- client_config_id
- source: admin, agent, panel_sync, payment_adjustment, manual_adjustment, client_report, or unknown
- direction: rx, tx, or combined
- used_bytes_delta
- rx_bytes nullable
- tx_bytes nullable
- observed_at
- window_start nullable
- window_end nullable
- idempotency_key nullable, unique per source when present
- external_reference nullable
- notes nullable
- metadata jsonb for non-secret context only
- created_by
- created_at

Recording a new non-duplicate usage event atomically increments both `client_configs.used_bytes` and `customer_accounts.used_bytes`, so remaining-volume responses stay cheap to read on low-resource VPS machines. Duplicate `(source, idempotency_key)` reports return the existing event and do not double-count usage.

### client_route_preferences

Client VPN routing preferences are separate from admin/seller operations. Each client config can have one preference row per route group:

- id
- client_config_id
- route_group
- mode: `auto`, `country`, or `outbound`
- detected_country_code nullable, coarse ISO country only
- detected_country_source nullable: `client_app`, `edge_ip`, `admin`, or `unknown`
- preferred_exit_country_code nullable
- preferred_outbound_id nullable
- score_profile: balanced, stability, throughput, gaming, TCP, UDP, QUIC, DNS, or WireGuard
- auto_detect_country
- allow_client_override
- route_locked
- sticky_session_protection
- last_detected_at
- created_by
- created_at
- updated_at

The client route preference row stores no client IP history and no traffic destinations. When a preference is saved, AfroGate also maintains a matching `route_assignments` key like `client_config:<id>` so the route decision engine can evaluate the client separately from the global default assignment. Decision previews read this preference context and expose whether the preferred country or explicit outbound had a healthy managed candidate; if not, the preview falls back to the normal health and session-safety ranking with auditable reason codes instead of forcing an unstable route.

### client_access_tokens

Mobile/client API auth is separate from admin/seller auth. Admins can issue one-time plaintext tokens for a client config; AfroGate stores only a SHA-256 token hash:

- id
- client_config_id
- name
- token_hash
- scopes jsonb, currently `client:read` and `route:write`
- created_by
- created_at
- last_used_at
- revoked_at

Client-scoped endpoints live under `/api/client/*`. They can read only the authenticated client profile, quota summary, route preference, and selectable route options, and can update only that client's route preference when `allow_client_override` is true. These endpoints must not expose admin dashboard operations, server secrets, outbound config JSON, client IP history, or user traffic destinations.

The first client app lives in `apps/client`. It is a mobile-first React/Vite/Tailwind surface on port `4100` for client-token login, remaining-volume display, automatic/country/server route mode selection, and route score profile selection. It consumes only `/api/client/*` and keeps labels in its own typed English/Persian translation layer.

### packages

- id
- name
- slug
- volume_bytes
- price_per_gb
- total_price
- duration_days
- currency
- status: active or archived
- sort_order

### billing_settings

- setting_key: default
- currency
- price_per_gb
- updated_by
- created_at
- updated_at

### payment_methods

- id
- name
- slug
- provider: paypal, manual, bank_transfer, card, crypto, local_gateway, or another configured provider key
- checkout_mode: manual, hosted_redirect, external_link, or provider_sdk
- currency
- min_amount nullable
- max_amount nullable
- status: active or disabled
- sort_order
- supports_auto_capture
- public_config jsonb
- instructions
- created_by
- created_at
- updated_at

Payment provider secrets, including PayPal client secrets and webhook IDs, must not be stored in `public_config`. PayPal execution uses `AFROGATE_PAYPAL_*` deployment secrets and the backend outbound HTTP client; future providers should use encrypted `secret_records` or a dedicated provider-secret reference.

### payment_orders

- id
- customer_account_id
- volume_package_id nullable after package archival/deletion
- payment_method_id nullable after method archival/deletion
- package_name, package_slug, volume_bytes, duration_days, price_per_gb, amount, and currency snapshot
- status: pending, paid, failed, refunded
- provider
- provider_order_id nullable
- provider_capture_id nullable
- checkout_url nullable
- idempotency_key nullable, unique when present
- paid_at, failed_at, refunded_at, expires_at nullable
- metadata jsonb for non-secret provider context
- notes
- created_by
- created_at
- updated_at

Payment orders are the audit boundary between package selection and future quota allocation. A paid order does not directly mutate customer quota yet; a future charge allocation path must consume paid orders idempotently before increasing customer/client quota limits.

The PayPal adapter exposes guarded admin actions to create a hosted checkout order and capture an approved order, plus `/api/payments/paypal/webhook` for PayPal callbacks. Webhook events must be verified through PayPal before they can mark an order paid, failed, or refunded. PayPal orders should use a three-letter ISO currency such as USD or EUR; local currencies such as toman stay on manual/local gateway methods until a local provider adapter exists.

### subscriptions

- id
- customer_account_id
- package_id
- quota_scope: account_shared ÛŒØ§ per_client
- remaining_bytes
- used_bytes
- quota_limit_bytes
- per_client_limit_bytes nullable
- starts_at
- expires_at
- status

### servers

- id
- name
- country
- region
- public_ip_encrypted یا hostname
- cpu_cores
- ram_gb
- bandwidth_mbps
- role
- status

### interfaces

- id
- server_id
- name
- operator
- linked_tunnel_id
- status

### tunnels

- id
- server_id
- name
- type
- remote_endpoint
- interface_name
- status
- route_group
- lockable

### tunnel_metrics

- tunnel_id
- timestamp
- ping_ms
- jitter_ms
- packet_loss_percent
- rx_bps
- tx_bps
- health_score

### server_metrics

- server_id
- timestamp
- cpu_percent
- ram_percent
- disk_free_percent
- inbound_bps
- outbound_bps

### route_assignments

- id
- user_id
- current_tunnel_id
- auto_route_enabled
- locked_tunnel_id
- last_decision_reason
- updated_at

### alerts

- id
- severity
- source_type
- source_id
- title
- message
- status
- first_seen_at
- last_seen_at
- resolved_at

### audit_logs

- id
- actor_id
- action
- target_type
- target_id
- metadata
- created_at

## الگوریتم انتخاب مسیر MVP

ورودی‌ها:

- tunnel health score
- server load
- packet loss
- ping/jitter
- bandwidth pressure
- user route lock
- protocol profile: TCP, UDP, QUIC/HTTP3, DNS, WireGuard
- speed profile: low-speed stability, balanced, high-speed throughput

قانون ساده:

1. tunnel های down یا health کمتر از 50 حذف شوند.
2. tunnel های روی سرور با disk کمتر از 10% حذف یا penalize شوند.
3. اگر user route lock دارد، همان tunnel نگه داشته شود و فقط هشدار داده شود.
4. بین گزینه‌های باقی‌مانده، tunnel با بیشترین health score انتخاب شود.
5. برای جلوگیری از جابه‌جایی زیاد، hysteresis استفاده شود: مسیر جدید باید مثلاً 15 امتیاز بهتر باشد.

Protocol-aware route scoring:

1. A route can have separate scores for TCP, UDP, QUIC/HTTP3, DNS, and WireGuard health.
2. Low-speed users or unstable paths should prefer routes with lower loss, lower jitter, and consistent latency.
3. High-speed paths should prefer routes with better throughput headroom and lower saturation while still rejecting bad loss/jitter.
4. UDP-heavy configs should prefer UDP loss/jitter/NAT stability over raw bandwidth.
5. TCP-heavy configs should prefer TCP connect/TLS/request timing and retransmission symptoms over raw ping alone.
6. Every automatic decision must store the selected protocol profile, speed profile, old route, new route, score delta, cooldown state, and reason.

## SLO های MVP

- جمع‌آوری metrics: هر 5 تا 10 ثانیه.
- نمایش dashboard: refresh هر 3 تا 5 ثانیه یا realtime websocket.
- alert critical: ارسال زیر 10 ثانیه.
- route decision: هر 5 تا 15 ثانیه، با cooldown.
- API latency هدف: زیر 300 ms برای عملیات عادی.

## Backup

بکاپ باید شامل موارد زیر باشد:

- PostgreSQL dump رمزنگاری‌شده.
- فایل‌های تنظیمات tunnel/provisioning.
- secrets به صورت جداگانه و رمزنگاری‌شده.
- retention پیشنهادی:
  - daily: 7 روز
  - weekly: 4 هفته
  - monthly: 3 ماه

## امنیت عملیاتی

- HTTPS/TLS اجباری.
- JWT/session امن برای dashboard.
- Telegram webhook secret.
- agent token per server.
- rotation برای token ها.
- محدودسازی دسترسی به endpoint های agent.
- audit برای عملیات حساس: شارژ حجم، حذف کاربر، تغییر route، تغییر قیمت.

## مسیر مهاجرت از ابزارهای فعلی

مرحله اول:

- خواندن داده از Marzban/X-UI/پنل صنایی.
- ساخت dashboard و alert مستقل.

مرحله دوم:

- sync دوطرفه برای کاربر، حجم، subscription.
- ایجاد provisioning abstraction.

مرحله سوم:

- جایگزینی تدریجی با provisioning اختصاصی AfroGate.
- multi-server و multi-route کامل.

## تصمیم اجرایی اولیه

برای شروع پیاده‌سازی، مسیر local-first انتخاب شده است:

- Backend: NestJS/TypeScript.
- Frontend: React با Vite و Tailwind CSS برای dashboard سبک و static.
- Database: PostgreSQL.
- Agent: Python برای شروع سریع.
- Docker: اجباری نیست و نباید شروع MVP را کند کند.
- Ubuntu deploy: systemd + Nginx + PostgreSQL native، با امکان اضافه کردن Docker Compose در آینده.

این تصمیم برای شروع MVP است، نه قفل دائمی. اگر بعداً performance، enterprise contract یا تیم توسعه نیاز دیگری داشت، می‌توان سرویس‌های خاص را با .NET یا Go جدا کرد.
