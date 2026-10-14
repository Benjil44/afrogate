/**
 * English copy for the afrows.com landing page — Afrows = Afrooz Wave Station
 * (Persian music + live radio). `fa.ts` must mirror this exact shape — TypeScript enforces it
 * through `Dict`. Narrative and wording: docs/landing-wave-station-story.md.
 *
 * Content rules:
 *  - No artist names, song titles or album art for the radio stations (copyright). The deck's
 *    mixes are licensed data in `lib/tracks.ts`, not UI copy.
 *  - Prices are PLACEHOLDERS until the billing catalogue exists (see `pricing.plans`).
 */
export const en = {
  /** Wordmark — change the brand in one place. */
  brand: 'Afrows',
  brandFull: 'Afrooz Wave Station',
  brandMeaning: 'Afro is Afrooz — to kindle a light. WS is Wave Station.',
  tagline: 'On the Afrooz wave.',
  documentTitle: 'Afrows — Afrooz Wave Station · Persian music & live radio',
  dirLabel: 'EN',
  langToggle: 'Switch language to Persian',
  nav: {
    radio: 'Stations',
    mixes: 'Mixes',
    features: 'Features',
    pricing: 'Plans',
    faq: 'FAQ',
    menu: 'Menu',
    closeMenu: 'Close menu',
    cta: 'Get on air',
    home: 'Go to top',
  },
  promo: {
    tag: 'On air soon',
    text: 'Early members: 25% off the yearly plan',
    cta: 'See plans',
    dismiss: 'Dismiss',
  },
  hero: {
    badge: 'Afrooz Wave Station · Persian music · Live radio',
    title: 'Tune in to Afrooz',
    subtitle:
      'A station that kindles the night: Persian music, live channels and your own playlists — studio quality, no ads, on every device.',
    ctaPrimary: 'Tell me when we go on air',
    ctaSecondary: 'Turn the dial',
    srIntro: 'Afrows, the Afrooz Wave Station: Persian music and live radio.',
    signal: {
      searching: 'Searching for a signal…',
      locked: 'Signal locked',
      frequency: 'Afrooz · live',
    },
    wordmark: {
      afro: 'Afro',
      ws: 'WS',
      afroMeaning: 'Afrooz — to kindle',
      wsMeaning: 'Wave Station',
    },
    stats: {
      adFree: 'Ad-free',
      quality: '320 kbps',
      live: 'On air 24/7',
      offline: 'Offline',
    },
    player: {
      title: 'On the wave',
      play: 'Play',
      pause: 'Pause',
      previous: 'Previous mix',
      next: 'Next mix',
      like: 'Add to favourites',
      hint: 'Streams on demand — nothing downloads until you press play.',
    },
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
  deck: {
    tag: 'Music deck',
    title: 'Real sound, on air now',
    subtitle: 'Five full mixes, streamed on demand. Nothing downloads until you press play.',
    credit: 'Mixes by DJ Rokoshaa',
    nowPlaying: 'Now playing',
    mix: 'Mix',
    loading: 'Loading…',
    seek: 'Seek',
    error: 'Playback failed. Check your connection and try again.',
  },
  features: {
    tag: 'Clean signal',
    title: 'No static. Just the music.',
    subtitle: 'Studio sound, no interruptions, and a library that follows you everywhere.',
    items: {
      adFree: {
        title: 'Zero ads',
        body: 'Premium is completely ad-free — nothing between you and the next track.',
      },
      quality: {
        title: 'Studio quality',
        body: 'Stream at up to 320 kbps, or save data with adaptive quality on the go.',
      },
      offline: {
        title: 'Offline downloads',
        body: 'Save albums and playlists to your phone and listen without a connection.',
      },
      playlists: {
        title: 'Your playlists',
        body: 'Build playlists, follow moods, and get a daily mix tuned to your taste.',
      },
      devices: {
        title: 'Every device',
        body: 'Web, Android and iOS — your library and queue stay in sync.',
      },
      radio: {
        title: 'Always on air',
        body: 'Curated channels around the clock — pop, traditional, rap, nostalgia, chill.',
      },
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
  cta: {
    eyebrow: 'Going on air',
    title: 'We go on air soon. Be there.',
    body: 'Be the first to hear the signal — and keep the early-member yearly discount.',
    button: 'Tell me when we go on air',
  },
  footer: {
    tagline: 'Afrooz Wave Station — Persian music, live radio and playlists. Ad-free, everywhere.',
    ready: 'Stay on the wave.',
    signoff: 'This was Afrooz Wave Station. Stay on the wave.',
    links: 'Explore',
    rights: 'All rights reserved.',
    backToTop: 'Back to top',
    marquee: ['Pop', 'Traditional', 'Rap & Hip-hop', '60s & 70s', 'Chill & Lo-fi', 'Podcasts', 'Live radio', 'Ad-free', 'Afrooz Wave Station'],
  },
};

export type Dict = typeof en;
