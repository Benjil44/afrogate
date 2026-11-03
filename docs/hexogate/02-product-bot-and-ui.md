# Hexogate product reference 02: Telegram bot, web app, UI/UX, and the Afrows gap

Written 2026-11-03 by the frontend/UX role. Companion to `docs/hexogate-reference-and-afrows-roadmap.md` (infrastructure). Sources:

- read-only inspection of `/opt/hexogate-bot` on the Hexogate panel host: `app/bot/ui.py`, `app/bot/keyboards.py`, `app/bot/handlers/*`, `app/bot/states.py`, `app/services/user_flow.py`, `app/services/support_guides.py`, `app/web/routes/*` (route decorators only), `frontend-svelte/src/**` (routes, components, `styles/tokens.css`, `app.html`, `static/manifest.webmanifest`, `static/service-worker.js`), `Caddyfile`, and the docs under `docs/` (project map, product architecture, design system 2026-07-01, bot-flow release notes);
- public, logged-out screenshots of `hexogate.com` and `app.hexogate.com`, taken with the repo's Playwright at 1440x900 and 390x844, saved under `docs/hexogate/screens/`;
- the Afrows side: `apps/backend/src/telegram/*`, `docs/telegram-bot-flow-design.md`, `docs/telegram-bot-v2-plan.md`, `apps/client/src/*`, `apps/dashboard/src/pages/*`, `apps/web/src/*`, `.claude/uiuxchecklist.md`, `docs/multilingual-ui.md`.

Rules kept: nothing on the Hexogate host was changed; no `.env`, `secrets/`, tokens, database content or container environment were read; no customer identifiers appear here. Prices quoted are the public catalog prices shown on the public site.

Scale, for context: the Hexogate bot/web codebase is about 91k lines of Python (237 bot callback handlers, 81 message handlers, 222 FastAPI routes, 216 Python test files) plus a SvelteKit 5 frontend of about 19k lines of Svelte and 9.8k lines of CSS. Persian only. It has been in production since mid-2026 with a documented release discipline (backup, restore drill, deploy gate, post-deploy verifier, release marker).

---

## 1. Feature inventory

### 1.1 Customer features

| Area | Hexogate feature | Where |
|---|---|---|
| Onboarding | `/start` parses a referral parent, checks forced channel membership (`force_join_enabled`, "ورود به کانال / بررسی عضویت"), then one-tap terms acceptance ("تایید قوانین"), then the **smart home**. Deep link `/start buy_<product_id>` jumps straight into the purchase flow for one product (all guards still apply) | bot `user_start.py` |
| Smart home | A per-user home panel: greeting, active services count, services needing attention, wallet balance, one recommended **primary action** (buy / renew / fix) with a description, up to 3 alert lines. The inline keyboard changes with the primary action | bot `ui.smart_home_panel`, `keyboards.smart_home_keyboard` |
| Pending actions | "ادامه کار": unfinished invoices/payments/support states are listed with "ادامه: …" buttons so a user never creates a duplicate invoice; cancel buttons for pending invoice/payment/state | bot `pending_actions_*` |
| Catalog | Two public families: **حرفه‌ای** (professional, internal `vip`) and **اقتصادی** (economy); plus scoped families `diamondde` (Germany single-config) and `gaming`. Each family shows a dynamic country/flag row derived from panel group metadata (nightly refresh). Economy shows a pre-purchase notice with a free 500 MB test button | bot, web `/buy`, public `/pricing` |
| Free test | "دریافت تست رایگان" on the main menu; economy-scoped 500 MB / 1 day test; `/buy?test=1` in the web app; test products are visually separated from paid plans | bot, web |
| Purchase | Family -> category -> plan -> service name (random or custom) -> invoice -> payment method (wallet / card-to-card / mix) -> protected card number with a **copy button** -> receipt photo or PDF -> admin review (or trusted auto-accept) -> automatic provisioning and delivery. Step indicator "مرحله X از ۳" | bot `purchase.py`, web `/buy` |
| Wallet (toman) | Balance, top-up with preset amounts (100k / 250k / 500k / 1M toman; reseller presets 500k to 5M), card-to-card receipt for top-up, ledger/history, refresh; "insufficient wallet" offers wallet+card mix | bot `wallet.py`, web `/wallet` |
| Services ("سرویس‌های من") | Paginated list sorted usable-first, status filters (all / active / disabled / expired / limited), search, **add an existing service by subscription link**, "I cannot find my service". Per service: nickname, last-online from panel, next-action button, reserve activation, connect menu, renew menu, data reset (eligible tenants), support-and-more menu, stop/reactivate, rotate link, refund request, transfer to another user (approve/reject) | bot `subscriptions.py`, web `/services` |
| Connect | QR photo, individual config links, subscription link (with `copy_text` button), per-OS tutorial, rotate link; WireGuard `.conf` download + QR for WireGuard products | bot, web, api_v0 |
| Renewals | Same plan, another plan, switch family (pro <-> economy with pro-rated credit), reset traffic, **add traffic**, **time-only renewal**, "renewal suggestion"; expiry/traffic reminder messages with a management keyboard; "fresh cycle" renewal | bot `renewal_plans_keyboard`, services |
| Post-purchase | Delivery message + QR + copy button + setup menu (check service / connect & links / download app / tutorials / open in app) + a delivery check "وصل شدم / وصل نشدم" that routes to diagnostics | bot `provisioning_helpers.py` |
| Support | Category wizard (connection, payment/receipt, renewal, install, refund, lost service, reseller, feedback, other), platform picker (Android / iOS / Windows / macOS / Linux, optional router) with the recommended app per platform, connection diagnostics form (device, app, network type, operator, city, error text, last refresh), ticket thread with reply/close, admin canned replies, feedback reward | bot `support.py`, web `/support` |
| App center / downloads | Download links per platform (cached, official URLs), tutorials per OS and per app, "دانلود برنامه" and "آموزش‌ها" on the main menu, `/api/public/client-apps` for the site | bot, web, public |
| Referral | "دعوت دوستان": referral dashboard, list of referred users, public leaderboard (display names only), 20% commission on referred paid invoices (custom cuts per user) | bot `referral_dashboard_keyboard`, reseller routes |
| History | "تاریخچه": account timeline of purchases, payments, tickets and wallet events | bot `timeline_panel` |
| Gift codes | Admin-issued gift codes redeemable in the purchase flow (`waiting_for_gift_code`) | bot |
| Notifications | Telegram messages (reminders, approvals, delivery), web notifications feed with read state, **web push** subscriptions (service worker), scheduled broadcasts and campaigns with segments | api_v0, worker |
| Web account | Telegram widget login, **pair-code login** (code + QR shown in the browser, approved in the bot), email magic link; session list, revoke, logout-all; Telegram Mini App auto-login from `initData` | `auth.py`, `LoginScreen.svelte` |
| Mobile apps | `api_v0` contract for native/mobile clients: session, subscriptions, vpn-profile, invoices, payments, wallet ledger, search, notifications, support tickets; Android app download on the public site | `api_v0.py` |
| PWA | Installable, standalone, shortcuts (center / services / support), offline page, push | manifest, service worker |

