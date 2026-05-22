# برنامه شروع پیاده‌سازی AfroGate

## وضعیت Git

فعلاً پروژه باید local-first بماند.

- Git local ساخته شده است.
- Push به GitHub فعلاً لازم نیست.
- Remote می‌تواند بعداً به `benjil44/afrogate` وصل و push شود.
- تا قبل از آماده شدن remote، تمام commit ها محلی نگه داشته می‌شوند.

## پیشنهاد Stack برای شروع

### انتخاب پیشنهادی MVP

- Backend: NestJS با TypeScript.
- Frontend: React با Next.js برای dashboard.
- Database: PostgreSQL.
- Cache/Queue: فعلاً optional؛ Redis در فاز alert/queue اضافه شود.
- Agent: Python برای شروع سریع، بعداً Go اگر نیاز به binary سبک‌تر بود.
- Docker: فعلاً برای local development اجباری نباشد.
- Ubuntu deploy: اول با systemd + Nginx + PostgreSQL native؛ بعداً Docker Compose برای deploy تکرارپذیر.

## چرا NestJS برای Backend؟

AfroGate فقط یک API ساده نیست. Backend باید این کارها را داشته باشد:

- admin auth
- server/tunnel CRUD
- metrics ingest
- alert engine
- Telegram bot webhook
- usage/billing
- audit log
- route decision
- later enterprise roles and tenant settings

NestJS نسبت به Express ساختار آماده‌تری برای پروژه‌ی بزرگ‌تر دارد: module، service، controller، dependency injection، validation، guard و testing structure. Express برای prototype سریع خوب است، اما برای پنل enterprise ممکن است خیلی زود نیاز به ساختن معماری دستی پیدا کند.

## چرا نه Next.js به عنوان Backend اصلی؟

Next.js برای dashboard و full-stack web عالی است، اما backend اصلی AfroGate باید worker، metrics ingest، Telegram webhook، alert engine، job scheduling و integration adapter داشته باشد. این‌ها بهتر است در backend مستقل بمانند.

Next.js می‌تواند فقط frontend/dashboard باشد و با API مستقل صحبت کند.

## جایگاه .NET

.NET/ASP.NET Core انتخاب قوی و enterprise-grade است، مخصوصاً اگر تیم با C# راحت باشد. اما برای شروع AfroGate، اگر frontend React/Next و bot/integration ها هم TypeScript باشند، NestJS سرعت توسعه و یکپارچگی بیشتری می‌دهد.

اگر بعداً performance یا enterprise مشتری‌ها نیاز خاصی خواستند، می‌توان بعضی سرویس‌ها را با .NET یا Go جدا کرد.

## چرا PostgreSQL؟

داده‌های AfroGate رابطه‌ای و audit-sensitive هستند:

- users
- packages
- subscriptions
- usage ledger
- payments/charges
- servers
- tunnels
- route assignments
- alerts
- audit logs

PostgreSQL برای transaction، constraint، query های تحلیلی، و schema قابل اعتماد مناسب‌تر از MongoDB برای MVP است. اگر داده flexible لازم شد، می‌توان از `jsonb` استفاده کرد. اگر metrics زیاد شد، می‌توان partitioning یا TimescaleDB را اضافه کرد.

MongoDB برای داده‌های document-heavy خوب است، ولی در AfroGate billing، audit و relationship ها مهم‌تر هستند.

## Docker یا بدون Docker؟

### فعلاً

بدون Docker شروع کنیم تا friction کمتر باشد:

- Node.js برای backend/dashboard.
- PostgreSQL local یا Ubuntu native.
- Python برای agent.

### برای Ubuntu

دو مسیر خوب داریم:

1. ساده و مستقیم:
   - Nginx
   - systemd service برای backend
   - PostgreSQL native
   - Redis native وقتی لازم شد
2. تکرارپذیرتر:
   - Docker Compose برای backend/dashboard/postgres/redis

پیشنهاد: MVP را بدون Docker شروع کنیم، ولی ساختار config را طوری بنویسیم که بعداً Docker Compose اضافه کردن سخت نباشد.

## ساختار فولدر پیشنهادی

```text
apps/
  backend/       NestJS API, alerts, bot webhook, billing, route decision
  dashboard/     Next.js React admin dashboard
  agent/         Python server monitoring agent
packages/
  shared/        shared types, constants, schemas
infra/
  ubuntu/        Nginx, systemd, install notes
  docker/        optional future Docker Compose
docs/
  ...
.codex/
  ...
```

## اولین Sprint پیاده‌سازی

### هدف

یک مسیر کامل از agent تا dashboard بسازیم:

```text
agent -> backend metrics ingest -> database -> dashboard overview
```

### کارهای Sprint 1

1. ساخت monorepo folders.
2. ساخت backend NestJS minimal API.
3. ساخت PostgreSQL schema اولیه.
4. ساخت agent ساده Python برای ارسال heartbeat و metrics mock/real.
5. ساخت dashboard Next.js با صفحه overview.
6. نمایش server health، disk، CPU، RAM، ping.
7. اضافه کردن alert ساده برای disk free کمتر از 10%.

## تصمیم‌های بعدی

- انتخاب ORM: Prisma یا Drizzle.
- انتخاب auth: session/JWT برای dashboard.
- انتخاب UI kit سبک برای dashboard.
- انتخاب روش realtime: polling اول، WebSocket/SSE بعداً.
- انتخاب روش migration دیتابیس.

