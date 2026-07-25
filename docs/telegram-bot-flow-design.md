# afroWS Telegram Bot — Conversational Flow Design (`@Afrows_bot`)

**Owner:** Bot Experience Design. **Implements against:** `docs/telegram-self-service-plan.md`.
**Status:** Design contract for the backend engineer. This document defines the *entire* user-facing
surface of the bot: screens, inline-keyboard layouts, callback-data keys, bilingual copy
(Persian + English) keyed by string id, and the per-user persisted state. The backend must not
invent user-facing strings or button layouts outside this spec.

Design principles (from the role brief):

- **Menu-driven.** Every screen is reachable by tapping inline-keyboard buttons. Slash commands
  (`/start`, `/menu`, `/charge`, `/status`, `/quota`, `/usage`, `/help`) remain as shortcuts only.
- **Low friction.** A brand-new user reaches a working, copyable VLESS config in **two taps**
  (`/start` → language button → welcome screen with config).
- **Bilingual parity.** Every string exists in Persian (`fa`) and English (`en`). Persian is
  first-class: natural phrasing, RTL-correct rendering (see §7).
- **No dead ends.** Every screen — including every error/empty state — has a button that returns
  to the main menu.
- **One primary action per screen.** Secondary actions (back/cancel) are visually last.

---

## 1. Flow diagram

Edge labels are the exact `callback_data` values (namespace `afws:` — see §6.1) or the
message-type trigger (`/start`, `photo`, admin action).

```mermaid
flowchart TD
    START(["/start (any text from unknown user)"]) -->|no language stored| S0[S0 Language picker]
    START -->|language stored, account exists| S2[S2 Main menu]

    S0 -->|afws:lang:fa| CREATE{account exists?}
    S0 -->|afws:lang:en| CREATE
    CREATE -->|no → create account + 1GB trial + VLESS config| S1[S1 Welcome + trial + config]
    CREATE -->|yes| S2

    S1 -->|afws:buy| S5[S5 Package picker]
    S1 -->|afws:menu| S2

    S2 -->|afws:acct| S3[S3 My Account card]
    S2 -->|afws:buy| S5
    S2 -->|afws:cfg| S4[S4 My Configs]
    S2 -->|afws:lang| S8[S8 Language settings]
    S2 -->|afws:help| S9[S9 Help]

    S3 -->|afws:acct:refresh| S3
    S3 -->|afws:menu| S2
    S3 -->|afws:buy| S5

    S4 -->|afws:cfg:refresh| S4
    S4 -->|afws:menu| S2

    S5 -->|afws:buy:pkg:ID| S6[S6 Payment instructions / awaiting receipt]
    S5 -->|afws:menu| S2
    S5 -->|no packages configured| E1[E1 No packages]
    S5 -->|card-to-card destination unset| E2[E2 Payment not configured]

    S6 -->|photo message| S7[S7 Receipt submitted]
    S6 -->|afws:buy:cancel| S5x[S6c Purchase cancelled] -->|afws:menu| S2
    S6 -->|afws:menu| S2

    S7 -->|afws:menu| S2
    S7 -.->|admin approves| N1[N1 Approved notification]
    S7 -.->|admin rejects| N2[N2 Rejected notification]

    N1 -->|afws:acct| S3
    N1 -->|afws:menu| S2
    N2 -->|afws:buy| S5
    N2 -->|afws:menu| S2

    S8 -->|afws:lang:fa / afws:lang:en| S8u[S8u Language updated] -->|afws:menu| S2

    S9 -->|afws:menu| S2

    PHOTO(["photo with no awaiting-receipt state"]) --> E3[E3 Photo without pending purchase]
    E3 -->|afws:buy| S5
    E3 -->|afws:menu| S2

    ERR(["any handler failure"]) --> E5[E5 Generic error]
    E5 -->|afws:retry| RETRY[re-run last-intent screen*]
    E5 -->|afws:menu| S2

    AMB(["account lookup ambiguous / broken link"]) --> E4[E4 Account problem]
    E4 -->|afws:menu| S2
```

\* `afws:retry` re-renders the screen the user was trying to reach; if the bot cannot determine it
(stateless nav), it renders S2. See §6.1.

Slash-command shortcuts map onto the same screens: `/menu` → S2, `/status` and `/usage` → S3,
`/quota` → S3, `/charge` → S5, `/help` → S9, `/language` → S8. An unknown command renders S9
(Help) prefixed with `error.unknownCommand`.

---

## 2. Screen-by-screen spec

Conventions used below:

