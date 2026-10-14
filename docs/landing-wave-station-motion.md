# Afrooz Wave Station — Scroll, Motion & Visual Spec (`apps/web`)

Status: design spec, no code changed yet. Companion: `docs/landing-wave-station-story.md` (copy / narrative; owns every user-facing string). This file owns motion, visuals, performance tiers and the refactor plan. Sections are referenced by their current component names (`Hero`, `Radio`, `Features`, `Pricing`, `Apps`, `Faq`, `Cta`, `Footer`, plus `Nav`, `PromoBar`, `MiniPlayer`, `PlayerCard`, `ScrollProgress`).

Decisions already made by the user and respected here: brand "Afrooz Wave Station" (Afrooz = to kindle / light up); stack GSAP 3.15 + ScrollTrigger + SplitText (words only) + Lenis + React Bits; no real audio, so tempo is a shared CSS variable `--beat` (500 ms, 120 BPM) gated by `.is-playing`; everything bundled, no CDNs.

---

## 0. Guiding rules (read before anything else)

1. One engine per job. **GSAP owns scroll-driven and entrance motion. CSS owns beat loops (tempo) and mount/unmount transitions. framer-motion is removed.** (Rationale in 1.4.)
2. Content is never hidden by CSS. Hidden "before reveal" states are applied by JS only after the engine loads, and only to elements below the fold at that moment. If JS fails or the tier is `static`, the page is complete and readable.
3. The hero's first paint needs zero JS: its entrance is CSS keyframes. GSAP/Lenis/WebGL load after first paint (idle).
4. SplitText splits `words` (and optionally `lines`), **never `chars`** — Persian letter joining breaks on char splits.
5. Every horizontal motion value goes through the `sign` helper (`+1` LTR, `-1` RTL). No raw `x`/`xPercent`/`rotateY` literals in section code.
6. Any element handed to SplitText gets `key={lang}` so React remounts it on language change (SplitText mutates text nodes; React must not reconcile over injected spans).
7. Pinned elements must not sit under an ancestor with `transform`, `filter`, `backdrop-filter`, `will-change` or `contain`. Reveal tweens on ancestors end with `clearProps: 'transform,opacity'`.
8. No continuous `filter: blur()` animation. Glow is a pre-blurred layer whose **opacity** animates.
9. Motion respects `prefers-reduced-motion`, `Save-Data`, `deviceMemory <= 2`, hidden tab, and off-screen. Verified by the tier matrix in 1.2.
10. Budget: deferred motion chunk <= 70 KB gz; initial JS unchanged or smaller than today (framer-motion gone).

---

## 1. Architecture

### 1.1 Folder: `apps/web/src/motion/`

```
src/motion/
  tier.ts            detectMotionTier(), useMotionTier()          (no gsap import)
  provider.tsx       <MotionProvider>: tier context, engine loading, Lenis, anchors, lang refresh
  engine.ts          loadEngine(): dynamic import of gsap + ScrollTrigger + SplitText + lenis, registration, singletons
  use-fx.ts          useFx(scopeRef, build, deps): gsap.context wrapper that waits for the engine
  use-scroll-flag.ts useScrollFlag(px): one shared scroll listener for Nav / MiniPlayer
  split-words.tsx    <SplitWords as="h2">: SplitText words wrapper with key={lang}, aria, fonts.ready
  reveal.ts          registerReveals(): one ScrollTrigger.batch for every [data-fx] element
  bg/waves.tsx       React Bits "Waves" (TS-Tailwind copy), adapted: DPR cap, IO + visibility pause, tier density, RTL mirror
  tokens.ts          EASE, DUR, STAGGER constants shared by all sections
```

Nothing in `src/sections/**` or `src/components/**` imports `gsap` or `lenis` directly. They import `useFx`, `useMotionTier`, `SplitWords`, and use `data-fx` attributes.

### 1.2 Capability tiers — `useMotionTier(): 'full' | 'lite' | 'static'`

Evaluated once at mount (hard signals) and re-evaluated by `gsap.matchMedia` for the live signals.

| Signal | static | lite | full |
|---|---|---|---|
| `prefers-reduced-motion: reduce` | yes | — | — |
| `navigator.connection.saveData === true` | yes | — | — |
| `navigator.deviceMemory <= 2` (undefined counts as ok) | yes | — | — |
| `(pointer: coarse)` or `width < 1024` | — | yes | — |
| `hardwareConcurrency <= 4` (undefined = ok) | — | yes | — |
| otherwise (desktop, fine pointer, >= 1024 px) | — | — | yes |

What each tier does:

| Capability | static | lite | full |
|---|---|---|---|
| Engine chunk (gsap+ST+SplitText+lenis) loaded | no | yes | yes |
| Lenis smooth scroll | no | no (native touch) | yes |
| `[data-fx]` reveals (opacity/y, batched) | none — everything visible | yes | yes |
| SplitText words on headings | no | yes | yes |
| Scrubbed timelines (hero wave, pricing glow, footer parallax) | no — final/resting state | yes, `scrub: true` (no lag) | yes, `scrub: 0.6–1` |
| Pins (Apps phone) | no | no — timer-driven screen cycle | yes |
| Waves canvas background | no — CSS gradient | yes, low density, 30 fps, no pointer | yes, full density, pointer, 60 fps |
| Beat loops (`--beat`) | frozen (reduced-motion CSS) | yes | yes |
| Hero CSS entrance | instant (`animation: none`) | yes | yes |

