/**
 * Parses an on/off env/config value the way every Afrows service does:
 * unset/blank → `fallback`; otherwise true only for 1/true/yes/on
 * (case-insensitive, surrounding whitespace ignored). Anything else is false.
 */
export function parseConfigFlag(value: string | undefined | null, fallback: boolean): boolean {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(normalized);
}
