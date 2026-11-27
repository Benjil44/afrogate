import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useLang } from '@/i18n';

/**
 * One transient confirmation at a time ("Saved to Your library", with an optional link). It answers
 * "where did that go?" right after an action — the heart in particular. Lives at `<body>` level
 * (above the player bar / phone bars) and is announced politely. No store, no history: a newer toast
 * replaces the current one. Everything here is text the caller already resolved for the language.
 */
export interface ToastAction {
  label: string;
  href: string;
}
export interface ToastInput {
  message: string;
  action?: ToastAction;
}
interface ActiveToast extends ToastInput {
  /** Monotonic id so re-raising the same message still restarts the enter animation + timer. */
  key: number;
}

interface ToastState {
  show: (toast: ToastInput) => void;
}

const ToastContext = createContext<ToastState | null>(null);
const TOAST_MS = 4000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useLang();
  const [toast, setToast] = useState<ActiveToast | null>(null);
  const seq = useRef(0);
  const timer = useRef<number | undefined>(undefined);

  const dismiss = useCallback(() => {
    window.clearTimeout(timer.current);
    setToast(null);
  }, []);

  const show = useCallback((input: ToastInput) => {
    window.clearTimeout(timer.current);
    seq.current += 1;
    setToast({ ...input, key: seq.current });
    timer.current = window.setTimeout(() => setToast(null), TOAST_MS);
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const value = useMemo<ToastState>(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div className="toast-region" role="status" aria-live="polite" aria-atomic="true">
          {toast && (
            <div key={toast.key} className="toast">
              <span className="min-w-0 flex-1 truncate text-sm font-bold">{toast.message}</span>
              {toast.action && (
                <a href={toast.action.href} onClick={dismiss} className="shrink-0 rounded-full px-2 py-1 text-sm font-black text-[var(--accent)] hover:underline">
                  {toast.action.label}
                </a>
              )}
              <button type="button" onClick={dismiss} aria-label={t.app.dismiss} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[var(--muted-foreground)] hover:bg-[color-mix(in_oklch,var(--foreground)_10%,transparent)] hover:text-[var(--foreground)]">
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastState {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
