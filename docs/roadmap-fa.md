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
- ثبت paid number با privacy protection.
- Separate seller/admin UX from VPN client UX; mobile/client APIs now start with scoped profile/quota, route options, and route-preference actions under `/api/client/*`, with package/usage purchase flows remaining future work.
- Usage accounting now starts with idempotent `client_usage_events` rows that update account/client used-byte counters for remaining-volume reads.

## فاز 3: Auto Route

- route assignment برای هر کاربر/کانفیگ.
- auto route toggle.
- route lock toggle.
- health-based route decision.
- protocol-aware route decision for TCP-heavy, UDP-heavy, QUIC, DNS-sensitive, low-speed, and high-speed profiles.
- cooldown/hysteresis برای جلوگیری از route flapping.
- نمایش reason انتخاب مسیر.
- Per-client route preferences and a separate mobile-first client app for automatic country detection, preferred exit country, and explicit server/outbound choice without exposing admin controls.

## فاز 4: Integration با سیستم فعلی

- خواندن users از Marzban/X-UI.
- sync مصرف حجم.
- عملیات شارژ volume از AfroGate به سیستم فعلی.
- import/export config.

## فاز 5: Enterprise Foundation

- role های Owner/Admin/Support.
- multi-server scaling.
- advanced audit.
- backup/restore UI.
- reports و data analysis.
- tenant/brand settings برای فروش enterprise.

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
