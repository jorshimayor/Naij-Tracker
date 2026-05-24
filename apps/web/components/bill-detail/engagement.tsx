import type { BillDetail } from '@/lib/types';

export function Engagement({ bill }: { bill: BillDetail }) {
  const primary = bill.sponsors.find((s) => s.role === 'PRIMARY')?.legislator ?? bill.sponsors[0]?.legislator;
  const shareText = `${bill.title} (${bill.billNumber}, ${bill.jurisdiction.name})`;
  const publicBase = (process.env.NEXT_PUBLIC_WEB_URL ?? 'https://naijabilltracker.com.ng').replace(/\/$/, '');
  const shareUrl = `${publicBase}/bills/${bill.jurisdiction.slug}/${bill.slug}`;
  const whatsappLink = `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${shareUrl}`)}`;
  const twitterLink = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="font-serif text-lg font-semibold tracking-tight">Write to a sponsor</h3>
        {primary ? (
          <>
            <p className="mt-1 text-sm text-muted-foreground">
              Send <span className="font-medium text-foreground">{primary.fullName}</span> your view on this bill.
              We open a pre-filled draft — your email client sends it.
            </p>
            <a
              href={`mailto:${primary.contactEmail ?? ''}?subject=${encodeURIComponent(`About ${bill.billNumber}: ${bill.title.slice(0, 80)}`)}&body=${encodeURIComponent(
                `Dear ${primary.fullName},\n\nI am writing about ${bill.billNumber} ("${bill.title}") currently before the ${bill.jurisdiction.name}.\n\n[Your message here]\n\nRegards,\n[Your name]\n${bill.jurisdiction.slug} constituent`,
              )}`}
              className="mt-3 inline-block rounded-md bg-flag-green px-4 py-2 text-sm font-semibold text-white no-underline hover:bg-flag-green-dark"
            >
              Open email draft
            </a>
          </>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">No primary sponsor recorded for this bill yet.</p>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="font-serif text-lg font-semibold tracking-tight">Share</h3>
        <p className="mt-1 text-sm text-muted-foreground">Pass it on. Bills move faster when more people are watching.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a className="rounded-md border border-border bg-card px-4 py-2 text-sm no-underline hover:border-flag-green hover:text-flag-green" href={whatsappLink} target="_blank" rel="noopener">
            WhatsApp
          </a>
          <a className="rounded-md border border-border bg-card px-4 py-2 text-sm no-underline hover:border-flag-green hover:text-flag-green" href={twitterLink} target="_blank" rel="noopener">
            X / Twitter
          </a>
        </div>
      </div>
    </div>
  );
}
