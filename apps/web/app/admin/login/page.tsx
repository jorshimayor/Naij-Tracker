import { redirect } from 'next/navigation';
import { loginToAdmin } from '@/lib/admin';

export const dynamic = 'force-dynamic';

async function login(formData: FormData) {
  'use server';
  const token = String(formData.get('token') ?? '');
  const ok = await loginToAdmin(token);
  if (!ok) {
    redirect('/admin/login?error=1');
  }
  redirect('/admin');
}

export default function AdminLoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  return (
    <div className="container-prose flex min-h-[70vh] items-center py-16">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <span className="inline-block h-7 w-1.5 rounded bg-flag-green" aria-hidden />
          <div>
            <div className="font-serif text-xl font-semibold tracking-tight text-foreground">Admin sign in</div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Editorial console</div>
          </div>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Use the <code className="rounded bg-muted px-1 font-mono text-xs">ADMIN_TOKEN</code> from
          your <code className="rounded bg-muted px-1 font-mono text-xs">.env</code>.
        </p>
        <form action={login} className="space-y-3">
          <div>
            <label htmlFor="token" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Admin token
            </label>
            <input
              id="token"
              name="token"
              type="password"
              autoFocus
              required
              autoComplete="off"
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus:border-flag-green focus:outline-none focus:ring-2 focus:ring-flag-green/30"
            />
          </div>
          {searchParams.error && (
            <p className="text-sm text-red-700">Token doesn't match. Try again.</p>
          )}
          <button
            type="submit"
            className="w-full rounded-md bg-flag-green px-4 py-2 text-sm font-semibold text-white hover:bg-flag-green-dark"
          >
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
