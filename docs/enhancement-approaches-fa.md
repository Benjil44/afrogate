# رویکردهای ارتقای AfroGate

این سند ایده‌های enhancement را نگه می‌دارد تا MVP ساده بماند، اما مسیر رشد از روز اول روشن باشد. هر enhancement باید قبل از اجرا با سه معیار سنجیده شود:

- آیا عملیات را برای ادمین سریع‌تر و امن‌تر می‌کند؟
- آیا حریم خصوصی کاربر را حفظ یا بهتر می‌کند؟
- آیا بدون بازنویسی بزرگ، مسیر رشد تا 10000 کاربر و نسخه enterprise را باز می‌گذارد؟

## 1. Reliability First

اولین ارتقا باید کاهش قطعی و تشخیص سریع مشکل باشد، نه اضافه کردن feature زیاد.

### پیشنهادها

- تعریف SLO برای dashboard، alert، metrics ingest و Telegram bot.
- ساخت status page داخلی برای ادمین.
- health check چندلایه:
  - server health
  - tunnel health
  - operator/interface health
  - API/backend health
  - payment/charge queue health
- تعریف incident state برای هر مشکل:
  - detected
  - acknowledged
  - mitigating
  - resolved
- ثبت timeline هر incident برای یادگیری بعدی.

### اولویت MVP

- Critical alert زیر 10 ثانیه.
- Dashboard refresh زیر 5 ثانیه.
- تشخیص storage زیر 10%.
- تشخیص packet loss پایدار.

## 2. Observability by Design

مانیتورینگ فقط نمودار نیست؛ باید جواب بدهد: مشکل کجاست، از کی شروع شده، روی چه کاربرانی اثر دارد، و بهترین اقدام چیست.

### پیشنهادها

- metrics استاندارد با نام‌گذاری ثابت.
- event log برای تغییرات مهم.
- audit log برای عملیات ادمین.
- trace ساده برای عملیات حساس:
  - خرید بسته
  - شارژ حجم
  - تغییر route
  - ساخت کانفیگ
- dashboard با سه سطح:
  - overview برای وضعیت کل
  - drill-down برای server/tunnel/operator
  - timeline برای incident

### داده‌های مهم

- ping, jitter, packet loss
- rx/tx per tunnel
- outbound total
- CPU/RAM/disk
- API latency
- queue delay
- Telegram bot latency
- charge allocation delay

## 3. Route Intelligence

Auto route باید با احتیاط ساخته شود. هدف این نیست که همیشه مسیر عوض شود؛ هدف این است که تجربه کاربر بدون route flapping بهتر شود.

### پیشنهادها

- امتیاز route با health score.
- hysteresis برای جلوگیری از تغییر زیاد.
- cooldown بعد از هر تغییر مسیر.
- route lock برای کاربرانی که نباید جابه‌جا شوند.
- ثبت reason برای هر تصمیم route.
- نمایش candidate route ها و دلیل رد شدن هرکدام.
- canary route برای تست مسیر جدید روی درصد کمی از کاربران قبل از rollout کامل.
- Protocol-aware route scoring: keep separate health signals for TCP, UDP, QUIC/HTTP3, DNS, and WireGuard so automatic routing can choose the best path for each traffic profile.
- Speed profiles: low-speed routes should optimize stability/loss/jitter; high-speed routes should optimize throughput headroom without accepting bad loss or jitter.

### سیاست تصمیم ساده

```text
if route_locked:
    keep_current_route_and_alert_if_bad
else:
    choose_best_healthy_route_with_hysteresis_and_cooldown
```

## 4. Privacy and Human Safety

AfroGate باید از اول privacy-first باشد. چون این محصول برای دسترسی امن مردم طراحی می‌شود، نباید داده اضافی جمع کند.

### پیشنهادها

- data minimization به عنوان policy اصلی.
- encrypted paid number یا hash در صورت کافی بودن.
- عدم ذخیره محتوای traffic.
- retention کوتاه برای داده‌های حساس.
- backup رمزنگاری‌شده.
- جدا کردن operational metrics از user identity تا حد ممکن.
- export/delete/anonymize برای کاربر.
- threat model قبل از enterprise release.

### خط قرمز

- token، secret، IP credential، اطلاعات واقعی کاربران و فایل‌های production نباید commit شوند.

## 5. Safe Billing and Usage Accounting

مدل حجمی باید دقیق، قابل audit و قابل توضیح باشد.

### پیشنهادها

- ذخیره usage به byte، نمایش به GB.
- event ledger برای شارژ و مصرف.
- idempotency key برای عملیات پرداخت و شارژ.
- reconciliation job برای اختلاف مصرف بین AfroGate و پنل فعلی.
- alert برای delayed charge allocation.
- audit log برای تغییر قیمت هر GB.

### مدل پیشنهادی

- user balance
- package purchase event
- usage event
- adjustment event
- admin correction event

## 6. Progressive Migration

در ابتدا می‌توان از Marzban/X-UI/پنل صنایی داده گرفت، ولی معماری نباید به آن قفل شود.

### مراحل

1. Read-only integration برای monitoring.
2. Controlled write برای شارژ حجم و ساخت کانفیگ.
3. Provisioning abstraction داخل AfroGate.
4. Migration tools برای انتقال کاربران.
5. AfroGate-native provisioning.

### قانون مهم

هر integration باید پشت adapter باشد تا بعداً تعویض شود، نه اینکه در کل backend پخش شود.

## 7. Enterprise Readiness

نسخه enterprise فقط UI زیباتر نیست؛ باید قابل پشتیبانی، قابل audit، امن و قابل scale باشد.

### پیشنهادها

- roleهای Owner/Admin/Support از ابتدا در schema دیده شوند.
- tenant/brand settings بعد از MVP.
- audit export.
- backup/restore UI.
- multi-region server grouping.
- webhook برای سیستم‌های خارجی.
- SLA report برای مشتری enterprise.
- license/plan limits برای نسخه فروش.

## 8. Data Analysis

تحلیل داده بعد از جمع‌آوری درست metrics ارزشمند می‌شود.

### پیشنهادها

- تشخیص الگوی بد شدن route ها.
- پیش‌بینی پر شدن storage.
- تشخیص operator هایی که در ساعت‌های خاص افت کیفیت دارند.
- پیشنهاد ارتقای سرور بر اساس CPU/RAM/bandwidth pressure.
- cohort analysis برای مصرف کاربران.
- anomaly detection برای مصرف غیرعادی یا سوءاستفاده.

## 9. Development Approach

پیاده‌سازی باید مرحله‌ای باشد:

1. Make it visible: اول مشاهده و هشدار.
2. Make it reliable: بعد پایداری و کاهش false alert.
3. Make it controllable: بعد action از dashboard.
4. Make it automatic: بعد auto route و automation.
5. Make it enterprise: بعد tenant، reports، SLA و billing پیشرفته.

## 10. Recommended Next Enhancement After MVP

بعد از اولین dashboard monitoring، بهترین enhancement این است:

- Incident timeline
- Telegram critical alerts
- route health score history
- charge allocation delay tracking
- backup status

این پنج مورد بیشترین اثر عملیاتی را دارند و پیچیدگی غیرضروری به MVP اضافه نمی‌کنند.
