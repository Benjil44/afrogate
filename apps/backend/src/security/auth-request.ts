import type { Role } from '@afrogate/shared';

export interface AuthActor {
  id: string;
  role: Role;
  type: 'admin' | 'agent';
}

export interface RequestWithAuth {
  actor?: AuthActor;
  headers: {
    authorization?: string;
  };
}
