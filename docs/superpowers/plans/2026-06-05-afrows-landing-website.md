# Afrows Public Landing Website Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a dark-cinematic, bilingual (FA/EN) public landing site at `afrows.com` as a new `apps/web` Vite app, and move the existing panel to `app.afrows.com`.

**Architecture:** New `apps/web` (Vite + React 19 + TS + Tailwind v4) served statically at `afrows.com`. Login/Get-started link to `app.afrows.com`, where the existing dashboard + `/api` move. framer-motion for section reveals; GSAP+ScrollTrigger for the cinematic footer. Bilingual via a small lang context with RTL.

**Tech Stack:** Vite 7, React 19, TypeScript 5.8, Tailwind v4 (`@tailwindcss/vite`), framer-motion, gsap, react-router-dom, clsx, tailwind-merge, class-variance-authority, lucide-react.

Spec: `docs/superpowers/specs/2026-06-05-afrows-landing-website-design.md`

---

## File structure

```
apps/web/
  package.json            # @afrows/web; scripts mirror apps/client
  vite.config.ts          # react + tailwind plugins, @ alias, port 4200, vendor chunk
  tsconfig.json           # extends base, @/* paths
  index.html              # root div + main.tsx, title "Afrows"
  public/favicon.svg
  src/
    main.tsx              # mount App in BrowserRouter
    App.tsx               # routes; "/" -> Home
    styles.css            # @import tailwindcss + dark tokens + fonts + base
    lib/utils.ts          # cn()
    i18n/index.ts         # LangProvider, useLang, t(), dir, persistence
    i18n/en.ts, i18n/fa.ts
    components/ui/button.tsx, card.tsx, motion-footer.tsx
    components/nav.tsx, lang-toggle.tsx, reveal.tsx, count-up.tsx
    sections/hero.tsx, metrics.tsx, features.tsx, audience-split.tsx, pricing.tsx, cta.tsx
    pages/home.tsx
```

Ops (box): deSEC A record `app`, nginx host split, `CORS_ORIGIN` add `https://app.afrows.com`.

---

## Task 1: Scaffold `apps/web`

**Files:** Create `apps/web/package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `public/favicon.svg`, `src/main.tsx`, `src/App.tsx`, `src/styles.css`.

- [ ] **Step 1: package.json**

```json
{
  "name": "@afrows/web",
  "version": "0.114.27",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 127.0.0.1 --port 4200 --strictPort",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview --host 127.0.0.1 --port 4200 --strictPort",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "framer-motion": "^11.15.0",
    "gsap": "^3.12.5",
    "lucide-react": "^0.468.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router-dom": "^7.1.0",
    "tailwind-merge": "^2.6.0"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.3.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^5.0.0",
    "tailwindcss": "^4.3.0",
    "typescript": "^5.8.0",
    "vite": "^7.0.0"
  }
}
```

- [ ] **Step 2: vite.config.ts** (adds `@` alias + `VITE_APP_URL` default)

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('gsap')) return 'gsap';
          if (id.includes('framer-motion')) return 'motion';
          if (id.includes('node_modules')) return 'vendor';
        },
      },
    },
  },
  server: { host: '127.0.0.1', port: 4200, strictPort: true },
  preview: { host: '127.0.0.1', port: 4200, strictPort: true },
});
```