### 1.2 Reseller / tenant features

| Feature | Detail |
|---|---|
| Reseller request | Support category "نمایندگی" or main-menu "درخواست نمایندگی"; owner approves from the bot |
| Reseller dashboard (bot) | Buy for a customer, top-up wallet, my services, **my price list**, **rank**, refresh. Panel copy includes wallet balance and test-account usage |
| Reseller pricing | Per-reseller product prices, levels/tiers from a rolling 30-day sales score (new sale 1.0, renewal 0.7, add-on 0.4); tier discounts only activate from owner-approved snapshots |
| Reseller web workspace | `/management?role=reseller`: customers (search, renew), CRM, customer detail and purchases, customer products, ledger, CSV exports, reports |
| Tenant bots | A reseller can get a **child Telegram bot** (own token, encrypted) served through a webhook multiplexer; tenant admins manage their customers, plans, prices, support, receipts, wallet adjustments, broadcasts and settings inside Telegram. Tenant bots never show Hexogate web/app buttons. Tenant retail wallet is separate from the global wallet; wholesale debit uses the global ledger |
| Shared wallet | Reseller purchases debit the reseller wallet at wholesale; minimum top-up presets are higher |

### 1.3 Owner / admin features

| Surface | Features |
|---|---|
| Bot admin menu ("پنل مدیریت") | Owner panel, dashboard, stats, users (lookup, control, message), admins (permissions), resellers (detail, prices, limits, commission, tenant bot setup), tickets, receipts (approve / reject first; risky actions under "گزینه‌های بیشتر"; recheck; reject-and-ban), provisioning queue with failed-job retry, bank cards (rotation, exhaustion alerts), plans, gift codes, channels (force join), settings toggles (sales open/closed, support open/closed, terms), panel (Marzban/PasarGuard) tools, backups, text templates, broadcasts |
| Web management (`/management?role=admin`) | Dense command center: dark rail + bright content, persistent command search (user / invoice / service), priority queues (receipts, support, provisioning), owner console sections (overview, search, users, services, payments, tickets, resellers, tenants, campaigns, operations, health, logs, settings, reports) each tagged with a risk level (read / audited / financial / owner), workspace tabs with badge counts, detail drawer, notification center, status bar, dense-mode toggle (localStorage), charts (stat tiles, sparklines, line/area, bar list), UX analytics and drop-off funnels, health center, "ops brief" morning summary, tenant manager, reseller levels panel, broadcast panel |
| Trust automation | Trusted receipt auto-accept after 600 s for users above a lifetime threshold of manually approved receipts; approval-gated automated refunds for one tenant |
| Analytics | Sanitized `ActivityLog` events from bot, Mini App, dashboard and public CTAs (`/api/ux/events`, `/api/public/events`) |

