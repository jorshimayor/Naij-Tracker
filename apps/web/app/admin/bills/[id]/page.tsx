import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { adminFetch, requireAdminCookie, type BillForReview, type VerificationResult } from '@/lib/admin';
import { Badge } from '@/components/ui/badge';
import { StagePill } from '@/components/ui/stage-pill';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function AdminBillReviewPage({ params }: { params: { id: string } }) {
  requireAdminCookie();
  const bill = await adminFetch<BillForReview>(`/api/admin/bills/${params.id}`);
  const latest = bill.explainers[0] ?? null;

  async function approve(formData: FormData) {
    'use server';
    const explainerId = String(formData.get('explainerId') ?? '');
    const note = String(formData.get('note') ?? '');
    await adminFetch(`/api/admin/explainers/${explainerId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ note: note || undefined }),
    });
    revalidatePath(`/admin/bills/${params.id}`);
  }

  async function flag(formData: FormData) {
    'use server';
    const explainerId = String(formData.get('explainerId') ?? '');
    const reason = String(formData.get('reason') ?? '');
    if (reason.length < 3) return;
    await adminFetch(`/api/admin/explainers/${explainerId}/flag`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
    revalidatePath(`/admin/bills/${params.id}`);
  }

  async function verify(formData: FormData) {
    'use server';
    const explainerId = String(formData.get('explainerId') ?? '');
    await adminFetch(`/api/admin/explainers/${explainerId}/verify`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    revalidatePath(`/admin/bills/${params.id}`);
  }

  async function toggleSensitive(formData: FormData) {
    'use server';
    const billId = String(formData.get('billId') ?? '');
    const sensitive = formData.get('sensitive') === 'true';
    await adminFetch(`/api/admin/bills/${billId}/sensitive`, {
      method: 'POST',
      body: JSON.stringify({ sensitive }),
    });
    revalidatePath(`/admin/bills/${params.id}`);
  }

  async function advanceStage(formData: FormData) {
    'use server';
    const billId = String(formData.get('billId') ?? '');
    const newStage = String(formData.get('newStage') ?? '');
    const note = String(formData.get('note') ?? '');
    if (!newStage) return;
    await adminFetch(`/api/admin/bills/${billId}/advance-stage`, {
      method: 'POST',
      body: JSON.stringify({ newStage, note: note || undefined }),
    });
    revalidatePath(`/admin/bills/${params.id}`);
  }

  async function translate(formData: FormData) {
    'use server';
    const explainerId = String(formData.get('explainerId') ?? '');
    const targetLanguage = String(formData.get('targetLanguage') ?? '');
    if (!explainerId || !targetLanguage) return;
    await adminFetch(`/api/admin/explainers/${explainerId}/translate`, {
      method: 'POST',
      body: JSON.stringify({ targetLanguage }),
    });
    revalidatePath(`/admin/bills/${params.id}`);
  }

  return (
    <div>
      <nav className="text-xs text-muted-foreground">
        <Link href="/admin/queue" className="hover:underline">Review queue</Link>
        <span className="px-1">›</span>
        <span className="text-foreground/85">{bill.billNumber}</span>
      </nav>

      <header className="mt-2">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="font-mono font-medium text-foreground/85">{bill.billNumber}</span>
          <span>·</span>
          <span>{bill.jurisdiction.name}</span>
          <span>·</span>
          <span>introduced {formatDate(bill.introducedDate)}</span>
        </div>
        <h1 className="mt-1 font-serif text-2xl font-semibold leading-snug tracking-tight text-foreground">
          {bill.title}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <StagePill stage={bill.currentStage as any} />
          {bill.sensitiveFlag && <Badge variant="amber">Sensitive</Badge>}
          {latest && (
            <Badge variant={statusVariant(latest.status)}>
              Explainer: {latest.status.replace(/_/g, ' ').toLowerCase()}
            </Badge>
          )}
        </div>
        <p className="mt-3 text-sm">
          <Link href={`/bills/${bill.jurisdiction.slug}/${bill.slug}`} className="text-flag-green-dark hover:underline" target="_blank">
            View public page ↗
          </Link>
        </p>
      </header>

      {!latest && (
        <div className="mt-6 rounded-lg border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
          No explainer generated yet. Run <code className="font-mono">npm run ingest:senate</code> after seeding.
        </div>
      )}

      {latest && (
        <>
          <section className="mt-6 rounded-lg border border-border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-serif text-lg font-semibold tracking-tight">AI-generated explainer</h2>
              <div className="text-xs text-muted-foreground">
                v{latest.version} · {latest.modelUsed} · generated {formatDate(latest.generatedAt)}
              </div>
            </div>

            <div className="mt-4 rounded-md border border-flag-green/30 bg-flag-green/5 p-4">
              <div className="text-xs uppercase tracking-wider text-flag-green-dark">TLDR</div>
              <p className="mt-1 font-serif text-base leading-snug text-foreground">{latest.tldr}</p>
            </div>

            <div className="mt-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">In plain English</div>
              <p className="mt-1 whitespace-pre-line text-sm text-foreground">{latest.plainEnglish}</p>
            </div>

            <div className="mt-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">How it affects you</div>
              <ul className="mt-1 space-y-1 text-sm text-foreground">
                {latest.howItAffectsYou.map((b, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-1.5 inline-block h-1.5 w-1.5 flex-none rounded-full bg-flag-green" aria-hidden />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>

            <details className="mt-4 rounded-md border border-border bg-muted p-3">
              <summary className="cursor-pointer text-xs uppercase tracking-wider text-muted-foreground">Bill text used by the AI</summary>
              <pre className="mt-2 max-h-72 overflow-y-auto whitespace-pre-wrap text-xs text-foreground/85">{bill.fullText}</pre>
            </details>

            {latest.reviewerNote && (
              <div className="mt-4 rounded-md border border-border bg-muted p-3 text-sm">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Last editor note</div>
                <p className="mt-1 text-foreground">{latest.reviewerNote}</p>
                <div className="mt-1 text-xs text-muted-foreground">{formatDate(latest.reviewedAt)}</div>
              </div>
            )}
          </section>

          {/* Translations */}
          <section className="mt-6 rounded-lg border border-border bg-card p-5">
            <h2 className="font-serif text-lg font-semibold tracking-tight">Translations</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Generate this explainer in Nigerian languages. AI translates from the English source —
              an editor can review the result by reading the bill detail page with the language switched.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(['yo', 'ig', 'ha', 'pcm'] as const).map((code) => {
                const meta = { yo: 'Yorùbá', ig: 'Igbo', ha: 'Hausa', pcm: 'Naija Pidgin' }[code];
                const existing = bill.explainers.some((e) => e.language === code && e.version === latest.version);
                return (
                  <form key={code} action={translate}>
                    <input type="hidden" name="explainerId" value={latest.id} />
                    <input type="hidden" name="targetLanguage" value={code} />
                    <button
                      className={
                        existing
                          ? 'rounded-md border border-flag-green/40 bg-flag-green/10 px-3 py-1.5 text-sm font-medium text-flag-green'
                          : 'rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium hover:border-gold hover:text-gold'
                      }
                    >
                      {existing ? `✓ ${meta}` : `Translate to ${meta}`}
                    </button>
                  </form>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Existing translations (version {latest.version}):{' '}
              {bill.explainers
                .filter((e) => e.version === latest.version)
                .map((e) => e.language.toUpperCase())
                .join(', ') || 'English only'}
            </p>
          </section>

          {/* Verification result */}
          <section className="mt-6 rounded-lg border border-border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-serif text-lg font-semibold tracking-tight">AI verification</h2>
              <form action={verify}>
                <input type="hidden" name="explainerId" value={latest.id} />
                <button className="rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium hover:border-flag-green hover:text-flag-green-dark">
                  {latest.verification ? 'Re-verify with AI' : 'Verify with AI'}
                </button>
              </form>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Run a second LLM pass that checks each claim in the explainer against the original bill text.
              {latest.verifiedAt && (
                <> Last verified {formatDate(latest.verifiedAt)}.</>
              )}
            </p>

            {latest.verification ? <VerificationDisplay v={latest.verification} /> : (
              <p className="mt-4 text-sm text-muted-foreground">No verification on file. Run one to see claim-by-claim grounding.</p>
            )}
          </section>

          {/* Editorial actions */}
          <section className="mt-6 grid gap-4 lg:grid-cols-2">
            <form action={approve} className="rounded-lg border border-border bg-card p-5">
              <input type="hidden" name="explainerId" value={latest.id} />
              <h3 className="font-serif text-base font-semibold tracking-tight">Approve</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Make this explainer publicly visible. Use for sensitive bills you've personally checked.
              </p>
              <textarea
                name="note"
                placeholder="Optional editor note (visible internally only)"
                rows={2}
                className="mt-3 w-full rounded-md border border-border px-3 py-2 text-sm"
              />
              <button className="mt-2 rounded-md bg-flag-green px-4 py-2 text-sm font-semibold text-white hover:bg-flag-green-dark">
                Approve & publish
              </button>
            </form>

            <form action={flag} className="rounded-lg border border-border bg-card p-5">
              <input type="hidden" name="explainerId" value={latest.id} />
              <h3 className="font-serif text-base font-semibold tracking-tight">Flag</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Mark the explainer as inaccurate. The public page will hide the explainer behind a "under review" banner.
              </p>
              <textarea
                name="reason"
                placeholder="Reason for flagging (required, will be logged)"
                rows={2}
                required
                minLength={3}
                className="mt-3 w-full rounded-md border border-border px-3 py-2 text-sm"
              />
              <button className="mt-2 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">
                Flag explainer
              </button>
            </form>
          </section>

          <section className="mt-6 rounded-lg border border-border bg-card p-5">
            <h3 className="font-serif text-base font-semibold tracking-tight">Advance stage</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Mark this bill as moving to a new stage. Records a stage event and fires email alerts to anyone
              following the bill, its topics, sponsors, or chamber.
            </p>
            <form action={advanceStage} className="mt-3 flex flex-wrap items-center gap-2">
              <input type="hidden" name="billId" value={bill.id} />
              <select
                name="newStage"
                defaultValue=""
                required
                className="rounded-md border border-border bg-card px-3 py-2 text-sm focus:border-flag-green focus:outline-none focus:ring-2 focus:ring-flag-green/30"
              >
                <option value="" disabled>New stage…</option>
                {['FIRST_READING','SECOND_READING','COMMITTEE','THIRD_READING','PASSED','TRANSMITTED','ASSENTED','WITHDRAWN','LAPSED']
                  .filter((s) => s !== bill.currentStage)
                  .map((s) => (
                    <option key={s} value={s}>{s.replace(/_/g, ' ').toLowerCase()}</option>
                  ))}
              </select>
              <input
                name="note"
                type="text"
                maxLength={500}
                placeholder="Optional note (shown in alert)"
                className="flex-1 min-w-[180px] rounded-md border border-border bg-card px-3 py-2 text-sm focus:border-flag-green focus:outline-none focus:ring-2 focus:ring-flag-green/30"
              />
              <button className="rounded-md bg-flag-green px-4 py-2 text-sm font-semibold text-white hover:bg-flag-green-dark">
                Advance & notify
              </button>
            </form>
            <p className="mt-2 text-xs text-muted-foreground">Currently at: <span className="font-mono text-foreground/85">{bill.currentStage.replace(/_/g, ' ').toLowerCase()}</span></p>
          </section>

          <section className="mt-6 rounded-lg border border-border bg-card p-5">
            <h3 className="font-serif text-base font-semibold tracking-tight">Sensitive flag</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Sensitive bills (elections, security, religion, ethnicity, fiscal) require explicit editorial approval
              before their explainer is publicly visible.
            </p>
            <form action={toggleSensitive} className="mt-3 flex items-center gap-3">
              <input type="hidden" name="billId" value={bill.id} />
              <input type="hidden" name="sensitive" value={String(!bill.sensitiveFlag)} />
              <button className="rounded-md border border-border bg-card px-4 py-2 text-sm hover:border-flag-green hover:text-flag-green-dark">
                {bill.sensitiveFlag ? 'Clear sensitive flag' : 'Mark as sensitive'}
              </button>
              <span className="text-xs text-muted-foreground">currently: {bill.sensitiveFlag ? 'sensitive' : 'not sensitive'}</span>
            </form>
          </section>
        </>
      )}
    </div>
  );
}

function statusVariant(status: string): 'amber' | 'red' | 'slate' | 'green' {
  if (status === 'PENDING_REVIEW') return 'amber';
  if (status === 'FLAGGED') return 'red';
  if (status === 'APPROVED') return 'green';
  return 'slate';
}

function VerificationDisplay({ v }: { v: VerificationResult }) {
  const verdictColor = (vd: string) => ({
    supported: 'green' as const,
    partial: 'amber' as const,
    unsupported: 'red' as const,
    unverifiable: 'slate' as const,
  })[vd] ?? 'slate';
  return (
    <div className="mt-4 space-y-3">
      <div className="rounded-md border border-border bg-muted p-3 text-sm">
        <div className="flex items-center gap-2">
          <Badge variant={verdictColor(v.overallVerdict)}>{v.overallVerdict}</Badge>
          <span className="text-xs text-muted-foreground">{v.modelUsed}</span>
        </div>
        <p className="mt-1 text-foreground">{v.summary}</p>
      </div>

      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Claim-by-claim grounding</div>
        <ul className="mt-2 space-y-2">
          {v.checks.map((c, i) => (
            <li key={i} className="rounded-md border border-border bg-card p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant={verdictColor(c.verdict)}>{c.verdict}</Badge>
                <span className="text-muted-foreground uppercase tracking-wider">{c.claimType.replace(/_/g, ' ')}</span>
              </div>
              <p className="mt-2 text-foreground">{c.claim}</p>
              {c.evidence && (
                <blockquote className="mt-2 border-l-2 border-border bg-muted px-3 py-1 text-xs italic text-foreground/85">
                  {c.evidence}
                </blockquote>
              )}
              {c.notes && <p className="mt-2 text-xs text-muted-foreground">{c.notes}</p>}
            </li>
          ))}
        </ul>
      </div>

      {/* Tavily web sources */}
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          External sources {v.externalSearchEnabled === false ? '(disabled — set TAVILY_API_KEY)' : v.externalSources?.length ? `· ${v.externalSources.length} found` : ''}
        </div>
        {v.externalSources && v.externalSources.length > 0 ? (
          <ul className="mt-2 space-y-2">
            {v.externalSources.map((s, i) => (
              <li key={i} className="rounded-md border border-border bg-card p-3 text-sm">
                <div className="flex items-baseline justify-between gap-2">
                  <a href={s.url} target="_blank" rel="noopener" className="font-medium text-flag-green-dark hover:underline">
                    {s.title}
                  </a>
                  <span className="font-mono text-xs text-muted-foreground">score {s.score.toFixed(2)}</span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{new URL(s.url).hostname}{s.publishedDate ? ` · ${s.publishedDate.slice(0, 10)}` : ''}</div>
                <p className="mt-2 text-xs text-foreground/85 line-clamp-3">{s.content}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            {v.externalSearchEnabled === false
              ? 'Web grounding skipped — Tavily not configured. Add TAVILY_API_KEY to .env and re-verify.'
              : 'No external press or analysis found for this bill yet.'}
          </p>
        )}
      </div>
    </div>
  );
}
