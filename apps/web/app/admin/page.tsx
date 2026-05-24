import Link from 'next/link';
import { adminFetch, requireAdminCookie, type QueueItem } from '@/lib/admin';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, string> = {
  PENDING_REVIEW: 'Pending review',
  FLAGGED: 'Flagged',
  DRAFT: 'Draft',
  AUTO_APPROVED: 'Auto-approved',
  APPROVED: 'Approved',
};

export default async function AdminDashboardPage() {
  requireAdminCookie();
  const queue = await adminFetch<QueueItem[]>('/api/admin/queue');

  const buckets: Record<string, QueueItem[]> = {};
  for (const item of queue) {
    const status = item.explainer?.status ?? 'NONE';
    (buckets[status] ??= []).push(item);
  }

  const pendingReview = buckets.PENDING_REVIEW ?? [];
  const flagged = buckets.FLAGGED ?? [];

  return (
    <div>
      <h1 className="font-serif text-3xl font-semibold tracking-tight">Editorial dashboard</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Reviewing {queue.length} bills currently in the system. Items needing attention are at the top.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Pending review" value={pendingReview.length} accent="amber" />
        <Stat label="Flagged" value={flagged.length} accent="red" />
        <Stat label="Auto-approved" value={(buckets.AUTO_APPROVED ?? []).length} accent="slate" />
        <Stat label="Approved" value={(buckets.APPROVED ?? []).length} accent="green" />
      </div>

      <section className="mt-8">
        <h2 className="font-serif text-xl font-semibold tracking-tight">Needs your attention</h2>
        <p className="text-sm text-muted-foreground">Sensitive bills the AI flagged, plus anything an editor previously flagged.</p>
        <ul className="mt-3 space-y-2">
          {[...pendingReview, ...flagged].slice(0, 12).map((item) => (
            <ReviewRow key={item.billId} item={item} />
          ))}
          {pendingReview.length + flagged.length === 0 && (
            <li className="rounded-lg border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
              All caught up. Nothing currently needs editorial review.
            </li>
          )}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="font-serif text-xl font-semibold tracking-tight">Auto-approved (sample)</h2>
        <p className="text-sm text-muted-foreground">Non-sensitive bills that are publicly visible. Spot-check a few.</p>
        <ul className="mt-3 space-y-2">
          {(buckets.AUTO_APPROVED ?? []).slice(0, 8).map((item) => (
            <ReviewRow key={item.billId} item={item} />
          ))}
        </ul>
        <Link href="/admin/queue" className="mt-4 inline-block text-sm font-medium text-flag-green-dark no-underline hover:underline">
          See full queue →’
        </Link>
      </section>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent: 'green' | 'amber' | 'red' | 'slate' }) {
  const border = {
    green: 'border-flag-green/30 bg-flag-green/5',
    amber: 'border-amber-300 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/5',
    red: 'border-red-300 bg-red-50 dark:border-red-500/30 dark:bg-red-500/5',
    slate: 'border-border bg-card',
  }[accent];
  return (
    <div className={`rounded-lg border p-4 ${border}`}>
      <div className="font-mono text-3xl font-semibold text-foreground">{value}</div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function ReviewRow({ item }: { item: QueueItem }) {
  const status = item.explainer?.status ?? 'NONE';
  const variant: 'amber' | 'red' | 'slate' | 'green' =
    status === 'PENDING_REVIEW' ? 'amber' :
    status === 'FLAGGED' ? 'red' :
    status === 'APPROVED' ? 'green' : 'slate';
  return (
    <li className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="font-mono font-medium text-foreground/85">{item.billNumber}</span>
        <span>·</span>
        <span>{item.jurisdiction.name}</span>
        <Badge variant={variant}>{STATUS_LABEL[status] ?? status}</Badge>
        {item.sensitiveFlag && <Badge variant="amber">sensitive</Badge>}
        {item.explainer?.verifiedAt && <Badge variant="slate">verified</Badge>}
      </div>
      <Link
        href={`/admin/bills/${item.billId}`}
        className="mt-1 block font-serif text-base leading-snug text-foreground no-underline hover:text-flag-green-dark"
      >
        {item.title}
      </Link>
      {item.explainer?.tldr && (
        <p className="mt-1 text-sm text-foreground/85 line-clamp-2">{item.explainer.tldr}</p>
      )}
    </li>
  );
}