- [ ] **Step 3: tsconfig.json** (mirror client + `@/*` paths)

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "isolatedModules": true,
    "jsx": "react-jsx",
    "lib": ["dom", "dom.iterable", "es2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "noEmit": true,
    "types": ["vite/client"],
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "vite.config.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: index.html**

```html
<!doctype html>
<html lang="fa" dir="rtl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <title>Afrows — Fast, stable, unfiltered</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: public/favicon.svg** — simple Afrows mark (dark bg, gradient "A").

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#0a0a0f"/><path d="M20 46 32 16 44 46h-7l-2-6h-10l-2 6z" fill="#7c5cff"/></svg>
```

- [ ] **Step 6: src/main.tsx**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { LangProvider } from './i18n';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Web root element was not found');

createRoot(root).render(
  <StrictMode>
    <LangProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </LangProvider>
  </StrictMode>,
);
```

- [ ] **Step 7: src/App.tsx** (Home only in v1; detail routes fast-follow)

```tsx
import { Routes, Route, Navigate } from 'react-router-dom';
import { Home } from './pages/home';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
```

- [ ] **Step 8: src/styles.css** — Tailwind + dark tokens + fonts. (Full file in Task 2 dependency; create now with tokens.)

```css
@import "tailwindcss";
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800;900&family=Vazirmatn:wght@300;400;500;600;700;800;900&display=swap');

:root {
  --background: oklch(0.13 0.02 280);
  --foreground: oklch(0.97 0.01 280);
  --card: oklch(0.16 0.02 280);
  --muted: oklch(0.22 0.02 280);
  --muted-foreground: oklch(0.72 0.02 280);
  --primary: oklch(0.62 0.21 285);
  --secondary: oklch(0.70 0.16 200);
  --destructive: oklch(0.62 0.22 25);
  --border: oklch(0.30 0.02 280);
}

html { background: var(--background); color: var(--foreground); }
html[dir="rtl"] body { font-family: 'Vazirmatn', sans-serif; }
html[dir="ltr"] body { font-family: 'Plus Jakarta Sans', sans-serif; }
body { margin: 0; -webkit-font-smoothing: antialiased; background: var(--background); color: var(--foreground); }
* { box-sizing: border-box; }
```

- [ ] **Step 9: Install + build**

Run (from repo root):
```
npm install
npm --workspace @afrows/web run build
```
Expected: install resolves new deps; `tsc --noEmit` passes; `vite build` writes `apps/web/dist/`. (Home/pages don't exist yet → expect a build FAIL referencing `./pages/home`; that's fine until Task 9. To verify scaffolding alone, temporarily render a `<div>Afrows</div>` in App; revert after.)

- [ ] **Step 10: Commit**

```
git add apps/web package-lock.json
git commit -m "feat(web): scaffold apps/web landing app (vite+tailwind+ts, @ alias)"
```

---

## Task 2: `cn()` utility + test

**Files:** Create `apps/web/src/lib/utils.ts`, `apps/web/src/lib/utils.test.ts`.

- [ ] **Step 1: utils.ts**

```ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 2: utils.test.ts** (node:test, matches backend test style)

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cn } from './utils.ts';

test('cn merges and dedupes tailwind classes', () => {
  assert.equal(cn('px-2', 'px-4'), 'px-4');
  assert.equal(cn('a', false && 'b', 'c'), 'a c');
});
```

- [ ] **Step 3: Run test**

Run: `node --test apps/web/src/lib/utils.test.ts`
Expected: PASS (2 assertions). If `tsx`/ts-loader needed, run via `node --import tsx --test` — if unavailable, skip the run and rely on typecheck; note this in the commit.

- [ ] **Step 4: Commit**

```
git add apps/web/src/lib
git commit -m "feat(web): add cn() utility"
```

---

## Task 3: i18n (lang context, dicts, RTL)

**Files:** Create `apps/web/src/i18n/index.ts`, `en.ts`, `fa.ts`.

- [ ] **Step 1: en.ts / fa.ts** — typed dictionary. Keys for every visible string (nav, hero, metrics, features, audience, pricing, cta, footer). Shape:

```ts
// en.ts
export const en = {
  nav: { login: 'Login', getStarted: 'Get started', product: 'Product', pricing: 'Pricing' },
  hero: {
    title: 'The fastest, most stable route to the open internet',
    subtitle: 'Smart routing, ultra-low jitter and ping, and rock-solid uptime — built for streaming, gaming, and work.',
    ctaPrimary: 'Get started', ctaSecondary: 'Explore features',
  },
  metrics: { uptime: 'Uptime', ping: 'Avg ping', jitter: 'Avg jitter', locations: 'Locations' },
  features: { title: 'Why Afrows', items: { /* smartRouting, lowPing, stability, multiProtocol, speed, privacy: {title, body} */ } },
  audience: { title: 'Built for everyone', enduser: {title, body, cta}, gamer: {title, body, cta}, reseller: {title, body, cta} },
  pricing: { title: 'Simple pricing', note: 'Plans shown are examples; live plans appear in the panel.', plans: { /* starter, pro, reseller */ } },
  cta: { title: 'Ready to go faster?', body: 'Create an account in the panel and connect in minutes.', button: 'Open the panel' },
  footer: { ready: 'Ready to begin?', android: 'Android — coming soon', privacy: 'Privacy', terms: 'Terms', support: 'Support', rights: 'All rights reserved.' },
} as const;
export type Dict = typeof en;
```

`fa.ts` exports `fa: Dict` with arabic translations of the same keys.

- [ ] **Step 2: index.ts** — provider + hook + APP_URL.

```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { en, type Dict } from './en';
import { fa } from './fa';

