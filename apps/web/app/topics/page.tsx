import Link from 'next/link';
import { api } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function TopicsPage() {
  const topics = await api.listTopics();
  return (
    <div className="container-wide py-10">
      <h1 className="font-serif text-3xl font-semibold tracking-tight">Topics</h1>
      <p className="text-sm text-muted-foreground">
        {topics.length} topics. Every bill is tagged so you can follow the issues that matter to you.
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {topics.map((t) => (
          <Link
            key={t.slug}
            href={`/topics/${t.slug}`}
            className="flex items-center justify-between rounded-lg border border-border bg-card p-4 no-underline hover:border-flag-green/40"
          >
            <span className="font-medium text-foreground">{t.name}</span>
            <span className="font-mono text-sm text-muted-foreground">{t.billCount}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
