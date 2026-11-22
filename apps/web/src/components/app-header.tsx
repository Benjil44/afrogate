import { forwardRef } from 'react';
import { Keyboard, ShieldCheck } from 'lucide-react';
import { Equalizer } from '@/components/equalizer';
import { LangToggle } from '@/components/lang-toggle';
import { IconButton } from '@/components/transport';
import { useLang } from '@/i18n';
import { usePlayer } from '@/lib/player';

/**
 * Header (56px; 52px on phones): wordmark, "Get Afrows VPN" (secondary, outline — Play stays the
 * one primary action), keyboard-shortcut help (pointer devices), language toggle.
 */
export const AppHeader = forwardRef<HTMLButtonElement, { vpnOpen: boolean; onOpenVpn: () => void; onOpenShortcuts: () => void }>(
  function AppHeader({ vpnOpen, onOpenVpn, onOpenShortcuts }, vpnRef) {
    const { t } = useLang();
    const { playing } = usePlayer();
    return (
      <header className="flex h-full items-center gap-2 border-b border-[var(--border)] px-3 sm:gap-3 sm:px-4 lg:px-6">
        <h1 className="flex min-w-0 items-center gap-2.5 text-lg font-black tracking-tight">
          <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[linear-gradient(135deg,var(--primary),var(--secondary))] text-white">
            <Equalizer active={playing} bars={4} className="h-4 text-white" />
          </span>
          <span className="truncate">{t.brand}</span>
        </h1>
        <div className="ms-auto flex shrink-0 items-center gap-2">
          <button
            ref={vpnRef}
            type="button"
            onClick={onOpenVpn}
            aria-haspopup="dialog"
            aria-expanded={vpnOpen}
            aria-label={t.player.getVpn}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-[var(--border)] px-4 text-sm font-semibold text-[var(--foreground)] transition-colors hover:border-[var(--primary)] hover:bg-[color-mix(in_oklch,var(--primary)_10%,transparent)]"
          >
            <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="sm:hidden">{t.player.vpnShort}</span>
            <span className="hidden sm:inline">{t.player.getVpn}</span>
          </button>
          <IconButton label={t.player.shortcutsOpen} aria-haspopup="dialog" onClick={onOpenShortcuts} className="tip-down hidden text-[var(--muted-foreground)] pointer-fine:grid">
            <Keyboard className="h-5 w-5" aria-hidden="true" />
          </IconButton>
          <LangToggle />
        </div>
      </header>
    );
  },
);
