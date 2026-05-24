import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser, listSubscriptions, unfollow } from '@/lib/session';
import { revalidatePath } from 'next/cache';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

async function removeAction(formData: FormData) {
  'use server';
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  await unfollow(id);
  revalidatePath('/me/following');
}

export default async function FollowingPage() {
  await requireUser();
  const subs = await listSubscriptions();

  const grouped = subs.reduce<Record<string, typeof subs>>((acc, s) => {
    (acc[s.targetType] ??= []).push(s);
    return acc;
  }, {});

  return (
    <div className="container-wide py-10">
      <nav className="text-xs text-muted-foreground">
        <Link href="/me" className="hover:underline">Your account</Link>
        <span className="px-1">›</span>
        <span className="text-foreground/85">Following</span>
      </nav>
      <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight">Following</h1>
      <p className="text-sm text-muted-foreground">
        {subs.length === 0
          ? 'You\'re not following anything yet.'
          : `You're following ${subs.length} bill${subs.length === 1 ? '' : 's'}, topics or sponsors. You'll get an email when any of them moves.`}
      </p>

      {subs.length === 0 && (
        <div className="mt-6 rounded-lg border border-dashed border-border bg-card p-8 text-center text-sm">
          <p>
            <Link href="/bills" className="text-flag-green-dark hover:underline">Browse bills</Link>{' '}
            and click <strong>Follow</strong> on anything you want to track.
          </p>
        </div>
      )}

      {Object.entries(grouped).map(([type, items]) => (
        <section key={type} className="mt-8">
          <h2 className="font-serif text-xl font-semibold tracking-tight">{LABEL[type] ?? type}</h2>
          <ul className="mt-3 space-y-2">
            {items.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-4">
                <div className="min-w-0">
                  {s.href ? (
                    <Link href={s.href} className="font-medium text-foreground no-underline hover:text-flag-green-dark">
                      {s.label}
                    </Link>
                  ) : (
                    <span className="font-medium text-foreground">{s.label}</span>
                  )}
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">{s.channel.toLowerCase()}</Badge>
                    <Badge variant="outline">{s.frequency.toLowerCase()}</Badge>
                  </div>
                </div>
                <form action={removeAction}>
                  <input type="hidden" name="id" value={s.id} />
                  <button type="submit" className="text-xs text-muted-foreground hover:text-red-600 hover:underline">
                    Unfollow
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ))}

    </div>
  );
}

const LABEL: Record<string, string> = {
  BILL: 'Bills',
  TOPIC: 'Topics',
  SPONSOR: 'Legislators',
  CHAMBER: 'Chambers',
};
