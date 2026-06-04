import { useEffect, useState } from 'react';
import { getApiBaseUrl } from '../api/base';
import { appVersion } from '../app-config';

const COPY: Record<string, { msg: string; now: string }> = {
  en: { msg: 'A new version is available — reloading…', now: 'Reload now' },
  fa: { msg: 'نسخه جدید موجود است — در حال بارگذاری مجدد…', now: 'بارگذاری مجدد' },
};

const POLL_MS = 30_000;
const AUTO_RELOAD_MS = 4_000;
const RELOADED_KEY = 'afrogate.reloadedForVersion';

/**
 * Polls /api/health for the deployed backend version and compares it to the
 * version this bundle was built with. When they differ (i.e. a new deploy
 * happened), it shows a banner and auto-reloads once so open dashboards pick up
 * new code without a manual refresh. A sessionStorage guard prevents reload
 * loops if the versions can't converge.
 */
export function VersionWatcher({ language }: { language: string }) {
  const [newVersion, setNewVersion] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        const res = await fetch(`${getApiBaseUrl()}/health`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as { version?: unknown };
        const version = typeof data.version === 'string' ? data.version : '';
        if (!active || !version || version === 'unknown' || version === appVersion) return;
        setNewVersion(version);
      } catch {
        // backend restarting / offline — ignore and retry next tick
      }
    };
    void check();
    const id = window.setInterval(check, POLL_MS);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (!newVersion) return undefined;
    if (window.sessionStorage.getItem(RELOADED_KEY) === newVersion) return undefined;
    window.sessionStorage.setItem(RELOADED_KEY, newVersion);
    const id = window.setTimeout(() => window.location.reload(), AUTO_RELOAD_MS);
    return () => window.clearTimeout(id);
  }, [newVersion]);

  if (!newVersion) return null;
  const copy = COPY[language] ?? COPY.en;

  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        background: '#0f766e',
        color: '#ffffff',
        padding: '8px 16px',
        fontSize: '14px',
        fontWeight: 700,
        boxShadow: '0 -2px 8px rgba(0,0,0,0.3)',
      }}
    >
      <span>{copy.msg}</span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        style={{
          borderRadius: '6px',
          background: 'rgba(255,255,255,0.2)',
          padding: '2px 10px',
          color: '#ffffff',
          cursor: 'pointer',
          border: 'none',
          fontWeight: 700,
        }}
      >
        {copy.now}
      </button>
    </div>
  );
}
