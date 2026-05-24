import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="container-prose py-20 text-center">
      <h1 className="font-serif text-4xl font-semibold tracking-tight">Not found</h1>
      <p className="mt-3 text-foreground/85">
        We couldn't find that page. The bill or legislator may have been renamed, withdrawn, or never seeded.
      </p>
      <div className="mt-6">
        <Link href="/bills" className="rounded-md bg-flag-green px-4 py-2 text-sm font-semibold text-white no-underline hover:bg-flag-green-dark">
          Browse all bills
        </Link>
      </div>
    </div>
  );
}
