# رودمپ و بک‌لاگ AfroGate

## فاز 0: آماده‌سازی

- انتخاب stack نهایی backend و frontend.
- تعریف schema اولیه دیتابیس.
- تعریف i18n فارسی/انگلیسی.
- تعریف secrets و env config.
- آماده‌سازی Docker Compose برای توسعه.

## فاز 1: Monitoring MVP

### Backend

- API احراز هویت ادمین.
- CRUD سرورها.
- CRUD tunnel ها و interface ها.
- endpoint دریافت metrics از agent.
- ذخیره metrics کلیدی.
- alert engine ساده.
- Telegram alert sender.
- audit log.

### Agent

- ثبت سرور در control plane.
- ارسال CPU/RAM/disk.
- ارسال network counters.
- ارسال WireGuard status.
- اجرای ping/jitter/packet loss probe.
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

## فاز 3: Auto Route

- route assignment برای هر کاربر/کانفیگ.
- auto route toggle.
- route lock toggle.
- health-based route decision.
- cooldown/hysteresis برای جلوگیری از route flapping.
- نمایش reason انتخاب مسیر.

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

- stack نهایی frontend: Next.js یا React/Vite.
- stack نهایی backend: Node.js/NestJS یا Python/FastAPI.
- ذخیره metrics: TimescaleDB یا schema ساده PostgreSQL در MVP.
- میزان وابستگی اولیه به Marzban/X-UI.
- روش دقیق محاسبه مصرف per-user از data plane.

## پیشنهاد فنی اولیه

- Backend: FastAPI یا NestJS.
- Frontend: Next.js با UI عملیاتی و کم‌حاشیه.
- DB: PostgreSQL، قابل ارتقا به TimescaleDB.
- Cache/Queue: Redis.
- Agent: Go یا Python.
- Deploy: Docker Compose در MVP، بعداً Kubernetes یا Nomad برای enterprise.

## اولویت اجرای بعدی

1. ساخت اسکفولد backend/frontend.
2. ساخت schema دیتابیس.
3. ساخت server agent ساده.
4. ارسال metrics نمونه از agent به API.
5. نمایش dashboard realtime.
6. اضافه کردن Telegram alerts.

