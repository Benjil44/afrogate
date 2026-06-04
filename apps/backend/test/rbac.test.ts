import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ADMIN_ROLE_ORDER,
  getEffectiveRolePermissions,
  roleHasPermission,
  roleInheritsAllPermissions,
} from '@afrows/shared';

describe('roleInheritsAllPermissions', () => {
  it('is true only for superadmin and owner', () => {
    assert.equal(roleInheritsAllPermissions('superadmin'), true);
    assert.equal(roleInheritsAllPermissions('owner'), true);
  });

  it('is false for every non-root managed role', () => {
    for (const role of ['admin', 'supervisor', 'support', 'auditor', 'reseller'] as const) {
      assert.equal(roleInheritsAllPermissions(role), false, `${role} must not inherit all permissions`);
    }
  });
});

describe('roleHasPermission - root roles', () => {
  it('grants superadmin and owner any permission via the wildcard', () => {
    for (const role of ['superadmin', 'owner'] as const) {
      assert.equal(roleHasPermission(role, 'adminUsers:write'), true);
      assert.equal(roleHasPermission(role, 'servers:write'), true);
      assert.equal(roleHasPermission(role, 'reports:read'), true);
    }
  });
});

describe('roleHasPermission - admin', () => {
  it('grants broad operational write access', () => {
    assert.equal(roleHasPermission('admin', 'servers:write'), true);
    assert.equal(roleHasPermission('admin', 'billing:write'), true);
    assert.equal(roleHasPermission('admin', 'adminUsers:read'), true);
  });

  it('does NOT let a plain admin manage admin users (write reserved for owner/superadmin)', () => {
    assert.equal(roleHasPermission('admin', 'adminUsers:write'), false);
  });
});

describe('roleHasPermission - read-oriented roles', () => {
  it('supervisor can read but not write billing/servers', () => {
    assert.equal(roleHasPermission('supervisor', 'billing:read'), true);
    assert.equal(roleHasPermission('supervisor', 'billing:write'), false);
    assert.equal(roleHasPermission('supervisor', 'servers:write'), false);
  });

  it('auditor can read audit/reports but cannot touch customers', () => {
    assert.equal(roleHasPermission('auditor', 'audit:read'), true);
    assert.equal(roleHasPermission('auditor', 'reports:read'), true);
    assert.equal(roleHasPermission('auditor', 'customers:write'), false);
    assert.equal(roleHasPermission('auditor', 'customers:read'), false);
  });

  it('support has limited reads and no audit access', () => {
    assert.equal(roleHasPermission('support', 'customers:read'), true);
    assert.equal(roleHasPermission('support', 'audit:read'), false);
    assert.equal(roleHasPermission('support', 'servers:write'), false);
  });
});

describe('roleHasPermission - reseller scoping', () => {
  it('grants only its own customer/wallet scope', () => {
    assert.equal(roleHasPermission('reseller', 'customers:read'), true);
    assert.equal(roleHasPermission('reseller', 'customers:write'), true);
    assert.equal(roleHasPermission('reseller', 'resellerWallet:read'), true);
    assert.equal(roleHasPermission('reseller', 'billing:read'), true);
  });

  it('denies a reseller any infrastructure, admin, or audit permission', () => {
    assert.equal(roleHasPermission('reseller', 'servers:read'), false);
    assert.equal(roleHasPermission('reseller', 'servers:write'), false);
    assert.equal(roleHasPermission('reseller', 'adminUsers:read'), false);
    assert.equal(roleHasPermission('reseller', 'audit:read'), false);
    assert.equal(roleHasPermission('reseller', 'resellers:read'), false);
    assert.equal(roleHasPermission('reseller', 'resellerWallet:write'), false);
  });
});

describe('getEffectiveRolePermissions', () => {
  it('expands wildcard roles to the full permission catalog', () => {
    const ownerPerms = getEffectiveRolePermissions('owner');
    const adminPerms = getEffectiveRolePermissions('admin');
    assert.ok(ownerPerms.length > adminPerms.length, 'owner (all) should have more permissions than admin');
    assert.ok(ownerPerms.includes('adminUsers:write'));
  });

  it('returns the literal grant list for non-wildcard roles, without the wildcard sentinel', () => {
    const resellerPerms = getEffectiveRolePermissions('reseller');
    assert.ok(!resellerPerms.includes('*' as never), 'must not leak the "*" sentinel');
    assert.deepEqual(
      [...resellerPerms].sort(),
      ['billing:read', 'customers:read', 'customers:write', 'dashboard:read', 'resellerWallet:read'].sort(),
    );
  });

  it('every managed admin role resolves to at least one permission', () => {
    for (const role of ADMIN_ROLE_ORDER) {
      assert.ok(getEffectiveRolePermissions(role).length > 0, `${role} should have permissions`);
    }
  });
});
