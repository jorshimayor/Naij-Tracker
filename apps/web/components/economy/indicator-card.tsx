import Link from 'next/link';
import { Badge } from '../ui/badge';
import type { IndicatorListItem } from '@/lib/types';

function formatValue(v: number, unitLabel: string): string {
  const formatted =
    Math.abs(v) >= 1000
      ? v.toLocaleString('en-US', { maximumFractionDigits: 0 })
      : v.toFixed(2);
  // No space before "%" only — every other unit ($bn, ₦ / $, pts, mbpd) reads better with a gap.
  const sep = unitLabel.startsWith('%') ? '' : ' ';
  return `${formatted}${sep}${unitLabel}`;
}

function ChangeChip({ change, unitLabel }: { change: number; unitLabel: string }) {
  const up = change > 0;
  const down = change < 0;
  const variant = up ? 'red' : down ? 'green' : 'slate';
  const arrow = up ? '▲' : down ? '▼' : '–';
  const value = Math.abs(change);
  const display = value >= 1000 ? value.toLocaleString('en-US', { maximumFractionDigits: 0 }) : value.toFixed(2);
  // Note: rising inflation is "bad" but rising reserves is "good". We can't know intent here;
  // colour is purely directional in v0. PRD §6.4 narrative layer will eventually contextualize.
  return (
    <Badge variant={variant}>
      {arrow} {display}{unitLabel.startsWith('%') ? unitLabel : ''}
    </Badge>
  );
}

export function IndicatorCard({ indicator }: { indicator: IndicatorListItem }) {
  return (
    <article className="group flex flex-col rounded-md border border-border bg-card p-5 transition-all hover:border-gold hover:shadow-[0_0_0_1px_hsl(var(--gold)/0.4)]">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <p className="font-display text-[10px] uppercase tracking-roman text-muted-foreground">
            {indicator.source.acronym ?? indicator.source.name} · {indicator.frequency.toLowerCase()}
          </p>
          <h3 className="mt-1 font-serif text-lg leading-snug">
            <Link
              href={`/economy/indicators/${indicator.slug}`}
              className="text-foreground no-underline transition-colors group-hover:text-gold"
            >
              {indicator.name}
            </Link>
          </h3>
        </div>
        {indicator.sensitiveFlag && <Badge variant="amber">Sensitive</Badge>}
      </div>

      {indicator.latest ? (
        <>
          <div className="mt-4 flex items-baseline gap-3">
            <div className="font-display text-3xl font-semibold text-foreground">
              {formatValue(indicator.latest.value, indicator.unitLabel)}
            </div>
            {indicator.latest.change !== null && (
              <ChangeChip change={indicator.latest.change} unitLabel={indicator.unitLabel} />
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            as of {new Date(indicator.latest.date).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
          </p>
        </>
      ) : (
        <div className="mt-4 text-sm italic text-muted-foreground">Awaiting first release</div>
      )}

      {indicator.explainerTldr && (
        <p className="mt-4 line-clamp-3 font-serif text-sm leading-relaxed text-foreground/80">
          {indicator.explainerTldr}
        </p>
      )}

      <div className="mt-auto pt-4 text-[11px] uppercase tracking-roman text-muted-foreground/80">
        <Link
          href={`/economy/indicators/${indicator.slug}`}
          className="font-display no-underline transition-colors hover:text-gold"
        >
          View chart →
        </Link>
      </div>
    </article>
  );
}
