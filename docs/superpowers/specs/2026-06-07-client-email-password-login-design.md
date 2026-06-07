# Client Email/Password Login (mobile app account mode) — Design

**Date:** 2026-06-07
**Status:** Approved direction (email/username + password; auto-generated, shown once)

## Goal

Let a **seller create a customer with an email/username + password**, and let that customer **log into the mobile app** with those credentials to use the VPN and see usage (GB remaining), ping, and jitter. Telegram login is a fast-follow (same plumbing).

## What already exists (reuse, don't rebuild)

- `customer_accounts` (Telegram/token-based today; quota + usage + reseller ownership).
- `client_access_tokens` (token_hash → `client_configs` → `customer_accounts`, scopes e.g. `client:read`); `authenticateClientAccessToken(token)` → `ClientAuthActor`.
- `/client/subscription` (config), `/client/me` (profile/usage), guarded by `ClientTokenGuard`.
- Password hashing: `security/password` → `hashPassword` (scrypt) + `verifyScryptPassword`.
- Reseller create-customer flow: `POST /admin/reseller/customer-accounts`.

## What to add

### Backend
1. **Migration:** add to `customer_accounts`:
   - `login_email citext UNIQUE` (nullable — accepts an email *or* a simple handle; case-insensitive),
   - `password_hash text` (nullable; scrypt via `hashPassword`),
   - `password_set_at timestamptz`.
2. **Create-customer flow** (`reseller/customer-accounts` + admin): accept optional `loginEmail`; if a login email is set, **auto-generate a strong password**, store `hashPassword(pw)`, and return the **plaintext password once** in the create response (never stored/returned again). Add a **"reset password"** action (regenerate → show once).
3. **`POST /client/login`** (public, no ClientTokenGuard): body `{ identifier, password }`.
   - Look up `customer_accounts` by `login_email` (normalized), `status='active'`.
   - `verifyScryptPassword(password, password_hash)`; constant-time, generic error on failure ("Invalid email or password"); rate-limit by IP+identifier.
   - On success, find the account's active `client_config` (or the first), **issue a `client_access_token`** with scope `client:read` (reuse the existing issue path), return `{ token, expiresAt?, account: { displayName, remainingBytes, quotaLimitBytes } }`.
   - The app then uses `token` exactly like today for `/client/subscription` + `/client/me`.
4. **Shared types:** `ClientLoginRequest`, `ClientLoginResponse`; extend customer create response with `generatedPassword?`.

### Mobile app
5. **Startup gate:** "Do you have an Afrows account?" → **Login** (identifier + password) or **No → BYO-vless** (existing screen).
6. **Login screen:** identifier + password → `POST /client/login` → store token (secure storage) → go to the connect screen in **account mode**: pull `/client/subscription` (config to connect) + `/client/me` (GB remaining, ping, jitter) → Connect uses that config; show quota + stats. Logout clears the token.
7. Account mode and BYO mode share the connect UI; account mode adds the **quota + ping/jitter** panel.

### Dashboard
8. **Create-customer form** (reseller + superadmin): add **email/username** field; on save show the **generated password once** (copy button) with a "save this now" warning. Add **reset password** in the customer row.

## Security notes
- Passwords: scrypt (`hashPassword`), never logged, never returned except the one-time generate/reset.
- `/client/login`: rate-limited, generic failure message, requires `status='active'`.
- Tokens issued on login are the existing `client_access_tokens` (revocable; `client:read` scope).
- No credentials in git/.codex.

## Testing
- Unit: password generate/verify; login identifier normalization; "issue token on login" returns a token that `authenticateClientAccessToken` accepts (round-trip).
- Backend `node:test` for the pure pieces; manual end-to-end: create customer w/ email → login from app → connect + see quota.

## Out of scope (later)
- Telegram login (fast-follow, same `/client/login → token` shape).
- Email verification / self-serve password reset by email (seller/superadmin reset only for v1).
- Self-serve signup (accounts are seller-created).

## Acceptance
Seller creates a customer with email + auto-generated password (shown once) → user enters them in the app → app connects and shows GB remaining + ping/jitter. Superadmin sees the customer with its Seller/Shop column.
