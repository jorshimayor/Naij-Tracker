import Link from 'next/link';
import { ThemeToggle } from './theme-toggle';
import { LangSwitcher } from './lang-switcher';
import { getCurrentUser } from '@/lib/session';
import { getT, getLocale } from '@/i18n/server';

export async function Nav() {
  const user = await getCurrentUser();
  const locale = getLocale();
  const t = getT(locale);

  const LINKS = [
    { href: '/bills',        label: t('nav.bills') },
    { href: '/topics',       label: t('nav.topics') },
    { href: '/legislators',  label: t('nav.legislators') },
    { href: '/find-my-rep',  label: t('nav.find_my_rep') },
    { href: '/contribute',   label: t('nav.contribute') },
    { href: '/about',        label: t('nav.about') },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
      <div className="container-wide flex items-center justify-between gap-4 py-3">
        <Link href="/" className="flex items-center gap-3 no-underline">
          <span className="inline-block h-7 w-1.5 rounded-sm bg-gold" aria-hidden />
          <span className="font-display text-base font-semibold uppercase tracking-roman text-foreground sm:text-lg">
            {t('brand')}
          </span>
        </Link>

        {/* Desktop */}
        <nav aria-label="Primary" className="hidden items-center gap-6 text-sm md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="font-display text-[13px] uppercase tracking-roman text-foreground/75 no-underline transition-colors hover:text-gold"
            >
              {l.label}
            </Link>
          ))}
          <span className="h-5 w-px bg-border" aria-hidden />
          {user ? (
            <Link href="/me" className="chip">
              {user.displayName ?? user.email.split('@')[0]}
            </Link>
          ) : (
            <Link href="/login" className="chip">{t('nav.sign_in')}</Link>
          )}
          <LangSwitcher current={locale} />
          <ThemeToggle />
        </nav>

        {/* Mobile */}
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
            <div className="absolute right-0 top-full mt-2 w-60 rounded-md border border-border bg-card p-2 shadow-lg">
              <nav aria-label="Mobile" className="flex flex-col">
                {LINKS.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    className="rounded px-3 py-2 font-display text-xs uppercase tracking-roman text-foreground no-underline hover:bg-muted hover:text-gold"
                  >
                    {l.label}
                  </Link>
                ))}
                <div className="my-1 h-px bg-border" aria-hidden />
                <Link
                  href={user ? '/me' : '/login'}
                  className="rounded px-3 py-2 font-display text-xs uppercase tracking-roman text-foreground no-underline hover:bg-muted hover:text-gold"
                >
                  {user ? t('nav.your_account') : t('nav.sign_in')}
                </Link>
              </nav>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
