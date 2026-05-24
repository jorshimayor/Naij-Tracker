import { adminFetch, requireAdminCookie, type AuditLogEntry } from '@/lib/admin';
import { formatDate, timeAgo } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const ACTION_LABEL: Record<string, string> = {
  'explainer.approve': 'Approved explainer',
  'explainer.flag': 'Flagged explainer',
  'explainer.verify': 'AI verification run',
  'bill.set_sensitive': 'Changed sensitive flag',
};

export default async function AuditLogPage() {
  requireAdminCookie();
  const entries = await adminFetch<AuditLogEntry[]>('/api/admin/audit-log');
  return (
    <div>
      <h1 className="font-serif text-3xl font-semibold tracking-tight">Audit log</h1>
      <p className="mt-1 text-sm text-muted-foreground">Last {entries.length} editorial actions, newest first.</p>

      {entries.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          No editorial actions logged yet.
        </div>
      ) : (
        <ul className="mt-6 space-y-2">
          {entries.map((e) => (
            <li key={e.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground/85">{ACTION_LABEL[e.action] ?? e.action}</span>
                <span>·</span>
                <span>{e.entityType}</span>
                <span>·</span>
                <span>{timeAgo(e.createdAt)} ({formatDate(e.createdAt)})</span>
              </div>
              <div className="mt-1 font-mono text-xs text-muted-foreground">{e.entityId}</div>
              {e.after !== null && e.after !== undefined && (
                <pre className="mt-2 overflow-x-auto rounded bg-muted p-2 text-xs text-foreground/85">
                  {JSON.stringify(e.after, null, 2)}
                </pre>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
