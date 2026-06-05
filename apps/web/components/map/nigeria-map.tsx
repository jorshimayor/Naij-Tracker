'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { StatePath, MapViewBox } from '@/lib/data/nigeria-map-paths';

/**
 * Interactive choropleth of Nigeria's 36 states + FCT.
 *
 * Server (parent page) passes:
 *   - paths: precomputed SVG path "d" strings for each state
 *   - viewBox: the projected viewbox dimensions
 *   - stats: per-state counts (bills, indicators, senators…) keyed by ISO code
 *   - linkBase: where clicking a state navigates ("/states")
 *
 * Hover state is tracked locally; tooltip is rendered as an HTML overlay positioned
 * over the centroid of the hovered state so it scales naturally with the SVG.
 */
export interface StateStats {
  bills?: number;
  indicators?: number;
  senators?: number;
}

export function NigeriaMap({
  paths,
  viewBox,
  stats,
  linkBase = '/states',
}: {
  paths: StatePath[];
  viewBox: MapViewBox;
  stats: Record<string, StateStats>;
  linkBase?: string;
}) {
  const [hoverCode, setHoverCode] = useState<string | null>(null);

  const slugFor = (code: string) =>
    // Map ISO code → slug used at /states/[slug]
    // Reusing the codes from lib/data/states.ts would be ideal; for v0 we lowercase the
    // state name with hyphens, which matches the slug list there 1:1 for current states.
    paths.find((p) => p.code === code)?.name.toLowerCase().replace(/\s+/g, '-') ?? '';

  const hovered = hoverCode ? paths.find((p) => p.code === hoverCode) : null;
  const hoveredStats = hovered ? stats[hovered.code] ?? {} : {};

  const aspect = useMemo(() => `${viewBox.width} / ${viewBox.height}`, [viewBox]);

  return (
    <div className="relative" style={{ aspectRatio: aspect }}>
      <svg
        viewBox={`0 0 ${viewBox.width} ${viewBox.height}`}
        className="absolute inset-0 h-full w-full"
        role="img"
        aria-label="Map of Nigeria — hover a state for details, click to open."
      >
        {paths.map((p) => {
          const isHover = p.code === hoverCode;
          // Light/dark theme tokens; saturated fill for hovered, subtle fill otherwise.
          return (
            <Link key={p.code} href={`${linkBase}/${slugFor(p.code)}`}>
              <path
                d={p.d}
                className={
                  'cursor-pointer transition-colors duration-150 ' +
                  (isHover
                    ? 'fill-flag-green stroke-flag-green-dark'
                    : 'fill-flag-green/15 stroke-flag-green/40 hover:fill-flag-green/40')
                }
                strokeWidth={1}
                strokeLinejoin="round"
                onMouseEnter={() => setHoverCode(p.code)}
                onMouseLeave={() => setHoverCode((c) => (c === p.code ? null : c))}
                onFocus={() => setHoverCode(p.code)}
                onBlur={() => setHoverCode((c) => (c === p.code ? null : c))}
                tabIndex={0}
                aria-label={`${p.name}${formatStatsLabel(stats[p.code])}`}
              />
            </Link>
          );
        })}
      </svg>

      {hovered && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border border-border bg-card px-3 py-2 shadow-lg"
          style={{
            // Centroid is in viewBox units; convert to % of container.
            left: `${(hovered.centroid.x / viewBox.width) * 100}%`,
            top: `${(hovered.centroid.y / viewBox.height) * 100}%`,
            minWidth: 160,
          }}
        >
          <div className="font-display text-[11px] font-semibold uppercase tracking-roman text-foreground">
            {hovered.name}
          </div>
          <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
            <dt>Bills</dt>
            <dd className="text-right font-medium text-foreground">{hoveredStats.bills ?? 0}</dd>
            <dt>Indicators</dt>
            <dd className="text-right font-medium text-foreground">{hoveredStats.indicators ?? 0}</dd>
            <dt>Senators</dt>
            <dd className="text-right font-medium text-foreground">{hoveredStats.senators ?? 0}</dd>
          </dl>
          <div className="mt-1 text-[10px] uppercase tracking-roman text-gold">Click to open →</div>
        </div>
      )}
    </div>
  );
}

function formatStatsLabel(s: StateStats | undefined): string {
  if (!s) return '';
  const parts: string[] = [];
  if (s.bills) parts.push(`${s.bills} bill${s.bills === 1 ? '' : 's'}`);
  if (s.indicators) parts.push(`${s.indicators} indicator${s.indicators === 1 ? '' : 's'}`);
  if (s.senators) parts.push(`${s.senators} senator${s.senators === 1 ? '' : 's'}`);
  return parts.length ? `: ${parts.join(', ')}` : '';
}
