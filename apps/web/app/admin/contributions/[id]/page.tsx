import Link from 'next/link';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { adminFetch, requireAdminCookie } from '@/lib/admin';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

interface ContributionDetail {
  id: string;
  billNumber: string;
  title: string;
  summary: string | null;
  fullText: string | null;
  sourceUrl: string | null;
  submitterNote: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PUBLISHED';
  reviewerNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
  jurisdiction: { slug: string; name: string };
  submitter: { id: string; email: string; displayName: string | null };
  publishedBill: { slug: string; jurisdiction: { slug: string } } | null;
}

export default async function AdminContributionDetailPage({ params }: { params: { id: string } }) {
  requireAdminCookie();
  const c = await adminFetch<ContributionDetail>(`/api/contributions/admin/${params.id}`);

  async function approve(formData: FormData) {
    'use server';
    const note = String(formData.get('reviewerNote') ?? '');
    try {
      await adminFetch(`/api/contributions/admin/${params.id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ reviewerNote: note || undefined }),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not approve';
      redirect(`/admin/contributions/${params.id}?error=${encodeURIComponent(msg)}`);
    }
    revalidatePath(`/admin/contributions/${params.id}`);
    redirect('/admin/contributions');
  }

  async function reject(formData: FormData) {
    'use server';
    const reviewerNote = String(formData.get('reviewerNote') ?? '').trim();
    if (reviewerNote.length < 3) {
      redirect(`/admin/contributions/${params.id}?error=Please+leave+a+reason+for+the+submitter.`);
    }
    await adminFetch(`/api/contributions/admin/${params.id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reviewerNote }),
    });
    revalidatePath(`/admin/contributions/${params.id}`);
    redirect('/admin/contributions');
  }

  const isPending = c.status === 'PENDING';
  return (
    <div>
      <nav className="text-xs text-muted-foreground">
        <Link href="/admin/contributions" className="hover:underline">Citizen submissions</Link>
        <span className="px-1">›</span>
        <span className="text-foreground/85">{c.billNumber}</span>
      </nav>

      <header className="mt-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="font-mono font-medium text-foreground/85">{c.billNumber}</span>
          <span>·</span>
          <span>{c.jurisdiction.name}</span>
          <span>·</span>
          <span>by {c.submitter.displayName ?? c.submitter.email}</span>
          <span>·</span>
          <span>{formatDate(c.createdAt)}</span>
        </div>
        <h1 className="mt-1 font-serif text-2xl font-semibold leading-snug">{c.title}</h1>
        <div className="mt-3">
          <Badge variant={c.status === 'PENDING' ? 'amber' : c.status === 'REJECTED' ? 'red' : 'green'}>
            {c.status.toLowerCase()}
          </Badge>
        </div>
        {c.publishedBill && (
          <p className="mt-3 text-sm">
            Published as:{' '}
            <Link href={`/bills/${c.publishedBill.jurisdiction.slug}/${c.publishedBill.slug}`} className="text-flag-green-dark hover:underline">
              {c.publishedBill.slug}
            </Link>
          </p>
        )}
      </header>

      <section className="mt-6 space-y-4">
        {c.summary && (
          <Block label="Summary by submitter"><p className="whitespace-pre-line">{c.summary}</p></Block>
        )}
        {c.sourceUrl && (
          <Block label="Source link">
            <a href={c.sourceUrl} target="_blank" rel="noopener" className="break-words text-flag-green-dark hover:underline">{c.sourceUrl}</a>
          </Block>
        )}
        {c.submitterNote && (
          <Block label="Note to editor"><p className="whitespace-pre-line">{c.submitterNote}</p></Block>
        )}
        {c.fullText && (
          <Block label="Bill text">
            <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap font-sans text-sm">{c.fullText}</pre>
          </Block>
        )}
        {c.reviewerNote && (
          <Block label="Previous editor note"><p>{c.reviewerNote}</p></Block>
        )}
      </section>

      {isPending && (
        <section className="mt-8 grid gap-4 lg:grid-cols-2">
          <form action={approve} className="rounded-lg border border-border bg-card p-5">
            <h3 className="font-serif text-lg font-semibold tracking-tight">Approve & publish</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Creates a new bill record using the submitter's data, runs the AI explainer, and credits the submission.
            </p>
            <textarea
              name="reviewerNote"
              rows={2}
              placeholder="Optional note back to the submitter"
              className="mt-3 w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus:border-flag-green focus:outline-none focus:ring-2 focus:ring-flag-green/30"
            />
            <button className="mt-2 rounded-md bg-flag-green px-4 py-2 text-sm font-semibold text-white hover:bg-flag-green-dark">
              Approve & publish
            </button>
          </form>

          <form action={reject} className="rounded-lg border border-border bg-card p-5">
            <h3 className="font-serif text-lg font-semibold tracking-tight">Decline</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              The submitter will see your note. Be clear and constructive — duplicate, not-a-bill, missing source, etc.
            </p>
            <textarea
              name="reviewerNote"
              rows={2}
              required
              minLength={3}
              placeholder="Why are we declining this?"
              className="mt-3 w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus:border-flag-green focus:outline-none focus:ring-2 focus:ring-flag-green/30"
            />
            <button className="mt-2 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">
              Decline
            </button>
          </form>
        </section>
      )}
    </div>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 rounded-md border border-border bg-card p-4 text-foreground/90">{children}</div>
    </div>
  );
}
