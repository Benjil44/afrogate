import { Loader2, Pause, Play, RotateCw, SkipBack, SkipForward } from 'lucide-react';
import { Equalizer } from '@/components/equalizer';
import { SectionHeading } from '@/components/section-heading';
import { SeekBar } from '@/components/seek-bar';
import { NUMBER_LOCALE, formatTime, useLang } from '@/i18n';
import { trackArt, usePlayer } from '@/lib/player';
import { cn } from '@/lib/utils';

/** Placeholder rows while the manifest loads, so the deck keeps its height. */
const SKELETON_ROWS = 5;

/**
 * Music deck: the published mixes from the runtime manifest (`lib/tracks.ts`). Rows are buttons (Space/Enter toggle), the active one is
 * highlighted and announced through `aria-pressed`; durations appear once a mix's metadata has
 * streamed. Nothing downloads before the first tap.
 */
export function Deck() {
  const { t, lang, dir } = useLang();
  const { tracks, tracksStatus, reloadTracks, index, track, playing, loading, error, durations, toggle, step } = usePlayer();
  const ready = tracksStatus === 'ready';
  const artists = [...new Set(tracks.map((item) => item.artist).filter(Boolean))];
  const PrevIcon = dir === 'rtl' ? SkipForward : SkipBack;
  const NextIcon = dir === 'rtl' ? SkipBack : SkipForward;
  const numberFormat = new Intl.NumberFormat(NUMBER_LOCALE[lang]);

  return (
    <section id="mixes" className="relative mx-auto w-full max-w-6xl px-4 py-20 sm:px-5">
      <SectionHeading tag={t.deck.tag} title={t.deck.title} subtitle={t.deck.subtitle} />

      <div data-fx="rise" className="deck mt-12 overflow-hidden rounded-3xl border border-[var(--border)] bg-[color-mix(in_oklch,var(--card)_70%,transparent)] backdrop-blur-md">
        <div className="grid gap-0 lg:grid-cols-[0.9fr_1.1fr]">
          {/* Now playing */}
          <div className="relative flex flex-col justify-between gap-5 p-5 sm:p-7">
            <div className="pointer-events-none absolute inset-0 opacity-60" style={{ background: `radial-gradient(circle at 20% 0%, color-mix(in oklch, var(--primary) 18%, transparent), transparent 55%)` }} />
            <div className="relative flex items-center gap-4">
              <span className="relative grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl shadow-lg" style={{ background: trackArt(index) }} aria-hidden="true">
                <Equalizer active={playing} bars={5} className="h-7 text-white drop-shadow" />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-extrabold uppercase tracking-widest text-[var(--accent)]">{t.deck.nowPlaying}</p>
                <p className="mt-1 truncate text-lg font-black">
                  <bdi>{track.title || t.deck.noTrack}</bdi>
                </p>
                <p className="truncate text-sm text-[var(--muted-foreground)]">
                  <bdi>{track.artist}</bdi>
                </p>
              </div>
            </div>

            <SeekBar className="relative" />

            <div className="relative flex items-center justify-center gap-3">
              <button type="button" aria-label={t.hero.player.previous} disabled={!ready} onClick={() => step(-1)} className="disabled:opacity-40 grid h-12 w-12 place-items-center rounded-full text-[var(--foreground)] transition-colors hover:bg-[color-mix(in_oklch,var(--foreground)_8%,transparent)]">
                <PrevIcon className="h-6 w-6" aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label={playing ? t.hero.player.pause : t.hero.player.play}
                aria-pressed={playing}
                aria-busy={loading}
                disabled={!ready}
                onClick={() => toggle()}
                className="disabled:opacity-40 disabled:hover:scale-100 grid h-14 w-14 place-items-center rounded-full bg-[linear-gradient(135deg,var(--primary),var(--secondary))] text-white shadow-lg shadow-[color-mix(in_oklch,var(--primary)_45%,transparent)] transition-transform hover:scale-105 active:scale-95"
              >
                {loading ? <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" /> : playing ? <Pause className="h-6 w-6" fill="currentColor" aria-hidden="true" /> : <Play className="ms-1 h-6 w-6" fill="currentColor" aria-hidden="true" />}
              </button>
              <button type="button" aria-label={t.hero.player.next} disabled={!ready} onClick={() => step(1)} className="disabled:opacity-40 grid h-12 w-12 place-items-center rounded-full text-[var(--foreground)] transition-colors hover:bg-[color-mix(in_oklch,var(--foreground)_8%,transparent)]">
                <NextIcon className="h-6 w-6" aria-hidden="true" />
              </button>
            </div>

            <p role="status" className={cn('relative text-center text-[11px]', error ? 'font-semibold text-[var(--accent)]' : 'text-[var(--muted-foreground)]')}>
              {error ? t.deck.error : loading ? t.deck.loading : t.hero.player.hint}
            </p>
          </div>

          {/* Track list */}
          {tracksStatus === 'loading' && (
            <ol aria-busy="true" aria-label={t.deck.listLoading} className="flex flex-col gap-1.5 border-t border-[var(--border)] p-3 sm:p-4 lg:border-s lg:border-t-0">
              {Array.from({ length: SKELETON_ROWS }, (_, i) => (
                <li key={i} className="flex min-h-14 items-center gap-3 rounded-2xl p-2" aria-hidden="true">
                  <span className="h-11 w-11 shrink-0 animate-pulse rounded-xl bg-[color-mix(in_oklch,var(--foreground)_8%,transparent)]" />
                  <span className="flex-1 space-y-2">
                    <span className="block h-3 w-2/3 animate-pulse rounded bg-[color-mix(in_oklch,var(--foreground)_8%,transparent)]" />
                    <span className="block h-2.5 w-1/3 animate-pulse rounded bg-[color-mix(in_oklch,var(--foreground)_6%,transparent)]" />
                  </span>
                </li>
              ))}
            </ol>
          )}
          {(tracksStatus === 'empty' || tracksStatus === 'error') && (
            <div role="status" className="flex min-h-64 flex-col items-center justify-center gap-4 border-t border-[var(--border)] p-6 text-center lg:border-s lg:border-t-0">
              <p className="text-sm font-semibold text-[var(--muted-foreground)]">{tracksStatus === 'empty' ? t.deck.empty : t.deck.listError}</p>
              {tracksStatus === 'error' && (
                <button type="button" onClick={reloadTracks} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--border)] px-5 text-sm font-bold transition-colors hover:bg-[color-mix(in_oklch,var(--foreground)_6%,transparent)]">
                  <RotateCw className="h-4 w-4" aria-hidden="true" />
                  {t.deck.retry}
                </button>
              )}
            </div>
          )}
          {ready && (
            <ol className="flex flex-col gap-1.5 border-t border-[var(--border)] p-3 sm:p-4 lg:border-s lg:border-t-0">
              {tracks.map((item, i) => {
                const active = i === index;
                const isPlaying = active && playing;
                const duration = durations[item.id];
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => toggle(i)}
                      aria-pressed={isPlaying}
                      aria-busy={active && loading}
                      aria-label={`${isPlaying ? t.hero.player.pause : t.hero.player.play}: ${item.title}`}
                      className={cn(
                        'deck-row flex min-h-14 w-full items-center gap-3 rounded-2xl border p-2 text-start transition-colors',
                        active
                          ? 'border-[color-mix(in_oklch,var(--primary)_50%,transparent)] bg-[color-mix(in_oklch,var(--primary)_10%,transparent)]'
                          : 'border-transparent hover:bg-[color-mix(in_oklch,var(--foreground)_5%,transparent)]',
                      )}
                    >
                      <span className="relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl text-white" style={{ background: trackArt(i) }} aria-hidden="true">
                        {active && loading ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : isPlaying ? (
                          <Pause className="h-5 w-5" fill="currentColor" />
                        ) : (
                          <Play className="ms-0.5 h-5 w-5" fill="currentColor" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold">
                          <span className="me-1.5 text-[var(--muted-foreground)]">{t.deck.mix} {numberFormat.format(i + 1)}</span>
                          <bdi>{item.title}</bdi>
                        </span>
                        <span className="block truncate text-xs text-[var(--muted-foreground)]">
                          <bdi>{item.artist}</bdi>
                        </span>
                      </span>
                      {isPlaying && <Equalizer active bars={4} className="h-4 text-[var(--primary)]" />}
                      <span className="shrink-0 text-xs font-semibold tabular-nums text-[var(--muted-foreground)]">{duration ? formatTime(duration, lang) : '—'}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        {artists.length > 0 && (
          <p className="border-t border-[var(--border)] px-5 py-3 text-center text-xs font-semibold text-[var(--muted-foreground)]">
            {t.deck.creditPrefix} <bdi>{artists.join(lang === 'fa' ? '، ' : ', ')}</bdi>
          </p>
        )}
      </div>
    </section>
  );
}
