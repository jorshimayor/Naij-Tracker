import Link from 'next/link';
import { adminFetch, requireAdminCookie } from '@/lib/admin';
import { Badge } from '@/components/ui/badge';
import { formatDate, timeAgo } from '@/lib/utils';

export const dynamic = 'force-dynamic';

interface MockEmail {
  id: string;
  to: string;
  subject: string;
  body: string;
  category: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export default async function MockEmailsPage({ searchParams }: { searchParams: { category?: string } }) {
  requireAdminCookie();
  const path = searchParams.category
    ? `/api/admin/mock-emails?category=${encodeURIComponent(searchParams.category)}`
    : '/api/admin/mock-emails';
  const emails = await adminFetch<MockEmail[]>(path);

  return (
    <div>
      <h1 className="font-serif text-3xl font-semibold tracking-tight">Mock email queue</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Outgoing emails that would have been delivered if a real provider was wired. Useful for testing
        the OTP and alert flows.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Chip label="All" href="/admin/mock-emails" active={!searchParams.category} />
        <Chip label="OTP codes" href="/admin/mock-emails?category=otp" active={searchParams.category === 'otp'} />
      </div>

      {emails.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          No emails in the queue yet.
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {emails.map((e) => (
            <li key={e.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{e.category}</Badge>
                  <span>to <span className="font-mono">{e.to}</span></span>
                </div>
                <span>{timeAgo(e.createdAt)} ({formatDate(e.createdAt)})</span>
              </div>
              <div className="mt-1 font-medium text-foreground">{e.subject}</div>
              <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded bg-muted p-3 text-sm text-foreground/85">
                {e.body}
              </pre>
              {e.category === 'otp' && e.metadata && typeof (e.metadata as any).code === 'string' && (
                <div className="mt-2 text-xs text-muted-foreground">
                  Code: <span className="font-mono text-lg font-semibold text-foreground">{(e.metadata as any).code}</span>
                </div>
              )}
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
        active
          ? 'border-flag-green bg-flag-green/10 text-flag-green-dark'
          : 'border-border bg-card text-foreground/85 hover:border-flag-green/40'
      }`}
    >
      {label}
    </Link>
  );
}
