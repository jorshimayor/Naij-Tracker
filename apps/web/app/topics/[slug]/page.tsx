import { notFound } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { StagePill } from '@/components/ui/stage-pill';
import { FollowButton } from '@/components/bill-detail/follow-button';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function TopicPage({ params }: { params: { slug: string } }) {
  let topic: Awaited<ReturnType<typeof api.getTopic>>;
  try {
    topic = await api.getTopic(params.slug);
  } catch {
    notFound();
  }
  return (
    <div className="container-wide py-10">
      <nav className="text-xs text-muted-foreground">
        <Link href="/topics" className="hover:underline">Topics</Link>
        <span className="px-1">›</span>
        <span className="text-foreground/85">{topic.name}</span>
      </nav>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">{topic.name}</h1>
          <p className="text-sm text-muted-foreground">{topic.bills.length} bills tracked under this topic.</p>
        </div>
        <FollowButton
          targetType="TOPIC"
          targetId={topic.slug}
          revalidate={`/topics/${topic.slug}`}
          followLabel="Follow this topic"
        />
      </div>

      {topic.bills.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          No bills tagged with this topic yet.
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {topic.bills.map((b) => (
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
                {b.primarySponsor && (
                  <span className="text-xs text-muted-foreground">
                    Sponsored by{' '}
                    <Link href={`/legislators/${b.primarySponsor.slug}`} className="link-quiet">
                      {b.primarySponsor.fullName}
                    </Link>
                  </span>
                )}
                {b.confidence !== undefined && (
                  <span className="text-xs text-muted-foreground">match confidence {(b.confidence * 100).toFixed(0)}%</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
