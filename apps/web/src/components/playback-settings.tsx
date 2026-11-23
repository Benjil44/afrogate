import { useEffect, useState } from 'react';
import { Moon, X } from 'lucide-react';
import { Overlay } from '@/components/overlay';
import { IconButton } from '@/components/transport';
import { NUMBER_LOCALE, fill, useLang, type Dict, type Lang } from '@/i18n';
import { CROSSFADE_OPTIONS, SLEEP_OPTIONS, usePlayer, type Crossfade, type SleepMode, type SleepState } from '@/lib/player';
import { cn } from '@/lib/utils';

/**
 * Sleep timer (15 / 30 / 60 min, end of track; this session only) and crossfade (off / 3 s / 6 s;
 * stored on this device) in one small dialog, opened from a moon button in the player bar and the
 * phone sheet. Options are native radio groups (arrow keys move, labels are the targets, >= 44px).
 */
function useMinuteTick(enabled: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, [enabled]);
  return now;
}

function num(n: number, lang: Lang): string {
  return new Intl.NumberFormat(NUMBER_LOCALE[lang]).format(n);
}

/** "Music stops in 12 min" / "… when this track ends" / '' when off. */
export function sleepSummary(sleep: SleepState, now: number, lang: Lang, t: Dict): string {
  if (sleep.mode === 'track') return t.player.sleepAtTrackEnd;
  if (sleep.endsAt === null) return '';
  return fill(t.player.sleepRemaining, { n: num(Math.max(1, Math.ceil((sleep.endsAt - now) / 60_000)), lang) });
}

function sleepOptionLabel(mode: SleepMode, lang: Lang, t: Dict): string {
  if (mode === 'off') return t.player.sleepOff;
  if (mode === 'track') return t.player.sleepEndOfTrack;
  return fill(t.player.sleepMinutes, { n: num(mode, lang) });
}

function crossfadeLabel(seconds: Crossfade, lang: Lang, t: Dict): string {
  return seconds === 0 ? t.player.crossfadeOff : fill(t.player.crossfadeSeconds, { n: num(seconds, lang) });
}

function Pill({ name, checked, disabled, onChange, children }: { name: string; checked: boolean; disabled?: boolean; onChange: () => void; children: string }) {
  return (
    <label className={cn('relative inline-flex', disabled ? 'cursor-default opacity-50' : 'cursor-pointer')}>
      <input type="radio" name={name} checked={checked} disabled={disabled} onChange={onChange} className="peer sr-only" />
      <span
        className={cn(
          'inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-bold transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--foreground)]',
          checked ? 'border-transparent bg-[var(--foreground)] text-[var(--background)]' : 'border-[var(--border)] text-[var(--foreground)] hover:bg-[color-mix(in_oklch,var(--foreground)_6%,transparent)]',
        )}
      >
        {children}
      </span>
    </label>
  );
}

export function PlaybackSettingsButton({ size, className }: { size?: 'sm' | 'md'; className?: string }) {
  const { t, lang } = useLang();
  const { sleep, setSleep, crossfade, setCrossfade, crossfadeSupported } = usePlayer();
  const [open, setOpen] = useState(false);
  const active = sleep.mode !== 'off';
  const now = useMinuteTick(active);
  const summary = sleepSummary(sleep, now, lang, t);
  const label = summary ? `${t.player.playbackSettings} · ${summary}` : t.player.playbackSettings;

  return (
    <>
      <IconButton
        label={label}
        size={size}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className={cn(active ? 'text-[var(--accent)]' : 'text-[var(--muted-foreground)]', className)}
      >
        <Moon className="h-[18px] w-[18px]" fill={active ? 'currentColor' : 'none'} aria-hidden="true" />
      </IconButton>
      <Overlay open={open} onClose={() => setOpen(false)} variant="dialog" labelledBy="playback-settings-title">
        <div className="flex items-center justify-between gap-3 px-5 pt-4">
          <h2 id="playback-settings-title" className="text-lg font-black">
            {t.player.playbackSettings}
          </h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={t.player.close}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[var(--foreground)] hover:bg-[color-mix(in_oklch,var(--foreground)_8%,transparent)]"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="scroll-area flex max-h-[75dvh] flex-col gap-5 overflow-y-auto px-5 pb-5 pt-2">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-extrabold">{t.player.sleepTimer}</legend>
            <div className="flex flex-wrap gap-2">
              {SLEEP_OPTIONS.map((mode) => (
                <Pill key={String(mode)} name="afrows-sleep" checked={sleep.mode === mode} onChange={() => setSleep(mode)}>
                  {sleepOptionLabel(mode, lang, t)}
                </Pill>
              ))}
            </div>
            <p role="status" className="min-h-5 text-sm text-[var(--muted-foreground)]">
              {summary}
            </p>
          </fieldset>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-extrabold">{t.player.crossfade}</legend>
            <div className="flex flex-wrap gap-2">
              {CROSSFADE_OPTIONS.map((seconds) => (
                <Pill key={seconds} name="afrows-crossfade" checked={crossfade === seconds} disabled={!crossfadeSupported} onChange={() => setCrossfade(seconds)}>
                  {crossfadeLabel(seconds, lang, t)}
                </Pill>
              ))}
            </div>
            <p className="text-sm text-[var(--muted-foreground)]">{crossfadeSupported ? t.player.settingsNote : t.player.crossfadeUnsupported}</p>
          </fieldset>
        </div>
      </Overlay>
    </>
  );
}
