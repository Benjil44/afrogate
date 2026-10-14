# afrows.com — "Wave Station" landing story spec

Scope: `apps/web` (React 19 + Vite + Tailwind 4). Design + copy spec only; no code here.
Brand: **AfroWS = Afrooz Wave Station**. *Afro* = Latin spelling of **افروز** (to kindle, light up); *WS* = **Wave Station / ایستگاه موج**.
Product: Persian music + live radio. The player is a **visual demo, no audio**. Persian is the default language; English is the second.

## 1. Story arc — "tuning in to a station"

One scroll = one act of turning a dial until the signal locks, then living with the station. Every section has one job and one scroll beat. The hero sets a visual motif (a single horizontal **wave line**) that returns in each section's heading as the section "tunes in".

| # | Section (`id`) | Single job | Key message | Scroll beat (what the user feels) |
|---|---|---|---|---|
| 0 | PromoBar + Nav (fixed) | Orientation + launch CTA | "Early members get the yearly discount" | Static; the only thing that doesn't move. |
| 1 | **Hero** `#top` — *Static → Signal* | Explain the name in one breath and make the user *want* to press play | روی موج افروز / Tune in to Afrooz | Page loads to **silence**: a flat line, dim aurora, status "Searching for a signal…". ~0.6 s in (or on first scroll/tap, whichever first): the line **rises into a wave**, the aurora **kindles** (brightness up, brand gradient blooms), status flips to "Signal locked", the title words land one by one (SplitText, words). The wordmark reveals its meaning: **Afro · WS** → *Afrooz · Wave Station*. PlayerCard slides in as the "receiver". |
| 2 | **Stations** `#radio` (existing Radio) | Show the dial: six live channels | A station for every mood | Pinned-free: tiles arrive along the wave line left→right (RTL: right→left) like frequencies lighting up on a dial. Selecting a tile = tuning; the heading's mini wave animates only while demo-playing. |
| 3 | **Signal** `#features` (existing Features) | Why this station sounds better | Clean signal: no ads, studio quality, offline | Calm cards, one short stagger. Beat = *steady*. No parallax. |
| 4 | **Receivers** `#apps` (existing Apps, **moved before pricing**) | Same station on every device | Web first, Android/iOS follow | Phone mock rises; platform rows reveal. Beat = *reach*. |
| 5 | **Your frequency** `#pricing` | Choose how to stay on the wave | Start free, go Premium when you want more | Featured yearly card lifts slightly; others fade in. Beat = *decision*. |
| 6 | **FAQ** `#faq` | Remove doubt | Honest answers, short | No scroll motion beyond a single reveal. Beat = *quiet*. |
| 7 | **Go on air** (CTA) | Convert | Be there the moment we go on air | The hero wave returns full-width behind the card and **pulses once** into view; the primary button is the brightest element on the page. Beat = *climax*. |
| 8 | **Footer sign-off** | Close the broadcast | "Stay on the wave" / روی موج بمان | Marquee of stations, giant wordmark watermark. Beat = *fade-out*. |

Order change: **Apps moves above Pricing** (`home.tsx`: Hero → Radio → Features → Apps → Pricing → Faq → Cta). Rationale: the story is *what you hear → where you hear it → how you keep it*; asking for money after the device story reads as a natural "stay on the wave". Nothing is cut; no section merges. Nav links stay (radio, features, pricing, faq); mini player unchanged.

Motion stack: GSAP core + ScrollTrigger (hero kindling timeline, section wave-line draw, CTA pulse) + SplitText **words only** (hero title, CTA title). Lenis on desktop pointer devices only (`(hover:hover) and (pointer:fine)`, width ≥ 1024). React Bits: at most two components (candidates: a gradient-text for the title and a "shiny" primary button); everything else stays on existing CSS keyframes. framer-motion is **removed** once hero/reveal/faq/nav/promo/mini-player are migrated (GSAP for timelines, CSS transitions + `inert`/height for the accordion and menu) — do not ship both libraries.

## 2. Copy — i18n keys (`src/i18n/en.ts` / `fa.ts`)

