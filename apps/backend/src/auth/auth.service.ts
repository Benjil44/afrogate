import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type {
  AdminLoginResponse,
  AdminPermissionsResponse,
  AdminSessionResponse,
  AdminUserStatus,
  AdminUserSummary,
  AdminUsersResponse,
  CreateAdminUserRequest,
  Role,
  UpdateAdminUserPasswordRequest,
  UpdateAdminUserRequest,
} from '@afrogate/shared';
import {
  ADMIN_PERMISSION_DEFINITIONS,
  ADMIN_ROLE_ORDER,
  getEffectiveRolePermissions,
  roleHasPermission,
  roleInheritsAllPermissions,
} from '@afrogate/shared';
import { createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { AuditService } from '../audit/audit.service';
import { DatabaseService } from '../database/database.service';
import type { AuthActor } from '../security/auth-request';
import { secureTokenEquals } from '../security/bearer-token';

const DEFAULT_ADMIN_TOKEN = 'change-me-admin-token';
const DEFAULT_SESSION_SECRET = 'change-me-long-random-secret';
const DEFAULT_SUPERADMIN_PASSWORD = 'change-me-superadmin-password';
const SESSION_VERSION = 1;
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;

const SUPPORTED_ADMIN_ROLES = new Set<Role>(['superadmin', 'owner', 'admin', 'supervisor', 'support', 'auditor']);
const NON_SUPERADMIN_ROLES = new Set<Role>(['owner', 'admin', 'supervisor', 'support', 'auditor']);
const ADMIN_USERS_STORE_DATABASE_VALUES = new Set(['database', 'postgres', 'postgresql']);
const ADMIN_USERS_STORE_FILE_VALUES = new Set(['file', 'local', 'json']);

interface AdminAccountConfig {
  id: string;
  username: string;
  password?: string;
  passwordHash?: string;
  role: Role;
  isSuperAdmin: boolean;
  status: AdminUserStatus;
  source: 'bootstrap' | 'env' | 'local' | 'database';
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string | null;
}

interface StoredAdminUser {
  id: string;
  username: string;
  passwordHash: string;
  role: Role;
  status: AdminUserStatus;
  source?: 'local' | 'database';
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string | null;
}

interface StoredAdminUsersFile {
  users?: StoredAdminUser[];
}

interface AdminUserRow {
  id: string;
  username: string;
  passwordHash: string;
  role: string;
  status: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  lastLoginAt: Date | string | null;
}

interface AdminSessionPayload {
  v: number;
  sub: string;
  username: string;
  role: Role;
  type: 'admin';
  isSuperAdmin?: boolean;
  iat: number;
  exp: number;
}

@Injectable()
export class AuthService {
  private managedUsersCache: StoredAdminUser[] | null = null;
  private attemptedLegacyFileImport = false;

  constructor(
    private readonly audit: AuditService,
    private readonly database: DatabaseService,
  ) {}

  async login(usernameInput: string, passwordInput: string): Promise<AdminLoginResponse> {
    const username = usernameInput.trim();
    const accounts = await this.loadAdminAccounts();
    const account = accounts.find((candidate) => usernamesMatch(username, candidate.username));

    if (!account || account.status !== 'active' || !this.verifyPassword(passwordInput, account)) {
      await this.audit.recordBestEffort(undefined, 'admin.login.failed', 'admin_session', null, {
        username,
      });
      throw new UnauthorizedException('Invalid admin credentials');
    }

    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + this.getSessionTtlSeconds() * 1000);
    const actor = accountToActor(account);
    const sessionToken = this.signSessionToken(actor, issuedAt, expiresAt);

    await this.audit.recordBestEffort(actor, 'admin.login.succeeded', 'admin_session', actor.id, {
      role: actor.role,
      username: actor.username,
      isSuperAdmin: actor.isSuperAdmin === true,
    });

    await this.recordManagedUserLogin(actor.id, issuedAt.toISOString());

    return {
      ...this.createSessionResponse(actor, issuedAt, expiresAt),
      sessionToken,
    };
  }

  authenticateBearerToken(token: string | undefined): AuthActor {
    if (!token) {
      throw new UnauthorizedException('Admin session token is required');
    }

    const sessionActor = this.verifySignedSessionToken(token);
    if (sessionActor) return sessionActor;

    const legacyActor = this.verifyLegacyAdminToken(token);
    if (legacyActor) return legacyActor;

    if (!this.hasConfiguredAuth()) {
      throw new ServiceUnavailableException('Admin auth is not configured');
    }

    throw new UnauthorizedException('Invalid admin session token');
  }

  createSessionResponse(
    actor: AuthActor,
    issuedAt = new Date(),
    expiresAt = new Date(Date.now() + this.getSessionTtlSeconds() * 1000),
  ): AdminSessionResponse {
    return {
      actor: {
        id: actor.id,
        username: actor.username,
        role: actor.role,
        type: 'admin',
        isSuperAdmin: actor.isSuperAdmin,
      },
      mfaReady: true,
      mfaRequired: false,
      issuedAt: issuedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };
  }

  async listAdminUsers(actor: AuthActor | undefined): Promise<AdminUsersResponse> {
    this.assertAdminActor(actor);

    return {
      users: (await this.loadAdminAccounts()).map((account) => this.toAdminUserSummary(account, actor)),
    };
  }

  getAdminPermissions(actor: AuthActor | undefined): AdminPermissionsResponse {
    this.assertAdminActor(actor);

    return {
      permissions: ADMIN_PERMISSION_DEFINITIONS.map((permission) => ({ ...permission })),
      roles: ADMIN_ROLE_ORDER.map((role) => ({
        role,
        permissions: getEffectiveRolePermissions(role),
        inheritsAll: roleInheritsAllPermissions(role),
        isSystemOwner: role === 'superadmin' || role === 'owner',
        canManageAdminUsers: roleHasPermission(role, 'adminUsers:write'),
      })),
      currentRole: actor.role,
      currentPermissions: getEffectiveRolePermissions(actor.role),
      currentHasFullAccess: roleInheritsAllPermissions(actor.role),
      deniedByDefault: true,
    };
  }

  async createAdminUser(actor: AuthActor | undefined, payload: CreateAdminUserRequest): Promise<AdminUserSummary> {
    this.assertAdminUserManagerActor(actor);
    const username = normalizeUsername(payload.username);
    const role = this.resolveManagedUserRole(payload.role);
    const status = payload.status === 'disabled' ? 'disabled' : 'active';

    if (!username) throw new BadRequestException('Username is required');
    if (payload.password.trim().length < 8) throw new BadRequestException('Password must be at least 8 characters');

    const accounts = await this.loadAdminAccounts();
    if (accounts.some((account) => usernamesMatch(username, account.username))) {
      throw new BadRequestException('Admin username already exists');
    }

    const now = new Date().toISOString();
    const user: StoredAdminUser = {
      id: `admin:${randomUUID()}`,
      username,
      passwordHash: hashPassword(payload.password),
      role,
      status,
      source: this.getManagedUsersStore() === 'database' ? 'database' : 'local',
      createdAt: now,
      updatedAt: now,
      lastLoginAt: null,
    };

    await this.createManagedUser(user, actor);
    await this.audit.recordBestEffort(actor, 'admin.user.created', 'admin_user', user.id, {
      username: user.username,
      role: user.role,
      status: user.status,
      source: user.source,
    });

    return this.toAdminUserSummary(storedUserToAccount(user), actor);
  }

  async updateAdminUser(
    actor: AuthActor | undefined,
    id: string,
    payload: UpdateAdminUserRequest,
  ): Promise<AdminUserSummary> {
    this.assertAdminUserManagerActor(actor);
    const existingUser = await this.getManagedUserById(id);
    if (!existingUser) throw this.createUnmanagedUserException(id);

    const updatedUser = { ...existingUser };

    if (payload.role !== undefined) {
      updatedUser.role = this.resolveManagedUserRole(payload.role);
    }

    if (payload.status !== undefined) {
      updatedUser.status = this.resolveUserStatus(payload.status);
    }

    updatedUser.updatedAt = new Date().toISOString();
    await this.updateManagedUser(updatedUser, actor);
    await this.audit.recordBestEffort(actor, 'admin.user.updated', 'admin_user', id, {
      username: updatedUser.username,
      role: updatedUser.role,
      status: updatedUser.status,
      source: updatedUser.source,
    });

    return this.toAdminUserSummary(storedUserToAccount(updatedUser), actor);
  }

  async updateAdminUserPassword(
    actor: AuthActor | undefined,
    id: string,
    payload: UpdateAdminUserPasswordRequest,
  ): Promise<AdminUserSummary> {
    this.assertAdminUserManagerActor(actor);

    if (payload.password.trim().length < 8) throw new BadRequestException('Password must be at least 8 characters');

    const existingUser = await this.getManagedUserById(id);
    if (!existingUser) throw this.createUnmanagedUserException(id);

    const updatedUser = {
      ...existingUser,
      passwordHash: hashPassword(payload.password),
      updatedAt: new Date().toISOString(),
    };
    await this.updateManagedUserPassword(updatedUser, actor);
    await this.audit.recordBestEffort(actor, 'admin.user.password_changed', 'admin_user', id, {
      username: updatedUser.username,
      source: updatedUser.source,
    });

    return this.toAdminUserSummary(storedUserToAccount(updatedUser), actor);
  }

  async deleteAdminUser(actor: AuthActor | undefined, id: string): Promise<void> {
    this.assertAdminUserManagerActor(actor);
    const user = await this.getManagedUserById(id);

    if (!user) throw this.createUnmanagedUserException(id);

    await this.deleteManagedUser(id);
    await this.audit.recordBestEffort(actor, 'admin.user.deleted', 'admin_user', id, {
      username: user.username,
      role: user.role,
      source: user.source,
    });
  }

  private async loadAdminAccounts(): Promise<AdminAccountConfig[]> {
    const superAdminUsername = normalizeUsername(process.env.AFROGATE_SUPERADMIN_USERNAME) ?? 'superadmin';
    const superAdminPassword = normalizeSecret(process.env.AFROGATE_SUPERADMIN_PASSWORD);
    const superAdminPasswordHash = normalizeSecret(process.env.AFROGATE_SUPERADMIN_PASSWORD_HASH);
    const now = new Date().toISOString();

    if ((!superAdminPassword && !superAdminPasswordHash) || superAdminPassword === DEFAULT_SUPERADMIN_PASSWORD) {
      throw new ServiceUnavailableException('Superadmin credentials are not configured');
    }

    const accounts: AdminAccountConfig[] = [
      {
        id: 'superadmin',
        username: superAdminUsername,
        password: superAdminPassword,
        passwordHash: superAdminPasswordHash,
        role: 'superadmin',
        isSuperAdmin: true,
        status: 'active',
        source: 'bootstrap',
        createdAt: now,
        updatedAt: now,
      },
    ];

    const adminUsername = normalizeUsername(process.env.AFROGATE_ADMIN_USERNAME);
    const adminPassword = normalizeSecret(process.env.AFROGATE_ADMIN_PASSWORD);
    const adminPasswordHash = normalizeSecret(process.env.AFROGATE_ADMIN_PASSWORD_HASH);

    if (adminUsername && (adminPassword || adminPasswordHash)) {
      accounts.push({
        id: `env:${adminUsername}`,
        username: adminUsername,
        password: adminPassword,
        passwordHash: adminPasswordHash,
        role: this.resolveNonSuperAdminRole(process.env.AFROGATE_ADMIN_ROLE),
        isSuperAdmin: false,
        status: 'active',
        source: 'env',
        createdAt: now,
        updatedAt: now,
      });
    }

    for (const user of await this.loadManagedUsers()) {
      if (!accounts.some((account) => usernamesMatch(user.username, account.username))) {
        accounts.push(storedUserToAccount(user));
      }
    }

    return accounts;
  }

  private verifyPassword(passwordInput: string, account: AdminAccountConfig): boolean {
    if (account.passwordHash) {
      return verifyScryptPassword(passwordInput, account.passwordHash);
    }

    if (account.password) {
      return secureTokenEquals(passwordInput, account.password);
    }

    return false;
  }

  private signSessionToken(actor: AuthActor, issuedAt: Date, expiresAt: Date): string {
    const secret = this.getSessionSecret();
    const payload: AdminSessionPayload = {
      v: SESSION_VERSION,
      sub: actor.id,
      username: actor.username ?? actor.id,
      role: actor.role,
      type: 'admin',
      isSuperAdmin: actor.isSuperAdmin,
      iat: Math.floor(issuedAt.getTime() / 1000),
      exp: Math.floor(expiresAt.getTime() / 1000),
    };
    const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    const signature = signPayload(encodedPayload, secret);

    return `${encodedPayload}.${signature}`;
  }

  private verifySignedSessionToken(token: string): AuthActor | null {
    const [encodedPayload, signature, extra] = token.split('.');
    if (!encodedPayload || !signature || extra !== undefined) return null;

    const secret = this.getSessionSecret();
    const expectedSignature = signPayload(encodedPayload, secret);

    if (!constantTimeStringEquals(signature, expectedSignature)) return null;

    const payload = parseSessionPayload(encodedPayload);
    if (!payload || payload.v !== SESSION_VERSION || payload.type !== 'admin') return null;
    if (!SUPPORTED_ADMIN_ROLES.has(payload.role)) return null;
    if (payload.exp <= Math.floor(Date.now() / 1000)) return null;

    return {
      id: payload.sub,
      username: payload.username,
      role: payload.role,
      type: 'admin',
      isSuperAdmin: payload.isSuperAdmin === true,
      sessionIssuedAt: new Date(payload.iat * 1000).toISOString(),
      sessionExpiresAt: new Date(payload.exp * 1000).toISOString(),
    };
  }

  private verifyLegacyAdminToken(token: string): AuthActor | null {
    const expectedToken = normalizeSecret(process.env.AFROGATE_ADMIN_TOKEN);

    if (!expectedToken || expectedToken === DEFAULT_ADMIN_TOKEN || !secureTokenEquals(token, expectedToken)) {
      return null;
    }

    const role = this.resolveAdminRole(process.env.AFROGATE_ADMIN_ROLE);

    return {
      id: process.env.AFROGATE_ADMIN_ID ?? 'bootstrap-admin',
      username: process.env.AFROGATE_ADMIN_USERNAME ?? 'bootstrap-admin',
      role,
      type: 'admin',
      isSuperAdmin: role === 'superadmin',
    };
  }

  private hasConfiguredAuth(): boolean {
    const hasSessionSecret = Boolean(this.resolveSessionSecretOrNull());
    const hasSuperAdminPassword = Boolean(normalizeSecret(process.env.AFROGATE_SUPERADMIN_PASSWORD))
      || Boolean(normalizeSecret(process.env.AFROGATE_SUPERADMIN_PASSWORD_HASH));
    const legacyToken = normalizeSecret(process.env.AFROGATE_ADMIN_TOKEN);

    return (hasSessionSecret && hasSuperAdminPassword) || Boolean(legacyToken && legacyToken !== DEFAULT_ADMIN_TOKEN);
  }

  private getSessionSecret(): string {
    const secret = this.resolveSessionSecretOrNull();
    if (!secret) {
      throw new ServiceUnavailableException('Admin session secret is not configured');
    }

    return secret;
  }

  private resolveSessionSecretOrNull(): string | null {
    const secret = normalizeSecret(process.env.ADMIN_SESSION_SECRET);
    if (!secret || secret === DEFAULT_SESSION_SECRET) return null;

    return secret;
  }

  private getSessionTtlSeconds(): number {
    const configuredTtl = Number(process.env.ADMIN_SESSION_TTL_SECONDS ?? 8 * 60 * 60);

    return Number.isFinite(configuredTtl) && configuredTtl > 0 ? configuredTtl : 8 * 60 * 60;
  }

  private resolveAdminRole(role: string | undefined): Role {
    return role && SUPPORTED_ADMIN_ROLES.has(role as Role) ? role as Role : 'admin';
  }

  private resolveNonSuperAdminRole(role: string | undefined): Role {
    return role && NON_SUPERADMIN_ROLES.has(role as Role) ? role as Role : 'admin';
  }

  private resolveManagedUserRole(role: Role | undefined): Role {
    if (!role || !NON_SUPERADMIN_ROLES.has(role)) {
      throw new BadRequestException('Managed users must use owner, admin, supervisor, support, or auditor role');
    }

    return role;
  }

  private resolveUserStatus(status: AdminUserStatus): AdminUserStatus {
    if (status !== 'active' && status !== 'disabled') {
      throw new BadRequestException('Unsupported admin user status');
    }

    return status;
  }

  private assertAdminActor(actor: AuthActor | undefined): asserts actor is AuthActor {
    if (!actor || actor.type !== 'admin') {
      throw new ForbiddenException('Admin access is required');
    }
  }

  private assertAdminUserManagerActor(actor: AuthActor | undefined): asserts actor is AuthActor {
    this.assertAdminActor(actor);

    if (!this.canManageAdminUsers(actor)) {
      throw new ForbiddenException('Admin-user management permission is required');
    }
  }

  private toAdminUserSummary(account: AdminAccountConfig, actor: AuthActor | undefined): AdminUserSummary {
    const isManagedAdminUser = account.source === 'local' || account.source === 'database';
    const canManage = this.canManageAdminUsers(actor) && isManagedAdminUser && !account.isSuperAdmin;

    return {
      id: account.id,
      username: account.username,
      role: account.role,
      status: account.status,
      source: account.source,
      isSuperAdmin: account.isSuperAdmin,
      canDelete: canManage,
      canDisable: canManage,
      canChangePassword: canManage,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
      lastLoginAt: account.lastLoginAt ?? null,
    };
  }

  private canManageAdminUsers(actor: AuthActor | undefined): boolean {
    return (actor?.role === 'superadmin' && actor.isSuperAdmin === true) || actor?.role === 'owner';
  }

  private async loadManagedUsers(): Promise<StoredAdminUser[]> {
    if (this.getManagedUsersStore() === 'database') {
      return this.loadDatabaseManagedUsers();
    }

    return this.loadFileManagedUsers();
  }

  private async createManagedUser(user: StoredAdminUser, actor: AuthActor): Promise<void> {
    if (this.getManagedUsersStore() === 'database') {
      await this.insertDatabaseManagedUser(user, actor);
      return;
    }

    const storedUsers = await this.loadFileManagedUsers();
    storedUsers.push({ ...user, source: 'local' });
    await this.saveFileManagedUsers(storedUsers);
  }

  private async getManagedUserById(id: string): Promise<StoredAdminUser | null> {
    const users = await this.loadManagedUsers();

    return users.find((user) => user.id === id) ?? null;
  }

  private async updateManagedUser(user: StoredAdminUser, actor: AuthActor): Promise<void> {
    if (this.getManagedUsersStore() === 'database') {
      await this.updateDatabaseManagedUser(user, actor);
      return;
    }

    const storedUsers = await this.loadFileManagedUsers();
    const userIndex = storedUsers.findIndex((candidate) => candidate.id === user.id);
    if (userIndex < 0) throw this.createUnmanagedUserException(user.id);
    storedUsers[userIndex] = { ...user, source: 'local' };
    await this.saveFileManagedUsers(storedUsers);
  }

  private async updateManagedUserPassword(user: StoredAdminUser, actor: AuthActor): Promise<void> {
    if (this.getManagedUsersStore() === 'database') {
      await this.updateDatabaseManagedUserPassword(user, actor);
      return;
    }

    await this.updateManagedUser(user, actor);
  }

  private async deleteManagedUser(id: string): Promise<void> {
    if (this.getManagedUsersStore() === 'database') {
      await this.database.query('DELETE FROM admin_users WHERE id = $1', [id]);
      return;
    }

    const storedUsers = await this.loadFileManagedUsers();
    await this.saveFileManagedUsers(storedUsers.filter((candidate) => candidate.id !== id));
  }

  private async recordManagedUserLogin(id: string, lastLoginAt: string): Promise<void> {
    if (this.getManagedUsersStore() === 'database') {
      await this.database.query(
        `
          UPDATE admin_users
          SET last_login_at = $2
          WHERE id = $1
        `,
        [id, lastLoginAt],
      );
      return;
    }

    const storedUsers = await this.loadFileManagedUsers();
    const userIndex = storedUsers.findIndex((user) => user.id === id);

    if (userIndex < 0) return;

    storedUsers[userIndex] = {
      ...storedUsers[userIndex],
      lastLoginAt,
      updatedAt: storedUsers[userIndex].updatedAt,
    };
    await this.saveFileManagedUsers(storedUsers);
  }

  private async loadDatabaseManagedUsers(): Promise<StoredAdminUser[]> {
    let rows = await this.queryDatabaseManagedUserRows();
    if (rows.length === 0 && !this.attemptedLegacyFileImport && process.env.AFROGATE_ADMIN_USERS_IMPORT_FILE !== 'false') {
      this.attemptedLegacyFileImport = true;
      const importedCount = await this.importLegacyFileUsersToDatabase();
      if (importedCount > 0) {
        await this.audit.recordBestEffort(undefined, 'admin.users.legacy_file_imported', 'admin_user_store', 'database', {
          importedCount,
        });
        rows = await this.queryDatabaseManagedUserRows();
      }
    }

    return rows.map(databaseRowToStoredUser).filter((user) => NON_SUPERADMIN_ROLES.has(user.role));
  }

  private async queryDatabaseManagedUserRows(): Promise<AdminUserRow[]> {
    try {
      const result = await this.database.query<AdminUserRow>(
        `
          SELECT
            id,
            username,
            password_hash AS "passwordHash",
            role,
            status,
            created_at AS "createdAt",
            updated_at AS "updatedAt",
            last_login_at AS "lastLoginAt"
          FROM admin_users
          ORDER BY created_at DESC, username ASC
        `,
      );

      return result.rows;
    } catch (error) {
      if (isPostgresUndefinedTableError(error)) {
        throw new ServiceUnavailableException('Admin users database table is not migrated');
      }

      throw error;
    }
  }

  private async insertDatabaseManagedUser(user: StoredAdminUser, actor: AuthActor): Promise<void> {
    try {
      await this.database.query(
        `
          INSERT INTO admin_users (
            id, username, username_normalized, password_hash, role, status,
            source, created_by, updated_by, created_at, updated_at, last_login_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, 'database', $7, $7, $8, $8, $9)
        `,
        [
          user.id,
          user.username,
          normalizeUsernameForUniqueIndex(user.username),
          user.passwordHash,
          user.role,
          user.status,
          actor.id,
          user.createdAt,
          user.lastLoginAt ?? null,
        ],
      );
    } catch (error) {
      if (isPostgresUniqueViolation(error)) throw new BadRequestException('Admin username already exists');
      if (isPostgresUndefinedTableError(error)) throw new ServiceUnavailableException('Admin users database table is not migrated');
      throw error;
    }
  }

  private async updateDatabaseManagedUser(user: StoredAdminUser, actor: AuthActor): Promise<void> {
    const result = await this.database.query(
      `
        UPDATE admin_users
        SET role = $2,
            status = $3,
            updated_by = $4,
            updated_at = $5
        WHERE id = $1
      `,
      [user.id, user.role, user.status, actor.id, user.updatedAt],
    );

    if (result.rowCount === 0) throw this.createUnmanagedUserException(user.id);
  }

  private async updateDatabaseManagedUserPassword(user: StoredAdminUser, actor: AuthActor): Promise<void> {
    const result = await this.database.query(
      `
        UPDATE admin_users
        SET password_hash = $2,
            updated_by = $3,
            updated_at = $4
        WHERE id = $1
      `,
      [user.id, user.passwordHash, actor.id, user.updatedAt],
    );

    if (result.rowCount === 0) throw this.createUnmanagedUserException(user.id);
  }

  private async importLegacyFileUsersToDatabase(): Promise<number> {
    const fileUsers = await this.loadFileManagedUsers();
    let importedCount = 0;

    for (const user of fileUsers) {
      if (!NON_SUPERADMIN_ROLES.has(user.role)) continue;

      try {
        const now = new Date().toISOString();
        const result = await this.database.query(
          `
            INSERT INTO admin_users (
              id, username, username_normalized, password_hash, role, status,
              source, created_by, updated_by, created_at, updated_at, last_login_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, 'database', 'legacy-file-import', 'legacy-file-import', $7, $8, $9)
            ON CONFLICT (username_normalized) DO NOTHING
          `,
          [
            user.id,
            user.username,
            normalizeUsernameForUniqueIndex(user.username),
            user.passwordHash,
            user.role,
            user.status,
            user.createdAt || now,
            user.updatedAt || now,
            user.lastLoginAt ?? null,
          ],
        );
        importedCount += result.rowCount ?? 0;
      } catch (error) {
        if (isPostgresUndefinedTableError(error)) {
          throw new ServiceUnavailableException('Admin users database table is not migrated');
        }

        throw error;
      }
    }

    return importedCount;
  }

  private async loadFileManagedUsers(): Promise<StoredAdminUser[]> {
    if (this.managedUsersCache) return [...this.managedUsersCache];

    const filePath = this.getManagedUsersFilePath();

    try {
      const parsed = JSON.parse(await readFile(filePath, 'utf8')) as StoredAdminUsersFile;
      this.managedUsersCache = (parsed.users ?? [])
        .filter(isStoredAdminUser)
        .filter((user) => NON_SUPERADMIN_ROLES.has(user.role))
        .map((user) => ({ ...user, source: 'local' }));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw new ServiceUnavailableException('Admin users file could not be read');
      }

      this.managedUsersCache = [];
    }

    return [...this.managedUsersCache];
  }

  private async saveFileManagedUsers(users: StoredAdminUser[]): Promise<void> {
    const filePath = this.getManagedUsersFilePath();
    const safeUsers = users
      .filter((user) => NON_SUPERADMIN_ROLES.has(user.role))
      .map((user) => ({
        id: user.id,
        username: user.username.trim(),
        passwordHash: user.passwordHash,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastLoginAt: user.lastLoginAt ?? null,
      }));

    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(
      filePath,
      `${JSON.stringify({ users: safeUsers } satisfies StoredAdminUsersFile, null, 2)}\n`,
      'utf8',
    );
    this.managedUsersCache = safeUsers.map((user) => ({ ...user, source: 'local' }));
  }

  private getManagedUsersFilePath(): string {
    return resolve(process.env.AFROGATE_ADMIN_USERS_FILE ?? 'tmp/admin-users.json');
  }

  private getManagedUsersStore(): 'database' | 'file' {
    const configuredStore = process.env.AFROGATE_ADMIN_USERS_STORE?.trim().toLowerCase();
    if (configuredStore && ADMIN_USERS_STORE_DATABASE_VALUES.has(configuredStore)) return 'database';
    if (configuredStore && ADMIN_USERS_STORE_FILE_VALUES.has(configuredStore)) return 'file';

    return process.env.DATABASE_URL ? 'database' : 'file';
  }

  private createUnmanagedUserException(id: string): Error {
    if (id === 'superadmin' || id.startsWith('env:')) {
      return new ForbiddenException('This admin user is protected by bootstrap or environment configuration');
    }

    return new NotFoundException('Admin user was not found');
  }

}

