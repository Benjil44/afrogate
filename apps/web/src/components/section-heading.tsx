/**
 * Centered eyebrow + title + subtitle used by the VPN sheet sections (pricing, apps, FAQ).
 * Plain markup: the sheet scrolls in its own container, so no scroll-driven reveal is attached.
 */
export function SectionHeading({ tag, title, subtitle, id }: { tag: string; title: string; subtitle: string; id?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[color-mix(in_oklch,var(--primary)_10%,transparent)] px-3 py-1 text-xs font-bold text-[var(--accent)]">
        <span aria-hidden="true" className="heading-wave" />
        {tag}
      </span>
      <h2 id={id} className="mt-4 text-balance text-3xl font-black leading-tight tracking-tight md:text-4xl">
        {title}
      </h2>
      <p className="mt-4 text-pretty text-[var(--muted-foreground)] md:text-lg">{subtitle}</p>
    </div>
  );
}