Rules: both files share the `Dict` shape; FA is written as Persian, not translated English; digits in FA are Persian (۰–۹); no artist names; prices remain placeholders. **Keep** every key not listed here.

### New keys

| Key | en | fa |
|---|---|---|
| `brandFull` | `Afrooz Wave Station` | `ایستگاه موج افروز` |
| `brandMeaning` | `Afro is Afrooz — to kindle a light. WS is Wave Station.` | `افرو همان افروز است — روشن‌کردن. WS یعنی ایستگاه موج.` |
| `tagline` | `On the Afrooz wave.` | `روی موج افروز.` |
| `hero.signal.searching` | `Searching for a signal…` | `در جست‌وجوی سیگنال…` |
| `hero.signal.locked` | `Signal locked` | `سیگنال پیدا شد` |
| `hero.signal.frequency` | `Afrooz · live` | `افروز · زنده` |
| `hero.wordmark.afro` | `Afro` | `افرو` |
| `hero.wordmark.ws` | `WS` | `WS` |
| `hero.wordmark.afroMeaning` | `Afrooz — to kindle` | `افروز — روشن‌کردن` |
| `hero.wordmark.wsMeaning` | `Wave Station` | `ایستگاه موج` |
| `hero.srIntro` (visually hidden, read once by SR) | `Afrows, the Afrooz Wave Station: Persian music and live radio.` | `افروز، ایستگاه موج افروز: موسیقی فارسی و رادیو زنده.` |
| `cta.eyebrow` | `Going on air` | `به‌زودی روی آنتن` |
| `footer.signoff` | `This was Afrooz Wave Station. Stay on the wave.` | `این بود ایستگاه موج افروز. روی موج بمان.` |

### Changed keys

