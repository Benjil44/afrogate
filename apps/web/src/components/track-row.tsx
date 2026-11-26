import { Equalizer } from '@/components/equalizer';
import { TrackArt } from '@/components/art';
import { NUMBER_LOCALE, fill, formatTime, useLang, type Dict, type Lang } from '@/i18n';
import { trackDuration, usePlayer } from '@/lib/player';
import type { Track } from '@/lib/tracks';
import { cn } from '@/lib/utils';

/**
 * Track list row (station pages, All tracks, search results): one button that plays the track
 * within `stationId` (or pauses it when it is the playing one). Number / equalizer, art, title,
 * artist with BPM + energy chips (manifest v2 only; absent on v1), duration. Rows are >= 56px.
 * `result` marks the row for the search arrow-key navigation (`[data-result]`).
 */
export type EnergyLevel = 'calm' | 'medium' | 'high';
export const ENERGY_LEVELS: readonly EnergyLevel[] = ['calm', 'medium', 'high'];

/** Manifest energy 1–5 -> Calm (1–2) / Medium (3) / High (4–5). */
export function energyLevel(energy: number | undefined): EnergyLevel | null {
  if (energy === undefined) return null;
  return energy <= 2 ? 'calm' : energy === 3 ? 'medium' : 'high';
}

export function energyLabel(level: EnergyLevel, t: Dict): string {
  return level === 'calm' ? t.app.energyCalm : level === 'medium' ? t.app.energyMedium : t.app.energyHigh;
}

const CHIP = 'inline-flex h-5 shrink-0 items-center rounded-full border border-[var(--border)] px-1.5 text-[11px] font-bold leading-none text-[var(--muted-foreground)]';

/** BPM + energy chips (text, never colour alone). Renders nothing for v1 tracks. */
export function TrackChips({ track, lang, t }: { track: Track; lang: Lang; t: Dict }) {
  const level = energyLevel(track.energy);
  if (track.bpm === undefined && !level) return null;
  return (
    <>
      {track.bpm !== undefined && (
        // Unit number: an LTR island in both directions.
        <span dir="ltr" className={CHIP}>
          {fill(t.app.bpm, { n: new Intl.NumberFormat(NUMBER_LOCALE[lang], { useGrouping: false }).format(track.bpm) })}
        </span>
      )}
      {level && (
        <span className={CHIP}>
          <span className="sr-only">{t.app.energy}: </span>
          {energyLabel(level, t)}
        </span>
      )}
    </>
  );
}

export function TrackRow({ track, index, stationId, result = false }: { track: Track; index: number; stationId: string; result?: boolean }) {
  const { t, lang } = useLang();
  const { track: current, playing, toggle, playStation, durations, failed } = usePlayer();
  const active = current.id === track.id && Boolean(current.src);
  const total = trackDuration(track, durations);
  return (
    <button
      type="button"
      data-result={result || undefined}
      onClick={() => (active ? toggle() : playStation(stationId, track.id))}
      aria-current={active || undefined}
      className={cn(
        'flex min-h-14 w-full items-center gap-3 rounded-lg px-2 py-1.5 text-start transition-colors',
        active ? 'bg-[color-mix(in_oklch,var(--foreground)_8%,transparent)]' : 'hover:bg-[color-mix(in_oklch,var(--foreground)_5%,transparent)]',
      )}
    >
      <span className="grid w-6 shrink-0 place-items-center text-xs font-bold tabular-nums text-[var(--muted-foreground)]">
        {active ? <Equalizer active={playing} bars={3} className="h-3.5 text-[var(--accent)]" /> : new Intl.NumberFormat(NUMBER_LOCALE[lang]).format(index + 1)}
      </span>
      <TrackArt track={track} className="h-11 w-11 rounded-md" />
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate text-sm font-bold', active && 'text-[var(--accent)]')}>
          <span className="sr-only">{active && playing ? t.player.pause : t.player.play}: </span>
          <bdi>{track.title}</bdi>
        </span>
        <span className="flex min-w-0 items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
          {failed.has(track.id) ? (
            <span className="truncate font-semibold text-[var(--accent)]">{t.player.unavailable}</span>
          ) : (
            <bdi className="min-w-0 truncate">{track.artist}</bdi>
          )}
          <TrackChips track={track} lang={lang} t={t} />
        </span>
      </span>
      <span dir="ltr" className="shrink-0 text-xs tabular-nums text-[var(--muted-foreground)]">
        {total > 0 ? (
          <>
            <span className="sr-only">{t.app.duration}: </span>
            {formatTime(total, lang)}
          </>
        ) : null}
      </span>
    </button>
  );
}

/** A list of rows (`<ol>` keeps the position for screen readers). */
export function TrackRows({ tracks, stationId, result = false, id }: { tracks: readonly Track[]; stationId: string; result?: boolean; id?: string }) {
  return (
    <ol id={id} className="flex flex-col gap-0.5">
      {tracks.map((track, i) => (
        <li key={track.id} className="track-row-item">
          <TrackRow track={track} index={i} stationId={stationId} result={result} />
        </li>
      ))}
    </ol>
  );
}