The provider writes the tier to `<html class="motion-full|motion-lite|motion-static">` so pure-CSS fallbacks can key off it, and adds `has-prop` when `CSS.registerProperty` exists (needed by the beat multiplier, see 3.3).

`gsap.matchMedia` conditions used inside `engine.ts` (also exposed to `useFx` callbacks):

```ts
const mm = gsap.matchMedia();
mm.add({
  reduce:  '(prefers-reduced-motion: reduce)',
  desktop: '(min-width: 1024px) and (pointer: fine)',
  mobile:  '(max-width: 1023px), (pointer: coarse)',
}, (ctx) => { const { reduce, desktop } = ctx.conditions!; /* build per tier */ });
```

Reduced-motion flipped at runtime -> matchMedia reverts all contexts; the provider also tears Lenis down and sets `motion-static`.

### 1.3 Load sequence and code splitting

```
t0  HTML + CSS + React mount          hero CSS entrance runs, page fully readable
t1  requestIdleCallback after 'load' (cap 2 s), tier != static
      -> import('./engine')  (Vite chunk "fx": gsap core 28 + ScrollTrigger 18 + SplitText 3.7 + lenis 7 ≈ 57 KB gz)
      -> gsap.registerPlugin(ScrollTrigger, SplitText); ScrollTrigger.config({ ignoreMobileResize: true, limitCallbacks: true })
      -> set hidden state ONLY on [data-fx] elements whose rect.top > innerHeight; register batch reveals
      -> full tier: new Lenis(); lenis.on('scroll', ScrollTrigger.update); gsap.ticker.add(t => lenis.raf(t * 1000)); gsap.ticker.lagSmoothing(0)
      -> document.fonts.ready.then(() => split headings)
t2  Hero enters/stays in view and tier != static
      -> React.lazy(() => import('./bg/waves'))   (≈ 8 KB gz, canvas 2D; see 2.1)
```

`vite.config.ts` `manualChunks`: `gsap` and `lenis` -> `'fx'`; remove the `framer-motion -> 'motion'` rule. Dynamic imports already produce separate chunks; the manual rule only guarantees gsap core + plugins share one file.

Package changes: `gsap` `^3.12.5` -> `^3.15.0` (node_modules already resolves 3.15.0; align the range), add `lenis` `^1.3.0`, remove `framer-motion`. No `@gsap/react` — `useFx` is a 20-line hook (we need it to wait on a dynamic import, which `useGSAP` does not).

### 1.4 framer-motion: removed, not kept

Today framer-motion does four jobs: viewport reveals, scroll parallax, hero entrance variants, and `AnimatePresence` for four collapsibles (PromoBar, Nav mobile menu, Faq answers, MiniPlayer). The first three move to GSAP/CSS by design. Keeping ~32 KB gz of framer-motion only for four presence transitions would mean two engines in the bundle; each of those four is cheaper in CSS:

| Today | Replacement |
|---|---|
| `AnimatePresence` height 0 -> auto (PromoBar, Nav menu, Faq) | `<Collapse open>`: `display:grid; grid-template-rows: 0fr -> 1fr; transition: grid-template-rows .3s` + inner `overflow:hidden; min-height:0`. Element stays mounted (`aria-hidden`/`inert` when closed). Pure CSS, reduced-motion safe via media query. |
| `AnimatePresence` slide-up (MiniPlayer) | stays mounted; `.is-visible` toggles `translateY(0)/translateY(120%)` + `visibility` with a `transition`. |
| `MotionConfig reducedMotion="user"` | `gsap.matchMedia` reduce condition + existing `@media (prefers-reduced-motion)` CSS. |
| `useScroll`/`useTransform` (hero aurora) | GSAP scrub in the hero timeline (2.1). |
| `whileInView` on `motion.li` | `data-fx` batch reveal (1.5). |

React Bits text components that `import 'motion/react'` are therefore **not used**. Every text effect we need is SplitText words + GSAP. `motion` (the renamed framer package) is not added.

### 1.5 Reveal convention (replaces `components/reveal.tsx`)

```html
<li data-fx="rise" data-fx-delay="0.08">…</li>
<div data-fx="rise" data-fx-y="40">…</div>
```

`registerReveals()` runs once per engine load and once after each language change:

```ts
ScrollTrigger.batch('[data-fx="rise"]', {
  start: 'top 88%', once: true, interval: 0.08,
  onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, duration: DUR.reveal, ease: EASE.out,
                                    stagger: STAGGER.card, clearProps: 'transform,opacity' }),
});
```

Hidden state (`opacity: 0, y: 24`) is applied by `gsap.set` only to elements below the fold at registration time (rule 2). `data-fx-y` overrides the distance. Items that must not reveal on `static` simply never get the hidden state. `SectionHeading` renders its block with `data-fx="rise"` and its `<h2>` through `SplitWords`.

### 1.6 Lenis details (full tier only)

