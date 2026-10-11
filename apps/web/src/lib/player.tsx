import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

/**
 * Demo "now playing" state shared by the hero player, the radio tiles and the mini player.
 * There is no audio: play/pause only drives the equalizer animation.
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

interface PlayerState {
  channel: ChannelKey;
  playing: boolean;
  toggle: () => void;
  /** Select a channel; re-selecting the active one toggles play/pause. */
  select: (channel: ChannelKey) => void;
  step: (delta: 1 | -1) => void;
}

const PlayerContext = createContext<PlayerState | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [channel, setChannel] = useState<ChannelKey>('pop');
  const [playing, setPlaying] = useState(false);

  const value = useMemo<PlayerState>(
    () => ({
      channel,
      playing,
      toggle: () => setPlaying((p) => !p),
      select: (next) => {
        if (next === channel) {
          setPlaying((p) => !p);
        } else {
          setChannel(next);
          setPlaying(true);
        }
      },
      step: (delta) => {
        const i = CHANNEL_KEYS.indexOf(channel);
        setChannel(CHANNEL_KEYS[(i + delta + CHANNEL_KEYS.length) % CHANNEL_KEYS.length]);
      },
    }),
    [channel, playing],
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer(): PlayerState {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider');
  return ctx;
}
