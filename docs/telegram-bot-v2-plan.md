# afroWS Bot v2 — Registration, Referrals, Gems, Usage (plan + checklist)

Status: **planning** (2026-07-25). The v1 bot works (language → instant trial account →
menu → buy/top-up → admin approval). This plans the operator's v2 asks. Some items
need a decision before build (marked **DECISION**); the rest are ready.

---

## A. Registration flow (after language pick)
Today: language → instantly creates `customer-XXXXXX` + 1 GB trial. Operator wants a
real signup instead.
- [ ] After language, ask for the user's **name**, then their **phone number** (Telegram
      "Share phone number" one-tap button — `request_contact`; no manual typing).
- [ ] Create/So the `customer_accounts` row with **display_name = the entered name** and
      store the **phone** (`paid_number_hash` already exists; add a stored phone field if we
      keep it in clear for the operator). Link `telegram_id`/`telegram_username`.
- [ ] **Name the VLESS config after the user** (name or phone), e.g. `Hani-0912…` instead
      of `customer-888787`. (Config label = sanitized name/phone.)
- [ ] **DECISION — free trial:** the operator asked "why give the first-comer a free
      account?" Options: (a) **no trial** — account created but 0 GB until they buy/redeem;
      (b) **small trial** (e.g. 500 MB / 1 GB) as an acquisition hook; (c) trial only if they
      complete registration (name+phone). Default recommendation: **(a) no auto free GB** —
      account is created on signup, GB comes from purchase or referral rewards.

## B. Usage self-view
- [ ] "My Account" already shows quota; make the **first screen after registration / on
      return** show **used GB + remaining + percentage bar** prominently (e.g. `4.2 / 20 GB
      (21%)`). Add a simple text progress bar. Refresh button.

## C. Referral / invite system  **(DECISION on reward model)**
Each user gets a unique **invite code** + a shareable deep link `t.me/Afrows_bot?start=<code>`.
A new user arriving via that link/code is attributed to the inviter.
- [ ] Generate a short unique code per account; show it + the deep link in a "Invite friends"
      menu item with the user's referral stats (how many joined, rewards earned).
- [ ] Attribute a new signup to the inviter when they start with `?start=<code>`.
- **DECISION — how invites pay off** (operator floated several; pick one, or the hybrid):
  1. **GB milestones** — invite N friends → get X GB (e.g. 10 invites → 3 GB). Simple.
  2. **Purchase commission** — when a referred user *buys* VPN, the inviter's account is
     credited **20%** (of the purchased GB or its value). Rewards real revenue, not sign-ups.
  3. **Gems currency** — earn **gems** for invites and for referred purchases; gems are
     spendable to top up the user's own GB (a flexible internal points wallet).
  4. **Hybrid (recommended):** gems as the wallet + 20% referred-purchase commission paid in
     gems + optional milestone bonuses; gems redeem to GB. Unifies all the ideas.
- [ ] Anti-abuse: reward only after the referred user is "real" (completes registration /
      first purchase), one attribution per user, no self-referral.

## D. Gems wallet (if chosen in C)
- [ ] `gems_balance` on the account (or a ledger table for auditability).
- [ ] Earn: referral signup bonus, 20% of referred purchases, milestones.
- [ ] Spend: "Redeem gems → GB" in the bot (conversion rate, e.g. 100 gems = 1 GB — DECISION).
- [ ] Show gems balance + history in the bot; admin view + manual adjust in the dashboard.

## E. Referral commission wiring (if C-2/C-4)
- [ ] When a top-up is **approved** (existing admin flow), if the buyer has an inviter, credit
      the inviter 20% (as gems or GB). Audited. Show it to both users in the bot.

## F. Bot branding / profile (operator BotFather actions — cannot be automated)
- [ ] `@BotFather → /setuserpic` — upload the afroWS **profile photo** (the "favicon" of a bot).
- [ ] `/setdescription` (shown on the empty-chat screen) + `/setabouttext` (profile).
- [ ] `/setcommands` — register the slash menu (start, menu, account, buy, invite, help) so
      Telegram shows the ☰ command list.
- [ ] Optionally a nicer display name / short username via BotFather support.

## G. UX / UI recommendations (best-practice flow)
- [ ] **Deep-link onboarding**: `?start=<code>` prefills the inviter and can skip straight to
      language.
- [ ] **Registration progress**: "Step 1/2 — your name", "Step 2/2 — share phone" so it feels
      quick and finite.
- [ ] **Persistent main menu** with clear sections: My Account (usage%) · Buy Data · My
      Configs · Invite & Earn · Gems · Language · Help.
- [ ] **Post-purchase & post-referral confirmations** with the new balance and a next action.
- [ ] **Empty/'‌error states** already handled in v1 — extend to the new screens.
- [ ] **Notifications**: tell the inviter in-bot when a referral joins / buys and gems land.
- [ ] **One value per screen**, back/menu on every screen (already the v1 pattern).
- [ ] Keep everything **bilingual (fa/en)** in the typed copy map; new strings both languages.

---

## Build phasing (after decisions)
1. **Registration** (name + phone + named config) + **usage% view** + drop/keep trial.
2. **Referral codes + deep-link attribution** + Invite menu + stats.
3. **Rewards engine** (gems wallet and/or GB/commission) + redeem + commission on approval.
4. **Dashboard**: see referrals, gems, phone, adjust; branding via BotFather (operator).
5. QA + bilingual copy pass with the bot-UX designer.

## LOCKED decisions (operator, 2026-07-25)
1. **Reward model = HYBRID** — a **gems** wallet is the reward currency. Earn gems on
   referral signup, on referred purchases (20%), and at milestones; **redeem gems → GB**.
2. **No free trial** — signup creates the account with **0 GB**; data comes from buying or
   redeeming referral gems.
3. **Phone required** — one-tap `request_contact`, **stored in clear** (admin-visible), used
   to **name the VLESS config** (e.g. `Hani-0912xxxx`).

### Default economy (all admin-configurable via settings)
- Redeem rate: **100 gems = 1 GB**.
- Referral signup bonus: **+50 gems** (0.5 GB) once the referred user completes registration.
- Referred-purchase commission: **20% of the purchased GB, paid in gems** (friend buys 20 GB →
  inviter +400 gems = 4 GB).
- Milestone: every **10** completed referrals → **+300 gems** (3 GB) bonus.
- Anti-abuse: bonus only after the referred user finishes registration (and, for commission,
  actually purchases); one inviter per user; no self-referral.

### Registration data
- Collect **name** then **phone** (one-tap share). `customer_accounts.display_name` = name;
  store phone (add a `phone` column, in clear). Config label = sanitized `name`/`phone`.
- New signup: account **active, 0 GB**, linked telegram id/username, named VLESS config issued.
