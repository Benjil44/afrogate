import type { Category, Library, Track } from './tracks';

/**
 * Client-side search over the manifest (no server, nothing leaves the browser).
 *
 * Normalisation makes Persian, Arabic and English input meet in the middle:
 *   - case folded, NFKD, Arabic diacritics / tatweel removed (so آ, أ, إ, ۀ fold to their base letter)
 *   - Arabic ي / ى -> Persian ی, Arabic ك -> Persian ک, ة -> ه
 *   - Persian ۰–۹ and Arabic-Indic ٠–٩ digits -> 0–9
 *   - zero-width non-joiner / joiner and bidi marks removed (می‌خوام == میخوام)
 *   - punctuation and runs of whitespace -> one space
 * A query matches when every query word appears in the text, or in the text with its spaces removed
 * (so "می خوام" and "میخوام" both find «می‌خوام»).
 */
export function normalise(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[ً-ٰٟـ̀-ͯ]/g, '')
    .replace(/[​-‏‪-‮⁦-⁩﻿]/g, '')
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/ة/g, 'ه')
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\s\p{P}\p{S}]+/gu, ' ')
    .trim();
}

/** Every word of the (already normalised) query is in the (already normalised) text. */
export function matches(text: string, query: string): boolean {
  if (!query) return false;
  const compact = text.replace(/ /g, '');
  return query.split(' ').every((word) => text.includes(word) || compact.includes(word));
}

/** Lower is better: title prefix, title word, title anywhere, then artist / category only. */
function rank(title: string, query: string): number {
  if (title.startsWith(query)) return 0;
  if (title.includes(` ${query}`)) return 1;
  if (matches(title, query)) return 2;
  return 3;
}

function categoryText(category: Category): string {
  return `${category.name.en} ${category.name.fa ?? ''}`;
}

export interface SearchResults {
  tracks: Track[];
  stations: Category[];
}

/**
 * Search tracks (title, artist, station names in both languages) and stations (both names, plus
 * the localised "All music" label passed in). `stations` is the visible station list.
 */
export function searchLibrary(library: Library, stations: readonly Category[], rawQuery: string, allMusicLabel: string): SearchResults | null {
  const query = normalise(rawQuery);
  if (!query) return null;
  const names = new Map(library.categories.map((c) => [c.id, categoryText(c)] as const));
  const matchedStations = stations.filter((c) => matches(normalise(c.synthetic ? `${allMusicLabel} ${categoryText(c)}` : categoryText(c)), query));
  const scored: { track: Track; score: number; order: number }[] = [];
  library.tracks.forEach((track, order) => {
    const cats = track.categories.map((id) => names.get(id) ?? '').join(' ');
    if (!matches(normalise(`${track.title} ${track.artist} ${cats}`), query)) return;
    scored.push({ track, score: rank(normalise(track.title), query), order });
  });
  scored.sort((a, b) => a.score - b.score || a.order - b.order);
  return { tracks: scored.map((s) => s.track), stations: matchedStations };
}
