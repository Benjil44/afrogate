import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLang, type Dict, type Lang } from '@/i18n';
import { useMotionTier } from '@/motion/provider';
import {
  ALL_STATION,
  isSameOrigin,
  loadLibrary,
  stationTracks,
  visibleStations,
  type Category,
  type Library,
  type Track,
} from './tracks';

/**
 * The one audio player behind the whole screen (stations, now playing, queue, transport, phone
 * mini bar + sheet). One `HTMLAudioElement` with `preload="none"` — nothing downloads until the
 * user presses play (streamed with range requests by the media host). No autoplay.
 *
 * Library: the manifest (v1 array or v2 object, see `tracks.ts`) loads once; "All music" is always
 * the first station. Selecting a station replaces the queue; shuffle reorders it (current first);
 * repeat is off / all / one. Volume + mute persist in localStorage.
 *
 * Visualizer: on the first user tap we lazily create an AudioContext + AnalyserNode — ONLY on the
 * `full` tier (desktop). While playing and visible it writes 8 band levels (`--lv0`..`--lv7`,
 * `--level`) to `<html>` once per frame; the equalizers read them in CSS (no React re-render per
 * frame). Phones keep a plain `<audio>` element so lock-screen / background playback survives.
 *
 * Crossfade (0.135.0): two `<audio>` elements; `audioRef` always points at the ACTIVE one (every
 * event handler ignores the other). Near the end of a track the next one starts on the spare element
 * at volume 0 and the two ramp over 3 s / 6 s (setting `afrows.crossfade`, default 3 s on the `full`
 * tier, off elsewhere). Skipped for repeat-one, the "end of track" sleep timer, and on browsers that
 * ignore element volume (iOS); if the browser refuses the second element's play(), the fade is undone
 * and the normal `ended` advance runs. Any user action (play another track, pause) ends a fade at once.
 *
 * Also here: sleep timer (15/30/60 min or end of track, in memory only) and the resume point
 * (`afrows.resume`: station, track, position; written every 5 s while playing and on pause).
 */
export const CHANNEL_KEYS = ['pop', 'traditional', 'rap', 'nostalgia', 'chill', 'podcast'] as const;
export type ChannelKey = (typeof CHANNEL_KEYS)[number];

/** CSS gradient art per palette slot — used when a track / station has no cover or colour. */
export const CHANNEL_ART: Record<ChannelKey, string> = {
  pop: 'linear-gradient(135deg, oklch(0.72 0.22 350) 0%, oklch(0.62 0.24 300) 55%, oklch(0.50 0.20 270) 100%)',
  traditional: 'linear-gradient(135deg, oklch(0.78 0.16 75) 0%, oklch(0.62 0.18 40) 55%, oklch(0.42 0.14 20) 100%)',
  rap: 'linear-gradient(135deg, oklch(0.30 0.03 280) 0%, oklch(0.55 0.22 25) 60%, oklch(0.80 0.17 85) 100%)',
  nostalgia: 'linear-gradient(135deg, oklch(0.80 0.14 60) 0%, oklch(0.68 0.17 25) 50%, oklch(0.45 0.12 330) 100%)',
  chill: 'linear-gradient(135deg, oklch(0.80 0.10 200) 0%, oklch(0.62 0.14 240) 55%, oklch(0.40 0.12 290) 100%)',
  podcast: 'linear-gradient(135deg, oklch(0.75 0.17 150) 0%, oklch(0.58 0.16 190) 55%, oklch(0.36 0.10 250) 100%)',
};

/** Gradient art by palette index (cycling). */
export function trackArt(index: number): string {
  return CHANNEL_ART[CHANNEL_KEYS[((index % CHANNEL_KEYS.length) + CHANNEL_KEYS.length) % CHANNEL_KEYS.length]];
}

/** Two-stop gradient from a validated `#RRGGBB` station colour, else the palette slot. */
export function stationArt(color: string | null, index: number): string {
  return color ? `linear-gradient(135deg, ${color} 0%, color-mix(in oklch, ${color} 45%, #0b0910) 100%)` : trackArt(index);
}

/** Display name of a station in the current language ("All music" comes from i18n). */
export function stationName(category: Category | undefined, lang: Lang, t: Dict): string {
  if (!category || category.synthetic) return t.player.allMusic;
  return (lang === 'fa' ? category.name.fa : null) ?? category.name.en;
}

/** Manifest load state. */
export type LibraryStatus = 'loading' | 'ready' | 'empty' | 'error';
export type RepeatMode = 'off' | 'all' | 'one';
/** `skipping`: the track failed and we move on in 3 s; `failed`: a second failure in a row, we stop. */
export type TrackIssue = 'skipping' | 'failed' | null;

/** Stand-in while the library loads or a station is empty, so consumers always have a `track`. */
export const NO_TRACK: Track = { id: 'none', title: '', artist: '', src: '', durationSec: null, cover: null, categories: [] };
const EMPTY_LIBRARY: Library = { categories: [], tracks: [] };
const SKIP_DELAY_MS = 3000;
const VOLUME_KEY = 'afrows.volume';
const MUTED_KEY = 'afrows.muted';
const CROSSFADE_KEY = 'afrows.crossfade';
const RESUME_KEY = 'afrows.resume';
const RESUME_SAVE_MS = 5000;
const FADE_STEP_MS = 100;
const STATION_ID = /^[a-z0-9_-]{1,40}$/;
const TRACK_ID = /^[A-Za-z0-9_-]{1,64}$/;

