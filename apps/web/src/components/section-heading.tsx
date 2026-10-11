import { Reveal } from '@/components/reveal';

/** Centered eyebrow + title + subtitle used by every landing section. */
export function SectionHeading({ tag, title, subtitle }: { tag: string; title: string; subtitle: string }) {
  return (
    <Reveal>
      <div className="mx-auto max-w-2xl text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[color-mix(in_oklch,var(--primary)_10%,transparent)] px-3 py-1 text-xs font-bold text-[var(--accent)]">
          {tag}
        </span>
        <h2 className="mt-4 text-balance text-3xl font-black leading-tight tracking-tight md:text-5xl">{title}</h2>
        <p className="mt-4 text-pretty text-[var(--muted-foreground)] md:text-lg">{subtitle}</p>
      </div>
    </Reveal>
  );
}
