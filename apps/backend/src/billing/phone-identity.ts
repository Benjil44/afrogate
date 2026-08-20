/**
 * Phone-identity matching for bot registration linking.
 *
 * The afroWS bot captures a shared contact and stores its bare E.164 digits (no
 * '+') in customer_accounts.phone. A dashboard-created account, however, may hold
 * the same number in any of several shapes: national trunk form (`0912…`), the
 * country-code form (`98912…` / `+98912…`), or the bare national significant
 * number (`912…`). To decide whether a registering user already owns an account
 * we compare against a small, canonical set of digit variants (for the clear
 * `phone` column) and the matching clear forms (for `paid_number_hash`).
 *
 * Pure + dependency-free so it is unit-testable; the HMAC of the clear forms is
 * computed by the billing service, which owns the identity-hash key.
 */

/** Strip a phone string to its bare digits (E.164 without the leading '+'). */
export function phoneDigits(raw: string | null | undefined): string {
  return (raw ?? '').replace(/\D/g, '');
}

/**
 * National significant number (the 10-digit `9xxxxxxxxx` for an Iran mobile):
 * strips a leading `98` country code or a leading `0` trunk prefix. A number that
 * is neither passes through unchanged, so non-Iran digits still match themselves.
 */
export function iranNationalSignificant(digits: string): string {
  if (digits.startsWith('98') && digits.length >= 12) return digits.slice(2);
  if (digits.startsWith('0')) return digits.slice(1);
  return digits;
}

/**
 * Canonical digit variants of a phone, for matching the stored clear `phone`
 * column after it, too, has been reduced to digits (national `0912…`,
 * country-code `98912…`, bare `912…`, and the raw input). Short/garbage input
 * (< 4 digits) yields no variants (→ no lookup).
 */
export function phoneDigitVariants(raw: string | null | undefined): string[] {
  const digits = phoneDigits(raw);
  if (digits.length < 4) return [];
  const nsn = iranNationalSignificant(digits);
  const variants = new Set<string>([digits, nsn, `0${nsn}`, `98${nsn}`]);
  return [...variants].filter((value) => value.length >= 4);
}

/**
 * Clear-text forms whose `paid_number_hash` should be probed. These mirror the
 * shapes an operator might have typed into the paid-number field; each is hashed
 * with the same normalization (`normalizePaidNumber` keeps a leading '+') the
 * billing service used when it stored the hash.
 */
export function phoneClearVariants(raw: string | null | undefined): string[] {
  const digits = phoneDigits(raw);
  if (digits.length < 4) return [];
  const nsn = iranNationalSignificant(digits);
  const variants = new Set<string>([digits, nsn, `0${nsn}`, `98${nsn}`, `+98${nsn}`, `+${digits}`]);
  return [...variants];
}
