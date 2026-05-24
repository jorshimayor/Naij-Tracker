import Link from 'next/link';
import { getT } from '@/i18n/server';

export function Footer() {
  const t = getT();
  return (
    <footer className="mt-24 border-t border-border bg-card/40">
      <div className="container-wide grid gap-10 py-14 text-sm sm:grid-cols-4">
        <div className="sm:col-span-2">
          <div className="flex items-center gap-3">
            <span className="inline-block h-6 w-1.5 rounded-sm bg-gold" aria-hidden />
            <span className="font-display text-base font-semibold uppercase tracking-roman text-foreground">
              {t('brand')}
            </span>
          </div>
          <p className="mt-4 max-w-md text-foreground/80">{t('footer.tagline')}</p>
        </div>
        <div>
          <div className="roman-eyebrow">{t('footer.explore')}</div>
          <ul className="mt-3 space-y-2 text-foreground/80">
            <li><Link className="link-quiet no-underline" href="/bills">{t('nav.bills')}</Link></li>
            <li><Link className="link-quiet no-underline" href="/topics">{t('nav.topics')}</Link></li>
            <li><Link className="link-quiet no-underline" href="/legislators">{t('nav.legislators')}</Link></li>
            <li><Link className="link-quiet no-underline" href="/find-my-rep">{t('nav.find_my_rep')}</Link></li>
          </ul>
        </div>
        <div>
          <div className="roman-eyebrow">{t('footer.take_part')}</div>
          <ul className="mt-3 space-y-2 text-foreground/80">
            <li><Link className="link-quiet no-underline" href="/contribute">{t('footer.contribute')}</Link></li>
            <li><Link className="link-quiet no-underline" href="/me/following">{t('footer.my_following')}</Link></li>
            <li><Link className="link-quiet no-underline" href="/about">{t('footer.methodology')}</Link></li>
            <li><Link className="link-quiet no-underline" href="/admin/login">{t('footer.editor_signin')}</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border py-5 text-center font-display text-[11px] uppercase tracking-roman text-muted-foreground">
        ✦ {t('footer.notice')} ✦
      </div>
    </footer>
  );
}
