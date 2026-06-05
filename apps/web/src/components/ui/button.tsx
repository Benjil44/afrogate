import { type AnchorHTMLAttributes, type ButtonHTMLAttributes, forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap cursor-pointer transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] disabled:opacity-50 disabled:pointer-events-none',
  {
    variants: {
      variant: {
        primary:
          'text-white bg-[linear-gradient(135deg,var(--primary),var(--secondary))] shadow-lg shadow-[color-mix(in_oklch,var(--primary)_40%,transparent)] hover:brightness-110 hover:-translate-y-0.5',
        glass:
          'text-[var(--foreground)] border border-[var(--border)] bg-[color-mix(in_oklch,var(--foreground)_4%,transparent)] backdrop-blur-md hover:bg-[color-mix(in_oklch,var(--foreground)_8%,transparent)] hover:-translate-y-0.5',
        ghost:
          'text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[color-mix(in_oklch,var(--foreground)_6%,transparent)]',
      },
      size: {
        sm: 'h-9 px-4 text-sm',
        md: 'h-11 px-6 text-sm',
        lg: 'h-14 px-8 text-base',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  AnchorHTMLAttributes<HTMLAnchorElement> &
  VariantProps<typeof buttonVariants> & { as?: 'button' | 'a' };

export const Button = forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(
  ({ className, variant, size, as = 'button', ...props }, ref) => {
    const cls = cn(buttonVariants({ variant, size }), className);
    if (as === 'a') {
      return (
        <a ref={ref as React.Ref<HTMLAnchorElement>} className={cls} {...(props as AnchorHTMLAttributes<HTMLAnchorElement>)} />
      );
    }
    return (
      <button ref={ref as React.Ref<HTMLButtonElement>} className={cls} {...(props as ButtonHTMLAttributes<HTMLButtonElement>)} />
    );
  },
);
Button.displayName = 'Button';

export { buttonVariants };
