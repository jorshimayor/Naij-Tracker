import Link from 'next/link';
import { api } from '@/lib/api';
import { NigeriaMap, type StateStats } from '@/components/map/nigeria-map';
import { getNigeriaMap } from '@/lib/data/nigeria-map-paths';
import { STATES, ZONE_NAMES, getByCode } from '@/lib/data/states';

export const dynamic = 'force-dynamic';

/**
 * /states — map-led landing.
 * Shows an interactive map of Nigeria; clicking a state opens /states/[slug]
 * with senators / reps / state-assembly bills / state economic indicators.
 */
export default async function StatesPage() {
  const { viewBox, paths } = getNigeriaMap();
  const { states: rawStats } = await api.stateStats();

  // Build code → StateStats lookup. API returns lowercased state names; resolve to ISO codes
  // via the canonical STATES list (matches against lowercased name).
  const byNameLc = new Map(STATES.map((s) => [s.name.toLowerCase(), s.code]));
  const stats: Record<string, StateStats> = {};
  for (const row of rawStats) {
    const code = byNameLc.get(row.nameKey);
    if (!code) continue;
    stats[code] = {
      bills: row.bills,
      senators: row.senators,
      indicators: row.indicators,
    };
  }

  // Group states by zone for the listing below the map.
  const byZone = STATES.reduce<Record<string, typeof STATES>>((acc, s) => {
    (acc[s.zone] ??= []).push(s);
    return acc;
  }, {});
  const zoneOrder: (keyof typeof ZONE_NAMES)[] = ['NC', 'NE', 'NW', 'SE', 'SS', 'SW'];

  const totalSenators = Object.values(stats).reduce((a, b) => a + (b.senators ?? 0), 0);
  const totalReps = rawStats.reduce((a, b) => a + b.reps, 0);
  const totalBills = Object.values(stats).reduce((a, b) => a + (b.bills ?? 0), 0);

  return (
    <div className="container-wide py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="roman-eyebrow">Civitates Nigeriæ</p>
          <h1 className="mt-1 font-display text-3xl font-semibold uppercase tracking-tight text-foreground sm:text-4xl">
            States
          </h1>
          <p className="mt-2 max-w-prose font-serif text-base text-muted-foreground">
            Hover a state for a snapshot, click for the full picture — senators, House reps,
            state-assembly bills, and state-level economic indicators where available.
          </p>
        </div>
        <dl className="flex gap-6 font-display text-xs uppercase tracking-roman text-muted-foreground">
          <div>
            <dt>States covered</dt>
            <dd className="mt-0.5 font-serif text-2xl font-semibold text-foreground">{STATES.length}</dd>
          </div>
          <div>
            <dt>Senators on file</dt>
            <dd className="mt-0.5 font-serif text-2xl font-semibold text-foreground">{totalSenators}</dd>
          </div>
          <div>
            <dt>Reps on file</dt>
            <dd className="mt-0.5 font-serif text-2xl font-semibold text-foreground">{totalReps}</dd>
          </div>
          <div>
            <dt>State-assembly bills</dt>
            <dd className="mt-0.5 font-serif text-2xl font-semibold text-foreground">{totalBills}</dd>
          </div>
        </dl>
      </header>

      <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
        <section className="rounded-lg border border-border bg-card p-4">
          <NigeriaMap paths={paths} viewBox={viewBox} stats={stats} linkBase="/states" />
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Boundaries: geoBoundaries (CC BY 4.0). v0 senator / rep coverage is partial — pending data ingest.
          </p>
        </section>

        <aside>
          <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-roman text-foreground">
            By geopolitical zone
          </h2>
          <div className="space-y-4">
            {zoneOrder.map((zone) => (
              <div key={zone}>
                <div className="mb-1 font-display text-[10px] uppercase tracking-roman text-muted-foreground">
                  {ZONE_NAMES[zone]}
                </div>
                <ul className="grid grid-cols-2 gap-1">
                  {(byZone[zone] ?? []).map((s) => {
                    const st = stats[s.code];
                    const live = (st?.bills ?? 0) + (st?.senators ?? 0) > 0;
                    return (
                      <li key={s.code}>
                        <Link
                          href={`/states/${s.slug}`}
                          className={
                            'flex items-center justify-between gap-2 rounded px-2 py-1 text-sm no-underline hover:bg-muted ' +
                            (live ? 'text-foreground' : 'text-muted-foreground')
                          }
                        >
                          <span>{s.name}</span>
                          {live && st && (
                            <span className="font-mono text-[10px] text-gold">
                              {[st.senators && `${st.senators}S`, st.bills && `${st.bills}B`]
                                .filter(Boolean)
                                .join(' ')}
                            </span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