| Key | en (new) | fa (new) |
|---|---|---|
| `langToggle` | unchanged | unchanged |
| `nav.cta` | `Get on air` | `خبرم کن` |
| `promo.tag` | `On air soon` | `به‌زودی روی آنتن` |
| `hero.badge` | `Afrooz Wave Station · Persian music · Live radio` | `ایستگاه موج افروز · موسیقی فارسی · رادیو زنده` |
| `hero.title` | `Tune in to Afrooz` | `روی موج افروز` |
| `hero.subtitle` | `A station that kindles the night: Persian music, live channels and your own playlists — studio quality, no ads, on every device.` | `ایستگاهی که شب را روشن می‌کند: موسیقی فارسی، کانال‌های زنده و پلی‌لیست‌های خودت — با کیفیت استودیویی، بدون تبلیغ، روی هر دستگاه.` |
| `hero.ctaPrimary` | `Tell me when we go on air` | `وقتی روی آنتن رفتیم خبرم کن` |
| `hero.ctaSecondary` | `Turn the dial` | `موج را بچرخان` |
| `hero.stats.live` | `On air 24/7` | `۲۴ ساعته روی آنتن` |
| `hero.player.title` | `On the wave` | `روی موج` |
| `hero.player.offlineHint` | `Visual preview only — sound arrives with the app.` | `فقط پیش‌نمایش تصویری — صدا با اپ می‌آید.` |
| `radio.tag` | `Stations` | `ایستگاه‌ها` |
| `radio.title` | `A station for every mood` | `برای هر حال‌وهوا، یک ایستگاه` |
| `radio.subtitle` | `Six live channels on one dial. Pick one and let it play.` | `شش کانال زنده روی یک موج. یکی را انتخاب کن و بگذار پخش شود.` |
| `radio.listeners` | `tuned in` | `نفر روی موج` |
| `radio.playChannel` / `pauseChannel` | `Tune in` / `Tune out` | `روی موج برو` / `از موج بیا پایین` |
| `features.tag` | `Clean signal` | `سیگنال تمیز` |
| `features.title` | `No static. Just the music.` | `بدون پارازیت. فقط موسیقی.` |
| `features.subtitle` | `Studio sound, no interruptions, and a library that follows you everywhere.` | `صدای استودیویی، بدون وقفه، و کتابخانه‌ای که همه‌جا همراهت می‌آید.` |
| `features.items.radio.title` | `Always on air` | `همیشه روی آنتن` |
| `apps.tag` | `Receivers` | `گیرنده‌ها` |
| `apps.title` | `One station, every device` | `یک ایستگاه، روی هر دستگاه` |
| `apps.subtitle` | `The web player opens first. Android and iOS follow.` | `اول پخش‌کنندهٔ وب باز می‌شود. اندروید و iOS در راه‌اند.` |
| `pricing.tag` | `Your frequency` | `موج خودت` |
| `pricing.title` | `Stay on the wave, your way` | `هر جور که می‌خواهی روی موج بمان` |
| `pricing.subtitle` | `Start free. Go Premium when you want the whole signal.` | `رایگان شروع کن. هر وقت تمام سیگنال را خواستی، پریمیوم شو.` |
| `pricing.notifyHint` | `We’ll tell you the moment we go on air.` | `به‌محض رفتن روی آنتن خبرت می‌کنیم.` |
| `faq.subtitle` | `Still curious? The footer has our contact.` | `هنوز سؤالی داری؟ راه تماس پایین صفحه است.` |
| `faq.items[0].q` | `When does Afrows go on air?` | `افروز کِی روی آنتن می‌رود؟` |
| `cta.title` | `We go on air soon. Be there.` | `به‌زودی روی آنتن می‌رویم. تو هم باش.` |
| `cta.body` | `Be the first to hear the signal — and keep the early-member yearly discount.` | `اولین کسی باش که سیگنال را می‌شنود — و تخفیف سالانهٔ اعضای اولیه را برای خودت نگه دار.` |
| `cta.button` | `Tell me when we go on air` | `وقتی روی آنتن رفتیم خبرم کن` |
| `footer.tagline` | `Afrooz Wave Station — Persian music, live radio and playlists. Ad-free, everywhere.` | `ایستگاه موج افروز — موسیقی فارسی، رادیو زنده و پلی‌لیست. بدون تبلیغ، همه‌جا.` |
| `footer.ready` | `Stay on the wave.` | `روی موج بمان.` |
| `footer.marquee` (append) | `…, 'Afrooz Wave Station'` | `…, 'ایستگاه موج افروز'` |
| `<title>` / `document.title` (`index.html`, `i18n/index.ts`) | `Afrows — Afrooz Wave Station · Persian music & live radio` | `افروز — ایستگاه موج افروز · موسیقی فارسی و رادیو زنده` |
| `<meta description>` (`index.html`, FA) | — | `افروز، ایستگاه موج افروز: موسیقی فارسی، رادیو زنده و پلی‌لیست‌های شخصی؛ بدون تبلیغ، با کیفیت ۳۲۰ کیلوبیت، روی هر دستگاه. به‌زودی روی آنتن.` |

### Removed keys (unused today, verified by grep)
`hero.comingSoon`, `pricing.perMonth`, `pricing.perYear`.

## 3. Product guardrails

**Performance budget (mobile, slow-3G-ish, mid-range Android):**
- JS added for this work ≤ **70 KB gz total** (GSAP core+ScrollTrigger+SplitText ≈ 35 KB, Lenis ≈ 4 KB, React Bits ≤ 10 KB, our code ≤ 10 KB); framer-motion (~35 KB gz) leaves, so net bundle must be **≤ current + 35 KB**. Keep `manualChunks` for `gsap`; lazy-load Lenis only on desktop match.
- LCP ≤ **2.5 s** on throttled 3G/4× CPU for the hero title (text, not an image); CLS < 0.05 (reserve PlayerCard and wave-line height; no late font swap jump — `font-display: swap` with `size-adjust` fallback metrics).
- No layout work on scroll: ScrollTrigger drives only `transform`/`opacity`/stroke-dash; `will-change` only while a tween runs. Decorative blur layers ≤ 2 per viewport; drop the second floating orb on `< 640px`.
- Zero network requests at idle; no images (keep CSS-gradient art).

