# PRD مانیتورینگ MVP AfroGate

## هدف

هدف MVP این است که AfroGate بتواند وضعیت سرورها، تونل‌ها، کیفیت مسیر، مصرف حجم، ظرفیت کاربران، و هشدارهای حیاتی را در یک داشبورد اختصاصی نمایش دهد و در تلگرام اطلاع‌رسانی کند.

این MVP جایگزین کامل Marzban یا پنل صنایی در روز اول نیست؛ اما پایه‌ی پنل اختصاصی Afrogate را می‌سازد تا بعداً به نسخه enterprise قابل فروش تبدیل شود.

## محدوده MVP

### باید داشته باشد

- داشبورد وب برای ادمین.
- مانیتورینگ سرورهای ایران و آلمان.
- مانیتورینگ WireGuard tunnel ها.
- مانیتورینگ اینترفیس‌ها:
  - `ether1`: Mobinnet، متصل به `wg1`
  - `ether2`: Irancell، متصل به `wireguard2`
  - `ether5`: Irancell، متصل به `wireguard3`
- مصرف حجم کاربران بر اساس گیگابایت.
- قیمت‌گذاری بر اساس هر GB با مقدار قابل تنظیم `X تومان`.
- اتصال به Telegram bot برای کاربر و هشدار.
- ذخیره حداقلی اطلاعات کاربر:
  - Telegram user id یا username
  - paid number فقط در صورت نیاز پرداخت/پشتیبانی
- هشدارهای سریع برای:
  - storage کمتر از 10%
  - ping بالا
  - jitter بالا
  - packet loss
  - کندی تخصیص حجم/پرداخت
  - کندی درخواست‌های API
  - مصرف بالای CPU/RAM
  - پر شدن پهنای باند
- دو زبانه: فارسی و انگلیسی.
- بکاپ برای دیتابیس مانیتورینگ و تنظیمات.
- حداقل دو یا سه سطح دسترسی ادمین.

### خارج از MVP اولیه

- اپلیکیشن موبایل کامل.
- billing gateway پیچیده و چندمرحله‌ای.
- جایگزینی کامل Marzban/X-UI در همان نسخه اول.
- تحلیل داده پیشرفته با مدل‌های پیش‌بینی.
- فروش enterprise با multi-tenant کامل.

Billing note: the backend now has a PayPal provider adapter for checkout creation, capture, and verified webhooks. Paid orders can be allocated once to customer quota through an audited allocation ledger. Rewarded ads can grant small capped quota credits through admin-managed reward/cap settings and a separate client-scoped ledger; verified ad-network callbacks remain a separate hardening phase. Refund reversal flows remain a separate phase.

High-cost route note: expensive VPS or emergency anti-blocking paths can carry a route usage multiplier. If an outbound is set to `10x`, `10 GB` of observed traffic consumes `100 GB` of quota, so a `100 GB` balance gives about `10 GB` usable traffic on that path. This must be visible to clients before they choose the route.

## ظرفیت اولیه

- هدف اولیه: حدود 150 کاربر.
- عدد رشد هدف: 10000 کاربر.
- مصرف فعلی کل کاربران: حدود 20 MB/s outbound.
- حداقل تجربه مطلوب برای هر کاربر: حداقل 1 MB/s.
- اگر سرور خلوت است، کاربر بتواند از حداکثر سرعت موجود استفاده کند.

## زیرساخت فعلی

### ایران

- 3 سرور ایران در حال حاضر.
- تعداد سرورها باید قابل افزایش نامحدود باشد.
- مشخصات معمول:
  - 6 core / 6 GB RAM
  - یا 4 core / 4 GB RAM
- اینترنت سرور ایران: 1 Gbps.

### آلمان

- 1 سرور آلمان.
- مشخصات: 4 core / 8 GB RAM.
- اینترنت سرور آلمان: 1 Gbps.

### Starlink

- تست فعلی با وایرلس router Starlink:
  - download حدود 250 Mbps
  - upload حدود 67 Mbps
  - ping حدود 50 ms

## کیفیت مسیر

### شاخص‌ها

- Ping
- Jitter
- Packet loss
- Throughput
- Queue/request delay
- API response time
- Tunnel up/down
- Health score مسیر

### Threshold پیشنهادی

- packet loss: باید خیلی کم باشد؛ هر مقدار پایدار بالای 1% هشدار است.
- ping:
  - عالی: زیر 50 ms
  - قابل قبول: 50 تا 100 ms
  - ضعیف: 100 تا 150 ms
  - بحرانی: بالای 150 ms
- jitter:
  - عالی: زیر 10 ms
  - قابل قبول: 10 تا 40 ms
  - ضعیف: 40 تا 80 ms
  - بحرانی: بالای 80 ms
- health score:
  - 90 تا 100: عالی
  - 70 تا 89: قابل قبول
  - 50 تا 69: نیازمند توجه
  - کمتر از 50: مسیر نباید برای auto-route انتخاب شود

## Auto Route

