import { useCallback, useEffect, useState } from 'react';
import type { AdminLoginRequest, AdminSessionResponse } from '@afrogate/shared';
import { AdminAuthError, type AdminAuthErrorCode, fetchAdminSession, loginAdmin } from './api/admin';

const adminSessionTokenStorageKey = 'afrogate.dashboard.adminSessionToken';
const legacyAdminTokenStorageKey = 'afrogate.dashboard.adminToken';

type AdminAuthStatus = 'checking' | 'signedOut' | 'signedIn';

export interface AdminAuthState {
  errorCode: AdminAuthErrorCode | 'required' | null;
  session: AdminSessionResponse | null;
  sessionToken: string | null;
  status: AdminAuthStatus;
}

export function useAdminSession() {
  const [state, setState] = useState<AdminAuthState>(() => {
    const sessionToken = readAdminSessionToken();

    return {
      errorCode: null,
      session: null,
      sessionToken,
      status: sessionToken ? 'checking' : 'signedOut',
    };
  });

  useEffect(() => {
    const sessionToken = readAdminSessionToken();
    if (!sessionToken) return;

    const controller = new AbortController();
    void verifyStoredSession(sessionToken, controller.signal);

    return () => controller.abort();
  }, []);

  const signIn = useCallback(async (credentials: AdminLoginRequest) => {
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
