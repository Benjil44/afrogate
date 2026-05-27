import type { Role } from '@afrogate/shared';

export interface AuthActor {
  id: string;
  username?: string;
  role: Role;
  type: 'admin' | 'agent';
  isSuperAdmin?: boolean;
  sessionIssuedAt?: string;
  sessionExpiresAt?: string;
}

export interface RequestWithAuth {
  actor?: AuthActor;
  headers: {
    authorization?: string;
  };
}