- Message text is given by **copy id** (full bilingual text in §4). `{placeholders}` are
  interpolated by the backend (list in §6.4).
- Keyboard layouts are written row by row; each button is `label-copy-id → callback_data`.
- On `callback_query`, the backend must always `answerCallbackQuery` (empty, or with the toast
  noted per screen) and should **edit the originating message** (`editMessageText`) for
  navigation between S2–S9/E-screens, so the chat stays tidy. S1, S7, N1, N2 are **new**
  messages (they must persist in chat history: the config and the receipts trail).

### S0 — Language picker

Shown when a user with no stored `language` sends anything (including bare `/start`).
The prompt itself is bilingual (the only intentionally mixed-language message).

- Text: `lang.prompt`
- Keyboard:
  - Row 1: `lang.btn.fa → afws:lang:fa` | `lang.btn.en → afws:lang:en`

On tap: persist `language`, then — if no account is linked to this `telegram_id` — create the
self-service account (1 GB trial + VLESS config, idempotent per plan) and render **S1**;
otherwise render **S2**.

### S1 — Welcome + instant trial + config (new users only)

Sent as a **new message** (never edited away — the user must be able to scroll back to their
config). `parse_mode: HTML`; the config link is wrapped in `<code>…</code>` so a single tap
copies it in Telegram.

- Text: `welcome.new` (contains `{trialQuota}` and the `<code>{configLink}</code>` block)
- Keyboard:
  - Row 1: `buy.btn.open → afws:buy`
  - Row 2: `common.btn.menu → afws:menu`

If account creation succeeds but the config link cannot be generated, send `welcome.newNoConfig`
with the same keyboard plus Row 1 prepended: `cfg.btn.open → afws:cfg` (so the user can retry
fetching configs).

### S2 — Main menu

The hub. Rendered on `/start` for known users (with `welcome.back` as the text), on `/menu`,
and via every `afws:menu` button (with `menu.title` as the text).

- Text: `welcome.back` (on `/start`) or `menu.title` (all other entries)
- Keyboard (2-2-1... layout, primary actions on top):
  - Row 1: `menu.btn.account → afws:acct` | `menu.btn.buy → afws:buy`
  - Row 2: `menu.btn.configs → afws:cfg`
  - Row 3: `menu.btn.lang → afws:lang` | `menu.btn.help → afws:help`

### S3 — My Account card

At-a-glance status. `{status}` is itself localized via the `status.*` copy ids.
Quota lines: if the account is unlimited, use `acct.quotaUnlimited` in place of
`acct.quotaLine`.

- Text: `acct.card` (placeholders: `{status}`, `{remaining}`, `{total}`, `{used}`,
  `{activeClients}`, `{clientCount}`; if the account has an expiry, append `acct.expiryLine`
  with `{expiresAt}`)
- Keyboard:
  - Row 1: `common.btn.refresh → afws:acct:refresh`
  - Row 2: `menu.btn.buy → afws:buy`
  - Row 3: `common.btn.menu → afws:menu`

`afws:acct:refresh` re-fetches and edits the message in place; `answerCallbackQuery` toast:
`common.toast.refreshed`. If the content is unchanged (Telegram rejects no-op edits), only the
toast is shown.

### S4 — My Configs

Lists every active client config, each entry link in its own `<code>` block (tap-to-copy),
prefixed by its protocol + label line `cfg.itemHeader`. Keep total message under ~3500 chars;
if configs would overflow, paginate is **out of scope for v1** — truncate at 5 configs and
append `cfg.truncated`.

- Text: `cfg.title` + repeated `cfg.itemHeader` + `<code>{configLink}</code>` per config,
  then `cfg.importHint`
- Empty state (no configs): text `cfg.empty` instead, same keyboard.
- Keyboard:
  - Row 1: `common.btn.refresh → afws:cfg:refresh`
  - Row 2: `common.btn.menu → afws:menu`

### S5 — Buy Data: package picker

Packages come from the `volume_packages` catalog, sorted by size ascending, one button per row
(full-width tap targets; package names can be long in Persian).

- Text: `buy.pickPackage`
- Keyboard:
  - Rows 1..N (max 8 packages; if more exist, show the 8 smallest): each
    `buy.pkgBtn` (template `{size} — {price}`) `→ afws:buy:pkg:{volumePackageId}`
  - Last row: `common.btn.menu → afws:menu`

Pre-checks, in order:
1. No packages configured → render **E1** instead.
2. Card-to-card destination unset in settings → render **E2** instead (fail *before* the user
   picks a package, not after).

