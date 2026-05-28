import type { Role } from '@afrogate/shared';

export interface AuditActor {
  id: string;
  username?: string;
  role?: Role;
  type: 'admin' | 'agent' | 'client';
}

export interface AuthActor extends AuditActor {
  role: Role;
  type: 'admin' | 'agent';
  isSuperAdmin?: boolean;
  sessionIssuedAt?: string;
  sessionExpiresAt?: string;
}

export interface ClientAuthActor extends AuditActor {
  type: 'client';
  clientConfigId: string;
  customerAccountId: string;
  tokenId: string;
  scopes: string[];
  clientStatus: string;
  accountStatus: string;
}

export interface RequestWithAuth {
  actor?: AuthActor;
  headers: {
    authorization?: string;
  };
}

export interface RequestWithClientAuth {
  clientActor?: ClientAuthActor;
  headers: {
    authorization?: string;
  };
}