- `new Lenis({ lerp: 0.1, wheelMultiplier: 1, smoothWheel: true, syncTouch: false })`. Touch stays native by design; Lenis is created only on `full`.
- Integration exactly as the brief: `lenis.on('scroll', ScrollTrigger.update)`; `gsap.ticker.add((t) => lenis.raf(t * 1000))`; `gsap.ticker.lagSmoothing(0)`.
- Required CSS (append to `styles.css`): `html.lenis, html.lenis body { height: auto }`, `.lenis.lenis-smooth { scroll-behavior: auto !important }`, `.lenis.lenis-stopped { overflow: hidden }`, `.lenis.lenis-smooth [data-lenis-prevent] { overscroll-behavior: contain }`. The existing `html { scroll-behavior: smooth }` stays for lite/static (native anchors).
- Anchors: the provider installs one delegated click listener on `a[href^="#"]`. On `full` it calls `lenis.scrollTo(target, { offset: -headerOffset(), duration: 1.1, easing: expoOut })` and `history.pushState` the hash; `headerOffset()` = measured height of the fixed header stack (`PromoBar` + `Nav`) which changes when the promo bar is dismissed, falling back to the computed `scroll-padding-top` of `<html>` (120 px today). `Footer` back-to-top uses the same path. Initial-load hashes are left to the browser (Lenis starts after load).
- `ScrollTrigger.refresh()` after: Lenis init, `document.fonts.ready`, language/dir change (layout mirrors), PromoBar dismiss (header height changes), and lazy Waves mount.
- Do not use `ScrollTrigger.normalizeScroll()` (hijacks touch) and do not use `scrollerProxy` (Lenis scrolls the window, no proxy needed).

### 1.7 Beat (tempo) contract

`:root { --beat: 500ms }`. `.is-playing` currently sits on the `PlayerCard` root only; the hero waveform, CTA rings and footer are outside it. **Move the class to `<html>`**: `PlayerProvider` toggles `document.documentElement.classList.toggle('is-playing', playing)` in an effect. All existing selectors (`.is-playing .animate-spin-slow`, `.progress-fill`) keep working as descendants. Beat consumers use only CSS animations with `animation-duration: calc(var(--beat) * N)`; GSAP never drives the beat (keeps the ticker idle when the user is not scrolling).

Existing durations retuned to multiples of the beat: equalizer `eq-dance` 0.9 s -> `calc(var(--beat) * 2)`; `blink-glow` 1.4 s -> `calc(var(--beat) * 3)`; `pulse-ring` 3 s -> `calc(var(--beat) * 4)`.

---

## 2. Per-section choreography

Shared constants (`motion/tokens.ts`):

```ts
export const EASE = { out: 'expo.out', soft: 'power3.out', inOut: 'power2.inOut', back: 'back.out(1.4)' };
export const DUR  = { reveal: 0.7, words: 0.6, sweep: 1.2, snap: 0.45 };
export const STAGGER = { card: 0.08, words: 0.045, tile: 0.06 };
export const SCRUB = { full: 0.8, lite: true };   // lite = no lag (cheaper), full = smoothed
```

`expo.out` is the GSAP equivalent of the `cubic-bezier(0.16,1,0.3,1)` used everywhere today, so the feel is continuous with the current site.

Section order on the page (unchanged): Hero -> Radio -> Features -> Pricing -> Apps -> Faq -> Cta -> Footer. Scroll narrative: **a flat, dark line kindles into a living waveform (Hero) -> you tune the dial (Radio) -> the station's promises light up one by one (Features, Pricing) -> it lives in your pocket (Apps) -> questions (Faq) -> the station pulses, calling you in (Cta) -> the name glows from the ground (Footer).**

### 2.1 Hero — signature "flat line -> waveform rising / light kindles"

Components: `sections/hero.tsx`, new `components/waveform.tsx`, lazy `motion/bg/waves.tsx`, existing `PlayerCard`.

Layout change: a full-bleed `Waveform` strip (height `clamp(120px, 22vh, 220px)`) sits at the bottom of the hero behind the content, overlapping the section's bottom edge by ~40 px so the line "leads into" Radio.

**Waveform spec** (`components/waveform.tsx`, pure SVG + CSS, no deps):
- `<svg viewBox="0 0 1000 200" preserveAspectRatio="none" aria-hidden>` containing N `<rect>` bars: N = 64 on `full`, 40 on `lite`, 40 on `static`. Bar width 6, gap computed; `transform-origin: 50% 100%` is wrong for a waveform — bars are centred vertically: `y = 100 - h/2`, `transform-origin: 50% 50%`, `transform: scaleY(calc(var(--amp) * var(--env) * var(--beat-mult)))`.
- `--env` (per bar, inline style) is a deterministic envelope `0.25 + 0.75 * |sin(i*0.37) * sin(i*1.9+0.6)|` so the silhouette reads as music, not noise, and is identical across renders (no random -> no hydration/strict-mode jitter).
- `--amp` lives on the `<svg>`: `0.03` = the flat line at rest. GSAP scrubs it to `1`.
- `--kindle` (0 -> 1) on the `<svg>` drives a sweep: bar `fill` is `url(#wave-grad)` (vertical `--wave-dim` -> `--primary` -> `--accent`) and a second `<rect>` group ("ember", `fill: var(--ember)`, `opacity: calc(var(--kindle) * 0.9)`) is clipped by a `<clipPath>` whose width is `calc(var(--kindle) * 100%)` starting from the inline-start edge. RTL: the clipPath rect uses `x = 1000 - width` (set via `sign`/`dir` prop), so the light travels right -> left in Persian.
- Glow: on `full` only, a third group is a copy of the bars with `filter: blur(10px)` applied **statically**; its `opacity` = `calc(var(--kindle) * 0.55)`. On `lite`/`static` the glow is a single pre-blurred radial-gradient `<div>` behind the strip whose opacity follows `--kindle`.
- Beat: `.has-prop.is-playing .wave-bar { animation: wave-beat calc(var(--beat) * 2) ease-in-out infinite alternate; animation-delay: calc(var(--i) * -41ms) }` where `@keyframes wave-beat { from { --beat-mult: 0.85 } to { --beat-mult: 1.3 } }` and `@property --beat-mult { syntax: '<number>'; inherits: false; initial-value: 1 }`. Without `has-prop` the multiplier stays 1 (no flicker).

