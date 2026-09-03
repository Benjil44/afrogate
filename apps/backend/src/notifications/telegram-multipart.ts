/**
 * Pure multipart/form-data builder for the Telegram Bot API `sendPhoto` upload.
 * Kept as a standalone (no NestJS decorators / parameter properties) so its
 * wire-format contract can be pinned by `node --test` in
 * apps/backend/test/telegram-multipart.test.ts.
 */

export interface PhotoMultipart {
  /** Value for the request's Content-Type header (includes the boundary). */
  contentType: string;
  /** The full multipart body as a Buffer (text fields + raw photo bytes). */
  body: Buffer;
  /** The generated boundary token (exposed for tests / debugging). */
  boundary: string;
}

/** Strip characters that would break a multipart header line. */
function sanitizeHeaderValue(value: string): string {
  return value.replace(/["\r\n]/g, '');
}

/**
 * Build a `multipart/form-data` body carrying the given text fields plus one
 * binary `photo` part. The photo bytes are embedded verbatim (no utf8 round-trip
 * that would corrupt a PNG). `boundary` is injectable so tests are deterministic;
 * production callers omit it to get a fresh random boundary per request.
 */
export function buildPhotoMultipart(
  fields: Record<string, string>,
  photo: Buffer,
  filename: string,
  boundary: string = `afrows${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`,
): PhotoMultipart {
  const safeName = sanitizeHeaderValue(filename) || 'config.png';
  const parts: Buffer[] = [];

  for (const [name, value] of Object.entries(fields)) {
    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${sanitizeHeaderValue(name)}"\r\n\r\n${value}\r\n`,
        'utf8',
      ),
    );
  }

  parts.push(
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="${safeName}"\r\nContent-Type: image/png\r\n\r\n`,
      'utf8',
    ),
  );
  parts.push(photo);
  parts.push(Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8'));

  return {
    contentType: `multipart/form-data; boundary=${boundary}`,
    body: Buffer.concat(parts),
    boundary,
  };
}
