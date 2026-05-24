import { revalidatePath } from 'next/cache';
import { adminFetch, requireAdminCookie } from '@/lib/admin';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

interface RunSummary {
  frequency: 'DAILY' | 'WEEKLY';
  usersScanned: number;
  usersEmailed: number;
  emailsDelivered: number;
  emailsFailed: number;
  startedAt: string;
  finishedAt: string;
  dryRun: boolean;
}

export default async function DigestPage({ searchParams }: { searchParams: { summary?: string } }) {
  requireAdminCookie();
  const lastRun: RunSummary | null = searchParams.summary
    ? JSON.parse(decodeURIComponent(searchParams.summary))
    : null;

  async function runDaily(formData: FormData) {
    'use server';
    const dryRun = formData.get('dryRun') === 'on';
    const result = await adminFetch<RunSummary>('/api/admin/digest/run', {
      method: 'POST',
      body: JSON.stringify({ frequency: 'DAILY', dryRun }),
    });
    revalidatePath('/admin/digest');
    return { url: `/admin/digest?summary=${encodeURIComponent(JSON.stringify(result))}` };
  }

  async function runWeekly(formData: FormData) {
    'use server';
    const dryRun = formData.get('dryRun') === 'on';
    const result = await adminFetch<RunSummary>('/api/admin/digest/run', {
      method: 'POST',
      body: JSON.stringify({ frequency: 'WEEKLY', dryRun }),
    });
    revalidatePath('/admin/digest');
    return { url: `/admin/digest?summary=${encodeURIComponent(JSON.stringify(result))}` };
  }

  // Server-action-redirect helpers
  async function runDailyAndRedirect(formData: FormData) {
    'use server';
    const r = await runDaily(formData);
    const { redirect } = await import('next/navigation');
    redirect(r.url);
  }
  async function runWeeklyAndRedirect(formData: FormData) {
    'use server';
    const r = await runWeekly(formData);
    const { redirect } = await import('next/navigation');
    redirect(r.url);
  }

  return (
    <div>
      <h1 className="font-serif text-3xl font-semibold tracking-tight">Digest worker</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Daily digests fire at 07:00 WAT every day. Weekly digests fire 07:00 WAT every Monday. You can also run one now.
      </p>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <form action={runDailyAndRedirect} className="rounded-lg border border-border bg-card p-5">
          <h2 className="font-serif text-lg font-semibold tracking-tight">Daily digest</h2>
          <p className="mt-1 text-sm text-muted-foreground">Batches up the last 24h of stage events per user.</p>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" name="dryRun" /> Dry run (no emails sent, no state updated)
          </label>
          <button className="mt-3 rounded-md bg-flag-green px-4 py-2 text-sm font-semibold text-white hover:bg-flag-green-dark">
            Run now
          </button>
        </form>

        <form action={runWeeklyAndRedirect} className="rounded-lg border border-border bg-card p-5">
          <h2 className="font-serif text-lg font-semibold tracking-tight">Weekly digest</h2>
          <p className="mt-1 text-sm text-muted-foreground">Batches up the last 7 days of stage events per user.</p>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" name="dryRun" /> Dry run
          </label>
          <button className="mt-3 rounded-md bg-flag-green px-4 py-2 text-sm font-semibold text-white hover:bg-flag-green-dark">
            Run now
          </button>
        </form>
      </div>

      {lastRun && (
        <section className="mt-8 rounded-lg border border-border bg-card p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-serif text-base font-semibold tracking-tight">Last run</h3>
            <Badge variant={lastRun.dryRun ? 'amber' : 'green'}>
              {lastRun.frequency.toLowerCase()}{lastRun.dryRun ? ' · dry' : ''}
            </Badge>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <Stat label="Users scanned" value={lastRun.usersScanned} />
            <Stat label="Users emailed" value={lastRun.usersEmailed} />
            <Stat label="Delivered" value={lastRun.emailsDelivered} />
            <Stat label="Failed" value={lastRun.emailsFailed} />
          </dl>
          <div className="mt-3 text-xs text-muted-foreground">
            {new Date(lastRun.startedAt).toLocaleString()} → {new Date(lastRun.finishedAt).toLocaleString()}
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="font-mono text-2xl font-semibold text-foreground">{value}</div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
