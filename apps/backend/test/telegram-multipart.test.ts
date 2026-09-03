import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPhotoMultipart } from '../src/notifications/telegram-multipart.ts';

test('buildPhotoMultipart emits a well-formed body with text fields + raw photo bytes', () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01, 0x02, 0x03]);
  const { contentType, body, boundary } = buildPhotoMultipart(
    { chat_id: '123456', caption: 'Afrows config QR - Primary' },
    png,
    'afrows-vless-qr.png',
    'BOUNDARY123',
  );

  assert.equal(contentType, 'multipart/form-data; boundary=BOUNDARY123');
  assert.equal(boundary, 'BOUNDARY123');
  assert.ok(Buffer.isBuffer(body));

  const text = body.toString('latin1');
  assert.match(text, /--BOUNDARY123\r\nContent-Disposition: form-data; name="chat_id"\r\n\r\n123456\r\n/);
  assert.match(
    text,
    /--BOUNDARY123\r\nContent-Disposition: form-data; name="caption"\r\n\r\nAfrows config QR - Primary\r\n/,
  );
  assert.match(
    text,
    /--BOUNDARY123\r\nContent-Disposition: form-data; name="photo"; filename="afrows-vless-qr.png"\r\nContent-Type: image\/png\r\n\r\n/,
  );
  // Raw PNG bytes embedded verbatim (no utf8 corruption) and correct terminator.
  assert.ok(body.includes(png), 'raw photo bytes must survive uncorrupted');
  assert.ok(text.endsWith('\r\n--BOUNDARY123--\r\n'), 'body must end with the multipart terminator');
});

test('buildPhotoMultipart sanitizes a filename that could break the header', () => {
  const { body } = buildPhotoMultipart({ chat_id: '1' }, Buffer.from([0x01]), 'a"b\r\nc.png', 'B');
  const text = body.toString('latin1');
  assert.match(text, /filename="abc\.png"/);
});

test('buildPhotoMultipart falls back to config.png for an empty filename', () => {
  const { body } = buildPhotoMultipart({ chat_id: '1' }, Buffer.from([0x01]), '', 'B');
  assert.match(body.toString('latin1'), /filename="config\.png"/);
});

test('buildPhotoMultipart uses a fresh afrows-prefixed boundary when none is given', () => {
  const a = buildPhotoMultipart({ chat_id: '1' }, Buffer.from([0x01]), 'x.png');
  assert.match(a.boundary, /^afrows[0-9a-f]+$/);
});
