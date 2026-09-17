/** Pure paging helpers for the sideline feed (no server-only imports so they can be unit tested). */

/** Posts shown per page: the first render and every "Earlier plays" press. */
export const FEED_PAGE_SIZE = 5;

export type FeedCursor = { createdAt: string; id: string };

type Sortable = { id: string; created_at: string };

/** Cursor pointing at the oldest post currently shown, or null for an empty list. */
export function feedCursor<T extends Sortable>(posts: T[]): FeedCursor | null {
  const last = posts[posts.length - 1];
  return last ? { createdAt: last.created_at, id: last.id } : null;
}

/** Newest first, ties broken by id descending to match the database order. */
export function compareFeedPosts(a: Sortable, b: Sortable): number {
  if (a.created_at !== b.created_at) return a.created_at < b.created_at ? 1 : -1;
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}

/**
 * Merge a fresh first page from the server with everything already on screen. Fresh rows win
 * (they carry current reaction counts); older rows the first page no longer covers stay so a
 * new post arriving at the top never opens a gap between the page and the loaded tail.
 */
export function mergeFeedPosts<T extends Sortable>(fresh: T[], shown: T[]): T[] {
  const byId = new Map<string, T>();
  for (const p of shown) byId.set(p.id, p);
  for (const p of fresh) byId.set(p.id, p);
  return Array.from(byId.values()).sort(compareFeedPosts);
}

/** Append an older page, dropping anything already shown. */
export function appendFeedPosts<T extends Sortable>(shown: T[], older: T[]): T[] {
  const seen = new Set(shown.map((p) => p.id));
  return [...shown, ...older.filter((p) => !seen.has(p.id))].sort(compareFeedPosts);
}
