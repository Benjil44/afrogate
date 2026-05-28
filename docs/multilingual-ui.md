# Multilingual UI Policy

AfroGate dashboard and client surfaces support English and Persian from the first MVP stage.

## Current Approach

- Dashboard strings live in `apps/dashboard/src/i18n.ts`.
- Client app strings live in `apps/client/src/i18n.ts`.
- Language choice is persisted in browser localStorage.
- The selected language updates the page `lang` and `dir` attributes.
- The sidebar footer contains the language icon toggle beside the version.
- Current language support covers English and Persian dashboard operations copy, the admin usage/billing and customer-limit-management surface, and the first VPN-client route/quota/rewarded-data surface.
- Persian typography uses local YekanBakh assets from `apps/dashboard/public/assets/fonts/YekanBakh/`; `index.html` loads `yekanbakh.css` directly and no CDN font source is used.

## Rules

- Do not add new hardcoded user-facing dashboard labels directly inside React components when a translation key is appropriate.
- Do not add new hardcoded user-facing client app labels directly inside React components when a translation key is appropriate.
- Keep technical identifiers such as server IDs, tunnel names, interface names, and route names unchanged unless they become editable display names.
- Prefer short operational Persian labels that fit dense monitoring panels.
- Keep English and Persian keys in the same typed object so TypeScript catches missing translations.
- When adding a new page or sidebar item, add the translation keys in the same commit.
- Do not commit proprietary Persian font files unless the project has a license that allows repository storage and distribution.

## Future Improvements

- Move shared product terminology into a reusable package when the Telegram bot and admin dashboard share copy.
- Add pluralization helpers if counts become more complex than the current short dashboard labels.
- Add locale-aware number and date formatting after real user/admin locale settings exist.
