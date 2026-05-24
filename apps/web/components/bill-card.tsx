import Link from 'next/link';
import { StagePill } from './ui/stage-pill';
import { Badge } from './ui/badge';
import { formatDate, timeAgo } from '@/lib/utils';
import type { BillListItem } from '@/lib/types';

export function BillCard({ bill }: { bill: BillListItem }) {
  return (
    <article className="group rounded-md border border-border bg-card p-5 transition-all hover:border-gold hover:shadow-[0_0_0_1px_hsl(var(--gold)/0.4)]">
      <div className="flex flex-wrap items-center gap-2 font-display text-[10px] uppercase tracking-roman text-muted-foreground">
        <span className="font-mono text-[11px] font-medium not-italic text-gold">{bill.billNumber}</span>
        <span aria-hidden>·</span>
        <span>{bill.jurisdiction.name}</span>
        <span aria-hidden>·</span>
        <span>introduced {formatDate(bill.introducedDate)}</span>
        {bill.lastActionDate && (
          <>
            <span aria-hidden>·</span>
            <span>last action {timeAgo(bill.lastActionDate)}</span>
          </>
        )}
      </div>
      <h3 className="mt-3 font-serif text-xl leading-snug">
        <Link
          href={`/bills/${bill.jurisdiction.slug}/${bill.slug}`}
          className="text-foreground no-underline transition-colors group-hover:text-gold"
        >
          {bill.title}
        </Link>
      </h3>
      {bill.summaryShort && (
        <p className="mt-2 line-clamp-2 font-serif text-[15px] leading-relaxed text-foreground/85">{bill.summaryShort}</p>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <StagePill stage={bill.currentStage} />
        {bill.sensitiveFlag && <Badge variant="amber">Sensitive · review</Badge>}
        {bill.topics.slice(0, 3).map((t) => (
          <Link key={t.slug} href={`/topics/${t.slug}`} className="no-underline">
            <Badge variant="outline">{t.name}</Badge>
          </Link>
        ))}
      </div>
      {bill.primarySponsor && (
        <div className="mt-4 font-serif text-sm italic text-muted-foreground">
          Sponsored by{' '}
          <Link href={`/legislators/${bill.primarySponsor.slug}`} className="text-foreground/85 no-underline hover:text-gold hover:underline">
            {bill.primarySponsor.fullName}
          </Link>
          {bill.primarySponsor.party ? ` (${bill.primarySponsor.party})` : ''}
          {bill.sponsorCount > 1 ? ` and ${bill.sponsorCount - 1} other${bill.sponsorCount > 2 ? 's' : ''}` : ''}
        </div>
      )}
    </article>
  );
}
