# Per-customer fixed-exit enforcement — D2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (this touches the live egress reconciler — execute carefully, validate on one config before trusting). Steps use checkbox (`- [ ]`).

**Goal:** Make D1's per-config Exit selector route for real: a customer pinned to germany/village/direct goes out that path; Auto = today's failover. Pin-to-path only (mirrors the gaming-tier per-account rule mechanism).

**Architecture:** New `preferred_egress_path` column on `client_route_preferences`; backend endpoint persists it; the egress reconciler emits per-account rules (VLESS user / WG source → path tag) before the catch-all; D1's selector offers Auto/Germany/Starlink/Direct.

**Spec:** `docs/superpowers/specs/2026-06-27-d2-fixed-exit-enforcement-design.md`

**Path→tag map:** `germany`→`via-germany`, `village`→`via-village`, `direct`→`direct`.

**Risk:** edits the live egress reconciler. Mitigations: additive rules mirroring the proven gaming pattern; pure unit test; on-box validation on ONE config (Task 5) before relying on it; reversible (null column = auto; reconciler shipped from repo).

---

### Task 1: Migration — `preferred_egress_path`

**Files:** create `infra/postgres/migrations/0048_client_route_preference_egress_path.sql`

- [ ] **Step 1:** Write the migration:
```sql
-- D2: per-client-config fixed egress path (NULL = auto/failover). 'village' is
-- the Starlink path (same target as the gaming tier). Enforced by the egress
-- reconciler, which routes the config's VLESS user / WG source to the path tag.
ALTER TABLE client_route_preferences
  ADD COLUMN IF NOT EXISTS preferred_egress_path text;
ALTER TABLE client_route_preferences
  ADD CONSTRAINT client_route_preferences_egress_path_check
  CHECK (preferred_egress_path IS NULL OR preferred_egress_path IN ('germany','village','direct'));
```
> NOTE: if a same-named constraint could already exist on re-run, guard with a `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;` block; the migration runner applies each file once, so a plain `ADD CONSTRAINT` is fine for first apply.

- [ ] **Step 2:** Commit `git add infra/postgres/migrations/0048_client_route_preference_egress_path.sql && git commit -m "db: client_route_preferences.preferred_egress_path (D2)"`

---

### Task 2: Backend — persist + expose `preferredEgressPath`

**Files:** `apps/backend/src/billing/dto/customer-account.dto.ts` (UpsertClientRoutePreferenceDto), `apps/backend/src/billing/billing.service.ts` (upsert + get + the row→summary mapping), `packages/shared/src/index.ts` (`AdminClientRoutePreferenceSummary`).

- [ ] **Step 1:** Shared type — add to `AdminClientRoutePreferenceSummary` (the per-config route-pref summary; near `preferredOutboundId`): `preferredEgressPath?: 'germany' | 'village' | 'direct' | null;`. Add the same optional to the upsert request type if one is exported.

- [ ] **Step 2:** DTO — in `UpsertClientRoutePreferenceDto` add:
```ts
  @IsOptional()
  @IsIn(['germany', 'village', 'direct'])
  preferredEgressPath?: 'germany' | 'village' | 'direct' | null;
```
(match the validator import style already used in the file; allow null by also accepting it — if `@IsIn` rejects null, use `@ValidateIf((o) => o.preferredEgressPath !== null)` or accept `null` by omitting it client-side to clear.)

- [ ] **Step 3:** `upsertClientRoutePreference` — include `preferred_egress_path` in the INSERT/UPDATE (set from `dto.preferredEgressPath ?? null`). `getClientRoutePreference` + the row→summary mapper — select + map `preferred_egress_path AS "preferredEgressPath"`.

- [ ] **Step 4:** Build: `npm --workspace @afrows/backend run build` → clean; `npm --workspace @afrows/backend run test` → pass.

- [ ] **Step 5:** Commit `git commit -m "feat(backend): route-preference preferredEgressPath (germany/village/direct)"`

---

### Task 3: Reconciler — emit per-path rules (TDD)

**Files:** `scripts/afrows-egress-mode-sync.py`, `scripts/test_egress_mode_sync.py`

