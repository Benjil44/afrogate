/**
 * Unit tests for the afrows ad-break rule (plan 06 §3 / Builder B acceptance 1–4, 7, 8).
 * Run: `node --test apps/web/test/ad-schedule.test.ts` (Node >= 22.18 strips the types; no build step).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EMPTY_COUNTERS,
  isBreakDue,
  markListening,
  parseAdFeed,
  readCounters,
  recordAdStart,
  recordNaturalEnd,
  serializeCounters,
  startBreak,
  type AdCounters,
  type AdFeed,
} from '../src/lib/ad-schedule.ts';

const BASE = 'https://media.borjino.com/music/';
const MIN = 60_000;
const T0 = Date.parse('2026-11-23T10:00:00Z');

function feed(settings: Record<string, unknown>, ads?: unknown[]): AdFeed {
  const parsed = parseAdFeed(
    {
      version: 1,
      settings: { every_n_tracks: 2, min_minutes_between: 60, per_break: 1, max_per_hour: 12, ...settings },
      ads: ads ?? [
        { id: 'a', url: 'ads/aaa.mp3', duration_ms: 20000, gain_db: -3 },
        { id: 'b', url: 'ads/bbb.mp3', duration_ms: 15000 },
      ],
    },
    BASE,
  );
  assert.ok(parsed);
  return parsed;
}

/** Simulate a natural end at `now`; returns the ads of the break (if any) and the new counters. */
function naturalEnd(f: AdFeed | null, c: AdCounters, now: number): { played: string[]; c: AdCounters } {
  const ended = recordNaturalEnd(c);
  const { ads, counters } = startBreak(f, ended, now);
  let next = counters;
  for (const _ of ads) next = recordAdStart(next, now);
  return { played: ads.map((a) => a.id), c: next };
}

test('acceptance 1: every_n_tracks=2 -> after natural ends 2, 4, 6; a manual next is not counted', () => {
  const f = feed({});
  let c = markListening(EMPTY_COUNTERS, T0);
  const breaks: number[] = [];
  // Manual next / previous / picks never reach recordNaturalEnd / startBreak (player.tsx), so only
  // natural ends are simulated here.
  for (let end = 1; end <= 6; end++) {
    const r = naturalEnd(f, c, T0 + end * MIN);
    c = r.c;
    if (r.played.length) breaks.push(end);
  }
  assert.deepEqual(breaks, [2, 4, 6]);
});

test('acceptance 2: nothing is due before the first track ends', () => {
  const f = feed({ min_minutes_between: 1 });
  const c = markListening(EMPTY_COUNTERS, T0);
  assert.equal(isBreakDue(f, c, T0 + 10 * 60 * MIN), false);
  assert.deepEqual(startBreak(f, c, T0 + 10 * 60 * MIN).ads, []);
});

test('minutes rule: one long track past min_minutes_between triggers a break', () => {
  const f = feed({ every_n_tracks: 5, min_minutes_between: 15 });
  const c = markListening(EMPTY_COUNTERS, T0);
  assert.deepEqual(naturalEnd(f, c, T0 + 14 * MIN).played, []);
  assert.deepEqual(naturalEnd(f, c, T0 + 15 * MIN).played, ['a']);
});

test('acceptance 3: max_per_hour holds, also across a reload (serialised counters)', () => {
  const f = feed({ every_n_tracks: 1, max_per_hour: 2 });
  let c = markListening(EMPTY_COUNTERS, T0);
  const played: string[] = [];
  for (let end = 1; end <= 2; end++) {
    const r = naturalEnd(f, c, T0 + end * MIN);
    played.push(...r.played);
    c = r.c;
  }
  assert.deepEqual(played, ['a', 'b']);
  c = readCounters(serializeCounters(c)); // reload
  assert.deepEqual(naturalEnd(f, c, T0 + 3 * MIN).played, []);
  assert.deepEqual(naturalEnd(f, c, T0 + 30 * MIN).played, []);
  // Once the first ad is older than 60 min one slot frees up.
  assert.deepEqual(naturalEnd(f, c, T0 + 61 * MIN + 1).played.length, 1);
});

test('max_per_hour=0 means no ads at all', () => {
  const f = feed({ every_n_tracks: 1, min_minutes_between: 1, max_per_hour: 0 });
  let c = markListening(EMPTY_COUNTERS, T0);
  for (let end = 1; end <= 5; end++) {
    const r = naturalEnd(f, c, T0 + end * 30 * MIN);
    assert.deepEqual(r.played, []);
    c = r.c;
  }
  assert.equal(isBreakDue(f, recordNaturalEnd(c), T0 + 10 * 60 * MIN), false);
});

