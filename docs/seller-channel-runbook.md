# Seller (reseller) channel — operator runbook

How to run the seller channel (per-GB pricing model, shipped v0.114.85). Deploy is gated on
village power (SSH path is village-routed); once deployed, this is the flow.

## Concepts
- **Price per GB** — a single value YOU (superadmin) set; the platform's cost per GB. Change it
  anytime (raise during a blackout, lower later). Every seller sale uses the current value.
- **Seller wallet** — prepaid credit. Sellers top it up by card-to-card; you approve.
- **Margin = markup on cost** — a seller's `marginBps` (default 20%). When they sell N GB, their
  wallet is debited the **cost** (`N × gbPrice`); they charge their own customer `cost × (1+margin)`
  and **keep the markup as cash** — you only ever take the cost.

## One-time setup
1. **Set the GB price:** dashboard → (Settings/Billing) **Price per GB** → e.g. 200,000 → Save.
2. **Set the card-to-card destination** (Settings → Telegram → Card-to-card, reused) so sellers see
   where to pay.
3. **Create a seller:**
   a. **Admins** page → create a user with role **reseller** (their login).
   b. **Sellers** page → **Add** → link that user, set **margin %** (default 20), currency, credit limit.

## Seller wallet top-up (card-to-card → you approve)
1. Seller logs in → their panel → **Top up wallet** → enters amount + uploads the **card-to-card
   receipt**.
2. You: **Seller top-ups** page (sidebar, pending badge) → open the request → view the **receipt
   image** → **Approve** (credits their wallet) or **Reject** (with reason). Seller is notified in-panel.

## Seller sells to their own customers (per-GB)
1. Seller logs in → per-GB **sell form** → enters GB for a customer → sees **cost** (debited from
   their wallet) + **their suggested sell price** (`cost + margin`).
2. On confirm: their wallet is debited the **cost**; the customer's quota is granted the GB. The
   seller collects `cost + margin` from their customer directly (cash) — that markup is theirs.
3. Their panel always shows **today's GB price**, their **available credit**, and the **markup** they
   keep per GB.

## Superadmin oversight
- **Sellers** page lists all sellers (margin, wallet, customer count, status).
- **Drill into a seller** → see each of their customers + usage (used/quota GB).
- **"Sign in as seller"** → opens their panel as them (audited; a **"Return to admin"** banner
  restores your session). Use it to help/verify a seller.

## Pricing during a blackout (crisis)
Because it's a single manual value, during a shutdown raise **Price per GB** (e.g. 200,000 → 300,000);
new seller sales immediately cost more. Already-granted GB is untouched. Lower it again when normal.

## Endpoints (reference)
- `GET/PATCH /admin/billing/gb-price` (PATCH = superadmin)
- reseller: `GET /admin/reseller/gb-quote?gb=`, `POST /admin/reseller/gb-charges`,
  `POST/GET /admin/reseller/wallet/topup-requests`, `.../:id/receipt`
- admin: `GET /admin/reseller-topups?status=`, `POST .../:id/approve|reject`, `GET .../:id/receipt`,
  `GET /admin/resellers/:id/customers`, `POST /admin/resellers/:id/impersonate`

## Related
- Pricing/margin plan: `docs/reseller-per-gb-pricing-plan.md`.
- The 20% here is the **reseller margin** — separate from the Telegram-bot **referral** 20% (gems).