- [ ] **Step 1:** Extend the failing test first — in `test_egress_mode_sync.py`, after the existing `desired_rules` order-insensitivity test, add:
```python
# --- D2: fixed-path per-account rules ---
fixed = [
    {"user": ["cc_b@afrows", "cc_a@afrows"], "outboundTag": "via-germany"},
    {"source": ["10.0.0.2", "10.0.0.1"], "outboundTag": "direct"},
]
r = mod.desired_rules("smart", ["t1"], [], [], "proxy", fixed)
# fixed rules present, lists sorted, and all appear BEFORE the catch-all (last rule)
assert {"type": "field", "user": ["cc_a@afrows", "cc_b@afrows"], "outboundTag": "via-germany"} in r
assert {"type": "field", "source": ["10.0.0.1", "10.0.0.2"], "outboundTag": "direct"} in r
assert r[-1]["outboundTag"] == "proxy" and r[-1].get("inboundTag")  # catch-all stays last
# order-insensitive vs reversed fixed input
r2 = mod.desired_rules("smart", ["t1"], [], [], "proxy", list(reversed(fixed)))
assert sorted([str(x) for x in r]) == sorted([str(x) for x in r2])
print("OK: desired_rules fixed-path rules")
```
Run: `python3 scripts/test_egress_mode_sync.py` → FAIL (desired_rules takes 5 args / no fixed handling).

- [ ] **Step 2:** Extend `desired_rules` to accept + emit fixed rules (default empty for back-compat):
```python
def desired_rules(mode, client_tags, gaming_sources, gaming_users, catch_outbound, fixed_rules=None):
    rules = [{"type": "field", "inboundTag": ["api"], "outboundTag": "api"}]
    if mode == "smart":
        rules.append(dict(GEOIP_DIRECT))
        rules.append(dict(GEOSITE_DIRECT))
    if gaming_sources:
        rules.append({"type": "field", "source": sorted(gaming_sources), "outboundTag": "via-village"})
    if gaming_users:
        rules.append({"type": "field", "user": sorted(gaming_users), "outboundTag": "via-village"})
    # D2 fixed-path per-account rules (sorted lists; deterministic order by tag then kind)
    for fr in sorted(fixed_rules or [], key=lambda x: (x["outboundTag"], "user" in x)):
        if fr.get("user"):
            rules.append({"type": "field", "user": sorted(fr["user"]), "outboundTag": fr["outboundTag"]})
        if fr.get("source"):
            rules.append({"type": "field", "source": sorted(fr["source"]), "outboundTag": fr["outboundTag"]})
    rules.append({"type": "field", "inboundTag": sorted(client_tags), "outboundTag": catch_outbound})
    return rules
```

- [ ] **Step 3:** Add path-query helpers (after `xray_gaming_emails`):
```python
PATH_TAGS = {"germany": "via-germany", "village": "via-village", "direct": "direct"}

def path_xray_users(url, path):
    s = psql1(url, (
        "select coalesce(string_agg('cc_' || cc.id || '@afrows', ',' order by cc.id), '') "
        "from client_configs cc "
        "join client_route_preferences rp on rp.client_config_id = cc.id "
        "join customer_accounts ca on ca.id = cc.customer_account_id "
        "where rp.preferred_egress_path = '%s' and cc.status <> 'disabled' and ca.status = 'active'" % path
    ))
    return [x.strip() for x in s.split(",") if x.strip()] if s else []

def path_wg_sources(url, path):
    s = psql1(url, (
        "select coalesce(string_agg(wp.client_address, ',' order by wp.client_address), '') "
        "from wireguard_peers wp "
        "join client_route_preferences rp on rp.client_config_id = wp.client_config_id "
        "join customer_accounts ca on ca.id = (select customer_account_id from client_configs where id = wp.client_config_id) "
        "where rp.preferred_egress_path = '%s' and wp.desired_state = 'present' and ca.status = 'active'" % path
    ))
    return [x.strip() for x in s.split(",") if x.strip()] if s else []
```
(`path` is a fixed key from `PATH_TAGS`, never user input — safe to interpolate.)

- [ ] **Step 4:** Thread `fixed_rules` through `apply_target` + `main`:
- `apply_target(cfg_path, svc, mode, gaming_sources, gaming_users, catch_outbound, fixed_rules=None)` → pass `fixed_rules` into the `desired_rules(...)` call.
- In `main`, per engine in the `for cfg_path, svc, use_db in TARGETS:` loop, build the engine's fixed rules:
```python
        fixed = []
        for p, tag in PATH_TAGS.items():
            if use_db:  # afrows-wg: source-IP rules
                src = path_wg_sources(url, p)
                if src: fixed.append({"source": src, "outboundTag": tag})
            else:       # afrows-xray: VLESS user rules
                usr = path_xray_users(url, p)
                if usr: fixed.append({"user": usr, "outboundTag": tag})
        changed |= apply_target(cfg_path, svc, mode, sources, users, catch, fixed)
```

