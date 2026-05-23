# Changelog

## 0.3.6 - 2026-05-23

- Strengthened Persian dashboard typography so the app subtree, controls, bold text, and ECharts use the local IRANSans family.
- Added Persian-aware dashboard formatting for clock, percentages, throughput units, latency, packet loss, thresholds, counts, and chart labels.
- Localized known fallback monitoring sample labels in Persian mode, including server names, operators, outbounds, and CPU/RAM labels.

## 0.3.5 - 2026-05-23

- Fixed dashboard packet-loss translations so English uses `Packet loss` / `Loss` and Persian uses `افت بسته`.

## 0.3.4 - 2026-05-23

- Compacted the dashboard information density with smaller panels, cards, rows, charts, and resource strips.
- Reworked the dashboard grid so the second-LCD 1920x1080 monitoring view fits without main-content overflow.
- Added truncation and fixed row sizing to reduce Persian/English label wrapping in dense operational panels.

## 0.3.3 - 2026-05-23

- Changed the desktop dashboard shell so the sidebar remains fixed in place and only the main content pane scrolls.
- Verified English/LTR desktop and second-LCD layouts keep the sidebar flush left with no document-level scrolling.

## 0.3.2 - 2026-05-23

- Fixed the dashboard sidebar so navigation wraps instead of horizontally scrolling on mobile and remains sticky on desktop.
- Hardened dashboard responsive layouts across Dashboard, Servers, Routes, and Alerts pages for English and Persian.
- Added stable navigation data attributes for browser-level responsive checks.

## 0.3.1 - 2026-05-23

- Added local IRANSans/Iranian Sans font-face wiring for Persian dashboard mode without using a CDN.
- Added the dashboard font asset folder, copied the local `Iranian Sans.ttf` asset into it, and documented license-safe font handling.

## 0.3.0 - 2026-05-23

- Added English/Persian dashboard translations with persisted language selection and page direction updates.
- Added a language icon toggle at the bottom of the sidebar beside the version display.
- Added multilingual UI policy documentation and extended version checks to cover local plugin manifests.

## 0.2.1 - 2026-05-23

- Split dashboard traffic monitoring into separate download and upload values in the resource strip, summary cards, capacity panel, and server rows.
- Removed the hardcoded single outbound throughput card from the dashboard.

## 0.2.0 - 2026-05-23

- Added AfroGate versioning workflow with SemVer scripts, changelog policy, version consistency checks, and a local Codex plugin/skill.
- Added the dashboard sidebar version footer sourced from root `package.json`.
- Captured current MVP foundation state after monitoring storage, ECharts dashboard, system resources, sidebar pages, admin guard foundation, control-plane egress, and outbound-management planning.
