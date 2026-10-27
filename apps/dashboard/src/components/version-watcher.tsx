import { useEffect, useState } from 'react';
import { getApiBaseUrl } from '../api/base';
import { appVersion } from '../app-config';
import type { DashboardStrings } from '../i18n';

const POLL_MS = 30_000;
const AUTO_RELOAD_MS = 4_000;
const RELOADED_KEY = 'afrows.reloadedForVersion';

/**
 * Polls /api/health for the deployed backend version and compares it to the
 * version this bundle was built with. When they differ (i.e. a new deploy
 * happened), it shows a banner and auto-reloads once so open dashboards pick up
 * new code without a manual refresh. A sessionStorage guard prevents reload
 * loops if the versions can't converge.
 */
export function VersionWatcher({ t }: { t: DashboardStrings }) {
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

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[9999] flex flex-wrap items-center justify-center gap-3 bg-[#0f766e] px-4 py-2 text-sm font-bold text-white shadow-[0_-2px_8px_rgba(0,0,0,0.3)]"
      role="status"
    >
      <span>{t.versionWatcher.newVersion}</span>
      <button
        className="min-h-9 rounded-md bg-white/20 px-3 font-bold text-white hover:bg-white/30"
        onClick={() => window.location.reload()}
        type="button"
      >
        {t.versionWatcher.reloadNow}
      </button>
    </div>
  );
}
