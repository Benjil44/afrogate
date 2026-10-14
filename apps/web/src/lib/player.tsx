import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useMotionTier } from '@/motion/provider';
import { TRACKS, isSameOrigin, type Track } from './tracks';

/**
 * Real audio player shared by the hero PlayerCard, the Deck, the MiniPlayer and the Nav/Footer
 * equalizers. One `HTMLAudioElement` with `preload="none"` — nothing downloads until the user
 * presses play (streamed with range requests by the server). No autoplay.
 *
 * Visualizer: on the first user tap we lazily create an AudioContext + AnalyserNode and, while
 * playing and the tab is visible, write 8 band levels (`--lv0`..`--lv7`, `--level`) to `<html>`
 * once per animation frame. The equalizers and the hero waveform consume them in CSS, so no
 * React re-render happens per frame. Paused / hidden / `static` tier -> CSS `--beat` fallback.
 *
 * The six radio "stations" remain a visual mood dial (no audio behind them).
 */
export const CHANNEL_KEYS = ['pop', 'traditional', 'rap', 'nostalgia', 'chill', 'podcast'] as const;
export type ChannelKey = (typeof CHANNEL_KEYS)[number];

/** CSS gradient "album art" per channel — no external images. */
export const CHANNEL_ART: Record<ChannelKey, string> = {
  pop: 'linear-gradient(135deg, oklch(0.72 0.22 350) 0%, oklch(0.62 0.24 300) 55%, oklch(0.50 0.20 270) 100%)',
  traditional: 'linear-gradient(135deg, oklch(0.78 0.16 75) 0%, oklch(0.62 0.18 40) 55%, oklch(0.42 0.14 20) 100%)',
  rap: 'linear-gradient(135deg, oklch(0.30 0.03 280) 0%, oklch(0.55 0.22 25) 60%, oklch(0.80 0.17 85) 100%)',
  nostalgia: 'linear-gradient(135deg, oklch(0.80 0.14 60) 0%, oklch(0.68 0.17 25) 50%, oklch(0.45 0.12 330) 100%)',
  chill: 'linear-gradient(135deg, oklch(0.80 0.10 200) 0%, oklch(0.62 0.14 240) 55%, oklch(0.40 0.12 290) 100%)',
  podcast: 'linear-gradient(135deg, oklch(0.75 0.17 150) 0%, oklch(0.58 0.16 190) 55%, oklch(0.36 0.10 250) 100%)',
};

/** Gradient art for the mixes: one per track, cycling the channel palette. */
export function trackArt(index: number): string {
  return CHANNEL_ART[CHANNEL_KEYS[index % CHANNEL_KEYS.length]];
}

interface PlayerState {
  tracks: readonly Track[];
  index: number;
  track: Track;
  playing: boolean;
  loading: boolean;
  error: boolean;
  /** Durations learned from `loadedmetadata`, by track id. */
  durations: Readonly<Record<string, number>>;
  /** Play the track at `index` (current when omitted); re-tapping the active track pauses it. */
  toggle: (index?: number) => void;
  pause: () => void;
  step: (delta: 1 | -1) => void;
  seek: (seconds: number) => void;
  /** Visual mood dial (no audio). */
  channel: ChannelKey;
  selectChannel: (channel: ChannelKey) => void;
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
}

function createAnalysis(audio: HTMLAudioElement): Analysis | null {
  if (typeof AudioContext === 'undefined') return null;
  try {
    const context = new AudioContext();
    const analyser = context.createAnalyser();
    analyser.fftSize = 128;
    analyser.smoothingTimeConstant = 0.8;
    context.createMediaElementSource(audio).connect(analyser);
    analyser.connect(context.destination);
    return { context, analyser, data: new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount)) };
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