export type Lang = 'fa' | 'en';
const DICTS: Record<Lang, Dict> = { en, fa };
export const APP_URL = (import.meta.env.VITE_APP_URL as string) ?? 'https://app.afrows.com';

interface LangCtx { lang: Lang; dir: 'rtl' | 'ltr'; t: Dict; setLang: (l: Lang) => void; toggle: () => void; }
const Ctx = createContext<LangCtx | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem('afrows.lang') as Lang) || 'fa');
  const dir = lang === 'fa' ? 'rtl' : 'ltr';
  useEffect(() => {
    localStorage.setItem('afrows.lang', lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang, dir]);
  const value: LangCtx = { lang, dir, t: DICTS[lang], setLang, toggle: () => setLang(lang === 'fa' ? 'en' : 'fa') };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLang() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useLang must be used within LangProvider');
  return c;
}
```

- [ ] **Step 3: Verify** — `npm --workspace @afrows/web run typecheck`. Expected: PASS.

- [ ] **Step 4: Commit**

```
git add apps/web/src/i18n
git commit -m "feat(web): bilingual FA/EN context with RTL + dicts"
```

---

## Task 4: Base UI primitives (button, card, reveal, count-up, lang-toggle)

**Files:** Create `components/ui/button.tsx`, `components/ui/card.tsx`, `components/reveal.tsx`, `components/count-up.tsx`, `components/lang-toggle.tsx`.

- [ ] **Step 1: button.tsx** — cva button with `default` (primary gradient), `glass`, `ghost` variants and `sm/md/lg` sizes; supports `as="a"`. Uses `cn`. Glass variant reuses tokens (`bg-[color-mix(in_oklch,var(--foreground)_4%,transparent)]`, border `--border`, backdrop blur).

- [ ] **Step 2: card.tsx** — glass card: rounded-2xl, border `--border`, subtle gradient bg, hover lift. Exports `Card`, `CardTitle`, `CardBody`.

- [ ] **Step 3: reveal.tsx** — framer-motion scroll reveal wrapper:

```tsx
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
export function Reveal({ children, delay = 0, y = 24 }: { children: ReactNode; delay?: number; y?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
    >{children}</motion.div>
  );
}
```

- [ ] **Step 4: count-up.tsx** — framer-motion `useInView` + animate a number from 0 to `value` over ~1.5s, formatting with optional suffix/decimals.

- [ ] **Step 5: lang-toggle.tsx** — button calling `useLang().toggle()`, shows "EN"/"فا".

- [ ] **Step 6: Verify** `npm --workspace @afrows/web run typecheck` → PASS.

- [ ] **Step 7: Commit**

```
git add apps/web/src/components
git commit -m "feat(web): base UI primitives (button, card, reveal, count-up, lang-toggle)"
```

---

## Task 5: Nav

**Files:** Create `components/nav.tsx`.

- [ ] **Step 1:** Sticky top nav, glass/blur on scroll (framer-motion `useScroll`), logo (Afrows mark + wordmark), center product/pricing anchor links, right side `LangToggle` + `Login` (ghost) + `Get started` (primary) both `as="a" href={APP_URL}`. Mobile: hamburger → animated sheet. All copy from `useLang().t.nav`. Respect `dir` (logical spacing via `gap`, not left/right).
- [ ] **Step 2:** Verify typecheck PASS.
- [ ] **Step 3:** Commit `feat(web): sticky bilingual nav with app links`.

---

## Task 6: Hero

**Files:** Create `sections/hero.tsx`.

- [ ] **Step 1:** Full-height hero: aurora radial glow + faint grid bg (reuse footer's visual language via inline classes), giant gradient headline (`t.hero.title`), subtitle, two CTAs (`Get started`→APP_URL primary, `Explore features`→`#features` glass). framer-motion staggered entrance. Decorative animated latency "pulse" line. Responsive type (text-4xl→text-7xl).
- [ ] **Step 2:** typecheck PASS.
- [ ] **Step 3:** Commit `feat(web): hero section`.

---

## Task 7: Metrics strip

