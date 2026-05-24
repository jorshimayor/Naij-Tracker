import { redirect } from 'next/navigation';
import Link from 'next/link';
import { requestOtp } from '@/lib/session';

export const dynamic = 'force-dynamic';

async function submit(formData: FormData) {
  'use server';
  const email = String(formData.get('email') ?? '').trim();
  if (!email) redirect('/login?error=missing');
  const result = await requestOtp(email);
  if (!result.ok) {
    if (result.throttledSecondsLeft) {
      redirect(`/login?email=${encodeURIComponent(email)}&throttle=${result.throttledSecondsLeft}`);
    }
    redirect(`/login?email=${encodeURIComponent(email)}&error=${encodeURIComponent(result.message ?? '')}`);
  }
  redirect(`/login/verify?email=${encodeURIComponent(email)}`);
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: { email?: string; error?: string; throttle?: string };
}) {
  return (
    <div className="container-prose flex min-h-[60vh] items-center py-12">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 shadow-sm">
        <h1 className="font-serif text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          We'll email you a 6-digit code. No passwords.
        </p>
        <form action={submit} className="mt-4 space-y-3">
          <div>
            <label htmlFor="email" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoFocus
              defaultValue={searchParams.email ?? ''}
              placeholder="you@example.com"
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus:border-flag-green focus:outline-none focus:ring-2 focus:ring-flag-green/30"
            />
          </div>
          {searchParams.throttle && (
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Try again in {searchParams.throttle}s — a code was just sent.
            </p>
          )}
          {searchParams.error && !searchParams.throttle && (
            <p className="text-sm text-red-700 dark:text-red-300">{searchParams.error}</p>
          )}
          <button type="submit" className="w-full rounded-md bg-flag-green px-4 py-2 text-sm font-semibold text-white hover:bg-flag-green-dark">
            Email me a code
          </button>
        </form>
      </div>
    </div>
  );
}
