import { SplitWords } from '@/motion/split-words';

/** Centered eyebrow + title + subtitle used by every landing section; the title "tunes in" word by word. */
export function SectionHeading({ tag, title, subtitle }: { tag: string; title: string; subtitle: string }) {
  return (
    <div data-fx="rise" className="mx-auto max-w-2xl text-center">
      <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[color-mix(in_oklch,var(--primary)_10%,transparent)] px-3 py-1 text-xs font-bold text-[var(--accent)]">
        <span aria-hidden="true" className="heading-wave" />
        {tag}
      </span>
      <SplitWords as="h2" text={title} className="mt-4 text-balance text-3xl font-black leading-tight tracking-tight md:text-5xl" />
      <p className="mt-4 text-pretty text-[var(--muted-foreground)] md:text-lg">{subtitle}</p>
    </div>
  );
}
