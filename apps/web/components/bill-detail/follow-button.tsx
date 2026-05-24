import Link from 'next/link';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { sessionCookie, follow, unfollow, isFollowing, listSubscriptions } from '@/lib/session';

interface Props {
  targetType: 'BILL' | 'TOPIC' | 'SPONSOR' | 'CHAMBER';
  targetId: string;
  /** Page to revalidate after follow/unfollow. */
  revalidate: string;
  /** Optional label override; defaults to "Follow this bill" / "Following ✓" */
  followLabel?: string;
  followingLabel?: string;
}

export async function FollowButton({ targetType, targetId, revalidate, followLabel, followingLabel }: Props) {
  const token = sessionCookie();
  if (!token) {
    return (
      <Link
        href={`/login?return=${encodeURIComponent(revalidate)}`}
        className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium no-underline hover:border-flag-green hover:text-flag-green-dark"
      >
        Sign in to follow
      </Link>
    );
  }

  const following = await isFollowing(targetType, targetId);

  async function toggle() {
    'use server';
    const isFollowed = await isFollowing(targetType, targetId);
    if (isFollowed) {
      // Look up the subscription id so we can delete it
      const subs = await listSubscriptions();
      const sub = subs.find((s) => s.targetType === targetType && s.targetId === targetId);
      if (sub) await unfollow(sub.id);
    } else {
      await follow(targetType, targetId);
    }
    revalidatePath(revalidate);
  }

  return (
    <form action={toggle}>
      <button
        type="submit"
        className={
          following
            ? 'inline-flex items-center gap-1 rounded-md border border-flag-green bg-flag-green/10 px-3 py-1.5 text-sm font-medium text-flag-green-dark hover:bg-flag-green/15'
            : 'inline-flex items-center gap-1 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium hover:border-flag-green hover:text-flag-green-dark'
        }
      >
        {following ? (
          <>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
              <path d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0L3.3 9.7a1 1 0 011.4-1.4l3.8 3.8 6.8-6.8a1 1 0 011.4 0z" />
            </svg>
            {followingLabel ?? 'Following'}
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
              <path d="M10 4a1 1 0 011 1v4h4a1 1 0 110 2h-4v4a1 1 0 11-2 0v-4H5a1 1 0 110-2h4V5a1 1 0 011-1z" />
            </svg>
            {followLabel ?? 'Follow this bill'}
          </>
        )}
      </button>
    </form>
  );
}
