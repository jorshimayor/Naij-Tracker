import type { IndicatorObservation } from '@/lib/types';

/**
 * Server-rendered line chart for indicator observations. Inline SVG, no client deps.
 *
 * The "sparkline" variant strips axes for tile usage; the "full" variant draws Y-axis
 * grid lines, X labels on the first/last/midpoint observations, and a hover-friendly
 * data point on the latest value.
 */
export function IndicatorChart({
  observations,
  variant = 'full',
  height,
  ariaLabel,
}: {
  observations: IndicatorObservation[];
  variant?: 'full' | 'spark';
  height?: number;
  ariaLabel?: string;
}) {
  const spark = variant === 'spark';
  const W = 800;
  const H = height ?? (spark ? 60 : 280);
  const padding = spark
    ? { top: 4, right: 4, bottom: 4, left: 4 }
    : { top: 16, right: 16, bottom: 32, left: 56 };

  if (observations.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded border border-dashed border-border bg-muted/30 text-xs text-muted-foreground"
        style={{ height: H }}
      >
        Awaiting first observation
      </div>
    );
  }

  const values = observations.map((o) => o.value);
  const minRaw = Math.min(...values);
  const maxRaw = Math.max(...values);
  const span = maxRaw - minRaw || Math.abs(maxRaw) || 1;
  const minY = minRaw - span * 0.08;
  const maxY = maxRaw + span * 0.08;

  const innerW = W - padding.left - padding.right;
  const innerH = H - padding.top - padding.bottom;
  const stepX = observations.length > 1 ? innerW / (observations.length - 1) : 0;

  const toX = (i: number) => padding.left + i * stepX;
  const toY = (v: number) => padding.top + innerH - ((v - minY) / (maxY - minY)) * innerH;

  const points = observations.map((o, i) => `${toX(i)},${toY(o.value)}`).join(' ');

  const last = observations[observations.length - 1];
  // Neutral line colour. Up/down is not the same as good/bad — falling CPI is good news,
  // falling reserves is bad news — so a directional colour scheme would mislead. The change
  // chips in the hero show direction; the line itself stays neutral.
  const stroke = 'hsl(var(--gold))';
  const fill = 'hsl(var(--gold) / 0.08)';

  // Area path under the line
  const areaPath =
    `M ${toX(0)} ${toY(observations[0].value)} ` +
    observations.slice(1).map((o, i) => `L ${toX(i + 1)} ${toY(o.value)}`).join(' ') +
    ` L ${toX(observations.length - 1)} ${padding.top + innerH} L ${toX(0)} ${padding.top + innerH} Z`;

  // Y-axis ticks (full variant only)
  const yTicks = spark
    ? []
    : [0, 0.25, 0.5, 0.75, 1].map((t) => {
        const v = minY + t * (maxY - minY);
        return { v, y: padding.top + innerH - t * innerH };
      });

  // X-axis labels (first, middle, last)
  const xLabels = spark
    ? []
    : [0, Math.floor(observations.length / 2), observations.length - 1]
        .filter((i, idx, arr) => arr.indexOf(i) === idx)
        .map((i) => ({ i, label: new Date(observations[i].date).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }) }));

  return (
    <svg
      role="img"
      aria-label={ariaLabel ?? 'Indicator trend'}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="block w-full"
      style={{ height: H }}
    >
      {/* Y-axis gridlines */}
      {yTicks.map((t, i) => (
        <g key={i}>
          <line
            x1={padding.left}
            x2={W - padding.right}
            y1={t.y}
            y2={t.y}
            stroke="hsl(var(--border))"
            strokeDasharray="2 4"
            strokeWidth={1}
          />
          <text
            x={padding.left - 8}
            y={t.y + 3}
            textAnchor="end"
            fontSize="10"
            fill="hsl(var(--muted-foreground))"
          >
            {formatTickValue(t.v)}
          </text>
        </g>
      ))}

      {/* Filled area */}
      <path d={areaPath} fill={fill} />

      {/* Line */}
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth={spark ? 1.5 : 2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Latest marker */}
      {!spark && (
        <circle
          cx={toX(observations.length - 1)}
          cy={toY(last.value)}
          r={3.5}
          fill={stroke}
        />
      )}

      {/* X-axis labels */}
      {xLabels.map(({ i, label }) => (
        <text
          key={i}
          x={toX(i)}
          y={H - padding.bottom + 18}
          textAnchor={i === 0 ? 'start' : i === observations.length - 1 ? 'end' : 'middle'}
          fontSize="10"
          fill="hsl(var(--muted-foreground))"
        >
          {label}
        </text>
      ))}
    </svg>
  );
}

function formatTickValue(v: number): string {
  if (Math.abs(v) >= 1000) return v.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (Math.abs(v) >= 100) return v.toFixed(0);
  return v.toFixed(1);
}
