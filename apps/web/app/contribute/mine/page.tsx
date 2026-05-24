import Link from 'next/link';
import { requireUser, listMyContributions } from '@/lib/session';
import { Badge } from '@/components/ui/badge';
import { formatDate, timeAgo } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const STATUS_VARIANT: Record<string, 'amber' | 'green' | 'red' | 'slate'> = {
  PENDING: 'amber',
  APPROVED: 'green',
  PUBLISHED: 'green',
  REJECTED: 'red',
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pending review',
  APPROVED: 'Approved',
  PUBLISHED: 'Published',
  REJECTED: 'Not accepted',
};

export default async function MySubmissionsPage({ searchParams }: { searchParams: { submitted?: string } }) {
  await requireUser();
  const submissions = await listMyContributions();

  return (
    <div className="container-prose py-12">
      <nav className="text-xs text-muted-foreground">
        <Link href="/contribute" className="hover:underline">Contribute</Link>
        <span className="px-1">›</span>
        <span className="text-foreground/85">My submissions</span>
      </nav>

      <h1 className="mt-3 font-serif text-3xl font-semibold tracking-tight">My submissions</h1>
      <p className="mt-1 text-muted-foreground">
        {submissions.length === 0
          ? 'No submissions yet.'
          : `${submissions.length} submission${submissions.length === 1 ? '' : 's'}. New ones are pending until an editor reviews them.`}
      </p>

      {searchParams.submitted && (
        <p className="mt-4 rounded-md border border-flag-green/30 bg-flag-green/5 px-3 py-2 text-sm text-flag-green-dark">
          Thanks. Your submission is in the editor queue.
        </p>
      )}

      {submissions.length === 0 ? (
        <div className="mt-8 text-center">
          <Link href="/contribute/new" className="rounded-md bg-flag-green px-5 py-2.5 text-sm font-semibold text-white no-underline hover:bg-flag-green-dark">
            Submit your first bill
          </Link>
        </div>
      ) : (
        <ul className="mt-8 divide-y divide-border border-y border-border">
          {submissions.map((s) => (
            <li key={s.id} className="py-5">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-mono font-medium text-foreground/85">{s.billNumber}</span>
                    <span>·</span>
                    <span>{s.jurisdiction.name}</span>
                    <span>·</span>
                    <span>submitted {timeAgo(s.createdAt)}</span>
                  </div>
                  <h3 className="mt-1 font-serif text-lg leading-snug">
                    {s.publishedBillId ? (
                      <Link href={`/bills/${s.jurisdiction.slug}/${s.publishedBillId}`} className="text-foreground no-underline hover:text-flag-green-dark">
                        {s.title}
                      </Link>
                    ) : (
                      <span>{s.title}</span>
                    )}
                  </h3>
                  {s.summary && <p className="mt-1 text-sm text-muted-foreground">{s.summary}</p>}
                </div>
                <Badge variant={STATUS_VARIANT[s.status] ?? 'slate'}>{STATUS_LABEL[s.status] ?? s.status}</Badge>
              </div>
              {s.reviewerNote && (
                <div className="mt-3 rounded-md border border-border bg-muted px-3 py-2 text-sm">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Editor note</div>
                  <p className="mt-1 text-foreground/85">{s.reviewerNote}</p>
                  {s.reviewedAt && <div className="mt-1 text-xs text-muted-foreground">{formatDate(s.reviewedAt)}</div>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