**Timeline (tier `lite`/`full`)**, `useFx(sectionRef, ...)`:

```ts
const tl = gsap.timeline({ scrollTrigger: { trigger: section, start: 'top top', end: 'bottom 30%', scrub: tier === 'full' ? 0.8 : true } });
tl.to(wave, { '--amp': 1, ease: 'none' }, 0)                       // line rises across the whole range
  .to(wave, { '--kindle': 1, ease: 'power1.in' }, 0.15)            // light sweeps from the start edge, slightly after the rise begins
  .to(aurora, { yPercent: 22, ease: 'none' }, 0)                   // replaces framer useTransform (0..160px)
  .to(copy, { yPercent: -12, opacity: 0.35, ease: 'none' }, 0.3)   // full only; headline recedes
  .to(playerWrap, { yPercent: -20, ease: 'none' }, 0);             // full only; card drifts faster than copy (depth)
```

No pin. Trigger range = the hero's own height so a fast scroller never gets trapped.

**Entrance (all tiers, CSS only)**: `.hero-in > *` get `animation: hero-rise .7s cubic-bezier(.16,1,.3,1) both; animation-delay: calc(var(--n) * 90ms)`; the player card uses `hero-rise-card .8s` with `--n: 4`. `motion-static` and reduced-motion: `animation: none`. The headline keeps the existing `animate-gradient-text`; it is **not** split (first paint must not wait for fonts/engine).

**Waves background** (`motion/bg/waves.tsx`): React Bits "Waves" is a 2D-canvas component (lines displaced by noise, pointer attraction) with no library imports — this is the one to copy. The brief lists Threads/Aurora/Silk as dependency-free too; **verify on copy**: if the TS-Tailwind source imports `ogl` or `three`, it is not dependency-free for our bundle and is out. Waves is the primary choice regardless (it is literally the brand). Adaptations on copy:
- props: `lineColor = color-mix(primary 35%)`, `xGap` 14 / `yGap` 38 on `full`, `xGap` 22 / `yGap` 52 on `lite`; pointer attraction only on `full`.
- `dpr = Math.min(devicePixelRatio, 1.5)`; `lite` throttles the rAF loop to 30 fps (skip every other frame).
- pause when `document.hidden` and when its `IntersectionObserver` says the hero is < 5 % visible; resume on re-enter.
- rendered inside `<Suspense fallback={null}>` over the always-present CSS aurora gradient, so `static` and the pre-load window look identical minus the lines.
- RTL: wrapper `html[dir=rtl] .waves-wrap { transform: scaleX(-1) }` so the drift reads start -> end in both directions (no change inside the copied component).
- opacity 0 -> 0.9 over 0.8 s on mount (CSS transition) so lazy mount never pops.

**Static tier**: `--amp: 0.55`, `--kindle: 1` set in CSS under `html.motion-static` — the hero shows a lit, resting waveform.

### 2.2 Radio — "tune the dial"

Components: `sections/radio.tsx`, new `components/radio-dial.tsx`, existing `Equalizer`, `usePlayer`.

**Dial** (new, sits between `SectionHeading` and the tile grid): an SVG tuner scale, 6 labelled stops (one per `CHANNEL_KEYS` entry) with fake FM frequencies (`88.1, 91.3, 94.6, 98.0, 101.7, 105.4`; labels are decorative digits, formatted with `Intl.NumberFormat(lang)` like the listener counts), minor ticks between, and a glowing needle (2 px line + pre-blurred halo). The stops are laid out with CSS `flex` in DOM order, so the physical left/right order mirrors automatically in RTL; the needle's position is measured from the active stop's `offsetLeft + offsetWidth/2` (physical coordinates — correct in both directions, no `sign` needed).

- On section enter (`start: 'top 70%'`, once): ticks draw in with `stagger: { each: 0.012, from: 'center' }` (opacity + `scaleY` from 0), 0.5 s; then the needle **scans**: `gsap.fromTo(needle, { x: startEdgeX }, { x: activeX, duration: DUR.sweep, ease: EASE.inOut })` with the halo opacity peaking mid-sweep. `lite`: same, sweep 0.9 s. `static`: needle rendered at the active stop, no sweep, ticks visible.
- On channel change (any time, any tier except static-with-reduced-motion where it snaps): `gsap.to(needle, { x: activeX, duration: DUR.snap, ease: EASE.back })`, halo flashes `0.4 -> 1 -> 0.4` over `calc(var(--beat)*2)`. The dial listens to `usePlayer().channel`.
- Tiles: `data-fx="rise"` with `STAGGER.tile`; replaces the per-`motion.li` observers. Active tile ring: `box-shadow` 0 -> `0 0 0 1px primary, 0 0 32px primary/35%` via CSS transition (already partly there). The `Equalizer` inside the active tile is already beat-driven after 1.7.
- Listener counts: no count-up (digits are fake and Persian-formatted; a counter would draw attention to a placeholder).

### 2.3 Features — "promises light up"

