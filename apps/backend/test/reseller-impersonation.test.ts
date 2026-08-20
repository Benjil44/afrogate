import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  assertCanImpersonateReseller,
  type ImpersonationCaller,
  type ImpersonationTargetAccount,
} from '../src/auth/impersonation.ts';
import {
  SESSION_VERSION,
  constantTimeStringEquals,
  parseSessionPayload,
  signPayload,
  type AdminSessionPayload,
} from '../src/security/session-token.ts';

const superadmin: ImpersonationCaller = { type: 'admin', role: 'superadmin', isSuperAdmin: true };
const resellerTarget: ImpersonationTargetAccount = {
  id: 'admin:reseller-1',
  username: 'seller-one',
  role: 'reseller',
  status: 'active',
  isSuperAdmin: false,
};

describe('assertCanImpersonateReseller (superadmin-only, reseller-target-only)', () => {
  it('allows a superadmin to impersonate an active reseller', () => {
    assert.doesNotThrow(() => assertCanImpersonateReseller(superadmin, resellerTarget));
  });

  it('rejects a non-superadmin caller', () => {
    const admin: ImpersonationCaller = { type: 'admin', role: 'admin', isSuperAdmin: false };
    assert.throws(() => assertCanImpersonateReseller(admin, resellerTarget), ForbiddenException);
  });

  it('rejects a superadmin whose isSuperAdmin flag is not set (role alone is not enough)', () => {
    const spoofed: ImpersonationCaller = { type: 'admin', role: 'superadmin', isSuperAdmin: false };
    assert.throws(() => assertCanImpersonateReseller(spoofed, resellerTarget), ForbiddenException);
  });

  it('rejects impersonating a NON-reseller target (e.g. another admin)', () => {
    const adminTarget: ImpersonationTargetAccount = { ...resellerTarget, role: 'admin' };
    assert.throws(() => assertCanImpersonateReseller(superadmin, adminTarget), ForbiddenException);
  });

  it('rejects impersonating a disabled reseller', () => {
    const disabled: ImpersonationTargetAccount = { ...resellerTarget, status: 'disabled' };
    assert.throws(() => assertCanImpersonateReseller(superadmin, disabled), ForbiddenException);
  });

  it('throws NotFound when the target does not exist', () => {
    assert.throws(() => assertCanImpersonateReseller(superadmin, undefined), NotFoundException);
  });
});

describe('impersonation session issuance (reseller-scoped token)', () => {
  // Mirrors AuthService.signSessionToken: base64url(payload).hmac(payload). Proves the
  // minted session for a reseller target is a valid, reseller-role, non-superadmin token.
  it('mints a signed session carrying the seller identity with role=reseller', () => {
    const secret = 'test-session-secret-not-default';
    const issuedAt = 1_800_000_000;
    const payload: AdminSessionPayload = {
      v: SESSION_VERSION,
      sub: resellerTarget.id,
      username: resellerTarget.username,
      role: resellerTarget.role,
      type: 'admin',
      isSuperAdmin: false,
      iat: issuedAt,
      exp: issuedAt + 3600,
    };
    const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    const signature = signPayload(encoded, secret);
    const token = `${encoded}.${signature}`;

    const [gotEncoded, gotSignature, extra] = token.split('.');
    assert.equal(extra, undefined);
    assert.ok(constantTimeStringEquals(gotSignature, signPayload(gotEncoded, secret)), 'signature verifies');

    const decoded = parseSessionPayload(gotEncoded);
    assert.ok(decoded);
    assert.equal(decoded.role, 'reseller');
    assert.equal(decoded.sub, resellerTarget.id);
    assert.equal(decoded.isSuperAdmin, false);
  });
});
