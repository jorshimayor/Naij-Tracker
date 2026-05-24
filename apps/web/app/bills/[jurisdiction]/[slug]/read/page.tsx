import Link from 'next/link';
import { notFound } from 'next/navigation';
import { api } from '@/lib/api';
import { parseBillText } from '@/lib/bill-text';
import { ReadingProgress } from '@/components/bill-detail/reading-progress';
import { ReaderControls } from '@/components/bill-detail/reader-controls';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';
import { getT, getLocale } from '@/i18n/server';

export const dynamic = 'force-dynamic';

export default async function BillReaderPage({
  params,
}: {
  params: { jurisdiction: string; slug: string };
}) {
  const locale = getLocale();
  const t = getT(locale);

  let data: Awaited<ReturnType<typeof api.getBill>>;
  try {
    data = await api.getBill(params.jurisdiction, params.slug, locale);
  } catch {
    notFound();
  }
  const { bill } = data;
  const doc = parseBillText(bill.fullText);
  const backHref = `/bills/${bill.jurisdiction.slug}/${bill.slug}`;

  return (
    <div className="bg-background">
      <ReadingProgress storageKey={`bill:${bill.id}`} />

      {/* Reader chrome — minimal sticky header */}
      <header className="reader-chrome sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link
            href={backHref}
            className="flex items-center gap-2 text-sm text-muted-foreground no-underline transition-colors hover:text-gold"
          >
            <BackArrow />
            <span className="hidden sm:inline">{t('reader.back_to_bill')}</span>
            <span className="font-mono text-xs">{bill.billNumber}</span>
          </Link>

          <div className="flex items-center gap-2">
            <ReaderControls />
            {bill.documents.find((d) => d.type === 'PDF') && (
              <a
                href={bill.documents.find((d) => d.type === 'PDF')!.url}
                target="_blank"
                rel="noopener"
                className="hidden h-8 items-center gap-1.5 rounded-full border border-border bg-card px-3 font-display text-[11px] uppercase tracking-roman text-foreground/80 no-underline hover:border-gold hover:text-gold sm:inline-flex"
              >
                {t('reader.original_pdf')}
              </a>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        {/* Frontispiece — title page styling for the manuscript feel */}
        <div className="reader-chrome mx-auto max-w-3xl text-center">
          <p className="font-display text-[11px] uppercase tracking-roman text-gold">
            {bill.jurisdiction.name} · {bill.billNumber}
          </p>
          <h1 className="mt-4 font-display text-2xl font-semibold uppercase leading-tight tracking-tight text-foreground sm:text-3xl">
            {bill.title}
          </h1>
          <div className="mx-auto mt-5 h-px w-32 bg-gradient-to-r from-transparent via-gold to-transparent" aria-hidden />
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3 text-xs">
            <Badge variant="outline">{t(`stage.${bill.currentStage}`)}</Badge>
            <span className="font-display uppercase tracking-roman text-muted-foreground">
              {bill.introducedDate ? `${t('bill.introduced')} ${formatDate(bill.introducedDate)}` : ''}
            </span>
            <span className="font-display uppercase tracking-roman text-muted-foreground">·</span>
            <span className="font-display uppercase tracking-roman text-muted-foreground">
              {doc.wordCount.toLocaleString()} {t('reader.words')}
            </span>
            <span className="font-display uppercase tracking-roman text-muted-foreground">·</span>
            <span className="font-display uppercase tracking-roman text-muted-foreground">
              ≈ {doc.estimatedReadMinutes} {t('reader.min_read')}
            </span>
          </div>
        </div>

        {/* Body: TOC sidebar + prose column */}
        <div className="mt-14 grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)_180px]">
          {/* TOC (desktop) */}
          <aside className="reader-sidebar hidden lg:block">
            <div className="sticky top-24">
              <div className="roman-eyebrow">{t('reader.contents')}</div>
              {doc.sections.filter((s) => s.heading).length > 0 ? (
                <nav aria-label="Table of contents" className="mt-3 space-y-1.5 border-l border-border pl-3 text-sm">
                  {doc.sections
                    .filter((s) => s.heading)
                    .map((s) => (
                      <a
                        key={s.id}
                        href={`#${s.id}`}
                        className="block truncate text-foreground/75 no-underline transition-colors hover:text-gold"
                        title={s.heading}
                      >
                        {s.label}
                      </a>
                    ))}
                </nav>
              ) : (
                <p className="mt-3 text-xs text-muted-foreground">{t('reader.no_sections')}</p>
              )}
            </div>
          </aside>

          {/* Prose */}
          <article className="bill-prose mx-auto w-full max-w-prose">
            {doc.sections.length === 0 ? (
              <div className="rounded-md border border-dashed border-border p-8 text-center text-muted-foreground">
                {t('reader.no_text')}
              </div>
            ) : (
              doc.sections.map((s, i) => (
                <section
                  key={s.id}
                  id={s.id}
                  className={`reader-section scroll-mt-24 ${i === 0 ? 'reader-first' : ''}`}
                >
                  {s.heading && <h2 className="reader-heading">{s.heading}</h2>}
                  {s.paragraphs.map((p, j) => (
                    <p key={j}>{p}</p>
                  ))}
                </section>
              ))
            )}

            <div className="reader-chrome mt-16 border-t border-border pt-8 text-center">
              <div className="mx-auto h-px w-24 bg-gradient-to-r from-transparent via-gold to-transparent" aria-hidden />
              <p className="mt-6 font-display text-[11px] uppercase tracking-roman text-muted-foreground">
                ✦ {t('reader.finis')} ✦
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href={backHref}
                  className="rounded-md border border-border bg-card px-4 py-2 font-display text-xs uppercase tracking-roman text-foreground/80 no-underline transition-colors hover:border-gold hover:text-gold"
                >
                  {t('reader.back_to_bill')}
                </Link>
                <Link
                  href="/bills"
                  className="rounded-md border border-border bg-card px-4 py-2 font-display text-xs uppercase tracking-roman text-foreground/80 no-underline transition-colors hover:border-gold hover:text-gold"
                >
                  {t('nav.bills')}
                </Link>
              </div>
            </div>
          </article>

          {/* Right rail (desktop only) — quick facts */}
          <aside className="reader-sidebar hidden xl:block">
            <div className="sticky top-24 space-y-4 text-xs text-muted-foreground">
              <div>
                <div className="roman-eyebrow">{t('reader.original_in')}</div>
                <p className="mt-1 font-serif text-sm text-foreground/85">English</p>
                <p className="mt-1">{t('reader.original_note')}</p>
              </div>
              <div className="border-t border-border pt-4">
                <div className="roman-eyebrow">{t('reader.about')}</div>
                <p className="mt-1">
                  <Link href={backHref} className="text-foreground/85 no-underline hover:text-gold">{t('reader.see_plain_english')} →</Link>
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function BackArrow() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path d="M11 4l-6 6 6 6 1.4-1.4L7.8 10l4.6-4.6z" />
    </svg>
  );
}