test('per_break plays distinct ads round-robin and the hourly allowance can shorten it', () => {
  const ads = [
    { id: 'a', url: 'ads/a.mp3' },
    { id: 'b', url: 'ads/b.mp3' },
    { id: 'c', url: 'ads/c.mp3' },
  ];
  const f = feed({ every_n_tracks: 1, per_break: 2, max_per_hour: 3 }, ads);
  let c = markListening(EMPTY_COUNTERS, T0);
  let r = naturalEnd(f, c, T0 + MIN);
  assert.deepEqual(r.played, ['a', 'b']);
  r = naturalEnd(f, r.c, T0 + 2 * MIN);
  assert.deepEqual(r.played, ['c']); // only 1 left this hour
  c = r.c;
  r = naturalEnd(f, c, T0 + 62 * MIN);
  assert.deepEqual(r.played, ['a', 'b']);
});

test('acceptance 4: an ad outside its date window is never played', () => {
  const f = feed({ every_n_tracks: 1 }, [
    { id: 'past', url: 'ads/p.mp3', active_until: '2026-11-01T00:00:00Z' },
    { id: 'future', url: 'ads/f.mp3', active_from: '2026-12-01T00:00:00Z' },
    { id: 'now', url: 'ads/n.mp3', active_from: '2026-11-01T00:00:00Z', active_until: '2026-12-01T00:00:00Z' },
  ]);
  let c = markListening(EMPTY_COUNTERS, T0);
  for (let end = 1; end <= 4; end++) {
    const r = naturalEnd(f, c, T0 + end * MIN);
    assert.deepEqual(r.played, ['now']);
    c = r.c;
  }
  const onlyExpired = feed({ every_n_tracks: 1 }, [{ id: 'past', url: 'ads/p.mp3', active_until: '2026-11-01T00:00:00Z' }]);
  assert.deepEqual(naturalEnd(onlyExpired, markListening(EMPTY_COUNTERS, T0), T0 + MIN).played, []);
});

test('acceptance 5/7: absent, invalid, disabled or empty feed -> null (no ads, music as today)', () => {
  assert.equal(parseAdFeed(null, BASE), null);
  assert.equal(parseAdFeed('nope', BASE), null);
  assert.equal(parseAdFeed({ version: 2, settings: { every_n_tracks: 2, min_minutes_between: 15 }, ads: [{ id: 'a', url: 'ads/a.mp3' }] }, BASE), null);
  assert.equal(parseAdFeed({ settings: { every_n_tracks: 2, min_minutes_between: 15 }, ads: [] }, BASE), null);
  assert.equal(parseAdFeed({ settings: { enabled: false, every_n_tracks: 2, min_minutes_between: 15 }, ads: [{ id: 'a', url: 'ads/a.mp3' }] }, BASE), null);
  assert.equal(parseAdFeed({ settings: { every_n_tracks: 0, min_minutes_between: 15 }, ads: [{ id: 'a', url: 'ads/a.mp3' }] }, BASE), null);
  const c = recordNaturalEnd(recordNaturalEnd(markListening(EMPTY_COUNTERS, T0)));
  assert.equal(isBreakDue(null, c, T0 + 99 * MIN), false);
  assert.deepEqual(startBreak(null, c, T0 + 99 * MIN).ads, []);
});

test('feed validation: hostile URLs, too-long ads and bad ids are dropped; aliases accepted', () => {
  const f = parseAdFeed(
    {
      settings: { enabled: true, every_n_tracks: 2, min_minutes_between: 15, max_duration_s: 30 },
      ads: [
        { id: 'ok1', url: 'ads/0123abcd.mp3', duration_ms: 30000, gain_db: 6 },
        { id: 'ok2', file: 'ads/x.m4a', duration_s: 12 },
        { id: 'ok3', url: 'https://media.borjino.com/music/ads/y.mp3' },
        { id: 'long', url: 'ads/l.mp3', duration_s: 31 },
        { id: 'evil', url: 'https://evil.example/ads/e.mp3' },
        { id: 'trav', url: 'ads/../tracks.v2.json' },
        { id: 'js', url: 'javascript:alert(1)' },
        { id: 'bad id!', url: 'ads/b.mp3' },
        { id: 'gain', url: 'ads/g.mp3', gain_db: 99 },
        { id: 'ok1', url: 'ads/dup.mp3' },
      ],
    },
    BASE,
  );
  assert.ok(f);
  assert.deepEqual(f.ads.map((a) => a.id), ['ok1', 'ok2', 'ok3']);
  assert.equal(f.ads[0].src, 'https://media.borjino.com/music/ads/0123abcd.mp3');
  assert.ok(Math.abs(f.ads[0].gain - Math.pow(10, 6 / 20)) < 1e-9);
  assert.equal(f.ads[1].durationS, 12);
  assert.equal(f.settings.perBreak, 1);
  assert.equal(f.settings.maxPerHour, 4);
});

test('counters: corrupt storage starts fresh', () => {
  assert.deepEqual(readCounters('{oops'), EMPTY_COUNTERS);
  assert.deepEqual(readCounters(null), EMPTY_COUNTERS);
  assert.deepEqual(readCounters(JSON.stringify({ since: -4, lastAt: 'x', hist: [1, 'b', null], rr: 2 })), { since: 0, lastAt: 0, hist: [1], rr: 2 });
});