---

## 2. The Telegram bot (`@hexov2_bot`)

Runtime: aiogram, polling, Persian only, HTML parse mode, "glass panel" message style (title line, body lines, a `◇◇◇◇◇◇◇◇` footer), Telegram **premium custom emoji** on buttons where configured, **button styles** (success / danger / primary) and **`copy_text` buttons** for card numbers and links.

### 2.1 Persistent reply keyboard (main menu)

```
[ خرید سرویس 🛒 ]        [ تمدید سرویس ♻️ ]
[ سرویس‌های من 🚀 ]      [ دریافت تست رایگان 🎁 ]
[ کیف پول 💳 ]           [ دعوت دوستان 👥 ]
[ دانلود برنامه 📱 ]     [ آموزش‌ها 📚 ]
[ پشتیبانی ☎️ ]          [ تاریخچه 📜 ]
[ پیشنهاد و گزارش مشکل 💡 ]
[ درخواست نمایندگی 🪪 ]        <- becomes [ پنل نمایندگی 🪪 ] for active resellers
[ پنل مدیریت 👑 ]              <- admins only
```

`resize_keyboard=True`. Every text button is also reachable by inline callbacks, and old slash commands remain as aliases.

### 2.2 Smart home (inline, after `/start` or "خانه 🏠")

Panel: greeting, active services, needs-attention count, wallet balance, "پیشنهاد ما برای شما: <primary action>", up to 3 alerts.

If the primary action is "buy":
```
[ خرید سرویس ⚡ ]
[ سرویس‌های من 🚀 ] [ کیف پول 💳 ]
[ پنل نمایندگی 🪪 ] [ تاریخچه 📜 ]
[ پشتیبانی ☎️ ]
```
Otherwise (renew / fix):
```
[ <primary action> ⚡ ]
[ خرید سرویس 🛒 ] [ تمدید سریع ♻️ ]
[ کیف پول 💳 ] [ پنل نمایندگی 🪪 ]
[ تاریخچه 📜 ] [ پشتیبانی ☎️ ]
```

### 2.3 Buy flow, step by step

1. "خرید سرویس" -> family panel ("یکی از دو مسیر زیر را انتخاب کنید"): each family lists description, a benefit line, country flags, and a second benefit line. Buttons: one row per family (`حرفه‌ای 👑`, `اقتصادی 🌱`, …) + `خانه 🏠`.
2. Economy only: notice panel ("قبل از خرید اقتصادی") -> `[ادامه با سرویس اقتصادی ✅] [دریافت تست اقتصادی ۵۰۰ مگابایت 🎁] [بازگشت ↩️] [خانه 🏠] [انصراف ❌]`.
3. Category list (one button per category) when the family has several; then plan list: one button per plan "`<name> · <GB> · <days> · <price> 📦`", test products render as "دریافت تست <MB> 🎁". Panel header says "مرحله ۱ از ۳".
4. Service name step: `[ساخت نام خودکار 🎲] [بازگشت به خرید ↩️] [خانه 🏠] [انصراف ❌]` or type a name.
5. Invoice panel: plan, service name, payable amount -> `[پرداخت با کیف پول 💳] [کارت‌به‌کارت 🧾] [خانه 🏠] [انصراف ❌]`. Insufficient wallet -> mix (wallet + card remainder).
6. Card-to-card: protected card panel (card number, holder) with `[کپی شماره کارت 📋]` (`copy_text`), `[درخواست کارت جدید 🔄]`, `[بررسی وضعیت / ارسال رسید 🧾]`, `[خانه 🏠]`. FSM state `waiting_for_receipt`.
7. The user sends a photo or document -> "receipt submitted" with status buttons; admins get the receipt with approve/reject first and risky actions in a submenu. Trusted users are auto-accepted after 600 s.
8. Delivery: a glass panel with the service summary, then a **QR photo** of the subscription link with a copy-ready caption and `[کپی لینک اشتراک 📋]`, then the post-purchase setup keyboard:
   ```
   [ بررسی سرویس 🚀 ] [ اتصال و لینک‌ها 💾 ]
   [ دانلود برنامه 📱 ] [ آموزش اتصال 📚 ]
   [ مدیریت راحت‌تر در اپ Hexogate 📱 ]   (url)
   [ سرویس‌های من 🚀 ]
   [ خانه 🏠 ]
   ```
   followed later by a delivery check `[وصل شدم ✅] [وصل نشدم 🛠]`.

Tap count: a returning user with wallet balance buys in 5 taps (buy -> family -> plan -> random name -> wallet). A new user with card payment: 6 taps + one photo.

### 2.4 Services and renewals

