import Link from 'next/link';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

const TYPE_LABEL: Record<string, string> = {
  FEDERAL_SENATE: 'Federal',
  FEDERAL_REPS: 'Federal',
  EXECUTIVE: 'Federal',
  STATE_ASSEMBLY: 'State',
  FCT_ASSEMBLY: 'FCT',
};

export default async function JurisdictionsPage() {
  const jurisdictions = await api.listJurisdictions();
  const grouped = jurisdictions.reduce<Record<string, typeof jurisdictions>>((acc, j) => {
    const k = TYPE_LABEL[j.type] ?? 'Other';
    (acc[k] ??= []).push(j);
    return acc;
  }, {});

  return (
    <div className="container-wide py-10">
      <h1 className="font-serif text-3xl font-semibold tracking-tight">Jurisdictions</h1>
      <p className="text-sm text-muted-foreground">
        We currently track the National Assembly plus a starter set of State Houses of Assembly. Coverage expands as our editor team and contributors grow.
      </p>

      <div className="mt-8 space-y-10">
        {Object.entries(grouped).map(([group, list]) => (
          <section key={group}>
            <h2 className="font-serif text-xl font-semibold tracking-tight">{group}</h2>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((j) => (
                <li key={j.slug} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-center justify-between">
                    <Link
                      href={`/bills?jurisdiction=${j.slug}`}
                      className="font-medium text-foreground no-underline hover:text-flag-green-dark"
                    >
                      {j.name}
                    </Link>
                    <Badge variant={j.billCount > 0 ? 'green' : 'slate'}>{j.billCount}</Badge>
                  </div>
                  {j.websiteUrl && (
                    <div className="mt-1 text-xs text-muted-foreground truncate">
                      <a className="hover:underline" href={j.websiteUrl} target="_blank" rel="noopener">
                        {j.websiteUrl}
                      </a>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