- [ ] **Step 5:** Run the test: `python3 scripts/test_egress_mode_sync.py` → all PASS (existing + new).

- [ ] **Step 6:** Commit `git commit -m "feat(egress): reconciler enforces per-config fixed egress path (D2)"`

---

### Task 4: Dashboard — Exit selector offers paths

**Files:** `apps/dashboard/src/api/admin.ts` (extend `updateAdminClientRoutePreference` payload), `apps/dashboard/src/pages/CustomersPage.tsx` (the D1 per-config Exit block), i18n `customersPage` (en+fa).

- [ ] **Step 1:** `updateAdminClientRoutePreference` — extend the payload type to include `preferredEgressPath?: 'germany'|'village'|'direct'|null` (and pass it through). Keep the existing `mode`/`preferredOutboundId` for back-compat.

- [ ] **Step 2:** In `CustomersPage`, change the per-config Exit control + its state. Replace the `exitPrefs` model (was `{mode, preferredOutboundId}`) with the path: load `routePreference.preferredEgressPath` per config (via `fetchAdminClientRoutePreference`); render a single select **Auto / Germany / Starlink / Direct**:
```tsx
<select className={inputClass} value={exitPath[cfg.id] ?? 'auto'} onChange={(e) => void saveExitPath(cfg.id, e.target.value)}>
  <option value="auto">{s.exitAuto}</option>
  <option value="germany">{s.exitGermany}</option>
  <option value="village">{s.exitStarlink}</option>
  <option value="direct">{s.exitDirect}</option>
</select>
```
`saveExitPath(configId, v)` → `updateAdminClientRoutePreference(token, configId, { routeGroup:'main', preferredEgressPath: v === 'auto' ? null : v })`. Drop the `fetchAdminOutbounds` relay dropdown for this control. Update the note `exitSavedNote` to say it's enforced (applies within ~1–2 min).

- [ ] **Step 3:** i18n — add `exitGermany: 'Germany'`, `exitStarlink: 'Starlink'`, `exitDirect: 'Direct'`, and change `exitSavedNote` to "Saved — applies within ~1–2 min." (en); fa equivalents («آلمان»/«استارلینک»/«مستقیم»/«ذخیره شد — ظرف ۱ تا ۲ دقیقه اعمال می‌شود»). Keep `exitAuto`.

- [ ] **Step 4:** Gates: `typecheck` + `node --test … nav-views.test.ts` + `vite build` → clean.

- [ ] **Step 5:** Commit `git commit -m "feat(dashboard): Exit selector pins to a path (Auto/Germany/Starlink/Direct)"`

---

### Task 5: Deploy + on-box validation (do not trust until verified)

- [ ] **Step 1:** Merge to `main`, push, `sync.ps1` (runs migration 0048; reconciler reinstalled by update-afrows.sh step 5c). Confirm backend health + migration applied.
- [ ] **Step 2:** Pick ONE test client-config (e.g. the test@afrows.com VLESS). In the dashboard set its Exit = **Direct**. Wait ~2 reconciler cycles.
- [ ] **Step 3:** On the box, confirm the rule landed: `python3 -c` to read `/usr/local/etc/afrows-xray/config.json` routing → a `{user:['cc_<id>@afrows'], outboundTag:'direct'}` rule exists before the catch-all. Confirm that user's exit IP is the direct path (or that the rule is applied).
- [ ] **Step 4:** Set it to **Germany** → confirm the rule flips to `via-germany`. Set to **Auto** → confirm the per-user rule disappears (back to catch-all).
- [ ] **Step 5:** Confirm non-pinned customers are unaffected (catch-all unchanged); reconciler logs no spurious restarts ("no change" between cycles when nothing changed).
- [ ] **Step 6:** If anything misroutes/breaks: set all configs back to Auto (clears the rules) and/or revert the reconciler (`git revert` + redeploy). Document outcome.

---

## Self-Review

**1. Spec coverage:** column (T1); backend persist/expose (T2); reconciler per-path rules + Auto unchanged (T3); selector offers paths + enforced note (T4); on-box validation + revert (T5). ✓
**2. Placeholders:** migration/reconciler/test code given in full; DTO + dashboard steps reference exact files with the change shape; the NOTEs are concrete (constraint-guard, validator style). ✓
**3. Type consistency:** `preferredEgressPath` ('germany'|'village'|'direct'|null) consistent across migration CHECK, DTO, shared summary, wrapper, selector; `PATH_TAGS` maps path→tag consistently in queries + main; `desired_rules` new `fixed_rules` arg defaulted for back-compat (existing callers/tests unaffected). ✓