List screen: one button per service (nickname or label), filter row `[همه] [فعال] [غیرفعال]` / `[منقضی] [محدود]`, `[قبلی ◀️] [بعدی ▶️]`, `[جستجوی سرویس 🔎] [افزودن سرویس با لینک 🔗]`, `[سرویسم را پیدا نمی‌کنم 🔍]`, `[خانه 🏠]`.

Service card keyboard:
```
[ <next action> ⚡ ]                      (only when the service needs something)
[ فعال‌سازی سرویس رزرو ⏳ ]               (on_hold only)
[ اتصال و لینک‌ها 💾 ] [ تمدید و تغییر ♻️ ]
[ ریست حجم سرویس ♻️ ]                     (eligible only)
[ پشتیبانی و بیشتر 🛠 ]
[ مدیریت همین سرویس در اپ Hexogate 📱 ]   (url)
[ بازگشت به لیست سرویس‌ها 🏠 ]
[ خانه 🏠 ]
```
Connect submenu: `[دریافت کد QR 📷]`, `[دریافت لینک اتصال 💾] [دریافت لینک اشتراک 🔗]`, `[آموزش اتصال 📚]`, `[تغییر لینک اتصال 🔄]`, back, home.
Renew submenu: `[تمدید همین پلن ♻️]`, `[تمدید با پلن دیگر 📦]`, `[تغییر نوع سرویس 🔁]`, `[ریست حجم ♻️]`, `[افزایش حجم ➕]`, `[خرید فقط زمان ⏳]`, `[پیشنهاد تمدید 💡]`, back, home.
More submenu: `[مشکل اتصال دارم 🛠]`, `[درخواست بازگشت وجه 💸]`, `[توقف سرویس ⏹️]`, back, home. Stop confirmation uses a danger-styled button and keeps both "cancel" and "home".

### 2.5 Support

`[دانلود برنامه 📱] [آموزش اتصال 📚]` / `[عیب‌یابی اتصال 🩺]` / one row per category "`<title> · <description>`" / `[خانه 🏠]`. Connection category asks for device, app, network type, operator, city, error text in one guided message; platform picker buttons read "`<OS> · <recommended app>`"; download screens list up to 6 official download links plus "tutorials for this OS". Ticket follow-ups have reply/close buttons; a reply lock prevents two admins answering at once.

### 2.6 Wallet, referral, reseller

Wallet: `[شارژ کیف پول 💳]`, `[مشاهده کیف پول در اپ 📱]`, `[تراکنش‌های اخیر 📜]`, `[به‌روزرسانی موجودی 🔄]`, home; top-up amounts as a 2x2 grid. Referral: `[جدول برترین‌ها 🏆]`, `[مشاهده زیرمجموعه‌ها 👥]`, `[به‌روزرسانی آمار 🔄]`, home. Reseller: `[خرید برای مشتری 🛒]`, `[شارژ کیف پول 💳]`, `[سرویس‌های من 🚀]`, `[لیست قیمت من 💰]`, `[رتبه نمایندگی 🏆]`, refresh, home.

### 2.7 What makes it low-friction

- **Every screen ends with "خانه 🏠"** and, in deep menus, a parent-return button; `user:home` clears FSM state so a stale receipt/support state never swallows the next message (release 2026-06-20).
- **Reply keyboard + inline keyboard together**: the persistent menu is always one tap away; inline keyboards carry context-specific actions.
- **One primary action per screen**, computed server-side (smart home "next action", service "next action").
- **Resume, don't duplicate**: pending invoices/payments are surfaced with "ادامه" buttons.
- **Copy buttons** (`copy_text`) for card numbers and subscription links; QR for every link.
- **Delivery verification loop**: "did you connect?" routes straight to diagnostics with the service pre-selected.
- **Guided support** collects the diagnostic fields before a human reads the ticket.
- **Sorting and filters** keep usable services first; destructive actions use danger-styled buttons and double exits.
- **No web dependency**: the Mini App is only suggested softly; everything can be done inside Telegram (a product rule in their docs).
- Weakness: Persian only; long menus (7 reply rows) on small phones; emoji-heavy labels; all copy is hardcoded in Python (no i18n layer).

---

## 3. The web app (`app.hexogate.com`) and public site (`hexogate.com`)

Stack: SvelteKit 2 / Svelte 5, Vite, `adapter-node`, `three` for the hero scene, Vitest + Playwright. A BFF route (`/bff/[...path]`) proxies to FastAPI and injects the session; Caddy routes `/api/*`, PWA files and brand assets to FastAPI and everything else to the SvelteKit server. `/react/*` (the old React frontend) redirects to `/`.

### 3.1 Route map

