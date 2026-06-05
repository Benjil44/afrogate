import { type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-[var(--border)] p-6 backdrop-blur-md transition-all duration-300',
        'bg-[linear-gradient(145deg,color-mix(in_oklch,var(--foreground)_4%,transparent),color-mix(in_oklch,var(--foreground)_1%,transparent))]',
        'hover:-translate-y-1 hover:border-[color-mix(in_oklch,var(--foreground)_22%,transparent)] hover:shadow-2xl hover:shadow-[color-mix(in_oklch,var(--primary)_15%,transparent)]',
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-lg font-bold text-[var(--foreground)]', className)} {...props} />;
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('mt-2 text-sm leading-relaxed text-[var(--muted-foreground)]', className)} {...props} />;
}
