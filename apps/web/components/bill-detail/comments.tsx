import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { listComments, postComment, deleteOwnComment, getCurrentUser } from '@/lib/session';
import { timeAgo } from '@/lib/utils';

interface Props {
  billId: string;
  jurisdictionSlug: string;
  billSlug: string;
}

export async function Comments({ billId, jurisdictionSlug, billSlug }: Props) {
  const [user, comments] = await Promise.all([getCurrentUser(), listComments(billId)]);
  const path = `/bills/${jurisdictionSlug}/${billSlug}`;

  async function add(formData: FormData) {
    'use server';
    const body = String(formData.get('body') ?? '').trim();
    if (body.length < 2) return;
    await postComment(billId, body);
    revalidatePath(path);
  }

  async function remove(formData: FormData) {
    'use server';
    const id = String(formData.get('id') ?? '');
    if (!id) return;
    await deleteOwnComment(id);
    revalidatePath(path);
  }

  return (
    <div className="space-y-6">
      {user ? (
        <form action={add} className="space-y-2">
          <label htmlFor="comment-body" className="block text-sm font-medium text-foreground">
            Add a comment
          </label>
          <textarea
            id="comment-body"
            name="body"
            rows={3}
            required
            minLength={2}
            maxLength={2000}
            placeholder="Share your view on this bill. Keep it civil and on-topic."
            className="w-full rounded-md border border-border bg-card px-3 py-2 text-base focus:border-flag-green focus:outline-none focus:ring-2 focus:ring-flag-green/30"
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Comments are public, signed with your display name.</span>
            <button type="submit" className="rounded-md bg-flag-green px-4 py-1.5 text-sm font-semibold text-white hover:bg-flag-green-dark">
              Post comment
            </button>
          </div>
        </form>
      ) : (
        <div className="rounded-md border border-border bg-card p-4 text-sm text-muted-foreground">
          <Link href={`/login?return=${encodeURIComponent(path)}`} className="text-flag-green-dark hover:underline">
            Sign in
          </Link>{' '}
          to leave a comment.
        </div>
      )}

      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No comments yet. Be the first.</p>
      ) : (
        <ul className="space-y-4 border-t border-border pt-4">
          {comments.map((c) => (
            <li key={c.id} className="border-b border-border pb-4 last:border-b-0">
              <div className="flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
                <div>
                  <span className="font-medium text-foreground">{c.author.name}</span>
                  {c.author.isYou && <span className="ml-1 text-[10px] uppercase tracking-widest text-flag-green-dark">you</span>}
                  {c.status === 'PENDING_MODERATION' && (
                    <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] uppercase tracking-widest text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                      pending review
                    </span>
                  )}
                </div>
                <span>{timeAgo(c.createdAt)}</span>
              </div>
              <p className="mt-1 whitespace-pre-line text-foreground/90">{c.body}</p>
              {c.author.isYou && (
                <form action={remove} className="mt-1">
                  <input type="hidden" name="id" value={c.id} />
                  <button type="submit" className="text-xs text-muted-foreground hover:text-red-600 hover:underline">
                    Delete
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