| Route | Mode | Content |
|---|---|---|
| `/` | host-aware | `hexogate.com` -> `PublicSite` (marketing); `app.hexogate.com` -> `PortalHome` (App Center) or `LoginScreen` |
| `/buy`, `/buy?test=1` | app | guided purchase (mode -> family -> plan -> payment -> card/receipt) |
| `/services` | app | service cards with configs, WireGuard files, actions, nickname |
| `/wallet` | app | balance, quick top-up grid, custom amount, card instructions, receipt upload, ledger |
| `/support`, `/support?section=reseller` | app | category grid, diagnostics form, my tickets, thread, reseller request |
| `/more` | app | redirects to `/` |
| `/admin` | app | owner shortcut (6th bottom-nav item for the owner) |
| `/management?role=user|reseller|admin` | desktop | role workspace (`ssr=false`), login screen when signed out. Note: returned 404 to the headless, logged-out probe from this network; it is documented as live in their release notes |
| `/[slug]` | public | `pricing`, `how-it-works`, `guides`, `support`, `status`, `updates`, `terms`, `privacy`, and `reseller` (hexogate.com only) |
| `/bff/*`, `/healthz`, `/robots.txt`, `/sitemap.xml` | infra | BFF proxy, health, SEO |

Customer API behind the BFF: bootstrap (user, services, payments, tickets, catalog, purchase families, auth capabilities), wallet ledger, plan recommendations, invoices, wallet top-up, test account, payment instructions, receipt upload, subscription configs / WireGuard conf / QR png / refresh / activate-reserve / stop / reactivate / import / nickname / calendar, support tickets + thread + messages + close, diagnostics, UX events.

### 3.2 Layout and navigation

- **App mode (mobile first):** a single `.mobile-frame` column; a **bottom navigation bar** with 5 items (خانه، خرید، سرویس‌ها، کیف پول، پشتیبانی) and a 6th "مدیریت اپ" for the owner; active item has a sliding accent underline and an icon pop (spring easing, disabled under `prefers-reduced-motion`). Each page opens with a "command hero" (title, one-line status, a primary and a secondary action), then panels in document flow (no cards-in-cards). Page entry animations via `use:reveal` / `use:stagger`.
- **Home (App Center):** greeting with the brand in gradient text; wallet badge and support pulse lines; **primary service card** (name, status label, remaining GB, expiry, location, "مدیریت و لینک‌ها" + "تمدید"); empty state "هنوز سرویسی فعال نیست" with "شروع تست رایگان"; quick-action board (buy, free test, reseller support); reseller "sales today" panel; owner "مرکز مالک" panel linking to the management console.
- **Desktop management:** left **role sidebar** (کاربر / نماینده / مدیریت اپ) with the brand on top; per-role priority action bar; admin **workspace tabs** with badge counts; a right-hand **detail drawer**; command search results; notification center; status bar. Breakpoints: mobile < 760, tablet < 1180, desktop < 1440, wide ≥ 1680. On phones the admin workspace collapses to a "mobile workspace bar" and a "mobile priority bar".
- **Public site:** sticky header (brand + 4 links: خانه، تعرفه‌ها، راهنمای اتصال، پشتیبانی; login pill on desktop; 44 px hamburger + glass drawer under 760 px with a 48 px min row height), hero with the 3D "gate wing" scene, wordmark, tagline "VPN سریع و قابل اعتماد، با تست رایگان قبل از خرید", three stacked CTAs on mobile (شروع تست رایگان -> bot deep link, مشاهده تعرفه‌ها, دانلود اپ اندروید), then sections: the two families, "why", four steps from test to connection, "everything in one account", "start on your device", short FAQ, final CTA, footer links (pricing, guides, terms, privacy).

### 3.3 Design system (live tokens, `tokens.css`)

| Token | Value |
|---|---|
| Theme | dark only (`color-scheme: dark`), background `#031d44`, surface `#082a58`, soft surface `#0a2f63`, deep `#051e46` |
| Text | `#dfeafa`, strong `#fefefe`, muted `#9fb8d8`, faint `#7590b6` |
| Accent | cyan-blue `#56c6ea` (accent-2 `#a5e2f6`), primary gradient `#9be9ff -> #51ccec` with dark ink `#03263a` on it |
| Semantic | success `#4fe0b0`, warning `#ffd479` (deep `#e8a33d`), danger `#ff9a8d`; each with `-soft` (12-14% tint) and `-border` (28-38%) variants |
| Glass | `rgba(7,42,90,.62)` + `backdrop-filter: blur(14px)`, border `rgba(190,228,244,.2)` |
| Radius | card 16, button 12, chip 10, input 12 (the 2026-07-01 design-system doc asked for max 8 px; the live "Lagoon/Aurora" theme moved to 12-16) |
| Type | **Vazirmatn variable** (self-hosted woff2, 100-900), fallback Tahoma/Arial; scale 11 / 12 / 13 / 15 / 16 / 18 / 20 / 24 / clamp(24-30) / clamp(28-40) / display clamp(34-68); weights 400 / 500 / 600 / 700 / 850; letter-spacing 0; no viewport-scaled body text |
| Spacing | 4, 8, 12, 16, 20, 24, 32, 40, 48, 64 |
| Motion | 160 / 240 / 480 ms; `ease-out cubic-bezier(.28,.9,.24,1)`, `ease-spring cubic-bezier(.34,1.56,.64,1)` |
| Elevation | 4 shadow levels, accent glows for primary actions |
| Components | `primary-action` (gradient pill), `secondary-action` (outlined glass), `compact-action`, `card`, `skeleton` + `hx-shimmer`, `form-state` / `form-error`, `StatusPill`, `Icon` (inline SVG set: home, cart, shield, support, grid, copy, upload, alert, check, ticket, user, search, monitor, wallet), `FlagIcon` (SVG flags for 13 countries), charts (`StatTile`, `Sparkline`, `LineAreaChart`, `BarListChart`, `ChartFrame`) |
| Family colouring | professional = blue/green border, economy = green, diamond (Germany) = amber/gold |

