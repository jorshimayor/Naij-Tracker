import { cn } from '@/lib/utils';

type Variant = 'default' | 'green' | 'amber' | 'red' | 'slate' | 'outline' | 'gold';

const VARIANTS: Record<Variant, string> = {
  default: 'bg-foreground text-background',
  green:   'bg-flag-green/10 text-flag-green ring-1 ring-flag-green/30 dark:text-flag-green-light',
  amber:   'bg-amber-100 text-amber-800 ring-1 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30',
  red:     'bg-porphyry/10 text-porphyry ring-1 ring-porphyry/30 dark:text-red-300',
  slate:   'bg-muted text-foreground/85 ring-1 ring-border',
  outline: 'bg-transparent text-foreground/80 ring-1 ring-border',
  gold:    'bg-gold/10 text-gold ring-1 ring-gold/40',
};

export function Badge({
  children,
  variant = 'slate',
  className,
}: {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 font-display text-[10px] uppercase tracking-roman',
        VARIANTS[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