**Files:** Create `sections/metrics.tsx`.

- [ ] **Step 1:** Row of 4 `CountUp` stats from `t.metrics`: Uptime `99.9%`, Avg ping `18ms`, Avg jitter `3ms`, Locations `25+`. Glass cards, `Reveal` stagger. Numbers defined as constants with a code comment that they are representative and editable.
- [ ] **Step 2:** typecheck PASS.
- [ ] **Step 3:** Commit `feat(web): animated metrics strip`.

---

## Task 8: Features grid

**Files:** Create `sections/features.tsx` (id="features").

- [ ] **Step 1:** 6 feature cards from `t.features.items` with lucide icons: Smart Routing (`Route`), Low Jitter/Ping (`Gauge`), Stability & Uptime (`ShieldCheck`), Multi-protocol (`Layers`), Raw Speed (`Zap`), Privacy (`Lock`). Grid responsive (1→2→3 cols), `Reveal` stagger, hover glow. Section heading `t.features.title`.
- [ ] **Step 2:** typecheck PASS.
- [ ] **Step 3:** Commit `feat(web): features grid`.

---

## Task 9: Audience split

**Files:** Create `sections/audience-split.tsx`.

- [ ] **Step 1:** 3 large cards (End-users / Gamers / Resellers) from `t.audience`, each with icon, title, body, and CTA button. v1 CTAs: End-users & Gamers → `APP_URL`; Reseller → `APP_URL`. Code comment: detail pages `/vpn`,`/gaming`,`/resellers` are fast-follow; swap hrefs then.
- [ ] **Step 2:** typecheck PASS.
- [ ] **Step 3:** Commit `feat(web): audience split section`.

---

## Task 10: Pricing (static)

**Files:** Create `sections/pricing.tsx`.

- [ ] **Step 1:** 3 static plan cards from `t.pricing.plans` (Starter / Pro / Reseller) with feature bullets, a highlighted "Pro" plan, and the `t.pricing.note` disclaimer that live plans live in the panel. CTAs → `APP_URL`. Prices as constants with an editable comment.
- [ ] **Step 2:** typecheck PASS.
- [ ] **Step 3:** Commit `feat(web): static pricing section`.

---

## Task 11: CTA band

**Files:** Create `sections/cta.tsx`.

- [ ] **Step 1:** Full-width gradient/glass band: `t.cta.title`, body, single big CTA → `APP_URL`. `Reveal` entrance.
- [ ] **Step 2:** typecheck PASS.
- [ ] **Step 3:** Commit `feat(web): final CTA band`.

---

## Task 12: Cinematic footer (adapt provided component)

**Files:** Create `components/ui/motion-footer.tsx`.

- [ ] **Step 1:** Paste the provided component, then apply these exact adaptations:
  - Remove the `"use client";` line (Vite has no RSC directive).
  - Keep `import { cn } from "@/lib/utils";` (alias now resolves).
  - Keep `gsap` + `ScrollTrigger` imports (dep installed).
  - Rebrand content: giant bg text `SOBERS` → `AFROWS`; `MarqueeItem` spans → Afrows value props ("Smart Routing", "Ultra-low Ping", "Rock-solid Uptime", "Multi-protocol", "Private by design"); heading "Ready to begin?" → `useLang().t.footer.ready`; the two download pills → a single disabled "Android — coming soon" pill (`t.footer.android`) since the app is next phase; secondary links → Privacy/Terms/Support from `t.footer`; credits "Volvox" → "Afrows", year 2026.
  - Make it consume `useLang()` for copy + dir.
- [ ] **Step 2:** typecheck PASS.
- [ ] **Step 3:** Commit `feat(web): cinematic GSAP footer (rebranded Afrows)`.

---

## Task 13: Home page assembly

**Files:** Create `pages/home.tsx`.

- [ ] **Step 1:** Compose: `<Nav/>` then `<main>` with `Hero, Metrics, Features, AudienceSplit, Pricing, Cta` then `<CinematicFooter/>`. Wrap page in the dark bg; ensure the footer's "curtain reveal" wrapper sits last (per the component's design it stays fixed under content). Add section vertical padding + max-width containers.
- [ ] **Step 2: Full build**

Run: `npm --workspace @afrows/web run build`
Expected: `tsc --noEmit` PASS; `vite build` writes `apps/web/dist` with chunks (vendor/motion/gsap). No console-blocking errors.

