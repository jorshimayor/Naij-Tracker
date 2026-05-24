import Link from 'next/link';
import { adminFetch, requireAdminCookie, type QueueItem } from '@/lib/admin';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

const STATUSES = ['PENDING_REVIEW', 'FLAGGED', 'AUTO_APPROVED', 'APPROVED', 'DRAFT'];

export default async function AdminQueuePage({ searchParams }: { searchParams: { status?: string } }) {
  requireAdminCookie();
  const status = searchParams.status && STATUSES.includes(searchParams.status) ? searchParams.status : undefined;
  const qs = status ? `?status=${status}` : '';
  const items = await adminFetch<QueueItem[]>(`/api/admin/queue${qs}`);

  return (
    <div>
      <h1 className="font-serif text-3xl font-semibold tracking-tight">Review queue</h1>
      <p className="mt-1 text-sm text-muted-foreground">{items.length} bill{items.length === 1 ? '' : 's'} in scope.</p>

      <div className="mt-4 flex flex-wrap gap-2">
        <FilterChip label="All" href="/admin/queue" active={!status} />
        {STATUSES.map((s) => (
          <FilterChip key={s} label={s.replace(/_/g, ' ').toLowerCase()} href={`/admin/queue?status=${s}`} active={status === s} />
        ))}
      </div>

      <table className="mt-6 w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="py-2">Bill</th>
            <th className="py-2">Chamber</th>
            <th className="py-2">Status</th>
            <th className="py-2">Flags</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.map((b) => (
            <tr key={b.billId} className="hover:bg-muted">
              <td className="py-3 align-top">
                <Link href={`/admin/bills/${b.billId}`} className="font-medium text-foreground no-underline hover:text-flag-green-dark">
                  <span className="font-mono text-xs text-muted-foreground">{b.billNumber}</span> {b.title.slice(0, 90)}{b.title.length > 90 ? '…' : ''}
                </Link>
              </td>
              <td className="py-3 align-top text-foreground/85">{b.jurisdiction.name}</td>
              <td className="py-3 align-top">
                {b.explainer ? (
                  <Badge variant={statusVariant(b.explainer.status)}>{b.explainer.status.replace(/_/g, ' ').toLowerCase()}</Badge>
                ) : (
                  <Badge variant="slate">no explainer</Badge>
                )}
              </td>
              <td className="py-3 align-top">
                <div className="flex flex-wrap gap-1">
                  {b.sensitiveFlag && <Badge variant="amber">sensitive</Badge>}
                  {b.explainer?.verifiedAt && <Badge variant="slate">verified</Badge>}
                </div>
              </td>
              <td className="py-3 align-top text-right">
                <Link href={`/admin/bills/${b.billId}`} className="text-xs font-medium text-flag-green-dark no-underline hover:underline">
                  Review →’
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FilterChip({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1 text-xs no-underline ${
        active ? 'border-flag-green bg-flag-green/10 text-flag-green-dark' : 'border-border bg-card text-foreground/85 hover:border-flag-green/40'
      }`}
    >
      {label}
    </Link>
  );
}

function statusVariant(status: string): 'amber' | 'red' | 'slate' | 'green' {
  if (status === 'PENDING_REVIEW') return 'amber';
  if (status === 'FLAGGED') return 'red';
  if (status === 'APPROVED') return 'green';
  return 'slate';
}
