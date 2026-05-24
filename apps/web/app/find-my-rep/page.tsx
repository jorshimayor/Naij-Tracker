import Link from 'next/link';
import { api, type RepLookupPerson } from '@/lib/api';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

export default async function FindMyRepPage({
  searchParams,
}: {
  searchParams: { state?: string; lga?: string };
}) {
  const { states, meta } = await api.listStates();
  const selectedState = searchParams.state
    ? states.find((s) => s.code === searchParams.state || s.name === searchParams.state)
    : undefined;
  const selectedLga = searchParams.lga;

  let result: Awaited<ReturnType<typeof api.lookupRep>> | null = null;
  if (selectedState && selectedLga) {
    try {
      result = await api.lookupRep(selectedState.code, selectedLga);
    } catch {
      result = null;
    }
  }

  return (
    <div className="container-wide py-10">
      <h1 className="font-serif text-3xl font-semibold tracking-tight">Find my representatives</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Pick your state, then your Local Government Area. We'll show you the people who represent you
        in the National Assembly and (where available) the State House of Assembly.
      </p>

      {/* Picker */}
      <form method="get" className="mt-6 grid max-w-3xl gap-3 rounded-lg border border-border bg-card p-5 sm:grid-cols-3">
        <div>
          <label htmlFor="state" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            State
          </label>
          <select
            id="state"
            name="state"
            defaultValue={selectedState?.code ?? ''}
            className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus:border-flag-green focus:outline-none focus:ring-2 focus:ring-flag-green/30"
          >
            <option value="">Select state…</option>
            {states.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="lga" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            LGA
          </label>
          <select
            id="lga"
            name="lga"
            defaultValue={selectedLga ?? ''}
            className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus:border-flag-green focus:outline-none focus:ring-2 focus:ring-flag-green/30"
          >
            <option value="">{selectedState ? 'Select LGA…' : 'Pick a state first'}</option>
            {selectedState?.lgas.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>

        <div className="flex items-end">
          <button type="submit" className="w-full rounded-md bg-flag-green px-4 py-2 text-sm font-semibold text-white hover:bg-flag-green-dark">
            Find my reps
          </button>
        </div>
      </form>

      {/* Helpful UX note when only state is picked */}
      {selectedState && !selectedLga && (
        <p className="mt-3 text-sm text-muted-foreground">
          Pick an LGA in {selectedState.name} ({selectedState.lgaCount} available) and submit.
        </p>
      )}

      {/* Result */}
      {result && (
        <section className="mt-8">
          <div className="mb-3 text-sm text-foreground/85">
            Showing representatives for <span className="font-medium">{result.lga}, {result.state.name}</span>.
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <RepCard label="Senator (federal)" person={result.senator} />
            <RepCard label="Member, House of Representatives" person={result.representative} />
            <RepCard label="Member, State House of Assembly" person={result.stateAssemblyMember} />
          </div>
        </section>
      )}

      {/* Methodology note */}
      <div className="mt-10 rounded-md border border-border bg-muted p-4 text-sm text-foreground/85">
        <div className="font-medium text-foreground">About this dataset</div>
        <p className="mt-1">{meta.note}</p>
        <p className="mt-2 text-xs text-muted-foreground">Last updated {meta.lastUpdated}.</p>
      </div>
    </div>
  );
}

function RepCard({ label, person }: { label: string; person: RepLookupPerson | null }) {
  if (!person) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-5">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <p className="mt-2 text-sm text-muted-foreground">No data for this LGA at this level yet.</p>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <Link href={`/legislators/${person.slug}`} className="mt-1 block font-serif text-lg font-semibold tracking-tight text-foreground no-underline hover:text-flag-green-dark">
        {person.fullName}
      </Link>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {person.party && <Badge variant="outline">{person.party}</Badge>}
        {person.constituency && <span>· {person.constituency}</span>}
      </div>
      {person.contactEmail && (
        <a className="mt-3 inline-block text-sm text-flag-green-dark hover:underline" href={`mailto:${person.contactEmail}`}>
          {person.contactEmail}
        </a>
      )}
      {person.recentBills.length > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Recent sponsored bills</div>
          <ul className="mt-2 space-y-1">
            {person.recentBills.slice(0, 3).map((b) => (
              <li key={`${b.jurisdiction.slug}/${b.slug}`}>
                <Link href={`/bills/${b.jurisdiction.slug}/${b.slug}`} className="text-sm leading-tight text-foreground no-underline hover:text-flag-green-dark">
                  <span className="font-mono text-xs text-muted-foreground">{b.billNumber}</span>{' '}
                  {b.title.slice(0, 90)}{b.title.length > 90 ? '…' : ''}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
