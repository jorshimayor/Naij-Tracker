'use client';

import { useEffect } from 'react';

/**
 * Root error boundary. Catches any uncaught render error and shows a brand-aligned fallback
 * instead of Next.js's default white-on-black "Application error" screen.
 *
 * This is intentionally a CLIENT component (Next.js requirement for error.tsx).
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Logged to the browser console + Vercel runtime logs.
    console.error('[app] render error', error);
  }, [error]);

  return (
    <div className="container-prose flex min-h-[70vh] flex-col items-center justify-center py-20 text-center">
      <p className="font-display text-xs font-medium uppercase tracking-roman text-gold">Interruptio</p>
      <h1 className="mt-4 font-display text-3xl font-semibold uppercase leading-tight tracking-tight text-foreground sm:text-4xl">
        Something stalled on our end.
      </h1>
      <div className="mt-5 h-px w-32 bg-gradient-to-r from-transparent via-gold to-transparent" aria-hidden />
      <p className="mt-6 max-w-lg font-serif text-base text-foreground/85">
        We hit an unexpected error rendering this page. Your data is safe; this is on us. If it
        keeps happening, please mail us at <a className="text-gold hover:underline" href="mailto:errors@naijabilltracker.com.ng">errors@naijabilltracker.com.ng</a>.
      </p>
      {error.digest && (
        <p className="mt-4 font-mono text-xs text-muted-foreground">
          Reference: {error.digest}
        </p>
      )}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-md bg-foreground px-5 py-2.5 font-display text-xs font-semibold uppercase tracking-roman text-background hover:bg-gold hover:text-background"
        >
          Try again
        </button>
        <a
          href="/"
          className="rounded-md border border-border bg-card px-5 py-2.5 font-display text-xs font-medium uppercase tracking-roman text-foreground/80 no-underline hover:border-gold hover:text-gold"
        >
          Back to home
        </a>
      </div>
    </div>
  );
}
