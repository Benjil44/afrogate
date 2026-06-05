import { Route, Gauge, ShieldCheck, Layers, Zap, Lock } from 'lucide-react';
import { Reveal } from '@/components/reveal';
import { Card, CardTitle, CardBody } from '@/components/ui/card';
import { useLang } from '@/i18n';

export function Features() {
  const { t } = useLang();
  const items = [
    { key: 'smartRouting', Icon: Route },
    { key: 'lowPing', Icon: Gauge },
    { key: 'stability', Icon: ShieldCheck },
    { key: 'multiProtocol', Icon: Layers },
    { key: 'speed', Icon: Zap },
    { key: 'privacy', Icon: Lock },
  ] as const;

  return (
    <section id="features" className="relative mx-auto w-full max-w-6xl scroll-mt-20 px-5 py-20">
      <Reveal>
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-black tracking-tight md:text-5xl">{t.features.title}</h2>
          <p className="mt-4 text-[var(--muted-foreground)]">{t.features.subtitle}</p>
        </div>
      </Reveal>

      <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(({ key, Icon }, i) => {
          const item = t.features.items[key];
          return (
            <Reveal key={key} delay={(i % 3) * 0.08}>
              <Card className="h-full">
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--border)] bg-[color-mix(in_oklch,var(--primary)_12%,transparent)] text-[var(--primary)]">
                  <Icon className="h-6 w-6" />
                </div>
                <CardTitle>{item.title}</CardTitle>
                <CardBody>{item.body}</CardBody>
              </Card>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
