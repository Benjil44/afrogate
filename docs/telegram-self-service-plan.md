# afroWS Telegram Bot — Self-Service (create account + top-up) Plan

**Decisions (operator, 2026-07-25):**
- **Bot:** `@Afrows_bot` (t.me/Afrows_bot). Token stored ONLY in the encrypted vault via Settings → Telegram — never in code/repo/chat. (Operator must rotate the token in BotFather after it was pasted in chat.)
- **Charge** = manual card-to-card receipt → **admin approves** in the dashboard (no online gateway; suits Iran).
- **New accounts** = **instant self-serve** with a **1 GB** trial quota (decimal, 1_000_000_000 bytes), default protocol **VLESS**, linked to the Telegram id.

**Already built (reuse, do NOT rebuild):** `apps/backend/src/telegram/` — secured webhook (`POST /telegram/webhook` + secret), encrypted BotFather token storage, superadmin **Settings → Telegram** (paste token, `getMe` test, enable commands, allowed-admin chat ids), alert sender (`TelegramAlertService.sendMessage`), and read-only commands `/status /quota /usage /help` for accounts linked by `telegram_id`/`telegram_username`. `billing.getTelegramBotAccountStatus()` maps a Telegram user → customer account.

**Operator prerequisites (cannot be automated — creating the bot + handling its token):**
1. @BotFather → `/newbot` → name **afroWS**, username `@afroWS_bot` (or similar). Copy the token.
2. Dashboard → Settings → Telegram → paste token → **Test** → enable **commands**. Add `@haniezamani75` (numeric id) to allowed-admin chat ids.
3. Set the webhook to `https://<afrows>/api/telegram/webhook` (NOTE the `/api` prefix — the backend uses `setGlobalPrefix('api')`; `/telegram/webhook` returns 405) with the stored secret. Exact call: `https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://app.afrows.com/api/telegram/webhook&secret_token=<WEBHOOK_SECRET>` — the `secret_token` must equal the saved "Webhook secret".
4. Fill the new **card-to-card destination** setting (card number + holder name) — shown to users in the charge flow. Entered in the dashboard, never in code.

---

## Feature 1 — Instant self-serve account creation

**Trigger:** an *unlinked* Telegram user sends `/start` (or `/signup`).
- If their `telegram_id` already maps to a customer account → reply with `/status`.
- Else, in one transaction: create `customer_accounts` row (status `active`, `telegram_id` + `telegram_username` set, `egress_tier='normal'`, trial quota = `AFROWS_TELEGRAM_TRIAL_QUOTA_BYTES`, default **1 GB decimal** = 1_000_000_000), then create a default **VLESS** client config. **Idempotent on `telegram_id`** (unique-ish guard so double-`/start` doesn't make duplicates).
- Reply: welcome + trial quota + the VLESS entry link (`getClientConfigEntryLink`). Offer `/charge` to add data.

**Backend:** new `createTelegramSelfServiceAccount({telegramId, telegramUsername})` (own module `telegram-self-service.ts`, called by the bot service; reuses existing account+config creation internals rather than editing `createCustomerAccount` in place). Trial size configurable via env/settings.

## Feature 2 — Top-up (manual receipt → admin approval)

**Bot flow (text-command MVP; inline keyboards optional later):**
1. `/charge` → bot lists volume packages from `volume_packages` (number, size, price). User replies `/charge <n>` to pick.
2. Bot replies with the **card-to-card destination** (from settings) + amount, and asks for the **receipt photo**.
3. User sends a photo → bot stores a **pending top-up request** capturing: linked `customer_account_id`, `telegram_id`, chosen `volume_package_id`, amount/currency, and the Telegram **photo `file_id`**. Bot: "Request #N submitted, pending approval."

**New table `telegram_topup_requests`:** `id, customer_account_id, telegram_id, telegram_chat_id, volume_package_id, amount_minor, currency, receipt_file_id, status (pending|approved|rejected), created_at, reviewed_by, reviewed_at, review_note`. Migration `00NN`.

**Admin dashboard — dedicated "Top-up Requests" PAGE (its own sidebar item, e.g. under Billing).** This is the operator's approval queue for the card-to-card receipts.
- **Card/list per request** showing: customer (display name + Telegram @username/id), chosen package + amount/currency, submitted-at, status, and the **receipt photo the user sent** rendered inline (thumbnail → click to enlarge). Default filter = pending; can view approved/rejected history too. A pending badge/count in the nav so new receipts are noticed.
- The receipt image is served through a **backend proxy** (`getFile` → download using the vault token server-side); the bot token is NEVER exposed to the browser and the image URL is admin-authenticated.
- **Approve** → credit the account by applying the chosen volume package (reuse the existing package-sale / quota-credit path), mark `approved`, and push a bot message "✅ <size> added". **Reject** (with a reason) → mark `rejected`, notify the user in the bot. Both actions are audited.
- Endpoints (`@Roles('admin')`): `GET /admin/telegram/topups?status=pending|approved|rejected|all`, `POST /admin/telegram/topups/:id/approve`, `POST /admin/telegram/topups/:id/reject` (body: reason), `GET /admin/telegram/topups/:id/receipt` (authenticated image proxy).
- Frontend: new `TopupRequestsPage.tsx` + a sidebar entry (with pending count) + i18n (EN/FA).

**Bot webhook additions:** handle `photo` messages (currently text-only) and correlate to the user's in-progress charge (store a short-lived "awaiting receipt for package X" state per telegram_id, or accept the most recent pending-without-receipt request). Add `/charge` to the command parser + help.

---

## Build order (after the current Customers table batch lands, to avoid billing.service.ts conflicts)
1. Migration + `telegram_topup_requests` + shared types.
2. Backend: self-service account creation; `/charge` + photo handling in bot; topup request create; admin list/approve/reject/receipt-proxy + credit logic.
3. Frontend: admin Top-up Requests UI (list + receipt view + approve/reject); a Settings field for the card-to-card destination + trial quota.
4. QA: bot flow simulation (webhook payloads), approval → credit, idempotent `/start`.

## Operational note — reaching Telegram from the filtered VPS (2026-07-25)
The Afrows VPS's direct uplink **filters `api.telegram.org`** (Iran), and the reserve
relay socks (`127.0.0.1:10808/10809`, xray) could not reach it either. The working
path is the **`wg-village-de` tunnel** (reaches Telegram, HTTP 302/401). Fix in place:
Telegram's IP ranges are routed via that tunnel so the backend's **direct** outbound
works (no proxy needed; `AFROWS_OUTBOUND_PROXY_URL` stays empty).
- Ranges: `91.108.0.0/16 149.154.160.0/20 95.161.64.0/20 185.76.151.0/24 91.105.192.0/23`.
- **Persistence:** `PostUp = ip route replace <cidr> dev %i` lines in
  `/etc/wireguard/wg-village-de.conf` (survives reboot/flap); `update-afrows.sh`
  re-applies them each deploy as a safety net.
- `OutboundHttpService` also gained SOCKS5 support (v0.114.72) — unused here, but
  available if a working local socks egress appears.
- **Dependency:** this path needs the village tunnel up. During a village power
  loss it drops (see the parked egress-failover issue — the same outage is why the
  10808 reserve pool was dead).

## Inputs still needed from operator
- **Trial quota size** for new self-serve accounts (default 2 GB — confirm or change; or "no trial, must charge first").
- **Card-to-card destination** (entered in the dashboard setting, not here).
- Confirm the bot should issue **VLESS** by default (vs WireGuard) for trial configs.