/** Crossfade length in seconds (0 = off). */
export type Crossfade = 0 | 3 | 6;
export const CROSSFADE_OPTIONS: readonly Crossfade[] = [0, 3, 6];
/** Sleep timer: minutes, end of the current track, or off. */
export type SleepMode = 'off' | 15 | 30 | 60 | 'track';
export const SLEEP_OPTIONS: readonly SleepMode[] = ['off', 15, 30, 60, 'track'];
export interface SleepState {
  mode: SleepMode;
  /** Epoch ms when a minutes timer pauses playback, else null. */
  endsAt: number | null;
}
/** Where the listener stopped last time (resolved against the current library). */
export interface ResumePoint {
  stationId: string;
  track: Track;
  /** Seconds into the track. */
  position: number;
}

interface PlayerState {
  library: Library;
  status: LibraryStatus;
  /** Fetch the manifest again (after an error). */
  reload: () => void;
  /** Stations with at least one track ("All music" first). */
  stations: readonly Category[];
  stationId: string;
  /** Undefined when a deep link names an unknown station. */
  station: Category | undefined;
  /** Palette index of the current station (fallback art). */
  stationIndex: number;
  queue: readonly Track[];
  position: number;
  /** Current track, or `NO_TRACK` when the queue is empty. */
  track: Track;
  playing: boolean;
  /** Buffering (`waiting` / `loadstart`) — shown inside the Play button only. */
  loading: boolean;
  /** play() was refused by the autoplay policy: the UI asks for a first tap. */
  blocked: boolean;
  /** At least one play was requested this session. */
  started: boolean;
  issue: TrackIssue;
  /** Track ids that failed to load this session ("Unavailable" in lists). */
  failed: ReadonlySet<string>;
  online: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  volume: number;
  muted: boolean;
  /** Durations learned from `loadedmetadata`, by track id. */
  durations: Readonly<Record<string, number>>;
  toggle: () => void;
  pause: () => void;
  next: () => void;
  prev: () => void;
  seek: (seconds: number) => void;
  seekBy: (delta: number) => void;
  /** Play the queue entry at `position`; re-tapping the playing entry pauses it. */
  jumpTo: (position: number) => void;
  /** Make `id` the current station (radio-like: if music is playing, the new station starts). */
  selectStation: (id: string) => void;
  /** Make `id` the current station and start it (at `trackId` when given). */
  playStation: (id: string, trackId?: string) => void;
  /** Turn shuffle on and start station `id` from a random track. */
  shuffleStation: (id: string) => void;
  /** Deep link: put track `id` in the queue as the current entry WITHOUT playing (no autoplay). */
  cueTrack: (id: string) => void;
  /** Last session's stop point, when it still exists in the library. */
  resumePoint: ResumePoint | null;
  /** Continue from `resumePoint` (user gesture). */
  resume: () => void;
  sleep: SleepState;
  setSleep: (mode: SleepMode) => void;
  crossfade: Crossfade;
  setCrossfade: (seconds: Crossfade) => void;
  /** False where element volume is read-only (iOS): crossfade is unavailable there. */
  crossfadeSupported: boolean;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  retryTrack: () => void;
}

interface ProgressState {
  currentTime: number;
  duration: number;
}

const PlayerContext = createContext<PlayerState | null>(null);
const ProgressContext = createContext<ProgressState>({ currentTime: 0, duration: 0 });

const BANDS = 8;
/** Frequency-bin edges for fftSize 128 (64 bins, ~344 Hz each at 44.1 kHz): wider bands as pitch rises. */
const BAND_EDGES = [0, 1, 2, 3, 5, 8, 13, 21, 34];

interface Analysis {
  context: AudioContext;
  analyser: AnalyserNode;
  data: Uint8Array<ArrayBuffer>;
  /** Per-element gain (user volume × crossfade): browsers differ on whether element volume reaches Web Audio. */
  gains: Map<HTMLAudioElement, GainNode>;
}

function createAnalysis(audios: readonly HTMLAudioElement[]): Analysis | null {
  if (typeof AudioContext === 'undefined') return null;
  try {
    const context = new AudioContext();
    const analyser = context.createAnalyser();
    analyser.fftSize = 128;
    analyser.smoothingTimeConstant = 0.8;
    // Both crossfade elements feed the same analyser (the mix is what is heard), each through its own gain.
    const gains = new Map<HTMLAudioElement, GainNode>();
    for (const audio of audios) {
      const gain = context.createGain();
      context.createMediaElementSource(audio).connect(gain);
      gain.connect(analyser);
      gains.set(audio, gain);
    }
    analyser.connect(context.destination);
    return { context, analyser, data: new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount)), gains };
  } catch {
    return null;
  }
}

function writeLevels(root: HTMLElement, analysis: Analysis | null) {
  let sum = 0;
  for (let b = 0; b < BANDS; b++) {
    let level = 0;
    if (analysis) {
      let acc = 0;
      for (let i = BAND_EDGES[b]; i < BAND_EDGES[b + 1]; i++) acc += analysis.data[i];
      // Byte data sits near 255 in the bass bins of loud mixes; a >1 exponent keeps the dynamics visible.
      level = Math.min(1, Math.pow(acc / (BAND_EDGES[b + 1] - BAND_EDGES[b]) / 255, 1.6));
    }
    sum += level;
    root.style.setProperty(`--lv${b}`, level.toFixed(3));
  }
  root.style.setProperty('--level', (sum / BANDS).toFixed(3));
}

