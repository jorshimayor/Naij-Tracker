'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

/**
 * Top-nav link with active-route detection. Two accent tracks:
 *   - "bills"   → flag-green hover/active underline
 *   - "economy" → gold hover/active underline
 *   - "utility" → muted, no accent (Contribute, About)
 *
 * The active state is detected client-side via usePathname so the surrounding
 * Nav can stay a server component (it needs server-only helpers like getCurrentUser).
 */
export function NavLink({
  href,
  label,
  track,
  exact = false,
  className,
}: {
  href: string;
  label: string;
  track: 'bills' | 'economy' | 'utility';
  exact?: boolean;
  className?: string;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  const trackClasses: Record<typeof track, string> = {
    bills: 'hover:text-flag-green',
    economy: 'hover:text-gold',
    utility: 'hover:text-foreground',
  };
  const activeClasses: Record<typeof track, string> = {
    bills: 'text-flag-green border-flag-green',
    economy: 'text-gold border-gold',
    utility: 'text-foreground border-foreground',
  };

  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'inline-flex items-center whitespace-nowrap border-b-2 border-transparent pb-0.5 font-display text-[13px] uppercase tracking-roman text-foreground/75 no-underline transition-colors',
        trackClasses[track],
        active && activeClasses[track],
        className,
      )}
    >
      {label}
    </Link>
  );
}
