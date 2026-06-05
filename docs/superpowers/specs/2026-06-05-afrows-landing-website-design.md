# Afrows Public Landing Site + Subdomain Split — Design

Date: 2026-06-05
Status: Approved (design); implementation pending plan

## Problem

`afrows.com` currently serves the admin **dashboard** directly — visitors land on a
login modal into the panel. There is no public marketing site. We want:

- `afrows.com` → a polished, bilingual public **landing site**.
- Clicking **Login / Get started** → routes to `app.afrows.com` (the existing panel).
- A dark, cinematic, motion-rich design (GSAP + framer-motion), matching the
  provided reference footer component.
- Bilingual **FA/EN** with RTL/LTR.
- Speak to **both** end-users and resellers (plus gamers), leading on the core
  value: better speed, smart routing, low jitter/ping, stable connectivity.

## Goals (v1)

- New `apps/web` landing app, served at `afrows.com` / `www.afrows.com`.
- Move the existing panel to `app.afrows.com` (same code, new host).
- A **complete Home page** with: nav, hero+CTA, animated metrics strip,
  features grid, audience split, static pricing, cinematic footer.
- Bilingual FA/EN toggle (persisted), RTL for FA.
- Real Let's Encrypt TLS on `app.afrows.com` (wildcard already covers it).

## Non-goals (fast-follow / later)

- Detail pages `/resellers`, `/gaming`, `/vpn` — **fast-follow** after Home ships.
- Real pricing wired to the billing system — v1 uses **static placeholder** plans.
- Android **native app** — next phase (the `native-client` app already exists).
- Moving the customer `client` app — stays where it is; may get `my.afrows.com` later.

## Architecture

### App
New `apps/web` — Vite + React 19 + TypeScript + Tailwind v4 (CSS config, same as
`dashboard`/`client`). Dev port **4200** (`dashboard` 4000, `client` 4100).
Package name `@afrows/web`, version tracked with the monorepo.

### Subdomain split

| Host | Serves | API |
|---|---|---|
| `afrows.com`, `www.afrows.com` | `apps/web/dist` (landing, static SPA) | none |
| `app.afrows.com` | `apps/dashboard/dist` (panel) | `/api` proxied to `127.0.0.1:7000` |

- Landing **Login / Get started** buttons link to `https://app.afrows.com`.
- Auth stays **same-origin** on `app.afrows.com` (no cross-subdomain cookies).
- Backend `CORS_ORIGIN` adds `https://app.afrows.com` (keep existing entries).
- Dashboard keeps `VITE_API_BASE_URL=/api` (relative) — resolves to
  `app.afrows.com/api`, no rebuild needed for the base URL.

### DNS + TLS
- deSEC: add `app` A record → `94.74.145.199` (and optionally keep `www`).
- Existing `*.afrows.com` + `afrows.com` cert already covers `app.afrows.com`;
  no new cert needed. Renewal task unchanged.

### nginx (box)
- New `server_name app.afrows.com` 443 block = clone of today's afrows block
  (root `/opt/afrows/apps/dashboard/dist`, `/api` proxy, login rate-limit,
  security headers incl. HSTS/CSP).
- `afrows.com`/`www` 443 block → root `/opt/afrows/apps/web/dist`, SPA fallback
  `try_files $uri /index.html`, static asset caching. CSP adjusted for the
  landing: allow `fonts.googleapis.com`/`fonts.gstatic.com` and the inline
  animation `<style>` (`style-src 'unsafe-inline'`); keep `script-src 'self'`.
- Port 80 → 301 to HTTPS for all three hosts.

### Deploy
`update-afrows.sh` / `sync.ps1` extended to build `apps/web` and place
`apps/web/dist`. Build uses `VITE_APP_URL=https://app.afrows.com` (Login target),
overridable for local dev.

## App structure

```
apps/web/
  index.html
  vite.config.ts            # @tailwindcss/vite, @ alias -> ./src
  tsconfig.json             # @/* path alias
  package.json
  src/
    main.tsx                # mounts <App/>, BrowserRouter
    App.tsx                 # routes: "/" Home (detail routes added fast-follow)
    styles.css              # @import "tailwindcss" + dark shadcn tokens + fonts
    lib/utils.ts            # cn() = clsx + tailwind-merge
    i18n/ index.ts, en.ts, fa.ts   # dict + dir + persisted lang context
    components/
      ui/
        motion-footer.tsx   # provided GSAP footer, adapted + rebranded
        button.tsx          # cva button (shadcn-style)
        card.tsx
      nav.tsx               # logo, lang toggle, Login -> app.afrows.com
      lang-toggle.tsx
      reveal.tsx            # framer-motion scroll-reveal wrapper
      count-up.tsx          # animated metric counter
    sections/
      hero.tsx
      metrics.tsx
      features.tsx
      audience-split.tsx
      pricing.tsx
      cta.tsx
    pages/
      home.tsx
```

