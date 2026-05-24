import { notFound } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { StagePill } from '@/components/ui/stage-pill';
import { FollowButton } from '@/components/bill-detail/follow-button';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function LegislatorPage({ params }: { params: { slug: string } }) {
  let leg: Awaited<ReturnType<typeof api.getLegislator>>;
  try {
    leg = await api.getLegislator(params.slug);
  } catch {
    notFound();
  }

  const primary = leg.bills.filter((b) => b.role === 'PRIMARY');
  const co = leg.bills.filter((b) => b.role === 'CO_SPONSOR');

  return (
    <div className="container-wide py-10">
      <nav className="text-xs text-muted-foreground">
        <Link href="/legislators" className="hover:underline">Legislators</Link>
        <span className="px-1">›</span>
        <span className="text-foreground/85">{leg.fullName}</span>
      </nav>

      <header className="mt-2">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">{leg.fullName}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-foreground/85">
          {leg.party && <Badge variant="outline">{leg.party}</Badge>}
          <span>·</span>
          <span>{leg.chamber}</span>
          {leg.constituency && (<><span>·</span><span>{leg.constituency}</span></>)}
          {leg.state && (<><span>·</span><span>{leg.state}</span></>)}
        </div>
        {leg.contactEmail && (
          <p className="mt-3 text-sm">
            <a className="text-flag-green-dark hover:underline" href={`mailto:${leg.contactEmail}`}>{leg.contactEmail}</a>
          </p>
        )}
        <div className="mt-4">
          <FollowButton
            targetType="SPONSOR"
            targetId={leg.slug}
            revalidate={`/legislators/${leg.slug}`}
            followLabel={`Follow ${leg.fullName.split(' ')[0] || 'this legislator'}`}
          />
        </div>
      </header>

      <BillsList title="Bills sponsored (primary)" rows={primary} />
      <BillsList title="Bills co-sponsored" rows={co} />
    </div>
  );
}

function BillsList({
  title,
  rows,
}: {
  title: string;
  rows: { role: string; bill: any }[];
}) {
  if (rows.length === 0) return null;
  return (
    <section className="mt-10">
      <h2 className="font-serif text-xl font-semibold tracking-tight">{title} ({rows.length})</h2>
      <ul className="mt-3 space-y-2">
        {rows.map(({ bill: b }) => (
          <li key={`${b.jurisdiction.slug}/${b.slug}`} className="rounded-lg border border-border bg-card p-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="font-mono font-medium text-foreground/85">{b.billNumber}</span>
              <span>·</span>
              <span>{b.jurisdiction.name}</span>
              <span>·</span>
              <span>last action {formatDate(b.lastActionDate)}</span>
            </div>
            <Link
              href={`/bills/${b.jurisdiction.slug}/${b.slug}`}
              className="mt-1 block font-serif text-lg leading-snug text-foreground no-underline hover:text-flag-green-dark"
            >
              {b.title}
            </Link>
            {b.summaryShort && <p className="mt-1 text-sm text-foreground/85">{b.summaryShort}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StagePill stage={b.currentStage} />
              {b.topics.map((t: any) => (
                <Link key={t.slug} href={`/topics/${t.slug}`} className="no-underline">
                  <Badge variant="outline">{t.name}</Badge>
                </Link>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
