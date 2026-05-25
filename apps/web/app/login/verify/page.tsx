import { redirect } from 'next/navigation';
import Link from 'next/link';
import { requestOtp, verifyOtp } from '@/lib/session';

export const dynamic = 'force-dynamic';

async function submit(formData: FormData) {
  'use server';
  const email = String(formData.get('email') ?? '');
  const code = String(formData.get('code') ?? '');
  if (!email || !code) redirect(`/login/verify?email=${encodeURIComponent(email)}&error=missing`);
  const r = await verifyOtp(email, code);
  if (!r.ok) {
    redirect(`/login/verify?email=${encodeURIComponent(email)}&error=${encodeURIComponent(r.message ?? 'Bad code')}`);
  }
  redirect('/me');
}

async function resend(formData: FormData) {
  'use server';
  const email = String(formData.get('email') ?? '');
  if (!email) redirect('/login');
  const r = await requestOtp(email);
  if (r.throttledSecondsLeft) {
    redirect(`/login/verify?email=${encodeURIComponent(email)}&throttle=${r.throttledSecondsLeft}`);
  }
  redirect(`/login/verify?email=${encodeURIComponent(email)}&resent=1`);
}

export default function VerifyOtpPage({
  searchParams,
}: {
  searchParams: { email?: string; error?: string; throttle?: string; resent?: string };
}) {
  if (!searchParams.email) redirect('/login');
  const email = searchParams.email;

  return (
    <div className="container-prose flex min-h-[60vh] items-center justify-center py-12">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 shadow-sm">
        <h1 className="font-serif text-2xl font-semibold tracking-tight">Enter your code</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          We sent a 6-digit code to <span className="font-medium text-foreground">{email}</span>.
        </p>
        <form action={submit} className="mt-4 space-y-3">
          <input type="hidden" name="email" value={email} />
          <div>
            <label htmlFor="code" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              6-digit code
            </label>
            <input
              id="code"
              name="code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              autoFocus
              placeholder="123456"
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-center font-mono text-2xl tracking-widest focus:border-flag-green focus:outline-none focus:ring-2 focus:ring-flag-green/30"
            />
          </div>
          {searchParams.resent && <p className="text-sm text-flag-green-dark">New code sent.</p>}
          {searchParams.throttle && (
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Wait {searchParams.throttle}s before requesting another code.
            </p>
          )}
          {searchParams.error && (
            <p className="text-sm text-red-700 dark:text-red-300">{searchParams.error}</p>
          )}
          <button type="submit" className="w-full rounded-md bg-flag-green px-4 py-2 text-sm font-semibold text-white hover:bg-flag-green-dark">
            Sign in
          </button>
        </form>
        <form action={resend} className="mt-3">
          <input type="hidden" name="email" value={email} />
          <button type="submit" className="text-xs text-muted-foreground hover:text-foreground hover:underline">
            Resend code
          </button>
          {' · '}
          <Link href="/login" className="text-xs text-muted-foreground hover:underline">Use a different email</Link>
        </form>

      </div>
    </div>
  );
}