function accountToActor(account: AdminAccountConfig): AuthActor {
  return {
    id: account.id,
    username: account.username,
    role: account.role,
    type: 'admin',
    isSuperAdmin: account.isSuperAdmin,
  };
}

function storedUserToAccount(user: StoredAdminUser): AdminAccountConfig {
  return {
    id: user.id,
    username: user.username,
    passwordHash: user.passwordHash,
    role: user.role,
    isSuperAdmin: false,
    status: user.status,
    source: user.source ?? 'local',
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastLoginAt: user.lastLoginAt ?? null,
  };
}

function databaseRowToStoredUser(row: AdminUserRow): StoredAdminUser {
  return {
    id: row.id,
    username: row.username,
    passwordHash: row.passwordHash,
    role: NON_SUPERADMIN_ROLES.has(row.role as Role) ? row.role as Role : 'support',
    status: row.status === 'active' || row.status === 'disabled' ? row.status : 'disabled',
    source: 'database',
    createdAt: serializeDatabaseTimestamp(row.createdAt),
    updatedAt: serializeDatabaseTimestamp(row.updatedAt),
    lastLoginAt: row.lastLoginAt ? serializeDatabaseTimestamp(row.lastLoginAt) : null,
  };
}

function normalizeUsername(value: string | undefined): string | null {
  const normalized = value?.trim();

  return normalized ? normalized : null;
}