### 3.4 Mobile behaviour, RTL, PWA, auth

- `<html lang="fa" dir="rtl">` globally; logical CSS (`inset-inline`, `margin-inline-end`); numbers via `toLocaleString("fa-IR")`; dates with `Intl.DateTimeFormat("fa-IR")`; codes and links forced `dir="ltr"`.
- `viewport-fit=cover`, theme colour `#031d44`, safe-area aware bottom nav; no horizontal overflow on any captured page (checked at 390 px).
- Telegram Mini App: `telegram-web-app.js` is injected only when opened inside Telegram; BFF calls wait briefly for `initData`; direct deep opens to `/buy`, `/services`, `/wallet`, `/support` work.
- PWA: `display: standalone` + `window-controls-overlay`, shortcuts, offline fallback page, push notifications allow-listed to `/`, `/services`, `/buy`, `/support`.
- Login (see `app-login-phone.png`): "با تلگرام، در چند ثانیه وارد شوید"; primary "ورود با ربات تلگرام" (deep link), secondary "وب‌سایت Hexogate"; "ورود از همین مرورگر" = Telegram widget (loaded from telegram.org, fails visibly if blocked); "ورود با کد تلگرام" = pair code + QR + "تایید در تلگرام" + "کپی کد", polled every few seconds, expires; email magic link as a fallback.
- Observed in the headless capture: the home page logs one page error (likely the WebGL hero in headless Chrome); the `/pricing` page rendered its intro and benefit cards but no plan cards in the logged-out full-page capture (the plan list is hydrated from `/api/public/bootstrap`; verify in a real browser before copying the pattern).

### 3.5 Screenshots (`docs/hexogate/screens/`)

| File | What |
|---|---|
| `hexogate-home-desktop.png`, `hexogate-home-phone.png`, `hexogate-home-phone-full.png` | public landing: hero with the 3D gate wing, stacked CTAs, family comparison, steps, FAQ |
| `hexogate-pricing-desktop.png`, `hexogate-pricing-phone.png`, `hexogate-pricing-phone-full.png` | pricing page: intro card, "no hidden cost", "test before paying", footer |
| `hexogate-how-it-works-*.png` | four-step story page |
| `hexogate-guides-*.png` | per-device connection guides |
| `hexogate-support-*.png` | public support page |
| `app-login-desktop.png`, `app-login-phone.png`, `app-login-phone-full.png` | App Center login screen (Telegram, pair code, email) |
| `app-buy-loggedout-*.png` | `/buy` behind the login gate |

---

## 4. Side by side: Hexogate vs Afrows

Afrows baseline used: bot `@Afrows_bot` (inline-keyboard flow S0-S12 + v2 registration, gems, invite, connect; card-to-card top-up with photo receipt approved in the dashboard Top-up Requests page), `apps/client` customer panel (token login, quota, rewarded ads, route preference, per-app split tunnelling, config links), `apps/dashboard` (admin NOC + billing + reseller workspace, 24 pages, EN/FA, YekanBakh), `apps/web` landing (EN/FA "wave station" site).

