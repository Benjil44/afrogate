import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import {
  Heart,
  Loader2,
  PanelRight,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { NUMBER_LOCALE, useLang } from '@/i18n';
import { TrackArt } from '@/components/art';
import { useCollection } from '@/lib/collection';
import { usePlayer } from '@/lib/player';
import { cn } from '@/lib/utils';
import { SeekBar } from '@/components/seek-bar';

/**
 * Transport building blocks shared by the desktop/tablet bar, the phone mini bar and the phone
 * player sheet. Icon-only buttons always carry an `aria-label` and show the same text as a tooltip
 * on keyboard focus (and hover) — never hover-only information.
 */
type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  /** 'md' = 44px (default, touch), 'sm' = 36px (desktop bar secondary controls; still >= 24px). */
  size?: 'sm' | 'md';
  children: ReactNode;
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, size = 'md', className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      className={cn(
        'tip-host relative grid shrink-0 place-items-center rounded-full text-[var(--foreground)] transition-colors hover:bg-[color-mix(in_oklch,var(--foreground)_8%,transparent)] disabled:cursor-default disabled:opacity-40',
        size === 'md' ? 'h-11 w-11' : 'h-9 w-9 pointer-coarse:h-11 pointer-coarse:w-11',
        className,
      )}
      {...rest}
    >
      {children}
      <span aria-hidden="true" className="tip">
        {label}
      </span>
    </button>
  );
});

/** Primary Play/Pause. Buffering shows a spinner inside the button only. */
export function PlayButton({ size = 'md', className }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const { t } = useLang();
  const { playing, loading, toggle, track, status, started, blocked } = usePlayer();
  const disabled = status !== 'ready' || !track.src;
  const label = playing ? t.player.pause : !started || blocked ? t.player.start : t.player.play;
  const dims = size === 'lg' ? 'h-20 w-20' : size === 'md' ? 'h-14 w-14' : 'h-11 w-11';
  const icon = size === 'lg' ? 'h-9 w-9' : size === 'md' ? 'h-7 w-7' : 'h-5 w-5';
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled}
      aria-label={label}
      aria-busy={loading || undefined}
      className={cn(
        'tip-host relative grid shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,var(--primary),var(--secondary))] text-white shadow-lg shadow-[color-mix(in_oklch,var(--primary)_40%,transparent)] transition-transform hover:scale-105 active:scale-95 disabled:cursor-default disabled:opacity-50 disabled:hover:scale-100',
        dims,
        className,
      )}
    >
      {loading ? (
        <Loader2 className={cn(icon, 'animate-spin')} aria-hidden="true" />
      ) : playing ? (
        <Pause className={icon} fill="currentColor" aria-hidden="true" />
      ) : (
        // The play glyph is never mirrored (media convention in both directions).
        <Play className={cn(icon, 'translate-x-[6%]')} fill="currentColor" aria-hidden="true" />
      )}
      <span aria-hidden="true" className="tip">
        {label}
      </span>
    </button>
  );
}

export function PrevButton({ size }: { size?: 'sm' | 'md' }) {
  const { t, dir } = useLang();
  const { prev, queue } = usePlayer();
  // RTL: "previous" sits on the right, so swap the glyphs rather than the semantics.
  const Icon = dir === 'rtl' ? SkipForward : SkipBack;
  return (
    <IconButton label={t.player.previous} size={size} onClick={prev} disabled={queue.length === 0}>
      <Icon className="h-5 w-5" fill="currentColor" aria-hidden="true" />
    </IconButton>
  );
}

export function NextButton({ size }: { size?: 'sm' | 'md' }) {
  const { t, dir } = useLang();
  const { next, queue } = usePlayer();
  const Icon = dir === 'rtl' ? SkipBack : SkipForward;
  return (
    <IconButton label={t.player.next} size={size} onClick={next} disabled={queue.length === 0}>
      <Icon className="h-5 w-5" fill="currentColor" aria-hidden="true" />
    </IconButton>
  );
}

const ACTIVE_TOGGLE =
  'text-[var(--accent)] after:absolute after:inset-x-0 after:bottom-0.5 after:mx-auto after:h-1 after:w-1 after:rounded-full after:bg-[var(--accent)]';

export function ShuffleButton({ size }: { size?: 'sm' | 'md' }) {
  const { t } = useLang();
  const { shuffle, toggleShuffle, queue } = usePlayer();
  return (
    <IconButton
      label={t.player.shuffle}
      size={size}
      aria-pressed={shuffle}
      onClick={toggleShuffle}
      disabled={queue.length < 2}
      className={cn(shuffle ? ACTIVE_TOGGLE : 'text-[var(--muted-foreground)]')}
    >
      <Shuffle className="h-[18px] w-[18px]" aria-hidden="true" />
    </IconButton>
  );
}