New deps (web only): `gsap`, `framer-motion`, `react-router-dom`, `clsx`,
`tailwind-merge`, `class-variance-authority`. Already present: `react`,
`react-dom`, `lucide-react`, `tailwindcss`, `@tailwindcss/vite`, `vite`, `typescript`.

## Design system

- Dark cinematic tokens defined as CSS vars in `styles.css` (shadcn naming so the
  footer's `color-mix(... var(--foreground) ...)` works): `--background`,
  `--foreground`, `--primary`, `--secondary`, `--muted`, `--muted-foreground`,
  `--border`, `--destructive`, `--card`, etc. (oklch values, dark theme).
- Fonts: Plus Jakarta Sans (EN/LTR), Vazirmatn (FA/RTL). Loaded via the landing's
  CSS; `<html dir>` and font-family switch with language.
- Visual language: glass pills, aurora radial glow, subtle grid, giant type,
  gradient/metallic text — consistent with the reference footer.

## Home page sections (v1)

1. **Nav** — sticky, blurred glass; logo, FA/EN toggle, `Login` (→ app) +
   `Get started` (→ app). Mobile menu.
2. **Hero** — headline (speed / smart routing / low jitter+ping / stability),
   subhead, two CTAs, animated background (aurora + grid), framer-motion entrance.
3. **Metrics strip** — count-up on scroll: uptime %, avg ping (ms), jitter (ms),
   locations/servers. Static representative numbers for v1 (clearly editable).
4. **Features grid** — 6 cards w/ lucide icons + hover/reveal motion:
   Smart Routing, Low Jitter/Ping (gaming), Stability & Uptime, Multi-protocol,
   Raw Speed, Privacy/Security.
5. **Audience split** — 3 cards: End-users / Gamers / Resellers, each with a
   teaser + button. In v1 buttons link to `app.afrows.com` or `#` placeholder;
   wired to detail pages in the fast-follow.
6. **Pricing** — static placeholder plan cards (e.g., Starter / Pro / Reseller)
   with a note in code that real plans come from billing later. CTAs → app.
7. **CTA band** — final conversion strip → app.
8. **Footer** — the provided `CinematicFooter`, rebranded to Afrows (copy, links
   to Privacy/Terms/Support, app-store buttons relabeled "Coming soon" since the
   Android app is next phase), giant bg text "AFROWS".

## Footer component adaptation (from the provided Next.js/shadcn snippet)

- Remove `"use client"` (Vite has no RSC); keep the component otherwise.
- `@/lib/utils` `cn` — provide it in `apps/web/src/lib/utils.ts`.
- Ensure `@` alias resolves to `apps/web/src` (vite + tsconfig).
- Keep GSAP + ScrollTrigger; `gsap` added as a dep.
- Rebrand: giant text → `AFROWS`; copy/credits → Afrows; marquee items →
  Afrows value props; download buttons → "Android — coming soon" (disabled).
- Tokens it relies on (`--foreground`, `--primary`, `--secondary`,
  `--destructive`, `--border`, `--muted-foreground`, `--background`) defined in
  `styles.css`.

## i18n / RTL

- Lightweight context (mirrors existing apps' approach): `{ lang, dir, t() }`,
  default FA, persisted to `localStorage`. Toggle in nav.
- `<html lang dir>` updated on change; FA → Vazirmatn + `rtl`, EN → Plus Jakarta + `ltr`.
- All landing copy in `en.ts` / `fa.ts`.

## Testing / verification

- Typecheck + build `apps/web` clean (`tsc --noEmit && vite build`).
- Manual: Home renders FA (RTL) + EN (LTR); animations run; Login/Get-started
  point to `https://app.afrows.com`; footer scroll reveal works; responsive at
  mobile + desktop; Lighthouse sane (no console errors, fonts load).
- Post-deploy on box: `https://afrows.com` serves landing; `https://app.afrows.com`
  serves panel + login works; HTTP→HTTPS 301; security headers present; existing
  `verify-install.sh` still passes against `app.afrows.com`.

## Rollout steps (for the plan)

1. Scaffold `apps/web` (vite/tailwind/ts/alias) + deps.
2. Design tokens + i18n + utils + base UI (button/card/nav/reveal/count-up).
3. Build Home sections + integrate adapted footer.
4. Wire deps in root workspace + build scripts (`update-afrows.sh`, `sync.ps1`).
5. DNS: add `app.afrows.com`. nginx: split hosts. CORS: add app origin.
6. Deploy, verify both hosts, update checklist/progress.
