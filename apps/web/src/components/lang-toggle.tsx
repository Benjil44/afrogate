import { Languages } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLang } from '@/i18n';

export function LangToggle({ className }: { className?: string }) {
  const { toggle, lang } = useLang();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle language"
      className={cn(
        'inline-flex h-9 items-center gap-1.5 rounded-full border border-[var(--border)] px-3 text-sm font-semibold text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]',
        className,
      )}
    >
      <Languages className="h-4 w-4" />
      {lang === 'fa' ? 'EN' : 'فا'}
    </button>
  );
}
