import Link from 'next/link';
import { notFound } from 'next/navigation';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { IndicatorChart } from '@/components/economy/indicator-chart';
import { formatDate } from '@/lib/utils';
import type { IndicatorPillar } from '@/lib/types';

export const dynamic = 'force-dynamic';

const PILLAR_LABELS: Record<IndicatorPillar, string> = {
  MONEY_PRICES: 'Money & prices',
  FX_EXTERNAL: 'FX & external sector',
  MARKETS: 'Markets & capital',
  PUBLIC_FINANCE: 'Public finance',
  DEBT: 'Debt',
  REAL_ECONOMY: 'Real economy & people',
};

function formatValue(v: number, unitLabel: string): string {
  const formatted =
    Math.abs(v) >= 1000
      ? v.toLocaleString('en-US', { maximumFractionDigits: 0 })
      : v.toFixed(2);
  const sep = unitLabel.startsWith('%') ? '' : ' ';
  return `${formatted}${sep}${unitLabel}`;
}

function ChangeLine({
  label,
  change,
  unitLabel,
}: {
  label: string;
  change: number | null;
  unitLabel: string;
}) {
  if (change === null) {
    return (
      <div>
        <div className="font-display text-[10px] uppercase tracking-roman text-muted-foreground">{label}</div>
        <div className="font-display text-sm text-muted-foreground">n/a</div>
      </div>
    );
  }
  const arrow = change > 0 ? '▲' : change < 0 ? '▼' : '–';
  const color = change > 0 ? 'text-porphyry' : change < 0 ? 'text-flag-green' : 'text-muted-foreground';
  const value = Math.abs(change);
  const display = value >= 1000 ? value.toLocaleString('en-US', { maximumFractionDigits: 0 }) : value.toFixed(2);
  return (
    <div>
      <div className="font-display text-[10px] uppercase tracking-roman text-muted-foreground">{label}</div>
      <div className={`font-display text-sm font-semibold ${color}`}>
        {arrow} {display}{unitLabel.startsWith('%') ? unitLabel : ''}
      </div>
    </div>
  );
}

