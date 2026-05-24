import Link from 'next/link';
import { api } from '@/lib/api';
import { BillCard } from '@/components/bill-card';
import { stageLabel } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type Stage =
  | 'INTRODUCED' | 'FIRST_READING' | 'SECOND_READING' | 'COMMITTEE'
  | 'THIRD_READING' | 'PASSED' | 'TRANSMITTED' | 'ASSENTED'
  | 'WITHDRAWN' | 'LAPSED';

const STAGES: Stage[] = [
  'INTRODUCED', 'FIRST_READING', 'SECOND_READING', 'COMMITTEE',
  'THIRD_READING', 'PASSED', 'TRANSMITTED', 'ASSENTED',
];

export default async function BillsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const q = strParam(searchParams.q);
  const jurisdiction = strParam(searchParams.jurisdiction);
  const stage = strParam(searchParams.stage);
  const topic = strParam(searchParams.topic);
  // When there's a search query, default to relevance ranking; otherwise newest activity.
  const sort = strParam(searchParams.sort) ?? (strParam(searchParams.q) ? 'relevance' : 'last_action_desc');

  const [response, jurisdictions, topics] = await Promise.all([
    api.listBills({ q, jurisdiction, stage, topic, sort, limit: '40' }),
    api.listJurisdictions(),
    api.listTopics(),
  ]);

  const activeFilters = [
    q && `"${q}"`,
    jurisdiction && jurisdictions.find((j) => j.slug === jurisdiction)?.name,
    stage && stageLabel(stage as Stage),
    topic && topics.find((t) => t.slug === topic)?.name,
  ].filter(Boolean) as string[];

  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
  const exportQs = new URLSearchParams();
  for (const [k, v] of Object.entries({ q, jurisdiction, stage, topic, sort })) {
    if (v) exportQs.set(k, v);
  }

  return (
    <div className="container-wide py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="roman-eyebrow">Tabula Legum</p>
          <h1 className="mt-1 font-display text-3xl font-semibold uppercase tracking-tight text-foreground sm:text-4xl">Browse bills</h1>
          <p className="mt-2 font-serif text-base text-muted-foreground">
            {response.total.toLocaleString()} bill{response.total === 1 ? '' : 's'}
            {activeFilters.length > 0 ? ` matching ${activeFilters.join(' · ')}` : ' tracked across all jurisdictions'}.
          </p>
        </div>
        <a
          href={`${apiBase}/api/bills/export.csv${exportQs.toString() ? `?${exportQs.toString()}` : ''}`}
          className="rounded-md border border-border bg-card px-4 py-2 font-display text-xs font-medium uppercase tracking-roman text-foreground/80 no-underline transition-colors hover:border-gold hover:text-gold"
        >
          ↓ Download CSV
        </a>
      </header>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="rounded-lg border border-border bg-card p-5 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto">
          <form method="get" className="space-y-5">
            <div>
              <label htmlFor="q" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Search
              </label>
              <input
                id="q"
                name="q"
                type="search"
                defaultValue={q ?? ''}
                placeholder="Title, sponsor, text…"
                className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus:border-flag-green focus:outline-none focus:ring-2 focus:ring-flag-green/30"
              />
            </div>

            <div>
              <label htmlFor="jurisdiction" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Jurisdiction
              </label>
              <select
                id="jurisdiction"
                name="jurisdiction"
                defaultValue={jurisdiction ?? ''}
                className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus:border-flag-green focus:outline-none focus:ring-2 focus:ring-flag-green/30"
              >
                <option value="">All jurisdictions</option>
                {jurisdictions.map((j) => (
                  <option key={j.slug} value={j.slug}>
                    {j.name} {j.billCount > 0 ? `(${j.billCount})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="stage" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Stage
              </label>
              <select
                id="stage"
                name="stage"
                defaultValue={stage ?? ''}
                className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus:border-flag-green focus:outline-none focus:ring-2 focus:ring-flag-green/30"
              >
                <option value="">Any stage</option>
                {STAGES.map((s) => (
                  <option key={s} value={s}>{stageLabel(s)}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="topic" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Topic
              </label>
              <select
                id="topic"
                name="topic"
                defaultValue={topic ?? ''}
                className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus:border-flag-green focus:outline-none focus:ring-2 focus:ring-flag-green/30"
              >
                <option value="">Any topic</option>
                {topics.filter((t) => t.billCount > 0).map((t) => (
                  <option key={t.slug} value={t.slug}>
                    {t.name} ({t.billCount})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="sort" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Sort
              </label>
              <select
                id="sort"
                name="sort"
                defaultValue={sort}
                className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus:border-flag-green focus:outline-none focus:ring-2 focus:ring-flag-green/30"
              >
                {q && <option value="relevance">Most relevant (search match)</option>}
                <option value="last_action_desc">Most recent activity</option>
                <option value="introduced_desc">Most recently introduced</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button type="submit" className="flex-1 rounded-md bg-flag-green px-4 py-2 text-sm font-semibold text-white hover:bg-flag-green-dark">
                Apply
              </button>
              <Link href="/bills" className="text-xs text-muted-foreground hover:underline">Reset</Link>
            </div>
          </form>
        </aside>

        <section>
          {response.results.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center text-muted-foreground">
              No bills match your filters.{' '}
              <Link href="/bills" className="text-flag-green-dark hover:underline">Reset</Link>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {response.results.map((b) => (
                <BillCard key={b.id} bill={b} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function strParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}
