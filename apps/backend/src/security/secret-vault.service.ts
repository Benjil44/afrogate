import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

interface SecretEnvelope {
  keyId: string;
  payload: string;
}

@Injectable()
export class SecretVaultService {
  encryptJson(payload: Record<string, unknown>, context: string): SecretEnvelope {
    const key = this.getEncryptionKey();
    const keyId = this.getKeyId();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);

    cipher.setAAD(Buffer.from(context, 'utf8'));

    const ciphertext = Buffer.concat([
      cipher.update(JSON.stringify(payload), 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    return {
      keyId,
      payload: ['v1', keyId, toBase64Url(iv), toBase64Url(tag), toBase64Url(ciphertext)].join('.'),
    };
  }

  decryptJson(encryptedPayload: string, context: string): Record<string, unknown> {
    const [version, keyId, ivValue, tagValue, ciphertextValue] = encryptedPayload.split('.');

    if (version !== 'v1' || !keyId || !ivValue || !tagValue || !ciphertextValue) {
      throw new ServiceUnavailableException('Secret payload format is unsupported');
    }

    if (keyId !== this.getKeyId()) {
      throw new ServiceUnavailableException('Secret encryption key id does not match the active key');
    }

    const decipher = createDecipheriv('aes-256-gcm', this.getEncryptionKey(), fromBase64Url(ivValue));
    decipher.setAAD(Buffer.from(context, 'utf8'));
    decipher.setAuthTag(fromBase64Url(tagValue));

    const plaintext = Buffer.concat([
      decipher.update(fromBase64Url(ciphertextValue)),
      decipher.final(),
    ]).toString('utf8');

    const parsed = JSON.parse(plaintext) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as Record<string, unknown>;
  }

  fingerprint(secret: string): string {
    return createHash('sha256').update(secret, 'utf8').digest('hex').slice(0, 32);
  }

  private getEncryptionKey(): Buffer {
    const raw = process.env.AFROGATE_SECRETS_KEY?.trim();

    if (!raw) {
      throw new ServiceUnavailableException('AFROGATE_SECRETS_KEY is required before storing secrets');
    }

    const key = decodeKey(raw);
    if (key.length !== 32) {
      throw new ServiceUnavailableException('AFROGATE_SECRETS_KEY must decode to exactly 32 bytes');
    }

    return key;
  }

  private getKeyId(): string {
    const keyId = process.env.AFROGATE_SECRETS_KEY_ID?.trim() || 'local-v1';

    if (!/^[A-Za-z0-9_-]{1,64}$/.test(keyId)) {
      throw new ServiceUnavailableException('AFROGATE_SECRETS_KEY_ID must use only letters, numbers, underscore, and dash');
    }

    return keyId;
  }
}

function decodeKey(raw: string): Buffer {
  if (/^[0-9a-f]{64}$/i.test(raw)) return Buffer.from(raw, 'hex');

  const normalized = raw.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  return Buffer.from(padded, 'base64');
}

function toBase64Url(value: Buffer): string {
  return value.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value: string): Buffer {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  return Buffer.from(padded, 'base64');
}
