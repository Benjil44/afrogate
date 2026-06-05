export const en = {
  dirLabel: 'EN',
  nav: {
    features: 'Features',
    gaming: 'Gaming',
    pricing: 'Pricing',
    login: 'Login',
    getStarted: 'Get started',
    menu: 'Menu',
  },
  promo: {
    tag: 'Limited time',
    text: '50% OFF — this month only',
    cta: 'Claim 50% off',
  },
  hero: {
    badge: 'Smart routing · Low latency · Stable',
    title: 'The fastest, most stable route to the open internet',
    subtitle:
      'Smart routing, ultra-low jitter and ping, and rock-solid uptime — built for streaming, gaming, and work.',
    ctaPrimary: 'Get started',
    ctaSecondary: 'Explore features',
  },
  metrics: {
    uptime: 'Uptime',
    ping: 'Avg ping',
    jitter: 'Avg jitter',
    locations: 'Locations',
  },
  features: {
    title: 'Why Afrows',
    subtitle: 'Engineered for speed, stability, and privacy on hard networks.',
    items: {
      smartRouting: {
        title: 'Smart routing',
        body: 'Traffic takes the best live path automatically — lower latency, fewer drops.',
      },
      lowPing: {
        title: 'Low ping & jitter',
        body: 'Tuned for real-time: gaming, calls, and trading feel instant and steady.',
      },
      stability: {
        title: 'Stability & uptime',
        body: 'Redundant routes and health checks keep you connected, around the clock.',
      },
      multiProtocol: {
        title: 'Multi-protocol',
        body: 'Multiple protocols and ports so you stay connected on restrictive networks.',
      },
      speed: {
        title: 'Raw speed',
        body: 'High-throughput servers built for streaming and large downloads.',
      },
      privacy: {
        title: 'Private by design',
        body: 'Strong encryption and no traffic logging — your activity stays yours.',
      },
    },
  },
  gaming: {
    tag: 'For gamers',
    title: 'Engineered for competitive play',
    subtitle:
      'Route-optimized paths to game servers crush latency and kill lag spikes — so you react first.',
    withoutLabel: 'Typical connection',
    withLabel: 'With Afrows',
    unit: 'ms',
    improvement: '6× lower ping',
    perks: ['Lowest-ping smart routing', 'Anti lag-spike stabilization', 'Priority for real-time traffic'],
    statPing: 'Game ping',
    statJitter: 'Jitter',
    statLoss: 'Packet loss',
    cta: 'Game with low ping',
  },
  audience: {
    title: 'Built for everyone',
    subtitle: 'One platform, tuned for how you connect.',
    enduser: {
      title: 'For everyday users',
      body: 'Open the internet with one tap — fast, simple, and reliable on any device.',
      cta: 'Get connected',
    },
    gamer: {
      title: 'For gamers',
      body: 'Lowest possible ping and jitter with route optimization for game servers.',
      cta: 'Play with low ping',
    },
    reseller: {
      title: 'For resellers',
      body: 'A full panel to manage customers, plans, wallets, and margins at scale.',
      cta: 'Become a reseller',
    },
  },
  pricing: {
    title: 'Simple, honest pricing',
    subtitle: 'Pick a plan that fits — upgrade anytime.',
    note: 'Plans shown are examples. Live plans and billing appear inside the panel.',
    perMonth: '/mo',
    mostPopular: 'Most popular',
    plans: {
      starter: {
        name: 'Starter',
        price: '$3',
        tagline: 'For getting online fast.',
        features: ['1 device', 'Standard speed', 'Core locations', 'Email support'],
        cta: 'Start now',
      },
      pro: {
        name: 'Pro',
        price: '$7',
        tagline: 'For streaming & gaming.',
        features: ['5 devices', 'Max speed', 'All locations', 'Low-ping routing', 'Priority support'],
        cta: 'Go Pro',
      },
      reseller: {
        name: 'Reseller',
        price: '$29',
        tagline: 'Sell access, manage customers.',
        features: ['Customer management', 'Wallet & margins', 'Bulk provisioning', 'Dedicated support'],
        cta: 'Start reselling',
      },
    },
  },
  cta: {
    title: 'Ready to go faster?',
    body: 'Create an account in the panel and connect in minutes.',
    button: 'Open the panel',
  },
  footer: {
    ready: 'Ready to begin?',
    androidSoon: 'Android — coming soon',
    iosSoon: 'iOS — coming soon',
    privacy: 'Privacy Policy',
    terms: 'Terms of Service',
    support: 'Support',
    rights: 'All rights reserved.',
    craftedWith: 'Crafted with',
    by: 'by',
    marquee: [
      'Smart Routing',
      'Ultra-low Ping',
      'Rock-solid Uptime',
      'Multi-protocol',
      'Private by design',
    ],
  },
};

export type Dict = typeof en;
