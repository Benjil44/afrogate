import { X } from 'lucide-react';
import { Overlay } from '@/components/overlay';
import { useLang } from '@/i18n';

/** `?` — keyboard shortcut list. Keys are an LTR island (Latin key names in both languages). */
export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useLang();
  return (
    <Overlay open={open} onClose={onClose} variant="dialog" labelledBy="shortcuts-title">
      <div className="flex items-center justify-between gap-3 px-5 pt-4">
        <h2 id="shortcuts-title" className="text-lg font-black">
          {t.player.shortcuts}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={t.player.close}
          className="grid h-11 w-11 place-items-center rounded-full text-[var(--foreground)] hover:bg-[color-mix(in_oklch,var(--foreground)_8%,transparent)]"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
      <dl className="scroll-area max-h-[70dvh] overflow-y-auto px-5 pb-5 pt-2">
        {t.player.shortcutList.map((item) => (
          <div key={item.keys} className="flex items-center justify-between gap-4 border-b border-[var(--border)] py-2.5 last:border-b-0">
            <dt className="text-sm">{item.label}</dt>
            <dd dir="ltr" className="m-0 shrink-0">
              <kbd className="rounded-md border border-[var(--border)] bg-[var(--muted)] px-2 py-0.5 font-mono text-xs font-semibold">{item.keys}</kbd>
            </dd>
          </div>
        ))}
      </dl>
    </Overlay>
  );
}
