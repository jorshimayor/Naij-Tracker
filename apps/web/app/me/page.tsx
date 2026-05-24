import Link from 'next/link';
import { redirect } from 'next/navigation';
import { logout, requireUser, listSubscriptions, sessionFetch } from '@/lib/session';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

async function logoutAction() {
  'use server';
  await logout();
  redirect('/');
}

async function updateProfile(formData: FormData) {
  'use server';
  const displayName = String(formData.get('displayName') ?? '').trim();
  await sessionFetch('/api/auth/me', {
    method: 'POST',
    body: JSON.stringify({ displayName: displayName || undefined }),
  });
  redirect('/me?saved=1');
}

export default async function MePage({ searchParams }: { searchParams: { saved?: string } }) {
  const user = await requireUser();
  const subscriptions = await listSubscriptions();

  return (
    <div className="container-wide py-10">
      <h1 className="font-serif text-3xl font-semibold tracking-tight">Your account</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Signed in as <span className="font-medium text-foreground">{user.email}</span>.
        {user.lastLoginAt && <> · Last login {formatDate(user.lastLoginAt)}.</>}
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="font-serif text-lg font-semibold tracking-tight">Profile</h2>
          <form action={updateProfile} className="mt-3 space-y-3">
            <div>
              <label htmlFor="displayName" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Display name
              </label>
              <input
                id="displayName"
                name="displayName"
                type="text"
                defaultValue={user.displayName ?? ''}
                maxLength={80}
                placeholder="e.g. Bukola O."
                className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus:border-flag-green focus:outline-none focus:ring-2 focus:ring-flag-green/30"
              />
            </div>
            <button type="submit" className="rounded-md bg-flag-green px-4 py-2 text-sm font-semibold text-white hover:bg-flag-green-dark">
              Save
            </button>
            {searchParams.saved && <span className="ml-3 text-xs text-flag-green-dark">Saved.</span>}
          </form>

          <div className="mt-6 border-t border-border pt-4">
            <h3 className="font-medium text-foreground">What you're following</h3>
            {subscriptions.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                You're not following anything yet. Open a bill or topic and click <strong>Follow</strong> to start.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {subscriptions.slice(0, 6).map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2 text-sm">
                    <div>
                      <Badge variant="outline">{s.targetType.toLowerCase()}</Badge>{' '}
                      {s.href ? (
                        <Link href={s.href} className="text-foreground no-underline hover:text-flag-green-dark">
                          {s.label}
                        </Link>
                      ) : (
                        <span>{s.label}</span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">{s.frequency.toLowerCase()}</span>
                  </li>
                ))}
                {subscriptions.length > 6 && (
                  <li>
                    <Link href="/me/following" className="text-sm text-flag-green-dark hover:underline">See all {subscriptions.length} →</Link>
                  </li>
                )}
              </ul>
            )}
            {subscriptions.length > 0 && (
              <Link href="/me/following" className="mt-3 inline-block text-sm font-medium text-flag-green-dark no-underline hover:underline">
                Manage subscriptions →
              </Link>
            )}
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Account</div>
            <dl className="mt-2 space-y-1 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Email</dt><dd className="text-foreground">{user.email}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Verified</dt><dd>{user.emailVerified ? '✓' : '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Role</dt><dd>{user.role.toLowerCase()}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Joined</dt><dd>{formatDate(user.createdAt)}</dd></div>
            </dl>
          </div>

          <form action={logoutAction} className="rounded-lg border border-border bg-card p-4">
            <button type="submit" className="text-sm text-muted-foreground hover:text-red-600 hover:underline">
              Sign out
            </button>
          </form>
        </aside>
      </div>
    </div>
  );
}