export function RepeatButton({ size }: { size?: 'sm' | 'md' }) {
  const { t } = useLang();
  const { repeat, cycleRepeat } = usePlayer();
  const label = repeat === 'one' ? t.player.repeatOne : repeat === 'all' ? t.player.repeatAll : t.player.repeatOff;
  const Icon = repeat === 'one' ? Repeat1 : Repeat;
  return (
    <IconButton
      label={label}
      size={size}
      aria-pressed={repeat !== 'off'}
      onClick={cycleRepeat}
      className={cn(repeat !== 'off' ? ACTIVE_TOGGLE : 'text-[var(--muted-foreground)]')}
    >
      <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
    </IconButton>
  );
}

/** Mute toggle + volume slider (LTR island). Not rendered on phones: hardware keys rule there. */
export function VolumeControl({ className }: { className?: string }) {
  const { t, lang } = useLang();
  const { volume, muted, setVolume, toggleMute } = usePlayer();
  const effective = muted ? 0 : volume;
  const Icon = effective === 0 ? VolumeX : effective < 0.5 ? Volume1 : Volume2;
  const pct = Math.round(effective * 100);
  const pctText = new Intl.NumberFormat(NUMBER_LOCALE[lang], { style: 'percent' }).format(effective);
  return (
    <div dir="ltr" className={cn('flex items-center gap-1', className)}>
      <IconButton label={muted ? t.player.unmute : t.player.mute} size="sm" aria-pressed={muted} onClick={toggleMute}>
        <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
      </IconButton>
      <div className="seek relative h-6 w-24">
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-[var(--muted)]">
          <div className="h-full rounded-full bg-[var(--foreground)]" style={{ width: `${pct}%` }} />
        </div>
        <input
          type="range"
          className="seek-input absolute inset-0 h-full w-full cursor-pointer"
          min={0}
          max={100}
          step={5}
          value={pct}
          aria-label={t.player.volume}
          aria-valuetext={pctText}
          onChange={(e) => setVolume(Number(e.currentTarget.value) / 100)}
        />
      </div>
    </div>
  );
}

/** Small cover square of the current track (cover image, else generated art). */
export function CoverThumb({ className }: { className?: string }) {
  const { track } = usePlayer();
  return <TrackArt track={track} className={cn('rounded-lg', className)} />;
}

/** Heart toggle for the current track (liked tracks live in this browser only). */
export function LikeButton({ size }: { size?: 'sm' | 'md' }) {
  const { t } = useLang();
  const { track, status } = usePlayer();
  const { isLiked, toggleLike } = useCollection();
  const liked = track.src ? isLiked(track.id) : false;
  return (
    <IconButton
      label={liked ? t.app.unlike : t.app.like}
      size={size}
      aria-pressed={liked}
      disabled={status !== 'ready' || !track.src}
      onClick={() => toggleLike(track.id)}
      className={cn(liked ? 'text-[var(--primary)]' : 'text-[var(--muted-foreground)]')}
    >
      <Heart className="h-5 w-5" fill={liked ? 'currentColor' : 'none'} aria-hidden="true" />
    </IconButton>
  );
}

/**
 * Bottom player bar (>= 768px, 80px): track + like (start) · transport above the timeline
 * (centre) · volume + "Now playing" toggle (end; the toggle only below 1280px, where the
 * now-playing column is hidden). Flex order mirrors in RTL for free.
 */
export function TransportBar({ nowOpen, onToggleNow, extra }: { nowOpen: boolean; onToggleNow: () => void; /** End-side extras (sleep timer / crossfade button). */ extra?: ReactNode }) {
  const { t } = useLang();
  const { track } = usePlayer();
  return (
    <section aria-label={t.player.playerRegion} className="flex h-full items-center gap-4 px-2 lg:px-3">
      <div className="flex w-[28%] min-w-0 items-center gap-3">
        <CoverThumb className="h-14 w-14" />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">
            <bdi>{track.title || t.player.noTrack}</bdi>
          </p>
          <p className="truncate text-xs text-[var(--muted-foreground)]">
            <bdi>{track.artist}</bdi>
          </p>
        </div>
        <LikeButton size="sm" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col items-center gap-0.5">
        <div className="flex items-center gap-1">
          <ShuffleButton size="sm" />
          <PrevButton size="sm" />
          <PlayButton size="sm" />
          <NextButton size="sm" />
          <RepeatButton size="sm" />
        </div>
        <SeekBar className="max-w-2xl" />
      </div>
      <div className="flex w-[28%] min-w-0 items-center justify-end gap-1">
        {extra}
        <VolumeControl className="hidden lg:flex" />
        <IconButton
          label={nowOpen ? t.app.closeNowPlaying : t.app.openNowPlaying}
          size="sm"
          aria-haspopup="dialog"
          aria-expanded={nowOpen}
          onClick={onToggleNow}
          className={cn('xl:hidden', nowOpen ? 'text-[var(--accent)]' : 'text-[var(--muted-foreground)]')}
        >
          <PanelRight className="h-5 w-5 rtl:-scale-x-100" aria-hidden="true" />
        </IconButton>
      </div>
    </section>
  );
}
