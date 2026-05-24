import { Badge } from '@/components/ui/badge';
import type { ExplainerPayload } from '@/lib/types';

export function ExplainerPanel({ explainer, sensitive }: { explainer: ExplainerPayload | null; sensitive: boolean }) {
  if (!explainer) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
        No plain-English explainer has been generated yet. Run <code className="font-mono">npm run ingest:senate</code> after seeding.
      </div>
    );
  }

  if (!explainer.visible) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-6 dark:border-amber-500/30 dark:bg-amber-500/5">
        <Badge variant="amber">Pending editorial review</Badge>
        <p className="mt-3 text-sm text-amber-900 dark:text-amber-200">
          This bill touches a sensitive topic — security, elections, religion, ethnicity, or fiscal policy.
          The AI-generated explainer is held for a human editor to review before publication. The bill
          text and timeline below are unaffected.
        </p>
      </div>
    );
  }

  const isTranslation = explainer.language !== 'en';
  const requestedMissing =
    explainer.requestedLanguage && explainer.requestedAvailable === false && explainer.requestedLanguage !== explainer.language;

  return (
    <div className="space-y-6">
      {(isTranslation || requestedMissing) && (
        <div className="flex items-start gap-2 rounded-md border border-gold/30 bg-gold/5 px-3 py-2 text-xs">
          <span className="font-display uppercase tracking-roman text-gold">i18n</span>
          <span className="text-foreground/80">
            {requestedMissing
              ? `Not yet translated into your language — showing the ${explainer.language === 'en' ? 'English' : explainer.language.toUpperCase()} version.`
              : 'AI-translated from the editor-reviewed English source.'}
          </span>
        </div>
      )}

      <div className="rounded-lg border border-flag-green/30 bg-flag-green/5 p-5">
        <Badge variant="green">AI-generated · human-reviewed</Badge>
        <p className="mt-3 font-serif text-lg leading-snug text-foreground">{explainer.tldr}</p>
      </div>

      <section>
        <h3 className="font-serif text-xl font-semibold tracking-tight">In plain English</h3>
        <div className="prose mt-2 max-w-prose whitespace-pre-line text-foreground">
          {explainer.plainEnglish}
        </div>
      </section>

      {explainer.howItAffectsYou && explainer.howItAffectsYou.length > 0 && (
        <section>
          <h3 className="font-serif text-xl font-semibold tracking-tight">How it affects you</h3>
          <ul className="mt-2 space-y-2">
            {explainer.howItAffectsYou.map((item, i) => (
              <li key={i} className="flex gap-3 text-foreground">
                <span className="mt-1 inline-block h-2 w-2 flex-none rounded-full bg-flag-green" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(explainer.argumentsFor || explainer.argumentsAgainst) && (
        <section className="grid gap-4 sm:grid-cols-2">
          <ArgumentColumn title="Arguments for" items={explainer.argumentsFor ?? []} accent="green" />
          <ArgumentColumn title="Arguments against" items={explainer.argumentsAgainst ?? []} accent="red" />
        </section>
      )}

      {explainer.jargonTerms && explainer.jargonTerms.length > 0 && (
        <section>
          <h3 className="font-serif text-xl font-semibold tracking-tight">Jargon buster</h3>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            {explainer.jargonTerms.map((j) => (
              <div key={j.term} className="rounded-md border border-border bg-card p-3">
                <dt className="font-medium text-foreground">{j.term}</dt>
                <dd className="mt-1 text-sm text-foreground/85">{j.definition}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {explainer.sourceCitations && explainer.sourceCitations.length > 0 && (
        <section className="rounded-md border border-border bg-muted p-4 text-sm">
          <div className="font-medium text-foreground">Sources used to generate this explainer</div>
          <ul className="mt-2 space-y-1">
            {explainer.sourceCitations.map((c, i) => (
              <li key={i}>
                <a href={c.url} className="text-flag-green-dark hover:underline" target="_blank" rel="noopener">
                  {c.label}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="rounded-md border border-border bg-card p-3 text-xs text-muted-foreground">
        Spotted an inaccuracy? <a className="text-flag-green-dark hover:underline" href="mailto:errors@naijabilltracker.example">Tell us</a>.
        Every flag is reviewed by a human editor.
      </div>
    </div>
  );
}

function ArgumentColumn({ title, items, accent }: { title: string; items: string[]; accent: 'green' | 'red' }) {
  if (items.length === 0) return null;
  const dot = accent === 'green' ? 'bg-flag-green' : 'bg-red-500';
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h4 className="font-semibold text-foreground">{title}</h4>
      <ul className="mt-2 space-y-2 text-sm text-foreground">
        {items.map((s, i) => (
          <li key={i} className="flex gap-2">
            <span className={`mt-1.5 inline-block h-2 w-2 flex-none rounded-full ${dot}`} aria-hidden />
            <span>{s}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