| Feature | Hexogate | Afrows today | Gap | Recommendation |
|---|---|---|---|---|
| Languages | Persian only, copy hardcoded in Python/Svelte | **EN + FA typed i18n in bot, client, dashboard, web** | Afrows ahead | Keep; port Hexogate's Persian microcopy tone (short, warm, one verb per button) into `telegram-i18n.ts` |
| Onboarding | force-join, terms, referral parse, deep link to product | language pick, name + phone registration, referral deep link | Hexogate has terms + channel gate; Afrows collects phone (operator decision) | Adapt: add optional terms + channel gate as settings; keep registration |
| Home screen | smart home with computed primary action, counts, wallet, alerts | S3 account card (usage %, gems) + static main menu | Afrows has no "next action" logic or pending-action resume | **Adopt**: smart home + pending actions |
| Menu style | reply keyboard (persistent) + inline | inline only | Persistent menu is one tap from anywhere | Adapt: add a 3-4 row reply keyboard (buy / services / wallet / support) keeping inline screens |
| Catalog | 2 families with country flags, categories, test product per family, economy notice | flat package list | No family/country framing, no in-flow free test | Adapt: family -> plan with flag rows from the exits list; test product optional (v2 decision = no free trial) |
| Purchase | 3-step wizard, service name, invoice, wallet/card/mix, copy-card button, receipt photo or PDF, trusted auto-accept | package -> card instructions -> photo -> admin approval | No step indicator, no copy button, no wallet, no auto-accept | **Adopt** step indicator + `copy_text` card button + PDF receipts; adapt trusted auto-accept later |
| Wallet | toman wallet, top-up presets, ledger, mix payment | gems wallet (earned, redeem -> GB); no cash wallet | Different model: Hexogate = prepaid cash, Afrows = reward points | Adapt: add a cash wallet for resellers first (already has wallet ledger), keep gems for referral |
| Referral | 20% toman commission, leaderboard | gems hybrid (signup bonus, 20% of GB, milestones) | Afrows richer and abuse-guarded | Keep Afrows; add a leaderboard (display names only) |
| Services | list with filters/search/import, per-service hub, nickname, rotate link, stop/reactivate, transfer | S4 "My Configs" list with links + QR | Afrows has no per-service hub, renewals or self-service actions | **Adopt** the service hub (connect / renew / more) |
| Renewals | same plan, other plan, switch family, add traffic, time-only, suggestion, reminders | buy more data only (volume packages) | Time-based plans do not exist in Afrows (volume billing) | Adapt: "add traffic" is native; add "renew same package" shortcut + low-quota reminders; skip time-only |
| Delivery | panel + QR photo + copy caption + setup menu + "did you connect?" | config links per exit (germany/shatel/usa) + subscription + QR | Afrows lacks the setup menu and the connect check | **Adopt** post-purchase setup menu + delivery check |
| Support | 9-category wizard, diagnostics form, tickets with thread, canned replies, reply lock | none in bot (contact seller button) | Large gap | **Adopt** a reduced version: 5 categories, diagnostics prompt, ticket to admin chat + dashboard page |
| Downloads/tutorials | per-OS downloads, per-app tutorials, recommended app | `apps/web` has an "apps" section; bot has none | Gap in bot and client | Adopt as a static i18n table (OS -> app -> link -> steps) shared by bot and client |
| Web login | Telegram widget, pair code + QR, email link, Mini App auto-login, session list | paste a client token | Token paste is high friction and unsafe on shared devices | **Adopt** pair-code login via the bot (no telegram.org dependency); keep token as fallback |
| Web app shell | bottom nav, command hero per page, skeletons, reveal motion, PWA, push | one long page of panels, no nav, no PWA | Afrows client is a settings panel, not an app | **Adopt** bottom nav + page split; PWA manifest + offline page; push later |
| Routing control | none | automatic / country / server, route profiles (stability, throughput, gaming), per-app VPN | Afrows ahead (unique) | Keep as a "Route" tab inside Services |
| Rewarded data | none | rewarded-ad card with daily counters | Afrows ahead | Keep (move to Wallet page) |
| Public site | fa-only, dark, 3D hero, two families, four steps, guides, status, updates, terms, privacy, SEO per slug, Android download | EN/FA cinematic landing with pricing, apps, FAQ; no subpages | Afrows lacks guides / status / terms / privacy routes | Adapt: add `/guides`, `/status`, `/terms`, `/privacy` with the existing design; skip 3D |
| Admin web | dense command center, queues, drawer, search, badges, risk-tagged actions, ops brief | NOC dashboard, servers, routes, alerts, billing tabs, top-up queues, audit, reports | Afrows is broader on infrastructure; Hexogate is sharper on **sales queues** (receipts, support, provisioning) | Adapt: a "Queues" home for admins (pending receipts, failed deliveries, open tickets) with badge counts in the sidebar |
| Reseller | bot panel + web workspace + tenant bots + levels | dashboard seller workspace (per-GB sales, wallet, top-up requests) | No reseller surface in the bot; no tiers | Adapt: reseller panel in the bot (buy for customer, wallet, my price); skip tenant bots for now; consider tiers later |
| Trust/safety | receipts in private chat, encrypted tenant tokens, risk-tagged admin actions | write-only secrets, rate limits, no paid-number capture, privacy threat model | Both good; Afrows more explicit on privacy | Keep |
| Accessibility | 44-48 px targets, aria labels, reduced-motion, dark only | contrast checker, 44 px rule, RTL, light + dark tokens | Afrows has a contrast gate; Hexogate has richer motion discipline | Keep gate; add `prefers-reduced-motion` handling everywhere |
| QA | Playwright visual baselines, authenticated QA across 3 roles x 3 viewports, overflow checks | render-check skill, e2e dashboard visual spec | Comparable | Extend e2e to client app pages |

