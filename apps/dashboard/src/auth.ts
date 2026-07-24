import { useCallback, useEffect, useState } from 'react';
import type { AdminLoginRequest, AdminLoginResponse, AdminSessionResponse } from '@afrows/shared';
import { AdminAuthError, type AdminAuthErrorCode, fetchAdminSession, loginAdmin } from './api/admin';

const adminSessionTokenStorageKey = 'afrows.dashboard.adminSessionToken';
const legacyAdminTokenStorageKey = 'afrows.dashboard.adminToken';

// DEV-ONLY login bypass. Enabled with VITE_DEV_SKIP_AUTH=true in a local .env.local
// so the UI can be worked on without standing up the backend + Postgres. It is gated on
// import.meta.env.DEV, so it is stripped from any production build and can never ship.
const devSkipAuth = import.meta.env.DEV && import.meta.env.VITE_DEV_SKIP_AUTH === 'true';

function buildDevAdminSession(): AdminLoginResponse {
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + 12 * 60 * 60 * 1000);
  return {
    actor: {
      id: 'dev-superadmin',
      username: 'dev',
      role: 'superadmin',
      type: 'admin',
      isSuperAdmin: true,
    },
    mfaReady: true,
    mfaRequired: false,
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    sessionToken: 'dev-skip-auth',
  };
}

type AdminAuthStatus = 'checking' | 'signedOut' | 'signedIn';

export interface AdminAuthState {
  errorCode: AdminAuthErrorCode | 'required' | null;
  session: AdminSessionResponse | null;
  sessionToken: string | null;
  status: AdminAuthStatus;
}

export function useAdminSession() {
  const [state, setState] = useState<AdminAuthState>(() => {
    if (devSkipAuth) {
      const session = buildDevAdminSession();
      return { errorCode: null, session, sessionToken: session.sessionToken, status: 'signedIn' };
    }

    const sessionToken = readAdminSessionToken();

    return {
      errorCode: null,
      session: null,
      sessionToken,
      status: sessionToken ? 'checking' : 'signedOut',
    };
  });

  useEffect(() => {
    if (devSkipAuth) return;

    const sessionToken = readAdminSessionToken();
    if (!sessionToken) return;

    const controller = new AbortController();
    void verifyStoredSession(sessionToken, controller.signal);

    return () => controller.abort();
  }, []);

  const signIn = useCallback(async (credentials: AdminLoginRequest) => {
    if (devSkipAuth) {
      const session = buildDevAdminSession();
      setState({ errorCode: null, session, sessionToken: session.sessionToken, status: 'signedIn' });
      return;
    }

    const username = credentials.username.trim();
    const password = credentials.password;

    if (!username || !password) {
      setState({ errorCode: 'required', session: null, sessionToken: null, status: 'signedOut' });
      return;
    }

    setState({ errorCode: null, session: null, sessionToken: null, status: 'checking' });

    try {
      const session = await loginAdmin({ username, password });
      writeAdminSessionToken(session.sessionToken);
      setState({ errorCode: null, session, sessionToken: session.sessionToken, status: 'signedIn' });
    } catch (error) {
      clearAdminSessionToken();
      setState({
        errorCode: resolveAuthErrorCode(error),
        session: null,
        sessionToken: null,
        status: 'signedOut',
      });
    }
  }, []);

  const signOut = useCallback(() => {
    clearAdminSessionToken();
    setState({ errorCode: null, session: null, sessionToken: null, status: 'signedOut' });
  }, []);

  async function verifyStoredSession(sessionToken: string, signal: AbortSignal) {
    try {
      const session = await fetchAdminSession(sessionToken, signal);
      setState({ errorCode: null, session, sessionToken, status: 'signedIn' });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;

      clearAdminSessionToken();
      setState({
        errorCode: resolveAuthErrorCode(error),
        session: null,
        sessionToken: null,
        status: 'signedOut',
      });
    }
  }

  return {
    ...state,
    signIn,
    signOut,
  };
}

function resolveAuthErrorCode(error: unknown): AdminAuthErrorCode {
  return error instanceof AdminAuthError ? error.code : 'network';
}

function readAdminSessionToken(): string | null {
  try {
    return window.sessionStorage.getItem(adminSessionTokenStorageKey);
  } catch {
    return null;
  }
}

function writeAdminSessionToken(sessionToken: string): void {
  try {
    window.sessionStorage.setItem(adminSessionTokenStorageKey, sessionToken);
    window.sessionStorage.removeItem(legacyAdminTokenStorageKey);
  } catch {
    // Browsers can block sessionStorage in hardened modes. The verified session still works for this render.
  }
}

function clearAdminSessionToken(): void {
  try {
    window.sessionStorage.removeItem(adminSessionTokenStorageKey);
    window.sessionStorage.removeItem(legacyAdminTokenStorageKey);
  } catch {
    // Nothing to clear when sessionStorage is unavailable.
  }
}

export type AdminSessionHook = ReturnType<typeof useAdminSession>;