سیستم باید بتواند بهترین مسیر را به صورت خودکار انتخاب کند، اما بعضی کاربران یا کانفیگ‌ها باید بتوانند روی یک مسیر ثابت بمانند.

Smart routing should become protocol-aware. The agent should collect privacy-safe synthetic TCP, UDP, QUIC/HTTP3, DNS, and WireGuard route-health signals. The backend should choose routes by profile: low-speed stability, high-speed throughput, TCP-heavy, UDP-heavy, QUIC-heavy, or DNS-sensitive. Automatic decisions must still use cooldown, hysteresis, route lock, and audit reasons.

### قوانین MVP

- هر tunnel هر چند ثانیه health check شود.
- اگر مسیر فعلی بدتر از threshold شد، route candidate جدید انتخاب شود.
- کاربر/ادمین بتواند گزینه `lock route` را فعال کند.
- وقتی `lock route` فعال است، سیستم فقط هشدار می‌دهد و جابه‌جایی خودکار انجام نمی‌دهد.
- تصمیم route باید قابل مشاهده و audit باشد: چرا این مسیر انتخاب شد.

### Health score ساده

```
score = 100
- ping_penalty
- jitter_penalty
- packet_loss_penalty
- bandwidth_pressure_penalty
- server_load_penalty
- storage_penalty
```

## تجربه ادمین

### داشبورد اول

نمای اول باید وضعیت عملیات را بدون نیاز به جستجو نشان دهد:

- تعداد کاربران فعال.
- مصرف کل امروز/ماه.
- outbound فعلی.
- سلامت هر سرور.
- سلامت هر tunnel.
- مسیرهای مشکل‌دار.
- هشدارهای فعال.
- incident timeline برای دیدن باز/حل شدن هشدارها و تصمیم‌های مسیر در کنار هم، بدون تغییر زنده مسیر.
- storage باقی‌مانده.
- API latency.
- queue/backlog درخواست‌های پرداخت یا شارژ.

### صفحات MVP

- Dashboard
- Servers
- Tunnels
- Users
- Usage and Billing
- Alerts
- Telegram Bot
- Settings
- Backups
- Audit Log

## تجربه کاربر

کاربر از طریق Telegram bot یا بعداً اپلیکیشن می‌تواند:

- حجم باقی‌مانده را ببیند.
- بسته بخرد یا شارژ کند.
- وضعیت سرویس را ببیند.
- کانفیگ دریافت کند.
- در صورت اختلال، پیام ساده و قابل فهم بگیرد.
- در اپلیکیشن موبایل، مسیر را به صورت خودکار بر اساس کشور/کیفیت انتخاب کند یا در صورت نیاز کشور خروجی یا سرور مشخصی را انتخاب کند. این تجربه باید از داشبورد admin/seller جدا باشد و فقط دسترسی client-scoped داشته باشد.
- در نسخه native اپلیکیشن، بتواند split tunneling بر اساس app داشته باشد: مثلا فقط Instagram، Telegram، و WhatsApp از VPN استفاده کنند و Chrome/Firefox با اینترنت عادی بمانند، یا کاربر Chrome را هم به لیست VPN اضافه کند. این انتخاب باید client-scoped و privacy-safe باشد و لیست همه اپ‌های نصب‌شده یا مقصدهای ترافیک به کنترل‌پلین ارسال نشود.

## حریم خصوصی و امنیت

این محصول باید برای مردم امن باشد و با نگاه حقوق بشری طراحی شود.

### اصول

- ذخیره حداقلی داده.
- عدم ذخیره محتوای ترافیک.
- عدم ذخیره IP history طولانی‌مدت مگر برای امنیت و با retention کوتاه.
- رمزنگاری secret ها.
- audit log برای عملیات ادمین.
- دسترسی role-based.
- بکاپ رمزنگاری‌شده.
- امکان حذف یا anonymize کردن کاربر.

### داده‌های مجاز MVP

- Telegram id یا username.
- paid number در صورت نیاز.
- حجم مصرفی.
- وضعیت بسته.
- زمان انقضا/شارژ.
- شناسه کانفیگ یا tunnel.
- لاگ عملیات ادمین.

## نقش‌ها

حداقل دو سطح:

- Owner: همه دسترسی‌ها.
- Operator: مشاهده، پشتیبانی، شارژ کاربر، مدیریت محدود.

پیشنهاد سه سطح:

- Owner
- Admin
- Support

## زبان‌ها

- Persian/fa
- English/en

تمام متن‌های UI باید از ابتدا i18n-ready باشند.

## معیار موفقیت MVP

- ادمین در کمتر از 10 ثانیه بفهمد مشکل از کدام server/tunnel/operator است.
- هشدار storage زیر 10% در تلگرام ارسال شود.
- افزایش ping/jitter/packet loss در چند ثانیه دیده شود.
- مصرف GB هر کاربر قابل محاسبه باشد.
- حداقل 150 کاربر بدون اختلال مدیریتی پوشش داده شود.
- معماری برای رشد تا 10000 کاربر نیازمند بازنویسی کامل نباشد.
