/**
 * English copy for afrows.com — Afrows Radio, a one-screen music player (Afrows = Afro Wave
 * Station; the Persian copy keeps the name افروز). `fa.ts` must mirror this exact shape —
 * TypeScript enforces it through `Dict`. afrows.com is the radio only: no VPN marketing here
 * (the VPN product lives on app.afrows.com, owner decision 2026-11-22).
 *
 * Content rule: track titles, artists and covers are licensed data from the runtime manifest
 * (`lib/tracks.ts`), never UI copy.
 */
export const en = {
  /** Wordmark — change the brand in one place. */
  brand: 'Afrows',
  /** Header name of the radio. */
  brandRadio: 'Afrows Radio',
  documentTitle: 'Afrows Radio — Persian music and DJ mixes',
  langToggle: 'Switch language to Persian',
  /** One-screen player (design: afrows-player/01_PLAYER_UX.md). `{n}`, `{a}`, `{b}`, `{title}`, `{artist}` are filled in code. */
  player: {
    skipToPlayer: 'Skip to the player',
    stations: 'Stations',
    stationsNav: 'Music stations',
    allMusic: 'All music',
    trackCountOne: '1 track',
    trackCountMany: '{n} tracks',
    upNext: 'Up next',
    showQueue: 'Show up next',
    hideQueue: 'Hide up next',
    nowPlaying: 'Now playing',
    playerRegion: 'Player controls',
    play: 'Play',
    pause: 'Pause',
    start: 'Start the music',
    startHint: 'Press play to start. Nothing downloads until you do.',
    previous: 'Previous track',
    next: 'Next track',
    shuffle: 'Shuffle',
    repeatOff: 'Repeat: off',
    repeatAll: 'Repeat: all',
    repeatOne: 'Repeat: this track',
    volume: 'Volume',
    mute: 'Mute',
    unmute: 'Unmute',
    seek: 'Seek',
    timeOf: '{a} of {b}',
    buffering: 'Buffering…',
    loading: 'Loading the music library…',
    errorTitle: 'Can’t reach the music library',
    errorBody: 'Check your connection. We try again as soon as you are back online.',
    retry: 'Try again',
    emptyTitle: 'No music published yet',
    emptyBody: 'New mixes are on the way.',
    stationEmpty: 'This station is empty',
    stationEmptyBody: 'There is nothing to play here right now.',
    playAll: 'Play All music',
    unavailable: 'Unavailable',
    skipping: 'This track is unavailable. Skipping to the next one in 3 seconds…',
    trackFailed: 'This track could not be played.',
    offline: 'Offline, playing buffered audio',
    nowPlayingAnnounce: 'Now playing: {title}, {artist}',
    noTrack: 'Pick a station',
    playStation: 'Play station',
    backToStations: 'Back to stations',
    openPlayer: 'Open the full player',
    closePlayer: 'Close the player',
    close: 'Close',
    shortcuts: 'Keyboard shortcuts',
    shortcutsOpen: 'Show keyboard shortcuts',
    shortcutList: [
      { keys: 'Space · K', label: 'Play or pause' },
      { keys: '← · →', label: 'Seek 10 seconds (→ is always forward)' },
      { keys: 'Shift+← · Shift+→ · P · N', label: 'Previous or next track' },
      { keys: '↑ · ↓', label: 'Volume up or down' },
      { keys: 'M', label: 'Mute or unmute' },
      { keys: 'S', label: 'Shuffle on or off' },
      { keys: 'R', label: 'Change repeat mode' },
      { keys: '?', label: 'Show this list' },
      { keys: 'Esc', label: 'Close the player sheet or a dialog' },
    ],
  },
};

export type Dict = typeof en;