export default async function IndicatorDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  let indicator;
  try {
    indicator = await api.getIndicator(params.slug);
  } catch {
    notFound();
  }

  const latest = indicator.latest;

  return (
    <div className="container-wide py-10">
      <nav aria-label="Breadcrumb" className="mb-4 font-display text-[10px] uppercase tracking-roman text-muted-foreground">
        <Link href="/economy" className="no-underline hover:text-gold">Economy</Link>
        <span aria-hidden> · </span>
        <span>{PILLAR_LABELS[indicator.pillar]}</span>
      </nav>

      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="flex-1">
          <p className="roman-eyebrow">{indicator.source.acronym ?? indicator.source.name}</p>
          <h1 className="mt-1 font-display text-3xl font-semibold uppercase tracking-tight text-foreground sm:text-4xl">
            {indicator.name}
          </h1>
          {indicator.description && (
            <p className="mt-2 max-w-prose font-serif text-base text-muted-foreground">
              {indicator.description}
            </p>
          )}
        </div>
        {indicator.sensitiveFlag && <Badge variant="amber">Sensitive · editorial review</Badge>}
      </header>

      {latest ? (
        <section className="mb-8 grid gap-6 rounded-lg border border-border bg-card p-6 lg:grid-cols-[1fr_2fr]">
          <div className="flex flex-col justify-center">
            <div className="font-display text-[10px] uppercase tracking-roman text-muted-foreground">Latest</div>
            <div className="mt-1 font-display text-5xl font-semibold text-foreground">
              {formatValue(latest.value, indicator.unitLabel)}
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              as of {formatDate(latest.date)}
            </div>
            <div className="mt-6 grid grid-cols-2 gap-4">
              <ChangeLine label="vs prior" change={indicator.changeVsPrevious} unitLabel={indicator.unitLabel} />
              <ChangeLine label="vs year ago" change={indicator.changeVsYearAgo} unitLabel={indicator.unitLabel} />
            </div>
          </div>
          <div>
            <IndicatorChart
              observations={indicator.observations}
              ariaLabel={`${indicator.name} time series`}
            />
          </div>
        </section>
      ) : (
        <section className="mb-8 rounded-lg border border-dashed border-border bg-card p-6 text-muted-foreground">
          No observations on file yet. Once {indicator.source.name} publishes the next release,
          the indicator will populate here automatically.
        </section>
      )}

      {indicator.explainer?.visible ? (
        <section className="mb-8 rounded-lg border border-border bg-card p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-semibold uppercase tracking-roman text-foreground">
              In plain English
            </h2>
            <Badge variant="gold">AI-generated · {indicator.explainer.modelUsed}</Badge>
          </div>
          {indicator.explainer.tldr && (
            <p className="mb-4 font-serif text-lg leading-relaxed text-foreground">
              {indicator.explainer.tldr}
            </p>
          )}
          {indicator.explainer.plainEnglish && (
            <div className="font-serif text-[15px] leading-relaxed text-foreground/85 whitespace-pre-line">
              {indicator.explainer.plainEnglish}
            </div>
          )}
          {indicator.explainer.whatChanged && (
            <div className="mt-6">
              <h3 className="mb-2 font-display text-xs font-semibold uppercase tracking-roman text-muted-foreground">
                What just changed
              </h3>
              <p className="font-serif text-[15px] leading-relaxed text-foreground/85">
                {indicator.explainer.whatChanged}
              </p>
            </div>
          )}
          {indicator.explainer.howItAffectsYou && indicator.explainer.howItAffectsYou.length > 0 && (
            <div className="mt-6">
              <h3 className="mb-2 font-display text-xs font-semibold uppercase tracking-roman text-muted-foreground">
                How it affects you
              </h3>
              <ul className="space-y-1.5 font-serif text-[15px] leading-relaxed text-foreground/85">
                {indicator.explainer.howItAffectsYou.map((bullet, i) => (
                  <li key={i} className="flex gap-2">
                    <span aria-hidden className="text-gold">•</span>
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      ) : indicator.explainer ? (
        <section className="mb-8 rounded-lg border border-amber-300/40 bg-amber-50/40 p-6 dark:border-amber-500/30 dark:bg-amber-500/5">
          <h2 className="mb-2 font-display text-sm font-semibold uppercase tracking-roman text-amber-900 dark:text-amber-200">
            Pending editorial review
          </h2>
          <p className="font-serif text-sm leading-relaxed text-amber-900/90 dark:text-amber-200/90">
            This indicator is flagged sensitive. An AI-generated explainer has been drafted and is
            awaiting human review before public display.
          </p>
        </section>
      ) : null}

      {indicator.relatedBills.length > 0 && (
        <section className="mb-8 rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 font-display text-lg font-semibold uppercase tracking-roman text-foreground">
            Related legislation
          </h2>
          <ul className="space-y-3">
            {indicator.relatedBills.map((b) => (
              <li key={b.slug} className="border-b border-border pb-3 last:border-0 last:pb-0">
                <div className="flex flex-wrap items-baseline gap-2 font-display text-[10px] uppercase tracking-roman text-muted-foreground">
                  <span className="font-mono text-[11px] text-gold">{b.billNumber}</span>
                  <span aria-hidden>·</span>
                  <span>{b.jurisdiction.name}</span>
                  <span aria-hidden>·</span>
                  <span>{b.currentStage.toLowerCase().replace(/_/g, ' ')}</span>
                </div>
                <Link
                  href={`/bills/${b.jurisdiction.slug}/${b.slug}`}
                  className="mt-1 block font-serif text-base leading-snug text-foreground no-underline hover:text-gold"
                >
                  {b.title}
                </Link>
                {b.note && (
                  <p className="mt-1 font-serif text-sm italic text-muted-foreground">{b.note}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-roman text-foreground">
          Methodology & source
        </h2>
        <dl className="grid gap-3 sm:grid-cols-2 text-sm">
          <div>
            <dt className="text-muted-foreground">Source</dt>
            <dd className="font-serif text-foreground">
              {indicator.source.homepageUrl ? (
                <a href={indicator.source.homepageUrl} className="hover:text-gold hover:underline">
                  {indicator.source.name}
                </a>
              ) : (
                indicator.source.name
              )}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Frequency</dt>
            <dd className="font-serif text-foreground">{indicator.frequency.toLowerCase()}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Unit</dt>
            <dd className="font-serif text-foreground">{indicator.unitLabel} ({indicator.unit})</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Pillar</dt>
            <dd className="font-serif text-foreground">{PILLAR_LABELS[indicator.pillar]}</dd>
          </div>
        </dl>
        <p className="mt-4 text-xs text-muted-foreground">
          v0 data is loaded from bundled fixtures and is illustrative only. The same pipeline
          accepts live source connectors without code changes elsewhere.
        </p>
      </section>
    </div>
  );
}