function normalizeSecret(value: string | undefined): string | undefined {
  const normalized = value?.trim();

  return normalized ? normalized : undefined;
}

function usernamesMatch(actual: string, expected: string): boolean {
  return secureTokenEquals(actual.toLowerCase(), expected.toLowerCase());
}

function normalizeUsernameForUniqueIndex(username: string): string {
  return username.trim().toLowerCase();
}

function serializeDatabaseTimestamp(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString();
}

function signPayload(encodedPayload: string, secret: string): string {
  return createHmac('sha256', secret).update(encodedPayload).digest('base64url');
}

function hashPassword(passwordInput: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(passwordInput, salt, 32, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: 64 * 1024 * 1024,
  });

  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

function constantTimeStringEquals(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);

  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

function parseSessionPayload(encodedPayload: string): AdminSessionPayload | null {
  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as Partial<AdminSessionPayload>;

    if (
      typeof payload.v !== 'number'
      || typeof payload.sub !== 'string'
      || typeof payload.username !== 'string'
      || typeof payload.role !== 'string'
      || payload.type !== 'admin'
      || typeof payload.iat !== 'number'
      || typeof payload.exp !== 'number'
    ) {
      return null;
    }

    return payload as AdminSessionPayload;
  } catch {
    return null;
  }
}

