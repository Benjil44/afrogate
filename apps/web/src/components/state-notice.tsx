import type { ReactNode } from 'react';
import { CloudOff, Music2, RotateCw } from 'lucide-react';
import { useLang } from '@/i18n';
import { cn } from '@/lib/utils';

/**
 * Loading / error / empty panels for the library. Fixed-height skeletons while loading (no layout
 * jump); the error tone is reserved for real failures — an empty library is just "nothing yet".
 */
export function LoadingSkeleton({ className }: { className?: string }) {
  const { t } = useLang();
  return (
    <div aria-busy="true" className={cn('flex flex-col items-center gap-4', className)}>
      <span className="sr-only" role="status">
        {t.player.loading}
      </span>
      <div aria-hidden="true" className="skeleton aspect-square w-[min(280px,36dvh)] rounded-3xl" />
      <div aria-hidden="true" className="skeleton h-5 w-48 rounded-full" />
      <div aria-hidden="true" className="skeleton h-4 w-32 rounded-full" />
    </div>
  );
}

export function StateNotice({
  tone,
  title,
  body,
  children,
  className,
}: {
  tone: 'error' | 'neutral';
  title: string;
  body?: string;
  children?: ReactNode;
  className?: string;
}) {
  const Icon = tone === 'error' ? CloudOff : Music2;
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cn('mx-auto flex w-full min-w-0 max-w-sm flex-col items-center gap-3 px-4 text-center', className)}>
      <span
        aria-hidden="true"
        className={cn(
          'grid h-14 w-14 place-items-center rounded-2xl',
          tone === 'error' ? 'bg-[color-mix(in_oklch,var(--destructive)_18%,transparent)] text-[var(--accent)]' : 'bg-[color-mix(in_oklch,var(--foreground)_6%,transparent)] text-[var(--muted-foreground)]',
        )}
      >
        <Icon className="h-7 w-7" />
      </span>
      <p className="w-full text-balance text-lg font-bold [overflow-wrap:anywhere]">{title}</p>
      {body && <p className="w-full text-pretty text-sm text-[var(--muted-foreground)] [overflow-wrap:anywhere]">{body}</p>}
      {children && <div className="mt-1 flex flex-wrap items-center justify-center gap-2">{children}</div>}
    </div>
  );
}

export function NoticeButton({ onClick, children, primary = false, icon = false }: { onClick: () => void; children: ReactNode; primary?: boolean; icon?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm font-bold transition',
        primary
          ? 'bg-[image:var(--brand-gradient)] text-white hover:brightness-110'
          : 'border border-[var(--border)] text-[var(--foreground)] hover:bg-[color-mix(in_oklch,var(--foreground)_6%,transparent)]',
      )}
    >
      {icon && <RotateCw className="h-4 w-4" aria-hidden="true" />}
      {children}
    </button>
  );
}