export function PlayerProvider({ children }: { children: ReactNode }) {
  const tier = useMotionTier();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const analysisRef = useRef<Analysis | null>(null);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [durations, setDurations] = useState<Record<string, number>>({});
  const [progress, setProgress] = useState<ProgressState>({ currentTime: 0, duration: 0 });
  const [channel, setChannel] = useState<ChannelKey>('pop');
  const indexRef = useRef(index);
  indexRef.current = index;

  const getAudio = useCallback(() => {
    if (!audioRef.current) {
      const audio = new Audio();
      audio.preload = 'none';
      audioRef.current = audio;
    }
    return audioRef.current;
  }, []);

  const startTrack = useCallback(
    (next: number) => {
      const audio = getAudio();
      const track = TRACKS[next];
      setError(false);
      if (next !== indexRef.current || !audio.currentSrc) {
        indexRef.current = next;
        setIndex(next);
        setProgress({ currentTime: 0, duration: durations[track.id] ?? 0 });
        audio.src = track.src;
      }
      // Analyser is created on the first user tap (autoplay policy) and only when the engine tier runs motion.
      if (!analysisRef.current && tier !== 'static' && isSameOrigin(track.src)) analysisRef.current = createAnalysis(audio);
      const ctx = analysisRef.current?.context;
      if (ctx && ctx.state === 'suspended') void ctx.resume();
      setLoading(true);
      audio.play().catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setLoading(false);
        setPlaying(false);
        setError(true);
      });
    },
    [getAudio, durations, tier],
  );

  const pause = useCallback(() => audioRef.current?.pause(), []);

  const toggle = useCallback(
    (target?: number) => {
      const next = target ?? indexRef.current;
      if (next === indexRef.current && playing) pause();
      else startTrack(next);
    },
    [playing, pause, startTrack],
  );

  const step = useCallback(
    (delta: 1 | -1) => startTrack((indexRef.current + delta + TRACKS.length) % TRACKS.length),
    [startTrack],
  );

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration)) return;
    audio.currentTime = Math.max(0, Math.min(audio.duration, seconds));
    setProgress((p) => ({ ...p, currentTime: audio.currentTime }));
  }, []);

  // Audio element events -> React state (created lazily, so attach on first play via `getAudio`).
  useEffect(() => {
    const audio = getAudio();
    const onPlay = () => setPlaying(true);
    const onPause = () => {
      setPlaying(false);
      setLoading(false);
    };
    const onWaiting = () => setLoading(true);
    const onPlaying = () => setLoading(false);
    const onMeta = () => {
      const id = TRACKS[indexRef.current].id;
      setDurations((d) => (d[id] === audio.duration ? d : { ...d, [id]: audio.duration }));
      setProgress({ currentTime: audio.currentTime, duration: audio.duration });
    };
    const onTime = () => setProgress({ currentTime: audio.currentTime, duration: audio.duration || 0 });
    const onEnded = () => {
      if (indexRef.current < TRACKS.length - 1) startTrack(indexRef.current + 1);
      else setPlaying(false);
    };
    const onError = () => {
      setLoading(false);
      setPlaying(false);
      setError(true);
    };
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('loadstart', onWaiting);
    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('canplay', onPlaying);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('durationchange', onMeta);
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);
    return () => {
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('waiting', onWaiting);
      audio.removeEventListener('loadstart', onWaiting);
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('canplay', onPlaying);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('durationchange', onMeta);
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, [getAudio, startTrack]);

  // `.is-playing` on <html> drives every CSS beat loop (equalizers, vinyl, rings, waveform pulse).
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

  // Lock-screen / headset controls.
  useEffect(() => {
    const session = navigator.mediaSession;
    if (!session) return;
    const track = TRACKS[index];
    session.metadata = new MediaMetadata({ title: track.title, artist: track.artist, album: 'Afrows' });
    session.playbackState = playing ? 'playing' : 'paused';
  }, [index, playing]);

  useEffect(() => {
    const session = navigator.mediaSession;
    if (!session) return;
    const handlers: [MediaSessionAction, MediaSessionActionHandler | null][] = [
      ['play', () => startTrack(indexRef.current)],
      ['pause', pause],
      ['previoustrack', () => step(-1)],
      ['nexttrack', () => step(1)],
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
  }, [startTrack, pause, step]);

  const value = useMemo<PlayerState>(
    () => ({
      tracks: TRACKS,
      index,
      track: TRACKS[index],
      playing,
      loading,
      error,
      durations,
      toggle,
      pause,
      step,
      seek,
      channel,
      selectChannel: setChannel,
    }),
    [index, playing, loading, error, durations, toggle, pause, step, seek, channel],
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