function verifyScryptPassword(passwordInput: string, storedHash: string): boolean {
  const parts = storedHash.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

  const [, nValue, rValue, pValue, saltValue, hashValue] = parts;
  const N = Number(nValue);
  const r = Number(rValue);
  const p = Number(pValue);

  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return false;

  try {
    const salt = Buffer.from(saltValue, 'base64url');
    const expectedHash = Buffer.from(hashValue, 'base64url');
    const actualHash = scryptSync(passwordInput, salt, expectedHash.length, {
      N,
      r,
      p,
      maxmem: 64 * 1024 * 1024,
    });

    return expectedHash.length === actualHash.length && timingSafeEqual(actualHash, expectedHash);
  } catch {
    return false;
  }
}

function isStoredAdminUser(value: unknown): value is StoredAdminUser {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Partial<StoredAdminUser>;

  return typeof candidate.id === 'string'
    && typeof candidate.username === 'string'
    && typeof candidate.passwordHash === 'string'
    && typeof candidate.role === 'string'
    && NON_SUPERADMIN_ROLES.has(candidate.role as Role)
    && (candidate.status === 'active' || candidate.status === 'disabled')
    && typeof candidate.createdAt === 'string'
    && typeof candidate.updatedAt === 'string';
}

function isPostgresUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505';
}

function isPostgresUndefinedTableError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === '42P01';
}
