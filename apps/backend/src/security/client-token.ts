import { createHash } from 'node:crypto';
import { ForbiddenException } from '@nestjs/common';
import type { ClientAuthActor } from './auth-request';

export function hashClientToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** Normalizes a raw scopes value into a deduped list of non-empty strings. */
export function normalizeScopes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((scope): scope is string => typeof scope === 'string' && scope.length > 0))];
}

/** Throws ForbiddenException when the client token lacks the required scope. */
export function assertClientScope(actor: ClientAuthActor, scope: string): void {
  if (!actor.scopes.includes(scope)) {
    throw new ForbiddenException('Client token does not allow this action');
  }
}