If the user already has an `awaiting_receipt` purchase in progress, render **S6** directly
(resuming it) with line `buy.resumeNote` prepended. If the user has a submitted-but-unreviewed
request, still allow a new purchase but prepend `buy.pendingApprovalNote` (`{requestId}`) to S5.

### S6 — Payment instructions / awaiting receipt

Entered from `afws:buy:pkg:{id}`. The backend persists the in-progress charge
(§5) before rendering. Card number must be ASCII digits grouped in 4s
(`6037 9911 2233 4455`) on its own line inside `<code>` (tap-to-copy).

- Text: `buy.payment` (placeholders: `{packageSize}`, `{amount}`,
  `<code>{cardNumber}</code>`, `{cardHolder}`)
- Keyboard:
  - Row 1: `buy.btn.cancel → afws:buy:cancel`
  - Row 2: `common.btn.menu → afws:menu`

Behavior notes:
- `afws:menu` does **not** cancel the in-progress charge — the user may pay first and send the
  photo later. The charge stays valid for **24 h** (`AWAITING_RECEIPT_TTL`), after which a photo
  falls through to **E3**.
- `afws:buy:cancel` clears the in-progress charge, edits the message to `buy.cancelled` with
  keyboard Row 1: `buy.btn.open → afws:buy`, Row 2: `common.btn.menu → afws:menu`, and toasts
  `buy.toast.cancelled`.
- A **document**-type image (file, not photo) while awaiting receipt → reply `buy.needPhoto`
  (keep the state; same keyboard as S6).
- Text messages while awaiting receipt are answered normally (commands/menu still work); the
  state persists.

### S7 — Receipt submitted

