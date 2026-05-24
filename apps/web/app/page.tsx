import Link from 'next/link';
import { api } from '@/lib/api';
import { BillCard } from '@/components/bill-card';
import { stageLabel } from '@/lib/utils';
import { getT } from '@/i18n/server';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const t = getT();
  const [stats, recent, topics] = await Promise.all([
    api.stats(),
    api.listBills({ limit: '6', sort: 'last_action_desc' }),
    api.listTopics(),
  ]);

  const topTopics = topics
    .filter((t) => t.billCount > 0)
    .sort((a, b) => b.billCount - a.billCount)
    .slice(0, 10);

  return (
    <div>
      {/* Hero — imperial inscription */}
      <section className="relative border-b border-border">
        <div className="container-wide py-24 sm:py-32">
          <p className="roman-eyebrow">{t('home.eyebrow')}</p>
          <h1 className="mt-4 max-w-4xl font-display text-4xl font-semibold uppercase leading-[1.05] tracking-tight text-foreground sm:text-6xl">
            {t('home.hero.title')}
          </h1>
          <div className="mt-6 h-px max-w-md bg-gradient-to-r from-gold via-gold/40 to-transparent" aria-hidden />
          <p className="mt-6 max-w-2xl font-serif text-lg leading-relaxed text-foreground/85 sm:text-xl">
            {t('home.hero.subtitle')}
          </p>

          <form action="/bills" method="get" className="mt-10 flex max-w-2xl flex-col gap-2 sm:flex-row">
            <input
              name="q"
              type="search"
              placeholder={t('home.hero.search_placeholder')}
              className="flex-1 rounded-md border border-border bg-card px-4 py-3 text-base shadow-sm focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30"
            />
            <button
              type="submit"
              className="rounded-md bg-foreground px-6 py-3 font-display text-xs font-semibold uppercase tracking-roman text-background shadow-sm transition-colors hover:bg-gold hover:text-background"
            >
              {t('home.hero.cta_search')}
            </button>
          </form>

          <div className="mt-6 flex flex-wrap items-center gap-2 text-sm">
            <Link href="/find-my-rep" className="chip">{t('home.hero.cta_find_rep')}</Link>
            <Link href="/contribute" className="chip">{t('home.hero.cta_contribute')}</Link>
            <Link href="/topics" className="chip">{t('home.hero.cta_topics')}</Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-b border-border bg-card/40">
        <div className="container-wide grid grid-cols-2 gap-8 py-12 sm:grid-cols-4">
          <Stat label={t('home.stats.bills_tracked')} value={stats.totalBills.toLocaleString()} />
          <Stat label={t('home.stats.in_review')} value={stats.totalSensitive.toLocaleString()} />
          <Stat label={t('home.stats.active_stages')} value={stats.byStage.filter((s) => s.count > 0).length.toString()} />
          <Stat label={t('home.stats.chambers')} value={stats.byJurisdiction.filter((j) => j.count > 0).length.toString()} />
        </div>
      </section>

      {/* Recent */}
      <section className="container-wide py-20">
        <SectionHeader
          eyebrow="Forum"
          title={t('home.recent.title')}
          subtitle={t('home.recent.subtitle')}
          link={{ href: '/bills', label: t('home.recent.see_all') }}
        />
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {recent.results.map((bill) => (
            <BillCard key={bill.id} bill={bill} />
          ))}
        </div>
      </section>

      {/* Topics */}
      <section className="border-t border-border">
        <div className="container-wide py-20">
          <SectionHeader
            eyebrow="Tabula"
            title={t('home.topics.title')}
            subtitle={t('home.topics.subtitle')}
          />
          <div className="mt-8 flex flex-wrap gap-2">
            {topTopics.map((t) => (
              <Link key={t.slug} href={`/topics/${t.slug}`} className="chip">
                {t.name} <span className="ml-1 text-muted-foreground">{t.billCount}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Chambers */}
      <section className="border-t border-border bg-card/40">
        <div className="container-wide py-20">
          <SectionHeader
            eyebrow="Curiae"
            title={t('home.chambers.title')}
            subtitle={t('home.chambers.subtitle')}
          />
          <div className="mt-8 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {stats.byJurisdiction
              .filter((j) => j.slug)
              .sort((a, b) => b.count - a.count)
              .map((j) => (
                <Link
                  key={j.slug}
                  href={`/bills?jurisdiction=${j.slug}`}
                  className="flex items-center justify-between rounded-md border border-border bg-card px-4 py-3 no-underline transition-colors hover:border-gold"
                >
                  <span className="font-serif text-base font-medium text-foreground">{j.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">{j.count}</span>
                </Link>
              ))}
          </div>
        </div>
      </section>

      {/* Stage funnel */}
      <section className="border-t border-border">
        <div className="container-wide py-20">
          <SectionHeader
            eyebrow="Cursus Honorum"
            title={t('home.stages.title')}
            subtitle={t('home.stages.subtitle')}
          />
          <div className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
            {stats.byStage
              .filter((s) => s.count > 0)
              .map((s) => (
                <Link
                  key={s.stage}
                  href={`/bills?stage=${s.stage}`}
                  className="rounded-md border border-border bg-card p-4 no-underline transition-colors hover:border-gold"
                >
                  <div className="roman-eyebrow text-[10px]">{stageLabel(s.stage)}</div>
                  <div className="mt-1 font-display text-2xl font-semibold text-foreground">{s.count}</div>
                </Link>
              ))}
          </div>
        </div>
      </section>

      {/* Contribute CTA */}
      <section className="border-t border-border bg-card/40">
        <div className="container-wide py-24 text-center">
          <p className="roman-eyebrow">Civis</p>
          <h2 className="mt-3 font-display text-3xl font-semibold uppercase tracking-tight">
            {t('home.contribute.title')}
          </h2>
          <div className="mx-auto mt-4 h-px w-40 bg-gradient-to-r from-transparent via-gold to-transparent" aria-hidden />
          <p className="mx-auto mt-6 max-w-xl font-serif text-base text-foreground/80">
            {t('home.contribute.subtitle')}
          </p>
          <Link
            href="/contribute"
            className="mt-8 inline-block rounded-md bg-foreground px-6 py-3 font-display text-xs font-semibold uppercase tracking-roman text-background no-underline transition-colors hover:bg-gold hover:text-background"
          >
            {t('home.contribute.cta')}
          </Link>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{value}</div>
      <div className="roman-eyebrow mt-1 text-[10px]">{label}</div>
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  subtitle,
  link,
}: {
  eyebrow?: string;
  title: string;
  subtitle: string;
  link?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow && <p className="roman-eyebrow">{eyebrow}</p>}
        <h2 className="mt-1 font-display text-2xl font-semibold uppercase tracking-tight text-foreground sm:text-3xl">
          {title}
        </h2>
        <p className="mt-2 max-w-xl font-serif text-base text-muted-foreground">{subtitle}</p>
      </div>
      {link && (
        <Link href={link.href} className="font-display text-xs font-medium uppercase tracking-roman text-gold no-underline hover:underline">
          {link.label} →
        </Link>
      )}
    </div>
  );
}