UI/UX quality notes:

- Hexogate's strongest ideas are **structural**: computed next action, pending-action resume, the three-way service hub, the delivery check, and the pair-code login. Its visual layer (glass, gradients, 3D hero) is polish, not the reason it converts.
- Hexogate's weak spots: Persian-only; the bot's 7-row reply keyboard is tall on small phones; admin surface is split between a bot menu and a very large desktop component (`DesktopManagement.svelte`, 3.1k lines); dark theme only; the design-system doc and the live tokens disagree (8 px vs 16 px radius).
- Afrows' strongest assets are bilingual typed copy, route intelligence exposed to the customer, the gems economy, and a stricter privacy posture. Its customer-facing surfaces are thin: the client panel is a single scrolling page behind a pasted token, and the bot has no services hub, wallet, support or downloads.

---

## 5. Proposed Afrows UI/UX target

### 5.1 Principles

1. Telegram first, web second: everything buyable and manageable inside the bot; the client app is the "better control center", suggested softly.
2. One primary action per screen, computed on the server (`nextAction` in the account summary API, shared via `packages/shared`).
3. Every screen has Home; stateful prompts have Back and Cancel; FSM state is cleared on Home.
4. Bilingual typed copy stays the rule (`telegram-i18n.ts`, `apps/client/src/i18n.ts`); Persian is written first, English second.
5. Reuse Afrows tokens (Tailwind, YekanBakh, 8 px radius, light + dark); do not import Hexogate's visual theme.

### 5.2 Bot v3 (build first)

| Order | Screen | Content |
|---|---|---|
| 1 | Smart home | greeting, usage %, gems, services count, `nextAction` button; rows: My services / Buy data; Wallet (gems) / Invite; Support / Help; persistent reply keyboard with 4 buttons (خرید، سرویس‌ها، کیف پول، پشتیبانی) |
| 2 | Buy wizard | step indicator "مرحله ۱ از ۳"; package list with GB and price; payment screen with `copy_text` card button, "request new card", "check status / send receipt"; accept photo or PDF; pending-action resume |
| 3 | Delivery + setup | summary panel, QR + copy caption for the subscription, setup menu (check service / connect & links / download app / tutorial), delivery check "وصل شدم / وصل نشدم" |
| 4 | Services hub | per-config card: status, remaining, last seen; Connect (QR / links / subscription / tutorial / rotate), Add data (packages), More (connection problem / stop); list filters when a user has more than one config |
| 5 | Support wizard | categories: connection, payment, add data, install, other; diagnostics prompt (device, app, ISP, city, error); ticket forwarded to admin chat and listed in a dashboard Tickets page with reply |
| 6 | Downloads and tutorials | OS picker -> recommended app -> official link -> 4-6 steps; one shared table used by bot and client |
| 7 | Reseller panel | buy for customer (per-GB), wallet balance + card top-up (existing approval queue), my customers, my price |

### 5.3 Client app ("Afrows App Center", `apps/client`)

| Page | Key content |
|---|---|
| Login | "Sign in with Telegram": pair code + QR approved in the bot (new backend endpoints `auth/pair/request|status|consume` contracted via `packages/shared`), fallback token paste |
| Home | greeting, primary config card (status, remaining GB, route), next action, quick actions (add data, invite, support), gems and rewarded-ad badge |
| Buy | package grid, payment method, card instructions with copy, receipt upload, status |
| Services | config cards with copy / open / share / QR, route tab (automatic / country / server, profile, per-app VPN moved here), WireGuard file where relevant |
| Wallet | gems balance, redeem -> GB, rewarded ads, invite stats, ledger |
| Support | category grid, diagnostics form, my tickets, thread; downloads and guides |
| Shell | bottom nav (Home, Buy, Services, Wallet, Support), command hero per page, skeleton states, `lang`/`dir` switch, PWA manifest + offline page, reduced-motion safe |

### 5.4 Public site and admin

- `apps/web`: add `/pricing` (live packages), `/guides` (per-device), `/status`, `/terms`, `/privacy` as routed pages in both languages; keep the existing design.
- `apps/dashboard`: an admin "Queues" landing card set (pending top-ups, open tickets, failed deliveries) with sidebar badge counts; a Tickets page; reseller-facing bot parity does not need new dashboard pages.

### 5.5 Build order

1. Bot: smart home + buy wizard polish (copy button, steps, resume) + delivery setup menu. Smallest change, biggest conversion effect.
2. Bot: services hub + support wizard + downloads table.
3. Client: pair-code login + bottom-nav shell + Home/Services/Buy pages (reuse the existing route and config components).
4. Client: Wallet + Support pages, PWA.
5. Web subpages, admin queues and tickets.
6. Later / skip: tenant bots, toman wallet for end users, time-only plans, 3D hero, dark-only theme.
