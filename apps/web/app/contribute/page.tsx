import Link from 'next/link';
import { getCurrentUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function ContributePage() {
  const user = await getCurrentUser();
  return (
    <div className="container-prose py-16">
      <p className="text-sm font-medium uppercase tracking-widest text-flag-green">Contribute</p>
      <h1 className="mt-2 font-serif text-4xl font-semibold tracking-tight text-foreground">
        Help us track every bill in Nigeria.
      </h1>
      <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
        Most state legislatures publish bills in places that are hard to find. If you spot one we
        haven't tracked yet, submit it here. An editor will review it before it goes live.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        <Step n={1} title="Find a bill" body="On a legislature website, in news coverage, or directly from a committee. Copy the bill number, title, and a link." />
        <Step n={2} title="Submit it" body="Fill in the short form. You can optionally paste the bill text — we'll run our explainer over it." />
        <Step n={3} title="Editor reviews" body="An editor double-checks the source. Approved submissions are published and credited to you." />
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-3">
        {user ? (
          <Link
            href="/contribute/new"
            className="rounded-md bg-flag-green px-5 py-2.5 text-sm font-semibold text-white no-underline hover:bg-flag-green-dark"
          >
            Submit a bill
          </Link>
        ) : (
          <Link
            href="/login?return=/contribute/new"
            className="rounded-md bg-flag-green px-5 py-2.5 text-sm font-semibold text-white no-underline hover:bg-flag-green-dark"
          >
            Sign in to submit
          </Link>
        )}
        <Link
          href="/contribute/mine"
          className="rounded-md border border-border bg-card px-5 py-2.5 text-sm font-medium no-underline hover:border-flag-green"
        >
          My submissions
        </Link>
      </div>

      <section className="mt-16 border-t border-border pt-10">
        <h2 className="font-serif text-2xl font-semibold tracking-tight">What we accept</h2>
        <ul className="mt-3 space-y-2 text-base text-foreground/85">
          <li><strong className="text-foreground">Bills before the National Assembly</strong> — Senate or House of Representatives.</li>
          <li><strong className="text-foreground">State assembly bills</strong> — especially from states we don't yet cover.</li>
          <li><strong className="text-foreground">Executive bills</strong> transmitted by the Presidency or a Governor.</li>
        </ul>
        <h2 className="mt-10 font-serif text-2xl font-semibold tracking-tight">What we don't accept</h2>
        <ul className="mt-3 space-y-2 text-base text-foreground/85">
          <li>Speculation, drafts that have not been formally introduced, or motions that aren't bills.</li>
          <li>Bills already in our database. Search first to check.</li>
          <li>Opinion pieces about a bill, with no link to the bill itself.</li>
        </ul>
      </section>
    </div>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div>
      <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Step {n}</div>
      <div className="mt-1 font-medium text-foreground">{title}</div>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}
