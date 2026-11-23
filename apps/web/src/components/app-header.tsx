import { Keyboard } from 'lucide-react';
import { Equalizer } from '@/components/equalizer';
import { LangToggle } from '@/components/lang-toggle';
import { IconButton } from '@/components/transport';
import { useLang } from '@/i18n';
import { usePlayer } from '@/lib/player';

/**
 * Minimal header (56px; 52px on phones): "Afrows Radio" wordmark, keyboard-shortcut help (pointer
 * devices only) and the language toggle. afrows.com is the radio only — no VPN marketing here.
 */
export function AppHeader({ onOpenShortcuts }: { onOpenShortcuts: () => void }) {
  const { t } = useLang();
  const { playing } = usePlayer();
  return (
    <header className="flex h-full items-center gap-2 border-b border-[var(--border)] px-3 sm:gap-3 sm:px-4 lg:px-6">
      <h1 className="flex min-w-0 items-center gap-2.5 text-lg font-black tracking-tight">
        <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[linear-gradient(135deg,var(--primary),var(--secondary))] text-white">
          <Equalizer active={playing} bars={4} className="h-4 text-white" />
        </span>
        <span className="truncate">{t.brandRadio}</span>
      </h1>
      <div className="ms-auto flex shrink-0 items-center gap-2">
        <IconButton label={t.player.shortcutsOpen} aria-haspopup="dialog" onClick={onOpenShortcuts} className="tip-down hidden text-[var(--muted-foreground)] pointer-fine:grid">
          <Keyboard className="h-5 w-5" aria-hidden="true" />
        </IconButton>
        <LangToggle />
      </div>
    </header>
  );
}
