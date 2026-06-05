import { api } from '@/lib/api';
import { IndicatorCard } from '@/components/economy/indicator-card';
import type { IndicatorListItem, IndicatorPillar } from '@/lib/types';

export const dynamic = 'force-dynamic';

const PILLAR_LABELS: Record<IndicatorPillar, string> = {
  MONEY_PRICES: 'Money & prices',
  FX_EXTERNAL: 'FX & external sector',
  MARKETS: 'Markets & capital',
  PUBLIC_FINANCE: 'Public finance',
  DEBT: 'Debt',
  REAL_ECONOMY: 'Real economy & people',
};

const PILLAR_ORDER: IndicatorPillar[] = [
  'MONEY_PRICES',
  'FX_EXTERNAL',
  'MARKETS',
  'PUBLIC_FINANCE',
  'DEBT',
  'REAL_ECONOMY',
];

export default async function EconomyPage() {
  const { results: indicators } = await api.listIndicators();
  const byPillar = new Map<IndicatorPillar, IndicatorListItem[]>();
  for (const i of indicators) {
    if (!byPillar.has(i.pillar)) byPillar.set(i.pillar, []);
    byPillar.get(i.pillar)!.push(i);
  }

  const withData = indicators.filter((i) => i.latest !== null);

  return (
    <div className="container-wide py-10">
      <header className="mb-10">
        <p className="roman-eyebrow">Œconomia Nigerica</p>
        <h1 className="mt-1 font-display text-3xl font-semibold uppercase tracking-tight text-foreground sm:text-4xl">
          Economy
        </h1>
        <p className="mt-2 max-w-prose font-serif text-base text-muted-foreground">
          Every important economic indicator about Nigeria — in plain English. From inflation
          and FX to debt and growth. Tracked alongside the legislation that touches it.
        </p>
        <div className="mt-4 rounded-md border border-amber-300/40 bg-amber-50/40 px-4 py-3 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/5 dark:text-amber-200">
          <strong className="font-semibold uppercase tracking-roman">Sample data.</strong>{' '}
          v0 indicator values are illustrative fixtures, not official NBS / CBN / DMO figures.
          Live ingestion connectors slot into the same pipeline.
        </div>
      </header>

      {indicators.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center text-muted-foreground">
          No indicators yet. Run{' '}
          <code className="rounded bg-muted px-1.5 py-0.5 text-foreground/85">npm run db:seed</code>{' '}
          to load the indicator catalogue.
        </div>
      ) : (
        <div className="space-y-12">
          {PILLAR_ORDER.map((pillar) => {
            const list = byPillar.get(pillar) ?? [];
            if (list.length === 0) return null;
            const withDataInPillar = list.filter((i) => i.latest !== null).length;
            return (
              <section key={pillar}>
                <header className="mb-4 flex items-baseline justify-between gap-3 border-b border-border pb-2">
                  <h2 className="font-display text-xl font-semibold uppercase tracking-roman text-foreground">
                    {PILLAR_LABELS[pillar]}
                  </h2>
                  <span className="font-display text-[10px] uppercase tracking-roman text-muted-foreground">
                    {withDataInPillar}/{list.length} live
                  </span>
                </header>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {list.map((indicator) => (
                    <IndicatorCard key={indicator.slug} indicator={indicator} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <footer className="mt-16 border-t border-border pt-6 text-xs text-muted-foreground">
        <p>
          {withData.length} of {indicators.length} indicators have at least one observation in v0.
          The remaining indicators are catalogued and awaiting their first release.
        </p>
        <p className="mt-1">
          Every indicator explainer is AI-generated and (for sensitive series) human-reviewed
          before publication. See <a href="/about" className="text-foreground/85 underline-offset-2 hover:text-gold hover:underline">methodology</a>.
        </p>
      </footer>
    </div>
  );
}
