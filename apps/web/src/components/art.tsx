import { stationArt, usePlayer } from '@/lib/player';
import type { Category, Library, Track } from '@/lib/tracks';
import { cn } from '@/lib/utils';

/**
 * Generated artwork (covers are mostly null in today's catalogue): a gradient from the category
 * colour (or a palette slot picked from the id) with the title's initials. Purely decorative —
 * always `aria-hidden`; the accessible name lives on the card / control around it.
 */
export function initials(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const letters = words.slice(0, 2).map((w) => Array.from(w)[0] ?? '');
  return letters.join('').toUpperCase();
}

/** Stable small hash -> palette index. */
export function hashIndex(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Colour of the first coloured category the track belongs to. */
export function trackColor(track: Track, library: Library): string | null {
  for (const id of track.categories) {
    const category = library.categories.find((c) => c.id === id);
    if (category?.color) return category.color;
  }
  return null;
}

function GeneratedArt({ id, color, label, cover, className, big }: { id: string; color: string | null; label: string; cover: string | null; className?: string; big?: boolean }) {
  return (
    <span aria-hidden="true" className={cn('art relative block shrink-0 overflow-hidden', className)} style={{ background: stationArt(color, hashIndex(id)) }}>
      {cover ? (
        <img key={cover} src={cover} alt="" loading="lazy" decoding="async" className="cover-in h-full w-full object-cover" />
      ) : (
        <span className={cn('art-initials absolute inset-0 grid place-items-center font-black text-white/90', big ? 'text-6xl' : 'text-2xl')}>
          <bdi>{initials(label)}</bdi>
        </span>
      )}
    </span>
  );
}

export function TrackArt({ track, className, big }: { track: Track; className?: string; big?: boolean }) {
  const { library } = usePlayer();
  return <GeneratedArt id={track.id} color={trackColor(track, library)} label={track.title} cover={track.cover} className={className} big={big} />;
}

export function CategoryArt({ category, label, className, big }: { category: Category; label: string; className?: string; big?: boolean }) {
  return <GeneratedArt id={category.id} color={category.color} label={label} cover={category.cover} className={className} big={big} />;
}
