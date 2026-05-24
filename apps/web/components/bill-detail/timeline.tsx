import { stageLabel, formatDate } from '@/lib/utils';
import type { BillStage } from '@/lib/types';

export function Timeline({
  events,
  currentStage,
}: {
  events: { stage: BillStage; occurredOn: string; notes?: string | null }[];
  currentStage: BillStage;
}) {
  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">No stage events recorded.</p>;
  }
  return (
    <ol className="relative space-y-6 border-l-2 border-border pl-6">
      {events.map((e, i) => {
        const isCurrent = e.stage === currentStage && i === events.length - 1;
        return (
          <li key={i} className="relative">
            <span
              className={`absolute -left-[33px] top-1.5 h-4 w-4 rounded-full ring-4 ring-slate-50 ${
                isCurrent ? 'bg-flag-green' : 'bg-slate-300'
              }`}
              aria-hidden
            />
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className={`font-medium ${isCurrent ? 'text-flag-green-dark' : 'text-foreground'}`}>
                {stageLabel(e.stage)}
              </span>
              <span className="text-xs text-muted-foreground">{formatDate(e.occurredOn)}</span>
              {isCurrent && (
                <span className="text-[10px] uppercase tracking-widest text-flag-green-dark">current</span>
              )}
            </div>
            {e.notes && <p className="mt-1 text-sm text-foreground/85">{e.notes}</p>}
          </li>
        );
      })}
    </ol>
  );
}
