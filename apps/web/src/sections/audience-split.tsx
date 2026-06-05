import { User, Gamepad2, Store } from 'lucide-react';
import { Reveal } from '@/components/reveal';
import { Button } from '@/components/ui/button';
import { useLang, APP_URL } from '@/i18n';

export function AudienceSplit() {
  const { t } = useLang();
  // Detail pages /vpn, /gaming, /resellers are fast-follow; swap href then.
  const cards = [
    { key: 'enduser', Icon: User, href: APP_URL },
    { key: 'gamer', Icon: Gamepad2, href: APP_URL },
    { key: 'reseller', Icon: Store, href: APP_URL },
  ] as const;

  return (
    <section className="relative mx-auto w-full max-w-6xl px-5 py-20">
      <Reveal>
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-black tracking-tight md:text-5xl">{t.audience.title}</h2>
          <p className="mt-4 text-[var(--muted-foreground)]">{t.audience.subtitle}</p>
        </div>
      </Reveal>

      <div className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-3">
        {cards.map(({ key, Icon, href }, i) => {
          const c = t.audience[key];
          return (
            <Reveal key={key} delay={i * 0.1}>
              <div className="flex h-full flex-col rounded-2xl border border-[var(--border)] bg-[linear-gradient(160deg,color-mix(in_oklch,var(--foreground)_5%,transparent),transparent)] p-7 backdrop-blur-md">
                <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[linear-gradient(135deg,var(--primary),var(--secondary))] text-white">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold">{c.title}</h3>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-[var(--muted-foreground)]">{c.body}</p>
                <Button as="a" href={href} variant="glass" size="sm" className="mt-6 self-start">
                  {c.cta}
                </Button>
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
