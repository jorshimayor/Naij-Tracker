import Link from 'next/link';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { logoutFromAdmin } from '@/lib/admin';

const NAV = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/queue', label: 'Review queue' },
  { href: '/admin/contributions', label: 'Citizen submissions' },
  { href: '/admin/digest', label: 'Digest worker' },
  { href: '/admin/mock-emails', label: 'Mock email queue' },
  { href: '/admin/audit-log', label: 'Audit log' },
];

async function logoutAction() {
  'use server';
  logoutFromAdmin();
  redirect('/admin/login');
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const isLoggedIn = !!cookies().get('nbt_admin')?.value;

  // /admin/login renders without the chrome below.
  if (!isLoggedIn) return <>{children}</>;

  return (
    <div className="border-t border-border bg-muted">
      <div className="container-wide grid gap-6 py-8 lg:grid-cols-[220px_1fr]">
        <aside className="self-start rounded-lg border border-border bg-card p-4">
          <div className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">Editor</div>
          <nav className="flex flex-col gap-1 text-sm">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="rounded px-2 py-1.5 text-foreground no-underline hover:bg-muted hover:text-flag-green-dark">
                {n.label}
              </Link>
            ))}
          </nav>
          <form action={logoutAction} className="mt-4 border-t border-border pt-3">
            <button type="submit" className="text-xs text-muted-foreground hover:text-red-700 hover:underline">
              Sign out
            </button>
          </form>
        </aside>
        <main>{children}</main>
      </div>
    </div>
  );
}
