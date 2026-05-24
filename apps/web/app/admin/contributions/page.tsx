import Link from 'next/link';
import { adminFetch, requireAdminCookie } from '@/lib/admin';
import { Badge } from '@/components/ui/badge';
import { formatDate, timeAgo } from '@/lib/utils';

export const dynamic = 'force-dynamic';

interface AdminContribution {
  id: string;
  billNumber: string;
  title: string;
  summary: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PUBLISHED';
  createdAt: string;
  jurisdiction: { slug: string; name: string };
  submitter: { email: string; displayName: string | null };
}

const STATUSES = ['PENDING', 'PUBLISHED', 'REJECTED'];

export default async function AdminContributionsPage({ searchParams }: { searchParams: { status?: string } }) {
  requireAdminCookie();
  const status = searchParams.status && STATUSES.includes(searchParams.status) ? searchParams.status : undefined;
  const items = await adminFetch<AdminContribution[]>(`/api/contributions/admin/queue${status ? `?status=${status}` : ''}`);

  return (
    <div>
      <h1 className="font-serif text-3xl font-semibold tracking-tight">Citizen submissions</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {items.length} submission{items.length === 1 ? '' : 's'}{status ? ` in ${status.toLowerCase()}` : ''}.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Chip label="All" href="/admin/contributions" active={!status} />
        {STATUSES.map((s) => (
          <Chip key={s} label={s.toLowerCase()} href={`/admin/contributions?status=${s}`} active={status === s} />
        ))}
      </div>

      {items.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          Nothing to review.
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-border border-y border-border">
          {items.map((c) => (
            <li key={c.id} className="py-5">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-mono font-medium text-foreground/85">{c.billNumber}</span>
                    <span>·</span>
                    <span>{c.jurisdiction.name}</span>
                    <span>·</span>
                    <span>{c.submitter.displayName ?? c.submitter.email}</span>
                    <span>·</span>
                    <span>{timeAgo(c.createdAt)}</span>
                  </div>
                  <Link href={`/admin/contributions/${c.id}`} className="mt-1 block font-serif text-lg leading-snug text-foreground no-underline hover:text-flag-green-dark">
                    {c.title}
                  </Link>
                  {c.summary && <p className="mt-1 text-sm text-muted-foreground">{c.summary}</p>}
                </div>
                <Badge variant={c.status === 'PENDING' ? 'amber' : c.status === 'REJECTED' ? 'red' : 'green'}>
                  {c.status.toLowerCase()}
                </Badge>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Chip({ label, href, active }: { label: string; href: string; active: boolean }) {
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
