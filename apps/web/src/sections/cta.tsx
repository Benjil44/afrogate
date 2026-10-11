import { Bell } from 'lucide-react';
import { Reveal } from '@/components/reveal';
import { Button } from '@/components/ui/button';
import { useLang } from '@/i18n';

export function Cta() {
  const { t } = useLang();
  return (
    <section className="relative mx-auto w-full max-w-6xl px-4 py-20 sm:px-5">
      <Reveal>
        <div className="relative overflow-hidden rounded-3xl border border-[var(--border)] px-6 py-16 text-center sm:px-8">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(circle at 50% 0%, color-mix(in oklch, var(--primary) 28%, transparent), transparent 60%), radial-gradient(circle at 50% 100%, color-mix(in oklch, var(--secondary) 22%, transparent), transparent 60%)',
            }}
          />
          <div className="relative z-10 mx-auto max-w-2xl">
            <h2 className="text-balance text-3xl font-black leading-tight tracking-tight md:text-5xl">{t.cta.title}</h2>
            <p className="mt-4 text-pretty text-[var(--muted-foreground)] md:text-lg">{t.cta.body}</p>
            <Button as="a" href="#pricing" variant="primary" size="lg" className="mt-8">
              <Bell className="h-4 w-4" aria-hidden="true" />
              {t.cta.button}
            </Button>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
