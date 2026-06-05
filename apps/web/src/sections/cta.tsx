import { Reveal } from '@/components/reveal';
import { Button } from '@/components/ui/button';
import { useLang, APP_URL } from '@/i18n';

export function Cta() {
  const { t } = useLang();
  return (
    <section className="relative mx-auto w-full max-w-6xl px-5 py-20">
      <Reveal>
        <div className="relative overflow-hidden rounded-3xl border border-[var(--border)] px-8 py-16 text-center">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(circle at 50% 0%, color-mix(in oklch, var(--primary) 22%, transparent), transparent 70%)',
            }}
          />
          <div className="relative z-10 mx-auto max-w-2xl">
            <h2 className="text-3xl font-black tracking-tight md:text-5xl">{t.cta.title}</h2>
            <p className="mt-4 text-[var(--muted-foreground)]">{t.cta.body}</p>
            <Button as="a" href={APP_URL} variant="primary" size="lg" className="mt-8">
              {t.cta.button}
            </Button>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
