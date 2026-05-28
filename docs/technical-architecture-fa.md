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

### client_configs

- id
- user_id
- label
- protocol
- external_panel_user_id
- external_panel_config_id
- device_limit
- quota_limit_bytes nullable
- used_bytes
- status
- created_at

### packages

- id
- name
- volume_gb
- price_per_gb
- total_price
- duration_days
- is_active

### subscriptions

- id
- user_id
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