Component: `sections/features.tsx`.

- Heading via `SplitWords`. Cards `data-fx="rise"` with `STAGGER.card`, 3-column rows reveal left->right in reading order (DOM order = logical order, so RTL mirrors for free).
- Icon tile "kindle" on reveal: the 12×12 icon box gets `--lit: 0 -> 1` over 0.5 s after its card lands (`delay: index*0.08 + 0.25`), which drives `box-shadow: 0 0 calc(var(--lit)*24px) ember/45%` and the icon colour `color-mix(foreground, accent calc(var(--lit)*60%))`. One tween per card, no per-frame layout.
- Hover hotspot stays CSS. `lite`: identical (cheap). `static`: cards visible, `--lit: 1`.

### 2.4 Pricing — "the featured plan lights"

Component: `sections/pricing.tsx`.

- Cards `data-fx="rise"`; the featured (`yearly`) card keeps its `-translate-y-3`, so give it `data-fx-y="52"` so it lands last and highest.
- Scrubbed glow on the featured card: `scrollTrigger { trigger: card, start: 'top 85%', end: 'top 45%', scrub: SCRUB[tier] }` tweens `--glow: 0 -> 1`, consumed by `box-shadow: 0 24px 80px -24px color-mix(primary calc(var(--glow)*45%))` and the crown badge `filter: none` (it sits on a pre-blurred halo `<span>` whose opacity = `--glow`).
- Disabled "coming soon" buttons: no motion (they are intentionally inert).
- `static`: `--glow: 1`.

### 2.5 Apps — signature "pinned phone" (desktop)

Component: `sections/apps.tsx` (`PhoneMock` grows three screens).

