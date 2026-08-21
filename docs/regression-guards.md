# Afrows Regression Guard Registry

Reusable, **deterministic** guard templates. Every template below already exists in the repo as a
merged test — this catalog points at the canonical example so a future task copies a proven,
non-flaky pattern instead of reinventing one. **No timing-based assertions** (machine-flaky); a
guard proves security by *completing with the correct result* and/or a *structural source check*.

Pairs with `docs/security-patterns.json` (each SEC-* pattern names its regression strategy here).

| Guard | When to use | Canonical example | Shape |
|---|---|---|---|
| **Static source guard** | prevent a fixed unsafe pattern from silently reappearing | `apps/backend/test/static-injection-guards.test.ts` (4 blocks: XSS sink, no-raw-fetch, no-predictable-tmpfile, no-ReDoS-strip) | scan `src`, strip comments first, regex for the unsafe pattern, assert zero matches; **self-test the guard** against a positive + negative sample |
| **Injected-randomness contract** | randomness fixes (SEC-RANDOM-001) | `apps/backend/test/gems.test.ts`, `apps/backend/test/display-name.test.ts` | inject `randomIndex`/`crypto`; assert one uniform draw per char, byte-range, deterministic full-range distribution, output format |
| **SSRF policy boundary** | SSRF fixes (SEC-SSRF-001) | `apps/backend/test/subscription-fetch-ssrf.test.ts` | assert `assertAllowedOutboundUrl` throws on metadata IPv4/IPv6/GCP + non-http(s); a legit https URL still passes; static no-raw-fetch guard |
| **Secure temp-file** | temp-file fixes (SEC-TEMPFILE-001) | `apps/backend/test/secure-temp-file.test.ts` | path under `os.tmpdir()`, dir newly created (0700 on posix), two calls never collide, cleanup removes dir; static no-predictable-tmpfile guard |
| **ReDoS pathological** | ReDoS fixes (SEC-REDOS-001) | `apps/backend/test/billing-normalizers.test.ts` (normalizeProvider block) | run the pathological input `'a'+'_'.repeat(50000)+'b'` — completion + correct result is the guarantee (old O(n²) impl took ~seconds); + static guard |
| **Command-injection boundary** | command-injection fixes (SEC-CMD-001) | `apps/backend/test/command-safety.test.ts` | adversarial payloads (`'; rm -rf / #`, `$(id)`, `a'b`) asserted neutralized; prefer argument-array invocation over shell strings |

## Revert-proof rule
Before committing a security fix, prove the new guard **fails against the old implementation**
(run the old code in a scratchpad, never restore it in-tree). Established precedent: the SSRF,
temp-file, randomness, and ReDoS commits this session all did this.

## Authoring rules
- Strip block **and** line comments before a static regex scan, so the fix's own explanatory prose
  cannot mask (or fake) a regression.
- A static guard must include a self-test asserting it matches a positive sample and ignores the safe replacement.
- Prefer a structural/contract assertion over any wall-clock measurement.
