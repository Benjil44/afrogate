/**
 * English copy for the afrows.com landing page — Afrows = Afro Wave Station (Afro as in Afro house;
 * the Persian copy keeps the name افروز)
 * (Persian music + live radio). `fa.ts` must mirror this exact shape — TypeScript enforces it
 * through `Dict`. Narrative and wording: docs/landing-wave-station-story.md.
 *
 * Content rules:
 *  - No artist names, song titles or album art for the radio stations (copyright). The deck's
 *    mixes are licensed data from the runtime manifest (`lib/tracks.ts`), not UI copy.
 *  - Prices are PLACEHOLDERS until the billing catalogue exists (see `pricing.plans`).
 */
export const en = {
  /** Wordmark — change the brand in one place. */
  brand: 'Afrows',
  brandFull: 'Afro Wave Station',
  brandMeaning: 'Afro as in Afro house: deep, warm and rhythmic. WS is Wave Station.',
  tagline: 'On the Afro wave.',
  documentTitle: 'Afrows — Afro Wave Station · Persian music & live radio',
  dirLabel: 'EN',
  langToggle: 'Switch language to Persian',
  promo: {
    tag: 'On air soon',
    text: 'Early members: 25% off the yearly plan',
    cta: 'See plans',
    dismiss: 'Dismiss',
  },
  radio: {
    tag: 'Stations',
    title: 'A station for every mood',
    subtitle: 'Six live channels on one dial. Pick one and let it play.',
    dial: 'Station dial',
    tune: 'Tune to',
    comingSoon: 'Coming soon',
    channels: {
      pop: { name: 'Pop', desc: 'Today’s hits and fresh releases' },
      traditional: { name: 'Traditional', desc: 'Classical Persian instruments and vocals' },
      rap: { name: 'Rap & Hip-hop', desc: 'Persian rap, from underground to mainstream' },
      nostalgia: { name: '60s & 70s', desc: 'Golden-era classics and nostalgia' },
      chill: { name: 'Chill & Lo-fi', desc: 'Calm beats for focus, study and sleep' },
      podcast: { name: 'Podcasts', desc: 'Stories, talk and culture in Persian' },
    },
  },
  pricing: {
    tag: 'Your frequency',
    title: 'Stay on the wave, your way',
    subtitle: 'Start free. Go Premium when you want the whole signal.',
    // PLACEHOLDER prices — final Toman amounts come from the billing catalogue at launch.
    note: 'Prices shown are indicative and will be confirmed at launch.',
    currency: 'Toman',
    free: 'Free',
    mostPopular: 'Best value',
    save: 'Save 25%',
    comingSoon: 'Coming soon',
    notifyHint: 'We’ll tell you the moment we go on air.',
    plans: {
      free: {
        name: 'Free',
        price: '0',
        period: '',
        tagline: 'Listen with ads.',
        features: ['Live radio channels', 'Shuffle play with ads', 'Limited skips per hour', 'Standard quality'],
      },
      monthly: {
        name: 'Premium monthly',
        // PLACEHOLDER
        price: '99,000',
        period: '/ month',
        tagline: 'Everything, no ads.',
        features: ['Ad-free listening', '320 kbps quality', 'Unlimited skips', 'Offline downloads', 'Personal playlists'],
      },
      yearly: {
        name: 'Premium yearly',
        // PLACEHOLDER (12 × monthly minus 25%)
        price: '890,000',
        period: '/ year',
        wasPrice: '1,188,000',
        tagline: 'Twelve months, one payment.',
        features: ['Everything in monthly', 'Two months free', 'Up to 5 devices', 'Early access to new features', 'Priority support'],
      },
    },
  },
  apps: {
    tag: 'Receivers',
    title: 'One station, every device',
    subtitle: 'The web player opens first. Android and iOS follow.',
    comingSoon: 'Coming soon',
    web: { name: 'Web player', desc: 'Listen straight from your browser — no install.' },
    android: { name: 'Android', desc: 'Offline downloads, background play, lock-screen controls.' },
    ios: { name: 'iOS', desc: 'CarPlay, Siri shortcuts and AirPlay built in.' },
    phone: {
      header: 'Your library',
      playlistA: 'Morning drive',
      playlistB: 'Late-night chill',
      playlistC: 'Workout energy',
      trackCount: 'tracks',
    },
  },
  faq: {
    tag: 'FAQ',
    title: 'Questions, answered',
    subtitle: 'Still curious? The footer has our contact.',
    items: [
      {
        q: 'When does Afrows go on air?',
        a: 'We are in the final stretch. Subscriptions open with the web player first, and the Android and iOS apps follow shortly after. This page will update the moment it is live.',
      },
      {
        q: 'Is there a free plan?',
        a: 'Yes. The free plan includes live radio and shuffle play with ads and a limited number of skips. Premium removes ads and unlocks 320 kbps, offline downloads and unlimited skips.',
      },
      {
        q: 'How do I pay?',
        a: 'Plans are priced in Toman and paid through local payment methods. Monthly and yearly billing are both available, and the yearly plan saves 25%.',
      },
      {
        q: 'Can I listen offline?',
        a: 'Premium members can download albums and playlists on Android and iOS and listen anywhere without a connection.',
      },
      {
        q: 'How many devices can I use?',
        a: 'One account works on the web, Android and iOS. Premium yearly lets you stay signed in on up to five devices at the same time.',
      },
    ],
  },
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
    emptyBody: 'New mixes are on the way. Meanwhile, have a look at Afrows VPN.',
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
    getVpn: 'Get Afrows VPN',
    vpnShort: 'VPN',
    vpnTitle: 'Afrows VPN',
    vpnRailLine: 'Fast, private connection: get Afrows VPN',
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
      { keys: 'Esc', label: 'Close a sheet or dialog' },
    ],
  },
};

export type Dict = typeof en;