The phone needs three screens to be worth pinning: (1) library (today's mock), (2) now playing (vinyl + progress, reuse `PlayerCard` visuals at phone scale), (3) radio dial (mini `RadioDial`). Screen 2/3 strings are owned by the story spec (`t.apps.phone.*` keys to be added there; this spec only requires three `aria-hidden` screens).

**full**: pin the whole rounded card (`#apps > .card`) — it has no transformed ancestor once `Reveal` is gone.

```ts
ScrollTrigger.create({ trigger: card, start: 'top 12%', end: '+=140%', pin: true, pinSpacing: true, anticipatePin: 1, scrub: 0.8, invalidateOnRefresh: true, animation: tl });
tl.fromTo(phone, { rotateY: sign * -14, yPercent: 6 }, { rotateY: 0, yPercent: 0, ease: EASE.soft, duration: 0.3 }, 0)   // perspective 1200px on the wrapper
  .to(screen1, { opacity: 0, yPercent: -6, duration: 0.15 }, 0.33).fromTo(screen2, { opacity: 0, yPercent: 6 }, { opacity: 1, yPercent: 0, duration: 0.15 }, 0.33)
  .to(screen2, { opacity: 0, yPercent: -6, duration: 0.15 }, 0.66).fromTo(screen3, { opacity: 0, yPercent: 6 }, { opacity: 1, yPercent: 0, duration: 0.15 }, 0.66);
```

Platform rows (web / android / ios) highlight in sync: `tl.to(row[i], { '--row-lit': 1 }, 0.33*i)` and the previous row back to 0 — `--row-lit` drives the border colour and a 2 px start-edge accent bar. The pin is limited to the card, the section heading above scrolls normally, and `end: '+=140%'` keeps the hold short (≈ 1.4 viewports).

**lite**: no pin. Screens auto-cycle every 3.2 s only while the phone is in view (IO threshold 0.5), crossfade 0.4 s, rows highlight in sync. Phone reveals with `data-fx="rise" data-fx-y="40"`.

**static**: screen 1 only, rows all neutral.

The phone float (`animate-float-slow`) is removed inside the pin (two transforms fighting); a subtle `translateY` breath of 4 px over `calc(var(--beat)*8)` is allowed on the inner screen wrapper, not the pinned element.

### 2.6 Faq

Component: `sections/faq.tsx`.

- List block `data-fx="rise"`; heading via `SplitWords`.
- Accordion: `AnimatePresence` -> `<Collapse open>` (grid-rows transition, 0.3 s, `cubic-bezier(.16,1,.3,1)`). The chevron rotation stays CSS. No GSAP here.

### 2.7 Cta — signature "sound rings"

Components: `sections/cta.tsx`, new `components/sound-rings.tsx`.

- Behind the button: 3 concentric rings (`border: 1px solid`, colours primary / ember / accent at 60/45/30 % alpha, pre-blurred halo on the innermost). `@keyframes ring-out { from { transform: scale(.55); opacity: .8 } to { transform: scale(2.6); opacity: 0 } }`, `animation-duration: calc(var(--beat) * 4)`, delays `0`, `calc(var(--beat))`, `calc(var(--beat)*2)` — so while the demo player is "playing" the rings leave on the beat.
- Rings only animate while the section is on screen: `ScrollTrigger.create({ trigger: section, start: 'top bottom', end: 'bottom top', onToggle: s => section.classList.toggle('rings-on', s.isActive) })`. Off screen they are `animation-play-state: paused` (saves CPU on long pages).
- Entrance (once, `start: 'top 75%'`): title words via `SplitWords` (`yPercent: 60 -> 0`, opacity, `STAGGER.words`), body block rise, button `scale .9 -> 1` with `EASE.back` and a one-shot flare (`--flare: 0 -> 1 -> 0` over 0.9 s driving a radial-gradient overlay's opacity).
- `lite`: identical; the rings are CSS and cheap. `static`: rings frozen at scale 1.2 / 1.7 / 2.2 with 0.25 / 0.15 / 0.08 opacity (a still "sound" glyph), no flare.

### 2.8 Footer — "the name glows from the ground"

Component: `components/ui/motion-footer.tsx`.

- Watermark parallax: `scrollTrigger { trigger: footer, start: 'top bottom', end: 'bottom bottom', scrub: SCRUB[tier] }` tweens the watermark `yPercent: 45 -> 12` and its `--wm-glow: 0 -> 1`, which switches the text gradient from the current 9 % foreground fade to `linear-gradient(180deg, ember/35%, primary/18%, transparent 75%)` (light rising from below). Pre-blurred ember glow `<div>` at the bottom edge with opacity = `--wm-glow`.
- "ready" line via `SplitWords` on enter.
- Marquee: stays CSS/LTR; add the same `onToggle` play-state pause as the CTA rings.
- `static`: watermark at `yPercent: 20`, `--wm-glow: .6`.

### 2.9 Chrome: Nav, PromoBar, MiniPlayer, ScrollProgress, PlayerCard

- `Nav` and `MiniPlayer` both own a scroll listener; replace with `useScrollFlag(threshold)` (one passive listener, works before the engine loads and on `static`). Thresholds unchanged (12 px; `innerHeight * 0.9`).
- `Nav` mobile menu and `PromoBar`: `<Collapse>` (1.4). PromoBar dismiss -> provider `ScrollTrigger.refresh()` (header height changes the anchor offset).
- `MiniPlayer`: stays mounted; `.is-visible` class transition (translate + visibility), 0.35 s. Its equalizer is already beat-driven.
- `ScrollProgress`: CSS scroll-driven animation where supported, GSAP fallback otherwise:

  ```css
  .scroll-progress { transform-origin: var(--origin-x, left) center; }
  html[dir=rtl] .scroll-progress { --origin-x: right; }
  @supports (animation-timeline: scroll()) {
    .scroll-progress { animation: grow linear both; animation-timeline: scroll(root); }
    @keyframes grow { from { transform: scaleX(0) } to { transform: scaleX(1) } }
  }
  ```
  Fallback (`useFx`): `ScrollTrigger.create({ onUpdate: s => setX(s.progress) })` with `setX = gsap.quickTo(bar, 'scaleX', { duration: .25 })`. Reduced motion: still shows progress (it is information, not decoration), with no smoothing.
- `PlayerCard`: unchanged visually; the `is-playing` class moves to `<html>` (1.7). The vinyl `spin-slow` 8 s becomes `calc(var(--beat) * 16)`.

---

## 3. Visual system

### 3.1 Colour tokens (add to `:root` in `styles.css`, expose via `@theme inline`)

| Token | Value | Role |
|---|---|---|
| `--ember` | `oklch(0.72 0.19 45)` | the "kindle" colour: warm orange between primary magenta and accent amber; used for the sweep front, ring 2, footer ground glow |
| `--glow` | `oklch(0.93 0.10 85)` | hottest highlight (wave crests when `--kindle` = 1, needle core) |
| `--wave-dim` | `oklch(0.38 0.05 300)` | unlit waveform / dial ticks at rest (visible against `--background` 0.12 L at ~2.5:1 — decorative only, never text) |
| `--line` | `oklch(0.30 0.03 300)` | the resting flat line before kindling |
| `--beat` | `500ms` | tempo |

Existing `--primary` (magenta), `--secondary` (violet), `--accent` (amber) stay. Text contrast is unaffected: the new tokens are never used for text except `--accent` which already passes. Run `npm run contrast:check` from `apps/dashboard` only if that script is shared; `apps/web` has no checker today — verify the new tokens against `--background`/`--card` manually (ember on background ≈ 6.9:1, glow ≈ 15:1).

### 3.2 "Kindle" light treatment (the brand gesture)

Three layers, always in this order, always animated by **opacity or a custom property**, never by blur radius:

1. **Core** — the lit element itself (bar fill, needle, badge). Colour ramps `--wave-dim -> --primary -> --accent -> --glow` as the local `--kindle`/`--lit` goes 0 -> 1 (`color-mix(in oklch, ...)`).
2. **Halo** — a copy or ring with `filter: blur(8–12px)` set once (full tier) **or** a radial-gradient `<div>` (lite/static). Opacity = 0.55 × local progress.
3. **Ambient** — a large soft radial gradient (`blur(48px)` equivalent via gradient stops, never a filter) in `--ember` at 20–25 %, opacity = 0.9 × local progress. On `lite` the ambient layer is shared per section (one element), not per card.

Light always enters from the **inline-start** edge (left in EN, right in FA) and travels toward inline-end — the direction of reading. Vertical light (footer) rises from the bottom.

### 3.3 Beat / tempo CSS

```css
:root { --beat: 500ms; }
@property --beat-mult { syntax: '<number>'; inherits: false; initial-value: 1; }
/* loops only run while playing; everything is paused otherwise */
.eq-active .eq-bar       { animation-duration: calc(var(--beat) * 2); }
.animate-blink           { animation-duration: calc(var(--beat) * 3); }
.animate-pulse-ring, .ring { animation-duration: calc(var(--beat) * 4); }
.animate-spin-slow       { animation-duration: calc(var(--beat) * 16); }
```

Rule: a beat loop may animate `transform`, `opacity`, or a registered custom property — nothing that triggers layout or paint of neighbours.

### 3.4 Waveform SVG spec

- Canvas `viewBox 0 0 1000 200`, `preserveAspectRatio="none"`, width 100 %, height `clamp(120px, 22vh, 220px)`.
- Bars: N = 64 (full) / 40 (lite, static). width 6 (full) / 10 (lite). Rounded ends via `rx = width/2`. Max height 180, centred at y = 100.
- Envelope per bar `--env` as in 2.1; amplitude `--amp` (0.03 rest, 1 lit); `--kindle` sweep; `--beat-mult` pulse (0.85–1.3, alternate, per-bar delay `-41ms × i` so the pulse "travels").
- Fill gradient `#wave-grad`: `--wave-dim` (bottom) -> `--primary` (50 %) -> `--accent` (85 %) -> `--glow` (top).
- Ember layer: same bars in `--ember`, `mix-blend-mode: screen`, clipped by `--kindle` from inline-start.
- Full-tier glow group: `filter: blur(10px)` static, `opacity: calc(var(--kindle) * .55)`.
- All attributes derived from `i` are inline `style` custom properties (`--i`, `--env`); no per-bar React state, no re-render on scroll.

### 3.5 Typography motion rules

- Split with `SplitText.create(el, { type: 'words', wordsClass: 'w', aria: 'auto', autoSplit: true, onSplit: (self) => tween })` — `aria: 'auto'` puts the full text in `aria-label` on the heading and `aria-hidden` on the spans; `autoSplit` re-splits on font load/resize and re-runs `onSplit`.
- Allowed: `type: 'words'` and `type: 'lines,words'` with `mask: 'lines'` for a rise-from-mask on `full` headings. **Never `chars`.** Lines are whole, so masks are RTL-safe.
- Split only after `document.fonts.ready` (Vazirmatn vs Plus Jakarta change line breaks).
- Word tween: `yPercent: 60 -> 0`, `opacity: 0 -> 1`, `duration: DUR.words`, `ease: EASE.out`, `stagger: STAGGER.words`, total capped at 0.6 s (`stagger: { each: .045, from: 'start' }`, if words > 12 use `amount: 0.5`).
- Body copy is never split; it reveals as one block (`data-fx="rise"`).
- Hero `<h1>` is never split (first paint rule). Section `<h2>`s, CTA title and footer "ready" line are.
- Words keep `display: inline-block` only during the tween; `clearProps: 'all'` on complete so `text-wrap: balance` and bidi punctuation render natively afterwards.
- `key={lang}` on every split element; the hook `revert()`s on cleanup.
- Reduced motion / static: not split at all.

### 3.6 RTL mirroring rules (fa is the default language)

| Thing | Rule |
|---|---|
| `x`, `xPercent`, `rotateY`, `skewX` in any tween | multiply by `sign` from `useFx` (`dir === 'rtl' ? -1 : 1`) |
| Waves canvas drift | wrapper `scaleX(-1)` under `html[dir=rtl]` |
| Waveform kindle sweep, feature-card accent bar, Apps row accent bar | start at inline-start via logical CSS (`inset-inline-start`) or clipPath x computed from `dir` |
| Radio dial needle | measured physical `offsetLeft` of the active stop — no sign needed, do not mirror |
| Staggers | `from: 'start'` in DOM order; DOM order = reading order, so it mirrors automatically |
| ScrollProgress | `transform-origin` via `--origin-x` (left / right) |
| Footer marquee | stays forced `dir="ltr"` (existing) |
| Lenis | vertical only, nothing to mirror |
| Pinned Apps phone tilt | `rotateY: sign * -14` |
| `SplitText` words | DOM order; `aria-label` keeps the untouched string |
| Language toggle mid-page | provider: revert all contexts -> React remounts keyed headings -> `registerReveals()` again -> `ScrollTrigger.refresh()` on the next frame |

---

## 4. Refactor list

### Create

| File | Why |
|---|---|
| `apps/web/src/motion/tier.ts` | tier detection + hook; no gsap import so it is in the initial bundle |
| `apps/web/src/motion/provider.tsx` | single owner of engine loading, Lenis, anchors, html classes, lang/promo refresh |
| `apps/web/src/motion/engine.ts` | dynamic import + plugin registration + matchMedia; the only file that imports `gsap`/`lenis` |
| `apps/web/src/motion/use-fx.ts` | `gsap.context`-scoped hook that waits for the engine and passes `{ gsap, ScrollTrigger, SplitText, tier, dir, sign }` |
| `apps/web/src/motion/use-scroll-flag.ts` | one shared passive scroll listener for `Nav` / `MiniPlayer` |
| `apps/web/src/motion/split-words.tsx` | SplitText words wrapper with `key={lang}`, aria, fonts.ready, revert |
| `apps/web/src/motion/reveal.ts` | `ScrollTrigger.batch` for `[data-fx]`, below-fold-only hidden state |
| `apps/web/src/motion/tokens.ts` | `EASE`, `DUR`, `STAGGER`, `SCRUB` |
| `apps/web/src/motion/bg/waves.tsx` | React Bits Waves copy (TS-Tailwind), adapted per 2.1; lazy |
| `apps/web/src/components/waveform.tsx` | hero bars SVG (3.4) |
| `apps/web/src/components/radio-dial.tsx` | tuner scale + needle (2.2); also reused at phone scale in Apps screen 3 |
| `apps/web/src/components/sound-rings.tsx` | CTA rings (2.7) |
| `apps/web/src/components/collapse.tsx` | CSS grid-rows collapse replacing `AnimatePresence` height animations |

### Change

| File | Change |
|---|---|
| `apps/web/package.json` | `gsap` -> `^3.15.0`; add `lenis` `^1.3.0`; remove `framer-motion` |
| `apps/web/vite.config.ts` | `manualChunks`: gsap + lenis -> `'fx'`; drop the framer-motion rule |
| `apps/web/src/main.tsx` | remove `MotionConfig`; wrap `<App/>` in `<MotionProvider>` (inside `LangProvider` + `PlayerProvider`, it needs both) |
| `apps/web/src/styles.css` | new tokens (3.1), `@property --beat-mult`, beat durations (3.3), Lenis CSS, `.collapse`, `.scroll-progress`, hero CSS entrance, `motion-static` resting states, `rings-on` play-state, reduced-motion additions |
| `apps/web/src/lib/player.tsx` | toggle `is-playing` on `document.documentElement` |
| `apps/web/src/sections/hero.tsx` | drop framer; CSS entrance classes; add `Waveform`, lazy Waves, `useFx` hero timeline |
| `apps/web/src/sections/radio.tsx` | drop `motion.li`; add `RadioDial`; `data-fx` tiles |
| `apps/web/src/sections/features.tsx` | drop `motion.li`; `data-fx`; icon `--lit` tween |
| `apps/web/src/sections/pricing.tsx` | `Reveal` -> `data-fx`; featured `--glow` scrub |
| `apps/web/src/sections/apps.tsx` | `Reveal` -> `data-fx`; three phone screens; pin timeline (full) / timer cycle (lite) |
| `apps/web/src/sections/faq.tsx` | `Reveal` -> `data-fx`; `AnimatePresence` -> `Collapse` |
| `apps/web/src/sections/cta.tsx` | `Reveal` -> `data-fx`; `SoundRings`; entrance timeline |
| `apps/web/src/components/ui/motion-footer.tsx` | watermark scrub, `SplitWords` on "ready", marquee pause |
| `apps/web/src/components/section-heading.tsx` | `Reveal` -> `data-fx`; `<h2>` via `SplitWords` |
| `apps/web/src/components/nav.tsx` | `useScrollFlag`; `AnimatePresence` -> `Collapse` |
| `apps/web/src/components/promo-bar.tsx` | `AnimatePresence` -> `Collapse`; notify provider on dismiss |
| `apps/web/src/components/mini-player.tsx` | `useScrollFlag`; stays mounted with `.is-visible` transition |
| `apps/web/src/components/scroll-progress.tsx` | CSS `animation-timeline` + GSAP fallback; RTL origin |
| `apps/web/src/components/player-card.tsx` | remove local `is-playing` class (now on `<html>`) |
| `apps/web/src/components/equalizer.tsx` | unchanged markup; duration now from CSS beat (no code change expected) |
| `apps/web/index.html` | none required. (Fonts still come from Google Fonts — outside this spec, but note the "no CDN" goal for a later pass; `fonts.ready` gating handles either source.) |

### Delete

| File | Why |
|---|---|
| `apps/web/src/components/reveal.tsx` | replaced by `data-fx` + one batched ScrollTrigger (fewer observers, no framer) |
| `apps/web/src/components/ui/card.tsx` | currently unused by any section (optional cleanup; confirm with `grep` before deleting) |

### Not touched

`apps/web/src/i18n/*` (story spec owns strings; new keys for Apps screens 2/3 and dial labels come from there), `apps/web/src/lib/utils.ts`, `App.tsx`, `pages/home.tsx` (section order unchanged).

---

## 5. Verification plan

1. `npm run typecheck` and `npm run build` in `apps/web`; confirm chunk sizes: initial JS not larger than today, `fx` chunk <= 70 KB gz, `waves` chunk <= 10 KB gz, no `framer-motion` in `dist`.
2. Tier matrix (Chrome DevTools): default desktop = `full` (html class check); Rendering > emulate `prefers-reduced-motion` = `static` (no engine chunk in Network); Network > Save-Data = `static`; device toolbar iPhone 13 = `lite` (no Lenis, no pin, phone screens cycle).
3. Render-check at 1440 / 768 / 390, fa and en: no horizontal overflow at any scroll position, including inside the Apps pin and the hero waveform strip.
4. RTL: in fa the hero light sweeps right -> left, the dial needle lands on the correct tile, the scroll-progress bar fills from the right, the phone tilts the opposite way.
5. Anchors on `full`: nav links, footer links, back-to-top, and keyboard activation all land with the header offset; dismiss the promo bar and repeat.
6. Language toggle while scrolled mid-page: no duplicated/garbled headings, reveals re-run only for below-fold content, `ScrollTrigger.refresh()` fired, no console errors.
7. Play the demo player: equalizers, rings, waveform pulse and vinyl all share the tempo (count 2 ring launches per second ≈ 120 BPM / 4).
8. CPU: Performance panel with 6× throttle on the hero — long tasks < 50 ms after engine load; Waves paused when scrolled past the hero and when the tab is hidden.
9. Accessibility: headings still read as one string in the accessibility tree (SplitText `aria`), focus rings intact on dial stops / tiles / buttons, tap targets >= 44 px unchanged.
