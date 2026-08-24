---
name: render-check
description: Verify an HTML page/mock the way Afrows does dashboard QA — headless-Chrome screenshots at desktop/tablet/phone sizes, console-error capture, horizontal AND vertical overflow checks, and `node --check` on inline scripts. Use after editing an Afrows dashboard page/mock or any standalone HTML, before reporting "done".
---

# render-check

```bash
bash .claude/skills/render-check/render.sh <path/to/page.html> [out_dir] [sizes...]
# sizes: "1440"      → width only, tall full-page screenshot (vertical scrolling is fine)
#        "1024x768"  → EXACT viewport: also fails if the page needs vertical scrolling
# defaults: 1440 1024 375   → writes <out_dir>/<name>-<size>.png + <name>-report.txt
```

Afrows context — the dashboard is operated on desktop AND on operator phones (the customer table has a
mobile expandable-row layout), so always check a phone width and, for any kiosk/operator surface, the exact
tablet viewport (a page that needs vertical scrolling on a fixed screen is a fail):
```bash
bash .claude/skills/render-check/render.sh <page.html> "$CLAUDE_SCRATCHPAD" 1440 1024x768 375
```
`voverflow=true` on an exact-viewport size = the operator would have to scroll = fail.

What it does (all local; the page's own assets must be local — the Artifact/dashboard CSP blocks remote hosts):
1. Extracts inline `<script>` blocks and runs `node --check` → syntax errors fail fast.
2. Renders with headless Chrome at each size and captures console errors.
3. Reports horizontal + vertical overflow per size.

Note: the live dashboard (`apps/dashboard`) is a Vite SPA that needs the backend API to populate data, so
render-check is for standalone HTML / mocks and visual/overflow regressions — not a substitute for running the
app against a seeded backend.
