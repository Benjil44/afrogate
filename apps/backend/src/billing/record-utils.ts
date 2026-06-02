/** Narrows an unknown value to a plain object record (rejects null, arrays, primitives). */
export function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/** Reads a non-empty trimmed string property from a record, else null. */
export function stringFromRecord(record: Record<string, unknown> | null | undefined, key: string): string | null {
  const value = record?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