- [ ] **Step 3: Manual visual check** (local)

Run: `npm --workspace @afrows/web run preview` → open `http://127.0.0.1:4200`. Verify: FA loads RTL by default; toggle to EN flips LTR + font; hero/metrics/features/footer animate; Login/Get-started point to `https://app.afrows.com`; responsive at 375px and 1440px; no console errors.

- [ ] **Step 4: Commit** `feat(web): assemble Home page`.

---

## Task 14: Subdomain DNS + cert coverage

**Files:** none (deSEC API + verification).

- [ ] **Step 1: Add `app` A record** via deSEC API (token in Posh-ACME profile / operator-supplied):

```
POST https://desec.io/api/v1/domains/afrows.com/rrsets/
{ "subname": "app", "type": "A", "ttl": 3600, "records": ["94.74.145.199"] }
```

- [ ] **Step 2: Verify resolution** `https://dns.google/resolve?name=app.afrows.com&type=A` → `94.74.145.199`.
- [ ] **Step 3:** Confirm existing cert SANs include `*.afrows.com` (they do) — no new cert needed.

---

## Task 15: nginx host split + CORS

**Files (box):** `/etc/nginx/sites-available/afrows` (split into landing + app blocks), `/etc/afrows/afrows.env` (CORS).

- [ ] **Step 1:** Back up the current site. Create an `app.afrows.com` 443 server block = today's block verbatim (root `/opt/afrows/apps/dashboard/dist`, `/api` proxy, login limit, security headers incl. HSTS/CSP, ssl cert paths).
- [ ] **Step 2:** Change the `afrows.com`/`www` 443 block to `root /opt/afrows/apps/web/dist;` with `location / { try_files $uri /index.html; }`, static asset caching, and a landing-tuned CSP: `default-src 'self'; img-src 'self' data:; font-src 'self' https://fonts.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`. Keep HSTS.
- [ ] **Step 3:** Port 80 block → add `app.afrows.com` to `server_name` for the 301 redirect.
- [ ] **Step 4:** `CORS_ORIGIN` → add `https://app.afrows.com` (keep `https://afrows.com`, drop the bare IP if desired). Restart backend.
- [ ] **Step 5:** `nginx -t && systemctl reload nginx`.

---

## Task 16: Deploy + verify + docs

**Files:** ops scripts (`update-afrows.sh`/`sync.ps1` gitignored), `.codex/checklist.md`, `.codex/progress.md`.

- [ ] **Step 1:** Ensure `apps/web` is built by the deploy. Root `build` already runs `--workspaces`, so the box `update-afrows.sh` build step covers it. Confirm `apps/web/dist` lands in `/opt/afrows/apps/web/dist` (extend the rsync/extract list if it filters paths).
- [ ] **Step 2: Deploy** via the normal sync loop (warm cache for the new deps first: `gsap`, `framer-motion`, `react-router-dom`, `clsx`, `tailwind-merge`, `class-variance-authority` — add to the PC-warmed Linux cache, then `npm ci --offline` on box).
- [ ] **Step 3: Verify on box:**
  - `https://afrows.com/` → landing (HTTP 200, `ssl_verify_result=0`), FA RTL default.
  - `https://app.afrows.com/api/health` → ok; `https://app.afrows.com/` → panel; login works.
  - `http://afrows.com` and `http://app.afrows.com` → 301 https.
  - Security headers present on both; `verify-install.sh BASE_URL=https://app.afrows.com HOST_LOCAL=1` passes.
- [ ] **Step 4:** Mark Phase 8 items done in `.codex/checklist.md`; add a `progress.md` entry. Commit docs (secret-scan first).

---

## Self-review notes

- Spec coverage: apps/web scaffold (T1), tokens/i18n/RTL (T1,T3), utils (T2), UI primitives (T4), nav (T5), hero/metrics/features/audience/pricing/cta (T6–T11), footer adaptation (T12), Home assembly (T13), DNS (T14), nginx split + CORS (T15), deploy/verify/docs (T16). All spec sections mapped.
- Login target centralized in `APP_URL` (i18n/index.ts) — consistent across nav/hero/audience/pricing/cta.
- Detail pages + real pricing explicitly deferred (fast-follow) per spec; Android app next phase.
- Risk: offline npm cache must include the 6 new deps before box build (called out in T16 S2).