/** Fisher–Yates copy; `firstId` (the current track) stays at the front. */
function shuffled(list: readonly Track[], firstId?: string): Track[] {
  const rest = list.filter((t) => t.id !== firstId);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  const first = firstId ? list.find((t) => t.id === firstId) : undefined;
  return first ? [first, ...rest] : rest;
}

function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode / blocked storage — the player still works */
  }
}

function initialVolume(): number {
  const v = Number(readStored(VOLUME_KEY));
  return readStored(VOLUME_KEY) !== null && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1;
}

function readCrossfade(): Crossfade | null {
  const v = Number(readStored(CROSSFADE_KEY));
  return readStored(CROSSFADE_KEY) !== null && (CROSSFADE_OPTIONS as readonly number[]).includes(v) ? (v as Crossfade) : null;
}

interface StoredResume {
  s: string;
  t: string;
  p: number;
}

function readResume(): StoredResume | null {
  try {
    const raw: unknown = JSON.parse(readStored(RESUME_KEY) ?? 'null');
    if (!raw || typeof raw !== 'object') return null;
    const { s, t, p } = raw as Record<string, unknown>;
    if (typeof s !== 'string' || !STATION_ID.test(s) || typeof t !== 'string' || !TRACK_ID.test(t)) return null;
    const pos = typeof p === 'number' && Number.isFinite(p) && p >= 0 && p <= 12 * 3600 ? Math.floor(p) : 0;
    return { s, t, p: pos };
  } catch {
    return null;
  }
}

/** iOS ignores (and reads back 1 for) element volume: no volume ramps there. */
function probeVolumeControl(): boolean {
  if (typeof Audio === 'undefined') return false;
  try {
    const probe = new Audio();
    probe.volume = 0.5;
    return Math.abs(probe.volume - 0.5) < 0.01;
  } catch {
    return false;
  }
}

function isOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const tier = useMotionTier();
  const { lang, t } = useLang();
  /** The ACTIVE element (swapped by a crossfade). */
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audiosRef = useRef<[HTMLAudioElement, HTMLAudioElement] | null>(null);
  /** Crossfade gain per element (multiplied with the user volume). */
  const gainsRef = useRef(new WeakMap<HTMLAudioElement, number>());
  const fadeRef = useRef<{ outgoing: HTMLAudioElement; timer: number } | null>(null);
  const pendingSeekRef = useRef<{ id: string; position: number } | null>(null);
  const analysisRef = useRef<Analysis | null>(null);

  const [library, setLibrary] = useState<Library>(EMPTY_LIBRARY);
  const [status, setStatus] = useState<LibraryStatus>('loading');
  const [attempt, setAttempt] = useState(0);
  const statusRef = useRef(status);
  statusRef.current = status;
  const libraryRef = useRef(library);
  libraryRef.current = library;

  const [stationId, setStationId] = useState<string>(ALL_STATION);
  const [queue, setQueue] = useState<readonly Track[]>([]);
  const [position, setPosition] = useState(0);
  const queueRef = useRef(queue);
  const positionRef = useRef(position);
  const stationRef = useRef(stationId);
  /** Id of the track whose URL is on the audio element. */
  const loadedIdRef = useRef<string | null>(null);

  const [playing, setPlaying] = useState(false);
  const playingRef = useRef(false);
  playingRef.current = playing;
  const [loading, setLoading] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [started, setStarted] = useState(false);
  const [issue, setIssue] = useState<TrackIssue>(null);
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set());
  const [online, setOnline] = useState(isOnline);
  /** The listener wants music (cleared by pause / end of queue) — used to resume after `online`. */
  const wantPlayRef = useRef(false);
  const errorStreakRef = useRef(0);
  const skipTimerRef = useRef(0);

  const [shuffle, setShuffle] = useState(false);
  const shuffleRef = useRef(shuffle);
  shuffleRef.current = shuffle;
  const [repeat, setRepeat] = useState<RepeatMode>('off');
  const repeatRef = useRef(repeat);
  repeatRef.current = repeat;
  const [volume, setVolumeState] = useState(initialVolume);
  const [muted, setMuted] = useState(() => readStored(MUTED_KEY) === '1');
  const volumeRef = useRef(volume);
  volumeRef.current = volume;
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  const [crossfadeSupported] = useState(probeVolumeControl);
  const [storedCrossfade, setStoredCrossfade] = useState<Crossfade | null>(readCrossfade);
  const crossfade: Crossfade = crossfadeSupported ? (storedCrossfade ?? (tier === 'full' ? 3 : 0)) : 0;
  const crossfadeRef = useRef(crossfade);
  crossfadeRef.current = crossfade;
  /** Cleared for the session when the browser refuses to start the second element. */
  const fadeAllowedRef = useRef(true);

  const [sleep, setSleepState] = useState<SleepState>({ mode: 'off', endsAt: null });
  const sleepRef = useRef(sleep);
  sleepRef.current = sleep;
  const [savedResume] = useState(readResume);

  const [durations, setDurations] = useState<Record<string, number>>({});
  const [progress, setProgress] = useState<ProgressState>({ currentTime: 0, duration: 0 });

  const commitQueue = useCallback((list: readonly Track[], pos: number) => {
    queueRef.current = list;
    positionRef.current = pos;
    setQueue(list);
    setPosition(pos);
  }, []);

  // The library is read from the manifest at runtime (one small JSON request, no audio).
  useEffect(() => {
    const controller = new AbortController();
    setStatus('loading');
    loadLibrary(controller.signal)
      .then((lib) => {
        setLibrary(lib);
        libraryRef.current = lib;
        setStatus(lib.tracks.length ? 'ready' : 'empty');
        const list = stationTracks(lib, stationRef.current);
        commitQueue(shuffleRef.current ? shuffled(list) : list, 0);
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus('error');
      });
    return () => controller.abort();
  }, [attempt, commitQueue]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  const getAudios = useCallback((): [HTMLAudioElement, HTMLAudioElement] => {
    if (!audiosRef.current) {
      const make = () => {
        const audio = new Audio();
        audio.preload = 'none';
        return audio;
      };
      audiosRef.current = [make(), make()];
      audioRef.current = audiosRef.current[0];
    }
    return audiosRef.current;
  }, []);

  const getAudio = useCallback(() => {
    getAudios();
    return audioRef.current as HTMLAudioElement;
  }, [getAudios]);

  /**
   * Level = user volume × crossfade gain (clamped; element `volume` throws outside 0..1). With the
   * desktop analyser graph the level goes on the element's GainNode and the element stays at 1, so it
   * is applied exactly once whatever the browser does with element volume under Web Audio.
   */
  const applyVolume = useCallback((audio: HTMLAudioElement) => {
    const level = Math.min(1, Math.max(0, volumeRef.current * (gainsRef.current.get(audio) ?? 1)));
    const node = analysisRef.current?.gains.get(audio);
    if (node) {
      node.gain.value = mutedRef.current ? 0 : level;
      audio.volume = 1;
    } else {
      audio.volume = level;
    }
    audio.muted = mutedRef.current;
  }, []);

  const setGain = useCallback(
    (audio: HTMLAudioElement, gain: number) => {
      gainsRef.current.set(audio, gain);
      applyVolume(audio);
    },
    [applyVolume],
  );

  /** End a running crossfade now: stop and unload the outgoing element, full gain on the active one. */
  const finishFade = useCallback(() => {
    const fade = fadeRef.current;
    if (!fade) return;
    fadeRef.current = null;
    window.clearInterval(fade.timer);
    fade.outgoing.pause();
    fade.outgoing.removeAttribute('src');
    fade.outgoing.load();
    setGain(fade.outgoing, 1);
    if (audioRef.current) setGain(audioRef.current, 1);
  }, [setGain]);

  const clearIssue = useCallback(() => {
    window.clearTimeout(skipTimerRef.current);
    skipTimerRef.current = 0;
    setIssue(null);
  }, []);

  /** Load (if needed) and play queue entry `pos`. Must run inside a user gesture the first time. */
  const startTrack = useCallback(
    (pos: number) => {
      const track = queueRef.current[pos];
      if (!track) return;
      finishFade();
      if (pendingSeekRef.current && pendingSeekRef.current.id !== track.id) pendingSeekRef.current = null;
      const audio = getAudio();
      window.clearTimeout(skipTimerRef.current);
      skipTimerRef.current = 0;
      if (pos !== positionRef.current) {
        positionRef.current = pos;
        setPosition(pos);
      }
      if (loadedIdRef.current !== track.id || !audio.currentSrc) {
        loadedIdRef.current = track.id;
        setProgress({ currentTime: 0, duration: track.durationSec ?? 0 });
        // Cross-origin media (the Borjino share) is fetched in CORS mode so Web Audio may read it;
        // the media host must send Access-Control-Allow-Origin for afrows.com.
        audio.crossOrigin = isSameOrigin(track.src) ? null : 'anonymous';
        audio.src = track.src;
      }
      // Analyser: created on the first user tap (autoplay policy), and ONLY on desktop (`full` tier: wide screen +
      // fine pointer). Routing the element through Web Audio ties playback to the AudioContext, which mobile browsers
      // suspend when the screen locks or the tab is hidden, so the music stopped on lock. Phones/tablets keep a plain
      // <audio> element (background + lock-screen playback; equalizers use the CSS beat).
      if (!analysisRef.current && tier === 'full') {
        analysisRef.current = createAnalysis(getAudios());
        for (const element of getAudios()) applyVolume(element);
      }
      const ctx = analysisRef.current?.context;
      if (ctx && ctx.state === 'suspended') void ctx.resume();
      wantPlayRef.current = true;
      setStarted(true);
      setLoading(true);
      audio.play().then(
        () => setBlocked(false),
        (err: unknown) => {
          const name = err && typeof err === 'object' && 'name' in err ? String((err as { name: unknown }).name) : '';
          if (name === 'AbortError') return; // superseded by a newer src / pause
          setLoading(false);
          setPlaying(false);
          // Autoplay policy: stay paused, no error tone; the next tap on Play starts it.
          if (name === 'NotAllowedError') setBlocked(true);
          // Media / network failures also fire the element's `error` event, handled below.
        },
      );
    },
    [applyVolume, finishFade, getAudio, getAudios, tier],
  );

  const pause = useCallback(() => {
    wantPlayRef.current = false;
    finishFade();
    audioRef.current?.pause();
  }, [finishFade]);

  const toggle = useCallback(() => {
    clearIssue();
    if (playingRef.current) pause();
    else startTrack(positionRef.current);
  }, [clearIssue, pause, startTrack]);

  /** `manual`: user pressed Next (wraps at the end); automatic advance obeys repeat. */
  const advance = useCallback(
    (manual: boolean) => {
      const count = queueRef.current.length;
      if (!count) return;
      const pos = positionRef.current;
      if (pos < count - 1) startTrack(pos + 1);
      else if (manual || repeatRef.current === 'all') startTrack(0);
      else {
        wantPlayRef.current = false;
        setPlaying(false);
      }
    },
    [startTrack],
  );

  const next = useCallback(() => {
    clearIssue();
    advance(true);
  }, [advance, clearIssue]);

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current;
    // Only the loaded track can be scrubbed (after a station switch the element may still hold the old one).
    if (!audio || !Number.isFinite(audio.duration) || loadedIdRef.current !== queueRef.current[positionRef.current]?.id) return;
    audio.currentTime = Math.max(0, Math.min(audio.duration, seconds));
    setProgress((p) => ({ ...p, currentTime: audio.currentTime }));
  }, []);

  const seekBy = useCallback((delta: number) => seek((audioRef.current?.currentTime ?? 0) + delta), [seek]);

  const prev = useCallback(() => {
    clearIssue();
    const audio = audioRef.current;
    // Classic player behaviour: a few seconds in, Previous restarts the current track.
    if (audio && audio.currentTime > 3 && loadedIdRef.current === queueRef.current[positionRef.current]?.id) {
      seek(0);
      return;
    }
    const count = queueRef.current.length;
    if (count) startTrack((positionRef.current - 1 + count) % count);
  }, [clearIssue, seek, startTrack]);

  const jumpTo = useCallback(
    (pos: number) => {
      clearIssue();
      if (pos === positionRef.current && playingRef.current) pause();
      else startTrack(pos);
    },
    [clearIssue, pause, startTrack],
  );

  const buildQueue = useCallback((id: string, keepId?: string) => {
    const list = stationTracks(libraryRef.current, id);
    return shuffleRef.current ? shuffled(list, keepId && list.some((t) => t.id === keepId) ? keepId : undefined) : list;
  }, []);

  const selectStation = useCallback(
    (id: string) => {
      clearIssue();
      const currentId = loadedIdRef.current ?? undefined;
      const list = buildQueue(id, currentId);
      stationRef.current = id;
      setStationId(id);
      const keep = currentId ? list.findIndex((t) => t.id === currentId) : -1;
      if (keep >= 0) {
        // The current track belongs to the new station too: keep playing it, just swap the queue.
        commitQueue(list, keep);
        return;
      }
      commitQueue(list, 0);
      if (playingRef.current && list.length) startTrack(0);
      else {
        if (playingRef.current) pause();
        setProgress({ currentTime: 0, duration: list[0]?.durationSec ?? 0 });
      }
    },
    [buildQueue, clearIssue, commitQueue, pause, startTrack],
  );

  const playStation = useCallback(
    (id: string, trackId?: string) => {
      clearIssue();
      const list = buildQueue(id, trackId);
      stationRef.current = id;
      setStationId(id);
      const pos = trackId ? Math.max(0, list.findIndex((t) => t.id === trackId)) : 0;
      commitQueue(list, pos);
      startTrack(pos);
    },
    [buildQueue, clearIssue, commitQueue, startTrack],
  );

  const shuffleStation = useCallback(
    (id: string) => {
      clearIssue();
      shuffleRef.current = true;
      setShuffle(true);
      const list = shuffled(stationTracks(libraryRef.current, id));
      stationRef.current = id;
      setStationId(id);
      commitQueue(list, 0);
      startTrack(0);
    },
    [clearIssue, commitQueue, startTrack],
  );

  const cueTrack = useCallback(
    (id: string) => {
      if (playingRef.current) return;
      const lib = libraryRef.current;
      const track = lib.tracks.find((t) => t.id === id);
      if (!track) return;
      // Keep the current station when it holds the track, else "All music".
      const sid = stationTracks(lib, stationRef.current).some((t) => t.id === id) ? stationRef.current : ALL_STATION;
      const list = buildQueue(sid, id);
      stationRef.current = sid;
      setStationId(sid);
      const pos = Math.max(0, list.findIndex((t) => t.id === id));
      commitQueue(list, pos);
      if (loadedIdRef.current !== id) setProgress({ currentTime: 0, duration: track.durationSec ?? 0 });
    },
    [buildQueue, commitQueue],
  );

  const toggleShuffle = useCallback(() => {
    const current = queueRef.current[positionRef.current];
    const nextShuffle = !shuffleRef.current;
    shuffleRef.current = nextShuffle;
    setShuffle(nextShuffle);
    const list = stationTracks(libraryRef.current, stationRef.current);
    const ordered = nextShuffle ? shuffled(list, current?.id) : list;
    commitQueue(ordered, current ? Math.max(0, ordered.findIndex((t) => t.id === current.id)) : 0);
  }, [commitQueue]);

  const cycleRepeat = useCallback(() => setRepeat((r) => (r === 'off' ? 'all' : r === 'all' ? 'one' : 'off')), []);

  const setVolume = useCallback((v: number) => {
    const clamped = Math.min(1, Math.max(0, Number.isFinite(v) ? v : 1));
    setVolumeState(clamped);
    if (clamped > 0) setMuted(false);
  }, []);

  const toggleMute = useCallback(() => setMuted((m) => !m), []);

  const retryTrack = useCallback(() => {
    const track = queueRef.current[positionRef.current];
    if (!track) return;
    clearIssue();
    errorStreakRef.current = 0;
    setFailed((f) => {
      if (!f.has(track.id)) return f;
      const copy = new Set(f);
      copy.delete(track.id);
      return copy;
    });
    loadedIdRef.current = null; // force a fresh `src`
    startTrack(positionRef.current);
  }, [clearIssue, startTrack]);

  // Volume / mute -> element + storage. (iOS ignores element volume; hardware keys rule there.)
  useEffect(() => {
    for (const audio of getAudios()) applyVolume(audio);
    writeStored(VOLUME_KEY, volume.toFixed(2));
    writeStored(MUTED_KEY, muted ? '1' : '0');
  }, [getAudios, applyVolume, volume, muted]);

  /** Remember where the listener is (station, track, position) for "Continue listening". */
  const saveResume = useCallback(() => {
    const audio = audioRef.current;
    const id = loadedIdRef.current;
    if (!audio || !id || !TRACK_ID.test(id)) return;
    writeStored(RESUME_KEY, JSON.stringify({ s: stationRef.current, t: id, p: Math.floor(audio.currentTime || 0) }));
  }, []);

  /** Queue position the automatic advance would play next, or -1 (end of queue, repeat off). */
  const nextAutoPosition = useCallback((): number => {
    const count = queueRef.current.length;
    const pos = positionRef.current;
    if (pos < count - 1) return pos + 1;
    return repeatRef.current === 'all' && count > 0 ? 0 : -1;
  }, []);

  /** Start queue entry `pos` on the spare element and ramp the two over `seconds`. */
  const startCrossfade = useCallback(
    (pos: number, seconds: number) => {
      const outgoing = audioRef.current;
      const track = queueRef.current[pos];
      if (!outgoing || !track) return;
      const [a, b] = getAudios();
      const incoming = outgoing === a ? b : a;
      const prevPos = positionRef.current;
      const prevId = loadedIdRef.current;
      const fade = { outgoing, timer: 0 };
      fadeRef.current = fade;
      audioRef.current = incoming;
      loadedIdRef.current = track.id;
      positionRef.current = pos;
      setPosition(pos);
      setProgress({ currentTime: 0, duration: track.durationSec ?? 0 });
      setGain(incoming, 0);
      incoming.crossOrigin = isSameOrigin(track.src) ? null : 'anonymous';
      incoming.src = track.src;
      const startedAt = performance.now();
      fade.timer = window.setInterval(() => {
        const k = Math.min(1, (performance.now() - startedAt) / (seconds * 1000));
        setGain(incoming, k);
        setGain(outgoing, 1 - k);
        if (k >= 1 && fadeRef.current === fade) finishFade();
      }, FADE_STEP_MS);
      incoming.play().catch((err: unknown) => {
        const name = err && typeof err === 'object' && 'name' in err ? String((err as { name: unknown }).name) : '';
        if (name === 'AbortError' || fadeRef.current !== fade) return;
        // The browser refused a second element: undo, let the outgoing track end and advance normally.
        fadeAllowedRef.current = false;
        fadeRef.current = null;
        window.clearInterval(fade.timer);
        incoming.removeAttribute('src');
        incoming.load();
        setGain(incoming, 1);
        setGain(outgoing, 1);
        audioRef.current = outgoing;
        loadedIdRef.current = prevId;
        positionRef.current = prevPos;
        setPosition(prevPos);
        setLoading(false);
        setPlaying(!outgoing.paused);
      });
    },
    [finishFade, getAudios, setGain],
  );

  // Audio element events -> React state. Both elements are wired; only the ACTIVE one counts.
  useEffect(() => {
    const unbinds = getAudios().map((audio) => {
      let lastPosition = 0;
      let lastSave = 0;
      const active = () => audio === audioRef.current;
      const onPlay = () => {
        if (active()) setPlaying(true);
      };
      const onPause = () => {
        if (!active()) return;
        setPlaying(false);
        setLoading(false);
        saveResume();
      };
      const onWaiting = () => {
        if (active()) setLoading(true);
      };
      const onPlaying = () => {
        if (!active()) return;
        setLoading(false);
        setBlocked(false);
        errorStreakRef.current = 0;
      };
      const onCanPlay = () => {
        if (active()) setLoading(false);
      };
      const onMeta = () => {
        const id = loadedIdRef.current;
        if (!active() || !id || !Number.isFinite(audio.duration)) return;
        // "Continue listening": jump to the saved position once the track's metadata is known.
        const pending = pendingSeekRef.current;
        if (pending && pending.id === id) {
          pendingSeekRef.current = null;
          if (pending.position < audio.duration - 10) audio.currentTime = pending.position;
        }
        setDurations((d) => (d[id] === audio.duration ? d : { ...d, [id]: audio.duration }));
        setProgress({ currentTime: audio.currentTime, duration: audio.duration });
      };
      const onTime = () => {
        if (!active()) return;
        const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
        setProgress({ currentTime: audio.currentTime, duration });
        const now = Date.now();
        // Sleep timer (also checked here: background tabs throttle timeouts).
        const sleepState = sleepRef.current;
        if (sleepState.endsAt !== null && now >= sleepState.endsAt) {
          setSleepState({ mode: 'off', endsAt: null });
          wantPlayRef.current = false;
          finishFade();
          audio.pause();
          return;
        }
        if (now - lastSave >= RESUME_SAVE_MS) {
          lastSave = now;
          saveResume();
        }
        // Lock-screen scrubber, at most once per second.
        const session = typeof navigator !== 'undefined' ? navigator.mediaSession : undefined;
        if (session && 'setPositionState' in session && now - lastPosition >= 1000 && duration > 0) {
          lastPosition = now;
          try {
            session.setPositionState({ duration, position: Math.min(audio.currentTime, duration), playbackRate: audio.playbackRate || 1 });
          } catch {
            /* unsupported */
          }
        }
        // Crossfade into the next track near the end of this one.
        const seconds = crossfadeRef.current;
        if (
          seconds > 0 &&
          fadeAllowedRef.current &&
          !fadeRef.current &&
          wantPlayRef.current &&
          !audio.paused &&
          repeatRef.current !== 'one' &&
          sleepRef.current.mode !== 'track' &&
          duration > seconds * 3 &&
          duration - audio.currentTime <= seconds
        ) {
          const nextPos = nextAutoPosition();
          const nextTrack = nextPos >= 0 ? queueRef.current[nextPos] : undefined;
          if (nextTrack && nextTrack.id !== loadedIdRef.current) startCrossfade(nextPos, seconds);
        }
      };
      const onEnded = () => {
        if (!active()) return;
        if (sleepRef.current.mode === 'track') {
          setSleepState({ mode: 'off', endsAt: null });
          wantPlayRef.current = false;
          setPlaying(false);
          return;
        }
        if (repeatRef.current === 'one') {
          audio.currentTime = 0;
          void audio.play().catch(() => setPlaying(false));
          return;
        }
        advance(false);
      };
      const onError = () => {
        if (!active()) return;
        setLoading(false);
        setPlaying(false);
        // Offline: not the track's fault. Keep it; resume when the connection returns.
        if (!isOnline()) return;
        const id = loadedIdRef.current;
        if (id) setFailed((f) => (f.has(id) ? f : new Set(f).add(id)));
        if (errorStreakRef.current === 0) {
          errorStreakRef.current = 1;
          setIssue('skipping');
          window.clearTimeout(skipTimerRef.current);
          skipTimerRef.current = window.setTimeout(() => {
            skipTimerRef.current = 0;
            setIssue(null);
            if (queueRef.current.length > 1) advance(true);
            else setIssue('failed');
          }, SKIP_DELAY_MS);
        } else {
          wantPlayRef.current = false;
          setIssue('failed');
        }
      };
      const events: [string, () => void][] = [
        ['play', onPlay],
        ['pause', onPause],
        ['waiting', onWaiting],
        ['loadstart', onWaiting],
        ['playing', onPlaying],
        ['canplay', onCanPlay],
        ['loadedmetadata', onMeta],
        ['durationchange', onMeta],
        ['timeupdate', onTime],
        ['ended', onEnded],
        ['error', onError],
      ];
      for (const [name, handler] of events) audio.addEventListener(name, handler);
      return () => {
        for (const [name, handler] of events) audio.removeEventListener(name, handler);
      };
    });
    return () => unbinds.forEach((unbind) => unbind());
  }, [getAudios, advance, finishFade, nextAutoPosition, saveResume, startCrossfade]);

  // Leaving the page: keep the exact stop point.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') saveResume();
    };
    window.addEventListener('pagehide', saveResume);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pagehide', saveResume);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [saveResume]);

  useEffect(
    () => () => {
      const fade = fadeRef.current;
      if (fade) window.clearInterval(fade.timer);
    },
    [],
  );

  const setSleep = useCallback((mode: SleepMode) => {
    setSleepState({ mode, endsAt: typeof mode === 'number' ? Date.now() + mode * 60_000 : null });
  }, []);

  // Minutes timer: pause when it runs out (onTime re-checks it in throttled background tabs).
  useEffect(() => {
    if (sleep.endsAt === null) return;
    const timer = window.setTimeout(() => {
      setSleepState({ mode: 'off', endsAt: null });
      pause();
    }, Math.max(0, sleep.endsAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [sleep, pause]);

  const setCrossfade = useCallback((seconds: Crossfade) => {
    setStoredCrossfade(seconds);
    writeStored(CROSSFADE_KEY, String(seconds));
    if (seconds > 0) fadeAllowedRef.current = true;
  }, []);

  const resumePoint = useMemo<ResumePoint | null>(() => {
    if (!savedResume || status !== 'ready') return null;
    const track = library.tracks.find((x) => x.id === savedResume.t);
    if (!track) return null;
    const inStation = stationTracks(library, savedResume.s).some((x) => x.id === track.id);
    return { stationId: inStation ? savedResume.s : ALL_STATION, track, position: savedResume.p };
  }, [savedResume, status, library]);

  const resume = useCallback(() => {
    if (!resumePoint) return;
    const { stationId: sid, track, position: at } = resumePoint;
    const audio = audioRef.current;
    if (audio && loadedIdRef.current === track.id && Number.isFinite(audio.duration)) {
      if (at < audio.duration - 10) audio.currentTime = at;
    } else {
      pendingSeekRef.current = at > 0 ? { id: track.id, position: at } : null;
    }
    playStation(sid, track.id);
  }, [resumePoint, playStation]);

  useEffect(() => () => window.clearTimeout(skipTimerRef.current), []);

  // Connectivity: offline notice; on `online` retry a failed manifest and resume wanted playback.
  useEffect(() => {
    const onOnline = () => {
      setOnline(true);
      if (statusRef.current === 'error') setAttempt((n) => n + 1);
      const audio = audioRef.current;
      if (audio && wantPlayRef.current && audio.paused) {
        if (audio.error) audio.load();
        void audio.play().catch(() => undefined);
      }
    };
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // `.is-playing` on <html> drives every CSS beat loop (equalizers).
  useEffect(() => {
    document.documentElement.classList.toggle('is-playing', playing);
  }, [playing]);

  // Analyser loop: one frame -> 8 CSS custom properties. Stops when paused, hidden or on `static`.
  useEffect(() => {
    const root = document.documentElement;
    const analysis = analysisRef.current;
    if (!playing || !analysis || tier === 'static') {
      root.classList.remove('is-live');
      return;
    }
    let raf = 0;
    const frame = () => {
      raf = 0;
      if (document.hidden) return;
      analysis.analyser.getByteFrequencyData(analysis.data);
      writeLevels(root, analysis);
      raf = requestAnimationFrame(frame);
    };
    const onVisibility = () => {
      if (!document.hidden && !raf) raf = requestAnimationFrame(frame);
    };
    root.classList.add('is-live');
    document.addEventListener('visibilitychange', onVisibility);
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVisibility);
      root.classList.remove('is-live');
      writeLevels(root, null);
    };
  }, [playing, tier]);

  const track = queue[position] ?? NO_TRACK;
  const station = library.categories.find((c) => c.id === stationId);
  const stations = useMemo(() => visibleStations(library), [library]);
  const stationIndex = Math.max(0, stations.findIndex((c) => c.id === stationId));
  const album = stationName(station, lang, t);

  // Lock-screen / headset metadata: title, artist, album = station, artwork = cover.
  useEffect(() => {
    const session = typeof navigator !== 'undefined' ? navigator.mediaSession : undefined;
    if (!session || typeof MediaMetadata === 'undefined' || track === NO_TRACK) return;
    const art = track.cover ?? station?.cover ?? null;
    session.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist,
      album,
      artwork: art ? [{ src: art, sizes: '512x512' }] : [],
    });
  }, [track, station, album]);

  useEffect(() => {
    const session = typeof navigator !== 'undefined' ? navigator.mediaSession : undefined;
    if (session) session.playbackState = playing ? 'playing' : 'paused';
  }, [playing]);

  useEffect(() => {
    const session = typeof navigator !== 'undefined' ? navigator.mediaSession : undefined;
    if (!session) return;
    const handlers: [MediaSessionAction, MediaSessionActionHandler | null][] = [
      ['play', () => startTrack(positionRef.current)],
      ['pause', pause],
      ['previoustrack', prev],
      ['nexttrack', next],
      // Lock-screen scrubbing and ±10 s buttons (the audio keeps playing in the background on phones).
      ['seekto', (details) => { if (typeof details.seekTime === 'number') seek(details.seekTime); }],
      ['seekbackward', (details) => seekBy(-(details.seekOffset ?? 10))],
      ['seekforward', (details) => seekBy(details.seekOffset ?? 10)],
    ];
    for (const [action, handler] of handlers) {
      try {
        session.setActionHandler(action, handler);
      } catch {
        /* unsupported action */
      }
    }
    return () => {
      for (const [action] of handlers) {
        try {
          session.setActionHandler(action, null);
        } catch {
          /* unsupported action */
        }
      }
    };
  }, [startTrack, pause, prev, next, seek, seekBy]);

  const value = useMemo<PlayerState>(
    () => ({
      library,
      status,
      reload,
      stations,
      stationId,
      station,
      stationIndex,
      queue,
      position,
      track,
      playing,
      loading,
      blocked,
      started,
      issue,
      failed,
      online,
      shuffle,
      repeat,
      volume,
      muted,
      durations,
      toggle,
      pause,
      next,
      prev,
      seek,
      seekBy,
      jumpTo,
      selectStation,
      playStation,
      shuffleStation,
      cueTrack,
      resumePoint,
      resume,
      sleep,
      setSleep,
      crossfade,
      setCrossfade,
      crossfadeSupported,
      toggleShuffle,
      cycleRepeat,
      setVolume,
      toggleMute,
      retryTrack,
    }),
    [
      library, status, reload, stations, stationId, station, stationIndex, queue, position, track, playing, loading,
      blocked, started, issue, failed, online, shuffle, repeat, volume, muted, durations, toggle, pause, next, prev,
      seek, seekBy, jumpTo, selectStation, playStation, shuffleStation, cueTrack, resumePoint, resume, sleep, setSleep,
      crossfade, setCrossfade, crossfadeSupported, toggleShuffle, cycleRepeat, setVolume, toggleMute, retryTrack,
    ],
  );

  return (
    <PlayerContext.Provider value={value}>
      <ProgressContext.Provider value={progress}>{children}</ProgressContext.Provider>
    </PlayerContext.Provider>
  );
}

export function usePlayer(): PlayerState {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider');
  return ctx;
}

/** Subscribe to playback position separately so only seek bars re-render on `timeupdate`. */
export function usePlayerProgress(): ProgressState {
  return useContext(ProgressContext);
}

/** Best known duration of a track: manifest, then metadata. */
export function trackDuration(track: Track, durations: Readonly<Record<string, number>>): number {
  return track.durationSec ?? durations[track.id] ?? 0;
}
