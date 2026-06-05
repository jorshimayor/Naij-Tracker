import Link from 'next/link';
import { ThemeToggle } from './theme-toggle';
import { LangSwitcher } from './lang-switcher';
import { NavLink } from './nav-link';
import { getCurrentUser } from '@/lib/session';
import { getT, getLocale } from '@/i18n/server';

/**
 * Top nav is split into two product tracks plus a utility group:
 *   - Bills track (flag-green accent):   Bills · Topics · Legislators · Find my rep
 *   - Economy track (gold accent):       Economy
 *   - Utility group (muted):             Contribute · About
 * Each track has its own subtle eyebrow above the links, and active routes pick up
 * the track's accent colour. The two products live on the same domain but read as
 * sibling surfaces, not one big undifferentiated list.
 */
export async function Nav() {
  const user = await getCurrentUser();
  const locale = getLocale();
  const t = getT(locale);

  const BILLS = [
    { href: '/bills',        label: t('nav.bills') },
    { href: '/topics',       label: t('nav.topics') },
    { href: '/legislators',  label: t('nav.legislators') },
    { href: '/find-my-rep',  label: t('nav.find_my_rep') },
    { href: '/states',       label: 'States' },
  ];
  const ECONOMY = [
    { href: '/economy',      label: 'Economy' },
  ];
  const UTILITY = [
    { href: '/contribute',   label: t('nav.contribute') },
    { href: '/about',        label: t('nav.about') },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
      <div className="container-wide flex items-center justify-between gap-4 py-3">
        <Link href="/" className="flex shrink-0 items-center gap-2 no-underline">
          <span className="inline-block h-6 w-1.5 rounded-sm bg-gold" aria-hidden />
          <span className="whitespace-nowrap font-display text-sm font-semibold uppercase tracking-roman text-foreground xl:text-base">
            {t('brand')}
          </span>
        </Link>

        {/* Desktop nav: two tracks + utility, separated by hairline dividers. */}
        <nav aria-label="Primary" className="hidden items-center gap-3 text-sm md:flex xl:gap-5">
          <div className="flex items-center gap-0.5" aria-label="Bills track">
            <span className="mr-1 h-1.5 w-1.5 rounded-full bg-flag-green" aria-hidden />
            {BILLS.map((l) => (
              <NavLink key={l.href} href={l.href} label={l.label} track="bills" className="px-1.5" />
            ))}
          </div>

          <span className="h-5 w-px bg-border" aria-hidden />

          <div className="flex items-center gap-0.5" aria-label="Economy track">
            <span className="mr-1 h-1.5 w-1.5 rounded-full bg-gold" aria-hidden />
            {ECONOMY.map((l) => (
              <NavLink key={l.href} href={l.href} label={l.label} track="economy" className="px-1.5" />
            ))}
          </div>

          {/* Utility group + lang switcher only appear on wider screens to keep the two product
              tracks the focal point at mid-widths. */}
          <span className="hidden h-5 w-px bg-border lg:inline-block" aria-hidden />

          <div className="hidden items-center gap-0.5 lg:flex" aria-label="Utility">
            {UTILITY.map((l) => (
              <NavLink key={l.href} href={l.href} label={l.label} track="utility" className="px-1.5" />
            ))}
          </div>

          <span className="hidden h-5 w-px bg-border xl:inline-block" aria-hidden />

          {user ? (
            <Link href="/me" className="chip">
              {user.displayName ?? user.email.split('@')[0]}
            </Link>
          ) : (
            <Link href="/login" className="chip">{t('nav.sign_in')}</Link>
          )}
          <div className="hidden lg:contents">
            <LangSwitcher current={locale} />
          </div>
          <ThemeToggle />
        </nav>

        {/* Mobile menu: grouped to mirror desktop tracks. */}
        <div className="flex items-center gap-1.5 md:hidden">
          <LangSwitcher current={locale} />
          <ThemeToggle />
          <details className="relative">
            <summary
              aria-label={t('nav.menu')}
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-border bg-card text-muted-foreground [&::-webkit-details-marker]:hidden"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                <path d="M3 5h14v2H3zM3 9h14v2H3zM3 13h14v2H3z" />
              </svg>
            </summary>
            <div className="absolute right-0 top-full mt-2 w-64 rounded-md border border-border bg-card p-3 shadow-lg">
              <nav aria-label="Mobile" className="flex flex-col gap-3">
                <MobileSection title="Bills" dotClass="bg-flag-green">
                  {BILLS.map((l) => (
                    <MobileLink key={l.href} href={l.href} label={l.label} />
                  ))}
                </MobileSection>
                <div className="h-px bg-border" aria-hidden />
                <MobileSection title="Economy" dotClass="bg-gold">
                  {ECONOMY.map((l) => (
                    <MobileLink key={l.href} href={l.href} label={l.label} />
                  ))}
                </MobileSection>
                <div className="h-px bg-border" aria-hidden />
                <MobileSection title="More" dotClass="bg-muted-foreground/60">
                  {UTILITY.map((l) => (
                    <MobileLink key={l.href} href={l.href} label={l.label} />
                  ))}
                  <MobileLink
                    href={user ? '/me' : '/login'}
                    label={user ? t('nav.your_account') : t('nav.sign_in')}
                  />
                </MobileSection>
              </nav>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}

function MobileSection({
  title,
  dotClass,
  children,
}: {
  title: string;
  dotClass: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5 px-1 font-display text-[10px] uppercase tracking-roman text-muted-foreground">
        <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} aria-hidden />
        {title}
      </div>
      <div className="flex flex-col">{children}</div>
    </div>
  );
}

function MobileLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded px-3 py-1.5 font-display text-xs uppercase tracking-roman text-foreground no-underline hover:bg-muted hover:text-gold"
    >
      {label}
    </Link>
  );
}
