import { useEffect, useRef } from 'react';
import { Equalizer } from '@/components/equalizer';
import { NUMBER_LOCALE, formatTime, useLang } from '@/i18n';
import { stationName, trackDuration, usePlayer } from '@/lib/player';
import { cn } from '@/lib/utils';

/**
 * "Up next": the current queue (station order or shuffled). Rows are buttons: tap plays that
 * entry, tapping the playing row pauses it. The list scrolls internally and keeps the current row
 * in view. `compact` drops the header (phone sheet supplies its own).
 */
export function QueueList({ id, className, compact = false }: { id?: string; className?: string; compact?: boolean }) {
  const { t, lang } = useLang();
  const { queue, position, playing, station, failed, durations, jumpTo, status } = usePlayer();
  const listRef = useRef<HTMLOListElement>(null);
  const digits = new Intl.NumberFormat(NUMBER_LOCALE[lang]);
  const headingId = id ? `${id}-title` : undefined;

  // Keep the current row visible inside the list (never scrolls the page: the page cannot scroll).
  useEffect(() => {
    const list = listRef.current;
    const row = list?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!list || !row || list.clientHeight === 0) return;
    // Manual scroll of the list only (scrollIntoView could also move overflow:hidden ancestors).
    const top = row.offsetTop; // the list is `relative`, so this is relative to it
    if (top < list.scrollTop) list.scrollTop = top;
    else if (top + row.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = top + row.offsetHeight - list.clientHeight;
  }, [position, queue]);

  return (
    <section id={id} aria-labelledby={headingId} aria-label={headingId ? undefined : t.player.upNext} className={cn('flex h-full min-h-0 flex-col', className)}>
      <h2 id={headingId} className={cn('flex items-baseline gap-2 px-5 pb-2 pt-5 text-xs font-extrabold uppercase tracking-widest text-[var(--muted-foreground)]', compact && 'px-4 pt-3')}>
        <span>{t.player.upNext}</span>
        {status === 'ready' && (
          <>
            <span aria-hidden="true">·</span>
            <bdi className="truncate normal-case tracking-normal">{stationName(station, lang, t)}</bdi>
            <span className="ms-auto tabular-nums">({digits.format(queue.length)})</span>
          </>
        )}
      </h2>
      <ol ref={listRef} data-scroll-list className="scroll-area relative min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {queue.map((item, i) => {
          const active = i === position;
          const bad = failed.has(item.id);
          const total = trackDuration(item, durations);
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => jumpTo(i)}
                aria-current={active || undefined}
                className={cn(
                  'flex min-h-12 w-full items-center gap-3 rounded-xl px-2 py-1.5 text-start transition-colors',
                  active ? 'bg-[color-mix(in_oklch,var(--foreground)_8%,transparent)]' : 'hover:bg-[color-mix(in_oklch,var(--foreground)_4%,transparent)]',
                )}
              >
                <span className="grid w-6 shrink-0 place-items-center text-xs font-bold tabular-nums text-[var(--muted-foreground)]">
                  {active ? <Equalizer active={playing} bars={3} className="h-3.5 text-[var(--accent)]" /> : digits.format(i + 1)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn('block truncate text-sm font-semibold', active && 'font-bold')}>
                    <bdi>{item.title}</bdi>
                  </span>
                  <span className="block truncate text-xs text-[var(--muted-foreground)]">
                    {bad ? <span className="font-semibold text-[var(--accent)]">{t.player.unavailable}</span> : <bdi>{item.artist}</bdi>}
                  </span>
                </span>
                <span dir="ltr" className="shrink-0 text-xs tabular-nums text-[var(--muted-foreground)]">
                  {total > 0 ? formatTime(total, lang) : ''}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
