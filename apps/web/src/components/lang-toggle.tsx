import { Languages } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLang, WEB_LANGUAGE_TOGGLE_ENABLED } from '@/i18n';

export function LangToggle({ className }: { className?: string }) {
  const { toggle, lang, t } = useLang();
  if (!WEB_LANGUAGE_TOGGLE_ENABLED) return null;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={t.langToggle}
      className={cn(
        'inline-flex h-11 min-w-11 items-center gap-1.5 rounded-full border border-[var(--border)] px-3 text-sm font-semibold text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]',
        className,
      )}
    >
      <Languages className="h-4 w-4" aria-hidden="true" />
      {lang === 'fa' ? 'EN' : 'فا'}
    </button>
  );
}