**Accessibility:**
- `prefers-reduced-motion: reduce` → hero shows the *locked* state immediately (no searching/kindle timeline), SplitText is not applied, ScrollTrigger reveals become instant, Lenis is not started, existing CSS freeze rule stays.
- **FA text splitting is words-only** (never chars/lines — Persian joined letters and ZWNJ break). Split elements get `aria-hidden` and the original string is kept in a visually-hidden sibling (`hero.srIntro` pattern) so screen readers read whole sentences.
- Keyboard: every control reachable in DOM order; the hero "signal" status is `aria-live="polite"` and announces once; focus ring (`--accent`) never clipped by `overflow:hidden` wrappers.
- Tap targets ≥ 44 px (existing); the lang toggle and dismiss keep their 44 px hit area with the promo bar.
- Contrast: body copy on dark ≥ 4.5:1 (`--muted-foreground` is 0.74 L — keep); accent text never below 14 px bold.

**Privacy (hard rule — everything bundled):**
- **Remove the Google Fonts `<link>`s** in `apps/web/index.html` (today the page calls `fonts.googleapis.com`/`fonts.gstatic.com`). Self-host Vazirmatn (OFL) and Plus Jakarta Sans (OFL) as woff2 subsets under `apps/web/public/fonts/` with `@font-face` in `styles.css`; `preload` only the two weights the hero uses (700/900).
- GSAP, Lenis, React Bits come from npm and are bundled; **no CDN scripts, no analytics, no trackers, no third-party fonts or iframes**. CSP-ready: no inline `<script>`.
- `localStorage` keys stay limited to `afrows.lang`.

**RTL rules:**
- Logical properties only (`start/end`, `ms/me`, `ps/pe`); the wave line and tile stagger run **right→left in `dir=rtl`** (`x: dir === 'rtl' ? 40 : -40`), while the footer marquee stays forced LTR.
- Wordmark reveal order in FA: `افرو` then `WS` (reads as the user reads); Latin `WS` wrapped in `<bdi>`.
- FA uses Persian digits and `٬` thousands separator; `Intl.NumberFormat('fa-IR')` stays for listener counts.
- Lenis + `scroll-padding-top` must respect the fixed header in both directions; test anchors `#radio` … `#faq` in both languages.

## 4. Acceptance criteria (frontend + QA)

- [ ] `home.tsx` order is Hero → Radio → Features → Apps → Pricing → Faq → Cta → Footer; nav/footer anchors all land with the header clear.
- [ ] Hero: flat line → wave + aurora kindle + status "Searching…" → "Signal locked" plays once per load (≤ 1.6 s total) and completes immediately with reduced motion; title lands in **words** in both FA and EN; wordmark shows *Afrooz — to kindle / Wave Station*.
- [ ] `framer-motion` is gone from `package.json` and the build; `npm run build` chunk report shows no `motion` chunk; total gz JS delta vs `0.119.2` ≤ +35 KB.
- [ ] Lighthouse mobile (throttled): LCP ≤ 2.5 s, CLS < 0.05, Performance ≥ 85; no third-party requests in the network panel (fonts served from `/fonts/`).
- [ ] `apps/web/index.html` has no `googleapis`/`gstatic` links; CSP `default-src 'self'` would not break the page.
- [ ] All copy above exists in **both** `en.ts` and `fa.ts`; `npm run typecheck` passes; the three removed keys are gone; `grep` finds no hardcoded user-facing English in `src/**/*.tsx`.
- [ ] Reduced motion: no SplitText, no Lenis, no ScrollTrigger tweens; page fully readable with animations off.
- [ ] Screen reader (NVDA/VoiceOver): hero reads `hero.srIntro` once, the split title is not read word-by-word, signal status announced once (`aria-live="polite"`).
- [ ] Keyboard: Tab order follows DOM in both languages; focus visible on tiles, accordion, mini player, lang toggle; FAQ accordion still exposes `aria-expanded`/`aria-controls`.
- [ ] RTL: wave/tile stagger direction flips; no clipped text, no horizontal overflow at 360×640, 390×844, 768×1024, 1440×900 (run `render-check`).
- [ ] Demo player unchanged in behavior: no audio element, no fetch; mini player appears only when playing and past the hero.
- [ ] `npm run contrast:check` (where wired) passes; accent/muted text contrast ≥ 4.5:1 on `--background` and `--card`.
- [ ] Version bump + `CHANGELOG.md` entry + `npm run version:check`; `.claude/progress.md` updated.
