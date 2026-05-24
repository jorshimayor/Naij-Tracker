import Link from 'next/link';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

export default async function LegislatorsPage() {
  const legislators = await api.listLegislators();
  const byChamber = legislators.reduce<Record<string, typeof legislators>>((acc, l) => {
    (acc[l.chamber] ??= []).push(l);
    return acc;
  }, {});

  return (
    <div className="container-wide py-10">
      <h1 className="font-serif text-3xl font-semibold tracking-tight">Legislators</h1>
      <p className="text-sm text-muted-foreground">{legislators.length} legislators across the chambers we cover.</p>

      <div className="mt-8 space-y-10">
        {Object.entries(byChamber).map(([chamber, list]) => (
          <section key={chamber}>
            <h2 className="font-serif text-xl font-semibold tracking-tight">{chamberLabel(chamber)}</h2>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((l) => (
                <li key={l.slug} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-center justify-between">
                    <Link
                      href={`/legislators/${l.slug}`}
                      className="font-medium text-foreground no-underline hover:text-flag-green-dark"
                    >
                      {l.fullName}
                    </Link>
                    {l.party && <Badge variant="outline">{l.party}</Badge>}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {l.constituency ?? l.state ?? '—'}
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {l.sponsorshipCount} bill{l.sponsorshipCount === 1 ? '' : 's'} sponsored
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

function chamberLabel(slug: string): string {
  if (slug === 'federal-senate') return 'Senate';
  if (slug === 'federal-reps') return 'House of Representatives';
  if (slug.endsWith('-hoa')) return slug.replace('-hoa', '').replace('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase()) + ' House of Assembly';
  return slug;
}
