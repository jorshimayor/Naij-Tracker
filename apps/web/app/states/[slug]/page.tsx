import Link from 'next/link';
import { notFound } from 'next/navigation';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { StagePill } from '@/components/ui/stage-pill';
import { getBySlug, ZONE_NAMES } from '@/lib/data/states';
import { timeAgo } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function StateDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const state = getBySlug(params.slug);
  if (!state) notFound();

  let detail;
  try {
    detail = await api.getStateDetail(state.name);
  } catch {
    // The API endpoint returns 200 even when empty; a thrown error here is a real outage.
    notFound();
  }

  const hasSenators = detail.senators.length > 0;
  const hasReps = detail.reps.length > 0;
  const hasAssemblyBills = detail.stateAssemblyBills.length > 0;

  return (
    <div className="container-wide py-10">
      <nav aria-label="Breadcrumb" className="mb-4 font-display text-[10px] uppercase tracking-roman text-muted-foreground">
        <Link href="/states" className="no-underline hover:text-gold">States</Link>
        <span aria-hidden> · </span>
        <span>{ZONE_NAMES[state.zone]}</span>
      </nav>

      <header className="mb-8">
        <p className="roman-eyebrow">{state.code}</p>
        <h1 className="mt-1 font-display text-3xl font-semibold uppercase tracking-tight text-foreground sm:text-4xl">
          {state.name}
        </h1>
        <p className="mt-2 font-serif text-base text-muted-foreground">
          {ZONE_NAMES[state.zone]} geopolitical zone.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
        {/* Senators */}
        <section className="rounded-lg border border-border bg-card p-5">
          <header className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-display text-sm font-semibold uppercase tracking-roman text-foreground">
              Senators
            </h2>
            <Badge variant={hasSenators ? 'green' : 'slate'}>
              {hasSenators ? `${detail.senators.length} on file` : 'Not yet imported'}
            </Badge>
          </header>
          {hasSenators ? (
            <ul className="space-y-3">
              {detail.senators.map((s) => (
                <LegislatorRow key={s.slug} leg={s} />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              The 109 sitting Senators will appear here once the senate scraper has run.
            </p>
          )}
        </section>

        {/* House of Reps */}
        <section className="rounded-lg border border-border bg-card p-5">
          <header className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-display text-sm font-semibold uppercase tracking-roman text-foreground">
              House of Representatives
            </h2>
            <Badge variant={hasReps ? 'green' : 'slate'}>
              {hasReps ? `${detail.reps.length} on file` : 'Pending data drive'}
            </Badge>
          </header>
          {hasReps ? (
            <ul className="space-y-3">
              {detail.reps.map((r) => (
                <LegislatorRow key={r.slug} leg={r} />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              All 360 federal constituencies are out of scope for v0. State-by-state import
              comes after the senator drive lands.
            </p>
          )}
        </section>

        {/* State Assembly bills */}
        <section className="rounded-lg border border-border bg-card p-5 lg:col-span-2">
          <header className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-display text-sm font-semibold uppercase tracking-roman text-foreground">
              State Assembly bills
            </h2>
            <Badge variant={hasAssemblyBills ? 'green' : 'slate'}>
              {detail.stateAssemblies.length > 0
                ? `${detail.stateAssemblies.length} assembly tracked`
                : 'Assembly not yet tracked'}
            </Badge>
          </header>
          {hasAssemblyBills ? (
            <ul className="space-y-3">
              {detail.stateAssemblyBills.map((b) => (
                <li key={b.slug}>
                  <div className="flex flex-wrap items-baseline gap-2 font-display text-[10px] uppercase tracking-roman text-muted-foreground">
                    <span className="font-mono text-[11px] text-gold">{b.billNumber}</span>
                    <span aria-hidden>·</span>
                    <span>{b.jurisdiction.name}</span>
                    {b.lastActionDate && (
                      <>
                        <span aria-hidden>·</span>
                        <span>last action {timeAgo(b.lastActionDate)}</span>
                      </>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-baseline gap-2">
                    <Link
                      href={`/bills/${b.jurisdiction.slug}/${b.slug}`}
                      className="font-serif text-base leading-snug text-foreground no-underline hover:text-gold"
                    >
                      {b.title}
                    </Link>
                    <StagePill stage={b.currentStage as any} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No bills on file for this state's assembly yet. Coverage is currently strongest
              for Lagos State House of Assembly.
            </p>
          )}
        </section>

        {/* State indicators */}
        <section className="rounded-lg border border-border bg-card p-5 lg:col-span-2">
          <header className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-display text-sm font-semibold uppercase tracking-roman text-foreground">
              State economic indicators
            </h2>
            <Badge variant="slate">v0 — pending state-level series</Badge>
          </header>
          <p className="text-sm text-muted-foreground">
            State-level IGR, unemployment, poverty headcount and food CPI by state are
            catalogued in the economy tracker but not yet ingested in v0. The federal
            indicators apply to every state in the meantime —
            {' '}
            <Link href="/economy" className="text-gold hover:underline">see the national dashboard</Link>.
          </p>
        </section>
      </div>
    </div>
  );
}

function LegislatorRow({ leg }: {
  leg: {
    slug: string;
    fullName: string;
    party: string | null;
    constituency: string | null;
    photoUrl: string | null;
  };
}) {
  return (
    <li className="flex items-start gap-3">
      <div
        aria-hidden
        className="h-10 w-10 shrink-0 rounded-full bg-muted bg-cover bg-center ring-1 ring-border"
        style={leg.photoUrl ? { backgroundImage: `url(${leg.photoUrl})` } : undefined}
      />
      <div className="min-w-0 flex-1">
        <Link
          href={`/legislators/${leg.slug}`}
          className="block font-serif text-base font-medium leading-snug text-foreground no-underline hover:text-gold"
        >
          {leg.fullName}
        </Link>
        <div className="font-display text-[10px] uppercase tracking-roman text-muted-foreground">
          {[leg.party, leg.constituency].filter(Boolean).join(' · ') || '—'}
        </div>
      </div>
    </li>
  );
}
