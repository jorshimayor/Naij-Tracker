import { redirect } from 'next/navigation';
import Link from 'next/link';
import { requireUser, submitContribution } from '@/lib/session';
import { api } from '@/lib/api';

export const dynamic = 'force-dynamic';

async function submit(formData: FormData) {
  'use server';
  const jurisdictionSlug = String(formData.get('jurisdictionSlug') ?? '');
  const billNumber = String(formData.get('billNumber') ?? '').trim();
  const title = String(formData.get('title') ?? '').trim();
  const summary = String(formData.get('summary') ?? '').trim();
  const sourceUrl = String(formData.get('sourceUrl') ?? '').trim();
  const fullText = String(formData.get('fullText') ?? '').trim();
  const submitterNote = String(formData.get('submitterNote') ?? '').trim();

  if (!jurisdictionSlug || billNumber.length < 1 || title.length < 8) {
    redirect(`/contribute/new?error=${encodeURIComponent('Jurisdiction, bill number, and a full title are required.')}`);
  }
  try {
    await submitContribution({
      jurisdictionSlug,
      billNumber,
      title,
      summary: summary || undefined,
      sourceUrl: sourceUrl || undefined,
      fullText: fullText || undefined,
      submitterNote: submitterNote || undefined,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Could not submit';
    redirect(`/contribute/new?error=${encodeURIComponent(msg)}`);
  }
  redirect('/contribute/mine?submitted=1');
}

export default async function NewContributionPage({ searchParams }: { searchParams: { error?: string } }) {
  await requireUser();
  const jurisdictions = await api.listJurisdictions();

  return (
    <div className="container-prose py-12">
      <nav className="text-xs text-muted-foreground">
        <Link href="/contribute" className="hover:underline">Contribute</Link>
        <span className="px-1">›</span>
        <span className="text-foreground/85">New submission</span>
      </nav>

      <h1 className="mt-3 font-serif text-3xl font-semibold tracking-tight">Submit a bill</h1>
      <p className="mt-1 text-muted-foreground">
        Tell us about a bill you've found. An editor will review your submission before it's published.
      </p>

      <form action={submit} className="mt-8 space-y-6">
        <Field label="Jurisdiction" htmlFor="jurisdictionSlug" hint="Where was this bill introduced?">
          <select
            id="jurisdictionSlug"
            name="jurisdictionSlug"
            required
            defaultValue=""
            className="w-full rounded-md border border-border bg-card px-3 py-2 text-base focus:border-flag-green focus:outline-none focus:ring-2 focus:ring-flag-green/30"
          >
            <option value="" disabled>Select…</option>
            {jurisdictions.map((j) => (
              <option key={j.slug} value={j.slug}>{j.name}</option>
            ))}
          </select>
        </Field>

        <Field label="Bill number" htmlFor="billNumber" hint='As written by the legislature — e.g. "SB.142" or "HB.0421".'>
          <input
            id="billNumber"
            name="billNumber"
            required
            maxLength={32}
            placeholder="SB.142"
            className="w-full rounded-md border border-border bg-card px-3 py-2 text-base font-mono focus:border-flag-green focus:outline-none focus:ring-2 focus:ring-flag-green/30"
          />
        </Field>

        <Field label="Full title" htmlFor="title" hint="The complete title as it appears on the bill. We need at least 8 characters.">
          <input
            id="title"
            name="title"
            required
            maxLength={500}
            placeholder="A Bill for an Act to…"
            className="w-full rounded-md border border-border bg-card px-3 py-2 text-base focus:border-flag-green focus:outline-none focus:ring-2 focus:ring-flag-green/30"
          />
        </Field>

        <Field label="Short summary" htmlFor="summary" hint="One or two sentences in your own words. Optional — but helps the editor review faster.">
          <textarea
            id="summary"
            name="summary"
            rows={3}
            maxLength={800}
            placeholder="What does the bill do?"
            className="w-full rounded-md border border-border bg-card px-3 py-2 text-base focus:border-flag-green focus:outline-none focus:ring-2 focus:ring-flag-green/30"
          />
        </Field>

        <Field label="Source link" htmlFor="sourceUrl" hint="A direct link to the bill text or a credible news article about it.">
          <input
            id="sourceUrl"
            name="sourceUrl"
            type="url"
            maxLength={500}
            placeholder="https://"
            className="w-full rounded-md border border-border bg-card px-3 py-2 text-base focus:border-flag-green focus:outline-none focus:ring-2 focus:ring-flag-green/30"
          />
        </Field>

        <Field label="Full bill text" htmlFor="fullText" hint="Optional. If you have the official text, paste it here and we'll run the plain-English explainer.">
          <textarea
            id="fullText"
            name="fullText"
            rows={6}
            maxLength={40000}
            placeholder="An Act to…"
            className="w-full rounded-md border border-border bg-card px-3 py-2 font-mono text-sm focus:border-flag-green focus:outline-none focus:ring-2 focus:ring-flag-green/30"
          />
        </Field>

        <Field label="Note to editor" htmlFor="submitterNote" hint="Anything we should know? Optional.">
          <textarea
            id="submitterNote"
            name="submitterNote"
            rows={2}
            maxLength={2000}
            className="w-full rounded-md border border-border bg-card px-3 py-2 text-base focus:border-flag-green focus:outline-none focus:ring-2 focus:ring-flag-green/30"
          />
        </Field>

        {searchParams.error && (
          <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
            {searchParams.error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-6">
          <button type="submit" className="rounded-md bg-flag-green px-5 py-2.5 text-sm font-semibold text-white hover:bg-flag-green-dark">
            Submit for review
          </button>
          <Link href="/contribute" className="text-sm text-muted-foreground hover:underline">Cancel</Link>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-foreground">
        {label}
      </label>
      {hint && <p className="mb-2 text-xs text-muted-foreground">{hint}</p>}
      {children}
    </div>
  );
}
