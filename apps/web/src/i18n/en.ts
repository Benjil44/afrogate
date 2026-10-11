/**
 * English copy for the afrows.com landing page (Persian music streaming + live radio).
 * `fa.ts` must mirror this exact shape — TypeScript enforces it through `Dict`.
 *
 * Content rules:
 *  - No real artist names, song titles or album art (copyright). Use generic placeholders.
 *  - Prices are PLACEHOLDERS until the billing catalogue exists (see `pricing.plans`).
 */
export const en = {
  /** Wordmark — change the brand in one place. */
  brand: 'Afrows',
  dirLabel: 'EN',
  langToggle: 'Switch language to Persian',
  nav: {
    radio: 'Live radio',
    features: 'Features',
    pricing: 'Plans',
    faq: 'FAQ',
    menu: 'Menu',
    closeMenu: 'Close menu',
    cta: 'Coming soon',
    home: 'Go to top',
  },
  promo: {
    tag: 'Launching soon',
    text: 'Early members: 25% off the yearly plan',
    cta: 'See plans',
    dismiss: 'Dismiss',
  },
  hero: {
    badge: 'Persian music · Live radio · Ad-free',
    title: 'All of Persian music, one tap away',
    subtitle:
      'Unlimited streaming, live radio channels and personal playlists — in studio quality, without ads, on every device.',
    ctaPrimary: 'Notify me at launch',
    ctaSecondary: 'Browse the radio',
    comingSoon: 'Coming soon',
    stats: {
      adFree: 'Ad-free',
      quality: '320 kbps',
      live: 'Live 24/7',
      offline: 'Offline',
    },
    player: {
      title: 'Now playing',
      liveBadge: 'Live',
      track: 'New release',
      artist: 'Daily mix',
      play: 'Play',
      pause: 'Pause',
      previous: 'Previous channel',
      next: 'Next channel',
      like: 'Add to favourites',
      elapsed: '1:24',
      total: '3:48',
      offlineHint: 'Preview only — playback arrives with the app.',
    },
  },
  radio: {
    tag: 'Live radio',
    title: 'A channel for every mood',
    subtitle: 'Hand-curated live streams that never stop — pick a mood and let it play.',
    live: 'Live',
    listeners: 'listening now',
    playChannel: 'Play channel',
    pauseChannel: 'Pause channel',
    channels: {
      pop: { name: 'Pop', desc: 'Today’s hits and fresh releases' },
      traditional: { name: 'Traditional', desc: 'Classical Persian instruments and vocals' },
      rap: { name: 'Rap & Hip-hop', desc: 'Persian rap, from underground to mainstream' },
      nostalgia: { name: '60s & 70s', desc: 'Golden-era classics and nostalgia' },
      chill: { name: 'Chill & Lo-fi', desc: 'Calm beats for focus, study and sleep' },
      podcast: { name: 'Podcasts', desc: 'Stories, talk and culture in Persian' },
    },
  },
  features: {
    tag: 'Why Afrows',
    title: 'Built for how you really listen',
    subtitle: 'Premium sound, no interruptions, and a library that follows you everywhere.',
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
        title: 'Live radio',
        body: 'Curated channels around the clock — pop, traditional, rap, nostalgia, chill.',
      },
    },
  },
  pricing: {
    tag: 'Subscriptions',
    title: 'Simple plans, honest prices',
    subtitle: 'Start free. Go Premium whenever you want more.',
    // PLACEHOLDER prices — final Toman amounts come from the billing catalogue at launch.
    note: 'Prices shown are indicative and will be confirmed at launch.',
    currency: 'Toman',
    perMonth: '/ month',
    perYear: '/ year',
    free: 'Free',
    mostPopular: 'Best value',
    save: 'Save 25%',
    comingSoon: 'Coming soon',
    notifyHint: 'We’ll let you know the moment subscriptions open.',
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
    tag: 'Apps',
    title: 'In your pocket, soon',
    subtitle: 'Native apps for Android and iOS are in the works. The web player opens first.',
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
    subtitle: 'Still curious? Reach us from the footer.',
    items: [
      {
        q: 'When does Afrows launch?',
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
    title: 'Your soundtrack is almost here',
    body: 'Be the first to know when Afrows opens — and lock in the early-member yearly discount.',
    button: 'Notify me at launch',
  },
  footer: {
    tagline: 'Persian music, live radio and playlists — ad-free, everywhere.',
    ready: 'Turn it up.',
    links: 'Explore',
    rights: 'All rights reserved.',
    backToTop: 'Back to top',
    marquee: ['Pop', 'Traditional', 'Rap & Hip-hop', '60s & 70s', 'Chill & Lo-fi', 'Podcasts', 'Live radio', 'Ad-free'],
  },
};

export type Dict = typeof en;