Triggered by a `photo` message while an `awaiting_receipt` charge exists. Backend creates the
`telegram_topup_requests` row (status `pending`, storing the largest `photo` size's `file_id`),
clears the in-progress state, then sends this as a **new message**.

- Text: `buy.submitted` (placeholder: `{requestId}`)
- Keyboard:
  - Row 1: `common.btn.menu → afws:menu`

### N1 — Approved notification (pushed on admin approve)

New message pushed to the user's `telegram_chat_id`, in the user's stored language.

- Text: `notify.approved` (placeholders: `{requestId}`, `{packageSize}`)
- Keyboard:
  - Row 1: `menu.btn.account → afws:acct`
  - Row 2: `common.btn.menu → afws:menu`

### N2 — Rejected notification (pushed on admin reject)

- Text: `notify.rejected` (placeholders: `{requestId}`, `{reason}` — the admin's review note;
  if empty, substitute `notify.noReason`)
- Keyboard:
  - Row 1: `buy.btn.retry → afws:buy`
  - Row 2: `common.btn.menu → afws:menu`

### S8 — Language settings

- Text: `lang.settings` (mentions the current language)
- Keyboard:
  - Row 1: `lang.btn.fa → afws:lang:fa` | `lang.btn.en → afws:lang:en`
  - Row 2: `common.btn.menu → afws:menu`

On tap: persist, edit message to `lang.updated` (rendered **in the newly chosen language**)
with keyboard Row 1: `common.btn.menu → afws:menu`. Toast: `lang.toast`.

### S9 — Help

- Text: `help.body` (placeholder: `{supportContact}`, from settings; if unset, drop the
  support line)
- Keyboard:
  - Row 1: `menu.btn.buy → afws:buy` | `menu.btn.account → afws:acct`
  - Row 2: `common.btn.menu → afws:menu`

### Error / empty states

Every error screen keeps the user one tap from the menu.

| Id | Trigger | Text | Keyboard |
|----|---------|------|----------|
| **E1** No packages | S5 entry, empty catalog | `error.noPackages` | Row 1: `common.btn.menu → afws:menu` |
| **E2** Payment not configured | S5/S6 entry, card-to-card setting unset | `error.cardUnset` | Row 1: `common.btn.menu → afws:menu` |
| **E3** Photo without pending purchase | `photo` received, no `awaiting_receipt` state (or state expired) | `error.photoNoCharge` | Row 1: `buy.btn.open → afws:buy` · Row 2: `common.btn.menu → afws:menu` |
| **E4** Account problem | linked-account lookup returns `ambiguous`, or account row is missing/broken for a known telegram id | `error.accountProblem` | Row 1: `common.btn.menu → afws:menu` |
| **E5** Generic / network error | any unexpected failure while building a reply | `error.generic` | Row 1: `common.btn.retry → afws:retry` · Row 2: `common.btn.menu → afws:menu` |
| **E6** Unknown command | unrecognized slash command | `error.unknownCommand` + `help.body` | as S9 |
| **E7** Stale button | `callback_query` with unknown/retired data, or acting on an outdated message | toast `error.staleButton` (via `answerCallbackQuery` only, `show_alert: false`), then send S2 | — |

---

## 3. Tap-count sanity check (low-friction goals)

- New user → working config: `/start` → 1 tap (language) → config on screen (copyable). **1 tap.**
- Any user → paid data: menu → Buy Data → package → pay → send photo. **2 taps + 1 photo.**
- Any screen → main menu: **1 tap.**

---

## 4. Bilingual copy table

Copy lives in a **typed i18n map** keyed by these ids (per `docs/multilingual-ui.md`: both
languages in one typed object so TypeScript catches gaps). `\n` marks line breaks.
`{placeholders}` are interpolated verbatim (see §6.4). HTML (`<b>`, `<code>`) is part of the
string; backend must send `parse_mode: 'HTML'` and escape interpolated values.

Persian conventions used below: warm, spoken-but-polite register («شما»), Persian digits in
prose via the number formatter, ASCII digits for card numbers / config links / request ids
(see §7).

| String id | English (`en`) | Persian (`fa`) |
|---|---|---|
| `lang.prompt` | Hi! 👋 Welcome to <b>afroWS</b>.\nPlease choose your language:\n\nسلام! 👋 به <b>afroWS</b> خوش آمدید.\nلطفاً زبان خود را انتخاب کنید: | *(same bilingual string — used before a language exists)* |
| `lang.btn.fa` | فارسی 🇮🇷 | فارسی 🇮🇷 |
| `lang.btn.en` | English 🇬🇧 | English 🇬🇧 |
| `lang.settings` | 🌐 Language\nYour current language is <b>English</b>. Pick a language: | 🌐 زبان\nزبان فعلی شما <b>فارسی</b> است. زبان مورد نظر را انتخاب کنید: |
| `lang.updated` | Language set to English. ✅ | زبان به فارسی تغییر کرد. ✅ |
| `lang.toast` | Language updated ✅ | زبان تغییر کرد ✅ |
| `welcome.new` | 🎉 You're in!\nYour afroWS account is ready, with a free <b>{trialQuota}</b> trial already loaded.\n\nHere's your VLESS config — tap it once to copy:\n<code>{configLink}</code>\n\nImport it into your VPN app (e.g. v2rayNG or Streisand) and connect.\nWhen you need more data, tap <b>Buy Data</b> below. | 🎉 خوش آمدید!\nحساب afroWS شما ساخته شد و <b>{trialQuota}</b> حجم هدیه هم برایتان فعال است.\n\nاین کانفیگ VLESS شماست — یک بار رویش بزنید تا کپی شود:\n<code>{configLink}</code>\n\nآن را در اپ VPN خود (مثل v2rayNG یا Streisand) وارد کنید و وصل شوید.\nهر وقت حجم بیشتری خواستید، از دکمهٔ «خرید حجم» استفاده کنید. |
| `welcome.newNoConfig` | 🎉 You're in! Your afroWS account is ready with a free <b>{trialQuota}</b> trial.\nYour config is being prepared — tap <b>My Configs</b> in a moment to grab it. | 🎉 خوش آمدید! حساب afroWS شما با <b>{trialQuota}</b> حجم هدیه ساخته شد.\nکانفیگ شما در حال آماده‌سازی است — کمی بعد از «کانفیگ‌های من» آن را بردارید. |
| `welcome.back` | Welcome back! 👋 What would you like to do? | خوش برگشتید! 👋 چه کاری برایتان انجام دهیم؟ |
| `menu.title` | 🏠 Main menu — pick an option: | 🏠 منوی اصلی — یک گزینه را انتخاب کنید: |
| `menu.btn.account` | 👤 My Account | 👤 حساب من |
| `menu.btn.buy` | 🛒 Buy Data | 🛒 خرید حجم |
| `menu.btn.configs` | 🔗 My Configs | 🔗 کانفیگ‌های من |
| `menu.btn.lang` | 🌐 Language | 🌐 زبان |
| `menu.btn.help` | ❓ Help | ❓ راهنما |
| `acct.card` | 👤 <b>Your account</b>\nStatus: {status}\n{quotaLine}\nUsed: {used}\nActive configs: {activeClients}/{clientCount} | 👤 <b>حساب شما</b>\nوضعیت: {status}\n{quotaLine}\nمصرف‌شده: {used}\nکانفیگ‌های فعال: {activeClients} از {clientCount} |
| `acct.quotaLine` | Data left: <b>{remaining}</b> of {total} | حجم باقی‌مانده: <b>{remaining}</b> از {total} |
| `acct.quotaUnlimited` | Data: Unlimited | حجم: نامحدود |
| `acct.expiryLine` | Expires: {expiresAt} | تاریخ انقضا: {expiresAt} |
| `status.active` | Active ✅ | فعال ✅ |
| `status.suspended` | Suspended ⏸ | معلق ⏸ |
| `status.expired` | Expired ⌛ | منقضی ⌛ |
| `status.disabled` | Disabled 🚫 | غیرفعال 🚫 |
| `cfg.title` | 🔗 <b>Your configs</b>\nTap any config once to copy it: | 🔗 <b>کانفیگ‌های شما</b>\nروی هر کانفیگ یک بار بزنید تا کپی شود: |
| `cfg.itemHeader` | • {protocol} — {label} | • {protocol} — {label} |
| `cfg.importHint` | Import the copied link into your VPN app (e.g. v2rayNG) and connect. | لینک کپی‌شده را در اپ VPN خود (مثل v2rayNG) وارد کنید و وصل شوید. |
| `cfg.truncated` | …and more. Contact support to see the rest. | …و موارد دیگر. برای دیدن بقیه با پشتیبانی در تماس باشید. |
| `cfg.empty` | You don't have any configs yet. 🙈\nBuy a data package and we'll set one up for you right away. | هنوز کانفیگی ندارید. 🙈\nیک بستهٔ حجمی بخرید تا بلافاصله برایتان بسازیم. |
| `cfg.btn.open` | 🔗 My Configs | 🔗 کانفیگ‌های من |
| `buy.btn.open` | 🛒 Buy Data | 🛒 خرید حجم |
| `buy.pickPackage` | 🛒 <b>Buy Data</b>\nPick a package — you'll get the payment details next: | 🛒 <b>خرید حجم</b>\nیک بسته را انتخاب کنید — در مرحلهٔ بعد اطلاعات پرداخت را می‌بینید: |
| `buy.pkgBtn` | {size} — {price} | {size} — {price} |
| `buy.pendingApprovalNote` | ℹ️ Your previous request #{requestId} is still awaiting approval. | ℹ️ درخواست قبلی شما (شمارهٔ {requestId}) هنوز در انتظار تأیید است. |
| `buy.resumeNote` | ℹ️ You have an unfinished purchase — here are the payment details again: | ℹ️ یک خرید نیمه‌تمام دارید — این هم دوبارهٔ اطلاعات پرداخت: |
| `buy.payment` | 🧾 <b>Order:</b> {packageSize} — <b>{amount}</b>\n\nPlease transfer card-to-card to:\n💳 <code>{cardNumber}</code>\nName: <b>{cardHolder}</b>\n\nThen send a <b>photo of the receipt</b> right here. 📸\nOnce an admin approves it, the data is added to your account. | 🧾 <b>سفارش:</b> {packageSize} — <b>{amount}</b>\n\nلطفاً مبلغ را کارت‌به‌کارت واریز کنید:\n💳 <code>{cardNumber}</code>\nبه نام: <b>{cardHolder}</b>\n\nسپس <b>عکس رسید</b> را همین‌جا بفرستید. 📸\nبعد از تأیید مدیر، حجم به حساب شما اضافه می‌شود. |
| `buy.needPhoto` | Please send the receipt as a <b>photo</b> (not a file), so we can review it. 📸 | لطفاً رسید را به‌صورت <b>عکس</b> بفرستید (نه فایل) تا بتوانیم بررسی‌اش کنیم. 📸 |
| `buy.submitted` | ✅ Got your receipt!\nRequest <b>#{requestId}</b> is submitted and awaiting admin approval.\nWe'll message you here as soon as it's reviewed. | ✅ رسید شما رسید!\nدرخواست <b>شمارهٔ {requestId}</b> ثبت شد و در انتظار تأیید مدیر است.\nبه‌محض بررسی، همین‌جا به شما خبر می‌دهیم. |
| `buy.cancelled` | Purchase cancelled. No worries — come back any time. 🙂 | خرید لغو شد. اشکالی ندارد — هر وقت خواستید دوباره سر بزنید. 🙂 |
| `buy.btn.cancel` | ❌ Cancel purchase | ❌ انصراف از خرید |
| `buy.btn.retry` | 🛒 Try again | 🛒 تلاش دوباره |
| `buy.toast.cancelled` | Purchase cancelled | خرید لغو شد |
| `notify.approved` | ✅ Request <b>#{requestId}</b> approved — <b>{packageSize}</b> has been added to your account. Enjoy! 🎉 | ✅ درخواست <b>شمارهٔ {requestId}</b> تأیید شد و <b>{packageSize}</b> به حساب شما اضافه شد. نوش جان! 🎉 |
| `notify.rejected` | ❌ Request <b>#{requestId}</b> was not approved.\nReason: {reason}\nIf you think this is a mistake, try again or contact support. | ❌ درخواست <b>شمارهٔ {requestId}</b> تأیید نشد.\nدلیل: {reason}\nاگر فکر می‌کنید اشتباهی پیش آمده، دوباره تلاش کنید یا با پشتیبانی در تماس باشید. |
| `notify.noReason` | Not specified | ذکر نشده |
| `help.body` | ❓ <b>How afroWS works</b>\n• <b>My Account</b> — your status and remaining data.\n• <b>Buy Data</b> — pick a package, pay card-to-card, send the receipt photo; an admin approves it and your data is added.\n• <b>My Configs</b> — your connection links, tap to copy.\n\nSupport: {supportContact} | ❓ <b>afroWS چطور کار می‌کند؟</b>\n• <b>حساب من</b> — وضعیت و حجم باقی‌ماندهٔ شما.\n• <b>خرید حجم</b> — یک بسته انتخاب کنید، کارت‌به‌کارت پرداخت کنید و عکس رسید را بفرستید؛ بعد از تأیید مدیر، حجم اضافه می‌شود.\n• <b>کانفیگ‌های من</b> — لینک‌های اتصال شما؛ با یک لمس کپی می‌شوند.\n\nپشتیبانی: {supportContact} |
| `common.btn.menu` | 🏠 Main menu | 🏠 منوی اصلی |
| `common.btn.refresh` | 🔄 Refresh | 🔄 به‌روزرسانی |
| `common.btn.retry` | 🔁 Try again | 🔁 تلاش دوباره |
| `common.toast.refreshed` | Updated ✅ | به‌روز شد ✅ |
| `error.noPackages` | No data packages are available right now. 🙏\nPlease check back a little later. | فعلاً بسته‌ای برای فروش موجود نیست. 🙏\nلطفاً کمی بعد دوباره سر بزنید. |
| `error.cardUnset` | Payments aren't set up yet. 🙏\nPlease try again later — we're on it. | پرداخت هنوز راه‌اندازی نشده است. 🙏\nلطفاً کمی بعد دوباره تلاش کنید — در حال آماده‌سازی هستیم. |
| `error.photoNoCharge` | Thanks for the photo — but there's no purchase in progress. 🤔\nStart one with <b>Buy Data</b>, then send the receipt. | ممنون از عکس — ولی خرید فعالی در جریان نیست. 🤔\nاول از «خرید حجم» شروع کنید، بعد رسید را بفرستید. |
| `error.accountProblem` | There's a problem with your account link. 😕\nPlease contact support so we can fix it for you. | مشکلی در اتصال حساب شما وجود دارد. 😕\nلطفاً با پشتیبانی در تماس باشید تا برایتان درستش کنیم. |
| `error.generic` | Something went wrong on our side. 😕\nPlease try again. | مشکلی از سمت ما پیش آمد. 😕\nلطفاً دوباره تلاش کنید. |
| `error.unknownCommand` | I didn't recognize that command — here's what I can do: | این دستور را نشناختم — این کارها از من برمی‌آید: |
| `error.staleButton` | This menu is outdated — sending a fresh one. | این منو قدیمی شده — منوی تازه فرستادیم. |

Notes for the implementer:

- `lang.prompt` is a single bilingual string (rendered identically for both language values;
  it is only ever shown pre-choice).
- `acct.card` composes `{quotaLine}` from `acct.quotaLine` or `acct.quotaUnlimited`, and
  `{status}` from the `status.*` ids — never raw enum values.
- `buy.pkgBtn` is a **button label template**; `{size}` like «۲۰ گیگابایت» / “20 GB”,
  `{price}` includes the localized currency word (e.g. «۹۰٬۰۰۰ تومان» / “90,000 Toman”).
- `notify.rejected` substitutes `notify.noReason` when the admin left no note.

---

## 5. Per-user state model

Everything the bot must remember lives in one row per Telegram user
(new table `telegram_bot_users` or equivalent — naming is the backend's call, fields are not):

| Field | Type | Meaning |
|---|---|---|
| `telegram_id` | text, PK | Telegram numeric user id |
| `chat_id` | text | last known private chat id (for push notifications N1/N2) |
| `language` | `'fa' \| 'en' \| null` | null → show S0 on next contact |
| `pending_package_id` | fk `volume_packages` nullable | the package of the in-progress charge |
| `pending_amount_minor` | int nullable | price snapshot at pick time |
| `pending_currency` | text nullable | currency snapshot |
| `pending_started_at` | timestamp nullable | for the 24 h `AWAITING_RECEIPT_TTL` |
| `updated_at` | timestamp | bookkeeping |

Derived state (no extra column): `awaiting_receipt` ⇔ `pending_package_id IS NOT NULL AND
pending_started_at > now() - 24h`.

State transitions:

```
(no row) --any message--> row created, language=null  → S0
language=null --afws:lang:*--> language set           → S1 (new account) or S2
idle --afws:buy:pkg:ID--> awaiting_receipt            → S6   (pending_* set)
awaiting_receipt --photo--> idle                      → S7   (pending_* cleared; topup row created: status=pending)
awaiting_receipt --afws:buy:cancel--> idle            → S6c  (pending_* cleared)
awaiting_receipt --24h elapse--> idle (lazy expiry)   → photo now yields E3
topup pending --admin approve--> (push N1)            (topup row: approved; quota credited)
topup pending --admin reject--> (push N2)             (topup row: rejected + review_note)
awaiting_receipt --afws:buy:pkg:ID2--> awaiting_receipt (pending_* overwritten — user changed their mind)
```

Navigation itself is **stateless**: every button's `callback_data` fully identifies the target
screen, so no "current screen" is persisted. The only session-like state is the pending charge
above. The submitted-receipt lifecycle lives in `telegram_topup_requests`
(per plan: `pending | approved | rejected`), not here.

Language resolution rule for **every** outgoing message, including admin-triggered pushes
(N1/N2): use `telegram_bot_users.language`; if somehow null, fall back to `fa`.

---

## 6. Backend contract

### 6.1 Callback-data namespace

All bot buttons use the `afws:` prefix (fits Telegram's 64-byte `callback_data` limit with
room to spare). Any `callback_query` whose data does not start with `afws:` or is not in this
table → **E7** (stale-button toast + fresh S2).

| `callback_data` | Meaning / renders |
|---|---|
| `afws:lang:fa` | set language to Persian → S1 (new) / S2 / `lang.updated` (from S8) |
| `afws:lang:en` | set language to English → same |
| `afws:menu` | render S2 |
| `afws:acct` | render S3 |
| `afws:acct:refresh` | re-fetch + edit S3 in place |
| `afws:cfg` | render S4 |
| `afws:cfg:refresh` | re-fetch + edit S4 in place |
| `afws:buy` | render S5 (or E1/E2/S6-resume per §2-S5) |
| `afws:buy:pkg:{id}` | `{id}` = `volume_packages.id` (ASCII, ≤ 32 chars) → persist pending charge, render S6 |
| `afws:buy:cancel` | clear pending charge → S6c |
| `afws:lang` | render S8 |
| `afws:help` | render S9 |
| `afws:retry` | re-render the screen whose handler failed if known, else S2 |

### 6.2 Copy-string ids (complete set)

`lang.prompt`, `lang.btn.fa`, `lang.btn.en`, `lang.settings`, `lang.updated`, `lang.toast`,
`welcome.new`, `welcome.newNoConfig`, `welcome.back`,
`menu.title`, `menu.btn.account`, `menu.btn.buy`, `menu.btn.configs`, `menu.btn.lang`, `menu.btn.help`,
`acct.card`, `acct.quotaLine`, `acct.quotaUnlimited`, `acct.expiryLine`,
`status.active`, `status.suspended`, `status.expired`, `status.disabled`,
`cfg.title`, `cfg.itemHeader`, `cfg.importHint`, `cfg.truncated`, `cfg.empty`, `cfg.btn.open`,
`buy.btn.open`, `buy.pickPackage`, `buy.pkgBtn`, `buy.pendingApprovalNote`, `buy.resumeNote`,
`buy.payment`, `buy.needPhoto`, `buy.submitted`, `buy.cancelled`, `buy.btn.cancel`,
`buy.btn.retry`, `buy.toast.cancelled`,
`notify.approved`, `notify.rejected`, `notify.noReason`,
`help.body`,
`common.btn.menu`, `common.btn.refresh`, `common.btn.retry`, `common.toast.refreshed`,
`error.noPackages`, `error.cardUnset`, `error.photoNoCharge`, `error.accountProblem`,
`error.generic`, `error.unknownCommand`, `error.staleButton`.

Type them as one map — `Record<CopyId, { en: string; fa: string }>` — per
`docs/multilingual-ui.md`, so a missing translation is a compile error.

### 6.3 Persisted fields

Per-user (see §5): `telegram_id`, `chat_id`, `language`, `pending_package_id`,
`pending_amount_minor`, `pending_currency`, `pending_started_at`, `updated_at`.
Plus the plan's `telegram_topup_requests` table (unchanged from
`docs/telegram-self-service-plan.md`).

### 6.4 Interpolation placeholders

`{trialQuota}`, `{configLink}`, `{status}`, `{quotaLine}`, `{remaining}`, `{total}`, `{used}`,
`{activeClients}`, `{clientCount}`, `{expiresAt}`, `{protocol}`, `{label}`, `{size}`,
`{price}`, `{packageSize}`, `{amount}`, `{cardNumber}`, `{cardHolder}`, `{requestId}`,
`{reason}`, `{supportContact}`.
All interpolated values must be HTML-escaped before substitution (config links, labels, and
admin-typed rejection reasons may contain `<`, `&`, etc.).

### 6.5 Required Telegram API capabilities (gaps vs. today's code)

The current `TelegramAlertService.sendMessage` (`apps/backend/src/notifications/telegram-alert.service.ts`)
sends plain text only, and `TelegramBotService.handleUpdate`
(`apps/backend/src/telegram/telegram-bot.service.ts`) handles only text `message` updates.
This design additionally requires (stated as UX-driven needs — implementation is the backend's):

1. `sendMessage` with `parse_mode: 'HTML'` and `reply_markup` (inline keyboard).
2. Handling `callback_query` updates: dispatch on `callback_data`, always `answerCallbackQuery`
   (with the per-screen toast where specified).
3. `editMessageText` for in-place navigation (S2–S9, E-screens) — fall back to sending a new
   message if the edit fails (e.g. message too old).
4. Handling `photo` messages (store largest size's `file_id`) and, for `document` images while
   awaiting receipt, replying `buy.needPhoto`.
5. Push messages to `chat_id` on admin approve/reject (N1/N2), localized via the stored
   `language`.

Never log or echo the bot token or the raw card number outside the intended payment message.

---

## 7. Persian / RTL rendering rules

1. **One language per message** (except `lang.prompt`). No mixed-language sentences.
2. **Directionality guard:** any Persian message line that *begins* with an emoji, Latin word,
   or digit must be prefixed with U+200F (RLM) by the render layer so Telegram lays the line
   out RTL. Lines beginning with a Persian letter need nothing.
3. **Digits:** Persian prose uses Persian digits via a locale formatter
   (`۲۰ گیگابایت`, `۹۰٬۰۰۰ تومان`, `۱٫۵ گیگابایت باقی‌مانده`). Always-ASCII exceptions —
   card number, config links, request id inside `#{requestId}` in the English copy (Persian
   copy spells it «شمارهٔ ۱۲», localized digits are fine there since it is prose).
4. **Copyable payloads** (`{configLink}`, `{cardNumber}`) always sit in `<code>` on their own
   line, never inline inside a Persian sentence — this both aids tap-to-copy and avoids bidi
   scrambling.
5. **Units:** Persian uses «گیگابایت / مگابایت» spelled out; English uses GB/MB. Sizes use
   decimal units consistently with billing (1 GB = 1,000,000,000 bytes) — the bot must not
   display a different number than the dashboard for the same quota.
6. **Punctuation:** Persian copy uses Persian comma (،), the ٔ where orthographically correct
   («شمارهٔ», «دکمهٔ»), and ZWNJ (نیم‌فاصله) in compounds («باقی‌مانده», «به‌روزرسانی»,
   «کارت‌به‌کارت») — already applied in §4; keep it when editing copy.
7. **Buttons:** labels stay short (≤ 20 chars) so they don't truncate on narrow phones; emoji
   leads in English labels and trails or leads consistently in Persian as written in §4 —
   don't restyle ad hoc.

---

## 8. Open questions (non-blocking, flagged to the operator)

1. `{supportContact}` — which handle should Help show? (Settings field suggested; drop the
   line if unset.)
2. Trial size copy uses `{trialQuota}` so the env-configurable size (plan default 1 GB) never
   drifts from the actual credit.
3. If more than 8 packages ever exist, S5 needs pagination — out of scope for v1 by design.
